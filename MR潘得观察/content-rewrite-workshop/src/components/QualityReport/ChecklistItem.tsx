/**
 * 质检清单项组件
 * 支持 evidence 显示和点击定位
 */
import { CheckCircle, XCircle, AlertTriangle, MapPin } from 'lucide-react';
import type { ChecklistItem } from '../../types/quality';

interface ChecklistItemProps {
  item: ChecklistItem;
  onLocate?: (position?: string) => void;
}

const passedConfig: Record<string, { icon: typeof CheckCircle; bgColor: string; borderColor: string; iconColor: string; textColor: string }> = {
  true: { icon: CheckCircle, bgColor: 'bg-green-50', borderColor: 'border-green-200', iconColor: 'text-green-500', textColor: 'text-green-700' },
  false: { icon: XCircle, bgColor: 'bg-red-50', borderColor: 'border-red-200', iconColor: 'text-red-500', textColor: 'text-red-700' },
  partial: { icon: AlertTriangle, bgColor: 'bg-amber-50', borderColor: 'border-amber-200', iconColor: 'text-amber-500', textColor: 'text-amber-700' },
};

export function ChecklistItem({ item, onLocate }: ChecklistItemProps) {
  const passedKey = typeof item.passed === 'boolean' ? String(item.passed) : item.passed;
  const config = passedConfig[passedKey] || passedConfig.false;

  return (
    <div
      className={`p-3 rounded-lg border ${config.bgColor} ${config.borderColor}`}
    >
      <div className="flex items-start gap-3">
        <config.icon className={`w-5 h-5 ${config.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${config.textColor}`}>
            {item.name}
          </div>
          {item.reason && (
            <div className="text-xs text-slate-600 mt-0.5">
              判定：{item.reason}
            </div>
          )}
          {item.evidence && (
            <div className="mt-2 flex items-start gap-2">
              <div className="flex-1 text-xs text-slate-500 italic border-l-2 border-slate-300 pl-2">
                「{item.evidence}」
                {item.position && <span className="text-slate-400">（{item.position}）</span>}
              </div>
              {onLocate && (
                <button
                  onClick={() => onLocate(item.position)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors flex-shrink-0"
                  title="定位到正文"
                >
                  <MapPin className="w-3 h-3" />
                  定位
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
