/**
 * 模板导入脚本
 * 用法: node import-templates-from-folder.js "文件夹路径"
 *
 * 将指定文件夹中的模板文件导入到设置中
 * 文件夹应包含以下文件:
 * - 内容分析.md (内容分析模板)
 * - 公众号爆款提示词.md, 抖音爆款提示词.md, 小红书爆款提示词.md (平台内容模板)
 * - 公众号六维质检.md, 抖音六维质检.md, 小红书六维质检.md (质检模板)
 * - 公众号优化报告.md, 抖音优化报告.md, 小红书优化版报告.md (优化报告模板)
 */

const fs = require('fs');
const path = require('path');

// 平台映射
const PLATFORM_MAP = {
  'gzh': {
    name: '公众号',
    id: 'gzh',
    contentFile: '公众号爆款提示词.md',
    qualityFile: '公众号六维质检.md',
    optimizationFile: '公众号优化报告.md'
  },
  'xhs': {
    name: '小红书',
    id: 'xhs',
    contentFile: '小红书爆款提示词.md',
    qualityFile: '小红书六维质检.md',
    optimizationFile: '小红书优化版报告.md'
  },
  'douyin': {
    name: '抖音',
    id: 'douyin',
    contentFile: '抖音爆款提示词.md',
    qualityFile: '抖音六维质检.md',
    optimizationFile: '抖音优化报告.md'
  }
};

// 读取文件内容
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`读取文件失败: ${filePath}`, error.message);
    return null;
  }
}

