# 02 — 架构设计

> 版本：v1.0 草稿 | 状态：方案已对齐

## 1. 架构概览

### 1.1 7 步循环总览

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Step 1  │───→│ Step 2  │───→│ Step 3  │───→│ Step 4  │
│ 命题输入 │    │ 追问澄清 │    │ 蓝图设计 │    │ 段位选择 │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
                                                  ↓
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Step 7  │←───│ Step 6  │←───│ Step 5  │←───│   ↑     │
│ 沉淀回写 │    │ 打磨质检 │    │ 草稿生成 │    │  用户参与 │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
```

### 1.2 架构分层

```
┌────────────────────────────────────────┐
│ 表现层（TUI / CLI）                    │
├────────────────────────────────────────┤
│ 流程层（7 步循环 + 状态机）            │
├────────────────────────────────────────┤
│ 能力层（苏格拉底/思想模型/Blueprint/   │
│        风格画像/Anti-AI/LLM 评分）      │
├────────────────────────────────────────┤
│ 数据层（YAML 配置 / 本地文件 /         │
│        Obsidian / 飞书 v2+）            │
├────────────────────────────────────────┤
│ 基础设施（LLM 链 / 持久化 / 日志）     │
└────────────────────────────────────────┘
```

### 1.3 模块划分

| 层 | 模块 | 职责 |
|----|------|------|
| 表现层 | `cli/` | TUI + CLI 命令 |
|  | `ui/` | rich 渲染的交互界面 |
| 流程层 | `pipeline/` | 7 步循环调度 |
|  | `state/` | 状态机 + 持久化 |
| 能力层 | `socratic/` | 苏格拉底追问 |
|  | `thinking_models/` | 思想模型框架 |
|  | `blueprint/` | 蓝图设计 |
|  | `draft/` | 草稿生成 |
|  | `polish/` | 打磨质检 |
|  | `sediment/` | 沉淀回写 |
|  | `style/` | 风格画像 |
| 数据层 | `config/` | YAML 配置 |
|  | `store/` | 本地文件 / Obsidian |
|  | `feishu/` | 飞书客户端（v2+） |
| 基础设施 | `llm/` | LLM 链 + Provider |
|  | `util/` | 日志/重试/缓存 |

---

## 2. 7 步循环详细设计

### 2.1 Step 1：命题输入

| 项 | 详情 |
|----|------|
| 输入 | 命题字符串（CLI 参数） |
| 输出 | `context.proposition` |
| LLM | 0 次 |
| 用户操作 | 1 次（输入命题） |
| 异常 | 空字符串 / 超长字符串（>500字） |

**关键设计**：
- 命题预处理：trim 空白 / 去除 markdown / 提取核心词
- 命题压缩：>200 字时让用户确认"是否压缩"
- 不做语义理解（留给 Step 2）

---

### 2.2 Step 2：追问澄清

| 项 | 详情 |
|----|------|
| 输入 | `context.proposition` |
| 输出 | `context.refined_proposition`（8 项产出） |
| LLM | N+1 次（N=追问轮数，1=产出生成） |
| 用户操作 | 1 次起，多轮对话 |
| 异常 | LLM 失败 → 重试 → 降级到"通用模板" |

**关键设计**：

**6 个固定问**（Q1-Q6）：
| Q | 主题 | 动态追问触发 |
|---|------|--------------|
| Q1 | 命题浅层 | 含糊 → "具体哪个方面？" |
| Q2 | 底层逻辑 | 浅 → "为什么？" |
| Q3 | 潜在诉求 | 没目标读者 → "谁会读？" |
| Q4 | 风格倾向 | 不确定 → 给 3 段样例让用户选 |
| Q5 | 具体案例 | 没案例 → "你身边有人这样吗？" |
| Q6 | 反共识候选 | 不锐 → "反过来说呢？极端反例呢？" |

**8 项产出**：
1. 命题浅层
2. 底层逻辑
3. 潜在诉求
4. 风格建议
5. 反共识点候选（2-3 个）
6. 思想模型框架候选（1 主 1 备）
7. 风险点/边界
8. 可证伪性

**3 阶段学习**：
- 阶段 1（0-30 样本）：靠用户说"够了"停
- 阶段 2（30-100 样本）：系统提示 + 用户决定
- 阶段 3（100+ 样本）：自动判断

详见 P14 / 99-LESSONS-LEARNED。

---

### 2.3 Step 3：蓝图设计

| 项 | 详情 |
|----|------|
| 输入 | `context.refined_proposition` |
| 输出 | `context.blueprint`（蓝图） |
| LLM | 2-3 次（框架选择 + 蓝图生成 + 校验） |
| 用户操作 | 0-1 次（可选 TUI 确认） |
| 异常 | 框架选择置信度低 → 用户确认 |

**关键设计**：

**CCOS 14 项 → 蓝图字段映射**：
| CCOS 14 项 | 蓝图字段 |
|------------|----------|
| 1. 命题陈述 | `blueprint.proposition` |
| 2. 立场 | `blueprint.stance` |
| 3. 目标读者 | `blueprint.audience` |
| 4. 核心反共识 | `blueprint.anti_consensus` |
| 5. 思想框架 | `blueprint.framework` |
| 6. 案例 | `blueprint.cases` |
| 7. 数据 | `blueprint.data` |
| 8. 金句候选 | `blueprint.quotes` |
| 9. 必避免 | `blueprint.forbidden` |
| 10-14. 段落结构 | `blueprint.sections` |

**Anti-AI 锚点**：
```yaml
anti_ai_anchors:
  case_anchors: [...]        # 案例
  contrarian_anchors: [...]  # 反共识
  data_anchors: [...]        # 数据
  insight_anchors: [...]     # 洞察
  quote_anchors: [...]       # 金句
  forbidden_list: [...]      # 必避免
