/**
 * Social Content Forge - 主入口
 * 串联 extractor → analyzer → evaluator → adapters → output
 */

import { config } from 'dotenv';
import { extract } from './extractor/index.js';
import { analyze } from './analyzer/index.js';
import { evaluate, formatEvaluationReport } from './evaluator/index.js';
import { adaptWechat, adaptXiaohongshu, adaptTwitter } from './adapters/index.js';
import { callLLM, getModelForTask } from './llm/router.js';
import { syncToFeishu, createContentRecord } from '../integrations/feishu/sync.js';
import { saveContent, saveAtoms, saveOutputs, saveEvaluation, getDatabase } from './db/index.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import type { GenerationResult, PlatformOutput, Platform } from './types.js';

// 加载环境变量
config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = process.env.OUTPUT_DIR || join(__dirname, '../data/output');

/**
 * 主流水线
 */
export async function generateContent(
  input: string,
  options: {
    targetPlatforms?: Platform[];
    userProvidedTitle?: string;
    syncFeishu?: boolean;
  } = {}
): Promise<GenerationResult> {
  const {
    targetPlatforms = ['wechat', 'xiaohongshu', 'twitter'],
    userProvidedTitle,
    syncFeishu = false,
  } = options;

  const contentId = uuidv4();
  const startTime = Date.now();

  console.log('='.repeat(50));
  console.log('🚀 Social Content Forge 启动');
  console.log('='.repeat(50));
  console.log(`📥 输入: ${input.slice(0, 80)}${input.length > 80 ? '...' : ''}`);
  console.log(`🎯 目标平台: ${targetPlatforms.join(', ')}`);
  console.log('');

  // ============ Step 1: 提取内容 ============
  console.log('📌 Step 1: 内容提取中...');
  const extracted = await extract(input, userProvidedTitle);
  console.log(`   ✅ 类型: ${extracted.type}`);
  console.log(`   📰 标题: ${extracted.metadata.title || '未识别'}`);
  console.log('');

  // ============ Step 2: 分析内容 ============
  console.log('📌 Step 2: 内容分析中...');
  const llmCall = createLLMCaller();
  const { report: decodedReport, atoms } = await analyze(extracted, llmCall);
  console.log(`   ✅ 解码完成`);
  console.log(`   🎯 核心主张: ${decodedReport.intent.coreClaim}`);
  console.log(`   💫 主要情绪: ${decodedReport.emotionMap.primaryEmotion}`);
  console.log(`   🧱 原子块: ${atoms.length} 个`);
  console.log('');

  // ============ Step 3: 质量评估 ============
  console.log('📌 Step 3: 质量评估中...');
  const evaluation = await evaluate(atoms, decodedReport, llmCall);
  console.log(`   📊 综合评分: ${evaluation.overallScore}/100`);
  console.log(`   🛤️ 决策路径: ${evaluation.decisionPath}`);
  console.log(`   情绪: ${evaluation.dimensionScores.emotion} | 实用: ${evaluation.dimensionScores.utility} | 叙事: ${evaluation.dimensionScores.narrative}`);
  console.log('');

  // 评分<60时询问是否继续
  if (evaluation.overallScore < 60) {
    console.log('   ⚠️  内容评分较低（<60分），建议重构');
    console.log('   💡 诊断:');
    for (const d of evaluation.diagnostics) {
      console.log(`      - ${d.dimension}: ${d.issue}`);
    }
    console.log('');
  }

  // ============ Step 4: 平台适配 ============
  console.log('📌 Step 4: 平台适配中...');
  const outputs: PlatformOutput[] = [];
  const context = {
    title: extracted.metadata.title || '未命名',
    decodedReport,
    sourceContent: extracted.content,
  };

  // 定义输出目录路径（供后续步骤使用）
  const date = new Date().toISOString().split('T')[0];
  const safeTitle = (extracted.metadata.title || 'untitled').slice(0, 20).replace(/[\/\\:*?"<>|]/g, '');
  const outputBaseDir = join(OUTPUT_DIR, `${date}_${safeTitle}`);

  for (const platform of targetPlatforms) {
    console.log(`   📝 生成 ${platform} 版本...`);
    try {
      let adapted;
      switch (platform) {
        case 'wechat':
          adapted = await adaptWechat(atoms, context, llmCall);
          break;
        case 'xiaohongshu':
          adapted = await adaptXiaohongshu(atoms, context, llmCall);
          break;
        case 'twitter':
          adapted = await adaptTwitter(atoms, context, llmCall);
          break;
      }

      // 写入文件
      if (!existsSync(outputBaseDir)) {
        mkdirSync(outputBaseDir, { recursive: true });
      }

      const filePath = join(outputBaseDir, `${platform}.md`);
      const fileContent = platform === 'twitter'
        ? `# ${adapted.title || 'Twitter Thread'}\n\n${adapted.content}`
        : `# ${adapted.title}\n\n${adapted.content}`;
      writeFileSync(filePath, fileContent, 'utf-8');

      outputs.push({
        platform,
        title: adapted.title || '',
        content: adapted.content,
        wordCount: adapted.wordCount,
        filePath,
      });

      console.log(`      ✅ 已保存: ${filePath} (${adapted.wordCount}字)`);
    } catch (error: any) {
      console.error(`      ❌ ${platform} 生成失败: ${error.message}`);
    }
  }
  console.log('');

  // ============ Step 5: 保存评估报告 ============
  const evalReport = formatEvaluationReport(evaluation, extracted.metadata.title || '未命名');
  const evalFilePath = join(outputBaseDir, 'evaluation.md');
  writeFileSync(evalFilePath, evalReport, 'utf-8');
  console.log(`📌 Step 5: 评估报告已保存`);
  console.log('');

  // ============ Step 6: 飞书同步 ============
  let feishuRecordId: string | undefined;
  if (syncFeishu) {
    console.log('📌 Step 6: 飞书同步中...');
    const feishuConfig = {
      appId: process.env.FEISHU_APP_ID || '',
      appSecret: process.env.FEISHU_APP_SECRET || '',
      appToken: process.env.FEISHU_APP_TOKEN || '',
      tableId: process.env.FEISHU_TABLE_ID || '',
    };

    if (feishuConfig.appId && feishuConfig.appSecret && feishuConfig.appToken && feishuConfig.tableId) {
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
          wechat: outputs.find(o => o.platform === 'wechat')?.filePath,
          xiaohongshu: outputs.find(o => o.platform === 'xiaohongshu')?.filePath,
          twitter: outputs.find(o => o.platform === 'twitter')?.filePath,
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
    await getDatabase(); // 初始化数据库连接
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
 * 创建 LLM 调用函数
 */
function createLLMCaller() {
  return async (prompt: string): Promise<string> => {
    const apiKey = process.env.ZHIPU_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || '';
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
Social Content Forge CLI

用法:
  npx tsx src/index.ts <输入内容或URL>
  npx tsx src/index.ts --sync-feishu <输入内容或URL>

示例:
  npx tsx src/index.ts "https://mp.weixin.qq.com/s/xxxxx"
  npx tsx src/index.ts --sync-feishu "AI如何改变内容创作行业"
`);
    process.exit(0);
  }

  const syncFeishu = args.includes('--sync-feishu');
  const input = args.filter(a => !a.startsWith('--')).join(' ');

  generateContent(input, { syncFeishu })
    .catch(error => {
      console.error('生成失败:', error);
      process.exit(1);
    });
}
