/**
 * 统一进度条组件
 * 统一的渐变蓝、高度、动画样式
 */
// 简单的 className 合并工具
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

interface ProgressBarProps {
  progress: number; // 0-100
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ProgressBar({
  progress,
  showLabel = false,
  size = 'md',
  className
}: ProgressBarProps) {
  const heights = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn('flex-1 bg-slate-200 rounded-full overflow-hidden', heights[size])}>
        <div
          className={cn(
            'h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full',
            'transition-all duration-500 ease-out',
            'relative',
            size === 'lg' && 'after:absolute after:right-0 after:top-0 after:bottom-0 after:w-1 after:bg-white/50 after:animate-pulse'
          )}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-slate-500 w-12 text-right">
          {Math.round(progress)}%
        </span>
      )}
    </div>
  );
}

/**
 * 平台独立进度条组件
 * 用于 ProModePanel 多平台同时生成时的独立进度
 */
interface PlatformProgressBarProps {
  platformName: string;
  progress: number;
  status: 'pending' | 'generating' | 'completed' | 'error';
  platformColor?: 'blue' | 'pink' | 'cyan';
}

const platformColorMap = {
  blue: 'from-blue-500 to-blue-600',
  pink: 'from-pink-500 to-pink-600',
  cyan: 'from-cyan-500 to-cyan-600'
};

export function PlatformProgressBar({
  platformName,
  progress,
  status,
  platformColor = 'blue'
}: PlatformProgressBarProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-16 truncate">{platformName}</span>
      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            status === 'generating' ? platformColorMap[platformColor] : 'bg-slate-300',
            status === 'generating' && 'animate-pulse'
          )}
          style={{ width: `${status === 'pending' ? 0 : status === 'generating' ? progress : status === 'completed' ? 100 : 0}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 w-12 text-right">
        {status === 'generating' ? `${Math.round(progress)}%` : status === 'completed' ? '完成' : status === 'error' ? '失败' : '等待'}
      </span>
    </div>
  );
}
