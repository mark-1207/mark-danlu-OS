# 08 — 部署方案

> 版本：v1.0 草稿 | 状态：方案已对齐

## 1. 总则

### 1.1 分阶段部署

| 阶段 | 部署方式 | 用户范围 |
|------|----------|----------|
| **v1** | 本地 CLI | 单用户（mark） |
| **v2** | 本地 CLI + 飞书表格配置同步 | 单用户延伸 |
| **v3 长期** | Web 服务化 | 多用户 |

### 1.2 部署原则
- **v1 简化**：不强求 CI/CD / Docker
- **配置外置**：环境变量 + YAML
- **数据本地**：runs / Obsidian 都本地
- **凭证隔离**：API key 走环境变量

---

## 2. v1 本地部署

### 2.1 系统要求

| 项 | 要求 |
|----|------|
| OS | macOS / Linux / Windows |
| Python | 3.11+ |
| 内存 | ≥ 4 GB |
| 存储 | ≥ 2 GB（含 runs / config） |

### 2.2 安装

```bash
# 1. 克隆
git clone <炉-repo-url>
cd 炉

# 2. 安装依赖
pip install -e ".[dev]"

# 或用 uv
uv sync
```

### 2.3 配置

```bash
# 1. 复制环境变量模板
cp .env.example .env

# 2. 编辑 .env
# OPENAI_API_KEY=sk-...
# KIMI_API_KEY=...
# ANTHROPIC_API_KEY=...

# 3. 初始化配置
炉 config init
```

### 2.4 启动

```bash
# 1. 跑全流程
炉 run "AI 牛马陷阱"

# 2. 续跑
炉 run --resume <run_id> --from-step 3

# 3. 查看历史
炉 history

# 4. 查看风格画像
炉 style show
```

### 2.5 目录结构

```
炉/
├── .env                    # 环境变量（git ignore）
├── config/                 # 配置文件
│   ├── style_profile.yaml
│   └── thinking_models/
│       ├── models.yaml
│       ├── frameworks.yaml
│       └── model_frameworks.yaml
├── runs/                   # 运行记录
│   └── 2026-06-15_ai-牛马陷阱/
│       ├── context.json
│       ├── draft.md
│       └── quality_report.json
├── obsidian/               # 素材库（v1 手动管理）
│   └── 40_知识库/
├── logs/                   # 日志
│   └── 2026-06-15.log
└── docs/                   # 文档
```

### 2.6 升级

```bash
# 拉最新
git pull

# 更新依赖
pip install -e ".[dev]" --upgrade
# 或 uv sync

# 跑测试
pytest
```

### 2.7 备份

```bash
# 备份 runs + config + obsidian
tar -czf backup-$(date +%Y%m%d).tar.gz runs/ config/ obsidian/
```

### 2.8 卸载

```bash
# 1. 删代码
rm -rf 炉/

# 2. 删依赖
pip uninstall lu

# 3. 删数据（可选）
rm -rf ~/.lu/   # 用户级别数据（如有）
```

---

## 3. v2 飞书配置同步

### 3.1 增量

- **配置同步**：YAML ↔ 飞书多维表格（双向）
- **数据同步**：可选 runs 备份到飞书
- **凭证管理**：飞书 token 通过 OAuth 拿

### 3.2 部署变化

```bash
# v2 新增命令
炉 config pull   # 从飞书拉配置
炉 config push   # 推配置到飞书
炉 feishu auth   # 飞书 OAuth 登录
```

### 3.3 配置同步规则

- **本地为真**：本地 YAML 是 source of truth
- **飞书为镜像**：飞书是只读镜像（团队共享时用）
- **冲突**：本地版本号 > 飞书版本号 → 覆盖

---

## 4. v3 Web 服务化（长期规划）

### 4.1 架构

```
Browser → CDN/WAF → API Gateway → FastAPI → Celery Worker
                                              ↓
                                          LLM / DB
```

### 4.2 技术栈

| 层 | 选型 |
|----|------|
| **前端** | Next.js / React |
| **后端** | FastAPI |
| **任务队列** | Celery + Redis |
| **数据库** | PostgreSQL |
| **对象存储** | S3 / 阿里云 OSS |
| **LLM** | 沿用 LLM 链 |
| **部署** | Docker + Kubernetes / 阿里云 SAE |

