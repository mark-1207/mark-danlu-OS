import { useState, useRef, useEffect } from 'react';
import {
  Settings,
  History,
  Zap,
  FileText,
  PenTool,
  TrendingUp,
  CheckCircle,
  Sparkles,
  ArrowRight,
  Layers,
  Target,
  MessageSquare,
  User,
  Upload,
  Mic,
  ChevronRight,
  ChevronLeft,
  File,
  X,
  AlertCircle,
  RefreshCw,
  Wand2,
  Edit3,
  Plus,
  Check,
  Download
} from 'lucide-react';
import './App.css';
import OptimizationReportPage from './components/OptimizationReportPage';
import SettingsPage from './components/SettingsPage';
import InsightPage from './components/InsightPage';
import { hasApiConfig, getApiConfigError, generatePlatformContent } from './services/llm/llmService';

// 首页组件
function HomePage({ onStartCreate, onOpenSettings }: { onStartCreate: () => void; onOpenSettings: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* 导航栏 */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <PenTool className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-800">Refine</span>
          </div>

          {/* 右侧按钮 */}
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
              <History className="w-4 h-4" />
              <span className="text-sm">历史版本</span>
            </button>
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm">产品配置</span>
            </button>
            <button className="w-10 h-10 flex items-center justify-center text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors">
              <User className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero区域 */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            AI驱动的内容改写工具
          </div>

          <h1 className="text-5xl font-bold text-slate-900 mb-6 leading-tight">
            一键将内容转化为<br/>
            <span className="text-blue-600">爆款文案</span>
          </h1>

          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            支持公众号、小红书、抖音等多平台内容智能改写，<br/>
            分析爆款潜质，提供优化建议，让你的内容更具传播力
          </p>

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={onStartCreate}
              className="flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg transition-all shadow-xl shadow-blue-600/20 hover:shadow-2xl hover:shadow-blue-600/30"
            >
              <Zap className="w-5 h-5" />
              立即开始创作
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {/* 平台标签 */}
          <div className="flex items-center justify-center gap-6 mt-12 text-slate-400">
            <span className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" /> 公众号
            </span>
            <span className="flex items-center gap-2">
              <Layers className="w-5 h-5" /> 小红书
            </span>
            <span className="flex items-center gap-2">
              <Target className="w-5 h-5" /> 抖音
            </span>
            <span className="flex items-center gap-2">
              <Settings className="w-5 h-5" /> 自定义平台
            </span>
          </div>
        </div>
      </section>

      {/* 能力展示区 */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">核心能力</h2>
            <p className="text-slate-600 text-lg">全方位满足你的内容改写需求</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: FileText,
                title: '多格式输入',
                desc: '支持文本粘贴、Word、PDF、Markdown文件上传，语音转文字',
                color: 'blue'
              },
              {
                icon: PenTool,
                title: '智能改写',
                desc: '基于提示词模板，精准匹配各平台风格，一键生成优质内容',
                color: 'indigo'
              },
              {
                icon: TrendingUp,
                title: '爆款分析',
                desc: '深度分析内容结构、情感浓度、传播潜力，挖掘爆款基因',
                color: 'purple'
              },
              {
                icon: CheckCircle,
                title: '优化建议',
                desc: '六维度质检报告，提供针对性优化建议，提升内容质量',
                color: 'emerald'
              }
            ].map((feature, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl border border-slate-200 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/10 transition-all cursor-pointer bg-white group"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 解决问题区 */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">解决什么问题</h2>
            <p className="text-slate-600 text-lg">针对内容创作的痛点，提供一站式解决方案</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                problem: '耗时耗力',
                solution: '手动改写效率低',
                benefit: 'AI自动处理，3分钟完成改写'
              },
              {
                problem: '风格不匹配',
                solution: '不了解各平台调性',
                benefit: '专属提示词模板，精准匹配风格'
              },
              {
                problem: '效果不确定',
                solution: '不知道能否成为爆款',
                benefit: '爆款分析+质检报告，数据驱动优化'
              }
            ].map((item, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-red-500 font-medium mb-2">{item.problem}</div>
                <div className="text-slate-400 text-sm mb-4">→ {item.solution}</div>
                <div className="flex items-center gap-2 text-green-600 font-medium">
                  <CheckCircle className="w-5 h-5" />
                  {item.benefit}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 使用流程 */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">使用流程</h2>
            <p className="text-slate-600 text-lg">简单4步，轻松完成内容改写</p>
          </div>

          <div className="flex items-center justify-between relative">
            {/* 连接线 */}
            <div className="absolute top-8 left-16 right-16 h-0.5 bg-slate-200 -z-10" />

            {[
              { step: '01', title: '输入内容', desc: '粘贴文本或上传文件' },
              { step: '02', title: '选择平台', desc: '勾选目标发布平台' },
              { step: '03', title: 'AI改写', desc: '一键生成爆款文案' },
              { step: '04', title: '质检优化', desc: '分析并提升内容质量' }
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-white border-2 border-blue-600 rounded-full flex items-center justify-center mb-4">
                  <span className="text-blue-600 font-bold text-lg">{item.step}</span>
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">{item.title}</h3>
                <p className="text-slate-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA区域 */}
      <section className="py-20 px-6 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">准备好创造爆款内容了吗？</h2>
          <p className="text-blue-100 text-lg mb-8">立即开始，让你的内容更具传播力</p>
          <button
            onClick={onStartCreate}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold text-lg hover:bg-blue-50 transition-colors"
          >
            <Zap className="w-5 h-5" />
            开始创作
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="py-8 px-6 bg-slate-900">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <PenTool className="w-4 h-4 text-white" />
            </div>
            <span className="text-slate-400 text-sm">Refine © 2026</span>
          </div>
          <div className="flex items-center gap-6 text-slate-400 text-sm">
            <a href="#" className="hover:text-white transition-colors">使用协议</a>
            <a href="#" className="hover:text-white transition-colors">隐私政策</a>
            <a href="#" className="hover:text-white transition-colors">帮助中心</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// 侧边栏导航组件
function SideNav({
  currentStep,
  mode,
  completedSteps,
  onStepClick,
  onBack
}: {
  currentStep: number;
  mode: 'quick' | 'pro' | null;
  completedSteps: number[];
  onStepClick: (step: number) => void;
  onBack: () => void;
}) {
  const steps = [
    { id: 1, label: '内容编辑', icon: FileText },
    { id: 2, label: '洞察分析', icon: TrendingUp },
    { id: 3, label: '内容创作', icon: PenTool },
    { id: 4, label: '优化报告', icon: CheckCircle },
  ];

  // 判断步骤是否可点击
  const canClickStep = (stepId: number) => {
    // 快速模式下，只能点击内容编辑(1)、洞察分析(2)、内容创作(3)，不能点击优化报告(4)
    if (mode === 'quick') {
      return stepId <= 3;
    }

    // 专业模式：只能点击已完成的步骤或当前步骤
    // 如果步骤已完成，可以点击
    if (completedSteps.includes(stepId)) {
      return true;
    }
    // 如果是当前步骤，可以点击
    if (stepId === currentStep) {
      return true;
    }
    // 内容编辑总是可点击
    if (stepId === 1) {
      return true;
    }

    return false;
  };

  return (
    <div className="w-56 bg-slate-900 min-h-screen flex flex-col">
      {/* Logo和页面标题 */}
      <div className="p-4 border-b border-slate-700">
        {/* 返回按钮 + Logo 在同一行 */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <PenTool className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white">Refine</span>
        </div>
      </div>

      {/* 步骤导航 */}
      <div className="flex-1 p-4">
        <div className="space-y-1">
          {steps.map((step) => {
            const isActive = currentStep === step.id;
            const isClickable = canClickStep(step.id);

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
                {/* 图标 */}
                <step.icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 底部占位 */}
      <div className="p-6 border-t border-slate-800">
        <div className="text-xs text-slate-500">Refine © 2026</div>
      </div>
    </div>
  );
}

// 平台结果卡片组件
function PlatformResultCard({
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
  result?: {
    title: string;
    content: string;
    coverPrompt: string;
    progress: number;
    status: 'generating' | 'completed' | 'error';
  };
  isAllStepsCompleted: boolean;
  onPreview: () => void;
  onDownload: () => void;
  onRegenerate: () => void;
}) {
  const colorStyles = {
    blue: {
      bg: 'from-blue-50 to-indigo-50',
      border: 'border-blue-100',
      iconBg: 'bg-blue-500',
      iconColor: 'text-white',
      progress: 'bg-blue-500',
      text: 'text-blue-600'
    },
    pink: {
      bg: 'from-pink-50 to-rose-50',
      border: 'border-pink-100',
      iconBg: 'bg-pink-500',
      iconColor: 'text-white',
      progress: 'bg-pink-500',
      text: 'text-pink-600'
    },
    cyan: {
      bg: 'from-cyan-50 to-sky-50',
      border: 'border-cyan-100',
      iconBg: 'bg-cyan-500',
      iconColor: 'text-white',
      progress: 'bg-cyan-500',
      text: 'text-cyan-600'
    }
  };

  const style = colorStyles[color];
  const isGenerating = result?.status === 'generating';
  const isCompleted = result?.status === 'completed';

  return (
    <div className={`p-4 bg-gradient-to-br ${style.bg} rounded-xl border ${style.border} flex flex-col`}>
      {/* 平台名称和图标 */}
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

      {/* 标题 */}
      <div className="flex-1 mb-3">
        {isCompleted ? (
          <div className="text-sm font-medium text-slate-800 line-clamp-2">
            {result?.title}
          </div>
        ) : isGenerating ? (
          <div className="text-sm text-slate-500">正在生成中...</div>
        ) : isAllStepsCompleted ? (
          <div className="text-sm text-green-600 font-medium">生成完毕</div>
        ) : (
          <div className="text-sm text-slate-400">等待生成...</div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 mb-3">
        {isCompleted ? (
          <>
            <button
              onClick={onPreview}
              className="flex-1 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg border border-slate-200 transition-colors"
            >
              预览
            </button>
            <button
              onClick={onDownload}
              className={`flex-1 px-3 py-2 ${style.iconBg} hover:opacity-90 ${style.iconColor} text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1`}
            >
              <Download className="w-4 h-4" />
              下载
            </button>
          </>
        ) : isGenerating ? (
          <button
            onClick={onRegenerate}
            disabled
            className="flex-1 px-3 py-2 bg-slate-100 text-slate-400 text-sm font-medium rounded-lg cursor-not-allowed"
          >
            生成中...
          </button>
        ) : !isAllStepsCompleted ? (
          <button
            onClick={onRegenerate}
            disabled
            className="flex-1 px-3 py-2 bg-slate-100 text-slate-400 text-sm font-medium rounded-lg cursor-not-allowed"
          >
            开始生成
          </button>
        ) : (
          <button
            onClick={onRegenerate}
            className={`flex-1 px-3 py-2 ${style.iconBg} hover:opacity-90 ${style.iconColor} text-sm font-medium rounded-lg transition-colors`}
          >
            开始生成
          </button>
        )}
      </div>

      {/* 进度条 */}
      <div className="mt-auto">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>生成进度</span>
          <span>{result?.progress || 0}%</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${style.progress} transition-all duration-300 rounded-full`}
            style={{ width: `${result?.progress || 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// 内容输入页面
function ContentInputPage({
  onStartAnalyze,
  onStepClick,
  onBack
}: {
  onStartAnalyze: (content: string) => void;
  onStepClick: (step: number) => void;
  onBack: () => void;
}) {
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = content.length;

  const handleSaveDraft = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const handleFileUpload = () => {
    // 创建文件输入元素
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.doc,.docx,.pdf';
    input.click();

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setFileName(file.name);
        // 读取文件内容
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          setContent(text);
        };
        reader.readAsText(file);
      }
    };
  };

  const clearContent = () => {
    setContent('');
    setFileName(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* 左侧导航 */}
      <SideNav
        currentStep={1}
        mode={null}
        completedSteps={[1]}
        onStepClick={onStepClick}
        onBack={onBack}
      />

      {/* 右侧内容区 */}
      <div className="flex-1 flex flex-col">
        {/* 主内容 */}
        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-3xl mx-auto">
            {/* 页面标题 */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900">内容编辑</h1>
              <p className="text-slate-500 text-sm mt-1">提供您的文本，为您分析拆解</p>
            </div>

            {/* 输入框区域 */}
            <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="请输入改写内容或上传文件"
                className="w-full h-80 p-4 text-slate-700 placeholder:text-slate-400 resize-none focus:outline-none"
              />

              {/* 底部工具栏 */}
              <div className="h-12 border-t border-slate-100 px-4 flex items-center justify-between bg-slate-50">
                {/* 左侧：上传和音频按钮 */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleFileUpload}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-white rounded-lg transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    上传文件
                    <span className="text-xs text-slate-400">(TXT/MD/DOC/PDF)</span>
                  </button>
                  <button
                    disabled
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed"
                  >
                    <Mic className="w-4 h-4" />
                    上传音频
                    <span className="text-xs">(敬请期待)</span>
                  </button>
                  {fileName && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg">
                      <File className="w-4 h-4" />
                      <span className="text-sm">{fileName}</span>
                      <button onClick={clearContent} className="hover:text-blue-900">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* 右侧：字数统计 */}
                <div className="text-sm text-slate-400">
                  {charCount} 字
                </div>
              </div>
            </div>

            {/* 底部操作区 */}
            <div className="mt-8 flex items-center justify-between">
              {/* 保存草稿按钮 */}
              <button
                onClick={handleSaveDraft}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-white rounded-lg border border-slate-200 transition-colors"
              >
                保存草稿
              </button>

              {/* 开始分析按钮 */}
              <button
                onClick={() => onStartAnalyze(content)}
                disabled={!content.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                开始分析
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 保存草稿浮层提示 */}
      {showToast && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-slate-800 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span>成功保存草稿</span>
          </div>
        </div>
      )}
    </div>
  );
}

// 内容创作页面
function ContentCreationPage({
  inputContent,
  analysisResult,
  onBack,
  onNext,
  completedSteps,
  setCompletedSteps,
  onStepClick
}: {
  inputContent: string;
  analysisResult: any;
  onBack: () => void;
  onNext: (data: any) => void;
  completedSteps: number[];
  setCompletedSteps: React.Dispatch<React.SetStateAction<number[]>>;
  onStepClick: (step: number) => void;
}) {
  const [mode, setMode] = useState<'quick' | 'pro' | null>('quick');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedTitles, setSelectedTitles] = useState<number[]>([]);
  const [editedTitles, setEditedTitles] = useState<{ [key: number]: string }>({});
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [selectedCoverStyles, setSelectedCoverStyles] = useState<string[]>([]);
  // 快速模式和专业模式使用独立的生成状态
  const [quickIsGenerating, setQuickIsGenerating] = useState(false);
  const [proIsGenerating, setProIsGenerating] = useState(false);
  // 快速模式是否已点击过生成（用于显示结果预览而不是初始状态）
  const [quickHasGenerated, setQuickHasGenerated] = useState(false);
  const [generationSteps, setGenerationSteps] = useState<{ step: string; status: 'pending' | 'success' | 'error' }[]>([]);
  // 专业模式生成进度状态（独立于快速模式）
  const [proGenerationSteps, setProGenerationSteps] = useState<{ step: string; status: 'pending' | 'success' | 'error' }[]>([]);
  const [showPlatformTip, setShowPlatformTip] = useState(false);

  // 判断生成进度是否全部完成
  const isAllStepsCompleted = generationSteps.length > 0 && generationSteps.every(s => s.status === 'success');

  // 快速模式生成结果状态
  const [quickModeResults, setQuickModeResults] = useState<{
    [platform: string]: {
      title: string;
      content: string;
      coverPrompt: string;
      progress: number;
      status: 'generating' | 'completed' | 'error';
    }
  }>({});
  const [previewPlatform, setPreviewPlatform] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // 模拟生成的标题数据（实际应调用AI）
  const [generatedTitles, setGeneratedTitles] = useState([
    { id: 1, content: '你不是懒，你只是太焦虑了', type: '反常识', score: 9 },
    { id: 2, content: '职场人最大的陷阱，不是能力不够', type: '反常识', score: 8 },
    { id: 3, content: '为什么你总是拖延？答案可能出乎意料', type: '悬念', score: 9 },
    { id: 4, content: '打开这篇文章前，请先准备好纸巾', type: '悬念', score: 7 },
    { id: 5, content: '年薪百万的职场人，都在偷偷做这件事', type: '悬念', score: 8 },
    { id: 6, content: '2026年职场生存指南：别再只会努力了', type: '热点', score: 7 },
    { id: 7, content: '领导最不想听到的5句话，句句扎心', type: '痛点', score: 8 },
  ]);

  // 标题按推荐度和类型分组（推荐标题最多2个）
  const recommendedTitles = generatedTitles.filter(t => t.score >= 8).slice(0, 2);
  const otherTitles = generatedTitles.filter(t => t.score < 8);
  const titlesByType = otherTitles.reduce((acc: { [key: string]: typeof generatedTitles }, title) => {
    if (!acc[title.type]) acc[title.type] = [];
    acc[title.type].push(title);
    return acc;
  }, {});

  // 推荐理由映射
  const getRecommendationReason = (score: number) => {
    if (score >= 9) return '高热度词汇，爆款潜力强';
    if (score >= 8) return '精准触达用户痛点';
    return '有一定吸引力';
  };

  // 封面风格选项
  const coverStyles = [
    { id: 'bold-editorial', name: 'Bold Editorial', desc: '大胆编辑风格' },
    { id: 'intuition-machine', name: 'Intuition Machine', desc: '直觉机器风格' },
    { id: 'pixel-art', name: 'Pixel Art', desc: '像素艺术风格' },
    { id: 'claymation', name: 'Claymation', desc: '黏土动画风格' },
    { id: 'craft-handmade', name: 'Craft Handmade', desc: '手工制作风格' },
  ];

  // 平台信息
  const platforms = [
    { id: 'gzh', name: '公众号', size: '900×383', aspect: '2.35:1' },
    { id: 'xhs', name: '小红书', size: '3:4', aspect: '3:4' },
    { id: 'douyin', name: '抖音', size: '9:16', aspect: '9:16' },
  ];

  // 找出评分最高的平台
  const topPlatform = analysisResult?.platformFit
    ? Object.entries(analysisResult.platformFit).sort((a: any, b: any) => b[1].score - a[1].score)[0][0]
    : 'gzh';

  // 初始化默认选中最高评分平台
  useEffect(() => {
    if (mode === 'pro' && selectedPlatforms.length === 0) {
      setSelectedPlatforms([topPlatform]);
    }
  }, [mode, topPlatform]);

  const handlePlatformToggle = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    );
  };

  const handleTitleToggle = (titleId: number) => {
    if (selectedTitles.includes(titleId)) {
      setSelectedTitles(prev => prev.filter(id => id !== titleId));
    } else {
      if (selectedTitles.length < 3) {
        setSelectedTitles(prev => [...prev, titleId]);
      }
    }
  };

  const handleTitleEdit = (titleId: number, newContent: string) => {
    setEditedTitles(prev => ({ ...prev, [titleId]: newContent }));
    setEditingTitleId(null);
  };

  const startEditing = (titleId: number, currentContent: string) => {
    setEditingTitleId(titleId);
    setEditValue(currentContent);
  };

  const handleAddCustomTitle = () => {
    if (customTitle.trim()) {
      const newId = Math.max(...generatedTitles.map(t => t.id), 0) + 1;
      setGeneratedTitles(prev => [...prev, { id: newId, content: customTitle, type: '自定义', score: 0 }]);
      setSelectedTitles(prev => [...prev, newId]);
      setCustomTitle('');
    }
  };

  const handleCoverStyleToggle = (styleId: string) => {
    setSelectedCoverStyles(prev =>
      prev.includes(styleId)
        ? prev.filter(s => s !== styleId)
        : [...prev, styleId]
    );
  };

  const canGenerate = () => {
    if (mode === 'quick') return true;
    if (mode === 'pro') {
      return selectedPlatforms.length > 0 && selectedTitles.length > 0;
    }
    return false;
  };

  const handleGenerate = async () => {
    // 检查 API 配置
    if (!hasApiConfig()) {
      const error = getApiConfigError();
      setApiError(error || '请检查您的API配置');
      alert(error || '请检查您的API配置');
      return;
    }

    // 模拟生成步骤
    const steps = [
      { step: '分析内容结构', status: 'pending' as const },
      { step: '匹配平台风格', status: 'pending' as const },
      { step: '生成标题方案', status: 'pending' as const },
      { step: '撰写内容正文', status: 'pending' as const },
      { step: '生成封面建议', status: 'pending' as const },
    ];

    // 根据模式设置各自的生成状态
    if (mode === 'quick') {
      setQuickIsGenerating(true);
      setGenerationSteps(steps); // 先设置步骤数据，显示生成进度模块
    } else {
      setProIsGenerating(true);
      // 读取状态以确保TypeScript正确识别
      if (proGenerationSteps.length >= 0) {}
      setProGenerationSteps(steps);
    }

    // 保存 AI 生成的结果（专业模式）
    let aiGeneratedResult: { titles: string[]; content: string; coverPrompt: string } | null = null;

    // 专业模式：调用 AI 生成标题
    if (mode === 'pro' && selectedPlatforms.length > 0) {
      try {
        // 更新步骤状态
        setProGenerationSteps(prev => prev.map((s, idx) =>
          idx === 0 ? { ...s, status: 'success' } : s
        ));

        const platformId = selectedPlatforms[0];
        const context = {
          content: inputContent,
          keywords: analysisResult?.contentDNA?.关键词 || '',
          emotion: analysisResult?.contentDNA?.情绪基调 || '',
          audience: analysisResult?.contentDNA?.目标受众 || '',
          category: analysisResult?.contentDNA?.主题分类 || '',
        };

        // 调用 AI 生成内容
        const result = await generatePlatformContent(platformId, context);

        // 保存生成的结果
        aiGeneratedResult = result;

        // 更新步骤状态
        setProGenerationSteps(prev => prev.map((s, idx) =>
          idx >= 2 ? { ...s, status: 'success' } : s
        ));

        // 将 AI 返回的标题转换为页面格式
        const newTitles = result.titles.map((title, index) => ({
          id: index + 1,
          content: title,
          type: 'AI生成',
          score: 9 - index // 第一个标题最高分
        }));

        setGeneratedTitles(newTitles);
        // 自动选中前两个标题
        if (newTitles.length >= 2) {
          setSelectedTitles([newTitles[0].id, newTitles[1].id]);
        } else if (newTitles.length === 1) {
          setSelectedTitles([newTitles[0].id]);
        }

      } catch (error: any) {
        console.error('AI生成失败:', error);
        setApiError(error.message || '生成失败，请检查API配置');
        setProIsGenerating(false);
        return;
      }
    }

    // 模拟剩余步骤（仅视觉效果）
    const totalSteps = mode === 'pro' ? 3 : steps.length;
    for (let i = mode === 'pro' ? 2 : 0; i < totalSteps; i++) {
      await new Promise(resolve => setTimeout(resolve, 600));
      if (mode === 'quick') {
        setGenerationSteps(prev => prev.map((s, idx) =>
          idx === i ? { ...s, status: 'success' } : s
        ));
      } else {
        setProGenerationSteps(prev => prev.map((s, idx) =>
          idx === i ? { ...s, status: 'success' } : s
        ));
      }
    }

    await new Promise(resolve => setTimeout(resolve, 300));

    // 构建结果数据
    // 如果有 AI 生成的结果，优先使用 AI 生成的标题
    let titles: string[];
    if (aiGeneratedResult && mode === 'pro') {
      titles = selectedTitles.map((_, index) => {
        const titleId = selectedTitles[index];
        const edited = editedTitles[titleId];
        if (edited) return edited;
        // 使用 AI 生成的标题，按选中顺序
        return aiGeneratedResult.titles[index] || '';
      });
    } else {
      titles = selectedTitles.map(id => {
        const title = generatedTitles.find(t => t.id === id);
        return title ? (editedTitles[id] || title.content) : '';
      });
    }

    const resultData = {
      platforms: selectedPlatforms,
      titles,
      content: aiGeneratedResult?.content || '',
      coverPrompt: aiGeneratedResult?.coverPrompt || '',
      coverStyles: selectedCoverStyles,
      mode,
    };

    // 快速模式生成完成后保持在当前页面显示结果，专业模式跳转到下一步
    if (mode === 'quick') {
      // 标记快速模式已完成生成
      setQuickHasGenerated(true);
      // 设置生成状态为 false
      setQuickIsGenerating(false);
      // 不自动初始化各平台结果，让用户手动选择生成
      // 各平台保持"等待生成"状态
    } else {
      // 设置专业模式生成状态为 false
      setProIsGenerating(false);
      // 更新已完成步骤
      setCompletedSteps(prev => [...prev, 3]);
      onNext(resultData);
    }
    // 快速模式不跳转，停留在当前页面
  };

  // 快速模式下载处理
  const handleDownload = (platform: string) => {
    // 实际应生成文件包并下载
    alert(`正在下载 ${platform} 平台的内容包...`);
  };

  // 快速模式重新生成处理
  const handleRegenerate = async (platform: string) => {
    // 检查 API 配置
    if (!hasApiConfig()) {
      const error = getApiConfigError();
      setApiError(error || '请检查您的API配置');
      return;
    }

    // 开始重新生成
    setQuickModeResults(prev => ({
      ...prev,
      [platform]: { ...prev[platform], status: 'generating', progress: 0 }
    }));

    try {
      const context = {
        content: inputContent,
        keywords: analysisResult?.contentDNA?.关键词 || '',
        emotion: analysisResult?.contentDNA?.情绪基调 || '',
        audience: analysisResult?.contentDNA?.目标受众 || '',
        category: analysisResult?.contentDNA?.主题分类 || '',
      };

      // 调用 AI 生成内容
      const result = await generatePlatformContent(platform, context);

      // 生成完成
      setQuickModeResults(prev => ({
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
      setQuickModeResults(prev => ({
        ...prev,
        [platform]: { ...prev[platform], status: 'error', progress: 0 }
      }));
      setApiError(error.message || '生成失败');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* 左侧导航 */}
      <SideNav
        currentStep={3}
        mode={mode}
        completedSteps={completedSteps}
        onStepClick={onStepClick}
        onBack={onBack}
      />

      {/* 右侧内容区 */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-4xl mx-auto">
            {/* 页面标题 */}
            <div className="mb-6 flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">内容创作</h1>
              <span className="text-slate-400">|</span>
              <p className="text-slate-500 text-sm">选择模式，开始创作</p>
            </div>

            {/* 模式选择 */}
            <div className="mb-8">
              <div className="text-lg font-medium text-slate-800 mb-4">请您选择创作模式</div>
              <div className="grid grid-cols-2 gap-4">
                {/* 快速模式 */}
                <button
                  onClick={() => {
                    setMode('quick');
                    // 切换回快速模式时，重置生成进度状态但保留生成结果
                  }}
                  className={`p-5 rounded-xl border-2 transition-all text-left ${
                    mode === 'quick'
                      ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/10'
                      : 'border-slate-200 bg-white hover:border-blue-200'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      mode === 'quick' ? 'bg-blue-500' : 'bg-slate-100'
                    }`}>
                      <Zap className={`w-5 h-5 ${mode === 'quick' ? 'text-white' : 'text-slate-500'}`} />
                    </div>
                    <span className={`font-semibold ${mode === 'quick' ? 'text-blue-700' : 'text-slate-700'}`}>
                      快速模式
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">无需配置，AI全接管，一键生成最终结果</p>
                </button>

                {/* 专业模式 */}
                <button
                  onClick={() => {
                    setMode('pro');
                    // 切换到专业模式时，重置快速模式的生成状态
                    setQuickHasGenerated(false);
                    setQuickModeResults({});
                    setGenerationSteps([]);
                  }}
                  className={`p-5 rounded-xl border-2 transition-all text-left ${
                    mode === 'pro'
                      ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/10'
                      : 'border-slate-200 bg-white hover:border-blue-200'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      mode === 'pro' ? 'bg-blue-500' : 'bg-slate-100'
                    }`}>
                      <Edit3 className={`w-5 h-5 ${mode === 'pro' ? 'text-white' : 'text-slate-500'}`} />
                    </div>
                    <span className={`font-semibold ${mode === 'pro' ? 'text-blue-700' : 'text-slate-700'}`}>
                      专业模式
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">自定义选择+AI协助，更加符合预期效果</p>
                </button>
              </div>
            </div>

            {/* 模式内容 */}
            {mode && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* 快速模式 */}
                {mode === 'quick' && (
                  <div className="p-6">
                    {/* 未生成时显示按钮 */}
                    {!quickHasGenerated && !quickIsGenerating ? (
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
                            <PlatformResultCard
                              name="公众号"
                              icon={<MessageSquare className="w-5 h-5" />}
                              color="blue"
                              result={quickModeResults['gzh']}
                              isAllStepsCompleted={isAllStepsCompleted}
                              onPreview={() => {
                                setPreviewPlatform('gzh');
                                setShowPreview(true);
                              }}
                              onDownload={() => handleDownload('gzh')}
                              onRegenerate={() => handleRegenerate('gzh')}
                            />
                            {/* 小红书卡片 */}
                            <PlatformResultCard
                              name="小红书"
                              icon={<Layers className="w-5 h-5" />}
                              color="pink"
                              result={quickModeResults['xhs']}
                              isAllStepsCompleted={isAllStepsCompleted}
                              onPreview={() => {
                                setPreviewPlatform('xhs');
                                setShowPreview(true);
                              }}
                              onDownload={() => handleDownload('xhs')}
                              onRegenerate={() => handleRegenerate('xhs')}
                            />
                            {/* 抖音卡片 */}
                            <PlatformResultCard
                              name="抖音"
                              icon={<Target className="w-5 h-5" />}
                              color="cyan"
                              result={quickModeResults['douyin']}
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
                  </div>
                )}

                {/* 专业模式 */}
                {mode === 'pro' && (
                  <div className="p-6 space-y-8">
                    {/* 平台选择 */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Target className="w-5 h-5 text-slate-500" />
                          <span className="font-medium text-slate-800">选择目标平台</span>
                        </div>
                        <button
                          onClick={() => setShowPlatformTip(!showPlatformTip)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <AlertCircle className="w-5 h-5" />
                        </button>
                      </div>
                      {showPlatformTip && (
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-slate-600">
                          根据内容分析，为您推荐最适合的平台。默认选择评分最高的平台。
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-3">
                        {platforms.map(platform => {
                          const isTop = platform.id === topPlatform;
                          const isSelected = selectedPlatforms.includes(platform.id);
                          return (
                            <button
                              key={platform.id}
                              onClick={() => handlePlatformToggle(platform.id)}
                              className={`p-4 rounded-xl border-2 transition-all text-left ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50'
                                  : isTop
                                  ? 'border-amber-300 bg-amber-50 hover:border-amber-400'
                                  : 'border-slate-200 bg-white hover:border-blue-200'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className={`font-medium ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                                  {platform.name}
                                </span>
                                {isTop && (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                                    推荐
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-slate-500">{platform.size}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 标题选择 */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-slate-500" />
                          <span className="font-medium text-slate-800">选择标题</span>
                        </div>
                        <span className="text-sm text-slate-500">
                          已选 {selectedTitles.length}/3
                        </span>
                      </div>

                      {/* 标题展示：推荐标题单独展示 */}
                      <div className="space-y-4 mb-4">
                        {/* 推荐标题 - 单独展示 */}
                        {recommendedTitles.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <Sparkles className="w-4 h-4 text-amber-500" />
                              <span className="text-sm font-medium text-amber-700">推荐标题</span>
                              <span className="text-xs text-amber-600">爆款潜力强，建议优先选择</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              {recommendedTitles.map(title => {
                                const isSelected = selectedTitles.includes(title.id);
                                const isEditing = editingTitleId === title.id;
                                const displayContent = editedTitles[title.id] !== undefined ? editedTitles[title.id] : title.content;
                                return (
                                  <div
                                    key={title.id}
                                    className={`p-4 rounded-xl border-3 transition-all relative ${
                                      isSelected
                                        ? 'border-amber-500 bg-amber-100 shadow-lg shadow-amber-500/20'
                                        : 'border-amber-200 bg-white hover:border-amber-300 hover:shadow-md'
                                    }`}
                                  >
                                    {isSelected && (
                                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center shadow-lg">
                                        <Check className="w-4 h-4 text-white" />
                                      </div>
                                    )}
                                    {isEditing ? (
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500"
                                          autoFocus
                                        />
                                        <button
                                          onClick={() => handleTitleEdit(title.id, editValue)}
                                          className="p-2 text-green-600 hover:bg-green-100 rounded-lg"
                                        >
                                          <Check className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => setEditingTitleId(null)}
                                          className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex-1">
                                            <span className={`text-base font-medium ${isSelected ? 'text-amber-800' : 'text-slate-800'}`}>
                                              {displayContent}
                                            </span>
                                            <div className="flex items-center gap-2 mt-2">
                                              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                                                推荐度 {title.score}
                                              </span>
                                              <span className="text-xs text-slate-500">{title.type}</span>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                startEditing(title.id, displayContent);
                                              }}
                                              className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                                            >
                                              <Edit3 className="w-4 h-4" />
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleTitleToggle(title.id);
                                              }}
                                              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                                                isSelected
                                                  ? 'bg-amber-500 text-white'
                                                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                              }`}
                                            >
                                              {isSelected ? '已选择' : '选择'}
                                            </button>
                                          </div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-amber-100">
                                          <span className="text-xs text-amber-700">
                                            推荐理由：{getRecommendationReason(title.score)}
                                          </span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 其他标题 - 按类型分组展示 */}
                        {Object.entries(titlesByType).map(([type, titles]) => (
                          <div key={type}>
                            <div className="text-sm font-medium text-slate-600 mb-2">{type}</div>
                            <div className="grid grid-cols-2 gap-2">
                              {titles.map(title => {
                                const isSelected = selectedTitles.includes(title.id);
                                const isEditing = editingTitleId === title.id;
                                const displayContent = editedTitles[title.id] !== undefined ? editedTitles[title.id] : title.content;
                                return (
                                  <div
                                    key={title.id}
                                    className={`p-3 rounded-lg border-2 transition-all ${
                                      isSelected
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-slate-200 bg-white hover:border-blue-200'
                                    }`}
                                  >
                                    {isEditing ? (
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                                          autoFocus
                                        />
                                        <button
                                          onClick={() => handleTitleEdit(title.id, editValue)}
                                          className="p-1 text-green-600 hover:bg-green-100 rounded"
                                        >
                                          <Check className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => setEditingTitleId(null)}
                                          className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="flex items-start justify-between gap-2">
                                          <span className={`text-sm flex-1 ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                                            {displayContent}
                                          </span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              startEditing(title.id, displayContent);
                                            }}
                                            className="text-slate-400 hover:text-blue-600"
                                          >
                                            <Edit3 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleTitleToggle(title.id);
                                            }}
                                            className={`flex-1 text-left`}
                                          >
                                            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                              推荐度 {title.score}
                                            </span>
                                            <span className="text-xs text-slate-400 ml-2">{title.type}</span>
                                          </button>
                                          {isSelected && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* 编辑/自定义标题 */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customTitle}
                          onChange={(e) => setCustomTitle(e.target.value)}
                          placeholder="添加自定义标题..."
                          className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={handleAddCustomTitle}
                          disabled={!customTitle.trim()}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          <Plus className="w-4 h-4" />
                          添加
                        </button>
                      </div>
                    </div>

                    {/* 封面建议 */}
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Layers className="w-5 h-5 text-slate-500" />
                        <span className="font-medium text-slate-800">封面建议</span>
                      </div>
                      <div className="grid grid-cols-5 gap-3">
                        {coverStyles.map(style => {
                          const isSelected = selectedCoverStyles.includes(style.id);
                          return (
                            <button
                              key={style.id}
                              onClick={() => handleCoverStyleToggle(style.id)}
                              className={`p-3 rounded-lg border-2 transition-all text-center ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-slate-200 bg-white hover:border-blue-200'
                              }`}
                            >
                              <div className={`w-10 h-10 mx-auto mb-2 rounded-lg ${
                                style.id === 'bold-editorial' ? 'bg-red-100' :
                                style.id === 'intuition-machine' ? 'bg-blue-100' :
                                style.id === 'pixel-art' ? 'bg-purple-100' :
                                style.id === 'claymation' ? 'bg-amber-100' :
                                'bg-green-100'
                              }`} />
                              <div className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                                {style.name}
                              </div>
                              <div className="text-xs text-slate-500 mt-1">{style.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 底部操作区 */}
            {mode && (
              <div className="mt-8 flex items-center justify-center">
                {mode === 'pro' && (
                  <button
                    onClick={onBack}
                    className="px-6 py-3 text-slate-600 hover:text-slate-800 hover:bg-white border border-slate-200 rounded-lg font-medium text-base transition-colors"
                  >
                    上一步
                  </button>
                )}
                {mode === 'pro' && (
                  <button
                    onClick={handleGenerate}
                    disabled={!canGenerate() || proIsGenerating}
                    className={`flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-medium text-base transition-colors ${mode === 'pro' ? 'ml-auto' : ''}`}
                  >
                    {proIsGenerating ? (
                      <>生成中...</>
                    ) : (
                      <>
                        爆款制作启动
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 预览浮层 */}
      {showPreview && previewPlatform && quickModeResults[previewPlatform] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 遮罩层 */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowPreview(false)}
          />

          {/* 浮层内容 */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden m-4">
            {/* 浮层头部 */}
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
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 浮层内容 */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* 标题 */}
              <div className="mb-6">
                <div className="text-sm text-slate-500 mb-2">标题</div>
                <div className="text-lg font-semibold text-slate-800">
                  {quickModeResults[previewPlatform]?.title}
                </div>
              </div>

              {/* 内容 */}
              <div className="mb-6">
                <div className="text-sm text-slate-500 mb-2">正文内容</div>
                <div className="p-4 bg-slate-50 rounded-lg text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {quickModeResults[previewPlatform]?.content}
                </div>
              </div>

              {/* 封面提示词 */}
              <div>
                <div className="text-sm text-slate-500 mb-2">封面提示词</div>
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                  <code className="text-sm text-purple-700">
                    {quickModeResults[previewPlatform]?.coverPrompt}
                  </code>
                </div>
              </div>
            </div>

            {/* 浮层底部操作 */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => handleRegenerate(previewPlatform)}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-white rounded-lg border border-slate-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                重新生成
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-white rounded-lg border border-slate-200 transition-colors"
                >
                  关闭
                </button>
                <button
                  onClick={() => handleDownload(previewPlatform)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
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

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'input' | 'insight' | 'creation' | 'optimization' | 'settings'>('home');
  const [inputContent, setInputContent] = useState('');
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [completedSteps, setCompletedSteps] = useState<number[]>([1]);
  const [generationResult, setGenerationResult] = useState<any>(null);

  const handleStartCreate = () => {
    setCurrentPage('input');
  };

  const handleStartAnalyze = (content: string) => {
    setInputContent(content);
    setCurrentPage('insight');
  };

  const handleStepClick = (step: number) => {
    // 根据步骤切换页面
    switch (step) {
      case 1:
        setCurrentPage('input');
        break;
      case 2:
        setCurrentPage('insight');
        break;
      case 3:
        setCurrentPage('creation');
        break;
      case 4:
        setCurrentPage('optimization');
        break;
    }
  };

  const handleBack = () => {
    if (currentPage === 'insight') {
      setCurrentPage('input');
    } else if (currentPage === 'creation') {
      setCurrentPage('insight');
    } else if (currentPage === 'optimization') {
      setCurrentPage('creation');
    } else {
      setCurrentPage('home');
    }
  };

  const handleNext = (result: any) => {
    // 跳转到内容创作页面，传递分析结果
    setAnalysisResult(result);
    setCurrentPage('creation');
  };

  const handleCreationNext = (data: any) => {
    setGenerationResult(data);
    setCompletedSteps(prev => [...prev, 3]);
    setCurrentPage('optimization');
  };

  return (
    <>
      {currentPage === 'home' && (
        <HomePage onStartCreate={handleStartCreate} onOpenSettings={() => setCurrentPage('settings')} />
      )}
      {currentPage === 'input' && (
        <ContentInputPage
          onStartAnalyze={handleStartAnalyze}
          onStepClick={handleStepClick}
          onBack={handleBack}
        />
      )}
      {currentPage === 'insight' && (
        <InsightPage
          content={inputContent}
          onBack={handleBack}
          onNext={handleNext}
          completedSteps={completedSteps}
          setCompletedSteps={setCompletedSteps}
          onStepClick={handleStepClick}
        />
      )}
      {currentPage === 'creation' && (
        <ContentCreationPage
          inputContent={inputContent}
          analysisResult={analysisResult}
          onBack={handleBack}
          onNext={handleCreationNext}
          completedSteps={completedSteps}
          setCompletedSteps={setCompletedSteps}
          onStepClick={handleStepClick}
        />
      )}
      {currentPage === 'optimization' && (
        <OptimizationReportPage
          generationResult={generationResult}
          onBack={handleBack}
          onStepClick={handleStepClick}
          onRestart={() => {
            setCurrentPage('home');
            setInputContent('');
            setAnalysisResult(null);
            setGenerationResult(null);
            setCompletedSteps([1]);
          }}
        />
      )}
      {currentPage === 'settings' && (
        <SettingsPage onBack={() => setCurrentPage('home')} />
      )}
    </>
  );
}

export default App;
