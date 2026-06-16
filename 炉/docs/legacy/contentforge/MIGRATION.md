# ContentForge 迁移指南（克隆范式）

> **目标**：把 contentforge 项目从旧电脑完整迁到新电脑，零代码改动、API Key 不丢、知识库/飞书表保持可用。
>
> **方案核心**：git clone 仓库 + 单独迁移 `.env` + 重建依赖与构建产物。

---

## 0. 迁移准备（旧电脑执行一次）

### 0.1 备份 `.env`（**必做，单独走安全通道**）

`.env` 含 6 个 API Key（Kimi / 小米 / Tavily / Serper / 智谱 / 飞书），**不**走 git，**不**走压缩包里的明文。

**操作**：
1. 打开 `D:\myproject\内容系统v1\contentforge\.env`
2. **完整复制**到 `env-backup-<日期>.txt`（或 1Password / 加密 U 盘）
3. 临时存放好，新电脑初始化时会用到

**注意**：当前 `.env` 已被父仓库 git 跟踪（`git status` 显示 M），属于历史遗留。**迁移完成、确认新电脑可跑后**，按 5.1 节处理。

### 0.2 提交并推送所有改动

```bash
cd D:\myproject\内容系统v1
git status                          # 看是否有未提交内容（contentforge/ 之外的项目改动也确认下）
git add .
git commit -m "chore: 迁移前最终备份"
git push origin main
```

> 如果 push 失败（无网络/凭据过期），跳过 — 0.3 步骤用本地 tarball 兜底。

### 0.3 确认远程地址

```bash
git remote -v
# 预期输出：
# origin  https://github.com/mark-1207/content-rewrite-workshop.git (fetch)
# origin  https://github.com/mark-1207/content-rewrite-workshop.git (push)
```

**记下这个 URL**，新电脑 clone 时用。

### 0.4 兜底：本地 tarball（可选但推荐）

以防网络或权限问题，新电脑拿不到代码：

```bash
# 在项目根目录父级执行（D:\myproject\）
cd D:\myproject
tar --exclude='node_modules' --exclude='dist' --exclude='output' `
    --exclude='*.log' --exclude='.DS_Store' `
    -czf contentforge-backup-<日期>.tar.gz 内容系统v1

# 或用 PowerShell
Compress-Archive -Path "D:\myproject\内容系统v1" `
    -DestinationPath "D:\contentforge-backup-<日期>.zip"
```

---

## 1. 新电脑初始化（**新电脑上从这一节开始执行**）

### 1.1 安装基础环境

| 工具 | 版本要求 | 安装方式（Windows） | 安装方式（Mac） |
|------|---------|------------------|----------------|
| **Node.js** | >= 20 LTS | [nodejs.org](https://nodejs.org) 下载 LTS；或 `winget install OpenJS.NodeJS.LTS` | `brew install node@20` 或官网 pkg |
| **pnpm** | 10.x | `npm install -g pnpm@10.33.0` | 同左 |
| **Git** | 最新稳定 | `winget install Git.Git` | `brew install git` |
| **Xcode CLT** | — | — | `xcode-select --install`（Mac 必需） |

**验证**：
```bash
node --version    # 期望 v20.x 或 v24.x
pnpm --version    # 期望 10.x
git --version     # 期望 2.x+
```

> **不要**用 `npm install -g pnpm` 不带版本号，会装到 9.x 出现 lockfile 不兼容警告。

### 1.2 Clone 仓库

```bash
# Windows
cd D:\
git clone https://github.com/mark-1207/content-rewrite-workshop.git 内容系统v1
cd 内容系统v1\contentforge

# Mac
cd ~/Projects
git clone https://github.com/mark-1207/content-rewrite-workshop.git content-rewrite-workshop
cd content-rewrite-workshop/contentforge
```

> 旧电脑路径含中文是为了"看着舒服"。新电脑建议**用纯 ASCII 路径**（`D:\Projects\...` 或 `~/Projects/...`），避免 Node 工具链偶发的中文路径 bug。

### 1.3 恢复 `.env`

**方式 A（推荐）**：从 0.1 备份恢复
```bash
# 把 env-backup-<日期>.txt 内容直接写入
cp /path/to/env-backup-<日期>.txt .env
```

**方式 B**：从 0.4 的 tarball/zip 提取
```bash
# tarball 路径不包含 .env（被 --exclude 排除），需要从备份 txt 恢复
```

**验证 `.env` 完整**（必须 6 个 Key 都在）：
```bash
grep -E "^(KIMI_API_KEY|OPENAI_API_KEY|TAVILY_API_KEY|SERPER_API_KEY|ZHIPU_API_KEY|FEISHU_)" .env | wc -l
# 期望输出 9（KIMI/KIMI_BASE_URL/KIMI_MODEL + OPENAI/OPENAI_BASE_URL/MIMO_MODEL_LIGHT/MIMO_MODEL_HEAVY + TAVILY + SERPER + ZHIPU + 6 个 FEISHU_ 字段）
```

### 1.4 调整 Obsidian 路径

新电脑的 Obsidian vault 路径大概率不同，**必须改**：

```bash
# 编辑 config/contentforge.yaml
# 找到 obsidian.vaultPath，改成新电脑的实际路径

