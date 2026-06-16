# 03 — 模块设计

> 版本：v1.0 草稿 | 状态：方案已对齐

## 1. 设计原则

| 原则 | 含义 |
|------|------|
| **单一职责** | 每个模块只做一件事 |
| **配置化优先** | 行为由配置驱动，代码不变 |
| **可测试** | 每个模块可独立单测 |
| **可插拔** | LLM Provider / 持久化 / UI 可替换 |
| **依赖单向** | 避免循环依赖（详见 P-99 规则） |
| **不重复造轮子** | 优先用 pydantic / rich / httpx 等成熟库 |

---

## 2. 模块总览

### 2.1 路径表

```
src/
├── cli/                      # CLI 入口
│   ├── commands/             # 各命令实现
│   └── ui/                   # TUI 组件
├── pipeline/                 # 7 步循环
│   ├── orchestrator.py       # 调度器
│   └── steps/                # 7 个 step 实现
├── socratic/                 # 苏格拉底追问
│   ├── engine.py             # 追问引擎
│   ├── questions.py          # 6 问模板
│   ├── output.py             # 8 项产出格式化
│   └── learning.py           # 3 阶段学习
├── thinking_models/          # 思想模型
│   ├── framework_selector.py # 框架选择
│   ├── model_runner.py       # 模型执行（按 strategy）
│   └── registry.py           # 框架/模型注册
├── blueprint/                # 蓝图
│   ├── designer.py           # 蓝图设计
│   ├── sections.py           # 8 段选择
│   └── anchors.py            # Anti-AI 锚点
├── draft/                    # 草稿
│   ├── generator.py          # 草稿生成
│   ├── section_prompt.py     # 每段 prompt 构建
│   └── templates/            # prompt 模板
├── polish/                   # 打磨
│   ├── quality_scorer.py     # 8 维度评分
│   ├── dimensions/           # 6 维 + L5 三项
│   └── suggester.py          # 修复建议
├── sediment/                 # 沉淀
│   ├── harvester.py          # 产物提取
│   ├── style_updater.py      # 风格画像更新
│   └── obsidian_writer.py    # Obsidian 写入
├── style/                    # 风格画像
│   ├── profile.py            # 画像数据模型
│   ├── manager.py            # 画像管理
│   └── fingerprint.py        # 语言指纹提取
├── llm/                      # LLM 链
│   ├── chain.py              # 多 Provider 链
│   ├── providers/            # 各 Provider
│   └── prompt.py             # prompt 工具
├── state/                    # 状态机
│   ├── machine.py            # 状态机
│   └── run.py                # run 实体
├── store/                    # 持久化
│   ├── file_store.py         # 本地文件
│   └── obsidian.py           # Obsidian 集成
├── config/                   # 配置
│   ├── loader.py             # YAML 加载
│   └── models.py             # 配置数据模型
├── feishu/                   # 飞书（v2+）
│   └── client.py
├── util/                     # 工具
│   ├── log.py                # 日志
│   ├── retry.py              # 重试
│   └── error.py              # 异常定义

tests/                        # 测试（与 src/ 平行）
├── socratic/
├── thinking_models/
├── ...
```

### 2.2 依赖图

```
cli → pipeline → {socratic, thinking_models, blueprint, draft, polish, sediment, style}
                                  ↓
                                llm
                                  ↓
                            state / store / config / util
```

**依赖规则**：
- 核心模块（socratic/thinking_models/...）→ 只能依赖 llm/state/store/config/util
- 流程层（pipeline）→ 依赖核心模块
- 表现层（cli）→ 依赖流程层
- 基础设施（state/store/config/util）→ 不依赖任何业务模块

---

## 3. 核心模块详细设计

### 3.1 苏格拉底追问（socratic/）

#### 职责
- 引导用户澄清命题
- 输出 8 项结构化产出
- 学习"什么情况算够了"

#### 关键类