// 解析爆款提示词文件，智能拆分标题和正文提示词
// 文件结构通常是：步骤1(解析) + 步骤2(标题) + 步骤3(正文结构) + 步骤4(传播) + 步骤5(质检)
function parseContentTemplate(content, platformName) {
  // 尝试查找 # 标题 或 # 正文 标记
  const titleMatch = content.match(/#\s*标题[提示词]?\s*\n([\s\S]*?)(?=#\s*正文|$)/i);
  const contentMatch = content.match(/#\s*正文[提示词]?\s*\n([\s\S]*)/i);

  if (titleMatch && contentMatch) {
    return {
      titlePrompt: titleMatch[1].trim(),
      contentPrompt: contentMatch[1].trim()
    };
  }

  // 智能拆分：识别 ## 步骤2 和 ## 步骤3-5 的内容
  const lines = content.split('\n');
  const titleLines = [];  // 步骤2：标题与封面设计
  const contentLines = []; // 步骤1(解析) + 步骤3-5(正文/传播/质检)
  let currentSection = 'header';
  let sectionIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检测主要章节 ## 步骤X
    const stepMatch = line.match(/^##\s+步骤(\d+)[：:]/);
    if (stepMatch) {
      const stepNum = parseInt(stepMatch[1]);
      if (stepNum === 2) {
        currentSection = 'title';
        sectionIndex++;
      } else if (stepNum >= 3) {
        currentSection = 'content';
        sectionIndex++;
      } else if (stepNum === 1) {
        currentSection = 'content';
        sectionIndex++;
      }
      // 保留章节标题行
      titleLines.push(line);
      contentLines.push(line);
      continue;
    }

    // 检测次要章节 ### 或其他大标题
    if (/^## [^\s]/.test(line) && !stepMatch) {
      // 碰到其他主要章节（如附录、工具包）归入正文
      if (!line.includes('标题') && !line.includes('封面')) {
        currentSection = 'content';
        sectionIndex++;
      }
    }

    // 根据当前章节归属决定放到哪个数组
    if (currentSection === 'title') {
      titleLines.push(line);
    } else {
      contentLines.push(line);
    }
  }

  // 清理空行过多的部分
  const cleanLines = (arr) => {
    let result = [];
    let emptyCount = 0;
    for (const line of arr) {
      if (line.trim() === '') {
        emptyCount++;
        if (emptyCount <= 2) result.push(line); // 保留最多2个连续空行
      } else {
        emptyCount = 0;
        result.push(line);
      }
    }
    return result.join('\n').trim();
  };

  const titlePrompt = cleanLines(titleLines);
  const contentPrompt = cleanLines(contentLines);

  // 验证拆分结果
  if (titlePrompt.length > 200 && contentPrompt.length > 200) {
    console.log(`    -> 智能拆分: 标题部分 ${titleLines.length}行, 正文部分 ${contentLines.length}行`);
    return { titlePrompt, contentPrompt };
  }

  // 拆分失败，使用原始方法
  return parseContentTemplateFallback(content, platformName);
}

// 备用解析方法
function parseContentTemplateFallback(content, platformName) {
  // 尝试提取步骤2相关内容作为标题提示词
  const titleRegex = /步骤2[：:]?\s*[^\n]*\n([\s\S]*?)(?=步骤3|$)/i;
  const titleMatch = content.match(titleRegex);

  // 尝试提取步骤3-5相关内容作为正文提示词
  const contentRegex = /步骤3[：:]?\s*[^\n]*\n([\s\S]*?)(?=步骤\d|$)/i;
  const contentMatch = content.match(contentRegex);

  if (titleMatch && contentMatch) {
    return {
      titlePrompt: titleMatch[1].trim(),
      contentPrompt: contentMatch[1].trim()
    };
  }

  // 最后手段：使用整个内容
  return {
    titlePrompt: content.substring(0, 2000),
    contentPrompt: content
  };
}

// 解析质检模板
function parseQualityTemplate(content) {
  // 尝试查找提示词部分
  let qualityPrompt = content;

  // 如果有 # 提示词 标记，提取其后内容
  const promptMatch = content.match(/#\s*提示词\s*\n([\s\S]*)/i);
  if (promptMatch) {
    qualityPrompt = promptMatch[1].trim();
  }

  return { qualityPrompt };
}

// 解析优化报告模板
function parseOptimizationTemplate(content) {
  // 优化报告通常包含 systemPrompt 和 optimizePrompt
  let systemPrompt = '';
  let optimizePrompt = content;

  // 尝试提取系统提示词
  const systemMatch = content.match(/系统[提示词]?[：:]\s*\n?([\s\S]*?)(?=\n\n|\n【|$)/i);
  if (systemMatch) {
    systemPrompt = systemMatch[1].trim();
  }

  // 尝试提取优化提示词
  const optimizeMatch = content.match(/优化[提示词]?[：:]\s*\n([\s\S]*)/i);
  if (optimizeMatch) {
    optimizePrompt = optimizeMatch[1].trim();
  }

  return { systemPrompt, optimizePrompt };
}

// 读取内容分析模板
function readAnalysisTemplate(content) {
  return {
    analysisPrompt: content
  };
}

// 主函数
function main() {
  const folderPath = process.argv[2];

  if (!folderPath) {
    console.error('用法: node import-templates-from-folder.js "文件夹路径"');
    console.error('示例: node import-templates-from-folder.js "c:/Users/admin/Desktop/新建文件夹 (2)"');
    process.exit(1);
  }

  console.log(`正在从文件夹导入模板: ${folderPath}`);
  console.log('='.repeat(50));

  // 读取内容分析模板
  const analysisFile = path.join(folderPath, '内容分析.md');
  const analysisContent = readFile(analysisFile);
  let analysisTemplate = null;

  if (analysisContent) {
    analysisTemplate = readAnalysisTemplate(analysisContent);
    console.log('✓ 内容分析模板已读取');
  } else {
    console.log('✗ 内容分析.md 未找到');
  }

  // 读取各平台模板
  const platforms = {};
  for (const [platformId, platform] of Object.entries(PLATFORM_MAP)) {
    console.log(`\n--- ${platform.name} ---`);

    // 读取内容模板
    const contentFile = path.join(folderPath, platform.contentFile);
    const contentData = readFile(contentFile);

    if (contentData) {
      const parsed = parseContentTemplate(contentData, platform.name);
      platforms[platformId] = {
        ...platform,
        contentTemplate: {
          id: `${platformId}-custom`,
          name: `${platform.name}自定义模板`,
          titlePrompt: parsed.titlePrompt,
          contentPrompt: parsed.contentPrompt
        }
      };
      console.log(`✓ ${platform.contentFile} 已读取 (titlePrompt: ${parsed.titlePrompt.length}字符, contentPrompt: ${parsed.contentPrompt.length}字符)`);
    } else {
      console.log(`✗ ${platform.contentFile} 未找到`);
    }

    // 读取质检模板
    const qualityFile = path.join(folderPath, platform.qualityFile);
    const qualityContent = readFile(qualityFile);

    if (qualityContent) {
      const parsed = parseQualityTemplate(qualityContent);
      platforms[platformId].qualityTemplate = {
        id: `${platformId}-quality-custom`,
        name: `${platform.name}自定义质检`,
        qualityPrompt: parsed.qualityPrompt
      };
      console.log(`✓ ${platform.qualityFile} 已读取 (qualityPrompt: ${parsed.qualityPrompt.length}字符)`);
    } else {
      console.log(`✗ ${platform.qualityFile} 未找到`);
    }

    // 读取优化模板
    const optFile = path.join(folderPath, platform.optimizationFile);
    const optContent = readFile(optFile);

    if (optContent) {
      const parsed = parseOptimizationTemplate(optContent);
      platforms[platformId].optimizationTemplate = {
        id: `${platformId}-optimization-custom`,
        name: `${platform.name}自定义优化`,
        systemPrompt: parsed.systemPrompt,
        optimizePrompt: parsed.optimizePrompt
      };
      console.log(`✓ ${platform.optimizationFile} 已读取 (optimizePrompt: ${parsed.optimizePrompt.length}字符)`);
    } else {
      console.log(`✗ ${platform.optimizationFile} 未找到`);
    }
  }

  // 生成输出
  console.log('\n' + '='.repeat(50));
  console.log('模板读取完成!');
  console.log('\n可用的模板数据:');

  for (const [platformId, platform] of Object.entries(platforms)) {
    console.log(`\n【${platform.name}】`);
    if (platform.contentTemplate) {
      console.log(`  - 内容模板: ${platform.contentTemplate.name}`);
    }
    if (platform.qualityTemplate) {
      console.log(`  - 质检模板: ${platform.qualityTemplate.name}`);
    }
    if (platform.optimizationTemplate) {
      console.log(`  - 优化模板: ${platform.optimizationTemplate.name}`);
    }
  }

  // 输出JSON格式的数据，方便复制使用
  const outputData = {
    analysisTemplate,
    platforms,
    exportTime: new Date().toISOString(),
    instructions: '请在设置页面手动更新模板，或使用浏览器的开发者控制台导入此数据'
  };

  const outputPath = path.join(folderPath, 'imported-templates.json');
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf-8');
  console.log(`\n完整数据已导出到: ${outputPath}`);

  // 输出可以直接在浏览器控制台执行的代码
  const consoleCode = generateConsoleCode(outputData);
  const consoleCodePath = path.join(folderPath, 'import-to-browser.js');
  fs.writeFileSync(consoleCodePath, consoleCode, 'utf-8');
  console.log(`浏览器控制台脚本已导出到: ${consoleCodePath}`);
  console.log('\n使用方法:');
  console.log('1. 打开浏览器，进入内容改写工坊');
  console.log('2. 按F12打开开发者工具');
  console.log('3. 切换到Console标签');
  console.log('4. 复制 import-to-browser.js 的内容并粘贴执行');
}

// 生成浏览器控制台代码
function generateConsoleCode(data) {
  return `
// ============================================
// 模板导入脚本 - 在浏览器控制台中执行
// ============================================

const importData = ${JSON.stringify(data, null, 2)};

// 读取当前设置
const currentSettings = JSON.parse(localStorage.getItem('refine-settings') || '{}');

// 更新内容分析模板
if (importData.analysisTemplate) {
  const analysisTemplates = currentSettings.analysis?.templates || [];
  const existingIndex = analysisTemplates.findIndex(t => t.name === importData.analysisTemplate.analysisPrompt.substring(0, 50));

  if (existingIndex >= 0) {
    // 更新现有模板
    analysisTemplates[existingIndex] = {
      ...analysisTemplates[existingIndex],
      ...importData.analysisTemplate,
      id: analysisTemplates[existingIndex].id,
      isBuiltIn: false
    };
  } else {
    // 添加新模板
    analysisTemplates.push({
      id: 'analysis-' + Date.now(),
      name: '导入的内容分析模板',
      isBuiltIn: false,
      ...importData.analysisTemplate
    });
  }

  currentSettings.analysis = {
    ...currentSettings.analysis,
    templates: analysisTemplates
  };
  console.log('✓ 内容分析模板已更新');
}

// 更新平台内容模板
if (importData.platforms) {
  const platformMap = {
    'gzh': 'gzh',
    'xhs': 'xhs',
    'douyin': 'douyin'
  };

  for (const [platformId, platformData] of Object.entries(importData.platforms)) {
    const actualPlatformId = platformMap[platformId];
    if (!actualPlatformId) continue;

    const platforms = currentSettings.platforms?.platforms || [];
    const platformIndex = platforms.findIndex(p => p.id === actualPlatformId);

    if (platformIndex >= 0 && platformData.contentTemplate) {
      // 添加新的内容模板到平台
      const newTemplate = {
        id: actualPlatformId + '-custom-' + Date.now(),
        name: platformData.contentTemplate.name,
        titlePrompt: platformData.contentTemplate.titlePrompt,
        contentPrompt: platformData.contentTemplate.contentPrompt
      };

      platforms[platformIndex].templates.push(newTemplate);
      console.log('✓ ' + platformData.name + ' 内容模板已添加');
    }
  }

  currentSettings.platforms = {
    ...currentSettings.platforms,
    platforms: platforms
  };
}

// 更新质检模板
if (importData.platforms) {
  const qualityTemplates = currentSettings.qualityAnalysis?.templates || [];

  for (const [platformId, platformData] of Object.entries(importData.platforms)) {
    if (!platformData.qualityTemplate) continue;

    const platformMap = { 'gzh': 'gzh', 'xhs': 'xhs', 'douyin': 'douyin' };
    const actualPlatformId = platformMap[platformId];
    if (!actualPlatformId) continue;

    // 检查是否已存在该平台的质检模板
    const existingIndex = qualityTemplates.findIndex(
      t => t.platformId === actualPlatformId && t.name === platformData.qualityTemplate.name
    );

    if (existingIndex >= 0) {
      qualityTemplates[existingIndex] = {
        ...qualityTemplates[existingIndex],
        qualityPrompt: platformData.qualityTemplate.qualityPrompt
      };
    } else {
      qualityTemplates.push({
        id: actualPlatformId + '-quality-' + Date.now(),
        name: platformData.qualityTemplate.name,
        platformId: actualPlatformId,
        isBuiltIn: false,
        isDefault: false,
        qualityPrompt: platformData.qualityTemplate.qualityPrompt
      });
    }
    console.log('✓ ' + platformData.name + ' 质检模板已更新');
  }

  currentSettings.qualityAnalysis = {
    ...currentSettings.qualityAnalysis,
    templates: qualityTemplates
  };
}

// 更新优化模板
if (importData.platforms) {
  const optimizationTemplates = currentSettings.optimization?.templates || [];

  for (const [platformId, platformData] of Object.entries(importData.platforms)) {
    if (!platformData.optimizationTemplate) continue;

    const platformMap = { 'gzh': 'gzh', 'xhs': 'xhs', 'douyin': 'douyin' };
    const actualPlatformId = platformMap[platformId];
    if (!actualPlatformId) continue;

    optimizationTemplates.push({
      id: actualPlatformId + '-optimization-' + Date.now(),
      name: platformData.optimizationTemplate.name,
      platformId: actualPlatformId,
      isBuiltIn: false,
      isDefault: false,
      systemPrompt: platformData.optimizationTemplate.systemPrompt || '',
      optimizePrompt: platformData.optimizationTemplate.optimizePrompt
    });
    console.log('✓ ' + platformData.name + ' 优化模板已更新');
  }

  currentSettings.optimization = {
    ...currentSettings.optimization,
    templates: optimizationTemplates
  };
}

// 保存设置
localStorage.setItem('refine-settings', JSON.stringify(currentSettings));
console.log('\\n✅ 所有模板已成功导入！请刷新页面查看更新。');
`;
}

main();
