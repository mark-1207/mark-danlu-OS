# ContentForge 迁移指南（Mac 专属版）

> **目标**：把 contentforge 项目从旧 Windows 电脑完整迁到新 Mac（macOS），零代码改动、API Key 不丢、知识库/飞书表保持可用。
>
> **方案核心**：`git clone` 仓库 + 单独迁移 `.env` + 重建依赖与构建产物。
>
> **区别于 Windows 版**：全程使用 bash + Homebrew，路径全部 Unix 风格，Bun 标为**必装**（stop hook 依赖）。

---

## 0. 迁移准备（旧 Windows 电脑上执行一次）

### 0.1 备份 `.env`（**必做，单独走安全通道**）

`.env` 含 6 个 API Key（Kimi / 小米 / Tavily / Serper / 智谱 / 飞书），**不**走 git，**不**走压缩包里的明文。

**操作**：
1. 打开 `D:\myproject\内容系统v1\contentforge\.env`
2. **完整复制**到 `env-backup-<日期>.txt`（或 1Password / 加密 U 盘）
3. 临时存放好，Mac 初始化时会用到

**传输到 Mac**：
- U 盘 / AirDrop / 微信文件传输助手 / 1Password 跨设备同步 / iCloud Drive
- **不要**通过邮件正文发送（明文留存）

> 当前 `.env` 已被父仓库 git 跟踪（`git status` 显示 M），属于历史遗留。**迁移完成、确认 Mac 可跑后**，按 5.1 节处理。

### 0.2 提交并推送所有改动

```powershell
cd D:\myproject\内容系统v1
git status
git add .
git commit -m "chore: 迁移前最终备份"
git push origin main
```

> 如果 push 失败（无网络/凭据过期），跳过 — 0.3 步骤用本地 tarball 兜底。

### 0.3 确认远程地址

```powershell
git remote -v
# 预期输出：
# origin  https://github.com/mark-1207/content-rewrite-workshop.git (fetch)
# origin  https://github.com/mark-1207/content-rewrite-workshop.git (push)
```

**记下这个 URL**，Mac clone 时用。

### 0.4 兜底：本地 tarball（可选但推荐）

```powershell
# PowerShell（Windows 旧电脑）
Compress-Archive -Path "D:\myproject\内容系统v1" `
    -DestinationPath "D:\contentforge-backup-<日期>.zip"
```

把 zip 拷到 Mac（U 盘 / AirDrop）。

---

## 1. Mac 初始化（**新 Mac 上从这一节开始执行**）

### 1.1 安装基础环境

#### 1.1.1 Xcode Command Line Tools（**先装这个**）

打开 Terminal.app，执行：

```bash
xcode-select --install
```

会弹出系统对话框，点"安装"等 5-10 分钟。**这步不能跳**——后面 `pnpm install` 时 `tiktoken` 等原生模块需要编译器。

#### 1.1.2 Homebrew（Mac 包管理器）

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

装完后按提示把 brew 加到 PATH（Apple Silicon）：

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

**验证**：`brew --version` 应输出 4.x+。

#### 1.1.3 Node.js 20+ LTS

```bash
brew install node@20
echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

> Apple Silicon 路径是 `/opt/homebrew/`；Intel Mac 是 `/usr/local/`。`brew --prefix` 可查。
> 如果你已经用 `nvm` / `fnm` / `volta` 管理 Node，跳过这步，但确保版本 ≥ 20。

**验证**：`node --version` 期望 v20.x 或 v24.x。

#### 1.1.4 pnpm 10.33.0

```bash
npm install -g pnpm@10.33.0
```

> **不要**用 `npm install -g pnpm`（不带版本号），会装到 9.x 出现 lockfile 不兼容。

**验证**：`pnpm --version` 期望 10.33.0。

#### 1.1.5 Git

```bash
brew install git
```

> macOS 自带 Git 但版本老，建议覆盖装新版。

**验证**：`git --version` 期望 2.40+。

#### 1.1.6 Bun（**必装，不是可选**）

