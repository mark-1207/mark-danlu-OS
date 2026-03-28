---
id: douyin-title
name: 抖音标题生成
type: content-title
platform: douyin
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

## 核心黄金3秒公式（5个最有效类型）

【公式1：反常识开头】
"你以为______，其实______"
"很多人都不知道______"
示例："你以为努力就能成功？其实大多数人努力的方向都错了"

【公式2：强情绪开头】
"太扎心了！______"
"听完这段话，我沉默了..."
示例："太扎心了！原来我不是懒，是这个原因"

【公式3：悬念钩子开头】
"我终于知道为什么______了"
"最后那句话，让我破防了"
示例："听完这期播客，我终于知道为什么我总是焦虑了"

【公式4：身份锁定开头】
"30岁以上的人，建议认真看完"
"______的人，千万别划走"
示例："25岁到35岁的人，建议认真听完这段话"

【公式5：冲突对比开头】
"他月薪3000，却比我月薪3万过得好"
"同样是25岁，为什么她比我好"
示例："月薪3000和3万的人，差距根本不是能力"

---

## 禁止事项

❌ 自我介绍开头：如"大家好，我是XX"
❌ 废话铺垫：如"今天天气不错"
❌ 3秒内无重点：浪费黄金时间
❌ 标题党：内容与开头严重不符
❌ 过于平淡：无法激起情绪波动

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