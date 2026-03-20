import { useState } from 'react';
import { X } from 'lucide-react';
import { PROVIDER_LIST, type ProviderConfig, type AIProvider } from '../services/llm/types';

interface ProviderEditFormProps {
  provider: ProviderConfig;
  onSave: (updates: Partial<ProviderConfig>) => void;
  onCancel: () => void;
}

export function ProviderEditForm({ provider, onSave, onCancel }: ProviderEditFormProps) {
  const [formData, setFormData] = useState<Partial<ProviderConfig>>({
    name: provider.name,
    provider: provider.provider,
    apiKey: provider.apiKey,
    model: provider.model,
    temperature: provider.temperature,
    baseUrl: provider.baseUrl,
    isEnabled: provider.isEnabled,
  });

  const selectedProviderInfo = PROVIDER_LIST.find(p => p.id === formData.provider);

  const handleSubmit = () => {
    if (!formData.name || !formData.apiKey || !formData.model) return;
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">编辑供应商</h3>
          <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              供应商类型
            </label>
            <select
              value={formData.provider}
              onChange={(e) => {
                const info = PROVIDER_LIST.find(p => p.id === e.target.value);
                setFormData({
                  ...formData,
                  provider: e.target.value as AIProvider,
                  model: info?.defaultModel || '',
                  baseUrl: info?.id === 'custom' ? '' : info?.baseUrl,
                });
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              {PROVIDER_LIST.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              显示名称
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              API Key
            </label>
            <input
              type="password"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder="sk-xxx..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              模型
            </label>
            <input
              type="text"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              placeholder={selectedProviderInfo?.defaultModel || 'gpt-4o'}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          {formData.provider === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Base URL
              </label>
              <input
                type="text"
                value={formData.baseUrl}
                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                placeholder="https://api.example.com/v1"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              温度 (0-2)
            </label>
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formData.name || !formData.apiKey || !formData.model}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
