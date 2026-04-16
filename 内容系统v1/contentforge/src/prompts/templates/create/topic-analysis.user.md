请对以下关键词/主题进行深度挖掘分析：

关键词/主题：{{keyword}}

{{#if userContext}}
用户补充说明：{{userContext}}
{{/if}}

{{#if excludeDirections}}
请排除以下方向：{{excludeDirections}}
{{/if}}

请按照要求输出 JSON 格式的分析结果。JSON Schema:
{
  "keyword": "string",
  "subTopics": [{ "name": "string", "description": "string", "heatLevel": "high|medium|low" }],
  "painPoints": [{ "description": "string", "targetAudience": "string", "emotionalTrigger": "string" }],
  "trendingAngles": [{ "angle": "string", "whyTrending": "string", "suitablePlatforms": ["string"] }],
  "controversies": [{ "topic": "string", "sideA": "string", "sideB": "string" }],
  "targetDemographics": [{ "group": "string", "interests": ["string"], "contentPreferences": ["string"] }]
}
