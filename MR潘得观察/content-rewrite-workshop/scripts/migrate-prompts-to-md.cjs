/**
 * TS 到 MD 迁移脚本
 *
 * 将 src/data/*.ts 中的提示词模板迁移到 prompts/*.md 文件
 *
 * 使用方法: node migrate-prompts-to-md.cjs
 */

const fs = require('fs');
const path = require('path');

// 定义模板映射关系
const TEMPLATE_MAPPINGS = [
  // analysisPrompt.ts
  {
    tsFile: 'analysisPrompt.ts',
    exportName: 'analysisPrompt',
    mdFile: 'analysis/default.md',
    id: 'analysis-default',
    name: '内容深度分析',
    type: 'analysis',
    platform: 'common',
    outputFormat: 'json'
  },
  // gzhContentPrompt.ts
  {
    tsFile: 'gzhContentPrompt.ts',
    exportName: 'titlePrompt',
    mdFile: 'content/gzh-title.md',
    id: 'gzh-title',
    name: '公众号标题生成',
    type: 'content-title',
    platform: 'gzh',
    outputFormat: 'json'
  },
  {
    tsFile: 'gzhContentPrompt.ts',
    exportName: 'contentPrompt',
    mdFile: 'content/gzh-content.md',
    id: 'gzh-content',
    name: '公众号正文生成',
    type: 'content-body',
    platform: 'gzh',
    outputFormat: 'text'
  },
  // xhsContentPrompt.ts
  {
    tsFile: 'xhsContentPrompt.ts',
    exportName: 'titlePrompt',
    mdFile: 'content/xhs-title.md',
    id: 'xhs-title',
    name: '小红书标题生成',
    type: 'content-title',
    platform: 'xhs',
    outputFormat: 'json'
  },
  {
    tsFile: 'xhsContentPrompt.ts',
    exportName: 'contentPrompt',
    mdFile: 'content/xhs-content.md',
    id: 'xhs-content',
    name: '小红书正文生成',
    type: 'content-body',
    platform: 'xhs',
    outputFormat: 'text'
  },
  // douyinContentPrompt.ts
  {
    tsFile: 'douyinContentPrompt.ts',
    exportName: 'titlePrompt',
    mdFile: 'content/douyin-title.md',
    id: 'douyin-title',
    name: '抖音标题生成',
    type: 'content-title',
    platform: 'douyin',
    outputFormat: 'json'
  },
  {
    tsFile: 'douyinContentPrompt.ts',
    exportName: 'contentPrompt',
    mdFile: 'content/douyin-content.md',
    id: 'douyin-content',
    name: '抖音脚本生成',
    type: 'content-body',
    platform: 'douyin',
    outputFormat: 'text'
  },
  // gzhQualityPrompt.ts
  {
    tsFile: 'gzhQualityPrompt.ts',
    exportName: 'qualityPrompt',
    mdFile: 'quality/gzh-quality.md',
    id: 'gzh-quality',
    name: '公众号内容质检',
    type: 'quality',
    platform: 'gzh',
    outputFormat: 'json'
  },
  // xhsQualityPrompt.ts
  {
    tsFile: 'xhsQualityPrompt.ts',
    exportName: 'qualityPrompt',
    mdFile: 'quality/xhs-quality.md',
    id: 'xhs-quality',
    name: '小红书内容质检',
    type: 'quality',
    platform: 'xhs',
    outputFormat: 'json'
  },
  // douyinQualityPrompt.ts
  {
    tsFile: 'douyinQualityPrompt.ts',
    exportName: 'qualityPrompt',
    mdFile: 'quality/douyin-quality.md',
    id: 'douyin-quality',
    name: '抖音内容质检',
    type: 'quality',
    platform: 'douyin',
    outputFormat: 'json'
  },
  // gzhOptimizationPrompt.ts
  {
    tsFile: 'gzhOptimizationPrompt.ts',
    exportName: 'optimizePrompt',
    mdFile: 'optimization/gzh-optimization.md',
    id: 'gzh-optimization',
    name: '公众号内容优化',
    type: 'optimization',
    platform: 'gzh',
    outputFormat: 'text'
  },
  // xhsOptimizationPrompt.ts
  {
    tsFile: 'xhsOptimizationPrompt.ts',
    exportName: 'optimizePrompt',
    mdFile: 'optimization/xhs-optimization.md',
    id: 'xhs-optimization',
    name: '小红书内容优化',
    type: 'optimization',
    platform: 'xhs',
    outputFormat: 'text'
  },
  // douyinOptimizationPrompt.ts
  {
    tsFile: 'douyinOptimizationPrompt.ts',
    exportName: 'optimizePrompt',
    mdFile: 'optimization/douyin-optimization.md',
    id: 'douyin-optimization',
    name: '抖音内容优化',
    type: 'optimization',
    platform: 'douyin',
    outputFormat: 'text'
  }
];

