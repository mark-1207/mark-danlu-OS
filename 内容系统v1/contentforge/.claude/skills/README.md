# .claude/skills — ContentForge 项目技能目录

## 目录说明

本目录包含 ContentForge 项目的所有专属技能定义文件。

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
| `contentforge-recreate` | "二创"、"爆款改写" | 爆款文章差异化二创完整工作流 |
| `contentforge-learn` | "学习入库"、"更新碎片库" | 碎片库增量分析与维护管理 |

## 技能目录结构

```
.claude/
  skills/
    contentforge-recreate/
      SKILL.md                    ← 二创工作流规范
    contentforge-learn/
      SKILL.md                    ← 碎片库学习工作流规范
    README.md                     ← 本文件
```

## Skill 格式规范

参考 [SKILL.md 文档书写规范](https://www.cnblogs.com/liuyanhang/p/19678364)：

```yaml
---
name: skill-name
description: 一句话描述功能 + 触发场景 + 核心价值
version: 1.0.0
author: mark
---

# 技能名称

## 角色定义
...

## 核心指令
...

## 输出格式
...

## 示例
...

## 错误处理
...
```
