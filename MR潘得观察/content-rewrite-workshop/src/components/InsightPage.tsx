import { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle,
  BarChart3,
  Target,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { parseContent, hasApiConfig, getApiConfigError } from '../services/llm/llmService';
import { useSettingsStore } from '../stores/settingsStore';

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
  content: _content,
  onBack,
  onNext,
  completedSteps,
  setCompletedSteps,
  onStepClick,
  preInfo
}: {
  content: string;
  onBack: () => void;
  onNext: (result: any) => void;
  completedSteps: number[];
  setCompletedSteps: React.Dispatch<React.SetStateAction<number[]>>;
  onStepClick: (step: number) => void;
  preInfo?: {
    platform: string;
    contentType: string;
    track: string;
    likes?: number;
    collectCount?: number;
    viewCount?: number;
    shareCount?: number;
  };
}) {
  const testMode = useSettingsStore((state) => state.testMode);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [progress, setProgress] = useState(0);

  // 模拟数据（用于预览样式）
  const mockRawContent = `# 内容DNA分析报告

## 一、基础定位

- **主题分类**：职场成长 / 个人发展
- **核心议题**：如何从月薪5千到3万，实现职场逆袭
- **目标受众**：职场新人、想要提升收入的年轻人

---

## 二、结构脉络

### 开篇钩子（评分：8/10）
> "为什么有人工作3年薪资翻倍，而你还在原地踏步？"

### 主线脉络
1. **现状分析**：大多数人的职场困境
2. **核心问题**：缺少这3个关键能力
3. **解决方案**：具体可执行的成长路径
4. **成功案例**：真实逆袭故事

### 高潮时刻
揭秘大厂HR不会告诉你的薪资谈判技巧

### 收尾方式
行动号召：现在开始改变，3个月后你会感谢自己

---

## 三、价值与情绪

### 知识增量
- 职场技能树构建方法
- 薪资谈判的3个黄金时机

### 认知颠覆
- 努力≠能力，方向比努力更重要
- 职场晋升不靠加班，靠思维

### 情绪价值
- 共情职场焦虑
- 给予希望和动力

### 实用价值
- 可直接套用的简历模板
- 薪资谈判话术清单

---

## 四、爆款基因评估

| 维度 | 得分 | 亮点 |
|------|------|------|
| 标题吸引力 | 9/10 | 痛点+数字+悬念 |
| 开头留存 | 8/10 | 提问引发共鸣 |
| 内容价值度 | 8/10 | 干货+案例结合 |
| 情绪感染力 | 7/10 | 积极正向 |
| 传播设计 | 8/10 | 引发讨论的话题 |

---

## 五、金句提取

> "方向对了，努力才有意义"

> "你的工资不是由老板决定的，是由你的不可替代性决定的"

> "职场最大的谎言是'是金子总会发光'，前提是你要站在能被人看到的地方"

---

## 六、平台适配度

### 公众号
- **适配度**：9/10
- **建议**：适合深度阅读，增加案例细节

### 小红书
- **适配度**：8/10
- **建议**：精简内容，突出干货要点

### 抖音
- **适配度**：7/10
- **建议**：提取核心观点做成口播脚本

---

*本报告由AI生成，仅供参考*`;

  // 调用 AI 分析
  useEffect(() => {
    const performAnalysis = async () => {
      setIsLoading(true);
      setError(null);

      // 检查 API 配置（测试模式除外）
      if (!testMode && !hasApiConfig()) {
        setError(getApiConfigError() || '请先配置 AI 供应商');
        setIsLoading(false);
        return;
      }

      try {
        const result = await parseContent(_content, {
          onProgress: (p) => setProgress(p)
        }, preInfo);
        setAnalysisResult(result);
      } catch (err: any) {
        setError(err.message || '分析失败，请重试');
      } finally {
        setIsLoading(false);
      }
    };

    performAnalysis();
  }, [_content, preInfo]);

  const handleReanalyze = async () => {
    setIsLoading(true);
    setError(null);

    // 检查 API 配置（测试模式除外）
    if (!testMode && !hasApiConfig()) {
      setError(getApiConfigError() || '请先配置 AI 供应商');
      setIsLoading(false);
      return;
    }

    try {
      const result = await parseContent(_content, {
        onProgress: (p) => setProgress(p)
      }, preInfo);
      setAnalysisResult(result);
    } catch (err: any) {
      setError(err.message || '分析失败，请重试');
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
                {import.meta.env.DEV && !analysisResult._rawJson && (
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

                {/* 统一 Markdown 渲染模块 */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 markdown-content
                    [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mb-6 [&_h1]:pb-3 [&_h1]:border-b [&_h1]:border-slate-200
                    [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-800 [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:pb-2 [&_h2]:border-b [&_h2]:border-slate-100
                    [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-slate-700 [&_h3]:mt-6 [&_h3]:mb-3
                    [&_p]:text-sm [&_p]:text-slate-600 [&_p]:leading-8 [&_p]:my-4
                    [&_ul]:my-4 [&_ul]:pl-5 [&_ul]:space-y-2
                    [&_ol]:my-4 [&_ol]:pl-5 [&_ol]:space-y-2
                    [&_li]:text-sm [&_li]:text-slate-600 [&_li]:leading-7
                    [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:bg-slate-50 [&_blockquote]:py-3 [&_blockquote]:px-4 [&_blockquote]:not-italic [&_blockquote]:rounded-r [&_blockquote]:my-4
                    [&_blockquote_p]:text-sm [&_blockquote_p]:text-slate-700 [&_blockquote_p]:leading-7
                    [&_table]:w-full [&_table]:my-4 [&_table]:text-sm
                    [&_th]:bg-slate-50 [&_th]:text-slate-700 [&_th]:font-medium [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:border [&_th]:border-slate-200 [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wider
                    [&_td]:px-4 [&_td]:py-3 [&_td]:text-slate-600 [&_td]:border [&_td]:border-slate-200
                    [&_tr:hover]:bg-slate-50
                    [&_hr]:my-8 [&_hr]:border-0 [&_hr]:h-px [&_hr]:bg-slate-200
                    [&_strong]:font-semibold [&_strong]:text-slate-800
                    [&_em]:text-rose-600 [&_em]:italic
                    [&_code]:text-rose-600 [&_code]:bg-rose-50 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
                    [&_a]:text-blue-600 [&_a]:underline [&_a]:hover:text-blue-800">
                  <ReactMarkdown>
                    {analysisResult.rawContent || '暂无分析结果'}
                  </ReactMarkdown>
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
                    选择创作模式
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
