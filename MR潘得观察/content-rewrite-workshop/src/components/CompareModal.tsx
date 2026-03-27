import { useState } from 'react';
import { X, Check, AlertTriangle, ArrowRight, Scissors, Trash2 } from 'lucide-react';

interface FormatChange {
  original: string;
  formatted: string;
  reason: string;
}

interface RemovedSection {
  content: string;
  reason: string;
}

interface SlimStatistics {
  originalLength: number;
  slimmedLength: number;
  removedLength: number;
  removedPercentage: number;
}

interface CompareModalProps {
  isOpen: boolean;
  original: string;
  formatted: string;
  changes: FormatChange[];
  warnings: string[];
  // 精简相关（可选）
  slimmed?: string;
  removedSections?: RemovedSection[];
  statistics?: SlimStatistics;
  // 是否显示精简选项
  showSlimOption?: boolean;
  // 用户选择的模式
  mode?: 'format' | 'slim';
  onModeChange?: (mode: 'format' | 'slim') => void;
  // 操作回调
  onConfirm: (useSlimmed: boolean) => void;
  onUseOriginal: () => void;
  onCancel: () => void;
}

export function CompareModal({
  isOpen,
  original,
  formatted,
  changes,
  warnings,
  slimmed,
  removedSections = [],
  statistics,
  showSlimOption = false,
  mode = 'format',
  onModeChange,
  onConfirm,
  onUseOriginal,
  onCancel,
}: CompareModalProps) {
  const [activeSide, setActiveSide] = useState<'original' | 'formatted' | 'slimmed'>('formatted');

  if (!isOpen) return null;

  const hasChanges = changes.length > 0 || warnings.length > 0;
  const hasSlimData = slimmed && removedSections.length > 0;

  // 计算精简统计显示
  const getSlimStatText = () => {
    if (!statistics) return '';
    return `精简 ${statistics.removedLength} 字 (${(statistics.removedPercentage * 100).toFixed(0)}%)`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">模板格式预览</h3>
              <p className="text-sm text-slate-500">检测到格式变更，请确认版本</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* 精简模式选择 */}
        {showSlimOption && hasSlimData && onModeChange && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-amber-800 font-medium">检测到可精简内容</span>
                {statistics && (
                  <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full">
                    {getSlimStatText()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onModeChange('format')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    mode === 'format'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  仅格式化
                </button>
                <button
                  onClick={() => onModeChange('slim')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    mode === 'slim'
                      ? 'bg-amber-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  精简 + 格式化
                </button>
              </div>
            </div>
            {mode === 'slim' && removedSections.length > 0 && (
              <div className="mt-3 p-3 bg-white rounded-lg border border-amber-200">
                <div className="flex items-center gap-1.5 mb-2 text-amber-700">
                  <Trash2 className="w-4 h-4" />
                  <span className="text-sm font-medium">将被精简的内容：</span>
                </div>
                <div className="space-y-1.5">
                  {removedSections.map((section, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded whitespace-nowrap">
                        {section.reason}
                      </span>
                      <span className="text-slate-500 line-clamp-1 flex-1">
                        {section.content.substring(0, 60)}
                        {section.content.length > 60 ? '...' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 变更说明 */}
        {hasChanges && (
          <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
            <div className="flex flex-wrap gap-2">
              {changes.map((change, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                >
                  <Check className="w-3 h-3" />
                  {change.reason}
                </span>
              ))}
              {warnings.map((warning, i) => (
                <span
                  key={`w-${i}`}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full"
                >
                  <AlertTriangle className="w-3 h-3" />
                  {warning}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 对比区域 */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Tab 切换 */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveSide('original')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeSide === 'original'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              原版 ({original.length}字)
            </button>
            <button
              onClick={() => setActiveSide('formatted')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeSide === 'formatted'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              格式化版 ({formatted.length}字)
            </button>
            {hasSlimData && mode === 'slim' && (
              <button
                onClick={() => setActiveSide('slimmed')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeSide === 'slimmed'
                    ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center justify-center gap-1">
                  <Scissors className="w-3.5 h-3.5" />
                  精简版 ({slimmed?.length || 0}字)
                </span>
              </button>
            )}
          </div>

          {/* 内容 */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeSide === 'original' ? (
              <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 rounded-lg p-4 min-h-[200px]">
                {original || '(空)'}
              </pre>
            ) : activeSide === 'formatted' ? (
              <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono bg-green-50 rounded-lg p-4 min-h-[200px]">
                {formatted || '(空)'}
              </pre>
            ) : (
              <div>
                {/* 精简版内容 */}
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono bg-amber-50 rounded-lg p-4 min-h-[200px]">
                  {slimmed || '(空)'}
                </pre>
                {/* 被删除内容高亮 */}
                {removedSections.length > 0 && (
                  <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-1.5 mb-2 text-red-700">
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm font-medium">被精简的内容：</span>
                    </div>
                    <div className="space-y-2">
                      {removedSections.map((section, i) => (
                        <div key={i} className="text-xs">
                          <span className="inline-block px-1.5 py-0.5 bg-red-200 text-red-700 rounded mb-1">
                            {section.reason}
                          </span>
                          <div className="text-slate-600 bg-white/50 p-2 rounded border border-red-100">
                            <pre className="whitespace-pre-wrap break-all">{section.content}</pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div className="text-sm text-slate-500">
            <ArrowRight className="w-4 h-4 inline mr-1" />
            {mode === 'slim' ? '精简版已生成，请确认' : '选择要保存的版本'}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-all duration-200"
            >
              取消
            </button>
            <button
              onClick={onUseOriginal}
              className="px-4 py-2 text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-all duration-200 hover:shadow-sm"
            >
              使用原版
            </button>
            <button
              onClick={() => onConfirm(mode === 'slim')}
              className={`px-5 py-2.5 text-white rounded-lg transition-all duration-200 flex items-center gap-2 transform hover:scale-[1.02] active:scale-[0.98] ${
                mode === 'slim'
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/30 hover:shadow-xl hover:shadow-amber-600/40'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40'
              }`}
            >
              <Check className="w-4 h-4" />
              {mode === 'slim' ? '确认精简并保存' : '确认格式化'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