### 4.3 安全

- **账号体系**：邮箱/手机号 + 密码
- **OAuth**：飞书/微信登录
- **权限**：RBAC
- **数据隔离**：每用户独立 namespace
- **API 限流**：每用户/每 IP 限流
- **审计日志**：所有操作留痕

### 4.4 计费（v3+）

- **订阅制**：月费/年费
- **按调用计费**：LLM 调用次数
- **免费额度**：每月 10 篇

---

## 5. 环境变量

### 5.1 LLM Provider

```bash
# OpenAI（小米 / mimo）
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=mimo-v2-flash

# Kimi
KIMI_API_KEY=...
KIMI_BASE_URL=https://api.moonshot.cn/v1
KIMI_MODEL=moonshot-v1-32k

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

### 5.2 飞书（v2+）

```bash
FEISHU_APP_ID=...
FEISHU_APP_SECRET=...
FEISHU_INSPIRATION_TABLE_ID=...
FEISHU_FEEDBACK_TABLE_ID=...
```

### 5.3 Obsidian（v1.3+）

```bash
OBSIDIAN_VAULT_PATH=/path/to/vault
OBSIDIAN_ENABLED=true
```

### 5.4 其他

```bash
# 日志
LOG_LEVEL=INFO
LOG_DIR=./logs

# 运行
RUNS_DIR=./runs

# 性能
LLM_MAX_RETRIES=3
LLM_TIMEOUT_SEC=60
```

---

## 6. .env.example

```bash
# 炉 — 环境变量模板
# 复制为 .env 并填入真实值

# ===== LLM =====
OPENAI_API_KEY=
KIMI_API_KEY=
ANTHROPIC_API_KEY=

# ===== 飞书（v2+，留空则不启用） =====
FEISHU_APP_ID=
FEISHU_APP_SECRET=

# ===== Obsidian（v1.3+，留空则不启用） =====
OBSIDIAN_VAULT_PATH=

# ===== 调试 =====
LOG_LEVEL=INFO
```

---

## 7. 部署清单（v1）

### 7.1 新机器部署

- [ ] 安装 Python 3.11+
- [ ] 克隆仓库
- [ ] `pip install -e ".[dev]"`
- [ ] 复制 `.env.example` 到 `.env`
- [ ] 填入 LLM API key
- [ ] `炉 config init`
- [ ] `炉 style init`（首次使用风格画像）
- [ ] 跑测试命题验证：`炉 run "test"`
- [ ] 备份策略：定期 `tar` runs / config

### 7.2 故障排查

| 问题 | 排查 |
|------|------|
| LLM 调用失败 | 检查 API key / 网络 |
| 风格画像加载失败 | 检查 `config/style_profile.yaml` |
| Obsidian 写入失败 | 检查 vault 路径/权限 |
| 必避免列表命中率过高 | 跑 `炉 style update` |

---

## 8. 监控（v1 简化）

### 8.1 日志

- 路径：`logs/<date>.log`
- 格式：JSON（含 ts/level/module/msg/context）
- 轮转：每天一个新文件

### 8.2 关键指标

每次 run 结束，记录到 context.json：
- `total_llm_calls`
- `total_cost_usd`
- `total_duration_sec`
- `quality_score_avg`

可用 `炉 stats` 命令查看历史趋势。

### 8.3 报警

v1 阶段不接报警，靠用户主动 `炉 stats` 看。

v2+ 评估接 Prometheus + Grafana。

---

## 9. 安全

### 9.1 凭证保护
- `.env` 在 `.gitignore` 中
- 凭证用环境变量，不用配置文件
- 日志中**不输出** API key

### 9.2 输入验证
- 用户命题：trim + 长度限制（500 字）
- 文件路径：防止 path traversal

### 9.3 数据保护
- runs/ 包含草稿，**不** commit
- 备份加密（v3+）

---

## 10. 关联文档

- 架构：[02-ARCHITECTURE](02-ARCHITECTURE.md)
- 开发规范：[05-DEV-CONVENTIONS](05-DEV-CONVENTIONS.md)
- 测试方案：[07-TEST-PLAN](07-TEST-PLAN.md)
- v2 规划：[09-ROADMAP-V2](09-ROADMAP-V2.md)
- 长期规划：[10-LONG-TERM-PLAN](10-LONG-TERM-PLAN.md)
