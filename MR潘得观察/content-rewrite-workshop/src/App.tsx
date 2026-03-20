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
} from 'lucide-react';
import './App.css';
import OptimizationReportPage from './components/OptimizationReportPage';
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

  // 前置信息状态
  const [preInfo, setPreInfo] = useState<PreContentInfo>({
    platform: '',
    contentType: '',
    track: '',
    likes: 0,
    collectCount: 0,
    viewCount: 0,
    shareCount: 0,
  });

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
            <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-medium text-slate-800 mb-4 flex items-center gap-2">
                <span className="text-blue-600">前置信息</span>
                <span className="text-xs text-slate-400 font-normal">（选填，但填写后生成内容更精准）</span>
              </h3>

              <div className="grid grid-cols-3 gap-4">
                {/* 内容平台 */}
                <div>
                  <label className="block text-sm text-slate-600 mb-1.5">内容平台</label>
                  <select
                    value={preInfo.platform}
                    onChange={(e) => setPreInfo({ ...preInfo, platform: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
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
                  <label className="block text-sm text-slate-600 mb-1.5">内容类型</label>
                  <input
                    type="text"
                    value={preInfo.contentType}
                    onChange={(e) => setPreInfo({ ...preInfo, contentType: e.target.value })}
                    placeholder="例：1分钟口播短视频"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* 所属赛道 */}
                <div>
                  <label className="block text-sm text-slate-600 mb-1.5">所属赛道</label>
                  <input
                    type="text"
                    value={preInfo.track}
                    onChange={(e) => setPreInfo({ ...preInfo, track: e.target.value })}
                    placeholder="例：情感-亲密关系"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 核心数据 */}
              <div className="mt-4">
                <label className="block text-sm text-slate-600 mb-1.5">核心数据（选填）</label>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">获赞数</label>
                    <input
                      type="number"
                      value={preInfo.likes || ''}
                      onChange={(e) => setPreInfo({ ...preInfo, likes: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">收藏数</label>
                    <input
                      type="number"
                      value={preInfo.collectCount || ''}
                      onChange={(e) => setPreInfo({ ...preInfo, collectCount: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">播放数</label>
                    <input
                      type="number"
                      value={preInfo.viewCount || ''}
                      onChange={(e) => setPreInfo({ ...preInfo, viewCount: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">转发数</label>
                    <input
                      type="number"
                      value={preInfo.shareCount || ''}
                      onChange={(e) => setPreInfo({ ...preInfo, shareCount: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 输入原文区域 */}
            <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <span className="font-medium text-slate-700">输入原文</span>
              </div>
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
                <div className={`text-sm font-medium ${getCharCountColor()}`}>
                  {getCharCountText()}
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

              {/* 开始分析按钮 + 字数限制提示 */}
              <div className="flex items-center gap-3">
                {content.trim() && !isValidLength && (
                  <span className={`text-sm ${isTooShort ? 'text-amber-500' : 'text-red-500'}`}>
                    {isTooShort ? `内容至少需要 ${MIN_CHARS} 字，当前 ${charCount} 字` : `内容不能超过 ${MAX_CHARS} 字，当前 ${charCount} 字`}
                  </span>
                )}
                <button
                  onClick={() => onStartAnalyze(content, preInfo)}
                  disabled={!content.trim() || !isValidLength}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
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
  const [proIsGenerating, setProIsGenerating] = useState(false);

  // 专业模式生成完成后的回调
  const handleProGenerate = (data: any) => {
    setCompletedSteps(prev => [...prev, 3]);
    onNext({ ...data, mode: 'pro' });
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
                  onClick={() => setMode('pro')}
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

            {/* 模式内容 - 使用独立组件 */}
            {mode && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
  const [currentPage, setCurrentPage] = useState<'home' | 'input' | 'insight' | 'creation' | 'optimization' | 'settings'>('home');
  const [inputContent, setInputContent] = useState('');
  const preInfo = useSettingsStore((state) => state.preInfo);
  const setPreInfo = useSettingsStore((state) => state.setPreInfo);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [completedSteps, setCompletedSteps] = useState<number[]>([1]);
  const [generationResult, setGenerationResult] = useState<any>(null);

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