```python
# socratic/engine.py
class SocraticEngine:
    def __init__(self, llm: LLMChain, style: StyleProfile):
        self.llm = llm
        self.style = style
    
    def start(self, proposition: str) -> SocraticSession:
        """开启追问会话"""
    
    def ask_next(self, session: SocraticSession) -> Question:
        """生成下一问"""
    
    def submit_answer(self, session: SocraticSession, answer: str) -> bool:
        """提交答案，返回是否继续"""
    
    def should_stop(self, session: SocraticSession) -> StopDecision:
        """判断是否收尾（3 阶段学习）"""
    
    def finalize(self, session: SocraticSession) -> RefinedProposition:
        """输出 8 项产出"""

# socratic/questions.py
QUESTION_TEMPLATES = [
    Question(id="Q1", theme="命题浅层", dynamic_triggers=[...]),
    Question(id="Q2", theme="底层逻辑", dynamic_triggers=[...]),
    # ... Q3-Q6
]

# socratic/learning.py
class StopLearner:
    def record_stop(self, session: SocraticSession, user_said_stop: bool):
        """记录用户说'够了'的上下文"""
    
    def predict_should_stop(self, session: SocraticSession) -> float:
        """预测'够了'的概率（阶段 1-3）"""
```

#### 输入/输出
- 输入：proposition（string）+ style（StyleProfile）
- 输出：RefinedProposition（8 项）

#### 关键算法
1. **6 问固定模板** + 动态追问触发
2. **3 阶段学习**：靠用户说"够了" → 提示 + 用户决定 → 自动判断
3. **8 项产出生成**：1 次 LLM 调用（基于 Q1-Q6 答案综合）

#### 异常
- LLM 失败 → 重试 3 次 → 降级到"通用模板"
- 用户跳过某题 → 用 LLM 补全

#### 测试要点
- 6 问模板完整性
- 动态追问触发
- 3 阶段学习样本积累
- 8 项产出格式校验

---

### 3.2 思想模型（thinking_models/）

#### 职责
- 加载框架/模型配置
- 选择适合命题的框架
- 按 strategy 执行模型组合
- 输出产出契约

#### 关键类

```python
# thinking_models/framework_selector.py
class FrameworkSelector:
    def __init__(self, llm: LLMChain, registry: FrameworkRegistry):
        self.llm = llm
        self.registry = registry
    
    def select(self, proposition: str, refined: RefinedProposition) -> FrameworkChoice:
        """选择适合的框架 + 置信度"""

# thinking_models/model_runner.py
class ModelRunner:
    def __init__(self, llm: LLMChain, registry: ModelRegistry):
        self.llm = llm
        self.registry = registry
    
    def run(self, framework: Framework, proposition: str) -> FrameworkOutput:
        """按 framework.strategy 执行"""
    
    def _run_chain(self, models: List[Model], prop: str) -> Output:
        """链式执行"""
    
    def _run_parallel(self, models: List[Model], prop: str) -> Output:
        """并行执行 + 收敛"""
    
    def _run_nested(self, models: List[Model], prop: str) -> Output:
        """嵌套执行"""
    
    def _run_divergent_convergent(self, models: List[Model], prop: str) -> Output:
        """发散→收敛"""

# thinking_models/registry.py
class FrameworkRegistry:
    def load(self, path: Path) -> List[Framework]:
        """从 YAML 加载框架定义"""
    
    def get(self, id: str) -> Framework:
        """获取指定框架"""

class ModelRegistry:
    def load(self, path: Path) -> List[Model]:
        """从 YAML 加载模型卡片"""
    
    def get(self, id: str) -> Model:
        """获取指定模型"""
```

#### 输入/输出
- 输入：proposition + refined_proposition
- 输出：FrameworkChoice（framework + models + output）

#### 关键算法
- **框架选择**：1 次 LLM 调用（输入 trigger + content_types，输出 framework + conf）
- **策略执行**：根据 strategy 字段调度（chain/parallel/nested/divergent→convergent/condition）
- **产出校验**：按 output_contract.fields 校验，缺则补齐

#### 异常
- 框架选择置信度低 → 用户确认
- 模型加载失败 → 报错 + 中断
- 产出字段缺失 → 自动补齐

#### 测试要点
- 4 框架 + 12 模型加载正确
- 5 种策略执行正确
- 框架配置可热更新（不重启）

---

### 3.3 蓝图（blueprint/）

#### 职责
- 把 CCOS 14 项映射到蓝图字段
- 设计 Anti-AI 锚点池
- 选择 8 段（核心 5 + 推荐可选）

#### 关键类

