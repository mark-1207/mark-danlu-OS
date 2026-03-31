# LLM 路由模块

负责根据任务类型选择合适的模型，并提供统一的调用接口。

## 模型路由策略

| 任务类型 | 模型 | 原因 |
|---------|------|------|
| evaluation | claude | 质量评估需要强判断力 |
| analyze | claude | 内容分析需要深度理解 |
| wechat | claude | 微信公众号深度长文 |
| xiaohongshu | claude | 小红书情绪共鸣 |
| twitter | deepseek | Twitter短平快 |
| search | deepseek | 搜索资料用便宜的 |

## API 配置

```typescript
const API_ENDPOINTS = {
  claude: 'https://api.anthropic.com/v1/messages',
  gpt: 'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  kimi: 'https://api.moonshot.cn/v1/chat/completions',
};
```

## 调用示例

```typescript
import { callLLM, getModelForTask } from './llm/router';

const model = getModelForTask('wechat');
const response = await callLLM(model, apiKey, [
  { role: 'user', content: 'your prompt' }
]);
```

## 六维度评分权重

```typescript
const DIMENSION_WEIGHTS = {
  emotion: 0.25,
  utility: 0.25,
  narrative: 0.20,
  socialCurrency: 0.15,
  controversy: 0.10,
  timeliness: 0.05,
};
```

## 决策路径

| 总分 | 路径 | 操作 |
|------|------|------|
| ≥80 | A | 直接适配 |
| 60-79 | B | 优化后适配 |
| <60 | C | 建议重构 |
