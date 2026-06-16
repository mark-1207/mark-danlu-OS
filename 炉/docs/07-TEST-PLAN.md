# 07 — 测试方案

> 版本：v1.0 草稿 | 状态：方案已对齐

## 1. 总则

### 1.1 测试哲学

- **TDD 是默认**：写代码前先写测试（D5）
- **测试是文档**：测试即预期行为
- **失败是信号**：测试失败 = bug 或需求变更
- **不为了覆盖率而测试**（F9 衍生）

### 1.2 测试金字塔

```
        ╱  ╲
       ╱ E2E ╲       ← 端到端（少量，< 10%）
      ╱________╲
     ╱  集成测试  ╲    ← 集成（中等，~ 20%）
    ╱____________╲
   ╱   单元测试    ╲   ← 单元（主力，~ 70%）
  ╱________________╲
```

### 1.3 覆盖率目标

| 层级 | 目标 |
|------|------|
| **核心模块**（苏格拉底/思想模型/打分/Blueprint） | 100% |
| **业务模块** | ≥ 80% |
| **基础设施**（util/state/store） | ≥ 60% |
| **整体** | ≥ 80% |

---

## 2. 单元测试

### 2.1 范围
- 单个函数/类
- 不依赖外部（LLM/文件/网络）
- 用 mock 隔离依赖

### 2.2 命名规范

```python
# tests/<module>/test_<unit>.py

def test_<unit>_<scenario>_<expected>():
    """测试 <unit> 在 <scenario> 下应该 <expected>"""

# 示例
def test_socratic_engine_ask_next_returns_q1_first():
    """苏格拉底引擎第一次问应该返回 Q1"""
```

### 2.3 结构（AAA 模式）

```python
def test_xxx():
    # Arrange（准备）
    engine = SocraticEngine(mock_llm, mock_style)
    
    # Act（执行）
    question = engine.ask_next(session)
    
    # Assert（断言）
    assert question.id == "Q1"
    assert "命题浅层" in question.theme
```

### 2.4 关键测试清单

#### 苏格拉底（socratic/）
- `test_socratic_engine_q1_q6_order` — 6 问顺序
- `test_socratic_engine_dynamic_trigger_vague` — 含糊触发追问
- `test_socratic_engine_dynamic_trigger_no_audience` — 无目标读者触发
- `test_socratic_output_8_fields_complete` — 8 项产出完整
- `test_socratic_output_contrarian_2_to_3` — 反共识 2-3 个
- `test_socratic_learning_phase1_user_says_stop` — 阶段 1 停
- `test_socratic_learning_phase2_system_prompts` — 阶段 2 提示
- `test_socratic_learning_phase3_auto_stop` — 阶段 3 自动停

#### 思想模型（thinking_models/）
- `test_framework_registry_loads_4_frameworks` — 加载 4 框架
- `test_model_registry_loads_12_models` — 加载 12 模型
- `test_framework_selector_picks_decision_for_choice` — 选决策框架
- `test_model_runner_chain_order` — chain 顺序
- `test_model_runner_parallel_concurrent` — parallel 并行
- `test_model_runner_nested_layered` — nested 嵌套
- `test_model_runner_divergent_then_convergent` — 发散→收敛
- `test_model_runner_condition_branches` — condition 分支
- `test_output_contract_validates_fields` — 产出契约校验

#### 蓝图（blueprint/）
- `test_blueprint_designer_maps_14_items` — CCOS 14 项映射
- `test_blueprint_anchors_pool_complete` — 锚点池完整
- `test_blueprint_sections_recommend_viewpoint` — 观点文推荐
- `test_blueprint_sections_recommend_tutorial` — 教程文推荐
- `test_blueprint_user_can_modify_sections` — 用户可调整

#### 草稿（draft/）
- `test_section_prompt_includes_style_fingerprint` — 风格指纹
- `test_section_prompt_includes_forbidden_list` — 必避免
- `test_section_prompt_includes_anti_ai_anchors` — 锚点
- `test_draft_generator_section_failure_retries` — 失败重试
- `test_draft_generator_self_confidence_recorded` — 自评置信度

#### 打磨（polish/）
- `test_quality_scorer_6_dimensions_independent` — 6 维独立
- `test_quality_scorer_5_dimensions_passed_threshold` — 7.5 阈值
- `test_quality_scorer_returns_weakest_dimension` — 最弱维度
- `test_suggester_generates_specific_suggestions` — 具体建议
- `test_suggester_empty_when_all_passed` — 全过时空