Stop hook 依赖 Bun，**必须装**：

```bash
curl -fsSL https://bun.sh/install | bash
```

装完**新开一个 Terminal.app 窗口**（PATH 才生效）。

**验证**：
```bash
bun --version
which bun
# 期望：~/.bun/bin/bun
```

### 1.2 Clone 仓库

```bash
mkdir -p ~/Projects
cd ~/Projects
git clone https://github.com/mark-1207/content-rewrite-workshop.git
cd content-rewrite-workshop/contentforge
```

> 建议放 `~/Projects/` 等纯 ASCII 路径。**避免**放在 `~/Documents/`（iCloud 同步会污染 node_modules）和 `~/Desktop/`（路径含中文时偶发 bug）。

### 1.3 恢复 `.env`

**方式 A**（推荐）：从 0.1 备份恢复
```bash
cp /path/to/env-backup-<日期>.txt .env
```

**方式 B**：从 0.4 的 zip 提取
```bash
unzip ~/Downloads/contentforge-backup-<日期>.zip -d /tmp/cf-extract
cp /tmp/cf-extract/内容系统v1/contentforge/.env .env
```

**验证 `.env` 完整**：
```bash
grep -E "^(KIMI_API_KEY|OPENAI_API_KEY|TAVILY_API_KEY|SERPER_API_KEY|ZHIPU_API_KEY|FEISHU_)" .env | wc -l
# 期望输出 9
```

### 1.4 调整 Obsidian 路径

```bash
# 编辑 config/contentforge.yaml
# 找到 obsidian.vaultPath，改成 Mac 的实际路径

obsidian:
  vaultPath: "/Users/<你的用户名>/Documents/ObsidianVault"
  # 或 iCloud 同步的 vault
  # vaultPath: "/Users/<你的用户名>/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault"
  readDirs:
    - "40_知识库/原子库"
    - "40_知识库/洞察库"
```

> **如果新 Mac 暂时不连 Obsidian**，这一节可先跳过 — 不影响创建/分析/抓取流程。

### 1.5 安装依赖

```bash
pnpm install
```

**预期**：下载 ~155M 的 `node_modules/`，耗时 1-3 分钟。

**如果失败**：
| 报错 | 处理 |
|------|------|
| `ERR_PNPM_PEER_DEP_ISSUES` | 警告而非错误，可忽略 |
| `EACCES: permission denied` | `sudo chown -R $(whoami) ~/.pnpm-store` |
| 找不到 `python` / `make` | Xcode CLT 没装，回 1.1.1 |
| 网络超时 | `pnpm config set registry https://registry.npmmirror.com` |

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

如果失败，先看错误信息。

### 1.8 冒烟验证

```bash
# 1. CLI 可用
node dist/index.js --version

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

**无需任何额外操作**，Mac 跑 `node dist/index.js topic scrape --url "..."` 就能写同一张表。

### 2.2 Obsidian 知识库（**手动同步**）

#### A. iCloud 同步整个 vault（最简单）

如果旧电脑 Obsidian vault 已经在 iCloud 上：
- Mac 登录相同 Apple ID，开 Obsidian → vault 自动出现
- 把 1.4 节的 `vaultPath` 指向 iCloud vault 路径

#### B. Obsidian Sync 官方服务（跨平台推荐）

- 旧电脑 Obsidian → Settings → Sync → 启用 + 选择 vault
- Mac Obsidian → Settings → Sync → 登录相同账号 → 选 vault
- 同步完成后调整 1.4 节的 `vaultPath`

#### C. 手动打包传输

```bash
# 旧 Windows 电脑
Compress-Archive -Path "d:\软件\obsidian笔记\40_知识库" -DestinationPath "D:\obsidian-kb.zip"

# Mac
unzip ~/Downloads/obsidian-kb.zip -d ~/Documents/ObsidianVault/
# 然后调整 vaultPath 指向 ~/Documents/ObsidianVault
```

### 2.3 飞书 + Obsidian 联动验证

```bash
# 抓一篇竞品文章
node dist/index.js topic scrape --url "https://mp.weixin.qq.com/s/xxxxx"

