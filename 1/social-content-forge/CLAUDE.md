---
name: social-content-forge
description: 社媒内容多平台生成流水线。当用户明确表达以下意图时触发：生成多平台内容、创作公众号/小红书/Twitter文章、将素材分发到多个社媒平台、内容跨平台改写、多平台分发。不包括纯写作任务（如写邮件、写简历）或单平台简单写作请求。
---

# Social Content Forge

将任意输入转化为多平台高质量内容的流水线。目标：产出真正能爆的内容，而非量产垃圾。

## 项目状态: MVP 完成 ✅

所有核心功能已实现并测试通过。

## 目录结构

```
social-content-forge/
├── SKILL.md                    # Skill入口
├── CLAUDE.md                   # 本文件
├── package.json
├── tsconfig.json
├── .env                        # 环境变量（已配置）
├── scripts/
│   ├── test-feishu.ts         # 飞书配置验证
│   └── get-feishu-fields.ts   # 获取字段信息
├── src/
│   ├── cli.ts                  # CLI入口
│   ├── index.ts                # 主流水线
│   ├── types.ts               # 类型定义
│   ├── extractor/             # 内容提取
│   ├── analyzer/              # 内容分析
│   ├── evaluator/             # 质量评估
│   ├── adapters/              # 平台适配器
│   │   ├── types.ts
│   │   ├── wechat/
│   │   ├── xiaohongshu/
│   │   └── twitter/
│   ├── llm/                   # LLM路由 (GLM-4)
│   └── db/                    # SQLite数据库
├── integrations/feishu/       # 飞书集成
└── data/output/              # 输出文件
```

## 工作流程

```
Step 1: 输入识别 (URL/主题/素材)
    ↓
Step 2: 内容分析 (GLM-4 深度理解)
    ↓
Step 3: 六维度质量评估 (0-100分)
    ↓
Step 4: 三平台内容适配
    ├─ 微信公众号 (1500-2500字)
    ├─ 小红书 (600-1000字)
    └─ Twitter (≤280字)
    ↓
Step 5: 输出
    ├─ .md 文件 (data/output/)
    ├─ SQLite 本地存储
    └─ 飞书多维表格同步
```

## 执行命令

```bash
cd social-content-forge

# 运行CLI（自动同步飞书）
npm run cli -- "你的主题"

# 禁用飞书同步
npm run cli -- --no-sync-feishu "你的主题"

# 开发模式
npm run dev
```

## 环境变量

```env
# 飞书配置
FEISHU_APP_ID=cli_a937bd1eba781bb3
FEISHU_APP_SECRET=***
FEISHU_APP_TOKEN=TPPKbMXuQaHqBnsa8HFcrP8gnsf
FEISHU_TABLE_ID=tblYTDnJZuHuiBNa

# LLM配置 (智谱 GLM-4)
ZHIPU_API_KEY=***

# 数据库
DATABASE_PATH=./data/content.db
OUTPUT_DIR=./data/output
```

## LLM路由

| 任务 | 模型 | 状态 |
|------|------|------|
| 内容分析 | GLM-4 | ✅ |
| 质量评估 | GLM-4 | ✅ |
| 微信公众号 | GLM-4 | ✅ |
| 小红书 | GLM-4 | ✅ |
| Twitter | GLM-4 | ✅ |

## 已验证功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 内容提取 | ✅ | 支持URL/主题/素材 |
| 内容分析 | ✅ | GLM-4 深度解码 |
| 六维度评分 | ✅ | 自动生成诊断报告 |
| 微信公众号适配 | ✅ | 1500-2500字 |
| 小红书适配 | ✅ | 600-1000字 + 标签 |
| Twitter适配 | ✅ | ≤280字 |
| SQLite存储 | ✅ | 本地持久化 |
| 飞书同步 | ✅ | 多维表格自动同步 |

## 质量评估体系

| 维度 | 权重 | 决策阈值 |
|------|------|---------|
| 情绪激发度 | 25% | ≥80分直接适配 |
| 实用价值 | 25% | 60-79优化后适配 |
| 叙事结构 | 20% | <60建议重构 |
| 社交货币 | 15% | |
| 争议引导 | 10% | |
| 时效贴切 | 5% | |

## 技术栈

- **运行时**: Node.js + TypeScript
- **LLM**: 智谱 GLM-4
- **数据库**: sql.js (纯JS SQLite)
- **HTTP**: axios
- **飞书**: Open API v1

## 下一步优化方向

1. **提升内容质量** - 优化 prompt，减少 JSON 解析失败
2. **增加测试用例** - 用 skill-creator 工作流验证
3. **扩展平台** - 抖音、知乎等
4. **自动化发布** - 各平台官方API

---

详细模块说明见各目录的 `CLAUDE.md`。
