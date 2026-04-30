import fs from 'fs/promises';
import path from 'path';
import { fetchCompetitiveRecords } from './competitor-cache.js';
import { formatRecordsForPrompt } from './competitor-cache.js';
import { llmFactory } from '../../llm/factory.js';
import { loadConfig } from '../../config/loader.js';
import { safeJsonParse } from '../../utils/json-parser.js';
import type { FeishuRecord } from './types.js';

const REPORT_PATH = path.join(process.cwd(), 'output', 'corpus', 'competitor-style-report.md');
const META_PATH = path.join(process.cwd(), 'output', 'corpus', 'competitor-style-report-meta.json');

interface ReportMeta {
  generatedAt: string;
  recordCount: number;
  recordIds: string[];
}

interface AnalysisSections {
  marketOverview: string;
  structurePreferences: string;
  angleDistribution: string;
  highPerformanceFeatures: string;
  differentiationSuggestions: string;
}

/**
 * 调用 AI 分析竞品集合，生成结构化报告内容
 */
async function analyzeCompetitorSet(records: FeishuRecord[]): Promise<AnalysisSections> {
  const config = await loadConfig();
  for (const [name, providerConfig] of Object.entries(config.providers)) {
    llmFactory.register(name, providerConfig);
  }
  const provider = llmFactory.get('kimi');
  const model = config.providers['kimi']?.defaultModel ?? 'moonshot-v1-8k';

  const formattedRecords = formatRecordsForPrompt(records);
  const prompt = `你是一位内容市场分析师。分析以下竞品内容集合，生成风格报告。

竞品数据：
${formattedRecords}

请严格按以下 JSON 格式输出（只输出 JSON，不要有任何其他文字）：
{
  "marketOverview": "整体市场风格概述：归纳这些竞品的整体风格倾向、话题类型、情绪基调和叙事节奏（100-200字）",
  "structurePreferences": "结构偏好分析：\n### 2.1 常见开头模式\n（归纳 top 3 开头句式/角度）\n\n### 2.2 主流叙事结构\n（归纳最常见的内容框架，如：问题+案例+结论 / 情绪递进+高潮+行动等）\n\n### 2.3 结尾/CTA 模式\n（归纳常见收尾方式）",
  "angleDistribution": "内容角度分布：基于所有竞品提炼角度类型分布，如实反映数据（如：AI焦虑恐慌 高频 / 职场应用 中频），不要编造具体数字",
  "highPerformanceFeatures": "高绩效内容特征：分析收藏标记为 true 的记录，提炼高互动内容的共同特征（50-100字）",
  "differentialSuggestions": "差异化机会建议：基于以上分析，给出 3-5 条差异化切入建议（50-150字）"
}`;

  try {
    const response = await provider.chat({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 4096,
      jsonMode: true,
    });

    const parsed = safeJsonParse<AnalysisSections>(response.content, 'competitor-style-report');
    return parsed;
  } catch (e) {
    throw new Error(`竞品分析 LLM 调用失败: ${e}`);
  }
}

/**
 * 生成竞品风格报告
 */
export async function generateCompetitorStyleReport(): Promise<void> {
  // 1. 读取飞书竞品数据
  const records = await fetchCompetitiveRecords();

  // 2. 确保输出目录存在
  const outputDir = path.join(process.cwd(), 'output', 'corpus');
  await fs.mkdir(outputDir, { recursive: true });

  // 3. 读取已有 meta，判断是否可跳过
  let meta: ReportMeta | null = null;
  try {
    const metaContent = await fs.readFile(META_PATH, 'utf-8');
    meta = JSON.parse(metaContent) as ReportMeta;
  } catch {
    // 无 meta，首次生成
  }

  const recordIds = records.map(r => r.record_id).sort();
  const metaIds = meta?.recordIds.sort() ?? [];
  const recordsUnchanged =
    meta !== null &&
    recordIds.length === metaIds.length &&
    recordIds.every((id, i) => id === metaIds[i]);

  // 4. 构建报告内容
  const now = new Date().toISOString();
  const sections: AnalysisSections = {
    marketOverview: '(未生成)',
    structurePreferences: '(未生成)',
    angleDistribution: '(未生成)',
    highPerformanceFeatures: '(未生成)',
    differentiationSuggestions: '(未生成)',
  };
  let analysisError = false;

  if (!recordsUnchanged) {
    // 需要重新分析
    if (records.length === 0) {
      sections.marketOverview = '竞品库暂无 analyzed/stored 状态记录，无法生成市场分析。';
      sections.structurePreferences = '无数据';
      sections.angleDistribution = '无数据';
      sections.highPerformanceFeatures = '无数据';
      sections.differentialSuggestions = '请先通过 topic scrape 命令抓取并分析竞品内容。';
    } else {
      try {
        const aiResult = await analyzeCompetitorSet(records);
        sections.marketOverview = aiResult.marketOverview;
        sections.structurePreferences = aiResult.structurePreferences;
        sections.angleDistribution = aiResult.angleDistribution;
        sections.highPerformanceFeatures = aiResult.highPerformanceFeatures;
        sections.differentialSuggestions = aiResult.differentialSuggestions;
      } catch {
        analysisError = true;
        sections.marketOverview = 'AI 分析失败，跳过结构化分析。原始数据摘要已生成。';
      }
    }
  } else {
    // 缓存命中且无更新，跳过 AI 调用
    sections.marketOverview = '(报告内容未更新，缓存命中)';
  }

  // 5. 构建表格数据
  const favoritedRecords = records.filter(r => r.fields.收藏).slice(0, 5);
  const latestRecords = [...records]
    .sort((a, b) => new Date(b.fields.抓取时间).getTime() - new Date(a.fields.抓取时间).getTime())
    .slice(0, 5);

  const favoriteTable = favoritedRecords.length > 0
    ? favoritedRecords.map(r => `| ${r.fields.原文标题} | ${r.fields.平台} | ${r.fields.选题角度 ?? '-'} |`).join('\n')
    : '| - | - | - |';

  const latestTable = latestRecords.map(r =>
    `| ${r.fields.原文标题} | ${r.fields.平台} | ${new Date(r.fields.抓取时间).toLocaleString('zh-CN')} |`
  ).join('\n');

  // 6. 写入报告
  const reportContent = `# 竞品风格报告

> 生成时间：${now}
> 数据来源：飞书竞品素材库（analyzed/stored，共 ${records.length} 条）
> 缓存状态：${recordsUnchanged ? '命中（无需更新）' : analysisError ? 'AI 分析失败' : '重新生成'}

---

## 一、整体市场风格概述

${sections.marketOverview}

---

## 二、结构偏好分析

${sections.structurePreferences}

---

## 三、内容角度分布

${sections.angleDistribution}

---

## 四、高绩效内容特征

${sections.highPerformanceFeatures}

---

## 五、差异化机会建议

${sections.differentialSuggestions}

---

## 六、原始数据摘要

### 收藏内容（Top 5）

| 标题 | 平台 | 角度 |
|------|------|------|
${favoriteTable}

### 最新抓取（Top 5）

| 标题 | 平台 | 抓取时间 |
|------|------|----------|
${latestTable}
`;

  await fs.writeFile(REPORT_PATH, reportContent, 'utf-8');

  // 7. 写入 meta
  const newMeta: ReportMeta = {
    generatedAt: now,
    recordCount: records.length,
    recordIds: recordIds,
  };
  await fs.writeFile(META_PATH, JSON.stringify(newMeta, null, 2), 'utf-8');
}