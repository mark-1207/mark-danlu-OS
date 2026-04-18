# 问题12：输入验证加强 — 设计方案

## 背景

ContentForge CLI 的 `recreate` 命令直接读取原文文件后传给 pipeline，没有任何预处理。如果原文是 HTML、特殊编码、或异常格式，会导致：
1. 分析质量下降（garbage in → garbage out）
2. pipeline 中途崩溃
3. 碎片库被污染

## 设计目标

在 CLI 层（粗筛）和 Pipeline Step 层（深度分析）两个时机验证和清洗输入。

## 双层验证架构

### 第一层：CLI 层 — `validateAndCleanInput()`

在 `runRecreate()` 里，读取文件后立即调用。

```typescript
// src/utils/input-validator.ts
export interface ValidationResult {
  cleaned: string;
  warnings: string[];
  errors: string[];
  isHtml: boolean;
  isTruncated: boolean;
  isTooShort: boolean;
}

export async function validateAndCleanInput(raw: Buffer, filename: string): Promise<ValidationResult>
```

**处理流程：**

1. **编码检测**
   - 尝试 UTF-8 decode
   - 失败则尝试 GB18030 / GBK decode（Windows 中文常见）
   - 均失败则报错 `invalid_encoding`

2. **HTML 检测与 strip**
   - 检查是否包含 `<html>`、`<div>`、`<p>`、`<br>` 等标签（不区分大小写）
   - 使用 HTML parser 或 regex strip tags，保留纯文本

3. **基础格式校验**
   - 空内容 → 报错
   - 纯链接文件（< 50 字且全是 URL） → 报错
   - 纯标题文件（第一行是 `#` 但全文 < 100 字） → 报错

4. **截断检测**
   - 检查最后 200 字符是否有未闭合的 MD 列表（`- `、1. 等开头但无换行结束）
   - 检查是否有明显截断信号（如 "..." 出现在末尾附近）
   - 截断 → 报错

5. **内容长度警告**
   - 全文 < 500 字 → 警告（效果可能不佳）

**返回值：** `ValidationResult` — `errors` 非空则 CLI 报错退出，不传给 pipeline

---

### 第二层：Pipeline Step 层 — `ViralDeconstructionStep` 内部

在 `ViralDeconstructionStep.execute()` 里，对 `originalArticle` 做深度分析。

**检查项：**

1. **Markdown 结构完整性**
   - 是否有明显的列表或引用块被截断（检测未闭合的 `[` 或 `>` 标记）
   - 如果发现异常，追加 warning 到 step result

2. **段落数量检查**
   - 如果 `< 3` 个段落，追加 warning

3. **字符集异常**
   - 检测乱码字符（非中文/英文/标点的奇怪 Unicode）
   - 如果乱码比例 > 5%，报错

**警告的处理：**
- 警告信息追加到 `StepResult.warnings`
- Pipeline 继续执行，但 warning 会在最终报告里显示

---

## 异常类型与处理策略总结

| 异常类型 | 策略 |
|---------|------|
| HTML 内容 | 自动 strip tags，继续使用 |
| 特殊编码（GBK/GB18030） | detect + re-encode，继续使用 |
| 空文件 | 阻止 + 报错 |
| 纯链接文件 | 阻止 + 报错 |
| 纯标题文件（无正文） | 阻止 + 报错 |
| 内容截断（突然中断） | 阻止 + 报错 |
| 内容过短（几句话） | 警告 + 继续 |
| Markdown 结构不完整 | 警告 + 继续 |
| 乱码字符过多 | 阻止 + 报错 |

---

## 实施步骤

1. 新建 `src/utils/input-validator.ts` — CLI 层验证
2. 修改 `src/cli/commands/recreate.ts` — 在 readFile 后调用 `validateAndCleanInput()`
3. 修改 `ViralDeconstructionStep` — 添加深度检查
4. 新建 `tests/unit/input-validator.test.ts` — 单元测试
5. 端到端测试：各种异常输入验证

---

## CLI 层接口

```typescript
// src/utils/input-validator.ts

export interface ValidationResult {
  cleaned: string;      // 清洗后的文本
  warnings: string[];    // 警告信息（可继续）
  errors: string[];      // 错误信息（阻止）
  detectedIssues: {
    wasHtml: boolean;
    wasEncodingIssue: boolean;
    wasTruncated: boolean;
    wasTooShort: boolean;
    wasPureTitle: boolean;
    wasPureLinks: boolean;
  };
}

// 导出
export async function validateAndCleanInput(raw: Buffer, filename: string): Promise<ValidationResult>
export function detectEncoding(raw: Buffer): { encoding: string; text: string } | null
export function stripHtml(text: string): string
export function detectTruncation(text: string): boolean
```

## 配置文件

`contentforge.config.yaml` 添加：

```yaml
inputValidation:
  minLength: 200          # 最短内容（低于则阻止）
  warnLength: 500         # 警告长度（低于则警告）
  allowedEncodings:        # 支持的编码列表
    - utf-8
    - gb18030
    - gbk
  htmlHandling: strip     # strip | reject
```

## 错误输出示例

```
错误: 输入验证失败
- [截断] 文件在列表项中途被截断，请检查完整内容
- [纯标题] 仅有标题无正文，无法分析
```

```
警告: 输入内容较短（~300字），分析结果可能不准确
```

---

## 验收标准

1. HTML 文件传入 → 自动 strip 后继续，无报错
2. GBK 编码文件传入 → 自动转 UTF-8 后继续，无报错
3. 空文件传入 → 报错 "内容为空"
4. 纯链接文件传入 → 报错 "未检测到有效内容"
5. 纯标题文件传入 → 报错 "内容仅包含标题"
6. 截断内容传入 → 报错 "内容在第X段被截断"
7. 短内容（300字）传入 → 警告但继续
8. 正常 Markdown → 正常通过，无警告