# AI 分析
node dist/index.js learn --analyze

# 提取碎片 → Obsidian
node dist/index.js learn --extract-fragments --obsidian

# 验证 Obsidian 写入
open ~/Documents/ObsidianVault/40_知识库/原子库/
```

---

## 3. Mac 专项注意

### 3.1 `autocli.exe` 不可用

`autocli.exe` 是 Windows 二进制，**Mac 不能跑**。

**抓取走 skill 降级**（已自动启用，无需配置）：
- 走 `wechat-article-extractor` skill
- 实现位置：`src/scenarios/topic/scraper.ts`

**验证降级链路**：
```bash
node dist/index.js topic scrape --url "https://mp.weixin.qq.com/s/xxxxx" -- --no-interactive
```

### 3.2 原生模块重编译

`pnpm install` 会自动为 macOS 平台重新编译 `tiktoken` 等含原生绑定的包。

如果遇到 `NODE_MODULE_VERSION` 不匹配：
```bash
rm -rf node_modules
pnpm install
pnpm run build
```

### 3.3 Apple Silicon vs Intel

| 差异 | 处理 |
|------|------|
| Homebrew 路径 | Apple Silicon: `/opt/homebrew/`，Intel: `/usr/local/` |
| `arch` 命令 | `arm64`（M1/M2/M3）vs `x86_64`（Intel） |
| Rosetta 2 | 装 x86 应用时需要，但本项目纯 JS 不需要 |

**确认架构**：
```bash
uname -m
# arm64 = Apple Silicon
# x86_64 = Intel
```

### 3.4 行尾符

项目文件都是 LF。Mac Git 默认 `core.autocrlf=input`，**无需配置**。

如果 Windows 工具（VSCode Windows 版、Notepad）把某些文件改成 CRLF：
```bash
# 在仓库根目录执行
git config core.autocrlf input
# 已跟踪文件批量转 LF
find . -type f \( -name "*.ts" -o -name "*.md" -o -name "*.json" \) -exec dos2unix {} \;
# 没装 dos2unix 可用：
brew install dos2unix
```

### 3.5 macOS 权限与 Gatekeeper

第一次跑 `node` / `pnpm` / `git` 之类从互联网下载的命令，Gatekeeper 可能拦截：
- 系统设置 → 隐私与安全性 → 仍要打开

**Homebrew 安装的命令不会触发**（因为从 App Store 认证的源）。

### 3.6 iCloud 路径注意

如果 vault 在 iCloud Drive，路径长这样：
```
/Users/<user>/Library/Mobile Documents/iCloud~md~obsidian/Documents/<VaultName>/
```

iCloud 同步会冲突 `node_modules`，**不要**把 contentforge 项目放在 iCloud 同步目录里。

### 3.7 端口与代理

如果使用代理（公司网络常见）：
```bash
# ~/.zshrc
export HTTP_PROXY=http://127.0.0.1:7890
export HTTPS_PROXY=http://127.0.0.1:7890
```

Git、pnpm、curl 默认会读这两个变量。

---

## 4. 验证清单（**逐项打勾**）

| # | 验证项 | 命令 | 预期 |
|---|--------|------|------|
| 1 | macOS 版本 | `sw_vers` | 12+ (Monterey) |
| 2 | 架构 | `uname -m` | arm64 / x86_64 |
| 3 | Xcode CLT | `xcode-select -p` | `/Library/Developer/CommandLineTools` |
| 4 | Homebrew | `brew --version` | 4.x+ |
| 5 | Node 版本 | `node --version` | v20+ |
| 6 | pnpm 版本 | `pnpm --version` | 10.33.0 |
| 7 | Git 版本 | `git --version` | 2.40+ |
| 8 | Bun 版本 | `bun --version` | 1.x+ |
| 9 | 仓库克隆 | `git log --oneline -5` | 有 commit 历史 |
| 10 | `.env` 完整 | `grep -c "API_KEY" .env` | >= 5 |
| 11 | 依赖装好 | `ls node_modules/.pnpm \| head` | 大量包 |
| 12 | 构建产物 | `ls dist/index.js` | 存在 |
| 13 | TDD 通过 | `pnpm test 2>&1 \| tail -5` | all passed |
| 14 | CLI 可用 | `node dist/index.js --version` | 输出版本号 |
| 15 | 偏好读取 | `node dist/index.js learn --show-preferences` | 表格输出 |
| 16 | LLM 连通 | `node dist/index.js skill "test" -- --no-interactive` | exit 0 |
| 17 | Obsidian 路径 | 编辑 1.4 节的 vaultPath | 与新 Mac 一致 |
| 18 | 飞书写入 | topic scrape 一次 | 飞书多一条记录 |
| 19 | Obsidian 写入 | extract-fragments 一次 | vault 多一个 .md |

---

## 5. 迁移后必做（**5 分钟搞定**）

### 5.1 取消 `.env` 跟踪 + 轮换 API Key（**强烈建议**）

旧电脑 `.env` 已被 git 跟踪并 push 到 GitHub，**API Key 视为泄露**。

#### 第一步：从 git 历史里删除（旧 Windows 电脑）

```powershell
cd D:\myproject\内容系统v1