```

**框架选择**（4 框架）：
- 问题解构（chain） / 决策分析（parallel） / 系统思考（nested） / 创新突破（divergent→convergent）
- 详见 `thinking_models/frameworks.yaml`

---

### 2.4 Step 4：段位选择

| 项 | 详情 |
|----|------|
| 输入 | `context.blueprint` |
| 输出 | `context.selected_sections`（8 段选 4-9） |
| LLM | 1 次（按内容类型推荐） |
| 用户操作 | 1 次（TUI 确认/调整） |
| 异常 | 推荐置信度低 → 全展示让用户挑 |

**关键设计**：

**核心 5 必选**：
- 钩子 / 反共识 / 案例 / 思想模型 / 金句收尾

**可选 8 项按内容类型推荐**：
| 内容类型 | 推荐可选 |
|----------|----------|
| 观点文 | 行动指南 / 反驳 / 留白 |
| 教程文 | 数据 / 行动指南 / 留白 |
| 案例分析 | 数据 / 对比 / 引用 |
| 短文（≤500字） | 核心 5 选 3 |
| 长篇（>2000字） | 核心 5 + 可选 2-4 |

**TUI 界面**（示例）：
```
核心项（必选）：
[✓] 钩子
[✓] 反共识
[✓] 案例
[✓] 思想模型
[✓] 金句收尾

可选项（按"观点文"推荐 2-4）：
[✓] 行动指南
[✓] 反驳/边界
[ ] 数据/事实
[ ] 留白

[确认]
```

---

### 2.5 Step 5：草稿生成

| 项 | 详情 |
|----|------|
| 输入 | `context.blueprint` + `context.selected_sections` |
| 输出 | `context.draft`（草稿） |
| LLM | N 次（N=段数，每段 1 次） |
| 用户操作 | 0 次（自动跑） |
| 异常 | 单段失败 → 重试 → 跳过 + 警告 |

**关键设计**：

**每段独立生成**，不跨段 LLM 调用：
```python
def generate_section(section: Section, context: Context) -> str:
    prompt = build_prompt(section, context)
    return llm_call(prompt)
```

**每段 prompt 注入**：
1. 风格指纹（从 `style_profile`）
2. 必避免列表（从 `blueprint.forbidden` + `style_profile.forbidden`）
3. 本段 must_have（从 `section.must_have`）
4. 本段 role（从 `section.role`）
5. Anti-AI 锚点池（从 `blueprint.anti_ai_anchors`）
6. 思想模型注入（如果是思想模型段）

**段落级标记**（保留给 Step 6）：
- 每段输出时附"自评置信度"
- Step 6 用作打分依据

---

### 2.6 Step 6：打磨质检

| 项 | 详情 |
|----|------|
| 输入 | `context.draft` + `context.blueprint` + `context.style_profile` |
| 输出 | `context.polished`（打磨后）+ `context.quality_report`（质量报告） |
| LLM | 8 次（6 维 + L5 三项） |
| 用户操作 | 1 次（读 + 决定） |
| 异常 | 评分 < 7.5 → 自动给"修复建议" |

**关键设计**：

**8 维度评分**：
| 维度 | 评分方式 |
|------|----------|
| 温度 | 情感共鸣词密度 / 反"中性化叙述" |
| 热度 | 强观点密度 / 反"既要又要" |
| 深度 | 思想模型调用数 + 贴合度 |
| 厚度 | 信息密度 / 反"水分多" |
| 情绪曲线 | 情绪起伏点数 / 反"平铺直叙" |
| 知识迁移 | 跨领域引用 / 反"自说自话" |
| **L5.1 观点锐度** | 强观点密度 / 模糊词密度 / 关键判断数 |
| **L5.2 思想模型应用** | 模型调用识别 / 贴合度 / 解释度 |
| **L5.3 事实准确性** | 可追溯 / 虚构警告 / 引用准确 |

**评分流程**：
```
每维度 LLM 评分（0-10）→ 8 维度
    ↓