#### 沉淀（sediment/）
- `test_harvester_extracts_cases_quotes_insights` — 提取
- `test_style_updater_merges_forbidden_list` — 合并必避免
- `test_style_updater_dedup_forbidden` — 去重

#### 风格画像（style/）
- `test_fingerprint_extractor_from_samples` — 提取
- `test_style_manager_load_save` — 加载/保存
- `test_style_manager_incremental_update` — 增量更新

#### 状态机（state/）
- `test_state_machine_initial_state` — 初始
- `test_state_machine_legal_transitions` — 合法转换
- `test_state_machine_illegal_transition_raises` — 非法报错
- `test_run_resume_from_step` — 续跑

#### 持久化（store/）
- `test_file_store_save_load` — 保存/加载
- `test_file_store_version_snapshot` — 版本快照
- `test_file_store_corrupted_recovery` — 损坏恢复

#### LLM 链（llm/）
- `test_llm_chain_fallback_order` — fallback 顺序
- `test_llm_chain_retry_exponential` — 指数退避
- `test_llm_chain_cost_tracking` — 成本追踪
- `test_llm_provider_4xx_raises_immediately` — 4xx 立即报错

---

## 3. 集成测试

### 3.1 范围
- 多模块协作
- 用真实组件 + 临时文件/mock LLM
- 测试接口契约

### 3.2 关键场景

| 场景 | 测试 | 验证点 |
|------|------|--------|
| 苏格拉底 → 思想模型 | `test_socratic_then_thinking` | 数据传递正确 |
| 思想模型 → 蓝图 | `test_thinking_then_blueprint` | 框架输出到蓝图 |
| 蓝图 → 草稿 | `test_blueprint_then_draft` | 段位到 prompt |
| 草稿 → 打磨 | `test_draft_then_polish` | 草稿到评分 |
| 打磨 → 沉淀 | `test_polish_then_sediment` | 评分到画像 |
| 端到端（mock LLM） | `test_full_pipeline_7_steps` | 7 步跑通 |

### 3.3 Fixture 复用

```python
# tests/conftest.py
@pytest.fixture
def mock_llm():
    """mock LLM 链"""
    return MockLLMChain(responses={...})

@pytest.fixture
def tmp_style_profile():
    """临时风格画像"""
    return StyleProfile(...)

@pytest.fixture
def tmp_runs_dir(tmp_path):
    """临时 runs 目录"""
    runs_dir = tmp_path / "runs"
    runs_dir.mkdir()
    return runs_dir
```

---

## 4. 端到端测试

### 4.1 范围
- 7 步全流程
- 用 mock LLM + 真实持久化
- 验证产物完整性

### 4.2 关键测试

| 测试 | 范围 |
|------|------|
| `test_e2e_viewpoint_article` | 观点文（命题："AI 牛马陷阱"） |
| `test_e2e_tutorial_article` | 教程文 |
| `test_e2e_case_analysis` | 案例分析 |
| `test_e2e_short_article` | 短文（核心 5 选 3） |
| `test_e2e_resume_from_step3` | 续跑（从 Step 3） |
| `test_e2e_step2_user_skip` | 用户跳过 Step 2 |
| `test_e2e_polish_retry` | 打磨重试 |

### 4.3 端到端（真实 LLM）

标记 `@pytest.mark.slow`：
- 每次发版前跑
- 1 篇标准命题（如"AI 牛马陷阱"）
- 验证产物 + 评分 ≥ 7.5

---

## 5. 性能测试

### 5.1 性能预算

| 操作 | 预算 |
|------|------|
| 7 步全跑 | ≤ 10 分钟 |
| 单步平均 | ≤ 90 秒 |
| LLM 调用/篇 | ≤ 15 次 |
| 单次 LLM 调用 | ≤ 30 秒 |

### 5.2 性能测试

```python
@pytest.mark.benchmark
def test_7_steps_under_10_minutes():
    """7 步全跑应在 10 分钟内完成"""
    start = time.time()
    run_pipeline("test_proposition")
    elapsed = time.time() - start
    assert elapsed < 600

@pytest.mark.benchmark
def test_llm_call_under_30_seconds():
    """单次 LLM 调用应在 30 秒内完成"""
    start = time.time()
    llm.call("test_prompt")
    elapsed = time.time() - start
    assert elapsed < 30
```

