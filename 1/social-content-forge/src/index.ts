/**
 * Social Content Forge - 主入口 (v2)
 * v2: 热点发现 + 素材增强 + 自我进化生成 + 质量门控
 */

import { config } from 'dotenv';
import { extract } from './extractor/index.js';
import { analyze } from './analyzer/index.js';
import { evaluate, evaluateV2, formatEvaluationReport } from './evaluator/index.js';
import { callLLM, getModelForTask } from './llm/router.js';
import { syncToFeishu, createContentRecord } from '../integrations/feishu/sync.js';
import { saveContent, saveAtoms, saveOutputs, saveEvaluation, getDatabase } from './db/index.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import type { GenerationResult, PlatformOutput, Platform, AudienceProfile, MaterialPackage, DynamicPromptContext } from './types.js';

// v2 modules
import { HotDiscoveryService } from './hot-discovery/index.js';
import { MaterialEnhancementService } from './material-enhancement/index.js';
import { SelfEvolutionGenerator } from './generation/index.js';
import { StyleLearningService } from './style-learning/index.js';
import { MemoryLoader } from './memory/loader.js';
import { DynamicPromptBuilder } from './prompts/index.js';
import { SimilarityVerifier } from './similarity-verifier/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 加载环境变量 - 使用项目根目录的 .env
config({ path: join(process.cwd(), '.env') });

const OUTPUT_DIR = process.env.OUTPUT_DIR || join(__dirname, '../data/output');

/**
 * v2 主流水线
 */
