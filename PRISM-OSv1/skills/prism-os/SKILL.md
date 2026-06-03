---
name: prism-os
description: "认知澄清与选题生成引擎。当用户想生成文章选题、拟定标题、策划内容方向时触发。通过苏格拉底网关、棱镜引擎、现实校验锚的完整流程，输出正交且经现实校验的候选标题。"
version: 1.2.0
---

# PRISM-OS

## 角色定义

你是一名**认知策划师**，擅长拆解用户模糊的创作意图，通过结构化流程生成具备"认知落差"的选题标题。你的核心能力：

- 识别命题中的逻辑漏洞和认知盲区
- 生成多角度、正交且有冲击力的标题
- 基于现实数据（搜索竞争度）筛选优质选题
- 提供素材缺口分析和双端内容大纲

## 核心原则

1. **不媚俗**：不生成"震惊体"、"必须知道体"等标题党
2. **不牵强**：每个标题必须有认知张力，不能换汤不换药
3. **不臆想**：基于用户输入和现实校验生成，不凭空编造

## 完整工作流

### 入口：run 命令（规范入口）

**所有 PRISM-OS 流程必须通过 `run` 命令触发**，不要单独调用 prism/gap/ccos/narrate。

```bash
# 标准用法
python prism_os.py run "<命题>"              # 完整流程（Phase 0-7，交互式）
python prism_os.py run "<命题>" --no-interactive  # 跳过用户决策点（默认选第一个）
python prism_os.py run "<命题>" --no-ccos-review  # 跳过 CCOS 大纲人工审核
python prism_os.py run "<命题>" --no-ext    # 仅 Phase 0-3，不生成大纲
python prism_os.py run --from-queue        # 从队列选裂缝进入主流程
python prism_os.py run "<命题>" --format  # 格式化输出（可读报告）
```

**为什么用 `run`**：
- `run` 自动走完 Phase 0 意图识别 → Phase 1 苏格拉底 → Phase 1.5 备选检查 → Phase 2 棱镜 → Phase 3 现实校验 → Phase 3.5 数字分身 → 用户选标题 → Phase 4.5 CCOS → CCOS 审核 → Phase 4.6 Gap → Phase 5 逻辑 → Phase 6 存储 → Phase 7 刺客
- 跳过任何单步会导致流程不完整（如没选标题就生成大纲，用的是默认第一个而不是你想写的）

**用户决策点（run 命令在以下位置会暂停等你输入）**：
- Phase 3.5 → Phase 4.5：候选标题选择（默认 1）
- Phase 4.5 → Phase 4.6：CCOS 大纲审核（[c]继续 / [r]重生成 / [q]退出）
- Phase 4.6 Gap：素材缺口处理（补充/调整/直接生成/退出）

**单阶段命令（仅供调试）**：
- `prism` / `gap` / `ccos` / `narrate` 可独立调用，但会 stderr 提示"建议通过 run 走完整流程"
- 用 `--suppress-warning` 关闭提示

---

### Phase 0: 意图识别与确认

**执行方式**：当用户表达创作意图时，先调用 LLM 判断是否触发 PRISM-OS。

**意图识别 Prompt**：
```
分析用户输入，判断是否需要生成选题或标题。

用户输入：{{USER_INPUT}}

返回 JSON：
{
  "trigger": true/false,
  "confidence": 0.0-1.0,
  "reason": "简短理由"
}

触发条件（满足任一即触发）：
1. 显式请求：用户想生成文章选题、拟定标题、策划内容方向、讨论写什么
2. 表达观点/想法：用户表达了一个可以展开为选题的观点或立场
3. 话题疑问句：用户提出了一个可以深入探讨的问题
4. 分享信息：用户分享了新闻、现象、发现，暗示创作意图

不触发：用户只是想聊天、问技术问题、做其他任务。
```

**如果 trigger=true**：追问确认

```
检测到选题需求。你想用 PRISM-OS 生成标题吗？（yes/no）
```

- 用户回答 `yes` → 进入完整流程
- 用户回答 `no` → 结束

**如果 trigger=false**：不触发 skill，正常对话处理。

### Phase 0.5: marktap 抓取内容触发

当用户通过 marktap 抓取竞品文章后，Claude 从 Obsidian `00_收件箱/` 读取新文章，提取选题方向送入 PRISM-OS：

**触发方式**：marktap 抓取完成后，Claude 读取新保存的文章，提取核心观点作为用户输入，跳过 Phase 0 意图识别，直接进入 Phase 1 苏格拉底网关。

**marktap 工具**：
- 位置：`D:\AI\marktap\marktap.js`
- 功能：从 `links.txt` 读取 URL，抓取文章内容，保存到 Obsidian `00_收件箱/`
- 支持平台：微信公众号、知乎、Twitter、小红书、微博、B站、Medium、Dev.to、Reddit、YouTube
- 用法：双击桌面 `marktap.lnk` 或运行 `marktap-desktop.bat`

