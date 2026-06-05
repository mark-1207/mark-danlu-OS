# ContentForge 安装指南

> 适用于新电脑初始化、项目迁移后重建

---

## 前置要求

- Node.js >= 20（建议 LTS）
- pnpm（推荐）或 npm
- 一个支持 OpenAI Compatible API 的 LLM 服务

---

## 第一步：复制项目

将项目目录整体复制到新电脑，建议放在 **不含中文的路径**下。

```
D:\Projects\contentforge\
```

> 注意：路径中不要有中文或特殊字符，否则可能导致构建或运行时问题。

---

## 第二步：安装依赖

进入项目目录，执行：

```bash
cd /path/to/contentforge
pnpm install
```

> 如果没有 pnpm，先安装：
> ```bash
> npm install -g pnpm
> ```

`package-lock.json`（pnpm 用 `pnpm-lock.yaml`）会确保依赖版本与开发环境完全一致。

---

## 第三步：配置环境变量

在项目根目录创建 `.env` 文件：

```bash
touch .env
```

内容：

```env
# 至少需要一个 LLM Provider，以下是配置示例

# 小米 API（主用）
KIAMI_API_KEY=sk-your-key-here
KIAMI_BASE_URL=https://api.xiaomimimo.com/v1

# Kimi API（备选）
KIMI_API_KEY=sk-your-key-here
KIMI_BASE_URL=https://api.moonshot.cn/v1

# OpenAI API（备选）
OPENAI_API_KEY=sk-your-key-here
OPENAI_BASE_URL=https://api.openai.com/v1

# Anthropic（可选）
# ANTHROPIC_API_KEY=sk-ant-your-key-here
```

> API Key 从对应平台获取。小米的 Key 在 [xiaomimimo.com](https://api.xiaomimimo.com) 获取。

---

## 第四步：检查配置文件

编辑 `config/contentforge.yaml`：

```yaml
# 你的默认 LLM Provider
defaultProvider: kimi

# Obsidian 知识库路径（新电脑如果路径不同需要修改）
obsidian:
  vaultPath: "d:/软件/obsidian笔记"   # ← 改成你的实际路径
  readDirs:
    - "40_知识库/原子库"
    - "40_知识库/洞察库"

# 如果用飞书功能，需要飞书应用凭证
lark:
  appId: "your-app-id"
  appSecret: "your-app-secret"
```

---

## 第五步：构建项目

```bash
pnpm run build
```

预期输出：

```
⚡ Build success in 200ms
✓ Copied templates to dist
✓ Copied strategies to dist
✓ Copied compliance data to dist
DTS Build success
```

---

## 第六步：验证运行

```bash
# 验证 CLI 可用
node dist/index.js --version

# 验证 LLM 连接
node dist/index.js skill "帮我写一篇关于AI时代的职场文章 发公众号" -- --no-interactive
```

预期：生成 `output/create_<timestamp>/` 目录，包含三平台文章。

---

## 常见问题

### 报错：`provider not found`

检查 `config/contentforge.yaml` 中的 `defaultProvider` 是否与 providers 中配置的 key 一致。

### 报错：`ObsidianReader: vault not found`

Obsidian 路径配置错误，或 vault 中没有 markdown 文件。修改 `config/contentforge.yaml` 中的 `vaultPath`。

### 报错：`Corpus directory not writable`

`output/` 目录没有写权限，或者路径含中文/空格。改为纯 ASCII 路径。

### 构建失败：`Cannot find module`

删除 `node_modules` 和 `dist`，重新 `pnpm install && pnpm run build`。

---

## 目录结构说明

```
contentforge/
├── src/               # 源代码
├── config/            # 配置文件（复制到新电脑需要检查）
├── data/             # 静态数据（合规词表等）
├── dist/              # 构建产物（自动生成）
├── output/           # 生成内容（运行时生成，可忽略）
├── package.json      # 依赖声明
├── pnpm-lock.yaml    # 锁文件（保证依赖版本一致）
├── .env              # 环境变量（创建，不进 git）
└── .gitignore        # 已配置
```

---

## 快速重建命令汇总

```bash
# 1. 安装依赖
pnpm install

# 2. 创建 .env
echo "KIAMI_API_KEY=sk-xxx" > .env

# 3. 修改 config/contentforge.yaml 中的 Obsidian 路径

# 4. 构建
pnpm run build

# 5. 验证
node dist/index.js --version
```