export async function generateContent(
  input: string,
  options: {
    targetPlatforms?: Platform[];
    userProvidedTitle?: string;
    syncFeishu?: boolean;
    enableHotDiscovery?: boolean;   // NEW
    hotTopicId?: string;           // NEW
    materialEnhancement?: boolean;  // NEW: auto-enhance search queries
  } = {}
): Promise<GenerationResult> {
  const {
    targetPlatforms = ['wechat', 'xiaohongshu', 'twitter'],
    userProvidedTitle,
    syncFeishu = false,
    enableHotDiscovery = false,
    hotTopicId,
    materialEnhancement = true,
  } = options;

  const contentId = uuidv4();
  const startTime = Date.now();

  console.log('='.repeat(50));
  console.log('🚀 Social Content Forge v2 启动');
  console.log('='.repeat(50));
  console.log(`📥 输入: ${input.slice(0, 80)}${input.length > 80 ? '...' : ''}`);
  console.log(`🎯 目标平台: ${targetPlatforms.join(', ')}`);
  console.log('');

  // Initialize v2 modules
  const projectRoot = join(__dirname, '..');
  const llmCall = createLLMCaller();
  const hotDiscovery = new HotDiscoveryService();
  const materialEnhancer = new MaterialEnhancementService(projectRoot);
  const selfEvolutionGenerator = new SelfEvolutionGenerator(llmCall);
  const promptBuilder = new DynamicPromptBuilder();

  // Default audience profile (can be customized)
  const defaultAudience: AudienceProfile = {
    core: ['大厂边缘人', '小企业主', '职场内卷挣扎者'],
    edge: ['希望提升认知的年轻人'],
    painPoints: ['35岁焦虑', '晋升无望', '技能错配'],
    aspirations: ['找到新方向', '突破瓶颈', '实现自我价值'],
  };

  // ============ Step 0: 素材增强 (for search queries) ============
  let materialPackage: MaterialPackage | undefined;
  if (materialEnhancement) {
    console.log('📌 Step 0: 素材增强中...');
    try {
      const enhancement = materialEnhancer.enhanceSearchQuery(input, defaultAudience);
      if (enhancement.confidence > 0.3) {
        materialPackage = enhancement.materialPackage;
        console.log(`   ✅ 找到 ${materialPackage!.viralQuotes.length} 个金句, ${materialPackage!.caseStudies.length} 个案例`);
      } else {
        console.log(`   ⚠️ 素材增强置信度较低 (${enhancement.confidence}), 将直接生成`);
      }
    } catch (e: any) {
      console.log(`   ⚠️ 素材增强失败: ${e.message}, 继续直接生成`);
    }
    console.log('');
  }

  // ============ Step 1: 提取内容 ============
  console.log('📌 Step 1: 内容提取中...');
  const extracted = await extract(input, userProvidedTitle);
  console.log(`   ✅ 类型: ${extracted.type}`);
  console.log(`   📰 标题: ${extracted.metadata.title || '未识别'}`);
  console.log('');

  // ============ Step 2: 分析内容 ============
  console.log('📌 Step 2: 内容分析中...');
  const simpleLlmCall = createSimpleLLMCaller();
  const { report: decodedReport, atoms } = await analyze(extracted, simpleLlmCall);
  console.log(`   ✅ 解码完成`);
  console.log(`   🎯 核心主张: ${decodedReport.intent.coreClaim}`);
  console.log(`   💫 主要情绪: ${decodedReport.emotionMap.primaryEmotion}`);
  console.log(`   🧱 原子块: ${atoms.length} 个`);
  console.log('');

  // ============ Step 3: v2 质量评估 (Nine Dimensions) ============
  console.log('📌 Step 3: 九维度质量评估中...');
  const evaluation = await evaluateV2(atoms, decodedReport, llmCall);
  console.log(`   📊 综合评分: ${evaluation.overallScore}/100`);
  console.log(`   🛤️ 决策路径: ${evaluation.decisionPath}`);
  if (evaluation.hasVeto) {
    console.log(`   ⚠️ 否决维度: ${evaluation.vetoDimensions?.join('、')}`);
  }
  console.log(`   情绪: ${evaluation.dimensionScores.emotion} | 实用: ${evaluation.dimensionScores.utility} | 叙事: ${evaluation.dimensionScores.narrative}`);
  console.log('');

  // Build dynamic prompt context for generation
  const dynamicContext: DynamicPromptContext = {
    taskBackground: `用户输入: "${input}" | 标题: ${extracted.metadata.title || '未命名'}`,
    materialPackage,
    improvementSuggestions: [],
    targetAudience: defaultAudience,
  };

  // ============ Step 4: v2 平台适配 (Self-Evolution Generation) ============
  console.log('📌 Step 4: 自我进化生成中...');
  const outputs: PlatformOutput[] = [];
  const date = new Date().toISOString().split('T')[0];
  const safeTitle = (extracted.metadata.title || 'untitled').slice(0, 20).replace(/[\/\\:*?"<>|]/g, '');
  const outputBaseDir = join(OUTPUT_DIR, `${date}_${safeTitle}`);

  // 并行生成所有平台内容
  const genResults = await Promise.all(
    targetPlatforms.map(async (platform) => {
      console.log(`   📝 生成 ${platform} 版本...`);
      try {
        const genResult = await selfEvolutionGenerator.generateWithQualityGate(platform, dynamicContext);
        return { platform, genResult, error: null };
      } catch (error: any) {
        return { platform, genResult: null, error: error.message };
      }
    })
  );

  // 处理生成结果
  if (!existsSync(outputBaseDir)) {
    mkdirSync(outputBaseDir, { recursive: true });
  }

  for (const { platform, genResult, error } of genResults) {
    if (error) {
      console.error(`      ❌ ${platform} 生成失败: ${error}`);
      continue;
    }
    if (genResult && genResult.passed) {
      const filePath = join(outputBaseDir, `${platform}.md`);
      const fileContent = `# ${genResult.content.title}\n\n${genResult.content.body}`;
      writeFileSync(filePath, fileContent, 'utf-8');

      outputs.push({
        platform,
        title: genResult.content.title,
        content: genResult.content.body,
        wordCount: genResult.content.wordCount,
        filePath,
      });

      console.log(`      ✅ ${platform} 已保存: ${filePath} (${genResult.content.wordCount}字)`);
      console.log(`      📊 质量: ${genResult.score}/100 | LLM: ${genResult.llmUsed} | 迭代: ${genResult.iterations}`);
    } else if (genResult) {
      console.log(`      ❌ ${platform} 质量未达标: ${genResult.improvementSuggestions.join(', ')}`);
    }
  }
  console.log('');

  // ============ Step 4.5: 相似度验证 ============
  if (outputs.length > 0) {
    console.log('📌 Step 4.5: 相似度验证中...');
    try {
      const verifier = new SimilarityVerifier();
      const platformContents = outputs.map(o => ({
        platform: o.platform,
        title: o.title,
        body: o.content,
        wordCount: o.wordCount,
      }));
      const originalContent = extracted.content;
      const originalTitle = extracted.metadata.title || '未命名';
      const simResult = await verifier.verify(originalContent, originalTitle, platformContents, llmCall);

      if (simResult.passed) {
        console.log(`   ✅ 相似度验证通过 (${simResult.overallScore}%)`);
      } else {
        console.log(`   ⚠️ 相似度超标: ${simResult.summary}`);
      }
    } catch (error: any) {
      console.log(`   ⚠️ 相似度验证失败: ${error.message}, 继续流程`);
    }
    console.log('');
  }

  // ============ Step 5: 保存评估报告 ============
  const evalReport = formatEvaluationReport(evaluation, extracted.metadata.title || '未命名');
  const evalFilePath = join(outputBaseDir, 'evaluation.md');
  writeFileSync(evalFilePath, evalReport, 'utf-8');
  console.log(`📌 Step 5: 评估报告已保存`);
  console.log('');

  // ============ Step 6: 飞书同步 (v2 - 完整内容) ============
  let feishuRecordId: string | undefined;
  if (syncFeishu && outputs.length > 0) {
    console.log('📌 Step 6: 飞书同步中...');
    const feishuConfig = {
      appId: process.env.FEISHU_APP_ID || '',
      appSecret: process.env.FEISHU_APP_SECRET || '',
      appToken: process.env.FEISHU_APP_TOKEN || '',
      tableId: process.env.FEISHU_TABLE_ID || '',
    };

    if (feishuConfig.appId && feishuConfig.appSecret && feishuConfig.appToken && feishuConfig.tableId) {
      // v2: 同步完整三平台内容
      const wechatOutput = outputs.find(o => o.platform === 'wechat');
      const xhsOutput = outputs.find(o => o.platform === 'xiaohongshu');
      const twitterOutput = outputs.find(o => o.platform === 'twitter');

      // Create a combined content for Feishu sync
      const record = createContentRecord(
        extracted.metadata.title || '未命名',
        extracted.type,
        extracted.type === 'url' ? extracted.source : undefined,
        {
          overallScore: evaluation.overallScore,
          emotionScore: evaluation.dimensionScores.emotion,
          utilityScore: evaluation.dimensionScores.utility,
          narrativeScore: evaluation.dimensionScores.narrative,
        },
        {
          wechat: wechatOutput?.content || '',
          xiaohongshu: xhsOutput?.content || '',
          twitter: twitterOutput?.content || '',
        }
      );

      const result = await syncToFeishu(feishuConfig, record);
      if (result.success) {
        feishuRecordId = result.recordId;
        console.log(`   ✅ 飞书同步成功`);
      } else {
        console.log(`   ⚠️ 飞书同步失败: ${result.error}`);
      }
    } else {
      console.log('   ⚠️ 飞书配置不完整，已跳过');
    }
    console.log('');
  }

  // ============ Step 7: 保存到数据库 ============
  console.log('📌 Step 7: 保存到本地数据库...');
  try {
    await getDatabase();
    saveContent({
      id: contentId,
      sourceType: extracted.type,
      sourceUrl: extracted.type === 'url' ? extracted.source : undefined,
      title: extracted.metadata.title || '未命名',
      overallScore: evaluation.overallScore,
    });
    saveAtoms(contentId, atoms);
    saveOutputs(contentId, outputs);
    saveEvaluation(contentId, evaluation, uuidv4());
    console.log('   ✅ 数据库保存成功');
  } catch (error: any) {
    console.error('   ⚠️ 数据库保存失败:', error.message);
  }
  console.log('');

  // ============ 完成 ============
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('='.repeat(50));
  console.log('✅ 生成完成!');
  console.log(`   ⏱️ 耗时: ${duration}秒`);
  console.log(`   📊 评分: ${evaluation.overallScore}/100`);
  console.log(`   📁 输出: ${OUTPUT_DIR}`);
  console.log('='.repeat(50));

  return {
    contentId,
    extracted,
    decodedReport,
    atoms,
    evaluation,
    outputs,
    feishuRecordId,
    createdAt: new Date().toISOString(),
  };
}

/**
 * 创建 LLM 调用函数 (v2 - 支持模型选择)
 */
function createLLMCaller() {
  return async (model: string, prompt: string): Promise<string> => {
    let apiKey = '';
    let actualModel: import('./types.js').LLMModel = 'glm';

    // Try to find API key based on model
    if (model === 'claude') {
      apiKey = process.env.ANTHROPIC_API_KEY || '';
      if (!apiKey) {
        // Fallback to default
        actualModel = getModelForTask('analyze');
        apiKey = process.env.ZHIPU_API_KEY || process.env.OPENAI_API_KEY || '';
      }
    } else if (model === 'gpt') {
      apiKey = process.env.OPENAI_API_KEY || process.env.ZHIPU_API_KEY || '';
      actualModel = 'gpt';
    } else if (model === 'deepseek') {
      apiKey = process.env.DEEPSEEK_API_KEY || process.env.ZHIPU_API_KEY || '';
      actualModel = 'deepseek';
    } else {
      apiKey = process.env.KIMI_API_KEY || process.env.ZHIPU_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || '';
      actualModel = 'kimi';
    }

    if (!apiKey) {
      throw new Error('未设置 LLM API Key');
    }

    const response = await callLLM(
      actualModel,
      apiKey,
      [{ role: 'user', content: prompt }]
    );

    return response.content;
  };
}

/**
 * 创建简单的 LLM 调用函数 (用于 analyze，它只接受 prompt)
 */
function createSimpleLLMCaller() {
  return async (prompt: string): Promise<string> => {
    const apiKey = process.env.KIMI_API_KEY || process.env.ZHIPU_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      throw new Error('未设置 LLM API Key');
    }

    const model = getModelForTask('analyze');
    const response = await callLLM(
      model,
      apiKey,
      [{ role: 'user', content: prompt }]
    );

    return response.content;
  };
}

// ============ CLI 入口 ============
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Social Content Forge v2 CLI

用法:
  npx tsx src/cli.ts <输入内容或URL>
  npx tsx src/cli.ts --no-sync-feishu <输入内容或URL>
  npx tsx src/cli.ts --hot <平台>     # 获取热点话题
  npx tsx src/cli.ts --style-check     # 检查风格学习库

示例:
  npx tsx src/cli.ts "https://mp.weixin.qq.com/s/xxxxx"
  npx tsx src/cli.ts --sync-feishu "AI如何改变内容创作行业"
  npx tsx src/cli.ts --hot weibo
  npx tsx src/cli.ts --style-check
`);
    process.exit(0);
  }

  // Hot discovery command
  if (args.includes('--hot')) {
    const platformIndex = args.indexOf('--hot') + 1;
    const platform = args[platformIndex] as any || 'all';
    runHotDiscovery(platform).catch(console.error);
  }

  // Style check command
  if (args.includes('--style-check')) {
    runStyleCheck().catch(console.error);
  }

  // Normal content generation
  const syncFeishu = !args.includes('--no-sync-feishu');
  const input = args.filter(a => !a.startsWith('--')).join(' ');

  generateContent(input, { syncFeishu, materialEnhancement: true })
    .then(result => {
      console.log('\n=== Generation Complete ===');
      console.log(`Content ID: ${result.contentId}`);
      console.log(`Overall Score: ${result.evaluation.overallScore}/100`);
      console.log(`Outputs: ${result.outputs.length} files`);
      if (result.feishuRecordId) {
        console.log(`Feishu Record ID: ${result.feishuRecordId}`);
      }
    })
    .catch(error => {
      console.error('\n=== Generation Failed ===');
      console.error(error);
      process.exit(1);
    });
}

async function runHotDiscovery(platform: string) {
  const service = new HotDiscoveryService();

  if (platform === 'all') {
    console.log('📡 获取所有平台热点...');
    const topics = await service.fetchAllTopics();
    console.log(`\n共获取 ${topics.length} 个热点话题:\n`);
    topics.slice(0, 20).forEach((t, i) => {
      console.log(`${i + 1}. [${t.platform}] ${t.title} (${t.heatScore || 'N/A'})`);
    });
  } else {
    console.log(`📡 获取 ${platform} 热点...`);
    const topics = await service.fetchFromSource(platform as any);
    console.log(`\n共获取 ${topics.length} 个话题:\n`);
    topics.slice(0, 20).forEach((t, i) => {
      console.log(`${i + 1}. ${t.title} (${t.heatScore || 'N/A'})`);
    });
  }
}

async function runStyleCheck() {
  console.log('📚 检查风格学习库...');
  const projectRoot = join(__dirname, '..');
  const llmCall = createLLMCaller();
  const service = new StyleLearningService(projectRoot, llmCall);
  const checker = service.createChecker();

  const result = await checker.checkForNewCases();

  if (!result.hasNewCases) {
    console.log('✅ 没有新案例');
    return;
  }

  console.log(`✅ Found ${result.newCases.length} new cases`);
  console.log(`\n${checker.formatInsightsForConfirmation(result.newInsights)}`);
}
