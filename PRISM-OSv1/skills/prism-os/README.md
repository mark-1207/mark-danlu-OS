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

## 目录结构

```
prism-os/
├── SKILL.md                         # Skill 入口文件
├── README.md                        # 本文件
├── scripts/
│   ├── call_llm.py                 # LLM 调用脚本
│   ├── search.py                   # 搜索查重脚本
│   └── storage.py                  # 数据持久化脚本
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

### 1. 配置环境变量

```bash
# Gateway（免费主路径）
export LLM_API_URL="http://localhost:3000/v1/chat/completions"
export GATEWAY_AUTH_KEY="your-gateway-key"
export GATEWAY_SCENE="reasoning"  # reasoning/quality/writing-cn/translation/fast/long-context/summary/extraction

# Kimi（付费兜底，Kimi API Key）
export KIMI_API_KEY="your-kimi-key"

# OpenRouter（付费备用，OpenRouter API Key）
export OPENROUTER_API_KEY="your-openrouter-key"
```

### 2. 复制配置模板

```bash
cp config/user_config.yaml.example config/user_config.yaml
# 编辑 config/user_config.yaml，填入实际配置
```

### 3. 使用

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

# 从队列选择裂缝进入主流程（新增 v1.0.9）
python prism_os.py run --from-queue

# 输入时匹配队列中的相关裂缝（新增 v1.0.9）
python prism_os.py run "<用户输入>" --match-queue

# 队列管理（新增 v1.0.9）
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
1. Gateway（免费主路径）
   └─ 超时/500错误 → 重试一次
       └─ 还失败 →

2. Kimi（付费兜底，优先）
   └─ 场景模型映射：
       reasoning     → kimi-k2.6
       quality       → moonshot-v1-128k
       writing-cn    → moonshot-v1-128k
       writing-en    → moonshot-v1-128k
       translation   → moonshot-v1-128k
       fast          → moonshot-v1-32k
       long-context  → kimi-k2.6
       summary       → moonshot-v1-128k
       extraction    → moonshot-v1-128k
       multimodal    → moonshot-v1-128k-vision-preview
   └─ 失败 →

3. OpenRouter（付费备用）
   └─ google/gemini-2.0-flash-exp（先试，便宜快速）
       └─ 失败 →
   └─ anthropic/claude-sonnet-4.6（兜底，更强）
```

**Kimi 限制**：
- 并发数：50
- TPM：2,000,000
- RPM：200
- TPD：200

**意图识别增强**：
- 显式关键词触发：写、文章、选题、标题、创作、帮我写等
- 隐式触发：话题疑问句（为什么、是什么、如何等）

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