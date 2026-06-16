# 04 — 数据模型

> 版本：v1.0 草稿 | 状态：方案已对齐

## 1. 总览

### 1.1 模型分类

| 类别 | 模型 | 持久化 |
|------|------|--------|
| **运行态** | Run / Context / Blueprint / Draft | JSON（runs/<id>/） |
| **配置态** | StyleProfile / Framework / Model | YAML（config/） |
| **资产态** | Case / Quote / Insight | Markdown（Obsidian） |
| **元数据** | RunState / QualityReport | JSON |

### 1.2 序列化约定

- **pydantic v2** 为主
- **JSON**：运行态数据（Run / Context / Blueprint / Draft）
- **YAML**：配置（StyleProfile / Framework / Model）
- **Markdown**：资产（Case / Quote / Insight，写入 Obsidian）
- **所有时间**：UTC ISO 8601 格式

---

## 2. 运行态模型

### 2.1 Run（一次完整创作）

```python
# state/run.py
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum

class RunState(str, Enum):
    CREATED = "created"
    STEP1_DONE = "step1_done"
    STEP2_DONE = "step2_done"
    STEP3_DONE = "step3_done"
    STEP4_DONE = "step4_done"
    STEP5_DONE = "step5_done"
    STEP6_DONE = "step6_done"
    COMPLETED = "completed"
    FAILED = "failed"

class Run(BaseModel):
    id: str                            # 格式: "YYYY-MM-DD_<slug>"
    proposition: str                   # 原始命题
    state: RunState = RunState.CREATED
    context: Context                   # 完整上下文
    created_at: datetime
    updated_at: datetime
    
    # 元数据
    total_llm_calls: int = 0
    total_cost_usd: float = 0.0
    total_duration_sec: float = 0.0
```

### 2.2 Context（流程上下文）

```python
class Context(BaseModel):
    # Step 1 产出
    proposition_cleaned: str           # 清洗后命题
    
    # Step 2 产出
    socratic_session: Optional[SocraticSession] = None
    refined_proposition: Optional[RefinedProposition] = None
    
    # Step 3 产出
    framework_choice: Optional[FrameworkChoice] = None
    blueprint: Optional[Blueprint] = None
    
    # Step 4 产出
    selected_sections: Optional[List[Section]] = None
    
    # Step 5 产出
    draft: Optional[Draft] = None
    
    # Step 6 产出
    quality_report: Optional[QualityReport] = None
    
    # Step 7 产出
    harvested: Optional[Harvested] = None
    style_profile_snapshot: Optional[StyleProfile] = None
```

### 2.3 RefinedProposition（追问产出）

```python
class RefinedProposition(BaseModel):
    """苏格拉底追问的 8 项产出"""
    surface: str                       # 1. 命题浅层
    underlying: str                    # 2. 底层逻辑
    audience: str                      # 3. 潜在诉求
    style_recommendation: StyleRecommendation  # 4. 风格建议
    contrarian_candidates: List[ContrarianPoint]  # 5. 反共识候选
    framework_candidates: List[FrameworkCandidate]  # 6. 思想框架候选
    risks: List[str]                   # 7. 风险点/边界
    falsifiability: str                # 8. 可证伪性
```

### 2.4 Blueprint（蓝图）

```python
class Blueprint(BaseModel):
    proposition: str
    stance: str                        # 立场
    framework: str                     # 选定的框架 ID
    framework_output: dict             # 框架执行产出
    
    # CCOS 14 项
    audience: str                      # 目标读者
    core_anti_consensus: str           # 核心反共识
    cases: List[Case]                  # 案例
    data: List[DataPoint]              # 数据
    quotes: List[Quote]                # 金句候选
    forbidden: List[str]               # 必避免
    
    # 段位
    sections: List[Section]            # 8 段（核心 5 + 可选 2-4）
    
    # Anti-AI 锚点
    anti_ai_anchors: AntiAIAnchors

class AntiAIAnchors(BaseModel):
    case_anchors: List[Case]
    contrarian_anchors: List[str]
    data_anchors: List[DataPoint]
    insight_anchors: List[str]
    quote_anchors: List[str]
    forbidden_list: List[str]
```

### 2.5 Section（段位）

