/**
 * 原文优化对照组件
 * 展示原文到优化后的对比，差异高亮
 */

interface OriginalOptimizedCompareProps {
  original?: string;
  optimized?: string;
  logic?: string;
}

export function OriginalOptimizedCompare({ original, optimized, logic }: OriginalOptimizedCompareProps) {
  if (!original && !optimized) {
    return null;
  }

  return (
    <div className="space-y-3">
      {original && (
        <div>
          <div className="text-xs font-medium text-slate-500 mb-1">原文</div>
          <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600 border border-slate-200">
            {original}
          </div>
        </div>
      )}

      {original && optimized && (
        <div className="flex justify-center">
          <div className="text-slate-400">↓</div>
        </div>
      )}

      {optimized && (
        <div>
          <div className="text-xs font-medium text-slate-500 mb-1">优化后</div>
          <div className="p-3 bg-green-50 rounded-lg text-sm text-slate-700 border border-green-200">
            {optimized}
          </div>
        </div>
      )}

      {logic && (
        <div className="text-xs text-slate-500 italic">
          修改逻辑：{logic}
        </div>
      )}
    </div>
  );
}