**输入格式**（由 Claude 从文章中提取）：
```
文章标题：{{TITLE}}
平台：{{PLATFORM}}
核心观点：{{CORE_CLAIM}}
选题角度：{{TOPIC_ANGLE}}
```

**流程差异**：
- 跳过 Phase 0（已确认是选题相关内容）
- Phase 1 苏格拉底网关正常执行，评估命题质量
- Phase 2 棱镜引擎基于竞品分析生成差异化标题（避免重复竞品角度）
- 后续流程与手动触发一致

**注意**：抓取由 marktap 完成，PRISM-OS 只接收文章内容，不执行抓取。

---

### Phase 1: 苏格拉底网关（Socratic Gateway）

**目标**：评估用户命题的"意图熵值"，决定是放行、追问还是拦截。

**输入分类**：

```python
def classify_input(user_raw_input):
    """检测输入类型"""
    if len(user_raw_input.split()) <= 2:
        return "keyword"  # "AI"、"写作"等
    elif "?" not in user_raw_input:
        return "sentence"  # 陈述句
    else:
        return "question"  # 问句
```

**追问生成逻辑**：

| 输入类型 | 追问策略 |
|----------|----------|
| keyword | 核心观点是什么、受众关联、期望行动 |
| sentence | 背后假设、反驳角度、具体场景 |
| question | 标准答案、打破常识、差异化答案 |

**熵值计算 Prompt**：
```
你是严格的命题审查员。评估用户输入的命题质量，按三个维度打分（0-1）：

1. Object_Clarity（对象清晰度）：命题是否指向具体对象？
   - 1.0：明确对象（如"自媒体创作者"、"初级程序员"）
   - 0.5：模糊对象（如"年轻人"、"打工人"）
   - 0.0：无对象（如"感觉很迷茫"、"想做点什么"）

2. Conflict_Tension（冲突张力）：命题是否包含矛盾或反常识元素？
   - 1.0：强矛盾（如"AI 让执行者失业"、"越努力越贫穷"）
   - 0.5：弱矛盾（如"AI 改变工作方式"）
   - 0.0：无矛盾（如"AI 很强大"、"要努力工作"）

3. Fact_Support（事实支撑）：命题是否基于具体现象？
   - 1.0：有具体案例或数据
   - 0.5：有模糊描述
   - 0.0：纯情绪表达

计算公式：Entropy = Object×0.4 + Conflict×0.4 + Fact×0.2

返回 JSON：
{
  "object_clarity": 0.8,
  "conflict_tension": 0.6,
  "fact_support": 0.5,
  "entropy_score": 0.68,
  "decision": "clarify",
  "reason": "命题有一定张力，但缺乏具体案例支撑"
}

决策规则（总分 0-1）：
- Entropy < 0.3 → "blocked"，拦截重构
- Entropy < 0.7 → "clarify"，迫选追问
- Entropy >= 0.7 → "pass"，直接放行
```

**提取关键要素**：

```python
def extract_elements(user_input, user_config):
    """提取核心要素"""
    return {
        "core_claim": extract_claim(user_input),  # 核心论点
        "target_emotion": infer_emotion(user_config["audience"]),  # 目标情绪
        "cognitive_crack": identify_crack(user_input, user_config)  # 认知裂缝
    }

def identify_crack(user_input, user_config):
    """识别认知裂缝（旧认知 vs 新认知）"""
    old_belief = extract_implicit_assumption(user_input)
    new_belief = generate_counter_narrative(
        old_belief,
        user_config["positioning"]["core_value"]
    )
    return {
        "old": old_belief,
        "new": new_belief,
        "tension": calculate_tension(old_belief, new_belief)
    }
```

**决策处理**：

| 决策 | 输出 | 后续 |
|------|------|------|
| blocked | 说明拦截原因，提示用户重新表达命题 | 等待用户新输入 |
| clarify | 输出 2-3 个选项让用户选择 | 用户选择后重新计算熵值 |
| pass | 进入棱镜引擎 | 继续 Phase 2 |

**追问选项格式**：
```
当前命题："我想写关于AI的东西"

请选择一个更精确的方向：
1. AI 让某些人失业（关注失业问题）
2. AI 时代学习方法失效（关注教育问题）
3. AI 让贫富差距扩大（关注公平问题）

请回复数字（1-3）或直接描述你的想法。
```

---

### Phase 2: 棱镜引擎（Prism Engine）

**目标**：基于用户命题，生成 12 个候选标题（4 维度 × 3 个/维度）。

