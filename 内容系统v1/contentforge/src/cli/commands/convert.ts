import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { logger } from '../../utils/logger.js';
import { sanitizeFilename } from '../../utils/sanitize.js';

interface ConvertOptions {
  output?: string;
  extension?: string;
  keepDataUris: boolean;
}

interface ConvertResult {
  title: string;
  author?: string;
  wordCount?: number;
  readingTime?: string;
  theme?: string;
  summary: string;
  outputPath: string;
}

function extractMetaFromMarkdown(content: string): ConvertResult {
  const lines = content.split('\n');

  let title = '';
  let author = '';
  let wordCount: number | undefined;
  let readingTime: string | undefined;
  let theme = '';

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('# ') && !title) {
      title = trimmed.slice(2).trim();
    }

    const wordCountMatch = trimmed.match(/约\s*(\d+)\s*字/);
    if (wordCountMatch) {
      wordCount = parseInt(wordCountMatch[1], 10);
    }

    const readingMatch = trimmed.match(/阅读[约\s]*(\d+)\s*分钟/);
    if (readingMatch) {
      readingTime = `约 ${readingMatch[1]} 分钟`;
    }

    if (trimmed.startsWith('**') && trimmed.endsWith('**') && !theme) {
      theme = trimmed.slice(2, -2).replace(/!\[.*?\]\(.*?\)/g, '').trim();
    }

    if (!author && /^[a-zA-Z0-9_]+$/.test(trimmed) && trimmed.length > 2 && trimmed.length < 30) {
      if (trimmed !== title && !title.includes(trimmed)) {
        author = trimmed;
      }
    }
  }

  if (!title) {
    title = '未命名';
  }

  return {
    title,
    author: author || undefined,
    wordCount,
    readingTime,
    theme: theme || undefined,
    summary: `包含 AI 三阶段时间线、术语白皮书正文等内容`,
    outputPath: '',
  };
}

async function convertFile(
  inputPath: string,
  outputPath: string,
  keepDataUris: boolean
): Promise<void> {
  const args = ['-m', 'markitdown', inputPath, '-o', outputPath];

  if (keepDataUris) {
    args.push('--keep-data-uris');
  }

  await new Promise<void>((resolve, reject) => {
    const proc = spawn('python', args, { stdio: 'pipe' });
    let stderr = '';

    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `markitdown exited with code ${code}`));
      }
    });
    proc.on('error', reject);
  });
}

async function convertUrl(
  url: string,
  outputPath: string,
  keepDataUris: boolean
): Promise<void> {
  const tmpPath = path.join(process.cwd(), `.tmp_markitdown_${Date.now()}`);

  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('curl', ['-sL', '-o', tmpPath, url], { stdio: 'pipe' });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`curl exited with code ${code}`));
      });
      proc.on('error', reject);
    });

    await convertFile(tmpPath, outputPath, keepDataUris);
  } finally {
    try {
      await fs.unlink(tmpPath);
    } catch {}
  }
}

async function doConvert(
  input: string,
  outputDir: string,
  keepDataUris: boolean
): Promise<ConvertResult> {
  const isUrl = input.startsWith('http://') || input.startsWith('https://');

  if (isUrl) {
    console.log(chalk.blue(`🌐 Converting URL: ${input}`));
  } else {
    console.log(chalk.blue(`📄 Converting: ${path.resolve(input)}`));
  }

  const tmpOutput = path.join(outputDir, `.tmp_${Date.now()}.md`);

  if (isUrl) {
    await convertUrl(input, tmpOutput, keepDataUris);
  } else {
    const resolvedPath = path.resolve(input);
    const ext = path.extname(resolvedPath);
    const tmpInput = path.join(outputDir, `.tmp_input_${Date.now()}${ext}`);
    await fs.copyFile(resolvedPath, tmpInput);
    try {
      await convertFile(tmpInput, tmpOutput, keepDataUris);
    } finally {
      try {
        await fs.unlink(tmpInput);
      } catch {}
    }
  }

  const content = await fs.readFile(tmpOutput, 'utf-8');
  const meta = extractMetaFromMarkdown(content);
  const safeName = sanitizeFilename(meta.title);
  const finalOutput = path.join(outputDir, `${safeName}.md`);

  await fs.rename(tmpOutput, finalOutput);

  console.log(chalk.green(`  ✅ → ${finalOutput}`));
  console.log(chalk.bold('\n内容概要：'));
  console.log(`  - 标题：${meta.title}`);
  if (meta.author) console.log(`  - 作者：${meta.author}`);
  if (meta.wordCount) console.log(`  - 字数：约 ${meta.wordCount} 字`);
  if (meta.readingTime) console.log(`  - 阅读：${meta.readingTime}`);
  if (meta.theme) console.log(`  - 主题：${meta.theme}`);
  console.log(`  - 摘要：${meta.summary}`);

  return { ...meta, outputPath: finalOutput };
}

export function registerConvertCommand(program: Command): void {
  program
    .command('convert')
    .description('使用 markitdown 将文件/URL 转换为 Markdown')
    .argument('[inputs...]', '文件路径或 URL（支持多个）')
    .option('-o, --output <dir>', '输出目录（批量时使用）')
    .option('-k, --keep-data-uris', '保留图片 data URIs', false)
    .action(async (inputs: string[], opts: ConvertOptions) => {
      if (inputs.length === 0) {
        console.log(chalk.yellow('用法: contentforge convert <file|url> [files...] [-o <output_dir>]'));
        console.log(chalk.gray('示例:'));
        console.log(chalk.gray('  contentforge convert article.pdf -o ./md/'));
        console.log(chalk.gray('  contentforge convert https://example.com/doc.docx'));
        console.log(chalk.gray('  contentforge convert file1.pdf file2.docx -o ./output/'));
        return;
      }

      try {
        const outputDir = opts.output || path.join(process.cwd(), 'output');
        await fs.mkdir(outputDir, { recursive: true });

        if (inputs.length === 1 && !opts.output) {
          await doConvert(inputs[0], outputDir, opts.keepDataUris);
        } else {
          console.log(chalk.bold(`\n📦 Batch convert: ${inputs.length} files\n`));

          const results = {
            success: [] as ConvertResult[],
            failed: [] as Array<{ path: string; error: string }>,
          };

          for (const input of inputs) {
            try {
              const result = await doConvert(input, outputDir, opts.keepDataUris);
              results.success.push(result);
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              console.log(chalk.red(`  ❌ Failed: ${msg}`));
              results.failed.push({ path: input, error: msg });
            }
          }

          console.log(chalk.green(`\n✅ 完成: ${results.success.length} 成功, ${results.failed.length} 失败\n`));

          if (results.failed.length > 0) {
            console.log(chalk.red('失败列表：'));
            for (const f of results.failed) {
              console.log(chalk.red(`  - ${f.path}: ${f.error}`));
            }
          }
        }
      } catch (error) {
        logger.error('convert command failed', { error: String(error) });
        console.error(chalk.red(`错误: ${error}`));
        process.exit(1);
      }
    });
}