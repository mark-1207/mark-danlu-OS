# ContentForge Compliance — Design Spec

> **Goal:** CLI 命令形式的合规检查工具，检测敏感词、平台违禁词、格式问题。

---

## 1. Overview

**功能**：内容发布前的合规性检查

**触发方式**：
```bash
# 单独检查
node dist/index.js compliance --input ./output/xxx/wechat.md

# recreate 完成后自动触发
node dist/index.js recreate --input article.md --check-compliance
```

**检查维度**：
| 维度 | 类型 | 成本 |
|------|------|------|
| 敏感词检测 | 规则匹配 | 无 |
| 平台违禁词 | 规则匹配 | 无 |
| 格式检查 | 规则匹配 | 无 |
| 标题党检测 | LLM（可选） | 有 |

---

## 2. 检查规则

### 2.1 敏感词（广告法禁用词）

来源：公开词表，存于 `data/compliance/forbidden-words.json`

| 类别 | 示例 |
|------|------|
| 极限词 | 最佳、第一、顶级、极品、独一无二 |
| 虚假承诺 | 无风险、100%成功、无效退款 |
| 医疗相关 | 根治、永不复发、治疗效果最佳 |

### 2.2 平台违禁词

| 平台 | 文件 | 示例 |
|------|------|------|
| 微信公众号 | `data/compliance/platforms/wechat.json` | 诱导关注、诱导分享、外链提示 |
| 小红书 | `data/compliance/platforms/xiaohongshu.json` | 夸大收益、理财推荐、未经证实的医疗信息 |
| 抖音 | `data/compliance/platforms/douyin.json` | 绝对化用语、虚假夸大、敏感行业 |

### 2.3 格式检查

| 平台 | 规则 |
|------|------|
| 微信公众号 | 标题 ≤20 字，正文 ≥300 字 |
| 小红书 | 标题 ≤20 字，正文 500-1000 字，emoji 密度 ≤30% |
| 抖音 | 标题 ≤20 字，正文 ≤500 字 |

---

## 3. 输出格式

```bash
$ node dist/index.js compliance --input ./output/2026-04-28_untitled/wechat.md

🔍 合规检查: wechat.md

⚠️  敏感词 [warn]: 检测到"最佳"（第3行）
⚠️  格式 [warn]: 标题过长（25字，建议≤20）
✅ 合规检查完成

问题汇总：
  [warn]  敏感词: "最佳"
  [warn]  格式: 标题25字>20字限制
```

---

## 4. 文件结构

```
src/cli/commands/compliance.ts          # CLI 命令
src/scenarios/compliance/
  ├── checker.ts                        # 主检查逻辑
  ├── rules/
  │   ├── sensitive-words.ts            # 敏感词规则
  │   ├── platform-forbidden.ts         # 平台违禁词
  │   └── format.ts                     # 格式检查
  └── types.ts                          # 类型定义
data/compliance/
  ├── forbidden-words.json              # 广告法禁用词
  └── platforms/
      ├── wechat.json
      ├── xiaohongshu.json
      └── douyin.json
```

---

## 5. 类型定义

```typescript
export interface ComplianceResult {
  passed: boolean;
  issues: ComplianceIssue[];
  platform: string;
}

export interface ComplianceIssue {
  type: 'sensitive' | 'forbidden' | 'format';
  severity: 'warn' | 'error';
  message: string;
  line?: number;
  matchedWord?: string;
}
```

---

## 6. 与 recreate 集成

`--check-compliance` flag 在 recreate 完成后触发检查：

```typescript
// recreate.ts
if (opts.checkCompliance) {
  const complianceResult = await runComplianceCheck(outputFile);
  printComplianceReport(complianceResult);
}
```

---

## 7. 设计决策

1. **无 LLM**：第一版只用规则匹配，不调 API
2. **词库静态**：JSON 文件，手动维护，可随时更新
3. **宽松检测**：warn 级别不阻止，只提示；error 级别才阻止（暂无）
4. **平台感知**：根据文件扩展名（.md / .xhs.md / .d.md）自动判断平台