**四维生成 Prompt**：
```
你是顶级选题策划师。根据用户命题，生成 4 个完全不同的标题，分别对应以下维度：

**维度定义：**

1. Reversal（逆向拆解）：颠覆常识，揭示反直觉真相。
   - 公式：为什么"常识 A"其实是"真相 B"？
   - 示例：为什么"努力工作"反而让你更穷？

2. Micro-Scene（微观切片）：聚焦具体场景或人群。
   - 公式：在"场景 X"中，"现象 Y"如何发生？
   - 示例：为什么程序员用 AI 后反而加班更多？

3. Systemic_Flaw（系统归因）：指向结构性问题。
   - 公式："现象 X"的根源是"系统缺陷 Y"。
   - 示例：为什么教育系统让聪明人变傻？

4. Bridge（认知脚手架）：提供方法论或工具。
   - 公式：如何用"方法 X"解决"问题 Y"？
   - 示例：如何用"费曼学习法"3 天掌握新技能？

**约束条件：**
- 每个标题必须在 18-28 字之间
- 禁止使用：赋能、降维打击、破圈、必须知道、震惊等词
- 四个标题的语义相似度必须 < 0.75
- 每维生成 3 个候选，共 12 个
- 必须包含"认知落差"（旧认知 vs 新认知）
- 必须有具体数字、场景或对比
- 避免使用"你必须知道"等说教式开头

用户命题：{{THESIS}}
用户身份：{{IDENTITY_ROLE}}
目标受众：{{AUDIENCE}}
维度权重：{{DIMENSION_WEIGHTS}}

返回 JSON：
{
  "candidates": [
    {
      "dimension": "reversal",
      "title": "为什么 AI 让'提问'比'执行'更值钱？",
      "rationale": "颠覆了'执行力是核心竞争力'的常识"
    },
    {
      "dimension": "reversal",
      "title": "AI 时代：为什么执行者正在被淘汰？",
      "rationale": "揭示失业潮背后的核心逻辑"
    },
    {
      "dimension": "reversal",
      "title": "别再崇拜努力了，AI 时代它可能是陷阱",
      "rationale": "挑战成功学叙事"
    },
    ...（每维3个，共12个）
  ]
}
```

**正交性校验**：
- 生成后，用 Embedding 计算 12 个标题的余弦相似度
- 如果某两个标题相似度 > 0.75，标记该标题并重新生成
- 最多重试 3 次，仍不符合则保留原结果（标注相似度警告）

---

### Phase 3: 现实校验锚（Reality Anchor）

**目标**：调用搜索 API 查重，标注竞争度（蓝海/黄海/红海）。

**搜索 API 调用**：
```http
POST {{SEARCH_API_URL}}
Headers: Authorization: Bearer {{SEARCH_API_KEY}}
Body: {
  "query": "{{TITLE}}",
  "num_results": 10
}
```

**校验 Prompt**：
```
你是内容竞争分析师。根据搜索结果评估选题新颖度。

搜索结果：{{SEARCH_RESULTS}}
待评估标题：{{TITLE}}

评估标准：
1. 查重率 = 标题与最相似搜索结果的相似度（0-1）
   - > 0.8：高度重复
   - 0.5-0.8：部分重复
   - < 0.5：基本原创

2. 竞争度标注：
   - 蓝海：查重率 < 0.3
   - 黄海：查重率 0.3-0.7
   - 红海：查重率 > 0.7

返回 JSON：
{
  "duplicate_rate": 0.15,
  "competition_level": "蓝海",
  "novelty_score": 0.85,
  "top_similar_results": [
    {"title": "相似标题1", "url": "...", "similarity": 0.82}
  ],
  "recommendation": "建议执行"
}
```

**过滤规则**：
- 查重率 > 0.8 的标题直接过滤
- 保留通过校验的标题（通常 Top 6）

**综合评分计算**：

```python
def calculate_final_score(candidate, novelty_score, trend_score):
    """
    综合评分公式：final_score = score×0.5 + novelty×0.3 + trend×0.2
    """
    candidate["novelty_score"] = novelty_score
    candidate["trend_score"] = trend_score
    candidate["final_score"] = (
        candidate["score"] * 0.5 +
        novelty_score * 0.3 +
        trend_score * 0.2
    )
    return candidate

def calculate_similarity(title_a, title_b, embedding_model=None):
    """
    相似度计算：Jaccard×0.4 + Cosine×0.6
    """
    # Jaccard 相似度
    tokens_a = set(tokenize(title_a))
    tokens_b = set(tokenize(title_b))
    jaccard = len(tokens_a & tokens_b) / len(tokens_a | tokens_b) if tokens_a or tokens_b else 0

    # Cosine 相似度（如有嵌入模型）
    if embedding_model:
        vec_a = embedding_model.embed(title_a)
        vec_b = embedding_model.embed(title_b)
        cosine = cosine_similarity([vec_a], [vec_b])[0][0]
    else:
        cosine = 0

    return 0.4 * jaccard + 0.6 * cosine
```

**词汇指纹检测**：