```python
class SectionRole(str, Enum):
    HOOK = "hook"                      # 钩子
    ANTI_CONSENSUS = "anti_consensus"  # 反共识
    CASE = "case"                      # 案例
    THINKING = "thinking"              # 思想模型
    ACTION = "action"                  # 行动指南（可选）
    REBUTTAL = "rebuttal"              # 反驳/边界（可选）
    CONTRAST = "contrast"              # 对比/反差（可选）
    DATA = "data"                      # 数据/事实（可选）
    SELF_DEPRECATION = "self_deprecation"  # 自嘲（可选）
    QUOTE = "quote"                    # 引用（可选）
    TWIST = "twist"                    # 转折/反转（可选）
    PAUSE = "pause"                    # 留白/思考题（可选）
    CLOSING = "closing"                # 金句收尾

class Section(BaseModel):
    role: SectionRole
    must_have: List[str]               # 本段必须包含的素材
    word_limit: int                    # 字数限制
    style_hint: str                    # 风格提示
    thinking_model_hint: Optional[str] # 思想模型提示（如果是 thinking 段）
    
    # 渲染时填充
    content: Optional[str] = None      # 草稿内容
    self_confidence: Optional[float] = None  # 自评置信度
```

### 2.6 Draft（草稿）

```python
class Draft(BaseModel):
    title: str
    sections: List[Section]            # 已填充 content 的 sections
    total_word_count: int
    
    # 元数据
    generated_at: datetime
    generation_duration_sec: float
    failed_sections: List[SectionRole] = []  # 生成失败的段
```

### 2.7 QualityReport（质量报告）

```python
class DimensionScore(BaseModel):
    name: str
    score: float                       # 0-10
    passed: bool                       # >= 7.5
    details: dict                      # 评分细节
    suggestions: List[str] = []        # 修复建议

class QualityReport(BaseModel):
    dimensions: List[DimensionScore]   # 8 个维度
    
    # 6 维
    temperature: DimensionScore
    heat: DimensionScore
    depth: DimensionScore
    thickness: DimensionScore
    emotion_curve: DimensionScore
    knowledge_transfer: DimensionScore
    
    # L5 三项
    viewpoint_sharpness: DimensionScore   # L5.1
    thinking_model_application: DimensionScore  # L5.2
    factual_accuracy: DimensionScore      # L5.3
    
    # 汇总
    overall_passed: bool
    weakest_dimension: str
    
    generated_at: datetime
```

---

## 3. 配置态模型

### 3.1 StyleProfile（风格画像）

```python
@dataclass
class LanguageFingerprint:
    """语言指纹"""
    metaphor_preference: List[str]     # 比喻偏好
    rhythm: dict                        # 节奏（短句/长句配比）
    catchphrases: List[str]            # 口头禅
    sentence_length_avg: float         # 平均句长
    
    # 初始化时计算
    sample_size: int = 0
    last_extracted_at: Optional[datetime] = None

@dataclass
class SocraticStopSignal:
    """苏格拉底追问停顿时机信号"""
    typical_rounds: float = 3.0        # 通常第几轮说"够了"
    saturation_keywords: List[str] = field(default_factory=lambda: ["够了", "差不多了", "先这样"])
    auto_stop_enabled: bool = False    # 是否启用自动停
    sample_count: int = 0              # 历史样本数

@dataclass
class StyleProfile:
    fingerprint: LanguageFingerprint
    forbidden_list: List[str]          # 必避免列表
    socratic_stop_signal: SocraticStopSignal
    preferences: List[StylePreference]
    
    # 元数据
    version: int = 1
    last_updated: Optional[datetime] = None
```

### 3.2 Framework（思想模型框架）

```python
@dataclass
class FrameworkTrigger:
    keywords: List[str]
    question_patterns: List[str] = field(default_factory=list)
    content_types: List[str] = field(default_factory=list)

@dataclass
class FrameworkModel:
    id: str
    role: str                          # lead / follow / cleanup / parallel
    order: int
    prompt_hint: str

@dataclass
class FrameworkOutputContract:
    fields: List[str]
    format: str = "structured"

@dataclass
class Framework:
    id: str
    name: str
    description: str
    trigger: FrameworkTrigger
    strategy: str                      # chain / parallel / nested / divergent_convergent / condition
    models: List[FrameworkModel]
    output_contract: FrameworkOutputContract
    anti_ai_anchors: List[str]
    prompt_template: Optional[str] = None
    examples: dict = field(default_factory=dict)  # positive / negative
```

