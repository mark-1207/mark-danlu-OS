import { useState, useRef } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  Zap,
  AlertCircle,
  Settings,
  Palette,
  Key,
  FlaskConical,
  Upload,
  CheckCircle,
  ClipboardList,
  Eye,
} from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import { llmManager } from '../services/llm/manager';
import { PROVIDER_LIST, type ProviderConfig, type AnalysisTemplate, type OptimizationTemplate, VARIABLE_LABELS } from '../services/llm/types';
import { ProviderEditForm } from './ProviderEditForm';
import { ApiDebugPanel } from './ApiDebugPanel';
import { CompareModal } from './CompareModal';
import { autoFormatTemplate, type FormatOutput } from '../services/autoFormatService';
import { slimAndFormat } from '../services/templateFormatter';
import { checkPromptLength, getRiskLevelColor, getRiskLevelBorderColor, type LengthCheckResult } from '../services/promptLengthChecker';

// Tab 类型
type TabType = 'ai' | 'platforms' | 'analysis' | 'quality' | 'optimization' | 'other' | 'templates';

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

// 判断模板是否为内置模板
function isBuiltInTemplate(platformId: string, templateId: string): boolean {
  const builtInPlatforms = ['gzh', 'xhs', 'douyin'];
  if (!builtInPlatforms.includes(platformId)) return false;
  // 内置模板的 ID 通常以平台 ID 开头
  return templateId.startsWith(platformId);
}

