/**
 * 整体评分卡组件
 * 展示综合评分和等级
 */
import { Star } from 'lucide-react';

interface OverallScoreCardProps {
  score: number;
  grade: 'excellent' | 'good' | 'average' | 'poor';
}

const gradeConfig = {
  excellent: { label: '爆款潜质', stars: 3, color: 'text-amber-500', bgColor: 'bg-amber-50' },
  good: { label: '优质内容', stars: 2, color: 'text-green-500', bgColor: 'bg-green-50' },
  average: { label: '合格内容', stars: 1, color: 'text-blue-500', bgColor: 'bg-blue-50' },
  poor: { label: '需优化', stars: 0, color: 'text-red-500', bgColor: 'bg-red-50' },
};

export function OverallScoreCard({ score, grade }: OverallScoreCardProps) {
  const config = gradeConfig[grade] || gradeConfig.average;

  return (
    <div className={`${config.bgColor} rounded-xl p-4 border border-opacity-20`}>
      <div className="text-sm font-medium text-slate-700 mb-3">整体评分</div>
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-slate-900">{score.toFixed(1)}</span>
          <span className="text-lg text-slate-400">/10</span>
        </div>
        <div className="text-right">
          <div className={`${config.color} text-lg font-medium mb-1`}>
            {'⭐'.repeat(config.stars)}
          </div>
          <div className={`text-sm font-medium ${config.color}`}>
            {config.label}
          </div>
        </div>
      </div>
    </div>
  );
}
