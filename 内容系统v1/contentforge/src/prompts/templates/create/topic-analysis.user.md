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

{{#if competitorInsights}}
---
## 竞品参考素材

以下是系统中已有的竞品分析数据，供你参考差异化方向：

**竞品已覆盖角度**：
{{#each competitorInsights.coveredAngles}}
- [{{platform}}] {{angle}}（来源：{{sourceTitle}}）
{{/each}}

{{#if competitorInsights.opportunityAngles}}
**空白机会角度**：
{{#each competitorInsights.opportunityAngles}}
- {{angle}}：{{whyOpportunity}}
{{/each}}
{{/if}}

**差异化建议**：{{competitorInsights.warning}}
{{/if}}