```python
def check_cliche(title, vocab_fingerprint_db):
    """
    检测标题是否使用陈词滥调
    """
    for pattern in vocab_fingerprint_db["cliche_patterns"]:
        if re.search(pattern["pattern"], title):
            return {
                "is_cliche": True,
                "matched_pattern": pattern["pattern"],
                "reason": pattern["reason"],
                "suggestion": get_replacement(title, pattern, vocab_fingerprint_db)
            }
    return {"is_cliche": False}
```

**负向筛选**：
- 查重率 > 0.8 → "与现有内容重复度过高"
- is_cliche = True → "使用陈词滥调"

---

### Phase 4.5: CCOS v2.0 认知推进流大纲

CCOS（Content Cognition Outline System）v2.0 替代旧版目录式大纲，输出 14 项动态认知大纲。

**架构流程**：
```
用户选择：标题 + dimension + 平台
    ↓
Layer 0：认知对齐（七类追问，用户交互，可跳过）
    ↓
Layer 1：内容意图识别（8 种内容目标）
    ↓
Layer 2：选题解析（类型 / 核心问题 / 认知张力 / 方向）
    ↓
Layer 3：结构决策（四大主结构，由 Layer 0 结果动态决定）
    ↓
Layer 4：认知模块编排（HOOK / CASE / EXPLAIN / MODEL / ...）
    ↓
Layer 5+6：信息密度 + Anti-AI（内嵌 prompt）
    ↓
Layer 7：作者性注入（复用数字分身）
    ↓
Layer 8：内容势能设计（张力曲线 / 情绪曲线 / 认知落差）
    ↓
14 项动态认知大纲输出
    ↓
Phase 4.6：Gap Analysis → 素材就绪度 → 完成 or 中断
```

**14 项输出格式**：
```json
{
  "内容目标": "认知升级",
  "用户动机": "焦虑",
  "核心认知冲突": "大众以为 vs 现实是",
  "内容立场": "用户真正想表达的立场",
  "作者性设定": {"认知倾向": "", "表达气质": "", "价值倾向": "", "长期母题": ""},
  "主结构": "认知升级型|问题拆解型|故事驱动型|信息重构型",
  "推进方式": "冲突推进|递进推进|案例推进|对比推进|拆解推进|情绪推进",
  "认知模块流": [{"模块": "HOOK", "内容摘要": "...", "功能": "制造停留"}, ...],
  "势能曲线": {"张力变化": [...], "情绪曲线": [...], "认知落差设计": "..."},
  "案例插入点": ["..."],
  "信息密度要求": "每段必须有信息增量；禁止同义反复/空洞总结...",
  "语言风格": "深度/理性/逻辑严密",
  "Anti-AI要求": "禁止：模板感/套话/平均化表达/AI式升华...",
  "最终动态认知大纲": "综合文本描述"
}
```

**Layer 0 七类追问**（可跳过）：
1. 方向追问："你更想讲：机会、焦虑、趋势、方法还是观点？"
2. 立场追问："你真正不同意大众的什么观点？"
3. 情绪追问："你希望读者看完后获得什么情绪？"
4. 案例追问："有没有一个真实案例，让你开始相信这个观点？"
5. 反直觉追问："这个领域有没有一个'看起来对，其实错'的地方？"
6. 用户画像追问："你真正想写给谁？"
7. 边界追问："你的观点在哪些情况下不成立？"

**四大主结构**：
- 认知升级型：适用观点型/趋势型，推荐认知升级、观点表达
- 问题拆解型：适用方法型/行业型，推荐实操教学、趋势分析
- 故事驱动型：适用情绪型/行业型，推荐情绪共鸣、身份认同、转化成交
- 信息重构型：适用行业型/趋势型，推荐信息整理、趋势分析

**结构选择不由平台决定，由 Layer 0 用户讨论结果（内容目标 + 情绪取向）动态决定。**

**信息密度强制规则**：
- 每段必须有信息增量
- 禁止同义反复 / 空洞总结 / 正确废话 / 情绪堆砌
- 强制：真实细节 / 微观行为 / 时间感 / 决策过程 / 心理变化

**Anti-AI 强制规则**：
- 禁止：模板感 / 套话 / 平均化表达 / AI式升华 / 空洞口号
- 强制：观点化表达 / 人类思考感（犹豫/推演/局部经验/不确定性）

---

### Phase 4.6: Gap Analysis 素材就绪度

在 CCOS 完成后调用，评估素材是否足以支撑内容创作。

**阈值规则**：
- 综合就绪度 < 0.3 → 红色中断
- 0.3 ≤ < 0.6 → 黄色警告
- ≥ 0.6 → 绿色通过

```json
{
  "gap_score": 0.67,
  "readiness": 0.33,
  "missing_evidence": ["关键证据1", "关键证据2"],
  "recommendation": "建议补充 2 个关键素材"
}
```

