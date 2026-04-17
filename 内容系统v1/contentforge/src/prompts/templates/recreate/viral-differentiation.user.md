请基于以下爆款基因图谱，生成差异化的二创方向：

{{viralGenome}}

{{#if mode}}Mode: {{mode}}{{/if}}

**注意**：
- 请确保每个方向的 `structuralCommitment`（段落逻辑链）与原文的 `narrativeStructure[].argumentativePath` 不同
- 请同时参考 `forbiddenExpressions`，确保二创方向不会被迫使用那些禁止表达

请生成 3-5 个方向。
{{#if interactive}}
**交互模式**：不要自动选择方向，只需返回所有方向列表，selectedDirection 设为 null。
{{else}}
并自动选择综合评分最高的方向。
{{/if}}

严格按照 JSON Schema 输出。
