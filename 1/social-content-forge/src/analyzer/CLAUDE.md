# Analyzer 模块

内容理解器。负责对原始内容进行深度解码，拆解为结构化的原子内容块。

## 核心职责

1. 解析原始内容（文本/HTML）
2. 识别内容意图和结构
3. 提取情绪图谱
4. 识别价值主张
5. 解码叙事结构
6. 提取病毒元素
7. 拆解为原子内容块

## 输出格式

### 内容解码报告
```json
{
  "intent": {
    "coreClaim": "一句话核心主张",
    "targetReader": "目标读者描述",
    "expectedReaction": "预期读者反应"
  },
  "emotionMap": {
    "primaryEmotion": "焦虑|兴奋|愤怒|共鸣|好奇",
    "emotionCurve": ["好奇", "焦虑", "兴奋", "共鸣"],
    "anchorPoints": ["开头场景", "踩坑经历", "金句"]
  },
  "valueClaims": {
    "practical": ["具体方法1", "具体方法2"],
    "cognitive": ["颠覆认知1"],
    "social": ["转发彰显什么"]
  },
  "narrativeStructure": {
    "type": "英雄之旅|问题-方案|对比反差|揭秘揭示",
    "hasHook": true,
    "hasEnding": true,
    "storyElements": ["人物", "冲突", "解决"]
  },
  "viralElements": {
    "sharableQuotes": ["独立可传播的金句"],
    "controversialPoints": ["争议观点"],
    "dataAnchors": ["具体数字"],
    "identity认同": ["打工人", "创业者"]
  }
}
```

### 原子内容块
```json
{
  "id": "uuid",
  "type": "观点|金句|案例|数据|故事|方法论",
  "content": "原始内容",
  "viralElements": ["情绪共鸣", "实用价值"],
  "platformSuitability": ["wechat", "xiaohongshu"],
  "reusability": "high|medium|low"
}
```

## 分析深度

MVP阶段简化处理：
- 快速分析（5秒内）：提取核心观点 + 基础结构
- 不做复杂的跨段落语义关联分析
- 金句提取依赖关键词模式匹配（引号、序号、高亮）

## LLM调用

- 使用 Claude/GPT 进行深度分析
- 输入：原始内容（500-5000字）
- 输出：JSON格式的解码报告 + 原子块数组

## 依赖

- 输入：原始内容（字符串或HTML）
- 输出：decodedReport.json + atoms.json
- 依赖外部：Claude/GPT API