### 5.3 性能报告

每次跑性能测试，生成 report：
- `tests/reports/perf_<date>.md`
- 含：单步耗时、LLM 调用次数、成本

---

## 6. Mock 策略

### 6.1 LLM Mock

```python
# tests/llm/mock_chain.py
class MockLLMChain:
    def __init__(self, responses: dict):
        self.responses = responses
        self.calls = []
    
    async def call(self, prompt: str, **kwargs) -> LLMResponse:
        self.calls.append(prompt)
        # 根据 prompt 内容返回预设 response
        if "苏格拉底" in prompt:
            return LLMResponse(content=self.responses["socratic_q1"])
        elif "框架" in prompt:
            return LLMResponse(content=self.responses["framework"])
        # ...
```

### 6.2 Obsidian Mock

```python
@pytest.fixture
def mock_obsidian(tmp_path):
    """用临时目录模拟 Obsidian vault"""
    vault = tmp_path / "vault"
    vault.mkdir()
    return ObsidianWriter(vault_path=vault)
```

### 6.3 飞书 Mock（v2+）

```python
@pytest.fixture
def mock_feishu():
    with patch("feishu.client.requests") as mock_req:
        mock_req.post.return_value = {"code": 0, "data": {...}}
        yield mock_req
```

### 6.4 时间 Mock

```python
from freezegun import freeze_time

@freeze_time("2026-06-15")
def test_run_created_at():
    """run 创建时间应该是 2026-06-15"""
    run = create_run("test")
    assert run.created_at == datetime(2026, 6, 15)
```

---

## 7. 测试工具

### 7.1 必备

| 工具 | 用途 |
|------|------|
| **pytest** | 主测试框架 |
| **pytest-mock** | mock 工具 |
| **pytest-cov** | 覆盖率 |
| **pytest-asyncio** | 异步测试 |
| **freezegun** | 时间 mock |
| **hypothesis** | 属性测试（v2 评估） |

### 7.2 可选

| 工具 | 用途 |
|------|------|
| **pytest-benchmark** | 性能测试 |
| **pytest-xdist** | 并行测试 |
| **mutmut** | 突变测试（v2 评估） |

---

## 8. 跑测试的命令

### 8.1 日常

```bash
# 全部
pytest

# 某个模块
pytest tests/socratic/

# 某个测试
pytest tests/socratic/test_engine.py::test_xxx

# 覆盖率
pytest --cov=src --cov-report=html
```

### 8.2 发版前

```bash
# 全部 + 慢测试
pytest --runslow

# 性能测试
pytest --benchmark-only

# 类型检查
mypy src/

# Lint
ruff check src/
```

### 8.3 强制门槛

- 单元测试覆盖率 < 80% → 拒绝合并
- 类型检查失败 → 拒绝合并
- Lint 错误 → 拒绝合并

---

## 9. 持续集成（v2+）

### 9.1 v1 阶段（手动）

```bash
# 提交前
pytest && mypy && ruff check
```

### 9.2 v2 阶段（GitHub Actions）

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
      - run: pip install -e ".[dev]"
      - run: pytest --cov=src
      - run: mypy src/
      - run: ruff check src/
```

---

## 10. 回归测试

### 10.1 触发

- 每次修改核心模块（苏格拉底/思想模型/打分）
- 每次修改 LLM Provider
- 每次修改持久化

### 10.2 范围

- 跑全量单元测试
- 跑集成测试
- 跑端到端（mock LLM）

### 10.3 慢测试

- 发版前才跑
- 真实 LLM + 真实时间

---

## 11. Bug 流程

### 11.1 报告

发现 bug → 写失败的测试 → 写 15-ISSUES.md 记录

### 11.2 修复

```
1. 写失败测试（reproduce bug）
2. 修复代码
3. 跑测试确认通过
4. 跑回归测试
5. 更新 15-ISSUES.md 状态
6. commit
```

### 11.3 不要

- ❌ 写"以后再修"的 TODO
- ❌ 跳过测试修复
- ❌ 不写测试直接修

---

## 12. 关联文档

- 开发规范：[05-DEV-CONVENTIONS](05-DEV-CONVENTIONS.md)
- 开发计划：[06-DEV-PLAN](06-DEV-PLAN.md)
- 问题清单：[15-ISSUES](15-ISSUES.md)