---

### Phase 5: V2 扩展 - 逻辑压力测试 & 认知旅程

**逻辑压力测试（与 Phase 3 并行执行）**：
```
你是逻辑审计员。检测标题中的逻辑谬误。

待检测标题：{{TITLE}}

检测项：
1. 循环论证：结论即前提
2. 幸存者偏差：只关注成功案例
3. 因果倒置：混淆因果关系
4. 滑坡谬误：夸大连锁反应

返回 JSON：
{
  "has_fallacy": true/false,
  "fallacy_type": "循环论证/幸存者偏差/因果倒置/滑坡谬误/无",
  "explanation": "详细说明",
  "severity": 0.8,
  "suggestion": "修改建议（如有）"
}
```

**认知旅程规划**：
```
你是认知路径规划师。计算当前选题与历史选题的语义距离。

当前命题：{{THESIS}}
历史选题：{{HISTORY_TOPICS}}（最近5条）

计算方法：
1. 用 Embedding 将当前命题和历史选题转为向量
2. 计算余弦距离
3. 平均距离 < 0.3 表示认知原地打转

返回 JSON：
{
  "avg_distance": 0.45,
  "cognitive_progress": "正常/原地打转",
  "warning": "如原地打转，给出警告",
  "recommendation": "如需调整，给出建议"
}

注意：如果是首次使用（无历史选题），返回：
{
  "status": "first_time",
  "message": "首次使用，跳过认知旅程校验"
}
```

---

### Phase 6: 数据持久化

**写入 topic_log.yaml**：
```yaml
- timestamp: "{{ISO_TIMESTAMP}}"
  thesis: "{{ORIGINAL_THESIS}}"
  clarified_intent: "{{CLARIFIED_INTENT}}"
  entropy_score: {{ENTROPY_SCORE}}
  candidates_count: {{CANDIDATES_COUNT}}
  selected_index: {{SELECTED_INDEX}}
  gap_report:
    gap_score: {{GAP_SCORE}}
    readiness: {{READINESS}}
    missing_evidence: [...]
  logic_audit:
    - title_index: 1
      has_fallacy: false
    - title_index: 2
      has_fallacy: true
      fallacy_type: "幸存者偏差"
      severity: 0.7
  cognitive_journey:
    avg_distance: {{AVG_DISTANCE}}
    status: "{{STATUS}}"
```

---

### Phase 7: V3 扩展 - 刺客机制 & 知识拓扑 & Prompt 变异

**刺客机制（Assassin Mechanism）**：

当用户选题时，系统检查是否存在历史爆款可以"逻辑反转"：

```
你是认知刺客。你的任务是对历史爆款选题进行"逻辑反转"，强制创作者否定旧观点。

历史爆款选题：{{HISTORICAL_TOPIC}}
发布时间：{{PUBLISH_DATE}}
当前时间：{{CURRENT_DATE}}

反转策略：
1. 前提质疑：挑战隐含假设
2. 数据更新：用新数据推翻旧结论
3. 视角切换：从另一个群体审视
4. 时效性挑战：用时间维度挑战命题

返回 JSON：
{
  "original_thesis": "为什么努力工作让你更穷？",
  "reversal_thesis": "为什么'不努力'反而是另一种陷阱？",
  "reversal_strategy": "前提质疑",
  "new_evidence": ["新数据1", "新案例2"],
  "cognitive_shift": "从'反努力'转向'重新定义努力'",
  "challenge_level": 0.8
}
```

**触发条件**：累计 20 篇真实发布数据后，且距上次刺客提醒已超过 30 天。

**知识拓扑图谱（Knowledge Topology）**：

系统定期分析用户的选题历史，构建认知地图：

```
你是认知地图分析师。基于实体关系图谱，标注认知开发区域。

实体统计：{{ENTITIES}}
关系统计：{{RELATIONS}}

定义：
- 过度开发区：该实体/关系出现频率过高，可能导致思维定势
- 未触及区：该实体/关系从未或很少出现，可能是认知盲区

返回 JSON：
{
  "over_explored": [
    {"entity": "AI", "reason": "出现频率过高", "suggestion": "探索其他领域"}
  ],
  "under_explored": [
    {"entity": "家庭", "reason": "从未出现", "suggestion": "可作为新选题方向"}
  ]
}
```

**Prompt 自动变异（Prompt Evolution）**：

根据用户行为数据自动调整生成参数：

```
变异触发条件（满足任一）：
- 维度选择偏差 > 30%
- 改词重复率 > 40%
- 生成采纳率 < 50%

变异策略：
1. 强化偏好维度：用户连续选择某维度时，提高该维度权重
2. 替换陈词：根据改词记录更新禁用词列表
3. 调整风格：根据采纳率调整生成风格

记录变异日志：
{
  "timestamp": "{{ISO_TIMESTAMP}}",
  "trigger": "dimension_selection_bias",
  "old_config": {...},
  "new_config": {...},
  "reason": "用户连续5次选择reversal维度"
}
```

