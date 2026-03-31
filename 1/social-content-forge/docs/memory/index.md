# Social Content Forge - 项目记忆索引

> 最后更新：2026-03-31

## 项目状态

**v2 核心模块已全部实现完成**，待GitHub调研和A/B测试验证。

## 已完成模块

| 模块 | 状态 | 说明 |
|------|------|------|
| 类型系统升级 | ✅ | NineDimensionScores, HotTopic, MaterialPackage等 |
| 上下文记忆模块 | ✅ | 全局+项目记忆分离 |
| 热点发现层 | ✅ | Weibo/Twitter/Google/Xiaohongshu/Reddit |
| 素材增强模块 | ✅ | 搜索query自动补全素材 |
| 两层Prompt体系 | ✅ | Dan Koe风格基础Prompt + 动态Prompt |
| 自我进化生成 | ✅ | 内嵌评审 + LLM轮询 + 质量门控 |
| 九维度评估 | ✅ | ≥85通过，<5一票否决 |
| 风格学习服务 | ✅ | 检测新案例 → 生成洞察 → 更新标准 |
| 主流水线集成 | ✅ | 所有v2模块集成 |
| 飞书完整内容同步 | ✅ | 三平台完整markdown |

## 核心结论

1. **热点发现**：一期接入微博热榜、Twitter Trending、Google Trends、小红书热榜、Reddit
2. **主题搜索质量提升**：输入轻量化，内部触发「素材增强」模块
3. **两层Prompt体系**：基础Prompt（稳定）+ 动态Prompt（任务自适应）
4. **自我进化生成**：内嵌评审循环，不单独打分，节省token
5. **LLM轮询**：同一LLM重试1次，仍不达标则换LLM，所有失败则停止
6. **质量门控**：九维度评估，加权≥85通过，单维度<5一票否决
7. **飞书同步**：完整三平台markdown内容，而非零散字段
8. **不关联**：PUA技能、内容改写项目与本项目无关
9. **风格学习库**：已建立 `docs/style-library/`，用于持续学习爆款/差案例

## 风格学习库

位置：`docs/style-library/`

- **good/** — 爆款案例（已导入2篇姜胡说文章）
- **bad/** — 差案例（已导入1篇）
- **insights/** — 学习洞察记录
- **library.json** — 案例索引

**启动检查**：每次cd到项目目录，自动检查是否有新案例，有则学习并找用户确认

## 内容质量标准（重要参考）

详见：`docs/memory/content-quality.md`

**目标内容风格**：Dan Koe风格，姜胡说为参照
- 受众：大厂边缘人、小企业主、职场内卷挣扎希望找到新方向的人
- 特点：个人故事切入、真实洞察、反常识观点、理论+实操、长文深度

## Git提交记录（v2相关）

```
215b418 feat(v2): integrate all v2 modules into main pipeline
036c0e0 feat(v2): add style learning service for case analysis
44eef7b feat(v2): upgrade evaluator to nine dimensions with veto logic
33dd3b9 feat(v2): add self-evolution generator with quality gate and LLM retry
f04c654 feat(v2): add two-layer prompt system with Dan Koe style
482fe42 feat(v2): add material enhancement module for search query quality
b874bed feat(v2): add hot discovery layer with Weibo/Twitter/Google/Xiaohongshu/Reddit
92004d9 feat(v2): add context memory module
acb3e0d feat(v2): add nine-dimension types, HotTopic, MaterialPackage
```

## 待办

- [ ] GitHub调研更优Prompt（网络受限，需用户提供链接）
- [ ] A/B测试验证v2效果
- [ ] 热点发现数据源正式接入（API配置）

## 下一步

GitHub调研Prompt后，进行A/B测试验证效果