```python
# blueprint/designer.py
class BlueprintDesigner:
    def __init__(self, llm: LLMChain, thinking: ModelRunner):
        self.llm = llm
        self.thinking = thinking
    
    def design(self, refined: RefinedProposition, framework: FrameworkOutput) -> Blueprint:
        """设计蓝图"""

# blueprint/sections.py
class SectionSelector:
    def recommend(self, content_type: str) -> List[Section]:
        """按内容类型推荐可选段位"""
    
    def select(self, blueprint: Blueprint, user_choice: List[str]) -> Blueprint:
        """应用用户选择"""

# blueprint/anchors.py
class AnchorPool:
    def build(self, refined: RefinedProposition, framework: FrameworkOutput) -> AntiAIAnchors:
        """构建锚点池"""
    
    def assign(self, anchors: AntiAIAnchors, sections: List[Section]) -> List[Section]:
        """为每段分配 must_have 锚点"""
```

#### 输入/输出
- 输入：RefinedProposition + FrameworkOutput
- 输出：Blueprint（含 sections + anti_ai_anchors）

#### 关键算法
- **CCOS 14 项映射**：1 次 LLM 调用
- **锚点池构建**：从 refined + framework 提取
- **段位推荐**：按 content_type 查表 + 1 次 LLM 校验

#### 异常
- 锚点池为空（追问没挖出）→ 警告 + 用户补
- 段位推荐置信度低 → 全展示

#### 测试要点
- CCOS 14 项字段映射
- 锚点池字段完整性
- 段位推荐按 content_type

---

### 3.4 草稿（draft/）

#### 职责
- 按蓝图 + 段位生成草稿
- 每段独立生成
- 注入风格画像 + 必避免 + Anti-AI 锚点

#### 关键类

```python
# draft/generator.py
class DraftGenerator:
    def __init__(self, llm: LLMChain, style: StyleProfile):
        self.llm = llm
        self.style = style
    
    def generate(self, blueprint: Blueprint) -> Draft:
        """生成完整草稿"""
    
    def generate_section(self, section: Section, context: Context) -> str:
        """生成单段"""

# draft/section_prompt.py
class SectionPromptBuilder:
    def build(self, section: Section, context: Context) -> str:
        """构建本段 prompt"""
```

#### 输入/输出
- 输入：Blueprint + StyleProfile
- 输出：Draft（含 sections + self_confidence）

#### 关键算法
- **每段独立生成**：1 次 LLM 调用/段
- **Prompt 注入顺序**：
  1. 风格指纹
  2. 必避免列表
  3. 本段 must_have
  4. 本段 role
  5. Anti-AI 锚点池
  6. 思想模型注入
- **自评置信度**：每段输出附 0-1 置信度（用作打磨的参考）

#### 异常
- 单段失败 → 重试 2 次 → 跳过 + 警告
- 必避免列表命中 → 自动替换 + 报告

#### 测试要点
- 每段 prompt 注入正确
- 单段失败重试
- 自评置信度分布合理

---

### 3.5 打磨（polish/）

#### 职责
- 8 维度评分
- 输出质量报告
- 生成修复建议

#### 关键类

```python
# polish/quality_scorer.py
class QualityScorer:
    def __init__(self, llm: LLMChain):
        self.llm = llm
    
    def score(self, draft: Draft, blueprint: Blueprint) -> QualityReport:
        """8 维度评分"""
    
    def _score_dimension(self, draft: Draft, dim: Dimension) -> DimensionScore:
        """单维度评分"""

# polish/dimensions/  # 6 维 + L5 三项
class Dimension(Protocol):
    name: str
    weight: float
    
    def score(self, draft: Draft) -> DimensionScore:
        ...

class 温度(Dimension): ...
class 热度(Dimension): ...
class 深度(Dimension): ...
class 厚度(Dimension): ...
class 情绪曲线(Dimension): ...
class 知识迁移(Dimension): ...
class 观点锐度_L5(Dimension): ...
class 思想模型应用_L5(Dimension): ...
class 事实准确性_L5(Dimension): ...

# polish/suggester.py
class FixSuggester:
    def suggest(self, report: QualityReport) -> List[FixSuggestion]:
        """生成修复建议"""
```

#### 输入/输出
- 输入：Draft + Blueprint
- 输出：QualityReport（8 维度分数 + 修复建议）

#### 关键算法
- **8 维度独立评分**：8 次 LLM 调用（可优化为 1 次多维度调用）
- **评分聚合**：每维度 ≥ 7.5 标记"通过"
- **修复建议**：从每维度失败的具体表现反推

#### 异常
- 评分失败 → 重试 + 默认 5 分
- 修复建议生成失败 → 跳过建议

