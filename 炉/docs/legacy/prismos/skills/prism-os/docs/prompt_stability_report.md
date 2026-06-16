# Prompt 稳定性测试报告

**生成时间**: 2026-06-11
**目的**: 横切必做——验证 v1.0 关键 prompt 的稳定性
**测试方法**: 每个 prompt 跑 3 次同一输入，检查字段完整性和解析成功率

## 测试范围

| Prompt | 模块 | 关键字段 |
|--------|------|----------|
| `extract_cognitive_tension` (含 4 层展开) | M8 | 认知张力、深度展开（4 个子字段） |
| `title_deep` 5 标题生成 | M2 | 5 个标题（title, based_on, why） |

## 测试结果

### 1. `extract_cognitive_tension`（M8 + M2 配套）

| 次数 | raw_len | parsed_ok | has_tension | has_depth | depth_keys |
|------|---------|-----------|-------------|-----------|------------|
| 1 | 312 | ✓ | ✓ | ✓ | surface, implication, deeper_meaning, universal_value |
| 2 | 386 | ✓ | ✓ | ✓ | surface, implication, deeper_meaning, universal_value |
| 3 | 337 | ✓ | ✓ | ✓ | surface, implication, deeper_meaning, universal_value |

**结论：✅ 稳定**。3/3 都返回 4 层齐全，JSON 解析成功。

### 2. `title_deep` 5 标题生成（M2）

| 次数 | raw_len | titles_count | sample |
|------|---------|--------------|--------|
| 1 | 630 | 5 | 35岁程序员的AI时代焦虑：技术浪潮下的中年危机 / AI时代的中年程序员：35岁的焦虑与机遇 |
| 2 | 708 | 5 | 解码35岁程序员的AI时代焦虑：未来与挑战 / AI浪潮下，35岁程序员如何自处？ |
| 3 | 584 | 5 | 35岁程序员的AI时代焦虑：技术的快速变化与职业未来 / 中年危机与AI时代：程序员的职场焦虑与应对策略 |

**结论：✅ 稳定**。3/3 都生成 5 标题，长度都在 18-28 字合理范围。

## 已知非稳定性因素

### 1. LLM 网络波动
- Kimi API 偶发 `curl failed` 错误
- 自动 fallback 到 NVIDIA meta/llama-3.1-70b
- 不会导致稳定性失败，但**生成风格可能略变**（fallback 模型）
- v1 不处理，v2 接入 fallback 监控

### 2. 偶发 JSON 解析失败
- 极小概率（约 1/10）LLM 返回格式偏差
- v1 失败时回退到默认 persona（`user_config.yaml`）继续
- **影响：失败概率 < 10%，可接受**
- v2 优化：增加重试 + 更宽松的 JSON 解析

## 总结

| 维度 | 状态 |
|------|------|
| M8 cognitive_tension（含 4 层展开）| ✅ 稳定 |
| M2 title_deep 5 标题生成 | ✅ 稳定 |
| 字段完整性 | ✅ 100% |
| JSON 解析成功率 | ✅ ≥ 90%（3/3 + 5/5 复测都过） |
| 张力分波动 | N/A（v1 未启用 A1 评分；v1.1 加入） |

## 验收

✅ v1.0 Prompt 稳定性测试通过。**横切必做项完成。**

## 后续

- v1.1 加入 A1 张力评分后，需补测：
  - `title_deep_gen` prompt 的 `tension_score` 字段
  - 期望张力分波动 ≤ ±1（同一命题 3 次）
- v2 监控：
  - 失败率（> 10% 触发报警）
  - Fallback 频率（> 20% 触发报警）
  - 单次响应时间（P95 > 30s 报警）

---

报告依据：`tests/prompt_stability_results.json`（最近一次跑的结果）
