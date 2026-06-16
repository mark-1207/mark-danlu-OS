# 05 — 开发规范

> 版本：v1.0 草稿 | 状态：方案已对齐
> 本文是 CLAUDE.md 的落地版。冲突时以本文为准。

## 1. 总则

### 1.1 三大铁律

1. **简单至上**：200 行能精简到 50 行就重写；不为不可能发生的场景写错误处理
2. **精准修改**：只触碰必须修改的部分；不"改进"相邻代码
3. **目标驱动**：定义成功标准；循环执行直到验证通过

### 1.2 黄金流程

```
思考（D5 规则 0） → TDD（D5） → 实现 → 端到端验证（F4） → commit（D7）
```

---

## 2. 代码风格

### 2.1 基础约定

- **Python 版本**：3.11+
- **格式化**：black（line-length=100）
- **import 排序**：isort
- **类型注解**：强制（mypy strict）
- **lint**：ruff（替代 flake8/pylint）
- **命名空间**：snake_case 函数/变量、PascalCase 类、UPPER_CASE 常量

### 2.2 命名规范

| 类别 | 规则 | 示例 |
|------|------|------|
| 文件 | snake_case | `framework_selector.py` |
| 类 | PascalCase | `FrameworkSelector` |
| 函数/方法 | snake_case，动词开头 | `select_framework()` |
| 变量 | snake_case | `proposition_cleaned` |
| 常量 | UPPER_SNAKE | `MAX_RETRIES = 3` |
| 私有 | 下划线前缀 | `_internal_state` |
| 类型别名 | PascalCase | `RunId = str` |

### 2.3 注释与文档字符串

**原则**（D2 + 99-LESSONS-LEARNED）：**默认无注释**。只在 WHY 不明显时加一行。

```python
# ❌ 错误示例
def calculate_score(draft: Draft) -> float:
    """计算草稿评分"""  # 函数名已经说明
    score = 0.0
    for dim in DIMENSIONS:  # 遍历维度
        score += dim.score
    return score

# ✅ 正确示例
def calculate_score(draft: Draft) -> float:
    return sum(dim.score for dim in DIMENSIONS)
```

**例外（必须加注释）**：
- 隐藏约束（库版本、API 限制）
- 微妙的不变量
- 特定 bug 的 workaround
- 行为会令读者惊讶的代码

### 2.4 类型注解

```python
# ✅ 必须
def select_framework(
    proposition: str,
    refined: RefinedProposition,
) -> FrameworkChoice:
    ...

# ❌ 禁止
def select_framework(proposition, refined):
    ...
```

### 2.5 错误处理

**原则**（D2 + F8）：**不为不可能发生的场景写错误处理**。

```python
# ❌ 错误：过度防御
def load_config(path: Path) -> Config:
    try:
        with open(path) as f:
            return Config(**yaml.safe_load(f))
    except FileNotFoundError:
        return None  # 隐藏错误
    except yaml.YAMLError:
        return None  # 隐藏错误

# ✅ 正确：让错误传播
def load_config(path: Path) -> Config:
    with open(path) as f:
        return Config(**yaml.safe_load(f))
```

**例外（必须显式处理）**：
- 边界（外部 API / 用户输入 / 文件 I/O）
- 优雅降级（fallback 路径）

---

## 3. Git 规范

### 3.1 工作流

- **直推 main**（D7）
- **不强制 PR 流程**（小功能直接 push）
- **commit 原子化**（一个 commit 一个变更）

### 3.2 Commit 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

**type**：
- `feat`：新功能
- `fix`：bug 修复
- `refactor`：重构（无功能变更）
- `docs`：文档
- `test`：测试
- `chore`：构建/工具/依赖
- `style`：格式（不影响功能）

**示例**：

```
feat(socratic): add 6-question template + dynamic triggers

- Add QUESTION_TEMPLATES with Q1-Q6 themes
- Add dynamic_triggers for context-aware follow-up
- Add 8-item output schema (RefinedProposition)

Refs: D-004, P11
```

### 3.3 Commit 前检查

1. ✅ 测试通过（pytest）
2. ✅ 类型检查通过（mypy）
3. ✅ Lint 通过（ruff）
4. ✅ 关键路径手动跑过
5. ✅ 文档（如有变更）已更新

### 3.4 分支策略（v1 单人）

- **主分支**：main
- **临时分支**：用于大型 feature（PR 后合并）
- **不强制**：小功能直接推 main

### 3.5 不要

- ❌ 强制 push（除非紧急）
- ❌ 跳过 hooks（--no-verify）
- ❌ 大块无关改动一起 commit
- ❌ 提交未跑过的代码

---

## 4. 测试规范

### 4.1 TDD 流程（D5）

```
1. 写失败的测试（red）
2. 写最小实现（green）
3. 重构（refactor）
4. 跑全量测试（确认无回归）
```

### 4.2 测试分层

| 层 | 范围 | 工具 | 速度 |
|----|------|------|------|
| 单元 | 单个函数/类 | pytest | <1s/测试 |
| 集成 | 多模块协作 | pytest + fixtures | <5s/测试 |
| 端到端（mock） | 7 步全流程 + mock LLM | pytest | <30s/测试 |
| 端到端（真实） | 真实 LLM 跑 | 标记 `@slow` | 分钟级 |

### 4.3 测试覆盖率

- **目标**：核心模块 ≥ 80%
- **强制**：苏格拉底/思想模型/打分 100%
- **不要求**：util/ 工具函数

