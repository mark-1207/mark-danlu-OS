请对以下二创文章进行双重审查：

【原文】
{{originalArticle}}

【二创文章】
{{recreationArticle}}

请严格按照 JSON Schema 输出审查结果。如果原创度不达标（overallScore < 8 或有 high severity 问题），请在 flaggedParagraphs 中标记需要重写的段落。

**重要**：如果原创度达标（passThreshold=true），请同时评估各维度的爆款潜力评分。如果标题吸引力<8、开头留存率<7、情绪调动力<7、互动引导力<7、金句密度不足、或案例描述空洞，请在 optimizationTriggers 中输出对应的优化操作触发器，以便后续进行局部优化。
