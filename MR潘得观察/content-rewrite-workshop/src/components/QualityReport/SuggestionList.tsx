/**
 * 优化建议列表组件
 * 动态渲染建议列表
 */
import { Lightbulb } from 'lucide-react';
import { SuggestionCard } from './SuggestionCard';
import type { OptimizationSuggestion } from '../../types/quality';

interface SuggestionListProps {
  suggestions: OptimizationSuggestion[];
  onApply?: (suggestion: OptimizationSuggestion) => void;
}

export function SuggestionList({ suggestions, onApply }: SuggestionListProps) {
  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="text-sm text-slate-500 text-center py-4">
        暂无优化建议
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {suggestions.map((suggestion, index) => (
        <SuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          index={index}
          onApply={onApply}
        />
      ))}
    </div>
  );
}
