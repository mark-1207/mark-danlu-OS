---
id: xhs-title
name: 小红书标题生成
type: content-title
platform: xhs
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

## 核心标题公式（5个最有效类型）

【公式1：痛点+解决方案】
"被拖延症困扰多年，这3个方法救了我"
"社恐20年，终于学会这样社交"
适用：干货、方法、改变类

【公式2：身份+专属内容】
"建议所有内向者都去试试"
"打工人必看！职场保命指南"
适用：特定人群、垂直领域

【公式3：情绪+共鸣】
"深夜听完这段，我哭了3页笔记"
"谁懂啊！这段话说到我心里"
适用：情感、共鸣、故事类

【公式4：数字+价值】
"听完100期播客，我总结了5个认知"
"读了30本书，这3本改变了我"
适用：书单、干货、清单类

【公式5：悬念+反转】
"原来我一直理解错了，真正的自律是这样的"
"听了这段话才明白，为什么我总是焦虑"
适用：认知颠覆、反常识类

---

## 禁止事项

❌ 生僻字：读者看不懂的字
❌ 过长标题：超过25字会被折叠
❌ 标题党：与内容严重不符
❌ 过度夸张："震惊！"、"必看！"（已免疫）
❌ 虚假悬念：如"刚刚发生！"、"真相是……"

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