// 基础路径
const BASE_DIR = path.join(__dirname, '..');
const SRC_DATA_DIR = path.join(BASE_DIR, 'src', 'data');
const PROMPTS_DIR = path.join(BASE_DIR, 'prompts');

/**
 * 从模板字符串中提取所有 {xxx} 占位符
 * @param {string} template - 模板字符串
 * @returns {string[]} 提取的变量名列表（去重）
 */
function extractVariables(template) {
  const matches = template.match(/\{(\w+)\}/g) || [];
  return [...new Set(matches.map(m => m.slice(1, -1)))];
}

/**
 * 从 TS 文件内容中解析指定名称的模板
 * @param {string} fileContent - TS 文件内容
 * @param {string} exportName - 导出的模板名称 (如 'titlePrompt', 'contentPrompt')
 * @returns {string|null} 提取的模板内容，如果没有找到返回 null
 */
function extractTemplate(fileContent, exportName) {
  // 匹配 export const xxxPrompt = `...` 格式
  // 使用非贪婪匹配来获取模板内容
  const regex = new RegExp(`export\\s+const\\s+${exportName}\\s*=\\s*\`([\\s\\S]*?)\`;?\\s*(?:export|$)`, 'i');

  // 尝试匹配开头是 export const xxxPrompt = `
  const fullRegex = new RegExp(`export\\s+const\\s+${exportName}\\s*=\\s*\``);
  const startMatch = fileContent.match(fullRegex);

  if (!startMatch) {
    return null;
  }

  // 从匹配位置开始查找模板结束
  const startIndex = fileContent.indexOf(startMatch[0]) + startMatch[0].length;
  let backtickCount = 1; // 已经遇到了开始的反引号
  let endIndex = startIndex;

  for (let i = startIndex; i < fileContent.length; i++) {
    if (fileContent[i] === '`' && fileContent[i - 1] !== '\\') {
      backtickCount--;
      if (backtickCount === 0) {
        endIndex = i;
        break;
      }
    }
  }

  const templateContent = fileContent.slice(startIndex, endIndex);
  return templateContent.trim();
}

/**
 * 生成 Markdown 文件内容
 * @param {string} templateContent - 模板正文内容
 * @param {object} frontmatter - frontmatter 配置
 * @returns {string} 完整的 Markdown 文件内容
 */
function generateMarkdown(templateContent, frontmatter) {
  const { id, name, type, platform, variables, outputFormat } = frontmatter;

  // 生成 frontmatter
  const frontmatterStr = `---\nid: ${id}\nname: ${name}\ntype: ${type}\nplatform: ${platform}\nvariables:\n${variables.map(v => `  - ${v}`).join('\n')}\noutputFormat: ${outputFormat}\n---`;

  return `${frontmatterStr}\n\n${templateContent}`;
}

/**
 * 确保目录存在
 * @param {string} dirPath - 目录路径
 */
function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 执行迁移
 */
function migrate() {
  console.log('Starting migration from TS to MD...\n');

  let successCount = 0;
  let failCount = 0;

  // 按 TS 文件分组处理，减少文件读取次数
  const filesToProcess = {};

  TEMPLATE_MAPPINGS.forEach(mapping => {
    if (!filesToProcess[mapping.tsFile]) {
      filesToProcess[mapping.tsFile] = [];
    }
    filesToProcess[mapping.tsFile].push(mapping);
  });

  // 处理每个 TS 文件
  Object.entries(filesToProcess).forEach(([tsFile, mappings]) => {
    const tsFilePath = path.join(SRC_DATA_DIR, tsFile);

    if (!fs.existsSync(tsFilePath)) {
      console.error(`[ERROR] TS file not found: ${tsFilePath}`);
      failCount += mappings.length;
      return;
    }

    const fileContent = fs.readFileSync(tsFilePath, 'utf-8');

    mappings.forEach(mapping => {
      try {
        const templateContent = extractTemplate(fileContent, mapping.exportName);

        if (templateContent === null) {
          console.error(`[ERROR] Could not find ${mapping.exportName} in ${tsFile}`);
          failCount++;
          return;
        }

        // 提取变量
        const variables = extractVariables(templateContent);

        // 生成 MD 文件内容
        const mdContent = generateMarkdown(templateContent, {
          id: mapping.id,
          name: mapping.name,
          type: mapping.type,
          platform: mapping.platform,
          variables: variables,
          outputFormat: mapping.outputFormat
        });

        // 确保目标目录存在
        const mdFilePath = path.join(PROMPTS_DIR, mapping.mdFile);
        ensureDirExists(path.dirname(mdFilePath));

        // 写入文件
        fs.writeFileSync(mdFilePath, mdContent, 'utf-8');

        console.log(`[OK] ${mapping.mdFile} (variables: ${variables.length})`);
        successCount++;
      } catch (err) {
        console.error(`[ERROR] Failed to process ${mapping.tsFile}:${mapping.exportName} - ${err.message}`);
        failCount++;
      }
    });
  });

  console.log(`\nMigration complete!`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Failed: ${failCount}`);
}

// 执行迁移
migrate();
