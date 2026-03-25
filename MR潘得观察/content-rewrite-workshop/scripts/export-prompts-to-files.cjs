/**
 * 导出解析后的提示词到单独文件
 */
const fs = require('fs');
const path = require('path');

const folderPath = process.argv[2];
if (!folderPath) {
  console.error('用法: node export-prompts-to-files.cjs "文件夹路径"');
  process.exit(1);
}

const outputDir = path.join(__dirname, '..', 'src', 'data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 解析函数
function parseContentTemplate(content) {
  const lines = content.split('\n');
  const titleLines = [];
  const contentLines = [];
  let currentSection = 'header';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stepMatch = line.match(/^##\s+步骤(\d+)[：:]/);

    if (stepMatch) {
      const stepNum = parseInt(stepMatch[1]);
      if (stepNum === 2) {
        currentSection = 'title';
      } else if (stepNum >= 3 || stepNum === 1) {
        currentSection = 'content';
      }
      titleLines.push(line);
      contentLines.push(line);
      continue;
    }

    if (/^## [^\s]/.test(line) && !stepMatch) {
      if (!line.includes('标题') && !line.includes('封面')) {
        currentSection = 'content';
      }
    }

    if (currentSection === 'title') {
      titleLines.push(line);
    } else {
      contentLines.push(line);
    }
  }

  const cleanLines = (arr) => {
    let result = [];
    let emptyCount = 0;
    for (const line of arr) {
      if (line.trim() === '') {
        emptyCount++;
        if (emptyCount <= 2) result.push(line);
      } else {
        emptyCount = 0;
        result.push(line);
      }
    }
    return result.join('\n').trim();
  };

  const titlePrompt = cleanLines(titleLines);
  const contentPrompt = cleanLines(contentLines);

  if (titlePrompt.length > 200 && contentPrompt.length > 200) {
    return { titlePrompt, contentPrompt };
  }

  const titleRegex = /步骤2[：:]?\s*[^\n]*\n([\s\S]*?)(?=步骤3|$)/i;
  const titleMatch = content.match(titleRegex);
  const contentRegex = /步骤3[：:]?\s*[^\n]*\n([\s\S]*?)(?=步骤\d|$)/i;
  const contentMatch = content.match(contentRegex);

  return {
    titlePrompt: titleMatch ? titleMatch[1].trim() : content.substring(0, 2000),
    contentPrompt: contentMatch ? contentMatch[1].trim() : content
  };
}

function parseQualityTemplate(content) {
  return { qualityPrompt: content };
}

function parseOptimizationTemplate(content) {
  let systemPrompt = '';
  let optimizePrompt = content;

  const systemMatch = content.match(/系统[提示词]?[：:]\s*\n?([\s\S]*?)(?=\n\n|\n【|$)/i);
  if (systemMatch) systemPrompt = systemMatch[1].trim();

  const optimizeMatch = content.match(/优化[提示词]?[：:]\s*\n([\s\S]*)/i);
  if (optimizeMatch) optimizePrompt = optimizeMatch[1].trim();

  return { systemPrompt, optimizePrompt };
}

// 辅助函数：转义模板字符串特殊字符
function escapeTemplate(str) {
  return str.replace(/\\/g, '\\\\').replace(/`/g, '`');
}

// 写入 TS 文件
function writePromptFile(filepath, content) {
  const escaped = escapeTemplate(content);
  fs.writeFileSync(filepath, '// 自动生成\n' +
    'export const prompt = `' + escaped + '`;\n'
  );
}

// 平台配置
const platforms = {
  'gzh': {
    contentFile: '公众号爆款提示词.md',
    qualityFile: '公众号六维质检.md',
    optimizationFile: '公众号优化报告.md'
  },
  'xhs': {
    contentFile: '小红书爆款提示词.md',
    qualityFile: '小红书六维质检.md',
    optimizationFile: '小红书优化版报告.md'
  },
  'douyin': {
    contentFile: '抖音爆款提示词.md',
    qualityFile: '抖音六维质检.md',
    optimizationFile: '抖音优化报告.md'
  }
};

// 读取内容分析模板
const analysisContent = fs.readFileSync(path.join(folderPath, '内容分析.md'), 'utf-8');
writePromptFile(path.join(outputDir, 'analysisPrompt.ts'), analysisContent);
console.log('✓ 内容分析模板已导出');

// 读取并导出各平台模板
for (const [platformId, config] of Object.entries(platforms)) {
  console.log(`\n--- ${platformId} ---`);

  // 内容模板
  const contentData = fs.readFileSync(path.join(folderPath, config.contentFile), 'utf-8');
  const parsed = parseContentTemplate(contentData);

  const contentTemplateFile = path.join(outputDir, `${platformId}ContentPrompt.ts`);
  fs.writeFileSync(contentTemplateFile,
    '// 自动生成 - 内容模板\n' +
    'export const titlePrompt = `' + escapeTemplate(parsed.titlePrompt) + '`;\n\n' +
    'export const contentPrompt = `' + escapeTemplate(parsed.contentPrompt) + '`;\n'
  );
  console.log(`✓ ${platformId} 内容模板已导出 (title: ${parsed.titlePrompt.length}字符, content: ${parsed.contentPrompt.length}字符)`);

  // 质检模板
  const qualityData = fs.readFileSync(path.join(folderPath, config.qualityFile), 'utf-8');
  const qualityParsed = parseQualityTemplate(qualityData);
  writePromptFile(path.join(outputDir, `${platformId}QualityPrompt.ts`), qualityParsed.qualityPrompt);
  console.log(`✓ ${platformId} 质检模板已导出 (${qualityParsed.qualityPrompt.length}字符)`);

  // 优化模板
  const optData = fs.readFileSync(path.join(folderPath, config.optimizationFile), 'utf-8');
  const optParsed = parseOptimizationTemplate(optData);
  const optFile = path.join(outputDir, `${platformId}OptimizationPrompt.ts`);
  fs.writeFileSync(optFile,
    '// 自动生成 - 优化模板\n' +
    'export const systemPrompt = `' + escapeTemplate(optParsed.systemPrompt) + '`;\n\n' +
    'export const optimizePrompt = `' + escapeTemplate(optParsed.optimizePrompt) + '`;\n'
  );
  console.log(`✓ ${platformId} 优化模板已导出 (${optParsed.optimizePrompt.length}字符)`);
}

// 创建汇总导出文件
const indexContent = `// 模板提示词汇总
// 由 scripts/export-prompts-to-files.cjs 自动生成

export { prompt as analysisPrompt } from './analysisPrompt';
export { titlePrompt as gzhTitlePrompt, contentPrompt as gzhContentPrompt } from './gzhContentPrompt';
export { prompt as gzhQualityPrompt } from './gzhQualityPrompt';
export { systemPrompt as gzhSystemPrompt, optimizePrompt as gzhOptimizationPrompt } from './gzhOptimizationPrompt';
export { titlePrompt as xhsTitlePrompt, contentPrompt as xhsContentPrompt } from './xhsContentPrompt';
export { prompt as xhsQualityPrompt } from './xhsQualityPrompt';
export { systemPrompt as xhsSystemPrompt, optimizePrompt as xhsOptimizationPrompt } from './xhsOptimizationPrompt';
export { titlePrompt as douyinTitlePrompt, contentPrompt as douyinContentPrompt } from './douyinContentPrompt';
export { prompt as douyinQualityPrompt } from './douyinQualityPrompt';
export { systemPrompt as douyinSystemPrompt, optimizePrompt as douyinOptimizationPrompt } from './douyinOptimizationPrompt';
`;

fs.writeFileSync(path.join(outputDir, 'index.ts'), indexContent);
console.log('\\n✓ 汇总导出文件 index.ts 已创建');
console.log('\\n输出目录:', outputDir);
