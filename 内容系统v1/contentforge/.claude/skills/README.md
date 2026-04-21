# ContentForge 项目技能目录

## 目录说明

本目录包含 ContentForge 项目的所有专属技能定义文件（`.claude/skills/`）。

**官方技能（直接引用，不在本目录重复建）**：

- `superpowers:subagent-driven-development` — 子 Agent 驱动开发流程
- `superpowers:writing-plans` — 实施计划编写规范
- `superpowers:brainstorming` — 头脑风暴与需求澄清
- `superpowers:executing-plans` — 并行执行实施计划
- `superpowers:finishing-a-development-branch` — 分支收尾
- `superpowers:using-git-worktrees` — Git Worktree 隔离工作区
- `superpowers:test-driven-development` — 测试驱动开发
- `superpowers:systematic-debugging` — 系统化调试
- `superpowers:requesting-code-review` — 请求代码评审
- `superpowers:receiving-code-review` — 接收代码评审

**项目专属技能（在本目录）**：

| 技能名 | 触发场景 | 说明 |
|--------|----------|------|
| `contentforge` | "/contentforge"、自然语言内容生成 | 统一入口，自动判断原创/二创、平台 |

## Skill 目录结构

```
.claude/
  skills/
    contentforge/                  ← 自然语言统一入口（/contentforge）
      SKILL.md
    README.md                     ← 本文件
```

## SKILL.md 格式规范

参考标准模板（来源：[SKILL.md 文档书写规范](https://www.cnblogs.com/liuyanhang/p/19678364)）：

```yaml
---
name: [技能标识名]
description: [一句话描述功能 + 触发场景 + 核心价值]
version: 1.0.0
author: mark
---

# [技能名称]

## 角色定义
你是一名 [具体角色]，擅长 [核心能力]。

## 核心指令
请严格按照以下步骤执行任务：
1. **分析意图**：[步骤说明]
2. **查阅资料**：如果需要，读取 `references/[文件名]` 获取详细信息。
3. **执行操作**：运行 `scripts/[脚本名]` 处理数据。
4. **输出结果**：按照下方的输出格式要求生成回答。

## 输出格式
- 必须包含：[要素 A]、[要素 B]
- 风格：[专业/幽默/简洁]

## 示例
**用户输入**：[示例提问]
**你的回答**：[示例回答]

## 错误处理
如果遇到 [某种错误]，请 [执行某种操作]。
```

### 核心要求

- **YAML Frontmatter**：`name`（唯一标识）、`description`（触发条件，AI 据此判断是否调用）、`version`、`author`
- **description 写法**：功能 + 触发场景 + 核心价值，三要素缺一不可
- **核心指令**：用祈使句，每步清晰分条目
- **输出格式**：`必须包含` + `风格` 两部分
- **示例**：少样本学习，帮助 AI 理解实际触发词和期望输出格式
- **错误处理**：覆盖主要异常场景，给出明确处理方式