#### 测试要点
- 8 维度评分一致性
- 修复建议可执行性

---

### 3.6 沉淀（sediment/）

#### 职责
- 从草稿中提取产物
- 更新风格画像
- 写入 Obsidian / 飞书

#### 关键类

```python
# sediment/harvester.py
class Harvester:
    def extract(self, draft: Draft, refined: RefinedProposition) -> Harvested:
        """提取：案例/金句/反共识/洞察"""
    
    def diff(self, draft: Draft, marked: Draft) -> DiffResult:
        """对比 mark 修改的 diff，提取'必避免'候选"""

# sediment/style_updater.py
class StyleUpdater:
    def update(self, harvested: Harvested, profile: StyleProfile) -> StyleProfile:
        """更新风格画像"""

# sediment/obsidian_writer.py
class ObsidianWriter:
    def write(self, harvested: Harvested, vault_path: Path) -> List[Path]:
        """写入 Obsidian 案例库/金句库"""
```

#### 输入/输出
- 输入：Draft + RefinedProposition + mark 验收结果
- 输出：更新的 StyleProfile + Obsidian 写入的文件列表

#### 关键算法
- **产物提取**：1 次 LLM 调用（提取金句/洞察/案例）
- **diff 检测**：用 difflib 找 mark 删的段落
- **风格画像更新**：合并新特征到必避免列表

#### 异常
- Obsidian 写入失败 → 队列重试
- 风格画像更新失败 → 备份旧版本

#### 测试要点
- 产物提取准确度
- diff 检测正确
- 风格画像合并无冲突

---

### 3.7 风格画像（style/）

#### 职责
- 加载/保存风格画像
- 提供"语言指纹" + "必避免列表"
- 学习用户偏好

#### 关键类

```python
# style/profile.py
@dataclass
class StyleProfile:
    fingerprint: LanguageFingerprint
    forbidden_list: List[str]
    socratic_stop_signal: SocraticStopSignal
    preferences: List[StylePreference]
    
    version: int
    last_updated: datetime

# style/manager.py
class StyleManager:
    def load(self, path: Path) -> StyleProfile: ...
    def save(self, profile: StyleProfile, path: Path) -> None: ...
    def update(self, harvested: Harvested, current: StyleProfile) -> StyleProfile: ...

# style/fingerprint.py
class FingerprintExtractor:
    def extract(self, samples: List[str]) -> LanguageFingerprint:
        """从历史文章提取语言指纹"""
```

#### 输入/输出
- 输入：用户历史文章（首次初始化）
- 输出：StyleProfile

#### 关键算法
- **首次初始化**：从用户提供的 5-10 篇历史文章提取
- **更新**：合并新特征，不破坏已有
- **必避免列表去重**：用集合 + 优先级

#### 异常
- 历史文章不足 → 提示用户补充
- 风格画像冲突 → 取最新版本

#### 测试要点
- 首次初始化正确
- 增量更新不破坏
- 必避免去重

---

### 3.8 LLM 链（llm/）

#### 职责
- 抽象 LLM Provider
- 多 Provider fallback 链
- 成本/延迟统计

#### 关键类

```python
# llm/chain.py
class LLMChain:
    def __init__(self, providers: List[LLMProvider]):
        self.providers = providers
    
    async def call(self, prompt: str, **kwargs) -> LLMResponse:
        """调用链：依次尝试各 provider"""

# llm/providers/openai.py
class OpenAIProvider(LLMProvider):
    async def call(self, prompt: str, **kwargs) -> LLMResponse: ...

# llm/providers/kimi.py
class KimiProvider(LLMProvider): ...
# llm/providers/anthropic.py
class AnthropicProvider(LLMProvider): ...

# llm/prompt.py
class PromptBuilder:
    def build(self, system: str, user: str) -> str: ...
    def render_template(self, template: str, **vars) -> str: ...
```

#### 输入/输出
- 输入：prompt（string + vars）
- 输出：LLMResponse（含 content + usage + cost）

#### 关键算法
- **Provider fallback**：openai → kimi → anthropic
- **重试策略**：指数退避（1s/2s/4s）
- **成本统计**：每次调用记录 token + cost

#### 异常
- 4xx（鉴权）→ 报错 + 中断
- 5xx / 超时 → 重试 + fallback

#### 测试要点
- fallback 顺序
- 重试策略
- 成本统计准确

---

## 4. 通用模块

