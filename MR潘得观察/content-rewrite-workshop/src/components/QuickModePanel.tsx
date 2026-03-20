import { useState, useCallback } from 'react';
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
} from 'lucide-react';
import { hasApiConfig, getApiConfigError, generatePlatformContent } from '../services/llm/llmService';
import { useSettingsStore } from '../stores/settingsStore';

// 平台结果类型
interface PlatformResult {
  title: string;
  content: string;
  coverPrompt: string;
  progress: number;
  status: 'generating' | 'completed' | 'error';
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

  // 判断生成进度是否全部完成
  const isAllStepsCompleted = generationSteps.length > 0 && generationSteps.every(s => s.status === 'success');

  // 进度模拟函数：初始化并模拟各平台进度
  const simulateGeneration = useCallback(async () => {
    // 初始化各平台状态
    const initialResults = {
      gzh: { title: '', content: '', coverPrompt: '', progress: 0, status: 'generating' as const },
      xhs: { title: '', content: '', coverPrompt: '', progress: 0, status: 'generating' as const },
      douyin: { title: '', content: '', coverPrompt: '', progress: 0, status: 'generating' as const },
    };
    setResults(initialResults);

    // 各平台配置：延迟时间（毫秒）和单步增量
    const platformConfig = [
      { key: 'gzh', delay: 500, increment: 2 },
      { key: 'xhs', delay: 1200, increment: 2.5 },
      { key: 'douyin', delay: 2000, increment: 3 },
    ];

    const intervalIds: number[] = [];

    platformConfig.forEach(({ key, delay, increment }) => {
      // 使用 void 来表示有意不使用返回值
      void setTimeout(() => {
        const intervalId = window.setInterval(() => {
          setResults(prev => {
            const current = prev[key];
            if (!current) return prev;

            const newProgress = Math.min(current.progress + increment, 100);

            if (newProgress >= 100) {
              window.clearInterval(intervalId);
              return {
                ...prev,
                [key]: {
                  ...current,
                  progress: 100,
                  status: 'completed' as const,
                  title: key === 'gzh' ? '一键生成：公众号爆款文案' :
                         key === 'xhs' ? '一键生成：小红书种草笔记' :
                         '一键生成：抖音短视频脚本',
                  content: key === 'gzh' ? '【公众号爆款内容示例】\n\n在这个充满挑战的时代，我们常常会感到迷茫和焦虑...（AI生成内容）' :
                          key === 'xhs' ? '【小红书种草笔记】\n\n姐妹们！今天必须给你们安利这个...（AI生成内容）' :
                          '【抖音短视频脚本】\n\n（开场）哎，你们有没有发现...（AI生成内容）',
                  coverPrompt: `高质量${key === 'gzh' ? '公众号' : key === 'xhs' ? '小红书' : '抖音'}封面图片，时尚潮流风格，简洁大方，适合社交媒体传播`,
                },
              };
            }

            return {
              ...prev,
              [key]: { ...current, progress: newProgress },
            };
          });
        }, 100);
        intervalIds.push(intervalId);
      }, delay);
    });

    return () => {
      intervalIds.forEach(id => window.clearInterval(id));
    };
  }, []);

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

    // 初始化结果
    const initialResults: { [key: string]: PlatformResult } = {};
    platformsToGenerate.forEach(p => {
      initialResults[p] = { title: '', content: '', coverPrompt: '', progress: 0, status: 'generating' };
    });
    setResults(initialResults);