每维度 ≥ 7.5？
    ├─ 是 → 全部通过
    └─ 否 → 自动修复建议（不阻断）
    ↓
mark 亲自读完 → 决定接受/手动改/重跑
```

**修复建议示例**：
```
观点锐度 = 6.8（<7.5）
  - 第 2 段：模糊表达 3 处（"或许""可能""也许"）
  - 第 5 段：核心判断为 0
  建议：
    - 第 2 段：把"或许"改为具体判断
    - 第 5 段：增加 1 条核心判断
```

---

### 2.7 Step 7：沉淀回写

| 项 | 详情 |
|----|------|
| 输入 | `context.draft` + `context.quality_report` + mark 验收结果 |
| 输出 | 更新 `style_profile` + 写入 Obsidian + 飞书反馈 |
| LLM | 0-1 次（提取金句/洞察） |
| 用户操作 | 1 次（标"采纳"） |
| 异常 | 写入失败 → 队列重试 |

**关键设计**：

**沉淀路径**：
| 产物 | 写回位置 | 触发 |
|------|----------|------|
| 立场+反共识 | 风格画像 → 思想模型库 | mark 标"采纳" |
| 案例 | Obsidian 案例库（标签：杠杆者/AI牛马） | mark 标"采纳" |
| 金句 | Obsidian 金句库 | mark 标"采纳" |
| 修改时删的段 | 风格画像的"必避免列表" | diff 检测 |
| 评分 | 飞书反馈数据 | 默认 |

**v1 简化**：v1 暂不接入飞书；Obsidian 手动管理（v1.3 起接入）

---

## 3. 数据流

### 3.1 全局数据流

```
命题 (string)
    ↓ Step 1
context.proposition
    ↓ Step 2
context.refined_proposition (8 项产出)
    ↓ Step 3
context.blueprint (含 anti_ai_anchors)
    ↓ Step 4
context.selected_sections (4-9 段)
    ↓ Step 5
context.draft (草稿)
    ↓ Step 6
context.polished + context.quality_report
    ↓ Step 7
    ├─ style_profile（更新）
    ├─ Obsidian 素材库（写入）
    └─ 飞书反馈数据（v2+ 写入）
```

### 3.2 状态持久化

| 时刻 | 持久化什么 |
|------|------------|
| Step 1 完成 | `proposition` |
| Step 2 完成 | `refined_proposition` |
| Step 3 完成 | `blueprint` |
| Step 4 完成 | `selected_sections` |
| Step 5 完成 | `draft` |
| Step 6 完成 | `polished` + `quality_report` |
| Step 7 完成 | 全部 + 沉淀产物 |

**持久化方式**：
- 路径：`runs/<run_id>/context.json`
- 格式：JSON（pydantic 序列化）
- 时机：每步完成后立即写入（避免丢失）
- 版本：`runs/<run_id>/v<N>/`（回溯用）

---

## 4. 状态机

### 4.1 状态定义

```python
class RunState(str, Enum):
    CREATED = "created"          # 刚创建
    STEP1_DONE = "step1_done"    # 命题输入完成
    STEP2_DONE = "step2_done"    # 追问完成
    STEP3_DONE = "step3_done"    # 蓝图完成
    STEP4_DONE = "step4_done"    # 段位完成
    STEP5_DONE = "step5_done"    # 草稿完成
    STEP6_DONE = "step6_done"    # 质检完成
    COMPLETED = "completed"      # 沉淀完成
    FAILED = "failed"            # 失败
