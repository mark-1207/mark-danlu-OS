import { useState } from 'react';
import { Send, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { type ProviderConfig, type Message } from '../services/llm/types';
import { llmManager } from '../services/llm/manager';
import { useSettingsStore } from '../stores/settingsStore';

interface ApiDebugPanelProps {
  provider: ProviderConfig;
}

export function ApiDebugPanel({ provider }: ApiDebugPanelProps) {
  const { ai } = useSettingsStore();
  const [testPrompt, setTestPrompt] = useState('你好，请用一句话介绍你自己');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const messages: Message[] = [{ role: 'user', content: testPrompt }];
      const response = await llmManager.chat(
        messages,
        [provider],
        ai.failover,
        { model: provider.model }
      );

      setResult({
        success: true,
        message: response.content,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';

      // 提供更友好的错误建议
      let suggestion = '';
      if (errorMessage.includes('401') || errorMessage.includes('invalid')) {
        suggestion = '建议：检查 API Key 是否正确，或是否已过期';
      } else if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
        suggestion = '建议：检查 API Key 是否有权限，或 Base URL 是否正确';
      } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        suggestion = '建议：检查模型名称是否正确，Base URL 是否正确';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        suggestion = '建议：检查网络连接，或尝试使用中转站';
      } else if (errorMessage.includes('rate limit')) {
        suggestion = '建议：稍后再试，或联系供应商增加限流';
      }

      setResult({
        success: false,
        message: `${errorMessage}${suggestion ? '\n\n' + suggestion : ''}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
      <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
        <Send className="w-4 h-4" />
        API 调试
      </h4>

      <div className="space-y-3">
        <div>
          <label className="block text-sm text-slate-600 mb-1">测试 Prompt</label>
          <textarea
            value={testPrompt}
            onChange={(e) => setTestPrompt(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            rows={3}
            placeholder="输入测试内容..."
          />
        </div>

        <button
          onClick={handleTest}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              测试中...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              发送测试请求
            </>
          )}
        </button>

        {result && (
          <div className={`p-3 rounded-lg ${
            result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-start gap-2">
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className={`text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                {result.success ? '✓ 连接成功' : '✗ 连接失败'}
                {result.message && (
                  <pre className="mt-2 whitespace-pre-wrap font-mono text-xs bg-white/50 p-2 rounded">
                    {result.message}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-slate-500">
          <p>当前配置:</p>
          <p>模型: {provider.model}</p>
          {provider.baseUrl && <p>Base URL: {provider.baseUrl}</p>}
        </div>
      </div>
    </div>
  );
}
