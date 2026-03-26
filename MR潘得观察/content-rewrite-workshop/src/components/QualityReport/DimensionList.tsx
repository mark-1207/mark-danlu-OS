/**
 * 维度列表组件
 * 动态渲染任意维度的列表
 */
import { DimensionBar } from './DimensionBar';
import type { Dimension } from '../../types/quality';

interface DimensionListProps {
  dimensions: Dimension[];
}

export function DimensionList({ dimensions }: DimensionListProps) {
  if (!dimensions || dimensions.length === 0) {
    return (
      <div className="text-sm text-slate-500 text-center py-4">
        暂无维度数据
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {dimensions.map((dimension) => (
        <DimensionBar key={dimension.id} dimension={dimension} />
      ))}
    </div>
  );
}
