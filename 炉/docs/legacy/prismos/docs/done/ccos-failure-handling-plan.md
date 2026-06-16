# CCOS 失败处理方案

> **[STATUS: 已实现]** — 2026-06-09 确认：base.py:68 `ccos_failed` 字段、ccos.py 4 处设置、narrate.py 跳过逻辑、4 测试全过。
> 本文件保留为历史参考，不再作为待办。

## Context

CCOS 生成失败后，后续 Phase 静默执行，narrate 没跑，用户不知道发生了什么。需要明确展示失败原因、后续流程状态、narrate 未执行的原因。

## 问题定位

1. CCOS 失败时，execute() 返回 success（outline=None），不是 rejected
2. Pipeline 继续执行后续 Phase，但 narrate 没跑（因为 ccos_outline=None）
3. 用户只看到"CCOS 生成失败"，不知道后续发生了什么

## 修复方案

### 1. PipelineState 加 ccos_failed 字段

**文件**：`scripts/phases/base.py`

```python
@dataclass
class PipelineState:
    # ... 已有字段 ...
    ccos_failed: bool = False
```

### 2. CCOSPhase 失败时设置 ccos_failed

**文件**：`scripts/phases/ccos.py`

CCOS 生成失败时（outline=None），设置 `state.ccos_failed = True`，并返回 success（不是 rejected），让 Pipeline 继续执行。

### 3. NarratePhase 检查 ccos_failed

**文件**：`scripts/phases/narrate.py`

should_run 检查 `state.ccos_failed`，如果 True 则跳过并展示原因。

### 4. PipelineState 最终 status

**文件**：`scripts/phases/base.py`

Pipeline.run() 结束时，如果 `state.ccos_failed`，status 设为 `partial_success`（不是 `success`）。

### 5. 展示规范

- CCOS 失败时：展示"CCOS 生成失败，原因：xxx，后续流程继续但 narrate 不会执行"
- narrate 跳过时：展示"CCOS 失败，narrate 未执行"
- 最终结果：展示"partial_success: CCOS 失败，narrate 未执行"

## TDD 测试

### 测试 1：CCOS 失败时 ccos_failed 被设置

```python
def test_ccos_failure_sets_ccos_failed():
    """CCOS 失败时 state.ccos_failed 应为 True"""
    # mock CCOS 生成失败
    # 验证 state.ccos_failed == True
```

### 测试 2：narrate 跳过时展示原因

```python
def test_narrate_skipped_when_ccos_failed():
    """CCOS 失败时 narrate 应跳过并展示原因"""
    # mock state.ccos_failed = True
    # 验证 narrate 的 should_run 返回 False
    # 验证 display_result 展示"CCOS 失败，narrate 未执行"
```

### 测试 3：最终 status 为 partial_success

```python
def test_partial_success_when_ccos_failed():
    """CCOS 失败时最终 status 应为 partial_success"""
    # mock CCOS 失败
    # 验证 Pipeline.run() 返回 status="partial_success"
```

## 实现步骤

1. PipelineState 加 ccos_failed 字段
2. CCOSPhase 失败时设置 ccos_failed
3. NarratePhase 检查 ccos_failed
4. PipelineState 最终 status 逻辑
5. 展示规范实现
6. 测试验证
7. commit

## 验证方案

1. 跑测试（RED → GREEN）
2. 跑完整流程，CCOS 失败时验证展示
3. 跑完整流程，CCOS 成功时验证 narrate 正常执行
