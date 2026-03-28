---
id: gzh-title
name: 公众号标题生成
type: content-title
platform: gzh
variables:
  - contentType
  - content
  - audience
  - keywords
  - emotion
  - contentStructure
  - valuePoints
  - highlightClips
outputFormat: json
---

【内容类型】{contentType}
【原文核心主题】{content}
【目标受众】{audience}
【关键词】{keywords}
【情绪基调】{emotion}
【内容结构】{contentStructure}
【核心价值点】{valuePoints}
【高光片段】{highlightClips}

---

## 核心标题公式（5个最爆款类型）

【公式1：颠覆认知型】
结构：你以为的X，其实是Y
示例：《你以为的稳定，其实是最危险的状态》
适用：认知类、成长类、职场类

【公式2：痛点共鸣型】
结构：痛点场景 + 解决方案暗示
示例：《30岁还一事无成？你缺的不是努力，是这3个认知》
适用：情感类、职场类、心理类

【公式3：悬念钩子型】
结构：不说透，留悬念
示例：《那个从来不加班的同事，后来怎么样了》
适用：故事类、人物类、经历类

【公式4：数字清单型】
结构：数字 + 价值承诺
示例：《5个微习惯，让我从拖延症变成行动派》
适用：干货类、方法类

【公式5：身份标签型】
结构：人群标签 + 专属内容
示例：《内向者的社交指南：不必变外向，也能有好人缘》
适用：垂直人群、细分领域

---

## 禁止事项

❌ 标题党：与内容严重不符，欺骗点击
❌ 绝对化词汇：必须、一定、所有人、都来看
❌ 过时热点：使用了不再流行的话题/梗
❌ 过于宽泛：如"分享我的经验"、"我的心得"
❌ 虚假悬念：如"震惊！"、"刚刚发生！"

---

## 输出格式

严格按以下JSON格式输出，禁止额外说明：

{
  "titles": [
    { "text": "标题", "type": "公式类型", "reason": "为什么能爆" },
    { "text": "标题", "type": "公式类型", "reason": "为什么能爆" }
  ],
  "recommended": "主推标题"
}

---

生成5个标题，每个公式至少1个。