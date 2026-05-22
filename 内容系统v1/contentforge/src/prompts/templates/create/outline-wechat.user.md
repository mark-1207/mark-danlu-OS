请基于以下选题卡片，生成公众号文章大纲。

{{#if cognitiveTension}}
【认知张力设计 — 必须先提炼再生成大纲】
在生成大纲之前，必须先从 topicCard 中提炼认知张力：
- 大众以为：{{cognitiveTension.popularBelief}}（默认观点）
- 现实是：{{cognitiveTension.reality}}（反直觉/真相）

整个大纲必须围绕这个认知张力设计：每段的论证路径必须与"大众以为"的路径不同，制造认知落差。
{{/if}}

{{topicCard}}

{{#if materials}}
【参考素材】
{{materials}}

请浏览以上素材，在大纲中规划知识迁移——找到素材与论点的结构相似性，在合适的 section 中设置 knowledgeTransfer。
{{/if}}

请严格按照 JSON Schema 输出。