    // 为每个平台生成内容
    const context = {
      content: inputContent,
      keywords: analysisResult?.核心议题 || '',
      emotion: analysisResult?.情绪基调?.join(', ') || '',
      audience: analysisResult?.目标受众 || '',
      category: analysisResult?.主题分类 || '',
      // 前置信息
      platform: preInfo?.platform || '',
      contentType: preInfo?.contentType || '',
      track: preInfo?.track || '',
      likes: preInfo?.likes,
      collectCount: preInfo?.collectCount,
      viewCount: preInfo?.viewCount,
      shareCount: preInfo?.shareCount,
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
        // 使用合并调用模式（一次调用生成标题+正文）
        const result = await generatePlatformContent(platform, context, {
          onProgress: (p) => {
            setResults(prev => ({
              ...prev,
              [platform]: { ...prev[platform], progress: p }
            }));
          }
        }, true); // mergeTitleAndContent = true

        setResults(prev => ({
          ...prev,
          [platform]: {
            status: 'completed',
            progress: 100,
            title: result.titles[0] || '',
            content: result.content,
            coverPrompt: result.coverPrompt
          }
        }));

        // 每个平台生成完成后，逐步完成步骤3和4
        if (i === 0) {
          // 第一个平台完成后标记步骤3完成
          setGenerationSteps(prev => prev.map((s, idx) =>
            idx === 2 ? { ...s, status: 'success' } : s
          ));
        }
        if (i === platformsToGenerate.length - 1) {
          // 最后一个平台完成后标记步骤4完成
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
  const handleDownload = (platform: string) => {
    alert(`正在下载 ${platform} 平台的内容包...`);
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

    try {
      const context = {
        content: inputContent,
        keywords: analysisResult?.核心议题 || '',
        emotion: analysisResult?.情绪基调?.join(', ') || '',
        audience: analysisResult?.目标受众 || '',
        category: analysisResult?.主题分类 || '',
        // 前置信息
        platform: preInfo?.platform || '',
        contentType: preInfo?.contentType || '',
        track: preInfo?.track || '',
        likes: preInfo?.likes,
        collectCount: preInfo?.collectCount,
        viewCount: preInfo?.viewCount,
        shareCount: preInfo?.shareCount,
      };

      // 使用合并调用模式（一次调用生成标题+正文）
      const result = await generatePlatformContent(platform, context, {
        onProgress: (p) => {
          setResults(prev => ({
            ...prev,
            [platform]: { ...prev[platform], progress: p }
          }));
        }
      }, true);

      setResults(prev => ({
        ...prev,
        [platform]: {
          ...prev[platform],
          status: 'completed',
          progress: 100,
          title: result.titles[0] || '',
          content: result.content,
          coverPrompt: result.coverPrompt
        }
      }));
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
          <p className="text-slate-500 mb-8">AI将自动分析内容并生成适配各平台的爆款文案</p>
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
                <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg border ${
                  item.status === 'success' ? 'bg-green-50 border-green-200' :
                  item.status === 'error' ? 'bg-red-50 border-red-200' :
                  'bg-slate-50 border-slate-200'
                }`}>
                  {item.status === 'pending' && (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0" />
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
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPreview(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden m-4">
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
              <button onClick={() => setShowPreview(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="mb-6">
                <div className="text-sm text-slate-500 mb-2">标题</div>
                <div className="text-lg font-semibold text-slate-800">
                  {results[previewPlatform]?.title}
                </div>
              </div>
              <div className="mb-6">
                <div className="text-sm text-slate-500 mb-2">正文内容</div>
                <div className="p-4 bg-slate-50 rounded-lg text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {results[previewPlatform]?.content}
                </div>
              </div>
              {/* 封面提示词已隐藏 */}
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => handleRegenerate(previewPlatform)}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-white rounded-lg border border-slate-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                重新生成
              </button>
              <div className="flex gap-3">
                <button onClick={() => setShowPreview(false)} className="px-4 py-2 text-slate-600 hover:bg-white rounded-lg border border-slate-200">
                  关闭
                </button>
                <button onClick={() => handleDownload(previewPlatform)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                  <Download className="w-4 h-4" />
                  下载内容包
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
    blue: { bg: 'from-blue-50 to-indigo-50', border: 'border-blue-100', iconBg: 'bg-blue-500', iconColor: 'text-white', progress: 'bg-blue-500', text: 'text-blue-600' },
    pink: { bg: 'from-pink-50 to-rose-50', border: 'border-pink-100', iconBg: 'bg-pink-500', iconColor: 'text-white', progress: 'bg-pink-500', text: 'text-pink-600' },
    cyan: { bg: 'from-cyan-50 to-sky-50', border: 'border-cyan-100', iconBg: 'bg-cyan-500', iconColor: 'text-white', progress: 'bg-cyan-500', text: 'text-cyan-600' }
  };

  const style = colorStyles[color];
  const isGenerating = result?.status === 'generating';
  const isCompleted = result?.status === 'completed';

  return (
    <div className={`p-4 bg-gradient-to-br ${style.bg} rounded-xl border ${style.border} flex flex-col`}>
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
        ) : isGenerating ? (
          <div className="text-sm text-slate-500">正在生成中...</div>
        ) : isAllStepsCompleted ? (
          <div className="text-sm text-green-600 font-medium">生成完毕</div>
        ) : (
          <div className="text-sm text-slate-400">等待生成...</div>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        {isCompleted ? (
          <>
            <button onClick={onPreview} className="flex-1 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg border border-slate-200">
              预览
            </button>
            <button onClick={onDownload} className={`flex-1 px-3 py-2 ${style.iconBg} hover:opacity-90 ${style.iconColor} text-sm font-medium rounded-lg flex items-center justify-center gap-1`}>
              <Download className="w-4 h-4" />
              下载
            </button>
          </>
        ) : isGenerating ? (
          <button disabled className="flex-1 px-3 py-2 bg-slate-100 text-slate-400 text-sm font-medium rounded-lg cursor-not-allowed">
            生成中...
          </button>
        ) : !isAllStepsCompleted ? (
          <button disabled className="flex-1 px-3 py-2 bg-slate-100 text-slate-400 text-sm font-medium rounded-lg cursor-not-allowed">
            开始生成
          </button>
        ) : (
          <button onClick={onRegenerate} className={`flex-1 px-3 py-2 ${style.iconBg} hover:opacity-90 ${style.iconColor} text-sm font-medium rounded-lg`}>
            开始生成
          </button>
        )}
      </div>

      <div className="mt-auto">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>生成进度</span>
          <span>{result?.progress || 0}%</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className={`h-full ${style.progress} transition-all duration-300 rounded-full`} style={{ width: `${result?.progress || 0}%` }} />
        </div>
      </div>
    </div>
  );
}