# 确认 .env 真在跟踪
git ls-files contentforge/.env

# 从 HEAD 移除（保留本地文件）
git rm --cached contentforge/.env

# 确认 .gitignore 已包含 .env
Select-String "^\.env$" .gitignore

# 提交并推送
git commit -m "chore: 取消 .env 跟踪，避免 API key 泄露"
git push
```

#### 第二步：轮换所有 API Key（**最关键**）

| 服务 | 地址 | 操作 |
|------|------|------|
| Kimi | https://platform.moonshot.cn | 重新生成 |
| 小米 MIMO | https://api.xiaomimimo.com | 重新生成 |
| Tavily | https://tavily.com | 重新生成 |
| Serper | https://serper.dev | 重新生成 |
| 智谱 | https://bigmodel.cn | 重新生成 |
| 飞书 | https://open.feishu.cn | 重置 app secret |

#### 第三步：Mac 用新 Key 更新 `.env`

```bash
cd ~/Projects/content-rewrite-workshop/contentforge
nano .env
# 把 6 个 API Key 替换成新生成的
```

> **这一步不能省**。`.env` 在 GitHub 历史里，等于公开了，必须轮换。

### 5.2 清理临时文件

```bash
cd ~/Projects/content-rewrite-workshop/contentforge
rm -rf dist output
pnpm install
pnpm run build
pnpm test
```

### 5.3 同步 MEMORY（可选）

`C:\Users\admin\.claude\projects\D--myproject\memory\` 里的项目记忆**不**自动同步。

**选项**：
- **A. 不带** — Mac 重新积累（核心信息已在本文件 + INSTALL.md + workflow-documentation.md 中）
- **B. 手动同步** — 把整个 `memory/` 目录打包带到 `~/Users/admin/.claude/projects/D--myproject/memory/`

---

## 6. 快速命令汇总（**复制即用**）

```bash
# === 一次性环境准备 ===
xcode-select --install
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

brew install node@20 git
echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

npm install -g pnpm@10.33.0

curl -fsSL https://bun.sh/install | bash
# 关闭并重开 Terminal.app

# === Clone + 初始化 ===
mkdir -p ~/Projects && cd ~/Projects
git clone https://github.com/mark-1207/content-rewrite-workshop.git
cd content-rewrite-workshop/contentforge

# 恢复 .env（从备份/U 盘）
cp /Volumes/<U盘名>/env-backup-2026xxxx.txt .env

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

### Q2: 找不到 `python` / `make` / `gyp` 错误
**原因**：Xcode CLT 没装。
**解决**：`xcode-select --install`，重开终端后再 `pnpm install`。

