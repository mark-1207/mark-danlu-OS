/**
 * 骨架屏卡片组件
 * 用于流式生成中的脉冲占位动画
 */

interface SkeletonCardProps {
  variant?: 'gzh' | 'xhs' | 'douyin';
  showContent?: boolean; // 是否显示内容骨架
}

const variantColors = {
  gzh: 'from-blue-50 to-indigo-50 border-blue-100',
  xhs: 'from-pink-50 to-rose-50 border-pink-100',
  douyin: 'from-cyan-50 to-sky-50 border-cyan-100'
};

const variantIcons = {
  gzh: 'bg-blue-500',
  xhs: 'bg-pink-500',
  douyin: 'bg-cyan-500'
};

// 骨架屏脉冲动画
function SkeletonPulse({ className }: { className: string }) {
  return (
    <div className={`${className} animate-pulse rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]`} />
  );
}

// 脉冲动画样式（通过 style 标签注入）
const shimmerKeyframes = `
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;

export function SkeletonCard({ variant = 'gzh', showContent = true }: SkeletonCardProps) {
  return (
    <>
      {/* 注入脉冲动画样式 */}
      <style>{shimmerKeyframes}</style>

      <div className={`p-4 bg-gradient-to-br ${variantColors[variant]} rounded-xl border ${variantColors[variant].split(' ')[1]} flex flex-col`}>
        {/* 头部 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 ${variantIcons[variant]} rounded-lg flex items-center justify-center`}>
              <div className="w-4 h-4 rounded bg-white/50" />
            </div>
            <SkeletonPulse className="w-16 h-4" />
          </div>
          <SkeletonPulse className="w-12 h-5 rounded-full" />
        </div>

        {/* 内容区 */}
        <div className="flex-1 mb-3 space-y-2">
          {showContent ? (
            <>
              <SkeletonPulse className="w-full h-4" />
              <SkeletonPulse className="w-3/4 h-4" />
            </>
          ) : (
            <div className="text-sm text-slate-500">正在生成中...</div>
          )}
        </div>

        {/* 按钮区 */}
        <div className="flex gap-2 mb-3">
          <SkeletonPulse className="flex-1 h-8 rounded-lg" />
          <SkeletonPulse className="flex-1 h-8 rounded-lg" />
        </div>

        {/* 进度条 */}
        <div className="mt-auto">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>生成进度</span>
            <span className="tabular-nums">0%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full animate-pulse"
              style={{ width: '30%' }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * 文本骨架屏组件
 * 用于单行或多行文本的骨架占位
 */
export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <>
      <style>{shimmerKeyframes}</style>
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonPulse
            key={i}
            className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
          />
        ))}
      </div>
    </>
  );
}

/**
 * 标题骨架屏组件
 */
export function SkeletonTitle({ className = '' }: { className?: string }) {
  return (
    <>
      <style>{shimmerKeyframes}</style>
      <div className={`space-y-2 ${className}`}>
        <SkeletonPulse className="w-2/3 h-6" />
        <SkeletonPulse className="w-1/2 h-4" />
      </div>
    </>
  );
}