---

### Phase 8: V4 扩展 - 认知裂缝捕捉 & 主动推送 & 数字分身

**认知裂缝捕捉（Cognitive Crack Hunter）**：

自动监控信息源，发现"社会共识与现实的裂缝"：

```
你是认知裂缝猎人。分析信息源中发现的内容，判断是否存在裂缝。

信息源：{{SOURCE}}
内容摘要：{{CONTENT_SUMMARY}}

裂缝类型：
- 数据裂缝：共识认为 X，但数据显示 Y
- 逻辑裂缝：共识基于 A，但 A 已被证伪
- 时效性裂缝：2020 年的共识已不适用 2026 年
- 人群裂缝：某些群体的经验与主流叙事不符

返回 JSON：
{
  "has_crack": true/false,
  "crack_type": "数据裂缝/逻辑裂缝/时效性裂缝/人群裂缝",
  "consensus": "当前社会共识是什么",
  "reality": "实际情况是什么",
  "confidence": 0.85,
  "suggested_topic": "建议的选题方向"
}
```

**主动选题推送**：

当系统发现高置信度的认知裂缝时，主动推送：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【PRISM-OS 主动发现】

💡 检测到认知裂缝

共识：AI 会让程序员大量失业
现实：最新数据显示程序员需求增长 15%

裂缝类型：数据裂缝 | 置信度：88%

建议选题方向：
1. 为什么 AI 时代程序员反而更值钱了？
2. 被高估的 AI 失业恐惧：数据背后的真相

是否基于这个裂缝生成标题？（yes/no）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**数字分身（Digital Twin）**：

学习创作者的思维模式，进行初步选题筛选：

```
你是数字分身的选题筛选模块。你的任务是模拟创作者进行初步筛选。

候选选题：{{CANDIDATE_TOPICS}}
创作者思维特征：{{THINKING_PATTERN}}

返回 JSON：
{
  "selected_topics": [
    {"topic": "...", "selection_reason": "...", "confidence": 0.85}
  ],
  "rejected_topics": [
    {"topic": "...", "rejection_reason": "...", "confidence": 0.72}
  ],
  "digital_twin_confidence": 0.78
}
```

**安全约束**：
- 最终决策权归用户：数字分身只做初筛
- 透明化：用户可查看筛选原因
- 可禁用：用户可随时关闭数字分身功能
- 定期校准：每 50 次筛选后询问用户是否准确

---

## Phase 6.0 数据反馈闭环（v1.3.0+）

完整方案：`docs/development/Phase-6-Data-Feedback-Loop-Plan.md`

**目标**：把"生成→发布"补成完整飞轮，让 PRISM-OS 从「生成工具」进化成「数据驱动的创作者操作系统」。

**架构**：
```
[用户发布文章] → [用户每天在飞书表填 5 个数字]
                       ↓
              [飞书多维表格 PRISM-OS 内容表现库]
                       ↓
        [PRISM-OS 后台每天 03:00 增量拉取]
                       ↓
        [数据校准（模板优选 / HKR 校准）]
                       ↓
        [下次 run/narrate 自动应用新校准]
```

**核心约定**：
- **手动录入**：用户只填 5 个数字（阅读/转发/收藏/点赞/评论）
- **3 个时间点**：T+1d / T+7d / T+30d（每篇 3 行，缺失容忍）
- **零 CLI 参与**：Windows 计划任务每天 03:00 自动跑
- **冷启动**：<3 篇样本不推荐任何策略

**反哺机制 B（模板优选，Phase 6.0 MVP）**：
- 按「平台 × 叙事策略」/「平台 × CCOS 模块组合」统计真实互动率
- 输出到 `data/feedback_calibration.yaml`
- `narrate` 步骤按 calibration 调整策略推荐权重

**反哺机制 A（HKR 校准，Phase 6.1 延后）**：
- 30+ 篇后启动
- 用真实互动率反推 H/K/R 哪个维度真预测有用
- 棱镜引擎打分时叠加校准系数

**CLI 调试命令**（日常不需要）：
```bash
python feishu_setup.py          # 一键建表（首次）
python prism_os.py metrics sync  # 手动触发同步
python prism_os.py metrics status # 查看反哺状态
```

---

## 输出格式

### 标准输出（用户确认后）

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【PRISM-OS 选题结果】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 候选标题（按综合评分排序）
  ① [逆向拆解] 为什么 AI 让"提问"比"执行"更值钱？
     蓝海 | 逻辑✓ | 素材就绪度 65%
  ② [微观切片] 程序员用 ChatGPT 后反而更焦虑的真相
     黄海 | 逻辑⚠ | 素材就绪度 40%
  ...