### 4.4 Mock 策略

- **LLM**：用 `pytest-mock` + fixture 注入假 response
- **Obsidian**：用临时目录
- **飞书**：mock client（v2+）
- **时间**：用 `freezegun`

### 4.5 测试命名

```python
def test_<unit>_<scenario>_<expected>():
    """测试 <unit> 在 <scenario> 下应该 <expected>"""

# 示例
def test_socratic_engine_ask_next_returns_q1_first():
    """苏格拉底引擎第一次问应该返回 Q1"""
```

### 4.6 不要

- ❌ 写测试只为了覆盖率
- ❌ 跳过失败的测试
- ❌ 写没有断言的测试

---

## 5. 文档规范

### 5.1 文档类型

| 类型 | 路径 | 工具 |
|------|------|------|
| 产品文档 | `docs/00-17` | Markdown |
| 代码文档 | 源码 docstring | Sphinx（v2 评估） |
| API 文档 | `docs/05-API-SPEC.md` | Markdown（v1 简化） |
| 决策记录 | `docs/decisions/D-*.md` | ADR 格式 |
| 经验教训 | `docs/99-LESSONS-LEARNED.md` | 沉淀 |
| 进度日志 | `docs/11-PROGRESS.md` | 时序 |

### 5.2 Markdown 规范

- **标题**：ATX 风格（`#`）
- **代码块**：带语言标签
- **表格**：用 `|` 对齐
- **链接**：相对路径
- **图片**：本地相对路径

### 5.3 ADR 格式

```markdown
# D-XXX: 决策标题

## 状态
已敲定 / 评估中 / 已废弃

## 背景
为什么需要决策？

## 备选
- 方案 A：...
- 方案 B：...

## 选定
方案 X。理由：...

## 后果
- 正面：...
- 负面：...
- 风险：...

## 日期
YYYY-MM-DD
```

---

## 6. 错误处理

### 6.1 异常层级

```python
# util/error.py
class LuError(Exception): pass
class LLMError(LuError): pass
class ConfigError(LuError): pass
class PersistenceError(LuError): pass
class ValidationError(LuError): pass
```

### 6.2 错误处理原则

1. **fail fast**：尽早暴露错误
2. **不要吞错**：捕获后必须处理或重抛
3. **错误码 + 消息**：机器可读 + 人可读
4. **日志**：错误必须记录到日志

### 6.3 重试策略

- **网络错误**：指数退避（1s / 2s / 4s），最多 3 次
- **业务错误**：不重试（直接报错）
- **fallback**：Provider 链依次尝试

---

## 7. 性能

### 7.1 性能预算

| 操作 | 预算 |
|------|------|
| 7 步全跑 | ≤ 10 分钟（不含人工） |
| 单步平均 | ≤ 90 秒 |
| LLM 调用/篇 | ≤ 15 次 |
| 单次 LLM 调用 | ≤ 30 秒 |

### 7.2 性能优化原则

1. **先正确，再快**
2. **profile 再优化**（不要猜）
3. **缓存只读数据**（YAML 配置等）
4. **异步 I/O**（LLM 调用可并行）

---

## 8. 安全

### 8.1 凭证管理

- **API Key**：环境变量 + `.env`（git ignore）
- **不要 hardcode** 在代码里
- **不要 commit** `.env` 文件

### 8.2 输入验证

- **外部输入**：用 pydantic 校验
- **用户命题**：trim + 长度限制
- **文件路径**：防止 path traversal

### 8.3 错误信息

- **不泄露敏感信息**（API key、token）
- **对用户友好**：技术错误包装为人话

---

## 9. 命名一致性

| 概念 | 命名 | 不要用 |
|------|------|--------|
| 命题 | `proposition` | topic / subject |
| 追问 | `socratic` | qa / interview |
| 蓝图 | `blueprint` | outline / plan |
| 草稿 | `draft` | article / content |
| 风格画像 | `style_profile` | persona / voice |
| 思想模型 | `thinking_model` | mental_model |
| 框架 | `framework` | strategy |
| 锚点 | `anchor` | - |
| 段位 | `section` | paragraph |
| 必避免 | `forbidden` | blacklist |

---

## 10. 工具链

| 工具 | 用途 | 配置 |
|------|------|------|
| **uv** | 包管理（v1 评估） | pyproject.toml |
| **black** | 格式化 | line-length=100 |
| **isort** | import 排序 | profile=black |
| **ruff** | lint | 替代 flake8/pylint |
| **mypy** | 类型检查 | strict |
| **pytest** | 测试 | - |
| **pytest-mock** | mock | - |
| **pytest-cov** | 覆盖率 | - |
| **freezegun** | 时间 mock | - |
| **rich** | TUI | - |
| **pydantic** | 数据模型 | v2 |
| **httpx** | HTTP 客户端 | - |
| **pyyaml** | YAML | - |

---

## 11. CI/CD（v1 简化）

### 11.1 v1 阶段

- 不强求 CI
- 手动跑 `pytest + mypy + ruff` 后 commit

### 11.2 v2 阶段（评估）

- GitHub Actions
- PR 检查：测试 + 类型 + lint
- 自动发版

---

## 12. 关联文档

- CLAUDE.md：根目录
- 经验教训：[99-LESSONS-LEARNED](99-LESSONS-LEARNED.md)
- 测试方案：[07-TEST-PLAN](07-TEST-PLAN.md)
- 部署方案：[08-DEPLOY](08-DEPLOY.md)
