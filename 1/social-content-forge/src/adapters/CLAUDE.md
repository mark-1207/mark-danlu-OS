# 平台适配器模块

将原子内容块和内容解码报告适配为各平台特定格式。

## 平台适配器列表

| 平台 | 适配器 | 目标字数 | 核心特点 |
|------|--------|---------|---------|
| 微信公众号 | `wechat/index.ts` | 1500-2500字 | 深度长文，方法论+案例+金句 |
| 小红书 | `xiaohongshu/index.ts` | 600-1000字 | 情绪共鸣，个人体验，种草感 |
| Twitter | `twitter/index.ts` | 100-280字 | 观点鲜明，可扩展为Thread |

## PlatformAdapter 接口

```typescript
interface PlatformAdapter {
  platform: Platform;           // 'wechat' | 'xiaohongshu' | 'twitter'
  name: string;
  targetLength: {
    min: number;
    max: number;
    optimal: number;
  };

  // 适配内容
  adapt(atoms: ContentAtom[], context: ContentContext): Promise<AdaptedContent>;

  // 自检清单
  checklist(content: AdaptedContent): CheckResult;
}
```

## 使用示例

```typescript
import { adaptWechat, adaptXiaohongshu, adaptTwitter } from './adapters';

const wechatContent = await adaptWechat(atoms, context, llmCall);
const xiaohongshuContent = await adaptXiaohongshu(atoms, context, llmCall);
const twitterContent = await adaptTwitter(atoms, context, llmCall);
```

## 各平台内容要求

### 微信公众号
- 标题：8-30字，有钩子（数字/对比/悬念）
- 开头：情绪场景引入
- 正文：方法论 → 案例 → 金句
- 结尾：行动号召或互动问题

### 小红书
- 标题：加emoji，更吸睛
- 封面文字：简洁有悬念
- 标签：3-5个高热度话题
- 开头："我"的体验感
- 正文：干货 + 个人经历

### Twitter/X
- 前3字必须抓人
- 核心观点鲜明
- 可拆分为Thread
- 立场明确，引发共鸣或争议
