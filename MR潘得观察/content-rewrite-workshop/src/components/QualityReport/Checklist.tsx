/**
 * 质检清单组件
 * 动态渲染清单列表
 */
import { ChecklistItem } from './ChecklistItem';
import type { ChecklistItem as ChecklistItemType } from '../../../types/quality';

interface ChecklistProps {
  items: ChecklistItemType[];
  onLocate?: (position?: string) => void;
}

export function Checklist({ items, onLocate }: ChecklistProps) {
  if (!items || items.length === 0) {
    return (
      <div className="text-sm text-slate-500 text-center py-4">
        暂无质检清单
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <ChecklistItem key={item.id} item={item} onLocate={onLocate} />
      ))}
    </div>
  );
}
