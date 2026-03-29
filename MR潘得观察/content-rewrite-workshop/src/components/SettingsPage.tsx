import { useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  Zap,
  AlertCircle,
  Settings,
  Key,
  FlaskConical,
  CheckCircle,
} from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import { llmManager } from '../services/llm/manager';
import { PROVIDER_LIST, type ProviderConfig } from '../services/llm/types';
import { ProviderEditForm } from './ProviderEditForm';
import { ApiDebugPanel } from './ApiDebugPanel';

// Tab 类型
type TabType = 'ai' | 'other';

// AI供应商Tab组件
function AIProvidersTab() {
  const {
    ai,
    addProvider,
    updateProvider,
    removeProvider,
    setPrimaryProvider,
    toggleProvider,
    updateFailoverConfig,
  } = useSettingsStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ [key: string]: { success: boolean; error?: string } }>({});
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState<string | null>(null);

  // 新增供应商表单状态
  const [newProvider, setNewProvider] = useState<Partial<ProviderConfig>>({
    name: '',
    provider: 'openai',
    apiKey: '',
    model: '',
    temperature: 0.7,
    baseUrl: '',
    isEnabled: true,
    isPrimary: false,
  });

  const selectedProviderInfo = PROVIDER_LIST.find(p => p.id === newProvider.provider);

  // 处理添加供应商
  const handleAddProvider = () => {
    if (!newProvider.name || !newProvider.apiKey || !newProvider.model) return;

    addProvider({
      name: newProvider.name,
      provider: newProvider.provider as any,
      apiKey: newProvider.apiKey,
      model: newProvider.model,
      temperature: newProvider.temperature || 0.7,
      baseUrl: newProvider.baseUrl,
      isEnabled: newProvider.isEnabled ?? true,
      isPrimary: newProvider.isPrimary ?? ai.providers.length === 0,
    });

    setNewProvider({
      name: '',
      provider: 'openai',
      apiKey: '',
      model: '',
      temperature: 0.7,
      baseUrl: '',
      isEnabled: true,
      isPrimary: false,
    });
    setShowAddForm(false);
  };

  // 处理测试连接
  const handleTestConnection = async (provider: ProviderConfig) => {
    console.log('[Test] Provider:', provider.name, 'type:', provider.provider);
    setTestingId(provider.id);
    setTestResult(prev => ({ ...prev, [provider.id]: { success: false, error: '测试中...' } }));

    try {
      const result = await llmManager.testConnection(provider);
      console.log('[Test] Result:', result);
      setTestResult(prev => ({ ...prev, [provider.id]: result }));
    } catch (error) {
      setTestResult(prev => ({
        ...prev,
        [provider.id]: {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 故障转移设置 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-slate-900">自动切换设置</h3>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={ai.failover.enabled}
              onChange={(e) => updateFailoverConfig({ enabled: e.target.checked })}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium text-slate-700">启用自动切换</span>
              <p className="text-sm text-slate-500">主供应商失败时自动切换到备用供应商</p>
            </div>
          </label>

          {ai.failover.enabled && (
            <div className="flex gap-4 ml-8">
              <div>
                <label className="text-sm text-slate-600">重试次数</label>
                <select
                  value={ai.failover.maxRetries}
                  onChange={(e) => updateFailoverConfig({ maxRetries: Number(e.target.value) })}
                  className="ml-2 px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                >
                  {[1, 2, 3, 5, 10].map(n => (
                    <option key={n} value={n}>{n}次</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-600">切换间隔</label>
                <select
                  value={ai.failover.retryDelay}
                  onChange={(e) => updateFailoverConfig({ retryDelay: Number(e.target.value) })}
                  className="ml-2 px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                >
                  <option value={500}>0.5秒</option>
                  <option value={1000}>1秒</option>
                  <option value={2000}>2秒</option>
                  <option value={3000}>3秒</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 供应商列表 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-slate-900">AI供应商配置</h3>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加供应商
          </button>
        </div>

        {ai.providers.length === 0 && !showAddForm ? (
          <div className="text-center py-8 text-slate-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>暂无配置的供应商</p>
            <p className="text-sm">点击上方按钮添加 AI 供应商</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ai.providers.map((provider) => (
              <div
                key={provider.id}
                className={`p-4 rounded-lg border transition-colors ${
                  provider.isPrimary
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {provider.isPrimary && (
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                        主
                      </span>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{provider.name}</span>
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {provider.provider}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500">
                        模型: {provider.model} • 温度: {provider.temperature}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* 测试连接 */}
                    <button
                      onClick={() => handleTestConnection(provider)}
                      disabled={testingId === provider.id}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        testingId === provider.id
                          ? 'bg-blue-100 text-blue-600'
                          : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                      }`}
                      title="测试连接"
                    >
                      {testingId === provider.id ? '测试中...' : '测试'}
                    </button>

                    {/* 调试面板 */}
                    <button
                      onClick={() => setShowDebugPanel(showDebugPanel === provider.id ? null : provider.id)}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        showDebugPanel === provider.id
                          ? 'bg-purple-100 text-purple-600'
                          : 'text-slate-500 hover:text-purple-600 hover:bg-purple-50'
                      }`}
                      title="API调试"
                    >
                      <FlaskConical className="w-4 h-4" />
                    </button>

                    {/* 编辑 */}
                    <button
                      onClick={() => setEditingProvider(provider)}
                      className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                      title="编辑"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* 设置为主供应商 */}
                    {!provider.isPrimary && (
                      <button
                        onClick={() => setPrimaryProvider(provider.id)}
                        className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                        title="设为主供应商"
                      >
                        <Zap className="w-4 h-4" />
                      </button>
                    )}

                    {/* 启用/禁用 */}
                    <button
                      onClick={() => toggleProvider(provider.id, !provider.isEnabled)}
                      className={`p-2 transition-colors ${
                        provider.isEnabled
                          ? 'text-green-600'
                          : 'text-slate-300'
                      }`}
                      title={provider.isEnabled ? '已启用' : '已禁用'}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        provider.isEnabled ? 'bg-green-600 border-green-600' : 'border-slate-300'
                      }`} />
                    </button>

                    {/* 删除 */}
                    <button
                      onClick={() => removeProvider(provider.id)}
                      className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {testResult[provider.id] && (
                  <div className={`text-sm font-medium ${
                    testResult[provider.id].success ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {testResult[provider.id].success ? '✓ 连接成功' : `✗ ${testResult[provider.id].error}`}
                  </div>
                )}

                {/* 调试面板 */}
                {showDebugPanel === provider.id && (
                  <div className="mt-4">
                    <ApiDebugPanel provider={provider} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 添加供应商表单 */}
        {showAddForm && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="font-medium text-slate-900 mb-4">添加新供应商</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  供应商类型
                </label>
                <select
                  value={newProvider.provider}
                  onChange={(e) => {
                    const info = PROVIDER_LIST.find(p => p.id === e.target.value);
                    setNewProvider({
                      ...newProvider,
                      provider: e.target.value as any,
                      model: info?.defaultModel || '',
                      baseUrl: info?.id === 'custom' ? '' : info?.baseUrl,
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  {PROVIDER_LIST.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  显示名称
                </label>
                <input
                  type="text"
                  value={newProvider.name}
                  onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                  placeholder="如: 我的 OpenAI"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={newProvider.apiKey}
                  onChange={(e) => setNewProvider({ ...newProvider, apiKey: e.target.value })}
                  placeholder="sk-xxx..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  模型
                </label>
                <input
                  type="text"
                  value={newProvider.model}
                  onChange={(e) => setNewProvider({ ...newProvider, model: e.target.value })}
                  placeholder={selectedProviderInfo?.defaultModel || 'gpt-4o'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              {newProvider.provider === 'custom' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Base URL
                  </label>
                  <input
                    type="text"
                    value={newProvider.baseUrl}
                    onChange={(e) => setNewProvider({ ...newProvider, baseUrl: e.target.value })}
                    placeholder="https://api.example.com/v1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  温度 (0-2)
                </label>
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={newProvider.temperature}
                  onChange={(e) => setNewProvider({ ...newProvider, temperature: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newProvider.isPrimary}
                    onChange={(e) => setNewProvider({ ...newProvider, isPrimary: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-700">设为主供应商</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddProvider}
                disabled={!newProvider.name || !newProvider.apiKey || !newProvider.model}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                添加
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 编辑供应商弹窗 */}
      {editingProvider && (
        <ProviderEditForm
          provider={editingProvider}
          onSave={(updates) => {
            updateProvider(editingProvider.id, updates);
            setEditingProvider(null);
          }}
          onCancel={() => setEditingProvider(null)}
        />
      )}
    </div>
  );
}


// 其他设置Tab组件
function OtherSettingsTab() {
  const { testMode, toggleTestMode } = useSettingsStore();

  return (
    <div className="space-y-4">
      {/* 测试模式 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${testMode ? 'bg-purple-100' : 'bg-slate-100'}`}>
              <FlaskConical className={`w-5 h-5 ${testMode ? 'text-purple-600' : 'text-slate-500'}`} />
            </div>
            <div>
              <h3 className="font-medium text-slate-900">测试模式</h3>
              <p className="text-sm text-slate-500">启用后使用模拟数据，跳过API调用和输入限制</p>
            </div>
          </div>
          <button
            onClick={toggleTestMode}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              testMode ? 'bg-purple-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                testMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {testMode && (
          <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-sm text-purple-800">
              测试模式已启用：所有AI功能将使用模拟数据，你可以跳过API配置直接预览完整流程。
            </p>
          </div>
        )}
      </div>

      {/* 其他设置占位 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="text-center py-8 text-slate-500">
          <Settings className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p>更多设置功能开发中...</p>
          <p className="text-sm">后续将添加数据存储、版本管理等功能</p>
        </div>
      </div>
    </div>
  );
}

// 主设置页面组件
export default function SettingsPage({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<TabType>('ai');

  const tabs = [
    { id: 'ai' as const, label: 'AI供应商', icon: Key },
    { id: 'other' as const, label: '其他设置', icon: Settings },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'ai':
        return <AIProvidersTab />;
      case 'other':
        return <OtherSettingsTab />;
      default:
        return <AIProvidersTab />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 头部 */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="text-xl font-bold text-slate-900">产品设置</h1>
          </div>
        </div>

        {/* Tab导航 */}
        <div className="max-w-4xl mx-auto px-6">
          {/* 一级 Tab */}
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {renderContent()}
      </div>
    </div>
  );
}
