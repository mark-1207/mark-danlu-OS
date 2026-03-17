import { useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Zap,
  AlertCircle,
  Settings,
  Palette,
  RotateCcw,
  Key
} from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import { llmManager } from '../services/llm/manager';
import { PROVIDER_LIST, type ProviderConfig, type TemplateVariable, DEFAULT_VARIABLES, type AnalysisTemplate, type OptimizationTemplate } from '../services/llm/types';

// Tab 类型
type TabType = 'ai' | 'platforms' | 'analysis' | 'optimization' | 'other' | 'templates';

// AI供应商Tab组件
function AIProvidersTab() {
  const {
    ai,
    addProvider,
    removeProvider,
    setPrimaryProvider,
    toggleProvider,
    updateFailoverConfig,
  } = useSettingsStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ [key: string]: { success: boolean; error?: string } }>({});

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
    </div>
  );
}

// 平台模板Tab组件
function PlatformsTab() {
  const {
    platforms,
    addPlatform,
    updatePlatform,
    removePlatform,
    resetPlatform,
    setDefaultPlatform,
    addTitleVariable,
    removeTitleVariable,
    addContentVariable,
    removeContentVariable,
  } = useSettingsStore();

  const [selectedPlatformId, setSelectedPlatformId] = useState<string>(platforms.defaultPlatform);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<'title' | 'content' | 'quality' | null>(null);
  const [tempContent, setTempContent] = useState('');

  const selectedPlatform = platforms.templates.find(p => p.id === selectedPlatformId);

  // 新增平台表单状态
  const [newPlatform, setNewPlatform] = useState({
    name: '',
    icon: '',
    isDefault: false,
  });

  const handleAddPlatform = () => {
    if (!newPlatform.name) return;

    addPlatform({
      name: newPlatform.name,
      icon: newPlatform.icon || newPlatform.name.slice(0, 2),
      isDefault: newPlatform.isDefault,
      titlePrompt: '',
      titleVariables: [...DEFAULT_VARIABLES],
      contentPrompt: '',
      contentVariables: [...DEFAULT_VARIABLES],
      qualityPrompt: '',
      qualityCriteria: [],
    });

    setNewPlatform({ name: '', icon: '', isDefault: false });
    setShowAddForm(false);
  };

  const handleSaveTemplate = (type: 'title' | 'content' | 'quality') => {
    if (!selectedPlatform) return;

    switch (type) {
      case 'title':
        updatePlatform(selectedPlatformId, { titlePrompt: tempContent });
        break;
      case 'content':
        updatePlatform(selectedPlatformId, { contentPrompt: tempContent });
        break;
      case 'quality':
        updatePlatform(selectedPlatformId, { qualityPrompt: tempContent });
        break;
    }
    setEditingTemplate(null);
    setTempContent('');
  };

  const handleAddVariable = (type: 'title' | 'content', variable: TemplateVariable) => {
    if (!selectedPlatform) return;

    if (type === 'title') {
      if (!selectedPlatform.titleVariables.find(v => v.name === variable.name)) {
        addTitleVariable(selectedPlatformId, variable);
      }
    } else {
      if (!selectedPlatform.contentVariables.find(v => v.name === variable.name)) {
        addContentVariable(selectedPlatformId, variable);
      }
    }
  };

  const [showAddVariable, setShowAddVariable] = useState<{ type: 'title' | 'content'; visible: boolean }>({
    type: 'title',
    visible: false,
  });

  return (
    <div className="space-y-6">
      {/* 平台列表 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-purple-500" />
            <h3 className="font-semibold text-slate-900">平台模板</h3>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加平台
          </button>
        </div>

        {/* 平台卡片 */}
        <div className="flex flex-wrap gap-3">
          {platforms.templates.map(platform => (
            <button
              key={platform.id}
              onClick={() => setSelectedPlatformId(platform.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all ${
                selectedPlatformId === platform.id
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <span className="text-lg">{platform.icon}</span>
              <span className="font-medium">{platform.name}</span>
              {platform.isBuiltIn && (
                <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-xs rounded">
                  内置
                </span>
              )}
              {platform.isDefault && (
                <span className="px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded">
                  默认
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 添加平台表单 */}
        {showAddForm && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="font-medium text-slate-900 mb-4">添加新平台</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  平台名称
                </label>
                <input
                  type="text"
                  value={newPlatform.name}
                  onChange={(e) => setNewPlatform({ ...newPlatform, name: e.target.value })}
                  placeholder="如: 知乎"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  图标/标签
                </label>
                <input
                  type="text"
                  value={newPlatform.icon}
                  onChange={(e) => setNewPlatform({ ...newPlatform, icon: e.target.value })}
                  placeholder="如: zhihu 或 📝"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newPlatform.isDefault}
                    onChange={(e) => setNewPlatform({ ...newPlatform, isDefault: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-700">设为默认平台</span>
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
                onClick={handleAddPlatform}
                disabled={!newPlatform.name}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                添加
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 模板编辑 */}
      {selectedPlatform && (
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedPlatform.icon}</span>
              <div>
                <h3 className="font-semibold text-slate-900">{selectedPlatform.name}</h3>
                <p className="text-sm text-slate-500">
                  {selectedPlatform.isBuiltIn ? '内置平台' : '自定义平台'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!selectedPlatform.isDefault && (
                <button
                  onClick={() => setDefaultPlatform(selectedPlatform.id)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Check className="w-4 h-4" />
                  设为默认
                </button>
              )}
              {selectedPlatform.isBuiltIn && (
                <button
                  onClick={() => resetPlatform(selectedPlatform.id)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  重置
                </button>
              )}
              {!selectedPlatform.isBuiltIn && (
                <button
                  onClick={() => removePlatform(selectedPlatform.id)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  删除
                </button>
              )}
            </div>
          </div>

          {/* 标题模板 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-slate-900">📝 标题模板</h4>
              <button
                onClick={() => {
                  setEditingTemplate('title');
                  setTempContent(selectedPlatform.titlePrompt);
                }}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600 whitespace-pre-wrap">
              {selectedPlatform.titlePrompt || '点击编辑按钮设置标题模板'}
            </div>

            {/* 变量标签 */}
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedPlatform.titleVariables.map(v => (
                <span
                  key={v.name}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded"
                >
                  {v.name}
                  <button
                    onClick={() => removeTitleVariable(selectedPlatform.id, v.name)}
                    className="hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={() => setShowAddVariable({ type: 'title', visible: true })}
                className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
              >
                + 添加变量
              </button>
            </div>
          </div>

          {/* 正文模板 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-slate-900">📄 正文模板</h4>
              <button
                onClick={() => {
                  setEditingTemplate('content');
                  setTempContent(selectedPlatform.contentPrompt);
                }}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {selectedPlatform.contentPrompt || '点击编辑按钮设置正文模板'}
            </div>

            {/* 变量标签 */}
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedPlatform.contentVariables.map(v => (
                <span
                  key={v.name}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded"
                >
                  {v.name}
                  <button
                    onClick={() => removeContentVariable(selectedPlatform.id, v.name)}
                    className="hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={() => setShowAddVariable({ type: 'content', visible: true })}
                className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
              >
                + 添加变量
              </button>
            </div>
          </div>

          {/* 质检模板 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-slate-900">✓ 质检模板</h4>
              <button
                onClick={() => {
                  setEditingTemplate('quality');
                  setTempContent(selectedPlatform.qualityPrompt);
                }}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600 whitespace-pre-wrap">
              {selectedPlatform.qualityPrompt || '点击编辑按钮设置质检模板'}
            </div>

            {/* 质检维度 */}
            <div className="mt-3">
              <p className="text-sm text-slate-600 mb-2">质检维度：</p>
              <div className="flex flex-wrap gap-2">
                {selectedPlatform.qualityCriteria.map((c, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded"
                  >
                    {c}
                  </span>
                ))}
                {selectedPlatform.qualityCriteria.length === 0 && (
                  <span className="text-sm text-slate-400">暂无质检维度</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 模板编辑弹窗 */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="font-semibold text-lg mb-4">
              编辑{editingTemplate === 'title' ? '标题' : editingTemplate === 'content' ? '正文' : '质检'}模板
            </h3>
            <textarea
              value={tempContent}
              onChange={(e) => setTempContent(e.target.value)}
              className="w-full h-64 px-4 py-3 border border-slate-300 rounded-lg font-mono text-sm"
              placeholder="输入提示词模板内容，可以使用变量如 {title}, {content}, {keywords} 等"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  setTempContent('');
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={() => handleSaveTemplate(editingTemplate)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 添加变量弹窗 */}
      {showAddVariable.visible && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-lg mb-4">添加变量</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {DEFAULT_VARIABLES.filter(v => {
                const currentVars = showAddVariable.type === 'title'
                  ? selectedPlatform?.titleVariables
                  : selectedPlatform?.contentVariables;
                return !currentVars?.find(cv => cv.name === v.name);
              }).map(variable => (
                <button
                  key={variable.name}
                  onClick={() => {
                    handleAddVariable(showAddVariable.type, variable);
                    setShowAddVariable({ type: 'title', visible: false });
                  }}
                  className="w-full text-left p-3 hover:bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="font-medium text-slate-900">{variable.name}</div>
                  <div className="text-sm text-slate-500">{variable.description}</div>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowAddVariable({ type: 'title', visible: false })}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 内容分析模板Tab组件
function AnalysisTab() {
  const {
    analysis,
    addAnalysisTemplate,
    updateAnalysisTemplate,
    removeAnalysisTemplate,
    resetAnalysisTemplate,
    setDefaultAnalysisTemplate,
  } = useSettingsStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState<Partial<AnalysisTemplate>>({
    name: '',
    analysisPrompt: '',
    outputFormat: { fields: [] },
    isDefault: false,
  });
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAdd = () => {
    if (!newTemplate.name || !newTemplate.analysisPrompt) return;
    addAnalysisTemplate({
      name: newTemplate.name,
      analysisPrompt: newTemplate.analysisPrompt,
      outputFormat: newTemplate.outputFormat || { fields: [] },
      isDefault: newTemplate.isDefault || false,
    });
    setNewTemplate({ name: '', analysisPrompt: '', outputFormat: { fields: [] }, isDefault: false });
    setShowAddForm(false);
  };

  const currentEditing = editingId ? analysis.templates.find(t => t.id === editingId) : null;

  return (
    <div className="space-y-6">
      {/* 模板列表 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">内容分析模板</h3>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            添加模板
          </button>
        </div>

        {analysis.templates.length === 0 && !showAddForm ? (
          <div className="text-center py-8 text-slate-500">
            <p>暂无分析模板</p>
          </div>
        ) : (
          <div className="space-y-2">
            {analysis.templates.map((template) => (
              <div
                key={template.id}
                className={`p-3 rounded-lg border flex items-center justify-between ${
                  template.isDefault ? 'border-blue-300 bg-blue-50' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {template.isDefault && (
                    <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">默认</span>
                  )}
                  <span className="font-medium">{template.name}</span>
                  {template.isBuiltIn && (
                    <span className="text-xs text-slate-400">(内置)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!template.isDefault && (
                    <button
                      onClick={() => setDefaultAnalysisTemplate(template.id)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      设为默认
                    </button>
                  )}
                  <button
                    onClick={() => setEditingId(template.id)}
                    className="p-1.5 text-slate-400 hover:text-blue-600"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  {!template.isBuiltIn && (
                    <button
                      onClick={() => removeAnalysisTemplate(template.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 添加表单 */}
      {showAddForm && (
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h4 className="font-medium mb-4">添加新模板</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">模板名称</label>
              <input
                type="text"
                value={newTemplate.name || ''}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                placeholder="例如：深度内容分析"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">分析提示词</label>
              <textarea
                value={newTemplate.analysisPrompt || ''}
                onChange={(e) => setNewTemplate({ ...newTemplate, analysisPrompt: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg h-48"
                placeholder="输入分析提示词..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                保存
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewTemplate({ name: '', analysisPrompt: '', outputFormat: { fields: [] }, isDefault: false }); }}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑面板 */}
      {currentEditing && (
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h4 className="font-medium mb-4">编辑模板: {currentEditing.name}</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">分析提示词</label>
              <textarea
                defaultValue={currentEditing.analysisPrompt}
                onChange={(e) => updateAnalysisTemplate(currentEditing.id, { analysisPrompt: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg h-64 font-mono text-sm"
              />
            </div>
            <div className="flex gap-2">
              {currentEditing.isBuiltIn && (
                <button
                  onClick={() => resetAnalysisTemplate(currentEditing.id)}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  重置为默认
                </button>
              )}
              <button
                onClick={() => setEditingId(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                保存并关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 优化报告模板Tab组件
function OptimizationTab() {
  const {
    optimization,
    addOptimizationTemplate,
    updateOptimizationTemplate,
    removeOptimizationTemplate,
    resetOptimizationTemplate,
    setDefaultOptimizationTemplate,
  } = useSettingsStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState<Partial<OptimizationTemplate>>({
    name: '',
    systemPrompt: '',
    optimizePrompt: '',
    isDefault: false,
  });
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAdd = () => {
    if (!newTemplate.name || !newTemplate.systemPrompt || !newTemplate.optimizePrompt) return;
    addOptimizationTemplate({
      name: newTemplate.name,
      systemPrompt: newTemplate.systemPrompt,
      optimizePrompt: newTemplate.optimizePrompt,
      isDefault: newTemplate.isDefault || false,
    });
    setNewTemplate({ name: '', systemPrompt: '', optimizePrompt: '', isDefault: false });
    setShowAddForm(false);
  };

  const currentEditing = editingId ? optimization.templates.find(t => t.id === editingId) : null;

  return (
    <div className="space-y-6">
      {/* 模板列表 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">优化报告模板</h3>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            添加模板
          </button>
        </div>

        {optimization.templates.length === 0 && !showAddForm ? (
          <div className="text-center py-8 text-slate-500">
            <p>暂无优化模板</p>
          </div>
        ) : (
          <div className="space-y-2">
            {optimization.templates.map((template) => (
              <div
                key={template.id}
                className={`p-3 rounded-lg border flex items-center justify-between ${
                  template.isDefault ? 'border-blue-300 bg-blue-50' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {template.isDefault && (
                    <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">默认</span>
                  )}
                  <span className="font-medium">{template.name}</span>
                  {template.isBuiltIn && (
                    <span className="text-xs text-slate-400">(内置)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!template.isDefault && (
                    <button
                      onClick={() => setDefaultOptimizationTemplate(template.id)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      设为默认
                    </button>
                  )}
                  <button
                    onClick={() => setEditingId(template.id)}
                    className="p-1.5 text-slate-400 hover:text-blue-600"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  {!template.isBuiltIn && (
                    <button
                      onClick={() => removeOptimizationTemplate(template.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 添加表单 */}
      {showAddForm && (
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h4 className="font-medium mb-4">添加新模板</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">模板名称</label>
              <input
                type="text"
                value={newTemplate.name || ''}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                placeholder="例如：深度优化"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">系统提示词</label>
              <textarea
                value={newTemplate.systemPrompt || ''}
                onChange={(e) => setNewTemplate({ ...newTemplate, systemPrompt: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg h-24"
                placeholder="输入系统提示词..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">优化提示词模板</label>
              <textarea
                value={newTemplate.optimizePrompt || ''}
                onChange={(e) => setNewTemplate({ ...newTemplate, optimizePrompt: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg h-48 font-mono text-sm"
                placeholder="输入优化提示词... 可用变量: {originalContent}, {qualityReport}"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                保存
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewTemplate({ name: '', systemPrompt: '', optimizePrompt: '', isDefault: false }); }}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑面板 */}
      {currentEditing && (
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h4 className="font-medium mb-4">编辑模板: {currentEditing.name}</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">系统提示词</label>
              <textarea
                defaultValue={currentEditing.systemPrompt}
                onChange={(e) => updateOptimizationTemplate(currentEditing.id, { systemPrompt: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg h-24"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">优化提示词模板</label>
              <textarea
                defaultValue={currentEditing.optimizePrompt}
                onChange={(e) => updateOptimizationTemplate(currentEditing.id, { optimizePrompt: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg h-64 font-mono text-sm"
              />
            </div>
            <div className="flex gap-2">
              {currentEditing.isBuiltIn && (
                <button
                  onClick={() => resetOptimizationTemplate(currentEditing.id)}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  重置为默认
                </button>
              )}
              <button
                onClick={() => setEditingId(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                保存并关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 其他设置Tab组件
function OtherSettingsTab() {
  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200">
      <div className="text-center py-12 text-slate-500">
        <Settings className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p>更多设置功能开发中...</p>
        <p className="text-sm">后续将添加数据存储、版本管理等功能</p>
      </div>
    </div>
  );
}

// 主设置页面组件
export default function SettingsPage({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<TabType>('ai');
  const [activeSubTab, setActiveSubTab] = useState<'platforms' | 'analysis' | 'optimization'>('platforms');

  const tabs = [
    { id: 'ai' as const, label: 'AI供应商', icon: Key },
    { id: 'templates' as const, label: '模板配置', icon: Palette, hasSubTabs: true },
    { id: 'other' as const, label: '其他设置', icon: Settings },
  ];

  const subTabs = [
    { id: 'platforms' as const, label: '平台模板' },
    { id: 'analysis' as const, label: '内容分析' },
    { id: 'optimization' as const, label: '优化报告' },
  ];

  const renderContent = () => {
    if (activeTab === 'templates') {
      switch (activeSubTab) {
        case 'platforms':
          return <PlatformsTab />;
        case 'analysis':
          return <AnalysisTab />;
        case 'optimization':
          return <OptimizationTab />;
        default:
          return <PlatformsTab />;
      }
    }

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
                onClick={() => {
                  if (tab.hasSubTabs) {
                    setActiveTab('templates');
                  } else {
                    setActiveTab(tab.id);
                  }
                }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  (tab.hasSubTabs ? activeTab === 'templates' : activeTab === tab.id)
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* 二级 Tab - 模板配置 */}
          {activeTab === 'templates' && (
            <div className="flex gap-1 pl-4 mt-1">
              {subTabs.map(subTab => (
                <button
                  key={subTab.id}
                  onClick={() => setActiveSubTab(subTab.id)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeSubTab === subTab.id
                      ? 'border-blue-400 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {subTab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 内容区域 */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {renderContent()}
      </div>
    </div>
  );
}
