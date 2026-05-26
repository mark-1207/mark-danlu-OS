# PRISM-OS Skill

认知澄清与选题生成引擎。

## 版本覆盖

| 版本 | 状态 | 功能 |
|------|------|------|
| V1 | ✓ | 苏格拉底网关 + 棱镜引擎 + 现实校验锚 |
| V1.5 | ✓ | Gap Analysis + 双端大纲 |
| V2 | ✓ | 逻辑压力测试 + 认知旅程规划 |
| V3 | ✓ | 刺客机制 + 知识拓扑图谱 + Prompt 变异 |
| V4 | ✓ | 认知裂缝捕捉 + 主动推送 + 数字分身 |
| V4.5 | ✓ | CCOS v2.0 认知推进流大纲 |
| V5 | ✓ | Phase 5 内容生成（模块级生成 + 逐模块确认） |
| V5.5 | ✓ | autocli 集成 + Obsidian 递归扫描 + 风格学习 |
| V1.0.9 | ✓ | RSS-Hunter × PRISM-OS 整合（crack_queue + --from-queue/--match-queue） |
| V1.0.10 | ✓ | Windows SSL 修复 + 跨机器密钥迁移 + HTTP 监听 + API 节流 |

## 目录结构

```
prism-os/
├── SKILL.md                         # Skill 入口文件
├── README.md                        # 本文件
├── MANUAL.md                        # 用户使用手册
├── CHANGELOG.md                     # 更新日志
├── scripts/
│   ├── .env                         # API 密钥集中管理（跨机器迁移）
│   ├── prism_os.py                  # 主入口脚本
│   ├── call_llm.py                  # LLM 调用脚本（curl subprocess 实现）
│   ├── embedding.py                 # 向量生成与相似度计算
│   ├── reality_anchor.py            # 现实校验锚（curl subprocess 实现）
│   ├── cognitive_crack.py           # 认知裂缝捕捉
│   ├── cognitive_outline.py         # CCOS v2.0 认知大纲
│   ├── crack_queue.py               # 裂缝队列管理
│   ├── gap_analysis.py              # 素材缺口分析
│   ├── logic_pressure.py            # 逻辑压力测试
│   ├── assassination.py             # 刺客机制
│   ├── socratic_gateway.py          # 苏格拉底网关
│   ├── content_generator.py         # Phase 5 内容生成
│   ├── search.py                    # 搜索查重脚本
│   └── storage.py                   # 数据持久化脚本
├── references/
│   ├── intent_recognition.md        # 意图识别 Prompt
│   ├── socratic_gateway.md          # 苏格拉底网关 Prompt
│   ├── prism_engine.md              # 棱镜引擎 Prompt
│   ├── reality_anchor.md            # 现实校验锚 Prompt
│   ├── gap_analysis.md              # Gap Analysis Prompt
│   ├── logic_stress_test.md         # 逻辑压力测试 Prompt
│   ├── cognitive_journey.md         # 认知旅程规划 Prompt
│   ├── vocab_fingerprint.json       # 词汇指纹库
│   ├── assassin_mechanism.md        # 刺客机制 (V3)
│   ├── knowledge_topology.md         # 知识拓扑图谱 (V3)
│   ├── prompt_evolution.md          # Prompt 自动变异 (V3)
│   ├── cognitive_crack_hunter.md    # 认知裂缝捕捉 (V4)
│   └── digital_twin.md              # 数字分身 (V4)
└── config/
    └── user_config.yaml.example     # 用户配置示例
```

## 快速开始

### 1. 配置 API 密钥

编辑 `scripts/.env` 文件，填入实际 API 密钥（迁移到新机器只需复制此文件）：

```bash
# scripts/.env
KIMI_API_KEY=your-kimi-key
OPENROUTER_API_KEY=your-openrouter-key
ZHIPU_API_KEY=your-zhipu-key
```

### 2. 使用

**方式一：直接触发（推荐）**
```bash
python prism_os.py run "你的话题" [--fast] [--no-ext]
```

**方式二：HTTP 监听模式（跨机器）**
```bash
python prism_os.py listen
# 然后从其他机器 POST 触发：
# curl -X POST http://<IP>:8080/run -d '{"text": "你的话题"}'
```

**方式三：Claude Code Skill 自动触发**
在 Claude Code 中，当你有创作意图时，描述你的想法，skill 会自动介入。

## 核心流程