# Windows 示例
obsidian:
  vaultPath: "d:/ObsidianVault"          # ← 用斜杠，不用反斜杠
  readDirs:
    - "40_知识库/原子库"
    - "40_知识库/洞察库"

# Mac 示例
obsidian:
  vaultPath: "/Users/<你的用户名>/Documents/ObsidianVault"
  readDirs:
    - "40_知识库/原子库"
    - "40_知识库/洞察库"
```

> **如果新电脑暂时不连 Obsidian**，这一节可先跳过 — 不影响创建/分析/抓取流程，只影响"知识迁移素材"注入。

### 1.5 安装依赖

```bash
pnpm install
```

**预期**：下载 ~155M 的 `node_modules/`，耗时 1-3 分钟（取决于网络）。

**如果失败**：
| 报错 | 处理 |
|------|------|
| `ERR_PNPM_PEER_DEP_ISSUES` | 警告而非错误，可忽略 |
| `EACCES: permission denied` | Mac/Linux 用 `sudo chown -R $USER ~/.pnpm-store` |
| 网络超时 | 设置国内镜像：`pnpm config set registry https://registry.npmmirror.com` |

### 1.6 构建

```bash
pnpm run build
```

**预期输出**：
```
⚡ Build success in 200ms
✓ Copied templates to dist
✓ Copied strategies to dist
✓ Copied compliance data to dist
DTS Build success
```

### 1.7 跑 TDD 验证

```bash
pnpm test
```

**预期**：所有测试通过（contentforge + 爆款素材库 + 观点文 + embedding = 应有 60+ 测试用例）。

如果失败，**先看错误信息**，常见原因：环境变量缺失、Obsidian 路径错误、Node 版本不对。

### 1.8 冒烟验证

```bash
# 1. CLI 可用
node dist/index.js --version
# 期望: 0.1.0 之类

# 2. 读偏好（不需要 LLM）
node dist/index.js learn --show-preferences

# 3. 最小流程（触发一次 LLM 调用）
node dist/index.js skill "写一句关于AI的问候 发公众号" -- --no-interactive
# 期望: output/ 下生成文章，exit code 0
```

---

## 2. 资产恢复（飞书 + Obsidian）

### 2.1 飞书表（**自动恢复**）

`.env` 里包含三张飞书表的凭证：
- 竞品表（`FEISHU_TOPIC_TABLE_*`）
- 反馈表（`FEISHU_FEEDBACK_TABLE_*`）
- 爆款素材库（`FEISHU_VIRAL_LIBRARY_*`）

**无需任何额外操作**，新电脑跑 `node dist/index.js topic scrape --url "..."` 就能写同一张表。

### 2.2 Obsidian 知识库（**手动同步**）

Obsidian 数据在 vault 里（如 `d:/软件/obsidian笔记/`），**不在 contentforge 仓库内**。

**两种处理**：