### 3.3 Model（思想模型卡片）

```python
@dataclass
class ThinkingModel:
    id: str
    name: str
    description: str
    use_when: str                      # 使用场景
    prompt_hint: str                   # 使用提示词
    positive_example: Optional[str] = None
    negative_example: Optional[str] = None
    common_misuse: Optional[str] = None
```

### 3.4 LLM Provider Config

```python
@dataclass
class ProviderConfig:
    id: str                            # openai / kimi / anthropic
    api_key: str                       # 从环境变量
    base_url: Optional[str] = None
    model: str
    max_retries: int = 3
    timeout_sec: int = 60
    cost_per_1k_tokens: dict = field(default_factory=dict)  # input / output
```

### 3.5 Config（全局配置）

```python
@dataclass
class Config:
    llm_providers: List[ProviderConfig]
    primary_provider: str              # 首选
    fallback_order: List[str]          # fallback 顺序
    
    thinking_models_path: Path
    style_profile_path: Path
    
    obsidian_vault_path: Optional[Path] = None
    obsidian_enabled: bool = False
    
    feishu: Optional[FeishuConfig] = None  # v2+
    feishu_enabled: bool = False
    
    runs_dir: Path = Path("runs")
    log_level: str = "INFO"
```

---

## 4. 资产态模型

### 4.1 Case（案例）

```python
@dataclass
class Case:
    id: str
    name: str                          # "朋友 A" / "同事小张"
    summary: str                       # 简述
    details: str                       # 详情
    source: str                        # 来源：追问 Q5 / Obsidian / 飞书
    tags: List[str]                    # 标签：杠杆者/AI牛马/真实案例
    created_at: datetime
    
    # 落地到 Obsidian
    frontmatter: dict = field(default_factory=dict)
    body: str                          # Markdown 内容
```

### 4.2 Quote（金句）

```python
@dataclass
class Quote:
    id: str
    text: str
    context: str                       # 上下文
    source: str                        # 来源：哪篇文章/对话
    tags: List[str]
    created_at: datetime
```

### 4.3 Insight（洞察）

```python
@dataclass
class Insight:
    id: str
    title: str
    description: str
    thinking_models: List[str]         # 用到的思想模型
    examples: List[str]
    tags: List[str]
    created_at: datetime
```

### 4.4 DataPoint（数据点）

```python
@dataclass
class DataPoint:
    id: str
    statement: str                     # "到 2030 年 30% 工作可被自动化"
    source: str                        # "2025 McKinsey 报告"
    verified: bool                     # 是否可追溯
    tags: List[str]
```

---

## 5. 元数据模型

### 5.1 SocraticSession

```python
@dataclass
class SocraticAnswer:
    question_id: str                   # Q1-Q6
    question_text: str
    answer: str
    answered_at: datetime
    rounds: int                        # 第几轮

@dataclass
class SocraticSession:
    proposition: str
    answers: List[SocraticAnswer]
    started_at: datetime
    ended_at: Optional[datetime] = None
    user_said_stop: bool = False
    rounds: int = 0
```

### 5.2 StyleRecommendation

```python
class StyleTone(str, Enum):
    SHARP = "sharp"                    # 犀利
    RATIONAL = "rational"              # 理性
    FACTUAL = "factual"                # 事实导向
    EMOTIONAL = "emotional"            # 情感共鸣
    WARM = "warm"                      # 温暖
    COLD = "cold"                      # 冷淡
    HUMOROUS = "humorous"              # 幽默
    SERIOUS = "serious"                # 严肃

class StyleRecommendation(BaseModel):
    primary_tone: StyleTone
    secondary_tone: Optional[StyleTone] = None
    sample_references: List[str]       # 风格样例引用
    avoid_tones: List[StyleTone] = []
```

### 5.3 ContrarianPoint / FrameworkCandidate

```python
@dataclass
class ContrarianPoint:
    text: str                          # 反共识点
    sharpness: float                   # 0-1，锐利度
    evidence: Optional[str] = None     # 证据

@dataclass
class FrameworkCandidate:
    framework_id: str
    confidence: float                  # 0-1
    reason: str
```

### 5.4 FrameworkChoice