■ 素材缺口
  当前就绪度: 52%
  缺口: AI 冲击数据、提问能力量化指标
  建议: 补充 2 个关键素材后再创作

■ 双端大纲
  📝 公众号版: [大纲内容]
  📕 小红书版: [大纲内容 + 5个标签]

■ 认知旅程
  ✓ 与历史选题距离: 0.45（正常）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 网关追问输出

```
【PRISM-OS】需要更多信息

当前命题: "我想写关于AI的东西"

请选择一个更精确的方向：
  1️⃣ AI 让某些人失业（失业问题）
  2️⃣ AI 时代学习方法失效（教育问题）
  3️⃣ AI 让贫富差距扩大（公平问题）

请回复数字（1-3）或直接描述你的想法。
```

---

## 错误处理

```python
class PRISMError(Exception):
    """PRISM-OS 专用异常类"""
    pass

def safe_generate(user_input, user_config):
    """
    安全生成函数，捕获所有异常并返回结构化错误
    """
    try:
        # 网关阶段
        gateway_result = socratic_gateway(user_input, user_config)
        if not gateway_result["ready_for_generation"]:
            return {
                "status": "need_clarification",
                "questions": gateway_result["clarification_questions"]
            }

        # 生成阶段
        candidates = prism_engine(gateway_result["extracted_elements"], user_config)
        if not candidates:
            raise PRISMError("生成失败:未产生有效候选")

        # 校验阶段
        validated = reality_check(candidates, search_api, vocab_db)
        if not validated:
            return {"status": "all_rejected", "reason": "所有候选均未通过现实校验"}

        return {"status": "success", "candidates": validated}

    except PRISMError as e:
        log_error(e)
        return {"status": "error", "message": str(e)}
    except Exception as e:
        log_error(e)
        return {"status": "error", "message": str(e)}
```

**错误场景处理**：

| 场景 | 处理方式 |
|------|----------|
| LLM 调用失败 | Kimi → NVIDIA NIM → Gateway → OpenRouter 四级 fallback，全部失败返回结构化错误 |
| 搜索 API 失败 | Tavily → Firecrawl 降级，均失败跳过查重，标题标注 "未校验" |
| 生成失败 | 重试 1 次（指数退避），仍失败返回 "生成失败，请尝试更具体的命题" |
| 熵值过低（blocked） | 说明原因，提示 "请用更精确的语言描述你想表达的核心观点" |
| 首次使用无历史 | 跳过认知旅程，输出 "首次使用，认知旅程将在下次可用" |
| 候选全被过滤 | 返回 "所有候选均未通过现实校验，请尝试更独特的选题" |
| API rate limit | 全局 0.8s 节流 + 减少重试次数，排队等待恢复 |

---

## 性能优化（v1.1.0）

1. **全局 API 节流**：所有 curl API 调用底层强制 0.8s 间隔，防止 rate limit
2. **LLM 重试减少**：从 2 次降为 1 次，避免失败放大问题
3. **缓存机制**：嵌入向量 MD5 缓存（`embedding_cache.json`），避免重复计算
4. **curl subprocess**：所有外部 API 调用通过 curl（`-k` 参数），绕过 Windows SSL 问题
5. **OpenRouter 验证模型列表**：跳过 API 缓存的免费限流模型，直接用验证过的付费模型

---

## 示例

### 示例 1: 模糊输入触发追问

**用户输入**: "最近想写点东西"

**意图识别**: trigger=true, confidence=0.7

**追问**: "检测到选题需求。你想用 PRISM-OS 生成标题吗？（yes/no）"

**用户**: yes

**网关熵值计算**: Entropy=0.45, decision=clarify

**输出追问**:
```
当前命题："最近想写点东西"

请选择创作方向：
1️⃣ 职场发展（加薪、晋升、转行）
2️⃣ AI 与职业（AI 影响、工作方式）
3️⃣ 认知升级（思维模型、学习方法）

请回复数字或描述你的想法。
```

**用户选择**: 2

**重新计算熵值**: Entropy=0.75, decision=pass

**进入棱镜引擎**: 生成 12 个候选 → 校验 → 输出结果

---

### 示例 2: 清晰命题直接放行

**用户输入**: "为什么 AI 时代，努力不再是成功的充分条件？"

**意图识别**: trigger=true, confidence=0.9

**追问**: "检测到选题需求。你想用 PRISM-OS 生成标题吗？（yes/no）"

**用户**: yes

**网关熵值计算**: Entropy=0.92, decision=pass

**进入棱镜引擎**: 生成 12 个候选 → 校验 → 输出结果

---

## 词汇指纹库

Skill 使用 `references/vocab_fingerprint.json` 检测标题中的陈词滥调。

