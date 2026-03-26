import { useState } from 'react';
import { X, Check, AlertTriangle, ArrowRight } from 'lucide-react';

interface FormatChange {
  original: string;
  formatted: string;
  reason: string;
}

interface CompareModalProps {
  isOpen: boolean;
  original: string;
  formatted: string;
  changes: FormatChange[];
  warnings: string[];
  onConfirm: () => void;
  onUseOriginal: () => void;
  onCancel: () => void;
}

export function CompareModal({
  isOpen,
  original,
  formatted,
  changes,
  warnings,
  onConfirm,
  onUseOriginal,
  onCancel,
}: CompareModalProps) {
  const [activeSide, setActiveSide] = useState<'original' | 'formatted'>('formatted');

  if (!isOpen) return null;

  const hasChanges = changes.length > 0 || warnings.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">格式化预览</h3>
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
              原版
            </button>
            <button
              onClick={() => setActiveSide('formatted')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeSide === 'formatted'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              格式化版
            </button>
          </div>

          {/* 内容 */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeSide === 'original' ? (
              <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 rounded-lg p-4 min-h-[200px]">
                {original || '(空)'}
              </pre>
            ) : (
              <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono bg-green-50 rounded-lg p-4 min-h-[200px]">
                {formatted || '(空)'}
              </pre>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div className="text-sm text-slate-500">
            <ArrowRight className="w-4 h-4 inline mr-1" />
            选择要保存的版本
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={onUseOriginal}
              className="px-4 py-2 text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
            >
              使用原版
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              确认格式化
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
