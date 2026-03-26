/**
 * 维度条形组件
 * 展示单个维度的得分条形图
 */
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import type { Dimension } from '../../types/quality';

interface DimensionBarProps {
  dimension: Dimension;
}

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; bgColor: string }> = {
  pass: { icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-500' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bgColor: 'bg-amber-500' },
  fail: { icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500' },
};

export function DimensionBar({ dimension }: DimensionBarProps) {
  const { icon: StatusIcon, color, bgColor } = statusConfig[dimension.status];
  const percentage = (dimension.score / dimension.maxScore) * 100;

  return (
    <div className="flex items-start gap-3 py-2">
      <StatusIcon className={`w-4 h-4 ${color} flex-shrink-0 mt-1`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-slate-700 truncate">
            {dimension.name}
          </span>
          <span className="text-sm text-slate-500 ml-2 flex-shrink-0">
            {dimension.score}/{dimension.maxScore}
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${bgColor} rounded-full transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {dimension.reason && (
          <div className="text-xs text-slate-500 mt-1 line-clamp-1">
            {dimension.reason}
          </div>
        )}
      </div>
    </div>
  );
}
