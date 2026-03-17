import { useState, useEffect } from 'react';
import {
  FileText,
  Tag,
  Users,
  MessageSquare,
  CheckCircle,
  BarChart3,
  Target,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Zap
} from 'lucide-react';
import { parseContent, hasApiConfig } from '../services/llm/llmService';

// 左侧导航组件
function SideNav({
  currentStep,
  completedSteps,
  onStepClick,
  onBack
}: {
  currentStep: number;
  completedSteps: number[];
  onStepClick: (step: number) => void;
  onBack: () => void;
}) {
  const steps = [
    { num: 1, label: '内容输入', icon: FileText },
    { num: 2, label: '洞察分析', icon: BarChart3 },
    { num: 3, label: '内容创作', icon: Sparkles },
    { num: 4, label: '优化报告', icon: Target }
  ];

  return (
    <div className="w-56 bg-white border-r border-slate-200 flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-slate-100">
        <h1 className="text-lg font-bold text-slate-800">内容改写工坊</h1>
        <p className="text-xs text-slate-400 mt-1">音视频转录爆款文案</p>
      </div>

      {/* 步骤导航 */}
      <div className="flex-1 p-4">
        <div className="space-y-2">
          {steps.map((step) => {
            const isCompleted = completedSteps.includes(step.num);
            const isCurrent = step.num === currentStep;

            return (
              <button
                key={step.num}
                onClick={() => onStepClick(step.num)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  isCurrent
                    ? 'bg-blue-50 text-blue-700'
                    : isCompleted
                    ? 'text-slate-600 hover:bg-slate-50'
                    : 'text-slate-400'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  isCurrent
                    ? 'bg-blue-600 text-white'
                    : isCompleted
                    ? 'bg-green-100 text-green-600'
                    : 'bg-slate-100'
                }`}>
                  {isCompleted ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <span className="text-sm font-medium">{step.num}</span>
                  )}
                </div>
                <span className="text-sm font-medium">{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 底部返回 */}
      <div className="p-4 border-t border-slate-100">
        <button
          onClick={onBack}
          className="w-full flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          <span className="text-sm">返回上一步</span>
        </button>
      </div>
    </div>
  );
}

// 洞察分析页面组件
export default function InsightPage({
  content,
  onBack,
  onNext,
  completedSteps,
  setCompletedSteps,
  onStepClick
}: {
  content: string;
  onBack: () => void;
  onNext: (result: any) => void;
  completedSteps: number[];
  setCompletedSteps: React.Dispatch<React.SetStateAction<number[]>>;
  onStepClick: (step: number) => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);


  // 调用 AI 分析
  useEffect(() => {
    const performAnalysis = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (!hasApiConfig()) {
          throw new Error('请先在设置中配置 AI 供应商');
        }

        const aiResult = await parseContent(content, {
          onProgress: (progress: number, status: string) => {
            console.log('[Insight] Progress:', progress, status);
          }
        });

        // 直接使用 AI 返回的原始数据
        console.log('[Insight] AI原始结果:', aiResult);
        console.log('[Insight] 打印完整数据结构:', JSON.stringify(aiResult, null, 2));
        setAnalysisResult(aiResult);
      } catch (err) {
        setError(err instanceof Error ? err.message : '分析失败');
      } finally {
        setIsLoading(false);
      }
    };

    if (content) {
      performAnalysis();
    }
  }, [content]);

  const handleReanalyze = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!hasApiConfig()) {
        throw new Error('请先在设置中配置 AI 供应商');
      }

      const aiResult = await parseContent(content, {
        onProgress: () => {}
      });

      console.log('[Insight] 重新分析结果:', aiResult);
      setAnalysisResult(aiResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 临时简单渲染（先确保能编译通过）
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <SideNav
        currentStep={2}
        completedSteps={completedSteps}
        onStepClick={onStepClick}
        onBack={onBack}
      />

      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-4xl mx-auto">
            {/* 页面标题 */}
            <div className="mb-6 flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">洞察分析</h1>
              <span className="text-slate-400">|</span>
              <p className="text-slate-500 text-sm">深度洞察，挖掘爆款因子</p>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6" />
                <p className="text-slate-600">AI正在深度分析您的内容...</p>
                <p className="text-slate-400 text-sm mt-2">提取Content DNA中</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-red-600 font-medium">{error}</p>
                <p className="text-slate-400 text-sm mt-2">请在设置中配置API Key</p>
              </div>
            ) : analysisResult ? (
              <div className="space-y-6">
                {/* 调试信息 */}
                {process.env.NODE_ENV === 'development' && !analysisResult._rawJson && (
                  <div className="bg-orange-100 border border-orange-400 text-orange-700 px-4 py-3 rounded">
                    <p className="font-bold">调试: AI返回数据为空</p>
                    <pre className="text-xs mt-2">{JSON.stringify(analysisResult).slice(0, 500)}</pre>
                  </div>
                )}
                {/* 模块1：顶部操作区 + 内容定位 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">内容DNA</h2>
                      <p className="text-xs text-slate-500">AI深度分析结果</p>
                    </div>
                  </div>
                  <button
                    onClick={handleReanalyze}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    重新分析
                  </button>
                </div>

                {/* 内容定位 */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="w-1 h-5 bg-blue-500 rounded-full"></span>
                    内容定位
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Tag className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">主题分类</span>
                      </div>
                      <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm font-medium">
                        {(analysisResult._rawJson || {})['一、基础定位']?.主题分类 || analysisResult.主题分类 || '未识别'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <MessageSquare className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">核心议题</span>
                      </div>
                      <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-sm">
                        {(analysisResult._rawJson || {})['一、基础定位']?.核心议题 || analysisResult.核心议题 || '未识别'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">目标受众画像</span>
                      </div>
                      <span className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-md text-sm">
                        {(analysisResult._rawJson || {})['一、基础定位']?.目标受众画像 || analysisResult.目标受众画像 || analysisResult.目标受众 || '未识别'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 模块2：结构脉络 */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="w-1 h-5 bg-green-500 rounded-full"></span>
                    结构脉络
                  </h3>
                  {/* 从 _rawJson 直接获取数据 */}
                  {(() => {
                    const structure = analysisResult._rawJson?.['二、结构脉络 (Structure)'] || {};

                    // 处理可能的对象或字符串格式
                    const getStringValue = (val: any): string => {
                      if (!val) return '暂无';
                      if (typeof val === 'string') return val;
                      if (typeof val === 'object') {
                        // 如果是对象，尝试获取特征字段或第一个值
                        return val.特征 || val.content || val.内容 || Object.values(val)[0] || '暂无';
                      }
                      return String(val);
                    };

                    // 开篇钩子 - 需要处理特殊键名
                    const hookKeys = Object.keys(structure.开篇钩子 || {});
                    const hookKey = hookKeys[0] || '';
                    const hookRaw = structure.开篇钩子?.[hookKey];
                    const hookValue = getStringValue(hookRaw);
                    const hookScore = hookValue.match(/(\d+)分/)?.[1] || '5';
                    const hookContent = hookValue.replace(/^\d+分，?/, '') || hookValue;

                    return (
                      <div className="grid grid-cols-5 gap-3">
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-slate-600">开篇钩子</span>
                            <span className="text-xs font-bold text-green-600">{hookScore}/10</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{hookContent || '暂无'}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg col-span-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-slate-600">主线脉络</span>
                          </div>
                          <ol className="space-y-1">
                            {(structure.主线脉络 || []).slice(0, 3).map((item: any, idx: number) => (
                              <li key={idx} className="flex items-start gap-1 text-xs text-slate-600">
                                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-green-100 text-green-600 font-medium text-[10px] flex items-center justify-center">{idx + 1}</span>
                                <span className="break-words">{typeof item === 'string' ? item : (item.内容 || '')}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-slate-600">高潮时刻</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{getStringValue(structure.高潮时刻)}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-slate-600">收尾方式</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{getStringValue(structure.收尾方式)}</p>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <span className="text-xs font-medium text-blue-700">逻辑链条：</span>
                    <span className="text-xs text-blue-600 ml-1">{(() => {
                      const val = (analysisResult._rawJson?.['二、结构脉络 (Structure)'] || {}).逻辑链条;
                      if (!val) return '暂无';
                      if (typeof val === 'string') return val;
                      if (typeof val === 'object') return val.论点 || val.逻辑 || Object.values(val)[0] || '暂无';
                      return String(val);
                    })()}</span>
                  </div>
                </div>

                {/* 模块3：价值与情绪 */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="w-1 h-5 bg-purple-500 rounded-full"></span>
                    价值与情绪
                  </h3>
                  {(() => {
                    const valueEmotion = analysisResult._rawJson?.['三、价值与情绪 (Value & Emotion)'] || {};
                    const getString = (v: any) => {
                      if (!v) return '暂无';
                      if (typeof v === 'string') return v;
                      if (typeof v === 'object') return v.知识增量 || v.认知颠覆 || v.情绪价值 || v.实用价值 || Object.values(v)[0] || '暂无';
                      return String(v);
                    };
                    return (
                      <div className="grid grid-cols-4 gap-4">
                        <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-lg border border-blue-100">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-semibold text-blue-700">知识增量</span>
                          </div>
                          <ul className="space-y-1">
                            <li className="flex items-start gap-1 text-xs text-slate-600">
                              <CheckCircle className="w-3 h-3 text-blue-500 flex-shrink-0 mt-0.5" />
                              <span className="break-words">{getString(valueEmotion.知识增量)}</span>
                            </li>
                          </ul>
                        </div>
                        <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100/50 rounded-lg border border-purple-100">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-semibold text-purple-700">认知颠覆</span>
                          </div>
                          <ul className="space-y-1">
                            <li className="flex items-start gap-1 text-xs text-slate-600">
                              <CheckCircle className="w-3 h-3 text-purple-500 flex-shrink-0 mt-0.5" />
                              <span className="break-words">{getString(valueEmotion.认知颠覆)}</span>
                            </li>
                          </ul>
                        </div>
                        <div className="p-4 bg-gradient-to-r from-pink-50 to-pink-100/50 rounded-lg border border-pink-100">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-semibold text-pink-700">情绪价值</span>
                          </div>
                          <ul className="space-y-1">
                            <li className="flex items-start gap-1 text-xs text-slate-600">
                              <CheckCircle className="w-3 h-3 text-pink-500 flex-shrink-0 mt-0.5" />
                              <span className="break-words">{getString(valueEmotion.情绪价值)}</span>
                            </li>
                          </ul>
                        </div>
                        <div className="p-4 bg-gradient-to-r from-emerald-50 to-emerald-100/50 rounded-lg border border-emerald-100">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-semibold text-emerald-700">实用价值</span>
                          </div>
                          <ul className="space-y-1">
                            <li className="flex items-start gap-1 text-xs text-slate-600">
                              <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                              <span className="break-words">{getString(valueEmotion.实用价值)}</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 模块4：爆款基因评估 */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="w-1 h-5 bg-amber-500 rounded-full"></span>
                    爆款基因评估
                  </h3>
                  {(() => {
                    const gene = analysisResult._rawJson?.['四、爆款基因评估'] || {};
                    // AI返回的键名是完整的：标题吸引力打分（1-10分）及亮点分析
                    const parseGeneItem = (key: string) => {
                      // 找到匹配的键
                      const matchedKey = Object.keys(gene).find(k => k.startsWith(key));
                      const value = matchedKey ? gene[matchedKey] : '';
                      if (!value) return { score: 5, highlight: '暂无亮点分析' };
                      // 提取分数和亮点分析
                      const strVal = String(value);
                      const score = parseInt(strVal.match(/(\d+)分/)?.[1] || '5');
                      const highlight = strVal.replace(/^\d+分，?/, '') || strVal;
                      return { score, highlight };
                    };

                    const items = [
                      { key: '标题', searchKey: '标题吸引力打分' },
                      { key: '开头留存', searchKey: '开头留存力打分' },
                      { key: '内容价值度', searchKey: '内容价值度打分' },
                      { key: '情绪感染力', searchKey: '情绪感染力打分' },
                      { key: '传播设计度', searchKey: '传播设计度打分' }
                    ];

                    return (
                      <div className="grid grid-cols-5 gap-4">
                        {items.map((item, idx) => {
                          const { score, highlight } = parseGeneItem(item.searchKey);
                          return (
                            <div key={idx} className="p-4 bg-gradient-to-r from-amber-50 to-amber-100/50 rounded-lg border border-amber-100">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-amber-700">{item.key}</span>
                                <span className="text-lg font-bold text-amber-600">{score}/10</span>
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed">{highlight}</p>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* 模块5：高光与传播点 */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="w-1 h-5 bg-pink-500 rounded-full"></span>
                    高光与传播点
                  </h3>
                  {(() => {
                    const highlight = analysisResult._rawJson?.['五、高光与传播点'] || {};
                    const goldSentences = highlight.金句提取 || highlight.金句 || [];

                    return (
                      <div className="space-y-4">
                        {/* 金句提取 */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Zap className="w-4 h-4 text-pink-500" />
                            <span className="text-sm font-medium text-slate-700">金句提取</span>
                            <span className="text-xs text-slate-400">(共{Array.isArray(goldSentences) ? goldSentences.length : 0}条)</span>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            {(Array.isArray(goldSentences) ? goldSentences : []).slice(0, 6).map((item: any, idx: number) => {
                              const content = typeof item === 'string' ? item : (item.content || item.金句 || '');
                              return (
                                <div key={idx} className="p-3 bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-lg border border-amber-200">
                                  <p className="text-sm text-slate-700 leading-relaxed">"{content}"</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {/* 互动诱饵 */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <MessageSquare className="w-4 h-4 text-pink-500" />
                            <span className="text-sm font-medium text-slate-700">互动诱饵</span>
                          </div>
                          <div className="p-3 bg-pink-50 rounded-lg border border-pink-200">
                            <p className="text-sm text-slate-700 leading-relaxed">
                              {typeof highlight.互动诱饵 === 'string' ? highlight.互动诱饵 : (highlight.互动诱饵?.描述 || highlight.互动诱饵?.content || '暂无互动诱饵数据')}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 模块6：平台适配度 */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="w-1 h-5 bg-cyan-500 rounded-full"></span>
                    平台适配度
                  </h3>
                  <div className="grid grid-cols-3 gap-6">
                    {[
                      { name: '公众号', key: 'gzh', color: 'blue' },
                      { name: '小红书', key: 'xhs', color: 'pink' },
                      { name: '抖音', key: 'douyin', color: 'cyan' }
                    ].map((platform) => {
                      const platformData = analysisResult._rawJson?.['六、平台适配度']?.[platform.key] || analysisResult['六、平台适配度']?.[platform.key] || analysisResult.平台适配度?.[platform.key] || {};
                      const score = platformData.得分 || platformData.score || 5;
                      const reason = platformData.理由 || platformData.reason || 'AI未返回该平台适配数据';
                      const colorValue = platform.color === 'blue' ? '#3b82f6' : platform.color === 'pink' ? '#ec4899' : '#06b6d4';
                      return (
                        <div key={platform.key} className="p-4 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-3">
                            <FileText className="w-5 h-5" style={{ color: colorValue }} />
                            <span className="text-base font-semibold text-slate-800">{platform.name}</span>
                          </div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-slate-600">适配得分</span>
                            <span className="text-xl font-bold" style={{ color: colorValue }}>{score}/10</span>
                          </div>
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
                            <div className="h-full rounded-full" style={{ width: `${score * 10}%`, backgroundColor: colorValue }} />
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">{reason}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 底部操作区 */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={onBack}
                    className="px-6 py-3 text-slate-600 hover:text-slate-800 hover:bg-white rounded-lg border border-slate-200 transition-colors"
                  >
                    上一步
                  </button>
                  <button
                    onClick={() => {
                      setCompletedSteps(prev => [...prev, 2]);
                      onNext(analysisResult);
                    }}
                    className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-base transition-colors"
                  >
                    立即生成
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
