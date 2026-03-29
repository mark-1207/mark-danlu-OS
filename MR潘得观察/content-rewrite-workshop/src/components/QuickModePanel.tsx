import { useState } from 'react';
import {
  Zap,
  Wand2,
  CheckCircle,
  AlertCircle,
  X,
  Download,
  RefreshCw,
  MessageSquare,
  Layers,
  Target,
  Sparkles,
  Copy,
} from 'lucide-react';
import { hasApiConfig, getApiConfigError } from '../services/llm/llmService';
import { promptRouter } from '../services/promptRouter';
import type { StreamingChunk } from '../services/llm/types';
import { useSettingsStore } from '../stores/settingsStore';
import { ProgressBar } from './ui/ProgressBar';
import { SkeletonCard } from './ui/SkeletonCard';

// 内容版本类型
interface ContentVersion {
  id: string;
  content: string;
  type: 'original' | 'optimized';
  createdAt: Date;
}

// 平台结果类型（支持版本历史）
interface PlatformResult {
  title: string;
  content: string;
  coverPrompt: string;
  progress: number;
  status: 'generating' | 'completed' | 'error';
  versions: ContentVersion[];  // 版本历史
  currentVersionId: string;    // 当前显示的版本ID
}

// Props类型
interface QuickModePanelProps {
  inputContent: string;
  analysisResult: any;
  preInfo?: {
    platform: string;
    contentType: string;
    track: string;
    likes?: number;
    collectCount?: number;
    viewCount?: number;
    shareCount?: number;
  };
}

