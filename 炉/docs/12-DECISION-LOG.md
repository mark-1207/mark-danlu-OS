# 12 — 决策日志（Decision Log）

> 按时间倒序。每条决策简洁记录，详细 ADR 在 `decisions/D-*.md`。
> 维护：每次关键决策后追加。

---

## 2026-06-16

### 文档补漏 + 状态统一
- 多文档"待写"引用过期 → 已修复
- 14-TASKS.md / 15-ISSUES.md 状态对齐实际进度
- 详情见 `11-PROGRESS.md` 阶段 1

---

## 2026-06-15

### 6 层面对齐完成
- 边界 / 目标 / 架构 / 模块 / 技术 / 文档
- 详见 [00-PROJECT-OVERVIEW](00-PROJECT-OVERVIEW.md)

### 19 文档清单敲定
- 00-17 共 19 个文档 + `legacy/` + `decisions/`
- 8 个核心日常更新文档
- 详见 [00-PROJECT-OVERVIEW](00-PROJECT-OVERVIEW.md) 第十一节

### v2 / 长期规划拆分
- v2 = 单用户延伸（飞书表格配置 / 跨设备同步 / 阶段 2-3 学习）
- 长期 = v3+（多人使用 / 账号 / 权限 / Web 化 / 计费）
- 详见 [09-ROADMAP-V2](09-ROADMAP-V2.md) + [10-LONG-TERM-PLAN](10-LONG-TERM-PLAN.md)

### 经验教训沉淀
- F1-F11（用户反馈）+ D1-D9（开发习惯）+ P1-P14（项目专属）+ E1-E5（通用经验）
- 详见 [99-LESSONS-LEARNED](99-LESSONS-LEARNED.md)

---

## 2026-06-15（晚）

### 8 个核心日常更新文档确认
- MEMORY.md / TASKS.md / PROGRESS.md / DECISION-LOG.md / ISSUES.md / TECH-DEBT.md / MILESTONES.md / RELEASE-CHECKLIST.md
- v1 阶段全更，v2 阶段视情况精简

---

## 2026-06-15（下午）

### 思想模型框架 = 4 框架 + 5 策略模式
- 4 框架：问题解构 / 决策分析 / 系统思考 / 创新突破
- 5 策略：chain / parallel / nested / divergent→convergent / condition
- 详见 [99-LESSONS-LEARNED P10](99-LESSONS-LEARNED.md) + [02-ARCHITECTURE](02-ARCHITECTURE.md) 第 2.3 节

### 苏格拉底追问 = 3-5 轮 + 8 项产出
- 8 项产出：浅层/底层/诉求/风格/反共识/框架/风险/可证伪
- 详见 [99-LESSONS-LEARNED P11](99-LESSONS-LEARNED.md) + [02-ARCHITECTURE](02-ARCHITECTURE.md) 第 2.2 节

### L5 三子项 = 观点锐度 / 思想模型应用 / 事实准确性
- 详见 [99-LESSONS-LEARNED P12](99-LESSONS-LEARNED.md) + [02-ARCHITECTURE](02-ARCHITECTURE.md) 第 2.6 节

---

## 2026-06-15（中午）

### 7 步循环 = 命题输入/追问/蓝图/段位/草稿/打磨/沉淀
- 灵感拆 2、框架拆 2，其他不动
- 每步单一职责
- 详见 [99-LESSONS-LEARNED P5](99-LESSONS-LEARNED.md) + [02-ARCHITECTURE](02-ARCHITECTURE.md)

### 8 段 = 核心 5 + 可选 8（按内容类型推荐 2-4）
- 核心 5：钩子/反共识/案例/思想模型/金句收尾
- 详见 [99-LESSONS-LEARNED P11](99-LESSONS-LEARNED.md) + [02-ARCHITECTURE](02-ARCHITECTURE.md) 第 2.4 节

### 物理隔离 = 源项目 + 新项目独立迭代
- 不同 git 仓库
- 代码复制一次性，不双向同步
- 详见 [99-LESSONS-LEARNED P1](99-LESSONS-LEARNED.md)

---

## 2026-06-13

### 项目初始化
- 创建 炉 项目（CLAUDE.md / .gitignore）
- 深度理解 ContentForge + PRISM-OS

### 融合方向
- 选题为核心（PRISM 苏格拉底追问 + 思想模型）
- 写作为核心（ContentForge 多平台能力）
- 完整闭环：命题 → 创作 → 沉淀