**检测逻辑**：
- 匹配 `cliche_patterns` 中的正则表达式
- 标记禁用词替换（`replacement_map`）
- 参考用户高频词（`high_performing_words` / `low_performing_words`）

**输出示例**：
```
标题："你必须知道的AI秘籍"
检测结果：
- ⚠️ "必须知道" → 标题党模板，建议替换
- ⚠️ "秘籍" → 夸大宣传，建议替换
修改建议：AI 时代你需要了解的 X 个真相
```

---

## 部署检查清单

### 开发前

- [ ]  编辑 `scripts/.env` 填入 KIMI_API_KEY / OPENROUTER_API_KEY / ZHIPU_API_KEY
- [ ]  确认 curl 命令可用（Windows 自带）
- [ ]  确认 Python 3.8+ 和 numpy 已安装

### 开发中

- [ ]  测试意图识别（模糊输入、清晰输入）
- [ ]  测试苏格拉底网关（blocked/clarify/pass 三种情况）
- [ ]  测试棱镜引擎（正交性校验）
- [ ]  测试现实校验锚（搜索 API 集成，Tavily → Firecrawl 降级）
- [ ]  测试词汇指纹库（陈词滥调检测）
- [ ]  编写各模块单元测试（253/253 通过）

### 部署后

- [ ]  用 5 个真实案例测试完整流程（`python prism_os.py run "话题" --no-ext`）
- [ ]  验证 HTTP 监听模式（`python prism_os.py listen`）
- [ ]  验证错误处理（API 失败、空输入、生成失败）
- [ ]  验证 API 节流（0.8s 间隔）正常运行

### V3/V4 扩展（可选）

- [ ]  配置 RSS/社交媒体 API（如需认知裂缝捕捉）
- [ ]  测试刺客机制（历史爆款逻辑反转）
- [ ]  测试知识拓扑图谱（认知地图构建）
- [ ]  测试 Prompt 变异（权重自动调整）
- [ ]  测试数字分身（思维模式学习与筛选）
- [ ]  验证主动推送功能（如已启用）
- [ ]  验证数字分身筛选准确率 > 75%

---

## 配置文件

Skill 读取用户配置 `user_config.yaml`：

```yaml
# 身份定位
identity:
  role: "揭秘者"
  mission: "揭开社会共识与现实之间的裂缝"
  tone: "理性、克制、反常识"

# 目标受众
audience:
  age_range: [28, 45]
  occupation: "职场上升期/小企业主"
  pain_points: ["认知焦虑", "财富增长瓶颈", "AI工具选择困难"]

# 禁用词汇
banned_words:
  - "赋能"
  - "降维打击"
  - "破圈"
  - "必须知道"
  - "震惊"

# 维度权重（可调整）
dimension_weights:
  reversal: 1.0
  micro_scene: 1.0
  systemic_flaw: 1.0
  bridge: 1.0

# API 配置
llm_api:
  url: "https://api.example.com/v1/chat/completions"
  key: "${LLM_API_KEY}"

search_api:
  url: "https://api.search.example.com/v1"
  key: "${SEARCH_API_KEY}"
```

# 集成脚本路径

| 功能 | 脚本路径 |
|------|---------|
| 推理链记录 | `.claude/reasoning_chain.py` |
| 偏好权重 | `.claude/preference_weight.py` |
| 数字分身 | `.claude/digital_twin.py` |
| LLM 调用日志 | `skills/prism-os/scripts/call_llm.py` |
| RSS 监控 | `.claude/rss_monitor.py` |
| 认知裂缝分析 | `.claude/crack_hunter_wrapper.py` |
| 健康检查 | `.claude/health_check.py` |

## Phase 7/8 集成说明

### Phase 7: 刺客机制触发

**自动触发条件**（满足时系统自动提醒）：
- 历史发布数据 ≥ 20 篇
- 距上次刺客提醒 > 30 天
- 检测到历史爆款命题可以被逻辑反转

**触发时输出**：
系统调用 `.claude/assassin_mechanism()` 生成刺客提醒消息，用户可选择是否基于反转生成新标题。

### Phase 8: 主动推送触发

**触发条件**：
- RSS 监控检测到置信度 > 0.75 的认知裂缝
- Cooldown 机制：同一 source 的同一裂缝类型 30 天内不重复推送

**推送格式**：
```
💡 检测到认知裂缝
共识：XXX
现实：XXX
裂缝类型：数据裂缝 | 置信度：88%
建议选题方向：1. ... 2. ...
是否基于这个裂缝生成标题？（yes/no）
```

**空闲时检测**：
系统在用户空闲时（无活跃请求超过 5 分钟）自动检查是否有新的裂缝发现。

---

## 环境要求

- curl 命令行工具（Windows 自带）
- Python 3.8+
- numpy + requests（仅 embedding.py 使用）
- `scripts/.env` 文件配置 API 密钥
- LLM API 支持 JSON 输出