**A. 整个 vault 同步**（推荐）
- 用 Obsidian 官方的 [Syncthing](https://syncthing.net/) / [Remotely Save](https://github.com/remotely-save/remotely-save) 插件 / iCloud / OneDrive，把 vault 整个同步到新电脑
- 然后把 1.4 节的 `vaultPath` 指向新电脑的 vault 位置

**B. 只同步知识库子目录**
- 单独打包 `d:/软件/obsidian笔记/40_知识库/` 传输
- 复制到新电脑对应位置
- 把 `vaultPath` 改到新电脑的 vault 路径（其它目录可以空着）

### 2.3 飞书 + Obsidian 联动验证

跑一个完整流程，确认两套系统都通：

```bash
# 抓一篇竞品文章（飞书写入）
node dist/index.js topic scrape --url "https://mp.weixin.qq.com/s/xxxxx"

# AI 分析（飞书状态更新）
node dist/index.js learn --analyze

# 提取碎片 → Obsidian（依赖 vault 路径正确）
node dist/index.js learn --extract-fragments --obsidian

# 验证 Obsidian 写入
# 打开 Obsidian，看 40_知识库/原子库/ 下是否多了新文件
```

---

## 3. Windows → Mac 专项

如果新电脑是 Mac，前述步骤**完全一样**，只需额外注意：

### 3.1 路径分隔符
- 代码内部用 `path.join()` 处理，**不**需要改源码
- 配置文件（`config/contentforge.yaml`）中的 `vaultPath` 用 **正斜杠** `/`（如 `/Users/x/Documents/Vault`）

### 3.2 `autocli.exe` 不可用
- `autocli.exe` 是 Windows 二进制，**Mac 不能跑**
- 抓取走 `wechat-article-extractor` skill 降级方案（已实现于 `src/scenarios/topic/scraper.ts`）
- 验证降级链路：
  ```bash
  node dist/index.js topic scrape --url "https://mp.weixin.qq.com/s/xxxxx" -- --no-interactive
  # 不依赖 autocli.exe
  ```

### 3.3 行尾符
- 项目文件都是 LF（`pnpm-lock.yaml` 强制）
- Mac Git 默认 `core.autocrlf=input`，无需配置

### 3.4 原生模块重编译
- `tiktoken` 等含原生绑定，跨平台需重装
- 如果遇到 `NODE_MODULE_VERSION` 不匹配：
  ```bash
  rm -rf node_modules
  pnpm install
  pnpm run build
  ```

### 3.5 建议目录
```bash
mkdir -p ~/Projects
cd ~/Projects
git clone https://github.com/mark-1207/content-rewrite-workshop.git
# 完整路径: ~/Projects/content-rewrite-workshop/contentforge
```

---

## 4. 验证清单（**逐项打勾**）

| # | 验证项 | 命令 | 预期 |
|---|--------|------|------|
| 1 | Node 版本 | `node --version` | v20+ |
| 2 | pnpm 版本 | `pnpm --version` | 10.x |
| 3 | 仓库克隆 | `git log --oneline -5` | 有 commit 历史 |
| 4 | `.env` 完整 | `grep -c "API_KEY" .env` | >= 5 |
| 5 | 依赖装好 | `ls node_modules/.pnpm | head` | 大量包 |
| 6 | 构建产物 | `ls dist/index.js` | 存在 |
| 7 | TDD 通过 | `pnpm test 2>&1 | tail -5` | all passed |
| 8 | CLI 可用 | `node dist/index.js --version` | 输出版本号 |
| 9 | 偏好读取 | `node dist/index.js learn --show-preferences` | 表格输出 |
| 10 | LLM 连通 | `node dist/index.js skill "test" -- --no-interactive` | exit 0 |
| 11 | Obsidian 路径 | 编辑 1.4 节的 vaultPath | 与新电脑一致 |
| 12 | 飞书写入 | topic scrape 一次 | 飞书多一条记录 |
| 13 | Obsidian 写入 | extract-fragments 一次 | vault 多一个 .md |

---

## 5. 迁移后必做（**5 分钟搞定**）

### 5.1 取消 `.env` 跟踪（强烈建议）

旧电脑 `.env` 已被 git 跟踪，**API Key 实际上被 push 到 GitHub 了**。处理：

**第一步**：从 git 历史里删除（防止别人 fork 看到）
```bash
cd D:\myproject\内容系统v1

# 确认 .env 真在跟踪
git ls-files contentforge/.env

# 从 HEAD 移除（保留本地文件）
git rm --cached contentforge/.env

# 确认 .gitignore 已包含 .env（项目根 .gitignore 第 13 行已有）
grep "^\.env$" .gitignore

# 提交
git commit -m "chore: 取消 .env 跟踪，避免 API key 泄露"
git push
```

**第二步**：**轮换所有 API Key**（最关键）
- Kimi: [platform.moonshot.cn](https://platform.moonshot.cn) → 重新生成
- 小米 MIMO: [xiaomimimo.com](https://api.xiaomimimo.com) → 重新生成
- Tavily: [tavily.com](https://tavily.com) → 重新生成
- Serper: [serper.dev](https://serper.dev) → 重新生成
- 智谱: [bigmodel.cn](https://bigmodel.cn) → 重新生成
- 飞书: 在 [飞书开放平台](https://open.feishu.cn) 重置 app secret

**第三步**：新电脑用新 Key 更新 `.env`

> 这一步**不能省**。`.env` 在 GitHub 历史里，**等于公开了**，必须轮换。

### 5.2 清理临时文件

```bash
# 删除构建/临时产物（在新电脑上）
cd contentforge
rm -rf dist output

# 重新构建（确认干净环境也能跑通）
pnpm install
pnpm run build
pnpm test
```

### 5.3 同步 MEMORY（可选）

`C:\Users\admin\.claude\projects\D--myproject\memory\` 里的 `projects_contentforge.md` 等**不会**自动同步。

**选项**：
- **A. 不带** — 新电脑重新积累（项目核心信息已在本文件 + INSTALL.md + workflow-documentation.md 中）
- **B. 手动同步** — 把整个 `memory/` 目录打包带过去

---

## 6. 快速命令汇总（**复制即用**）

### 6.1 Windows 新电脑
```powershell
# 环境
winget install OpenJS.NodeJS.LTS
npm install -g pnpm@10.33.0

# Clone + 初始化
cd D:\Projects
git clone https://github.com/mark-1207/content-rewrite-workshop.git 内容系统v1
cd 内容系统v1\contentforge

# 恢复 .env（从备份）
Copy-Item D:\env-backup-2026xxxx.txt .env

# 装依赖 + 构建 + 测试
pnpm install
pnpm run build
pnpm test

# 冒烟
node dist/index.js --version
node dist/index.js learn --show-preferences
```

### 6.2 Mac 新电脑
```bash
# 环境
brew install node@20 git
xcode-select --install
npm install -g pnpm@10.33.0

# Clone + 初始化
mkdir -p ~/Projects && cd ~/Projects
git clone https://github.com/mark-1207/content-rewrite-workshop.git
cd content-rewrite-workshop/contentforge

# 恢复 .env
cp /path/to/env-backup-2026xxxx.txt .env

# 装依赖 + 构建 + 测试
pnpm install
pnpm run build
pnpm test

# 冒烟
node dist/index.js --version
node dist/index.js learn --show-preferences
```

---

## 7. 常见问题（FAQ）

### Q1: `pnpm install` 提示 `ERR_PNPM_BAD_PM_VERSION`
**原因**：pnpm 版本与 `packageManager` 字段不匹配。
**解决**：`npm install -g pnpm@10.33.0`（精确版本）。

### Q2: 构建报 `Cannot find module 'xxx'`
**解决**：
```bash
rm -rf node_modules dist
pnpm install
pnpm run build
```

### Q3: 测试报 `ObsidianReader: vault not found`
**原因**：`config/contentforge.yaml` 的 `vaultPath` 路径不对。
**解决**：检查路径是否存在、是否用正斜杠、Obsidian vault 里是否有 `.obsidian/` 目录。

### Q4: LLM 调用 401/403
**原因**：API Key 失效或没轮换。
**解决**：检查 `.env` 各 Key，必要时按 5.1 节重新生成。

### Q5: 飞书写入失败
**原因**：
- `.env` 中 `FEISHU_*_APP_TOKEN` / `TABLE_ID` 漏配或错配
- 飞书 app 没有该表的写入权限
- 网络无法访问 `open.feishu.cn`

**解决**：先确认 `.env` 完整（6 个 FEISHU_ 字段），再用浏览器登录飞书开放平台确认 app 状态。

### Q6: Mac 上 `autocli.exe` 报错
**原因**：Mac 不能跑 Windows .exe。
**解决**：跳过 autocli 路径，走 skill 降级（已自动启用）。

### Q7: git clone 提示 `Repository not found`
**原因**：仓库是私有的，需要 GitHub 凭据。
**解决**：
- 旧电脑先 `git push` 确认代码在远程
- 新电脑配置 SSH key：`ssh-keygen` + 把公钥加到 GitHub Settings → SSH keys
- 或用 HTTPS + Personal Access Token

---

## 8. 迁移时间预估

| 阶段 | Windows 同构 | Windows → Mac |
|------|------------|--------------|
| 装环境（Node/pnpm/Git） | 5 分钟 | 10 分钟（含 Xcode CLT） |
| git clone | 2-5 分钟 | 2-5 分钟 |
| `pnpm install` | 1-3 分钟 | 1-3 分钟 |
| `pnpm run build` | 10 秒 | 10 秒 |
| `pnpm test` | 30 秒 | 30 秒 |
| `.env` 恢复 + Obsidian 路径调整 | 5 分钟 | 5 分钟 |
| 飞书 + Obsidian 资产同步 | 10-30 分钟 | 10-30 分钟（看 vault 大小） |
| **合计** | **~30 分钟** | **~45 分钟** |

---

## 9. 完成后第一次跑

```bash
# 原创生成（最常用）
node dist/index.js skill "AI时代职场人该学什么 发公众号"

# 爆款二创
node dist/index.js recreate -i article.md

# 观点文（问号结尾或挑战词触发）
node dist/index.js skill "AI让谁变富了？发公众号"
```

跑通就完事了。

---

**关键提醒**：
1. `.env` **单独走安全通道**，不要 git push
2. 迁移后**立即轮换所有 API Key**（`.env` 已被推到 GitHub，必须视为泄露）
3. Mac 端 `autocli.exe` 不可用，走 skill 降级
4. Obsidian vault 路径必须改，其它路径不挑

有问题随时问，迁移过程中任何报错贴上来。
