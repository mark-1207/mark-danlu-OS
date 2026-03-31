import { useState, useRef } from 'react';
import { useSettingsStore } from './stores/settingsStore';
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
  Edit3,
  Clock,
  Lightbulb,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import SettingsPage from './components/SettingsPage';
import InsightPage from './components/InsightPage';
import QuickModePanel from './components/QuickModePanel';
import ProModePanel from './components/ProModePanel';

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
  ];

  // 判断步骤是否可点击
  const canClickStep = (stepId: number) => {
    // 快速模式下，只能点击内容编辑(1)、洞察分析(2)、内容创作(3)
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

// 前置信息类型
interface PreContentInfo {
  platform: string;       // 内容平台
  contentType: string;   // 内容类型
  track: string;         // 所属赛道
  likes: number;         // 获赞数
  collectCount: number;  // 收藏数
  viewCount: number;     // 播放数
  shareCount: number;    // 转发数
}

// 内容输入页面
function ContentInputPage({
  onStartAnalyze,
  onStepClick,
  onBack
}: {
  onStartAnalyze: (content: string, preInfo: PreContentInfo) => void;
  onStepClick: (step: number) => void;
  onBack: () => void;
}) {
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 从 store 读取已持久化的前置信息，作为本地 state 初始值
  const storePreInfo = useSettingsStore((state) => state.preInfo);
  const [preInfo, setPreInfo] = useState<PreContentInfo>(storePreInfo);

  const testMode = useSettingsStore((state) => state.testMode);
  const charCount = content.length;
  const MIN_CHARS = 100;
  const MAX_CHARS = 5000;

  // 字数状态判断（测试模式下跳过最小字符限制）
  const isTooShort = !testMode && charCount > 0 && charCount < MIN_CHARS;
  const isTooLong = charCount > MAX_CHARS;
  const isValidLength = testMode || (charCount >= MIN_CHARS && charCount <= MAX_CHARS);

  // 获取字数提示颜色
  const getCharCountColor = () => {
    if (charCount === 0) return 'text-slate-400';
    if (isTooShort) return 'text-amber-500';
    if (isTooLong) return 'text-red-500';
    return 'text-green-600';
  };

  // 获取字数提示文字
  const getCharCountText = () => {
    if (charCount === 0) return `${charCount} 字`;
    if (testMode) return `${charCount} 字 (测试模式)`;
    if (isTooShort) return `${charCount} 字 (至少${MIN_CHARS}字)`;
    if (isTooLong) return `${charCount} 字 (不超过${MAX_CHARS}字)`;
    return `${charCount} 字`;
  };

  const handleSaveDraft = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const handleFileUpload = () => {
    // 创建文件输入元素
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md';
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

            {/* 前置信息模块 */}
            <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-800 mb-5 flex items-center gap-2">
                <span className="text-blue-600">前置信息</span>
                <span className="text-xs text-slate-400 font-normal">（选填，但填写后生成内容更精准）</span>
              </h3>

              <div className="grid grid-cols-3 gap-5">
                {/* 内容平台 */}
                <div>
                  <label className="block text-sm text-slate-600 mb-2 font-medium">内容平台</label>
                  <select
                    value={preInfo.platform}
                    onChange={(e) => setPreInfo({ ...preInfo, platform: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  >
                    <option value="">请选择平台</option>
                    <option value="公众号">公众号</option>
                    <option value="小红书">小红书</option>
                    <option value="抖音">抖音</option>
                    <option value="视频号">视频号</option>
                    <option value="微博">微博</option>
                    <option value="B站">B站</option>
                  </select>
                </div>

                {/* 内容类型 */}
                <div>
                  <label className="block text-sm text-slate-600 mb-2 font-medium">内容类型</label>
                  <input
                    type="text"
                    value={preInfo.contentType}
                    onChange={(e) => setPreInfo({ ...preInfo, contentType: e.target.value })}
                    placeholder="例：1分钟口播短视频"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>

                {/* 所属赛道 */}
                <div>
                  <label className="block text-sm text-slate-600 mb-2 font-medium">所属赛道</label>
                  <input
                    type="text"
                    value={preInfo.track}
                    onChange={(e) => setPreInfo({ ...preInfo, track: e.target.value })}
                    placeholder="例：情感-亲密关系"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 核心数据 */}
              <div className="mt-5">
                <label className="block text-sm text-slate-600 mb-2 font-medium">核心数据（选填）</label>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">获赞数</label>
                    <input
                      type="number"
                      value={preInfo.likes || ''}
                      onChange={(e) => setPreInfo({ ...preInfo, likes: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">收藏数</label>
                    <input
                      type="number"
                      value={preInfo.collectCount || ''}
                      onChange={(e) => setPreInfo({ ...preInfo, collectCount: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">播放数</label>
                    <input
                      type="number"
                      value={preInfo.viewCount || ''}
                      onChange={(e) => setPreInfo({ ...preInfo, viewCount: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">转发数</label>
                    <input
                      type="number"
                      value={preInfo.shareCount || ''}
                      onChange={(e) => setPreInfo({ ...preInfo, shareCount: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 输入原文区域 */}
            <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="font-medium text-slate-700">输入原文</span>
                <span className={`text-sm font-medium ${getCharCountColor()}`}>
                  {getCharCountText()}
                </span>
              </div>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="请输入改写内容或上传文件"
                className="w-full h-80 p-5 text-slate-700 placeholder:text-slate-400 resize-none focus:outline-none bg-white"
              />

              {/* 底部工具栏 */}
              <div className="h-14 border-t border-slate-100 px-5 flex items-center justify-between bg-slate-50">
                {/* 左侧：上传和音频按钮 */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleFileUpload}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    上传文件
                    <span className="text-xs text-slate-400">(TXT/MD)</span>
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
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
                      <File className="w-4 h-4" />
                      <span className="text-sm font-medium">{fileName}</span>
                      <button onClick={clearContent} className="hover:text-blue-900 ml-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 底部操作区 */}
            <div className="mt-8 flex items-center justify-between">
              {/* 保存草稿按钮 */}
              <button
                onClick={handleSaveDraft}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-all"
              >
                保存草稿
              </button>

              {/* 开始分析按钮 + 字数限制提示 */}
              <div className="flex items-center gap-4">
                {content.trim() && !isValidLength && (
                  <span className={`text-sm font-medium ${isTooShort ? 'text-amber-600' : 'text-red-500'}`}>
                    {isTooShort ? `内容至少需要 ${MIN_CHARS} 字，当前 ${charCount} 字` : `内容不能超过 ${MAX_CHARS} 字，当前 ${charCount} 字`}
                  </span>
                )}
                <button
                  onClick={() => onStartAnalyze(content, preInfo)}
                  disabled={!content.trim() || !isValidLength}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:text-slate-500 text-white rounded-lg font-medium shadow-sm hover:shadow transition-all"
                >
                  开始分析
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
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
  preInfo,
  onBack,
  onNext,
  completedSteps,
  setCompletedSteps,
  onStepClick
}: {
  inputContent: string;
  analysisResult: any;
  preInfo?: any;
  onBack: () => void;
  onNext: (data: any) => void;
  completedSteps: number[];
  setCompletedSteps: React.Dispatch<React.SetStateAction<number[]>>;
  onStepClick: (step: number) => void;
}) {
  const [mode, setMode] = useState<'quick' | 'pro' | null>('quick');
  const [showTips, setShowTips] = useState(false);
  const [proIsGenerating, setProIsGenerating] = useState(false);

  // 专业模式生成完成后的回调
  const handleProGenerate = (data: any) => {
    setCompletedSteps(prev => [...prev, 3]);
    onNext({ ...data, mode: 'pro' });
  };

  // 计算原始内容字数
  const contentLength = inputContent?.length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 flex">
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
        {/* 顶部操作栏 */}
        <div className="h-14 border-b border-slate-200/60 bg-white/80 backdrop-blur-sm flex items-center justify-between px-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">返回</span>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onStepClick(2)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              重做洞察
            </button>
          </div>
        </div>

        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-4xl mx-auto">
            {/* 页面标题 */}
            <div className="mb-7">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-blue-500" />
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  内容创作
                </h1>
              </div>
              <p className="text-slate-500 text-sm">选择创作模式，开始生成爆款内容</p>
            </div>

            {/* 信息卡片区 */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {/* 原始内容卡片 */}
              <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="font-semibold text-slate-800">原始内容</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">字数</span>
                    <span className="text-sm font-medium text-slate-700">{contentLength.toLocaleString()} 字</span>
                  </div>
                  {preInfo?.platform && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">目标平台</span>
                      <span className="text-sm font-medium text-slate-700">{preInfo.platform}</span>
                    </div>
                  )}
                  {preInfo?.track && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">所属赛道</span>
                      <span className="text-sm font-medium text-slate-700">{preInfo.track}</span>
                    </div>
                  )}
                  {preInfo?.likes > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">参考点赞</span>
                      <span className="text-sm font-medium text-slate-700">{preInfo.likes.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 本次生成使用的分析要素卡片 */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200/60 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="font-semibold text-emerald-800">本次生成将使用以下分析要素</span>
                </div>
                <div className="space-y-2.5">
                  {analysisResult?.核心议题 && (
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-600 text-xs font-medium w-16 flex-shrink-0">核心议题</span>
                      <span className="text-sm text-slate-700">{analysisResult.核心议题}</span>
                    </div>
                  )}
                  {analysisResult?.情绪基调 && (
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-600 text-xs font-medium w-16 flex-shrink-0">情绪基调</span>
                      <span className="text-sm text-slate-700">
                        {Array.isArray(analysisResult.情绪基调) ? analysisResult.情绪基调.join(' + ') : analysisResult.情绪基调}
                      </span>
                    </div>
                  )}
                  {analysisResult?.目标受众 && (
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-600 text-xs font-medium w-16 flex-shrink-0">目标受众</span>
                      <span className="text-sm text-slate-700">{analysisResult.目标受众}</span>
                    </div>
                  )}
                  {analysisResult?._rawJson?.['二、结构脉络']?.开篇钩子?.内容 && (
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-600 text-xs font-medium w-16 flex-shrink-0">开篇钩子</span>
                      <span className="text-sm text-slate-700">{analysisResult._rawJson['二、结构脉络'].开篇钩子.内容}</span>
                    </div>
                  )}
                  {analysisResult?.金句?.[0] && (
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-600 text-xs font-medium w-16 flex-shrink-0">高光片段</span>
                      <span className="text-sm text-slate-700 italic">
                        "{typeof analysisResult.金句[0] === 'string' ? analysisResult.金句[0] : analysisResult.金句[0].内容}"
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 模式选择标题 */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">选择创作模式</h2>
                <div className="h-px bg-gradient-to-r from-slate-200 to-transparent mt-3"></div>
              </div>
              <button
                onClick={() => setShowTips(!showTips)}
                className="group relative flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 hover:bg-blue-50 text-slate-400 hover:text-blue-500 transition-colors"
              >
                <HelpCircle className="w-5 h-5" />
                {/* Tooltip */}
                <div className={`absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-20 transition-all ${showTips ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Lightbulb className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-slate-700 mb-1">使用建议</p>
                      <p className="text-slate-500">
                        {mode === 'quick'
                          ? '快速模式：输入原文 → AI分析 → 一键生成三平台内容，适合追求效率的用户'
                          : mode === 'pro'
                          ? '专业模式：输入原文 → 挑选标题 → 精调内容 → 生成最终文案，适合深度用户'
                          : '快速模式适合新手小白，专业模式适合有经验的用户深度定制'}
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {/* 模式选择 */}
            <div className="grid grid-cols-2 gap-5 mb-8">
              {/* 快速模式 */}
              <button
                onClick={() => {
                  setMode('quick');
                }}
                className={`group p-6 rounded-2xl border-2 transition-all text-left relative overflow-hidden ${
                  mode === 'quick'
                    ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-white shadow-lg shadow-blue-500/15'
                    : 'border-slate-200/80 bg-white hover:border-blue-300 hover:shadow-md'
                }`}
              >
                {/* 背景装饰 */}
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full opacity-5 transition-transform group-hover:scale-110 ${
                  mode === 'quick' ? 'bg-blue-500' : 'bg-slate-300'
                }`} style={{ transform: 'translate(30%, -30%)' }}></div>

                <div className="relative">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                      mode === 'quick' ? 'bg-blue-500 shadow-lg shadow-blue-500/30' : 'bg-slate-100 group-hover:bg-blue-100'
                    }`}>
                      <Zap className={`w-6 h-6 ${mode === 'quick' ? 'text-white' : 'text-slate-500 group-hover:text-blue-600'}`} />
                    </div>
                    <div>
                      <span className={`text-lg font-bold ${mode === 'quick' ? 'text-blue-700' : 'text-slate-700'}`}>
                        快速模式
                      </span>
                      {mode === 'quick' && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                          推荐
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-slate-500 mb-4">
                    {mode === 'quick' ? 'AI全流程处理，适合新手小白' : '无需配置，AI全接管'}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>预计30秒</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      <span>三平台同出</span>
                    </div>
                  </div>

                  <div className={`mt-5 py-2.5 px-4 rounded-xl text-center font-medium transition-all ${
                    mode === 'quick'
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600'
                  }`}>
                    {mode === 'quick' ? '选择此模式' : '选择此模式'}
                  </div>
                </div>
              </button>

              {/* 专业模式 */}
              <button
                onClick={() => setMode('pro')}
                className={`group p-6 rounded-2xl border-2 transition-all text-left relative overflow-hidden ${
                  mode === 'pro'
                    ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-white shadow-lg shadow-purple-500/15'
                    : 'border-slate-200/80 bg-white hover:border-purple-300 hover:shadow-md'
                }`}
              >
                {/* 背景装饰 */}
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full opacity-5 transition-transform group-hover:scale-110 ${
                  mode === 'pro' ? 'bg-purple-500' : 'bg-slate-300'
                }`} style={{ transform: 'translate(30%, -30%)' }}></div>

                <div className="relative">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                      mode === 'pro' ? 'bg-purple-500 shadow-lg shadow-purple-500/30' : 'bg-slate-100 group-hover:bg-purple-100'
                    }`}>
                      <Edit3 className={`w-6 h-6 ${mode === 'pro' ? 'text-white' : 'text-slate-500 group-hover:text-purple-600'}`} />
                    </div>
                    <span className={`text-lg font-bold ${mode === 'pro' ? 'text-purple-700' : 'text-slate-700'}`}>
                      专业模式
                    </span>
                  </div>

                  <p className="text-sm text-slate-500 mb-4">
                    {mode === 'pro' ? '手动+AI混合，精准控制输出' : '自定义选择，灵活调整'}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                      <Settings className="w-3.5 h-3.5" />
                      <span>分步执行</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="w-3.5 h-3.5" />
                      <span>精准控制</span>
                    </div>
                  </div>

                  <div className={`mt-5 py-2.5 px-4 rounded-xl text-center font-medium transition-all ${
                    mode === 'pro'
                      ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                      : 'bg-slate-100 text-slate-600 group-hover:bg-purple-50 group-hover:text-purple-600'
                  }`}>
                    {mode === 'pro' ? '→ 开始配置' : '选择此模式'}
                  </div>
                </div>
              </button>
            </div>

            {/* 模式内容 - 使用独立组件 */}
            {mode && (
              <div className="mt-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {mode === 'quick' && (
                  <QuickModePanel
                    inputContent={inputContent}
                    analysisResult={analysisResult}
                    preInfo={preInfo}
                  />
                )}
                {mode === 'pro' && (
                  <ProModePanel
                    inputContent={inputContent}
                    analysisResult={analysisResult}
                    preInfo={preInfo}
                    onGenerate={handleProGenerate}
                    onBack={onBack}
                    isGenerating={proIsGenerating}
                    setIsGenerating={setProIsGenerating}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'input' | 'insight' | 'creation' | 'settings'>('home');
  const [inputContent, setInputContent] = useState('');
  const preInfo = useSettingsStore((state) => state.preInfo);
  const setPreInfo = useSettingsStore((state) => state.setPreInfo);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [completedSteps, setCompletedSteps] = useState<number[]>([1]);

  const handleStartCreate = () => {
    setCurrentPage('input');
  };

  const handleStartAnalyze = (content: string, preInfo?: any) => {
    setInputContent(content);
    if (preInfo) {
      setPreInfo(preInfo);  // 保存前置信息到持久化存储
    }
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
    }
  };

  const handleBack = () => {
    if (currentPage === 'insight') {
      setCurrentPage('input');
    } else if (currentPage === 'creation') {
      setCurrentPage('insight');
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
    // 专业模式生成完成后，标记步骤完成并显示内容（留在创作页）
    setCompletedSteps(prev => [...prev, 3]);
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
          preInfo={preInfo}
        />
      )}
      {currentPage === 'creation' && (
        <ContentCreationPage
          inputContent={inputContent}
          analysisResult={analysisResult}
          preInfo={preInfo}
          onBack={handleBack}
          onNext={handleCreationNext}
          completedSteps={completedSteps}
          setCompletedSteps={setCompletedSteps}
          onStepClick={handleStepClick}
        />
      )}
      {currentPage === 'settings' && (
        <SettingsPage onBack={() => setCurrentPage('home')} />
      )}
    </>
  );
}

export default App;