// 平台模板Tab组件
function PlatformsTab() {
  const {
    platforms,
    addPlatform,
    removePlatform,
    addContentTemplate,
    updateContentTemplate,
    removeContentTemplate,
    setDefaultContentTemplate,
  } = useSettingsStore();

  const [selectedPlatformId, setSelectedPlatformId] = useState<string>(platforms.defaultPlatform);
  const [showAddForm, setShowAddForm] = useState(false);

  // 编辑相关状态
  const [editingTemplate, setEditingTemplate] = useState<{ platformId: string; templateId: string } | null>(null);
  const [tempContent, setTempContent] = useState('');

  // 格式化对比弹窗状态
  const [formatResult, setFormatResult] = useState<FormatOutput | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // 精简相关状态
  const [slimMode, setSlimMode] = useState<'format' | 'slim'>('format');
  const [slimResult, setSlimResult] = useState<{
    slimmed: string;
    removedSections: { content: string; reason: string }[];
    statistics: { originalLength: number; slimmedLength: number; removedLength: number; removedPercentage: number };
  } | null>(null);
  const [lengthCheckResult, setLengthCheckResult] = useState<LengthCheckResult | null>(null);

  // 新增平台表单状态
  const [newPlatform, setNewPlatform] = useState({
    name: '',
    icon: '',
  });

  const selectedPlatform = platforms.platforms?.find(p => p.id === selectedPlatformId);

  // 获取内置模板和自定义模板
  const getBuiltInTemplates = () => {
    if (!selectedPlatform) return [];
    return selectedPlatform.templates.filter(t => isBuiltInTemplate(selectedPlatform.id, t.id));
  };

  const getCustomTemplates = () => {
    if (!selectedPlatform) return [];
    return selectedPlatform.templates.filter(t => !isBuiltInTemplate(selectedPlatform.id, t.id));
  };

  // 文件上传引用
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件上传
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setTempContent(content);
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 处理添加平台
  const handleAddPlatform = () => {
    if (!newPlatform.name) return;

    addPlatform({
      name: newPlatform.name,
      icon: newPlatform.icon || newPlatform.name.slice(0, 2),
      templates: [
        {
          name: '默认模板',
          titlePrompt: '',
          contentPrompt: '',
        }
      ],
    });

    setNewPlatform({ name: '', icon: '' });
    setShowAddForm(false);
  };

  // 处理添加自定义模板
  const handleAddCustomTemplate = () => {
    if (!selectedPlatform) return;
    addContentTemplate(selectedPlatform.id, {
      name: `自定义模板${selectedPlatform.templates.length}`,
      titlePrompt: '',
      contentPrompt: '',
    });
  };

  // 处理删除模板
  const handleRemoveTemplate = (templateId: string) => {
    if (!selectedPlatform) return;
    removeContentTemplate(selectedPlatform.id, templateId);
  };

  // 打开编辑弹窗（自定义模板）
  const handleOpenEdit = (templateId: string) => {
    if (!selectedPlatform) return;
    const template = selectedPlatform.templates.find(t => t.id === templateId);
    if (!template) return;

    const mergedContent = `# 标题提示词\n${template.titlePrompt || '(未设置)'}\n\n# 正文提示词\n${template.contentPrompt || '(未设置)'}`;
    setEditingTemplate({ platformId: selectedPlatform.id, templateId });
    setTempContent(mergedContent);
  };

  // 打开查看弹窗（内置模板，只读）
  const handleViewTemplate = (templateId: string) => {
    if (!selectedPlatform) return;
    const template = selectedPlatform.templates.find(t => t.id === templateId);
    if (!template) return;

    const mergedContent = `# 标题提示词\n${template.titlePrompt || '(未设置)'}\n\n# 正文提示词\n${template.contentPrompt || '(未设置)'}`;
    setEditingTemplate({ platformId: selectedPlatform.id, templateId });
    setTempContent(mergedContent);
  };

  // 解析提示词内容
  const parsePromptContent = (content: string): { titlePrompt: string; contentPrompt: string } => {
    let titlePrompt = '';
    let contentPrompt = '';

    const titleMatch = content.match(/#\s*标题[提示词]?\s*\n([\s\S]*?)(?=#\s*正文|$)/i);
    const contentMatch = content.match(/#\s*正文[提示词]?\s*\n([\s\S]*)/i);

    if (titleMatch) {
      titlePrompt = titleMatch[1].trim();
    }
    if (contentMatch) {
      contentPrompt = contentMatch[1].trim();
    }

    if (!titlePrompt && !contentPrompt) {
      const lines = content.split('\n');
      const titleKeywords = ['标题', 'title', '生成', '输出'];
      const isTitle = lines.some(l => titleKeywords.some(k => l.toLowerCase().includes(k.toLowerCase())));
      if (isTitle) {
        titlePrompt = content;
      } else {
        contentPrompt = content;
      }
    }

    return { titlePrompt, contentPrompt };
  };

  // 保存模板（触发格式化）
  const handleSaveTemplate = () => {
    if (!editingTemplate || !selectedPlatform) return;

    const template = selectedPlatform.templates.find(t => t.id === editingTemplate.templateId);
    if (!template) return;

    // 如果是内置模板，不允许编辑
    if (isBuiltInTemplate(selectedPlatform.id, template.id)) {
      alert('内置模板不可编辑');
      return;
    }

    // 解析内容
    const { titlePrompt, contentPrompt } = parsePromptContent(tempContent);

    // 合并内容用于格式化
    const mergedContent = `# 标题提示词\n${titlePrompt || ''}\n\n# 正文提示词\n${contentPrompt || ''}`;

    // 先进行字数检测
    const titleLengthCheck = checkPromptLength(titlePrompt || '', 'titlePrompt');
    const contentLengthCheck = checkPromptLength(contentPrompt || '', 'contentPrompt');

    // 保存字数检测结果
    setLengthCheckResult(contentLengthCheck); // 主要关注正文提示词的检测

    // 如果需要精简或用户需要精简
    if (slimMode === 'slim' || contentLengthCheck.recommendation === 'slim_and_format') {
      // 类型守卫：确保 platformId 有效
      const platformId = selectedPlatform.id as 'gzh' | 'xhs' | 'douyin';

      // 执行精简+格式化
      const { slimResult: titleSlim, formatResult: titleFormat } = slimAndFormat(
        mergedContent,
        'titlePrompt',
        platformId
      );
      const { slimResult: contentSlim, formatResult: contentFormat } = slimAndFormat(
        mergedContent,
        'contentPrompt',
        platformId
      );

      // 合并变更
      const allChanges = [...titleFormat.changes, ...contentFormat.changes];
      const allWarnings = [...titleFormat.warnings, ...contentFormat.warnings,
        ...(titleSlim.removedSections.length > 0 ? [`精简标题提示词：移除 ${titleSlim.statistics.removedLength} 字`] : []),
        ...(contentSlim.removedSections.length > 0 ? [`精简正文提示词：移除 ${contentSlim.statistics.removedLength} 字`] : [])
      ];

      // 解析格式化后的内容
      const { titlePrompt: fmtTitle, contentPrompt: fmtContent } = parsePromptContent(titleFormat.formatted);

      // 设置精简结果
      setSlimResult({
        slimmed: `# 标题提示词\n${fmtTitle}\n\n# 正文提示词\n${fmtContent}`,
        removedSections: [
          ...titleSlim.removedSections.map(s => ({ content: s.content, reason: `标题: ${s.reason}` })),
          ...contentSlim.removedSections.map(s => ({ content: s.content, reason: `正文: ${s.reason}` })),
        ],
        statistics: {
          originalLength: titleSlim.statistics.originalLength + contentSlim.statistics.originalLength,
          slimmedLength: titleSlim.statistics.slimmedLength + contentSlim.statistics.slimmedLength,
          removedLength: titleSlim.statistics.removedLength + contentSlim.statistics.removedLength,
          removedPercentage: (titleSlim.statistics.removedLength + contentSlim.statistics.removedLength) /
            (titleSlim.statistics.originalLength + contentSlim.statistics.originalLength || 1),
        },
      });

      setFormatResult({
        formatted: `# 标题提示词\n${fmtTitle}\n\n# 正文提示词\n${fmtContent}`,
        strategy: titleFormat.strategy,
        changes: allChanges,
        warnings: allWarnings,
      });
      setShowCompareModal(true);
      return;
    }

    // 标准格式化流程（不精简）
    // 格式化标题提示词
    const titleResult = autoFormatTemplate(mergedContent, 'titlePrompt', selectedPlatform.id);

    // 格式化正文提示词
    const contentResult = autoFormatTemplate(mergedContent, 'contentPrompt', selectedPlatform.id);

    // 检查是否有变更
    const hasTitleChange = titleResult.changes.length > 0 || titleResult.warnings.length > 0;
    const hasContentChange = contentResult.changes.length > 0 || contentResult.warnings.length > 0;

    if (hasTitleChange || hasContentChange) {
      // 合并变更
      const allChanges = [...titleResult.changes, ...contentResult.changes];
      const allWarnings = [...titleResult.warnings, ...contentResult.warnings];

      // 解析格式化后的内容
      const { titlePrompt: fmtTitle, contentPrompt: fmtContent } = parsePromptContent(titleResult.formatted);

      setFormatResult({
        formatted: `# 标题提示词\n${fmtTitle}\n\n# 正文提示词\n${fmtContent}`,
        strategy: titleResult.strategy,
        changes: allChanges,
        warnings: allWarnings,
      });
      setShowCompareModal(true);
    } else {
      // 无变更，直接保存
      doSave(titlePrompt, contentPrompt);
    }
  };

  // 执行保存
  const doSave = (titlePrompt: string, contentPrompt: string) => {
    if (!editingTemplate || !selectedPlatform) return;

    updateContentTemplate(editingTemplate.platformId, editingTemplate.templateId, {
      titlePrompt: titlePrompt || '',
      contentPrompt: contentPrompt || '',
    });
    setEditingTemplate(null);
    setTempContent('');
    setFormatResult(null);
    setSlimResult(null);
    setLengthCheckResult(null);
    setShowCompareModal(false);
  };

  // 确认格式化版本
  const handleConfirmFormat = () => {
    if (!formatResult) return;
    const { titlePrompt, contentPrompt } = parsePromptContent(formatResult.formatted);
    doSave(titlePrompt, contentPrompt);
  };

  // 使用原版
  const handleUseOriginal = () => {
    if (!editingTemplate || !selectedPlatform) return;
    const template = selectedPlatform.templates.find(t => t.id === editingTemplate.templateId);
    if (!template) return;
    doSave(template.titlePrompt || '', template.contentPrompt || '');
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingTemplate(null);
    setTempContent('');
    setFormatResult(null);
    setSlimResult(null);
    setLengthCheckResult(null);
    setShowCompareModal(false);
  };

  return (
    <div className="space-y-6">
      {/* 平台列表 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-purple-500" />
            <h3 className="font-semibold text-slate-900">平台</h3>
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
          {(platforms.platforms || []).map(platform => (
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

      {/* 平台详情和模板列表 */}
      {selectedPlatform && (
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedPlatform.icon}</span>
              <div>
                <h3 className="font-semibold text-slate-900">{selectedPlatform.name}</h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
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

          {/* 内置模板 */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-slate-500 mb-3">内置模板（系统提供，不可修改）</h4>
            <div className="space-y-2">
              {getBuiltInTemplates().map(template => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <div>
                      <div className="font-medium text-slate-700">{template.name}</div>
                      <div className="text-xs text-slate-400">
                        {template.titlePrompt ? '已配置标题' : '未配置'} | {template.contentPrompt ? '已配置正文' : '未配置'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewTemplate(template.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      查看
                    </button>
                    {selectedPlatform.defaultTemplateId === template.id && (
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">默认</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 自定义模板 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-slate-500">自定义模板</h4>
              <button
                onClick={handleAddCustomTemplate}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加自定义模板
              </button>
            </div>
            <div className="space-y-2">
              {getCustomTemplates().length === 0 ? (
                <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  <p>暂无自定义模板</p>
                  <p className="text-sm">点击上方按钮添加</p>
                </div>
              ) : (
                getCustomTemplates().map(template => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-blue-600 text-sm font-medium">自</span>
                      </div>
                      <div>
                        <div className="font-medium text-slate-700">{template.name}</div>
                        <div className="text-xs text-slate-400">
                          {template.titlePrompt ? '已配置标题' : '未配置'} | {template.contentPrompt ? '已配置正文' : '未配置'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(template.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                        编辑
                      </button>
                      {selectedPlatform.defaultTemplateId === template.id ? (
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">默认</span>
                      ) : (
                        <button
                          onClick={() => setDefaultContentTemplate(selectedPlatform.id, template.id)}
                          className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded"
                        >
                          设为默认
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveTemplate(template.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 模板编辑弹窗 */}
      {editingTemplate && (
        (() => {
          const isBuiltIn = selectedPlatform ? isBuiltInTemplate(selectedPlatform.id, editingTemplate.templateId) : false;
          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto">
                <h3 className="font-semibold text-lg mb-2">
                  {isBuiltIn ? '查看模板' : '编辑模板'}
                </h3>
                {!isBuiltIn && (
                  <p className="text-sm text-slate-500 mb-4">
                    请按以下格式编辑提示词：<br/>
                    # 标题提示词<br/>
                    [标题生成提示词内容]<br/>
                    # 正文提示词<br/>
                    [正文生成提示词内容]
                  </p>
                )}

                {/* 上传文件按钮 - 仅自定义模板 */}
                {!isBuiltIn && (
                  <div className="mb-4 flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".md,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="template-file-upload"
                    />
                    <label
                      htmlFor="template-file-upload"
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      上传文件 (md/txt)
                    </label>
                    <span className="text-xs text-slate-500">
                      上传或粘贴内容，保存时将自动格式化
                    </span>
                  </div>
                )}

                <textarea
                  value={tempContent}
                  onChange={isBuiltIn ? undefined : (e) => setTempContent(e.target.value)}
                  readOnly={isBuiltIn}
                  className={`w-full h-80 px-4 py-3 border border-slate-300 rounded-lg font-mono text-sm overflow-y-auto ${isBuiltIn ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                  placeholder={isBuiltIn ? '' : `# 标题提示词
你是一个公众号爆款标题专家，根据用户提供的素材生成爆款标题

# 正文提示词
你是一个公众号内容创作专家，根据用户提供的素材生成文章`}
                />

                {/* 字数检测结果 - 仅自定义模板 */}
                {!isBuiltIn && (() => {
                  const { titlePrompt, contentPrompt } = parsePromptContent(tempContent);
                  const titleCheck = checkPromptLength(titlePrompt || '', 'titlePrompt');
                  const contentCheck = checkPromptLength(contentPrompt || '', 'contentPrompt');

                  const renderCheckBadge = (check: LengthCheckResult) => {
                    const colorClass = getRiskLevelColor(check.riskLevel);
                    const borderClass = getRiskLevelBorderColor(check.riskLevel);
                    return (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${borderClass} ${colorClass.split(' ')[1]}`}>
                        <span className="text-xs font-medium">{check.currentLength} / {check.limit} 字</span>
                        <span className="text-xs opacity-75">({check.percentageDisplay})</span>
                        {check.riskLevel !== 'safe' && (
                          <span className="text-xs">⚠️ {check.riskLevel === 'warning' ? '接近限制' : '超过限制'}</span>
                        )}
                      </div>
                    );
                  };

                  return (
                    <div className="mt-3 flex flex-wrap gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">标题：</span>
                        {renderCheckBadge(titleCheck)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">正文：</span>
                        {renderCheckBadge(contentCheck)}
                      </div>
                      {(titleCheck.recommendation !== 'none' || contentCheck.recommendation !== 'none') && (
                        <div className="w-full mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-xs text-amber-700">
                            💡 {titleCheck.recommendationText || contentCheck.recommendationText}
                            {titleCheck.recommendation === 'slim_and_format' || contentCheck.recommendation === 'slim_and_format'
                              ? ' 保存时可选择"精简+格式化"模式。'
                              : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 提示 - 仅自定义模板 */}
                {!isBuiltIn && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">
                      💡 提示：保存时系统会自动格式化内容，确保符合平台规范
                    </p>
                  </div>
                )}

                {/* 内置模板提示 */}
                {isBuiltIn && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-700">
                      ⚠️ 这是内置模板，只可查看不可编辑。如需修改请添加自定义模板。
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    {isBuiltIn ? '关闭' : '取消'}
                  </button>
                  {!isBuiltIn && (
                    <button
                      onClick={handleSaveTemplate}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      保存
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* 格式化对比弹窗 */}
      <CompareModal
        isOpen={showCompareModal}
        original={tempContent}
        formatted={formatResult?.formatted || ''}
        changes={formatResult?.changes || []}
        warnings={formatResult?.warnings || []}
        slimmed={slimResult?.slimmed}
        removedSections={slimResult?.removedSections || []}
        statistics={slimResult?.statistics}
        showSlimOption={slimResult !== null}
        mode={slimMode}
        onModeChange={setSlimMode}
        onConfirm={handleConfirmFormat}
        onUseOriginal={handleUseOriginal}
        onCancel={handleCancelEdit}
      />
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
                  {!template.isDefault && !template.isBuiltIn && (
                    <button
                      onClick={() => setDefaultAnalysisTemplate(template.id)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      设为默认
                    </button>
                  )}
                  {template.isBuiltIn ? (
                    <button
                      onClick={() => setEditingId(template.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 rounded-lg"
                    >
                      <Eye className="w-4 h-4" />
                      查看
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditingId(template.id)}
                        className="p-1.5 text-slate-400 hover:text-blue-600"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeAnalysisTemplate(template.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg h-48 overflow-y-auto"
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
          <h4 className="font-medium mb-4">
            {currentEditing.isBuiltIn ? '查看模板' : '编辑模板'}: {currentEditing.name}
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">分析提示词</label>
              <textarea
                defaultValue={currentEditing.analysisPrompt}
                onChange={currentEditing.isBuiltIn ? undefined : (e) => updateAnalysisTemplate(currentEditing.id, { analysisPrompt: e.target.value })}
                readOnly={currentEditing.isBuiltIn}
                className={`w-full px-3 py-2 border border-slate-300 rounded-lg h-64 font-mono text-sm ${currentEditing.isBuiltIn ? 'bg-slate-50 cursor-not-allowed' : ''}`}
              />
            </div>
            {currentEditing.isBuiltIn && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-700">
                  ⚠️ 这是内置模板，只可查看不可编辑。如需修改请添加自定义模板。
                </p>
              </div>
            )}
            <div className="flex gap-2">
              {currentEditing.isBuiltIn ? (
                <button
                  onClick={() => setEditingId(null)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  关闭
                </button>
              ) : (
                <button
                  onClick={() => setEditingId(null)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  关闭
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 优化报告模板Tab组件（标签页切换）
function OptimizationTab() {
  const {
    optimization,
    addOptimizationTemplate,
    updateOptimizationTemplate,
    removeOptimizationTemplate,
    resetOptimizationTemplate,
    setDefaultOptimizationTemplate,
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<string>('gzh');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState<Partial<OptimizationTemplate>>({
    name: '',
    systemPrompt: '',
    optimizePrompt: '',
    isDefault: false,
  });

  // 平台信息映射
  const platformInfo = {
    gzh: { name: '公众号', icon: '📺', color: 'blue', bgColor: 'bg-blue-500', activeBg: 'bg-blue-600', hoverBg: 'hover:bg-blue-50' },
    xhs: { name: '小红书', icon: '📕', color: 'pink', bgColor: 'bg-pink-500', activeBg: 'bg-pink-500', hoverBg: 'hover:bg-pink-50' },
    douyin: { name: '抖音', icon: '🎵', color: 'cyan', bgColor: 'bg-cyan-500', activeBg: 'bg-cyan-500', hoverBg: 'hover:bg-cyan-50' },
  };

  // 按平台分组获取优化模板
  const getTemplatesByPlatform = (platformId: string) => {
    return optimization.templates.filter(t => t.platformId === platformId);
  };

  const currentTemplates = getTemplatesByPlatform(activeTab);
  const currentPlatformInfo = platformInfo[activeTab as keyof typeof platformInfo];

  const handleAdd = () => {
    if (!newTemplate.name || !newTemplate.optimizePrompt) return;
    addOptimizationTemplate({
      name: newTemplate.name,
      systemPrompt: newTemplate.systemPrompt || '',
      optimizePrompt: newTemplate.optimizePrompt,
      isDefault: newTemplate.isDefault || false,
      platformId: activeTab,
    }, activeTab);
    setNewTemplate({ name: '', systemPrompt: '', optimizePrompt: '', isDefault: false });
    setShowAddForm(false);
  };

  const currentEditing = editingId ? optimization.templates.find(t => t.id === editingId) : null;

  const platformTabs = [
    { id: 'gzh', ...platformInfo.gzh },
    { id: 'xhs', ...platformInfo.xhs },
    { id: 'douyin', ...platformInfo.douyin },
  ];

  return (
    <div className="space-y-6">
      {/* 平台标签页 */}
      <div className="bg-white rounded-xl p-2 border border-slate-200 flex gap-1">
        {platformTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setEditingId(null); setShowAddForm(false); }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === tab.id
                ? `${tab.activeBg} text-white`
                : `text-slate-600 ${tab.hoverBg}`
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              activeTab === tab.id ? 'bg-white/20' : 'bg-slate-100'
            }`}>
              {getTemplatesByPlatform(tab.id).length}
            </span>
          </button>
        ))}
      </div>

      {/* 当前平台的模板列表 */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">{currentPlatformInfo.icon}</span>
            <h3 className="font-semibold text-slate-900">{currentPlatformInfo.name}优化模板</h3>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            添加模板
          </button>
        </div>

        {currentTemplates.length === 0 && !showAddForm ? (
          <div className="text-center py-8 text-slate-400">
            <p>暂无{currentPlatformInfo.name}优化模板</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-2 text-blue-600 hover:underline text-sm"
            >
              点击添加第一个模板
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {currentTemplates.map((template) => (
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
                  {!template.isDefault && !template.isBuiltIn && (
                    <button
                      onClick={() => setDefaultOptimizationTemplate(template.id, activeTab)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      设为默认
                    </button>
                  )}
                  {template.isBuiltIn ? (
                    <button
                      onClick={() => setEditingId(template.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 rounded-lg"
                    >
                      <Eye className="w-4 h-4" />
                      查看
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditingId(template.id)}
                        className="p-1.5 text-slate-400 hover:text-blue-600"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeOptimizationTemplate(template.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 添加/编辑表单 */}
      {(showAddForm || currentEditing) && (
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h4 className="font-medium mb-4">
            {currentEditing
              ? (currentEditing.isBuiltIn ? '查看模板' : '编辑模板')
              : `添加${currentPlatformInfo.name}优化模板`}: {currentEditing?.name}
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">模板名称</label>
              <input
                type="text"
                value={currentEditing ? currentEditing.name : newTemplate.name || ''}
                onChange={currentEditing?.isBuiltIn ? undefined : (e) => currentEditing
                  ? updateOptimizationTemplate(currentEditing.id, { name: e.target.value })
                  : setNewTemplate({ ...newTemplate, name: e.target.value })
                }
                readOnly={currentEditing?.isBuiltIn}
                className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${currentEditing?.isBuiltIn ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                placeholder="例如：深度优化"
              />
            </div>
            {!currentEditing && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">系统提示词（可选）</label>
                <textarea
                  value={newTemplate.systemPrompt || ''}
                  onChange={(e) => setNewTemplate({ ...newTemplate, systemPrompt: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg h-24 font-mono text-sm"
                  placeholder="设置AI角色和行为方式..."
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">优化提示词模板</label>
              <textarea
                value={currentEditing ? currentEditing.optimizePrompt : newTemplate.optimizePrompt || ''}
                onChange={currentEditing?.isBuiltIn ? undefined : (e) => currentEditing
                  ? updateOptimizationTemplate(currentEditing.id, { optimizePrompt: e.target.value })
                  : setNewTemplate({ ...newTemplate, optimizePrompt: e.target.value })
                }
                readOnly={currentEditing?.isBuiltIn}
                className={`w-full px-3 py-2 border border-slate-300 rounded-lg h-48 font-mono text-sm ${currentEditing?.isBuiltIn ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                placeholder="输入优化提示词... 可用变量: {originalContent}, {qualityReport}"
              />
            </div>
            {currentEditing?.isBuiltIn && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-700">
                  ⚠️ 这是内置模板，只可查看不可编辑。如需修改请添加自定义模板。
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingId(null);
                  setShowAddForm(false);
                  setNewTemplate({ name: '', systemPrompt: '', optimizePrompt: '', isDefault: false });
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 六维质检模板Tab组件（功能暂时移除）
function QualityAnalysisTab() {
  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200">
      <div className="text-center py-8 text-slate-500">
        <ClipboardList className="w-10 h-10 mx-auto mb-3 text-slate-300" />
        <p>六维质检模板功能开发中...</p>
        <p className="text-sm mt-2">质检功能可通过平台模板中的提示词配置实现</p>
      </div>
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
  const [activeSubTab, setActiveSubTab] = useState<'platforms' | 'analysis' | 'quality' | 'optimization'>('analysis');

  const tabs = [
    { id: 'ai' as const, label: 'AI供应商', icon: Key },
    { id: 'templates' as const, label: '模板配置', icon: Palette, hasSubTabs: true },
    { id: 'other' as const, label: '其他设置', icon: Settings },
  ];

  const subTabs = [
    { id: 'analysis' as const, label: '内容分析' },
    { id: 'platforms' as const, label: '平台模板' },
    { id: 'quality' as const, label: '六维质检' },
    { id: 'optimization' as const, label: '优化报告' },
  ];

  const renderContent = () => {
    if (activeTab === 'templates') {
      switch (activeSubTab) {
        case 'analysis':
          return <AnalysisTab />;
        case 'platforms':
          return <PlatformsTab />;
        case 'quality':
          return <QualityAnalysisTab />;
        case 'optimization':
          return <OptimizationTab />;
        default:
          return <AnalysisTab />;
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
