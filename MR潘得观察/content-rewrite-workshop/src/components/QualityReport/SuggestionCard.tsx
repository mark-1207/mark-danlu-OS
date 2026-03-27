/**
 * 优化建议卡组件
 * 支持展开/收起，展示原文优化对照
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { OriginalOptimizedCompare } from './OriginalOptimizedCompare';
import type { OptimizationSuggestion } from '../../types/quality';

interface SuggestionCardProps {
  suggestion: OptimizationSuggestion;
  index: number;
  onApply?: (suggestion: OptimizationSuggestion) => void;
}

const priorityConfig: Record<string, { label: string; bgColor: string; textColor: string }> = {
  high: { label: '高优', bgColor: 'bg-red-100', textColor: 'text-red-700' },
  medium: { label: '中优', bgColor: 'bg-orange-100', textColor: 'text-orange-700' },
  low: { label: '低优', bgColor: 'bg-slate-100', textColor: 'text-slate-600' },
};

export function SuggestionCard({ suggestion, index, onApply }: SuggestionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { label, bgColor, textColor } = priorityConfig[suggestion.priority] || priorityConfig.medium;

  const hasCompare = suggestion.original || suggestion.optimized;

  return (
    <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 card-hover">
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 w-5 h-5 bg-amber-200 text-amber-700 rounded-full text-xs flex items-center justify-center font-medium">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="text-sm text-amber-800 font-medium">
                {suggestion.content}
              </div>
              {suggestion.position && (
                <div className="text-xs text-amber-600 mt-0.5">
                  位置：{suggestion.position}
                </div>
              )}
            </div>
            <span className={`${bgColor} ${textColor} text-xs px-2 py-0.5 rounded-full flex-shrink-0`}>
              {label}
            </span>
          </div>

          {/* 展开/收起按钮 */}
          {hasCompare && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  收起详情
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  查看详情
                </>
              )}
            </button>
          )}

          {/* 展开内容 */}
          {expanded && hasCompare && (
            <div className="mt-3">
              <OriginalOptimizedCompare
                original={suggestion.original}
                optimized={suggestion.optimized}
                logic={suggestion.logic}
              />
              {onApply && suggestion.optimized && (
                <button
                  onClick={() => onApply(suggestion)}
                  className="mt-3 w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  应用到正文
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
