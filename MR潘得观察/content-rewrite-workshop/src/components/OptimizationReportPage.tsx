import { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Layers,
  Target,
  ChevronLeft,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Sparkles,
  Wand2,
  Check,
  X,
  FileText,
  BarChart3,
  Lightbulb,
  Edit3,
  Home,
  ChevronDown,
  FileArchive
} from 'lucide-react';
import JSZip from 'jszip';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer
} from 'recharts';
import { optimizeContent, hasApiConfig } from '../services/llm/llmService';
import { useSettingsStore } from '../stores/settingsStore';

// 类型定义
interface QualityReport {
  overallScore: number;
  grade: 'excellent' | 'good' | 'average' | 'poor';
  dimensions: {
    titleAppeal: number;
    openingRetention: number;
    contentValue: number;
    emotionInfluence: number;
    viralDesign: number;
    layoutBeauty: number;
  };
  checklist: Array<{
    id: string;
    item: string;
    passed: boolean;
    reason: string;
  }>;
  optimizationSuggestions: Array<{
    id: string;
    content: string;
    position?: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

interface PlatformContent {
  platform: 'gzh' | 'xhs' | 'douyin';
  title: string;
  content: string;
  coverPrompt: string;
  qualityReport: QualityReport;
  isOptimized: boolean;
  optimizedVersion?: {
    title: string;
    content: string;
    qualityReport: QualityReport;
  };
}

// 模拟质检数据
const generateMockQualityReport = (platform: string): QualityReport => {
  const baseScore = platform === 'gzh' ? 8.2 : platform === 'xhs' ? 7.5 : 7.8;
  return {
    overallScore: baseScore,
    grade: baseScore >= 8 ? 'good' : 'average',
    dimensions: {
      titleAppeal: platform === 'gzh' ? 9 : platform === 'xhs' ? 8 : 8.5,
      openingRetention: platform === 'gzh' ? 8 : platform === 'xhs' ? 7 : 8,
      contentValue: platform === 'gzh' ? 9 : platform === 'xhs' ? 8 : 7,
      emotionInfluence: platform === 'gzh' ? 7 : platform === 'xhs' ? 9 : 8,
      viralDesign: platform === 'gzh' ? 8 : platform === 'xhs' ? 7 : 9,
      layoutBeauty: platform === 'gzh' ? 8 : platform === 'xhs' ? 6 : 7,
    },
    checklist: [
      { id: '1', item: '标题长度合适', passed: true, reason: '字数在13-25字之间' },
      { id: '2', item: '开头有钩子', passed: true, reason: '前50字包含悬念或痛点' },
      { id: '3', item: '包含金句引用', passed: false, reason: '正文未引用金句' },
      { id: '4', item: '结尾有CTA', passed: true, reason: '包含明确的行动号召' },
      { id: '5', item: '信息密度足够', passed: true, reason: '包含2个以上知识点' },
      { id: '6', item: '情感表达恰当', passed: true, reason: '情绪浓度适中' },
      { id: '7', item: '互动引导充分', passed: false, reason: '未包含评论引导' },
      { id: '8', item: '排版规范清晰', passed: true, reason: '段落清晰，重点标记明显' },
    ],
    optimizationSuggestions: [
      { id: '1', content: '在第2段开头加入一个金句引用，增加内容的深度和说服力', position: '正文第2段', priority: 'high' },
      { id: '2', content: '在结尾增加互动引导，如提问或投票，提高用户参与度', position: '结尾部分', priority: 'medium' },
      { id: '3', content: '标题可增加热点词汇，如"2026"或行业关键词，提升点击率', position: '标题', priority: 'low' },
    ],
  };
};

// 平台信息
const platforms = [
  { id: 'gzh', name: '公众号', icon: MessageSquare, color: 'blue' },
  { id: 'xhs', name: '小红书', icon: Layers, color: 'pink' },
  { id: 'douyin', name: '抖音', icon: Target, color: 'cyan' },
];

// 侧边栏组件
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
    { id: 1, label: '内容编辑', icon: FileText },
    { id: 2, label: '洞察分析', icon: BarChart3 },
    { id: 3, label: '内容创作', icon: Edit3 },
    { id: 4, label: '优化报告', icon: Sparkles },
  ];