### 4.1 状态机（state/）

```python
# state/machine.py
class StateMachine:
    def __init__(self, initial: RunState):
        self.state = initial
        self.history: List[Transition] = []
    
    def transition(self, target: RunState) -> None:
        """转换状态（带合法性校验）"""
    
    def can_transition(self, target: RunState) -> bool:
        """检查转换是否合法"""

# state/run.py
@dataclass
class Run:
    id: str
    proposition: str
    state: RunState
    context: Context
    created_at: datetime
    updated_at: datetime
```

### 4.2 持久化（store/）

```python
# store/file_store.py
class FileStore:
    def save(self, run: Run) -> None:
        """保存到 runs/<run_id>/context.json"""
    
    def load(self, run_id: str) -> Run: ...
    def list(self) -> List[str]: ...  # 所有 run_id

# store/obsidian.py
class ObsidianStore:
    def write_case(self, case: Case) -> Path: ...
    def write_quote(self, quote: Quote) -> Path: ...
    def write_insight(self, insight: Insight) -> Path: ...
```

### 4.3 配置（config/）

```python
# config/loader.py
class ConfigLoader:
    def load(self, path: Path) -> Config: ...
    def load_thinking_models(self, path: Path) -> Tuple[List[Framework], List[Model]]: ...

# config/models.py
@dataclass
class Config:
    llm_providers: List[ProviderConfig]
    thinking_models_path: Path
    style_profile_path: Path
    obsidian_vault_path: Optional[Path]
    feishu: Optional[FeishuConfig]  # v2+
```

### 4.4 日志（util/log.py）

```python
def get_logger(name: str) -> Logger:
    """统一 logger，含文件 + 控制台 + JSON 格式化"""

# 日志格式
# {"ts": "...", "level": "info", "module": "socratic", "msg": "...", "context": {...}}
```

### 4.5 异常（util/error.py）

```python
class LuError(Exception):
    """炉 基础异常"""
    pass

class LLMError(LuError):
    code: str  # "AUTH", "RATE_LIMIT", "TIMEOUT", "SERVER"

class ConfigError(LuError):
    code: str

class PersistenceError(LuError):
    code: str

class ValidationError(LuError):
    code: str
    field: str
```

---

## 5. 接口约定

### 5.1 模块间通信

**核心规则**：
- 模块间通信只通过**数据模型**（pydantic models）
- 不用全局变量
- 不用事件总线（v1 简化）

### 5.2 错误码

| 模块 | 错误码前缀 | 示例 |
|------|-----------|------|
| LLM | `LLM_` | `LLM_AUTH_FAILED` |
| Config | `CFG_` | `CFG_FILE_NOT_FOUND` |
| Persistence | `PER_` | `PER_WRITE_FAILED` |
| Validation | `VAL_` | `VAL_INVALID_PROPOSITION` |
| Socratic | `SOC_` | `SOC_MAX_ROUNDS_EXCEEDED` |
| Thinking | `THK_` | `THK_FRAMEWORK_NOT_FOUND` |

### 5.3 事件机制（v1 暂不实现，v2+ 评估）

如果需要事件：
- 走标准发布订阅（pubsub）
- 事件 payload 用 pydantic
- v1 简化：直接函数调用

---

## 6. 测试策略

### 6.1 测试层次

| 层 | 类型 | 工具 |
|----|------|------|
| 单元 | 各模块独立测试 | pytest |
| 集成 | 模块间协作 | pytest + fixtures |
| 端到端 | 7 步全流程 | pytest + mock LLM |
| 端到端（真实） | 真实 LLM 跑 | 标记 `@slow` |

### 6.2 覆盖率目标
- 单元测试覆盖率 ≥ 80%
- 关键路径（苏格拉底/思想模型/打分）100%

### 6.3 Mock 策略
- LLM 用 `mock-llm` 库（基于 fixture）
- Obsidian 用临时目录
- 飞书 mock（v2+）

详见 [07-TEST-PLAN](07-TEST-PLAN.md)。

---

## 7. 关联文档

- 架构：[02-ARCHITECTURE](02-ARCHITECTURE.md)
- 数据模型：[04-DATA-MODEL](04-DATA-MODEL.md)
- 开发规范：[05-DEV-CONVENTIONS](05-DEV-CONVENTIONS.md)
- 测试方案：[07-TEST-PLAN](07-TEST-PLAN.md)
