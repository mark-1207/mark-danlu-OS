const fs = require('fs');
const path = require('path');

function escapeTemplate(str) {
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
}

const folderPath = process.argv[2];
const outputDir = path.join(__dirname, '..', 'src', 'data');

// 内容分析模板
const ac = fs.readFileSync(path.join(folderPath, '内容分析.md'), 'utf-8');
fs.writeFileSync(path.join(outputDir, 'analysisPrompt.ts'),
  '// 自动生成\n' +
  'export const analysisPrompt = `' + escapeTemplate(ac) + '`;\n'
);
console.log('✓ analysisPrompt.ts');

// 平台配置
const platforms = {
  'gzh': { cf: '公众号爆款提示词.md', qf: '公众号六维质检.md', of: '公众号优化报告.md' },
  'xhs': { cf: '小红书爆款提示词.md', qf: '小红书六维质检.md', of: '小红书优化版报告.md' },
  'douyin': { cf: '抖音爆款提示词.md', qf: '抖音六维质检.md', of: '抖音优化报告.md' }
};

for (const [pid, cfg] of Object.entries(platforms)) {
  // 内容模板 - 提取标题和正文
  const cc = fs.readFileSync(path.join(folderPath, cfg.cf), 'utf-8');
  const tp = extractTitlePrompt(cc);
  const cp = extractContentPrompt(cc);
  fs.writeFileSync(path.join(outputDir, pid + 'ContentPrompt.ts'),
    '// 自动生成 - 内容模板\n' +
    'export const titlePrompt = `' + escapeTemplate(tp) + '`;\n\n' +
    'export const contentPrompt = `' + escapeTemplate(cp) + '`;\n'
  );
  console.log('✓ ' + pid + 'ContentPrompt.ts');

  // 质检模板
  const qc = fs.readFileSync(path.join(folderPath, cfg.qf), 'utf-8');
  fs.writeFileSync(path.join(outputDir, pid + 'QualityPrompt.ts'),
    '// 自动生成 - 质检模板\n' +
    'export const qualityPrompt = `' + escapeTemplate(qc) + '`;\n'
  );
  console.log('✓ ' + pid + 'QualityPrompt.ts');

  // 优化模板
  const oc = fs.readFileSync(path.join(folderPath, cfg.of), 'utf-8');
  const sp = extractSystemPrompt(oc);
  const op = extractOptimizePrompt(oc);
  fs.writeFileSync(path.join(outputDir, pid + 'OptimizationPrompt.ts'),
    '// 自动生成 - 优化模板\n' +
    'export const systemPrompt = `' + escapeTemplate(sp) + '`;\n\n' +
    'export const optimizePrompt = `' + escapeTemplate(op) + '`;\n'
  );
  console.log('✓ ' + pid + 'OptimizationPrompt.ts');
}

function extractTitlePrompt(content) {
  const lines = content.split('\n');
  const titleLines = [];
  let inTitle = false;
  for (const line of lines) {
    if (/^##\s+步骤2/.test(line)) inTitle = true;
    if (/^##\s+步骤3/.test(line)) inTitle = false;
    if (inTitle || /^##\s+步骤1/.test(line)) titleLines.push(line);
  }
  return titleLines.join('\n').trim();
}

function extractContentPrompt(content) {
  const lines = content.split('\n');
  const contentLines = [];
  let inContent = false;
  for (const line of lines) {
    if (/^##\s+步骤3/.test(line)) inContent = true;
    if (inContent) contentLines.push(line);
  }
  return contentLines.join('\n').trim();
}

function extractSystemPrompt(content) {
  const m = content.match(/你的身份是([^\n]+)/);
  return m ? '你的身份是' + m[1] : '';
}

function extractOptimizePrompt(content) {
  return content;
}