  return (
    <div className="w-56 bg-slate-900 min-h-screen flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white">Refine</span>
        </div>
      </div>

      <div className="flex-1 p-4">
        <div className="space-y-1">
          {steps.map((step) => {
            const isActive = currentStep === step.id;
            const isCompleted = completedSteps.includes(step.id);
            const isClickable = isCompleted || isActive || step.id === 1;

            return (
              <button
                key={step.id}
                onClick={() => isClickable && onStepClick(step.id)}
                disabled={!isClickable}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : isClickable
                    ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    : 'text-slate-600 cursor-not-allowed'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <step.icon className="w-5 h-5 flex-shrink-0" />
                )}
                <span className="text-sm font-medium">{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-6 border-t border-slate-800">
        <div className="text-xs text-slate-500">Refine © 2026</div>
      </div>
    </div>
  );
}

// 优化对比浮层组件
function CompareModal({
  show,
  platform,
  beforeContent,
  afterContent,
  suggestions,
  onSelectBefore,
  onSelectAfter,
  onClose
}: {
  show: boolean;
  platform: string;
  beforeContent: { title: string; content: string };
  afterContent: { title: string; content: string };
  suggestions: Array<{ content: string }>;
  onSelectBefore: () => void;
  onSelectAfter: () => void;
  onClose: () => void;
}) {
  const [showToast, setShowToast] = useState(false);

  if (!show) return null;

  const platformInfo = platforms.find(p => p.id === platform);
  const PlatformIcon = platformInfo?.icon || MessageSquare;
  const platformColor = platformInfo?.color || 'blue';

  const handleSelectBefore = () => {
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
      onSelectBefore();
    }, 1500);
  };

  const handleSelectAfter = () => {
    setShowToast(true);
    setTimeout(() => {
      setShowToast(true);
      onSelectAfter();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 移除遮罩层点击关闭功能 */}
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden m-4 flex flex-col">
        {/* 浮层头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              platformColor === 'blue' ? 'bg-blue-500' : platformColor === 'pink' ? 'bg-pink-500' : 'bg-cyan-500'
            }`}>
              <PlatformIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">优化对比</h3>
              <p className="text-sm text-slate-500">当前平台：{platformInfo?.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 浮层内容 */}
        <div className="flex-1 overflow-auto p-6">
          {/* 优化依据 */}
          <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-amber-600" />
              <span className="font-medium text-amber-800">基于以下建议优化</span>
            </div>
            <ul className="space-y-1">
              {suggestions.map((s, idx) => (
                <li key={idx} className="text-sm text-amber-700 flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  {s.content}
                </li>
              ))}
            </ul>
          </div>

          {/* 对比内容 */}
          <div className="grid grid-cols-2 gap-6">
            {/* 优化前 */}
            <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                <span className="font-medium text-slate-700">优化前</span>
                <span className="text-xs px-2 py-1 bg-slate-200 text-slate-600 rounded">原始版本</span>
              </div>
              <div className="p-4 max-h-[400px] overflow-y-auto">
                <h4 className="font-semibold text-slate-800 mb-3">{beforeContent.title}</h4>
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{beforeContent.content}</p>
              </div>
            </div>

            {/* 优化后 */}
            <div className="border-2 border-blue-300 rounded-xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50">
              <div className="px-4 py-3 bg-blue-100 border-b border-blue-200 flex items-center justify-between">
                <span className="font-medium text-blue-800">优化后</span>
                <span className="text-xs px-2 py-1 bg-blue-200 text-blue-700 rounded">AI优化版本</span>
              </div>
              <div className="p-4 max-h-[400px] overflow-y-auto">
                <h4 className="font-semibold text-slate-800 mb-3">{afterContent.title}</h4>
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{afterContent.content}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 浮层底部操作 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          <button
            onClick={handleSelectBefore}
            className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 transition-colors font-medium"
          >
            <X className="w-5 h-5" />
            使用优化前
          </button>
          <button
            onClick={handleSelectAfter}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            <Check className="w-5 h-5" />
            使用优化后
          </button>
        </div>

        {/* 保存提示 */}
        {showToast && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="bg-slate-800 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span>已保存您的选择</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 主页面组件
export default function OptimizationReportPage({
  generationResult: _generationResult,
  onBack,
  onStepClick,
  onRestart
}: {
  generationResult: any;
  onBack: () => void;
  onStepClick: (step: number) => void;
  onRestart: () => void;
}) {
  const testMode = useSettingsStore((state) => state.testMode);
  const [currentPlatform, setCurrentPlatform] = useState<string>('gzh');
  const [isLoading, setIsLoading] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [completedSteps] = useState<number[]>([1, 2, 3]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭导出菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 各平台的内容数据
  const [platformsData, setPlatformsData] = useState<{
    [key: string]: PlatformContent;
  }>({
    gzh: {
      platform: 'gzh',
      title: '你不是懒，你只是太焦虑了',
      content: `凌晨1点，我又一次刷完了短视频设定的闹钟，才发现自己答应自己的计划又双叒没完成。

你是否也有过这样的经历？明明列好了待办清单，却总是拖延到最后一刻才赶工完成。

其实，你不是懒，你只是太焦虑了。

科学研究表明，拖延症的本质不是懒惰，而是情绪调节失败。当我们面对一项任务时，大脑会自动评估任务的难度和可能的失败风险。如果感觉压力过大，就会本能地逃避，转而去做一些更轻松的事情来缓解焦虑。

那么，如何才能战胜拖延呢？给你三个建议：

第一，设定「最小行动」。不要一开始就追求完美，先完成再完美。比如想写作，先写50个字；想运动，先做5个俯卧撑。最小行动能降低心理阻力。

第二，拆解任务。把大任务拆成小任务，每完成一个小任务就给自己一个正反馈。大脑会更愿意开始行动。

第三，允许不完美。接受自己可能会做得不够好，减少对失败的恐惧，才能真正开始。

记住，拖延不是你的错，但改变是你的选择。从现在开始，哪怕只是迈出一小步，也比原地踏步强。`,
      coverPrompt: 'Professional office scene, modern minimalist style',
      qualityReport: generateMockQualityReport('gzh'),
      isOptimized: false,
    },
    xhs: {
      platform: 'xhs',
      title: '职场人必看：摆脱焦虑的3个方法',
      content: `你是不是也经常拖延？明明有很多事要做，却总是刷手机刷到深夜？

其实你不是懒，是焦虑！

今天分享3个亲测有效的方法：

1️⃣ 设定最小行动
不要想着一口气完成，先做一点点就好。比如想写作，先写50个字。

2️⃣ 拆解任务
大任务拆成小任务，每完成一个就给自己一个奖励。大脑会更愿意行动～

3️⃣ 允许不完美
接受自己可能做不好，减少对失败的恐惧，才能真正开始。

拖延不是你的错，但改变是你的选择！💪

#职场心理 #自我提升 #拖延症 #拒绝焦虑`,
      coverPrompt: 'Modern office illustration, cute style',
      qualityReport: generateMockQualityReport('xhs'),
      isOptimized: false,
    },
    douyin: {
      platform: 'douyin',
      title: '年薪百万的人都在做的事情',
      content: `你为什么总是拖延？

不是因为你懒，是因为你焦虑。

告诉你3个方法，告别拖延：

第一个，设定最小行动。不要想着一口吃成胖子，先做一点点。

第二个，拆解任务。把大任务拆成小的，每完成一个就给自己一个奖励。

第三个，允许不完美接受自己可能会做得不好，减少对失败的恐惧。

拖延不是你的错，但改变是你的选择。

你认同吗？评论区说说你的故事～

#职场 #成长 #拖延症 #干货`,
      coverPrompt: 'Dynamic social media style, bold colors',
      qualityReport: generateMockQualityReport('douyin'),
      isOptimized: false,
    },
  });

  const currentData = platformsData[currentPlatform];
  const currentReport = currentData?.qualityReport;

  // 雷达图数据
  const radarData = currentReport ? [
    { subject: '标题吸引力', value: currentReport.dimensions.titleAppeal, fullMark: 10 },
    { subject: '开头留存力', value: currentReport.dimensions.openingRetention, fullMark: 10 },
    { subject: '内容价值度', value: currentReport.dimensions.contentValue, fullMark: 10 },
    { subject: '情绪感染力', value: currentReport.dimensions.emotionInfluence, fullMark: 10 },
    { subject: '传播设计度', value: currentReport.dimensions.viralDesign, fullMark: 10 },
    { subject: '排版美观度', value: currentReport.dimensions.layoutBeauty, fullMark: 10 },
  ] : [];

  const getGradeLabel = (grade: string) => {
    switch (grade) {
      case 'excellent': return { text: '爆款潜质', stars: '⭐⭐⭐', color: 'text-amber-500' };
      case 'good': return { text: '优质内容', stars: '⭐⭐', color: 'text-green-500' };
      case 'average': return { text: '合格内容', stars: '⭐', color: 'text-blue-500' };
      default: return { text: '需优化', stars: '⚠️', color: 'text-red-500' };
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'gzh': return 'blue';
      case 'xhs': return 'pink';
      case 'douyin': return 'cyan';
      default: return 'blue';
    }
  };

  const platformColor = getPlatformColor(currentPlatform);

  // 一键优化处理
  const handleOptimize = async () => {
    // 检查 API 配置（测试模式下跳过）
    if (!testMode && !hasApiConfig()) {
      alert('请先在设置中配置AI供应商');
      return;
    }

    setIsLoading(true);

    try {
      // 构建质检报告文本
      const currentData = platformsData[currentPlatform];
      const qualityReport = currentData.qualityReport;

      // 调用 AI 一键优化，传入平台ID以选择对应的优化模板
      const optimizedText = await optimizeContent(
        currentData.content,
        { checklist: qualityReport.checklist, optimizationSuggestions: qualityReport.optimizationSuggestions },
        {
          onProgress: () => {
            // 可以在此处更新进度状态
          }
        },
        currentPlatform // 传入平台ID
      );

      // 解析优化后的内容（假设 AI 返回的是完整内容，可能包含标题）
      // 简单处理：如果内容中包含换行，先尝试提取标题
      const lines = optimizedText.trim().split('\n');
      let optimizedTitle = currentData.title;
      let optimizedContent = optimizedText;

      // 尝试识别标题（如果第一行比较短，可能是标题）
      if (lines.length > 0 && lines[0].length < 50) {
        optimizedTitle = lines[0].replace(/^#+\s*/, '').trim();
        optimizedContent = lines.slice(1).join('\n').trim();
      }

      // 更新数据
      setPlatformsData(prev => ({
        ...prev,
        [currentPlatform]: {
          ...prev[currentPlatform],
          isOptimized: true,
          optimizedVersion: {
            title: optimizedTitle,
            content: optimizedContent,
            qualityReport: generateMockQualityReport(currentPlatform),
          },
        },
      }));

      // 显示对比浮层
      setShowCompareModal(true);
    } catch (error: any) {
      console.error('优化失败:', error);
      alert(error.message || '优化失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 选择优化后的内容
  const handleSelectOptimized = () => {
    const optimized = platformsData[currentPlatform].optimizedVersion;
    if (optimized) {
      setPlatformsData(prev => ({
        ...prev,
        [currentPlatform]: {
          ...prev[currentPlatform],
          title: optimized.title,
          content: optimized.content,
          qualityReport: optimized.qualityReport,
          isOptimized: true,
          optimizedVersion: undefined,
        },
      }));
    }
    setShowCompareModal(false);
  };

  // 选择优化前的内容
  const handleSelectOriginal = () => {
    setPlatformsData(prev => ({
      ...prev,
      [currentPlatform]: {
        ...prev[currentPlatform],
        isOptimized: false,
        optimizedVersion: undefined,
      },
    }));
    setShowCompareModal(false);
  };

  // 导出当前平台功能
  const handleExport = () => {
    const data = platformsData[currentPlatform];
    const platformNames: { [key: string]: string } = {
      gzh: '公众号',
      xhs: '小红书',
      douyin: '抖音'
    };
    const content = `# ${data.title}\n\n${data.content}\n\n---\n\n## 封面提示词\n${data.coverPrompt}`;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${platformNames[currentPlatform] || currentPlatform}_${data.title.slice(0, 20)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  // 导出所有平台 ZIP 功能
  const handleExportAllZip = async () => {
    setIsExportingZip(true);
    setShowExportMenu(false);

    try {
      const zip = new JSZip();
      const platformNames: { [key: string]: string } = {
        gzh: '公众号',
        xhs: '小红书',
        douyin: '抖音'
      };

      // 为每个平台生成 Markdown 文件
      for (const [platform, data] of Object.entries(platformsData)) {
        const content = `# ${data.title}\n\n${data.content}\n\n---\n\n## 封面提示词\n${data.coverPrompt}`;
        const filename = `${platformNames[platform] || platform}_${data.title.slice(0, 20)}.md`;
        zip.file(filename, content);
      }

      // 生成 ZIP 文件
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `爆款文案_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出ZIP失败:', error);
      alert('导出失败，请重试');
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* 左侧导航 */}
      <SideNav
        currentStep={4}
        completedSteps={completedSteps}
        onStepClick={onStepClick}
        onBack={onBack}
      />

      {/* 右侧内容区 */}
      <div className="flex-1 flex flex-col">
        {/* 主内容 */}
        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {/* 页面标题 */}
            <div className="mb-6 flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">优化报告</h1>
              <span className="text-slate-400">|</span>
              <p className="text-slate-500 text-sm">内容质检与优化建议</p>
            </div>

            {/* 平台切换标签 */}
            <div className="flex gap-3 mb-6">
              {platforms.map(p => {
                const isActive = currentPlatform === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setCurrentPlatform(p.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                      isActive
                        ? p.color === 'blue'
                          ? 'bg-blue-600 text-white'
                          : p.color === 'pink'
                          ? 'bg-pink-500 text-white'
                          : 'bg-cyan-500 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <p.icon className="w-4 h-4" />
                    {p.name}
                    {platformsData[p.id]?.isOptimized && (
                      <span className="ml-1 text-xs">✓</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 左右分栏布局 */}
            <div className="grid grid-cols-2 gap-6">
              {/* 左侧：生成的文章内容 */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col max-h-[700px]">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-slate-500" />
                    <span className="font-medium text-slate-800">生成内容</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
                      <Edit3 className="w-4 h-4" />
                      编辑
                    </button>
                    <button className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
                      <RefreshCw className="w-4 h-4" />
                      重新生成
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                  {/* 标题 */}
                  <div className="mb-4">
                    <div className="text-sm text-slate-500 mb-2">标题</div>
                    <h2 className="text-xl font-bold text-slate-800">{currentData?.title}</h2>
                  </div>

                  {/* 正文 */}
                  <div>
                    <div className="text-sm text-slate-500 mb-2">正文内容</div>
                    <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {currentData?.content}
                    </div>
                  </div>

                  {/* 封面提示词 */}
                  <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                    <div className="text-sm text-slate-500 mb-2">封面AI提示词</div>
                    <code className="text-sm text-purple-700">{currentData?.coverPrompt}</code>
                  </div>
                </div>
              </div>

              {/* 右侧：优化报告 */}
              <div className="space-y-4 max-h-[700px] overflow-y-auto">
                {/* 雷达图 + 整体评分 */}
                <div className="grid grid-cols-2 gap-4">
                  {/* 雷达图 */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <div className="text-sm font-medium text-slate-700 mb-3">六维度分析</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 9 }} />
                        <Radar
                          name="评分"
                          dataKey="value"
                          stroke={platformColor === 'blue' ? '#3b82f6' : platformColor === 'pink' ? '#ec4899' : '#06b6d4'}
                          fill={platformColor === 'blue' ? '#3b82f6' : platformColor === 'pink' ? '#ec4899' : '#06b6d4'}
                          fillOpacity={0.3}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 整体评分 */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col">
                    <div className="text-sm font-medium text-slate-700 mb-3">整体评分</div>
                    <div className="flex-1 flex flex-col items-center justify-center">
                      <div className="text-5xl font-bold text-slate-800 mb-2">
                        {currentReport?.overallScore}
                        <span className="text-2xl text-slate-400">/10</span>
                      </div>
                      <div className={`text-lg font-medium mb-1 ${getGradeLabel(currentReport?.grade || '').color}`}>
                        {getGradeLabel(currentReport?.grade || '').stars}
                      </div>
                      <div className={`text-sm font-medium ${getGradeLabel(currentReport?.grade || '').color}`}>
                        {getGradeLabel(currentReport?.grade || '').text}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 质检清单 */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <div className="text-sm font-medium text-slate-700 mb-3">质检清单</div>
                  <div className="space-y-2">
                    {currentReport?.checklist.map(item => (
                      <div
                        key={item.id}
                        className={`flex items-start gap-3 p-3 rounded-lg ${
                          item.passed ? 'bg-green-50' : 'bg-red-50'
                        }`}
                      >
                        {item.passed ? (
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className={`text-sm font-medium ${item.passed ? 'text-green-700' : 'text-red-700'}`}>
                            {item.item}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{item.reason}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 优化建议 */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-5 h-5 text-amber-500" />
                    <span className="text-sm font-medium text-slate-700">优化建议</span>
                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                      {currentReport?.optimizationSuggestions.length}条
                    </span>
                  </div>
                  <div className="space-y-3">
                    {currentReport?.optimizationSuggestions.map((suggestion, idx) => (
                      <div
                        key={suggestion.id}
                        className="p-3 bg-amber-50 rounded-lg border border-amber-100"
                      >
                        <div className="flex items-start gap-2">
                          <span className="flex-shrink-0 w-5 h-5 bg-amber-200 text-amber-700 rounded-full text-xs flex items-center justify-center font-medium">
                            {idx + 1}
                          </span>
                          <div className="flex-1">
                            <div className="text-sm text-amber-800">{suggestion.content}</div>
                            {suggestion.position && (
                              <div className="text-xs text-amber-600 mt-1">位置：{suggestion.position}</div>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            suggestion.priority === 'high'
                              ? 'bg-red-100 text-red-700'
                              : suggestion.priority === 'medium'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {suggestion.priority === 'high' ? '高' : suggestion.priority === 'medium' ? '中' : '低'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 一键优化按钮 */}
                <button
                  onClick={handleOptimize}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-500 text-white rounded-xl font-medium text-lg transition-all shadow-lg shadow-blue-600/20"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      AI优化中...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      一键优化
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 底部操作区 */}
        <div className="px-8 py-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-6 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg font-medium transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            上一步
          </button>
          <div className="flex items-center gap-3">
            {/* 导出下拉菜单 */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isExportingZip}
                className="flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 font-medium transition-colors disabled:opacity-50"
              >
                {isExportingZip ? (
                  <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
                {isExportingZip ? '导出中...' : '导出内容'}
                <ChevronDown className={`w-4 h-4 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* 下拉菜单 */}
              {showExportMenu && (
                <div className="absolute bottom-full mb-2 right-0 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[200px] z-10">
                  <button
                    onClick={handleExport}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-blue-500" />
                    <div className="text-left">
                      <div className="text-sm font-medium">导出当前平台</div>
                      <div className="text-xs text-slate-400">导出为 Markdown 文件</div>
                    </div>
                  </button>
                  <button
                    onClick={handleExportAllZip}
                    disabled={isExportingZip}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
                  >
                    <FileArchive className="w-4 h-4 text-purple-500" />
                    <div className="text-left">
                      <div className="text-sm font-medium">导出全部平台</div>
                      <div className="text-xs text-slate-400">打包下载为 ZIP 文件</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={onRestart}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <Home className="w-5 h-5" />
              继续创作
            </button>
          </div>
        </div>
      </div>

      {/* 优化对比浮层 */}
      <CompareModal
        show={showCompareModal}
        platform={currentPlatform}
        beforeContent={{
          title: platformsData[currentPlatform]?.title || '',
          content: platformsData[currentPlatform]?.content || '',
        }}
        afterContent={{
          title: platformsData[currentPlatform]?.optimizedVersion?.title || '',
          content: platformsData[currentPlatform]?.optimizedVersion?.content || '',
        }}
        suggestions={currentReport?.optimizationSuggestions || []}
        onSelectBefore={handleSelectOriginal}
        onSelectAfter={handleSelectOptimized}
        onClose={() => setShowCompareModal(false)}
      />
    </div>
  );
}