```python
@dataclass
class FrameworkChoice:
    framework_id: str                  # 选定的框架
    confidence: float
    models: List[str]                  # 选定的模型 ID 列表
    output: dict                       # 框架执行产出
    reasoning: str                     # 选这个框架的理由
```

### 5.5 Harvested（沉淀产物）

```python
@dataclass
class Harvested:
    cases: List[Case]                  # 提取的案例
    quotes: List[Quote]                # 提取的金句
    insights: List[Insight]            # 提取的洞察
    contrarian_points: List[ContrarianPoint]
    forbidden_candidates: List[str]    # 从 diff 提取的"必避免"候选
    style_update: Optional[StyleProfile] = None  # 风格画像更新
```

### 5.6 StylePreference

```python
@dataclass
class StylePreference:
    key: str                           # 偏好 key
    value: Any                         # 偏好值
    source: str                        # 来源：追问/草稿/diff
    confidence: float                  # 0-1
    created_at: datetime
```

---

## 6. 持久化格式

### 6.1 JSON（运行态）

路径：`runs/<run_id>/context.json`

```json
{
  "version": "1.0",
  "id": "2026-06-15_ai-牛马陷阱",
  "proposition": "AI 牛马陷阱",
  "state": "step6_done",
  "context": {
    "proposition_cleaned": "AI 牛马陷阱",
    "refined_proposition": {
      "surface": "...",
      "underlying": "...",
      "audience": "...",
      "style_recommendation": {...},
      "contrarian_candidates": [...],
      "framework_candidates": [...],
      "risks": [...],
      "falsifiability": "..."
    },
    "blueprint": {...},
    "selected_sections": [...],
    "draft": {...},
    "quality_report": {...}
  },
  "created_at": "2026-06-15T18:00:00Z",
  "updated_at": "2026-06-15T18:30:00Z",
  "total_llm_calls": 12,
  "total_cost_usd": 0.42,
  "total_duration_sec": 1800.0
}
```

### 6.2 YAML（配置态）

路径：`config/style_profile.yaml`

```yaml
version: 1
last_updated: 2026-06-15T18:00:00Z
fingerprint:
  metaphor_preference:
    - "杠杆"
    - "回路"
  rhythm:
    short_ratio: 0.6
    long_ratio: 0.4
  catchphrases:
    - "本质是"
    - "反过来"
  sentence_length_avg: 18.5
  sample_size: 5
  last_extracted_at: 2026-06-15T10:00:00Z
forbidden_list:
  - "赋能"
  - "在这个时代"
  - "让我们来看看"
socratic_stop_signal:
  typical_rounds: 3.0
  saturation_keywords:
    - "够了"
    - "差不多了"
  auto_stop_enabled: false
  sample_count: 0
preferences: []
```

### 6.3 Markdown（资产态，写入 Obsidian）

路径：`obsidian/40_知识库/案例库/朋友-A-用-LLM-工资没涨.md`

```markdown
---
id: case-001
name: 朋友 A
tags: [杠杆者, AI牛马, 真实案例]
source: 追问 Q5
created_at: 2026-06-15
---

# 朋友 A：用 LLM 工资没涨

## 简述
朋友 A 是某互联网公司运营，2024 年开始高强度用 LLM...

## 详情
...
```

---

## 7. 关系图

```
Run
  └─ Context
      ├─ SocraticSession
      │   └─ SocraticAnswer[]
      ├─ RefinedProposition
      │   ├─ StyleRecommendation
      │   ├─ ContrarianPoint[]
      │   └─ FrameworkCandidate[]
      ├─ FrameworkChoice
      ├─ Blueprint
      │   ├─ Case[]
      │   ├─ DataPoint[]
      │   ├─ Quote[]
      │   └─ Section[]
      │       └─ (SectionRole, must_have, content)
      ├─ Draft
      │   └─ Section[] (with content)
      ├─ QualityReport
      │   └─ DimensionScore[] (8 个)
      └─ Harvested
          ├─ Case[]
          ├─ Quote[]
          ├─ Insight[]
          └─ StyleProfile (snapshot)
```

---

## 8. 关联文档

- 架构：[02-ARCHITECTURE](02-ARCHITECTURE.md)
- 模块设计：[03-MODULE-DESIGN](03-MODULE-DESIGN.md)
- 配置路径：见 03 的 config/ 目录