export default function QuickModePanel({ inputContent, analysisResult, preInfo }: QuickModePanelProps) {
  const testMode = useSettingsStore((state) => state.testMode);

  // 快速模式独立状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [generationSteps, setGenerationSteps] = useState<{ step: string; status: 'pending' | 'success' | 'error' }[]>([]);
  const [results, setResults] = useState<{ [platform: string]: PlatformResult }>({});
  const [previewPlatform, setPreviewPlatform] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  // 流式显示状态 - 存储每个平台的实时显示内容
  const [streamingContents, setStreamingContents] = useState<{ [platform: string]: string }>({});

  // 预览弹窗内的优化状态
  const [optimizedContent, setOptimizedContent] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<{ original: boolean; optimized: boolean }>({ original: true, optimized: false });

  // 判断生成进度是否全部完成
  const isAllStepsCompleted = generationSteps.length > 0 && generationSteps.every(s => s.status === 'success');

  // 流式内容生成回调
  const createStreamingCallback = (platform: string) => (chunk: StreamingChunk) => {
    if (chunk.done) {
      // 流式完成，更新最终结果
      setResults(prev => {
        const streamingContent = streamingContents[platform] || '';
        const newVersion: ContentVersion = {
          id: `v${Date.now()}`,
          content: streamingContent,
          type: 'original',
          createdAt: new Date()
        };
        return {
          ...prev,
          [platform]: {
            ...prev[platform],
            status: 'completed',
            progress: 100,
            content: streamingContent,
            versions: [newVersion],
            currentVersionId: newVersion.id
          }
        };
      });
      // 清除流式显示状态
      setStreamingContents(prev => {
        const newContents = { ...prev };
        delete newContents[platform];
        return newContents;
      });
      return;
    }

    // 追加内容到流式显示
    setStreamingContents(prev => ({
      ...prev,
      [platform]: (prev[platform] || '') + chunk.content
    }));
  };

  // 一键生成处理
  const handleGenerate = async () => {
    // 检查 API 配置（测试模式下跳过）
    if (!testMode && !hasApiConfig()) {
      const error = getApiConfigError();
      setApiError(error || '请检查您的API配置');
      alert(error || '请检查您的API配置');
      return;
    }

    // 根据分析结果的"平台"字段判断生成范围
    // 平台字段为空 → 生成全部3个平台；平台字段有具体值 → 只生成对应平台
    const targetPlatform = analysisResult?.平台 || '';
    const platformMap: { [key: string]: string } = {
      '公众号': 'gzh',
      '小红书': 'xhs',
      '抖音': 'douyin',
    };
    const targetPlatformId = platformMap[targetPlatform] || targetPlatform;

    // 确定要生成的平台列表
    const platformsToGenerate = targetPlatformId && ['gzh', 'xhs', 'douyin'].includes(targetPlatformId)
      ? [targetPlatformId]
      : ['gzh', 'xhs', 'douyin'];

    // 固定4个步骤
    const steps = [
      { step: '调用AI大模型', status: 'pending' as const },
      { step: '内容DNA提取', status: 'pending' as const },
      { step: '生成爆款标题', status: 'pending' as const },
      { step: '生成爆款内容', status: 'pending' as const },
    ];

    setIsGenerating(true);
    setGenerationSteps(steps);

    // 初始化结果（支持版本）
    const initialResults: { [key: string]: PlatformResult } = {};
    platformsToGenerate.forEach(p => {
      initialResults[p] = {
        title: '',
        content: '',
        coverPrompt: '',
        progress: 0,
        status: 'generating',
        versions: [],
        currentVersionId: ''
      };
    });
    setResults(initialResults);

    // 为每个平台生成内容
    const context: Record<string, string> = {
      content: inputContent,
      keywords: analysisResult?.核心议题 || '',
      emotion: analysisResult?.情绪基调?.join(', ') || '',
      audience: analysisResult?.目标受众 || '',
      category: analysisResult?.主题分类 || '',
      // 前置信息
      platform: preInfo?.platform || '',
      contentType: preInfo?.contentType || '',
      track: preInfo?.track || '',
      likes: String(preInfo?.likes || 0),
      collectCount: String(preInfo?.collectCount || 0),
      viewCount: String(preInfo?.viewCount || 0),
      shareCount: String(preInfo?.shareCount || 0),
    };

    // 完成步骤1: 调用AI大模型
    setGenerationSteps(prev => prev.map((s, idx) =>
      idx === 0 ? { ...s, status: 'success' } : s
    ));

    // 模拟内容DNA提取
    await new Promise(resolve => setTimeout(resolve, 300));
    // 完成步骤2: 内容DNA提取
    setGenerationSteps(prev => prev.map((s, idx) =>
      idx === 1 ? { ...s, status: 'success' } : s
    ));

    for (let i = 0; i < platformsToGenerate.length; i++) {
      const platform = platformsToGenerate[i];

      try {
        // 初始化流式显示状态
        setStreamingContents(prev => ({ ...prev, [platform]: '' }));
        setResults(prev => ({
          ...prev,
          [platform]: { ...prev[platform], status: 'generating', progress: 0 }
        }));

        // 使用流式生成
        const result = await promptRouter.executeStream(
          `${platform}-content`,
          context,
          createStreamingCallback(platform),
          {}
        );

        // 完成后更新标题等信息
        // 注意：routeExecuteStream 不返回 titles，标题需从内容中提取
        if (result.success) {
          setResults(prev => ({
            ...prev,
            [platform]: {
              ...prev[platform],
              title: '',
              coverPrompt: '',
            }
          }));
        } else {
          throw new Error(result.error || 'Content generation failed');
        }

        // 每个平台生成完成后，逐步完成步骤3和4
        if (i === 0) {
          setGenerationSteps(prev => prev.map((s, idx) =>
            idx === 2 ? { ...s, status: 'success' } : s
          ));
        }
        if (i === platformsToGenerate.length - 1) {
          setGenerationSteps(prev => prev.map((s, idx) =>
            idx === 3 ? { ...s, status: 'success' } : s
          ));
        }
      } catch (err: any) {
        setResults(prev => ({
          ...prev,
          [platform]: {
            ...prev[platform],
            status: 'error',
            progress: 0
          }
        }));
        setApiError(err.message || '生成失败');
      }
    }

    // 标记已完成生成
    setHasGenerated(true);
    setIsGenerating(false);
  };

  // 下载处理
  const handleDownload = (platform: string, version?: 'original' | 'optimized', content?: string) => {
    const platformName = platform === 'gzh' ? '公众号' : platform === 'xhs' ? '小红书' : '抖音';
    const versionLabel = version === 'optimized' ? '【优化版】' : version === 'original' ? '【原版】' : '';
    const title = results[platform]?.title || '无标题';
    const textContent = content || results[platform]?.content || '';

    // 创建下载内容
    const fullContent = `${versionLabel}${platformName}内容\n\n标题：${title}\n\n${textContent}`;
    const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${platformName}_${title.slice(0, 20)}${versionLabel ? '_' + versionLabel.trim() : ''}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 重新生成处理
  const handleRegenerate = async (platform: string) => {
    if (!testMode && !hasApiConfig()) {
      const error = getApiConfigError();
      setApiError(error || '请检查您的API配置');
      return;
    }

    setResults(prev => ({
      ...prev,
      [platform]: { ...prev[platform], status: 'generating', progress: 0 }
    }));

    // 初始化流式显示状态
    setStreamingContents(prev => ({ ...prev, [platform]: '' }));

    try {
      const context: Record<string, string> = {
        content: inputContent,
        keywords: analysisResult?.核心议题 || '',
        emotion: analysisResult?.情绪基调?.join(', ') || '',
        audience: analysisResult?.目标受众 || '',
        category: analysisResult?.主题分类 || '',
        // 新增：完整的分析结果字段
        contentStructure: analysisResult?._rawJson?.['二、结构脉络']
          ? JSON.stringify(analysisResult._rawJson['二、结构脉络'])
          : '',
        valuePoints: analysisResult?._rawJson?.['三、价值与情绪']
          ? JSON.stringify(analysisResult._rawJson['三、价值与情绪'])
          : '',
        highlightClips: analysisResult?.金句?.map((g: any) => typeof g === 'string' ? g : g.内容).join(' | ') || '',
        // 前置信息
        platform: preInfo?.platform || '',
        contentType: preInfo?.contentType || '',
        track: preInfo?.track || '',
        likes: String(preInfo?.likes || 0),
        collectCount: String(preInfo?.collectCount || 0),
        viewCount: String(preInfo?.viewCount || 0),
        shareCount: String(preInfo?.shareCount || 0),
      };

      // 使用流式生成
      const result = await promptRouter.executeStream(
        `${platform}-content`,
        context,
        createStreamingCallback(platform),
        {}
      );

      // 完成后更新标题
      // 注意：routeExecuteStream 不返回 titles，标题需从内容中提取
      if (result.success) {
        setResults(prev => ({
          ...prev,
          [platform]: {
            ...prev[platform],
            title: '',
            coverPrompt: '',
          }
        }));
      } else {
        throw new Error(result.error || 'Content generation failed');
      }
    } catch (error: any) {
      console.error('AI生成失败:', error);
      setResults(prev => ({
        ...prev,
        [platform]: { ...prev[platform], status: 'error', progress: 0 }
      }));
      setApiError(error.message || '生成失败');
    }
  };

  return (
    <div className="p-6">
      {/* 未生成时显示按钮 */}
      {!hasGenerated && !isGenerating ? (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
            <Wand2 className="w-10 h-10 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">一键生成爆款内容</h3>
          <p className="text-slate-500 mb-4">AI将自动分析内容并生成适配各平台的爆款文案</p>

          {/* 流程说明 */}
          <div className="max-w-md mx-auto mb-8 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-start gap-3 text-left">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">1</div>
              <div className="flex-1">
                <p className="text-sm text-slate-700 font-medium mb-0.5">调用平台改写模板生成内容</p>
                <p className="text-xs text-slate-400">根据前置信息判断平台：平台为空则三平台全生成，有值则只生成对应平台</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-left mt-3">
              <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">2</div>
              <div className="flex-1">
                <p className="text-sm text-slate-700 font-medium mb-0.5">预览时一键优化（无需质检）</p>
                <p className="text-xs text-slate-400">点击预览可对生成内容进行快速优化，同时展示原版和优化版供你选择</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg transition-all shadow-lg shadow-blue-600/20"
          >
            <Zap className="w-5 h-5" />
            点击一键生成
          </button>
        </div>
      ) : (
        <div>
          {/* 生成过程展示 */}
          <div className="mb-6">
            <h4 className="text-base font-medium text-slate-800 mb-4">生成进度</h4>
            <div className="grid grid-cols-2 gap-3">
              {generationSteps.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 ${
                    item.status === 'success'
                      ? 'bg-green-50 border-green-200 animate-fade-in'
                      : item.status === 'error'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  {item.status === 'pending' && (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0 animate-pulse" />
                  )}
                  {item.status === 'success' && (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  )}
                  {item.status === 'error' && (
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${
                    item.status === 'success' ? 'text-green-700 font-medium' :
                    item.status === 'error' ? 'text-red-700' : 'text-slate-500'
                  }`}>
                    {item.step}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 生成结果预览 */}
          <div className="border-t border-slate-200 pt-6">
            <h4 className="text-base font-medium text-slate-800 mb-4">生成结果预览</h4>

            {/* API错误提示 */}
            {apiError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-sm text-red-700">{apiError}</span>
                <button
                  onClick={() => setApiError(null)}
                  className="ml-auto text-red-400 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              {/* 公众号卡片 */}
              <PlatformCard
                name="公众号"
                icon={<MessageSquare className="w-5 h-5" />}
                color="blue"
                result={results['gzh']}
                isAllStepsCompleted={isAllStepsCompleted}
                onPreview={() => {
                  setPreviewPlatform('gzh');
                  setShowPreview(true);
                }}
                onDownload={() => handleDownload('gzh')}
                onRegenerate={() => handleRegenerate('gzh')}
              />

              {/* 小红书卡片 */}
              <PlatformCard
                name="小红书"
                icon={<Layers className="w-5 h-5" />}
                color="pink"
                result={results['xhs']}
                isAllStepsCompleted={isAllStepsCompleted}
                onPreview={() => {
                  setPreviewPlatform('xhs');
                  setShowPreview(true);
                }}
                onDownload={() => handleDownload('xhs')}
                onRegenerate={() => handleRegenerate('xhs')}
              />

              {/* 抖音卡片 */}
              <PlatformCard
                name="抖音"
                icon={<Target className="w-5 h-5" />}
                color="cyan"
                result={results['douyin']}
                isAllStepsCompleted={isAllStepsCompleted}
                onPreview={() => {
                  setPreviewPlatform('douyin');
                  setShowPreview(true);
                }}
                onDownload={() => handleDownload('douyin')}
                onRegenerate={() => handleRegenerate('douyin')}
              />
            </div>
          </div>
        </div>
      )}

      {/* 预览浮层 */}
      {showPreview && previewPlatform && results[previewPlatform] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => {
            setShowPreview(false);
            setOptimizedContent(null);
            setSelectedVersions({ original: true, optimized: false });
          }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden m-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  previewPlatform === 'gzh' ? 'bg-blue-500' :
                  previewPlatform === 'xhs' ? 'bg-pink-500' : 'bg-cyan-500'
                }`}>
                  {previewPlatform === 'gzh' ? <MessageSquare className="w-5 h-5 text-white" /> :
                   previewPlatform === 'xhs' ? <Layers className="w-5 h-5 text-white" /> :
                   <Target className="w-5 h-5 text-white" />}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">
                    {previewPlatform === 'gzh' ? '公众号' : previewPlatform === 'xhs' ? '小红书' : '抖音'} 内容预览
                  </h3>
                  <p className="text-sm text-slate-500">生成结果详情</p>
                </div>
              </div>
              <button onClick={() => {
                setShowPreview(false);
                setOptimizedContent(null);
                setSelectedVersions({ original: true, optimized: false });
              }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[55vh]">
              {/* 标题 */}
              <div className="mb-4">
                <div className="text-sm text-slate-500 mb-2">标题</div>
                <div className="text-lg font-semibold text-slate-800">
                  {results[previewPlatform]?.title}
                </div>
              </div>

              {/* 内容版本对比 */}
              <div className="grid grid-cols-2 gap-4">
                {/* 原版 */}
                <div className={`p-4 rounded-xl border-2 transition-all ${
                  selectedVersions.original
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'border-slate-200 bg-slate-50'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedVersions.original
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-slate-300'
                      }`}>
                        {selectedVersions.original && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <span className="text-sm font-medium text-slate-700">原版</span>
                    </div>
                    <button
                      onClick={() => setSelectedVersions(v => ({ ...v, original: !v.original }))}
                      className={`text-xs px-2 py-1 rounded-full transition-colors ${
                        selectedVersions.original
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {selectedVersions.original ? '已选择' : '选择'}
                    </button>
                  </div>
                  <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {/* 优先显示流式内容，否则显示最终结果 */}
                    {/* 流式内容显示时添加打字机光标效果 */}
                    {streamingContents[previewPlatform || ''] ? (
                      <span>
                        {streamingContents[previewPlatform || '']}
                        <span className="typing-cursor inline-block w-0.5 h-4 bg-blue-500 ml-0.5 animate-pulse" />
                      </span>
                    ) : (
                      results[previewPlatform]?.content
                    )}
                  </div>
                </div>

                {/* 优化版 */}
                <div className={`p-4 rounded-xl border-2 transition-all ${
                  selectedVersions.optimized && optimizedContent
                    ? 'border-purple-500 bg-purple-50/50'
                    : optimizedContent
                      ? 'border-slate-200 bg-slate-50'
                      : 'border-dashed border-slate-200 bg-slate-50/50'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedVersions.optimized && optimizedContent
                          ? 'border-purple-500 bg-purple-500'
                          : 'border-slate-300'
                      }`}>
                        {selectedVersions.optimized && optimizedContent && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <span className="text-sm font-medium text-slate-700">优化版</span>
                    </div>
                    {optimizedContent && (
                      <button
                        onClick={() => setSelectedVersions(v => ({ ...v, optimized: !v.optimized }))}
                        className={`text-xs px-2 py-1 rounded-full transition-colors ${
                          selectedVersions.optimized
                            ? 'bg-purple-100 text-purple-600'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {selectedVersions.optimized ? '已选择' : '选择'}
                      </button>
                    )}
                  </div>
                  {optimizedContent ? (
                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {optimizedContent}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                      <Sparkles className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-xs">点击下方"一键优化"生成优化版</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 一键优化按钮 */}
              {!optimizedContent && (
                <div className="mt-5 flex justify-center">
                  <button
                    onClick={async () => {
                      setIsOptimizing(true);
                      try {
                        const result = await promptRouter.execute(
                          `${previewPlatform}-optimization`,
                          { originalContent: results[previewPlatform]?.content || '' },
                          {}
                        );
                        if (result.success) {
                          setOptimizedContent(result.raw);
                          setSelectedVersions({ original: true, optimized: true });
                        } else {
                          throw new Error(result.error || 'Optimization failed');
                        }
                      } catch (err: any) {
                        alert('优化失败: ' + (err.message || '未知错误'));
                      } finally {
                        setIsOptimizing(false);
                      }
                    }}
                    disabled={isOptimizing}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isOptimizing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        优化中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        一键优化（无需质检）
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* 重新优化按钮 */}
              {optimizedContent && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={async () => {
                      setIsOptimizing(true);
                      try {
                        const result = await promptRouter.execute(
                          `${previewPlatform}-optimization`,
                          { originalContent: results[previewPlatform]?.content || '' },
                          {}
                        );
                        if (result.success) {
                          setOptimizedContent(result.raw);
                        } else {
                          throw new Error(result.error || 'Optimization failed');
                        }
                      } catch (err: any) {
                        alert('优化失败: ' + (err.message || '未知错误'));
                      } finally {
                        setIsOptimizing(false);
                      }
                    }}
                    disabled={isOptimizing}
                    className="flex items-center gap-2 px-4 py-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg text-sm transition-colors"
                  >
                    {isOptimizing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                        优化中...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        重新优化
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => handleRegenerate(previewPlatform)}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                重新生成
              </button>
              <div className="flex gap-3">
                <button onClick={() => {
                  setShowPreview(false);
                  setOptimizedContent(null);
                  setSelectedVersions({ original: true, optimized: false });
                }} className="px-5 py-2.5 text-slate-600 hover:bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all">
                  关闭
                </button>
                <button
                  onClick={() => {
                    // 根据选择下载对应版本
                    const hasOriginal = selectedVersions.original;
                    const hasOptimized = selectedVersions.optimized && optimizedContent;

                    if (hasOriginal && hasOptimized) {
                      // 两个版本都下载
                      handleDownload(previewPlatform, 'original', results[previewPlatform]?.content);
                      handleDownload(previewPlatform, 'optimized', optimizedContent);
                    } else if (hasOptimized) {
                      handleDownload(previewPlatform, 'optimized', optimizedContent);
                    } else if (hasOriginal) {
                      handleDownload(previewPlatform, 'original', results[previewPlatform]?.content);
                    }
                  }}
                  disabled={!selectedVersions.original && (!selectedVersions.optimized || !optimizedContent)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed shadow-sm hover:shadow transition-all"
                >
                  <Download className="w-4 h-4" />
                  {selectedVersions.original && selectedVersions.optimized && optimizedContent
                    ? '下载全部'
                    : selectedVersions.optimized && optimizedContent
                      ? '下载优化版'
                      : '下载原版'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 平台结果卡片组件（内部使用）
function PlatformCard({
  name,
  icon,
  color,
  result,
  isAllStepsCompleted,
  onPreview,
  onDownload,
  onRegenerate
}: {
  name: string;
  icon: React.ReactNode;
  color: 'blue' | 'pink' | 'cyan';
  result?: PlatformResult;
  isAllStepsCompleted: boolean;
  onPreview: () => void;
  onDownload: () => void;
  onRegenerate: () => void;
}) {
  const colorStyles = {
    blue: { bg: 'from-blue-50 to-indigo-50', border: 'border-blue-100', iconBg: 'bg-blue-500', iconColor: 'text-white', progress: 'bg-blue-500', text: 'text-blue-600', gradient: 'from-blue-500 to-blue-600' },
    pink: { bg: 'from-pink-50 to-rose-50', border: 'border-pink-100', iconBg: 'bg-pink-500', iconColor: 'text-white', progress: 'bg-pink-500', text: 'text-pink-600', gradient: 'from-pink-500 to-pink-600' },
    cyan: { bg: 'from-cyan-50 to-sky-50', border: 'border-cyan-100', iconBg: 'bg-cyan-500', iconColor: 'text-white', progress: 'bg-cyan-500', text: 'text-cyan-600', gradient: 'from-cyan-500 to-cyan-600' }
  };

  const style = colorStyles[color];
  const isGenerating = result?.status === 'generating';
  const isCompleted = result?.status === 'completed';

  // 生成中状态显示骨架屏
  if (isGenerating) {
    // 映射 color 到 variant
    const variantMap = { blue: 'gzh', pink: 'xhs', cyan: 'douyin' } as const;
    return (
      <div className="animate-fade-in">
        <SkeletonCard
          variant={variantMap[color]}
          showContent={false}
        />
      </div>
    );
  }

  return (
    <div className={`p-4 bg-gradient-to-br ${style.bg} rounded-xl border ${style.border} flex flex-col card-hover`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 ${style.iconBg} rounded-lg flex items-center justify-center ${style.iconColor}`}>
            {icon}
          </div>
          <span className="font-medium text-slate-800">{name}</span>
        </div>
        {isCompleted && (
          <span className={`text-xs px-2 py-1 ${style.bg.split(' ')[0]} ${style.text} rounded-full font-medium`}>
            推荐度 9
          </span>
        )}
      </div>

      <div className="flex-1 mb-3">
        {isCompleted ? (
          <div className="text-sm font-medium text-slate-800 line-clamp-2">{result?.title}</div>
        ) : isAllStepsCompleted ? (
          <div className="text-sm text-green-600 font-medium">生成完毕</div>
        ) : (
          <div className="text-sm text-slate-400">等待生成...</div>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        {isCompleted ? (
          <>
            <button onClick={onPreview} className="flex-1 px-3 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all">
              预览
            </button>
            <button onClick={onDownload} className={`flex-1 px-3 py-2.5 ${style.iconBg} hover:opacity-90 ${style.iconColor} text-sm font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm hover:shadow`}>
              <Download className="w-4 h-4" />
              下载
            </button>
          </>
        ) : !isAllStepsCompleted ? (
          <button disabled className="flex-1 px-3 py-2.5 bg-slate-100 text-slate-400 text-sm font-medium rounded-lg cursor-not-allowed">
            等待生成
          </button>
        ) : (
          <button onClick={onRegenerate} className={`flex-1 px-3 py-2.5 ${style.iconBg} hover:opacity-90 ${style.iconColor} text-sm font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm hover:shadow`}>
            <RefreshCw className="w-4 h-4" />
            重新生成
          </button>
        )}
      </div>

      <div className="mt-auto">
        <ProgressBar
          progress={result?.progress || 0}
          showLabel
          size="sm"
        />
      </div>
    </div>
  );
}