```

### 4.2 转换规则

```
CREATED
  └→ STEP1_DONE（Step 1 完成）
       └→ STEP2_DONE（Step 2 完成）
            └→ STEP3_DONE（Step 3 完成）
                 └→ STEP4_DONE（Step 4 完成）
                      └→ STEP5_DONE（Step 5 完成）
                           └→ STEP6_DONE（Step 6 完成）
                                └→ COMPLETED（Step 7 完成）

任意状态
  └→ FAILED（异常）
```

### 4.3 续跑机制

```bash
# 续跑指定步骤
炉 run --resume <run_id> --from-step <step>

# 示例：从 Step 3 续跑
炉 run --resume 2026-06-15_ai-牛马陷阱 --from-step 3
```

**续跑规则**：
- `--from-step` 必须 ≥ 状态机当前步骤
- 重跑当前步 → 用现有 context
- 重跑前序步 → 清空后续 context

---

## 5. 异常处理

### 5.1 LLM 失败

| 失败类型 | 处理 |
|----------|------|
| 4xx（鉴权/参数） | 报错 + 中断（用户需修正） |
| 5xx（服务端） | 重试 3 次（指数退避）→ 降级到次级 Provider |
| 超时 | 重试 2 次 → 降级 |
| 全部 Provider 失败 | 中断 + 提示 |

### 5.2 飞书 API 失败（v2+）
- 4xx：报错 + 中断
- 5xx：重试 3 次
- 限流：等待 + 重试

### 5.3 持久化失败
- 写入失败：本地日志保留 + 警告
- 读取失败：从 `runs/<run_id>/v<N>/` 回溯

### 5.4 必避免列表漂移
- 命中率 > 5/篇 → 标记"风格画像漂移"
- 触发：风格画像更新流程（人工）

---

## 6. 关键设计决策

### 6.1 为何 7 步（不是 5/6/8）

| 方案 | 步数 | 评估 |
|------|------|------|
| 5 步（粗） | 灵感/框架/草稿/打磨/沉淀 | "灵感"和"框架"承载过重 |
| 6 步 | +1 段位选择 | 草稿/打磨粒度仍粗 |
| **7 步** | 命题输入/追问/蓝图/段位/草稿/打磨/沉淀 | **每步单一职责，错误易定位** |
| 8 步（细） | +沉淀细分 | 用户中断次数过多 |

### 6.2 为何 8 段核心 5

- 核心 5 是"AI 味儿必杀器"：钩子/反共识/案例/思想模型/金句收尾
- 5 个核心 + 2-4 个可选 = 7-9 段，适合长文
- 短文 5 选 3，灵活不僵化
- 详见 P11 / 99-LESSONS-LEARNED

### 6.3 为何 L5 三个子项（不是 1-2 个）

- 观点锐度：解决"既要又要"的废话
- 思想模型应用：解决"为用而用"的堆术语
- 事实准确性：解决"为论证而虚构"的 AI 味
- 3 个子项各自独立，覆盖"言之无物 / 堆术语 / 假数据"3 大 AI 味

### 6.4 为何 4 思想模型框架（不是 1 个万能框架）

- 1 个万能 = 等于无框架（失去结构化）
- 4 个框架覆盖：拆解 / 决策 / 系统 / 创新
- 多了用户选择困难，少了覆盖不全

---

## 7. 演进路径

### 7.1 v1.x
- v1.0：核心 7 步 + 苏格拉底 + 思想模型 + 6 维评分 + L5 三子项
- v1.1：+ 真实 LLM provider + 运行持久化（FileStore）+ Obsidian 素材库写入
- v1.1 收尾：+ 续跑（`--resume` / `--from-step`）+ 反馈数据 + 飞书 hook
- v1.2：+ TUI 交互（`lu interactive`）+ 飞书 config sync（`lu config pull/push/sync`）
- v1.3：+ 爆款二创
- v1.4：+ 复盘/雷达/周报生成

### 7.2 v2.x
- 飞书多维表格管理配置
- 跨设备同步
- 阶段 2-3 学习机制
- Embedding 语义匹配
- 高级策略模式（iterate / recursive）

### 7.3 v3.x
- 开放给其他人使用
- Web 化 / 服务化
- 思想模型库社区化

---

## 8. 关联文档

- PRD：[01-PRD](01-PRD.md)
- 模块设计：[03-MODULE-DESIGN](03-MODULE-DESIGN.md)
- 数据模型：[04-DATA-MODEL](04-DATA-MODEL.md)
- 关键决策：`decisions/D-001` ~ `D-008`
- 经验教训：[99-LESSONS-LEARNED](99-LESSONS-LEARNED.md)