```
用户输入 → 意图识别 → 追问确认 → yes
                                    ↓
                         ┌─────────────────────────────────┐
                         │ Phase 1: 苏格拉底网关            │
                         │   熵值计算 → blocked/clarify/pass │
                         └─────────────────────────────────┘
                                    ↓
                         ┌─────────────────────────────────┐
                         │ Phase 2: 棱镜引擎               │
                         │   四维生成 → 12个候选标题        │
                         └─────────────────────────────────┘
                                    ↓
                         ┌─────────────────────────────────┐
                         │ Phase 3: 现实校验锚 + 逻辑测试   │
                         │   （并行执行）                    │
                         │   查重 + 竞争度标注              │
                         └─────────────────────────────────┘
                                    ↓
                         ┌─────────────────────────────────┐
                         │ Phase 4: V1.5 扩展              │
                         │   Gap Analysis + 双端大纲       │
                         └─────────────────────────────────┘
                                    ↓
                         ┌─────────────────────────────────┐
                         │ Phase 5: V2 扩展                │
                         │   认知旅程规划                   │
                         └─────────────────────────────────┘
                                    ↓
                         ┌─────────────────────────────────┐
                         │ Phase 6: V3 扩展                │
                         │   刺客机制 + 知识拓扑           │
                         │   Prompt 变异                   │
                         └─────────────────────────────────┘
                                    ↓
                         ┌─────────────────────────────────┐
                         │ Phase 7: V4 扩展                │
                         │   认知裂缝捕捉 + 主动推送       │
                         │   数字分身初筛                   │
                         └─────────────────────────────────┘
                                    ↓
                              最终输出
```

## CLI 命令

```bash
# 完整流程（用户输入）
python prism_os.py run "<用户输入>" [--format] [--no-ext] [--fast]

# HTTP 监听模式（跨机器触发，新增 v1.0.10）
python prism_os.py listen [--port 8080]

# 短期记忆
python prism_os.py recall

# 从队列选择裂缝进入主流程（v1.0.9）
python prism_os.py run --from-queue

# 输入时匹配队列中的相关裂缝（v1.0.9）
python prism_os.py run "<用户输入>" --match-queue

# 队列管理（v1.0.9）
python prism_os.py queue --list                # 列出所有待消费裂缝
python prism_os.py queue --tag <id> <标签>      # 打标签（如"战略级"）
python prism_os.py queue --dismiss <id>         # 删除无用条目
python prism_os.py queue --stats               # 查看队列统计

# CCOS 大纲生成
python prism_os.py ccos "<命题>" [--platform wechat|xiaohongshu|both]

# 内容生成（Phase 5）
python prism_os.py generate "<标题>" [--platform wechat|xiaohongshu] [--interactive]
```

## LLM 三级 Fallback 架构

```
1. Kimi（付费主路径） — 场景模型动态选择
   └─ reasoning     → moonshot-v1-128k (8192 tokens)
   └─ quality       → moonshot-v1-128k (16384 tokens)
   └─ writing-cn    → moonshot-v1-128k (16384 tokens)
   └─ fast          → moonshot-v1-32k (4096 tokens)
   └─ 重试 1 次，失败 →

2. Gateway（免费模型） — 备用
   └─ 未配置则跳过 →

3. OpenRouter（付费备用） — 最终降级
   └─ qwen/qwen-2.5-72b-instruct（最强）
   └─ deepseek/deepseek-chat-v3（强）
   └─ google/gemma-4-26b-a4b-it
   └─ mistralai/mistral-small-24b-instruct-2501
   └─ meta-llama/llama-3.1-8b-instruct
   └─ qwen/qwen3-8b（最快）

全部失败 → 返回结构化错误
```

**API 调用实现**：
- 全部通过 curl subprocess（`-k` 参数），绕过 Windows Python SSL 问题
- 全局节流：所有 API 调用间隔 ≥ 0.8s，防止 rate limit

**不可用模型（区域限制）**：
- OpenAI 系列（gpt-4o/gpt-4o-mini） → 403
- Google Gemini 系列 → 403
- Anthropic Claude 系列 → 403

**意图识别增强**：
- 显式关键词触发：写、文章、选题、标题、创作、帮我写等
- 隐式触发：话题疑问句（为什么、是什么、如何等）
- 默认 fallback：无法判断时默认触发 PRISM-OS（安全侧）

## 验收标准

| 版本 | 指标 | 目标 |
|------|------|------|
| V1 | 网关拦截准确率 | > 85% |
| V1 | 四维标题正交率 | > 75% |
| V2 | 逻辑谬误识别率 | > 80% |
| V2 | 认知旅程连贯性 | > 85% |
| V3 | 刺客机制触发准确率 | > 75% |
| V3 | 知识图谱覆盖率 | > 80% |
| V3 | Prompt 变异有效性 | > 70% |
| V4 | 裂缝识别准确率 | > 70% |
| V4 | 主动推送有效率 | > 60% |
| V4 | 数字分身匹配度 | > 80% |

## 联系方式

如有问题，请在项目仓库中提 Issue。