### Q3: 构建报 `Cannot find module 'xxx'`
**解决**：
```bash
rm -rf node_modules dist
pnpm install
pnpm run build
```

### Q4: 测试报 `ObsidianReader: vault not found`
**原因**：`config/contentforge.yaml` 的 `vaultPath` 路径不对。
**解决**：检查路径是否存在、用正斜杠、是否在 iCloud（路径要带 `Library/Mobile Documents/...`）。

### Q5: LLM 调用 401/403
**原因**：API Key 失效或没轮换。
**解决**：检查 `.env` 各 Key，必要时按 5.1 节重新生成。

### Q6: 飞书写入失败
**原因**：
- `.env` 中 `FEISHU_*_APP_TOKEN` / `TABLE_ID` 漏配或错配
- 飞书 app 没有该表的写入权限
- 网络无法访问 `open.feishu.cn`（需要走代理）

**解决**：先确认 `.env` 完整（6 个 FEISHU_ 字段），再用浏览器登录飞书开放平台确认 app 状态。

### Q7: 抓取文章失败（autocli 报错）
**原因**：Mac 不能跑 `autocli.exe`。
**解决**：走 `wechat-article-extractor` skill 降级（已自动启用）。如需确认：
```bash
ls src/scenarios/topic/scraper.ts
# 该文件实现降级逻辑
```

### Q8: GitHub clone 提示 `Repository not found`
**原因**：仓库是私有的，需要 GitHub 凭据。
**解决**：
- 旧电脑先 `git push` 确认代码在远程
- Mac 配置 SSH key：
  ```bash
  ssh-keygen -t ed25519 -C "your_email@example.com"
  cat ~/.ssh/id_ed25519.pub
  # 把输出粘到 GitHub Settings → SSH keys
  # 然后 clone 时用 SSH URL：git@github.com:mark-1207/content-rewrite-workshop.git
  ```
- 或用 HTTPS + Personal Access Token

### Q9: `bun` 命令找不到
**原因**：PATH 没刷新。
**解决**：关掉 Terminal.app 重开，或 `source ~/.zshrc`。

### Q10: `pnpm install` 报 `EACCES` 权限错误
**解决**：
```bash
sudo chown -R $(whoami) ~/.pnpm-store
# 或全局安装位置
sudo chown -R $(whoami) /opt/homebrew/lib/node_modules
```

### Q11: 端口被占用（如 3000）
```bash
lsof -i :3000
kill -9 <PID>
```

---

## 8. 迁移时间预估

| 阶段 | 耗时 |
|------|------|
| 装 Xcode CLT | 5-10 分钟（含下载） |
| 装 Homebrew | 2-3 分钟 |
| 装 Node/Git | 3-5 分钟 |
| 装 pnpm | 1 分钟 |
| 装 Bun | 30 秒 |
| git clone | 2-5 分钟（看网络） |
| `pnpm install` | 1-3 分钟 |
| `pnpm run build` | 10 秒 |
| `pnpm test` | 30 秒 |
| `.env` 恢复 + Obsidian 路径调整 | 5 分钟 |
| 飞书 + Obsidian 资产同步 | 10-30 分钟（看 vault 大小） |
| **合计** | **~45 分钟** |

---

## 9. 完成后第一次跑

```bash
# 原创生成
node dist/index.js skill "AI时代职场人该学什么 发公众号"

# 爆款二创
node dist/index.js recreate -i article.md

# 观点文
node dist/index.js skill "AI让谁变富了？发公众号"
```

跑通就完事了。

---

**关键提醒**：
1. `.env` **单独走安全通道**（U 盘 / AirDrop / 1Password），不要 git push
2. **Bun 必装**（不是可选）——stop hook 依赖它
3. 迁移后**立即轮换所有 API Key**（`.env` 已被推到 GitHub，必须视为泄露）
4. `autocli.exe` 不可用，走 `wechat-article-extractor` skill 降级（自动）
5. **不要**把项目放在 iCloud 同步目录（会污染 `node_modules`）

有问题随时问，迁移过程中任何报错贴上来。
