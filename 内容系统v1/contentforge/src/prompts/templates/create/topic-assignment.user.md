以下是主题深挖分析的结果，请基于此为三个平台分配差异化选题：

{{topicAnalysis}}

{{#if excludeDirections}}
注意：请排除以下方向，AI 选题时请勿涉及这些子话题：
{{excludeDirections}}
{{/if}}

请按照要求输出 JSON 格式的选题分配结果。JSON Schema:
{
  "wechat": {
    "platform": "wechat",
    "angle": "string",
    "titleDrafts": ["string", "string", "string"],
    "coreArgument": "string",
    "targetAudience": "string",
    "tone": "string",
    "wordCountRange": [2000, 3000],
    "contentType": "string",
    "emotionalGoal": "string"
  },
  "xiaohongshu": { /* 同上结构 */ },
  "douyin": { /* 同上结构 */ },
  "overlapAnalysis": "string"
}
