import { Buffer } from 'buffer';

export interface ValidationResult {
  cleaned: string;
  warnings: string[];
  errors: string[];
  detectedIssues: {
    wasHtml: boolean;
    wasEncodingIssue: boolean;
    wasTruncated: boolean;
    wasTooShort: boolean;
    wasPureTitle: boolean;
    wasPureLinks: boolean;
    wasEmpty: boolean;
  };
}

const HTML_TAG_REGEX = /<(html|div|p|br|span|h[1-6]|a|ul|ol|li|blockquote|pre|code)\b[^>]*>/gi;
const URL_REGEX = /^https?:\/\/[^\s]+$/i;
const MIN_LENGTH_WARN = 500;
const MIN_CONTENT_FOR_ANALYSIS = 200;

function decodeBuffer(raw: Buffer): { encoding: string; text: string } {
  try {
    return { encoding: 'utf-8', text: raw.toString('utf-8') };
  } catch {}
  try {
    return { encoding: 'gb18030', text: raw.toString('gb18030') };
  } catch {}
  return { encoding: 'binary', text: raw.toString('utf-8') };
}

function stripHtmlTags(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function containsHtml(text: string): boolean {
  return HTML_TAG_REGEX.test(text);
}

function isPureLinks(text: string): boolean {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return false;
  const urlLines = lines.filter(l => URL_REGEX.test(l.trim()));
  return urlLines.length >= lines.length * 0.8 && text.length < 500;
}

function isPureTitle(text: string): boolean {
  const firstLine = text.split('\n')[0] || '';
  const isHeading = firstLine.startsWith('#');
  const body = text.slice(firstLine.length).trim();
  return isHeading && body.length < 100 && text.length < 200;
}

function isTruncated(text: string): boolean {
  const trimmed = text.trim();
  const lines = trimmed.split('\n');

  // Check: if last non-blank line is a list item, content ends abruptly
  let lastNonBlankIndex = lines.length - 1;
  while (lastNonBlankIndex >= 0 && !lines[lastNonBlankIndex].trim()) lastNonBlankIndex--;
  if (lastNonBlankIndex >= 0) {
    const lastNonBlank = lines[lastNonBlankIndex];
    if (/^[-*+]\s|\d+\.\s/.test(lastNonBlank)) {
      // Last non-blank line is a list item with nothing after it
      return true;
    }
  }

  // Check: unbalanced brackets
  const openBrackets = (trimmed.match(/\[/g) || []).length;
  const closeBrackets = (trimmed.match(/\]/g) || []).length;
  if (openBrackets > closeBrackets) return true;

  return false;
}

function hasGibberish(text: string): boolean {
  const normalChars = text.match(/[\u4e00-\u9fa5a-zA-Z0-9\s,.!?;:'"()，。！？；：（）【】《》…—、]/g) || [];
  if (text.length === 0) return false;
  return normalChars.length / text.length < 0.7;
}

export interface ValidateOptions {
  minLengthError?: number;
  minLengthWarn?: number;
  htmlHandling?: 'strip' | 'reject';
}

const DEFAULT_OPTIONS: ValidateOptions = {
  minLengthError: MIN_CONTENT_FOR_ANALYSIS,
  minLengthWarn: MIN_LENGTH_WARN,
  htmlHandling: 'strip',
};

export async function validateAndCleanInput(
  raw: Buffer,
  filename: string,
  options: ValidateOptions = DEFAULT_OPTIONS,
): Promise<ValidationResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const warnings: string[] = [];
  const errors: string[] = [];

  const { encoding, text: decodedText } = decodeBuffer(raw);
  const hadEncodingIssue = encoding !== 'utf-8';

  let cleaned = decodedText;
  const hadHtml = containsHtml(cleaned);
  if (hadHtml) {
    if (opts.htmlHandling === 'reject') {
      errors.push('检测到 HTML 格式内容，请提供纯 Markdown 格式文件');
      const encIssue = hadEncodingIssue;
      return {
        cleaned,
        warnings,
        errors,
        detectedIssues: { wasHtml: true, wasEncodingIssue: encIssue, wasTruncated: false, wasTooShort: false, wasPureTitle: false, wasPureLinks: false, wasEmpty: false },
      };
    }
    cleaned = stripHtmlTags(cleaned);
  }

  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  if (cleaned.length === 0) {
    errors.push('内容为空，请提供有效的文章内容');
    return {
      cleaned,
      warnings,
      errors,
      detectedIssues: { wasHtml: false, wasEncodingIssue: false, wasTruncated: false, wasTooShort: false, wasPureTitle: false, wasPureLinks: true, wasEmpty: true },
    };
  }

  if (isPureLinks(cleaned)) {
    errors.push('未检测到有效内容（仅有链接），请提供包含正文的文章');
    return {
      cleaned,
      warnings,
      errors,
      detectedIssues: { wasHtml: hadHtml, wasEncodingIssue: hadEncodingIssue, wasTruncated: false, wasTooShort: false, wasPureTitle: false, wasPureLinks: true, wasEmpty: false },
    };
  }

  if (isTruncated(cleaned)) {
    errors.push('文章内容被截断（列表或段落中途结束），请提供完整内容');
    return {
      cleaned,
      warnings,
      errors,
      detectedIssues: { wasHtml: hadHtml, wasEncodingIssue: hadEncodingIssue, wasTruncated: true, wasTooShort: false, wasPureTitle: false, wasPureLinks: false, wasEmpty: false },
    };
  }

  if (isPureTitle(cleaned)) {
    errors.push('内容仅包含标题，缺少正文，无法进行分析');
    return {
      cleaned,
      warnings,
      errors,
      detectedIssues: { wasHtml: hadHtml, wasEncodingIssue: hadEncodingIssue, wasTruncated: false, wasTooShort: false, wasPureTitle: true, wasPureLinks: false, wasEmpty: false },
    };
  }

  if (hasGibberish(cleaned)) {
    errors.push('内容包含过多乱码字符，请确认文件编码为 UTF-8 或 GB18030');
    return {
      cleaned,
      warnings,
      errors,
      detectedIssues: { wasHtml: hadHtml, wasEncodingIssue: hadEncodingIssue, wasTruncated: false, wasTooShort: false, wasPureTitle: false, wasPureLinks: false, wasEmpty: false },
    };
  }

  const isTooShort = cleaned.length < (opts.minLengthError ?? MIN_CONTENT_FOR_ANALYSIS);
  if (isTooShort) {
    errors.push(`内容过短（${cleaned.length}字），无法进行有效的爆款分析，请提供更完整的文章`);
    return {
      cleaned,
      warnings,
      errors,
      detectedIssues: { wasHtml: hadHtml, wasEncodingIssue: hadEncodingIssue, wasTruncated: false, wasTooShort: true, wasPureTitle: false, wasPureLinks: false, wasEmpty: false },
    };
  }

  const hadTruncation = isTruncated(cleaned);
  if (hadTruncation) {
    errors.push('文章内容被截断（列表或段落中途结束），请提供完整内容');
    return {
      cleaned,
      warnings,
      errors,
      detectedIssues: { wasHtml: hadHtml, wasEncodingIssue: hadEncodingIssue, wasTruncated: true, wasTooShort: false, wasPureTitle: false, wasPureLinks: false, wasEmpty: false },
    };
  }

  if (cleaned.length < (opts.minLengthWarn ?? MIN_LENGTH_WARN)) {
    warnings.push(`内容较短（${cleaned.length}字），分析结果可能不够精准`);
  }

  return {
    cleaned,
    warnings,
    errors,
    detectedIssues: {
      wasHtml: hadHtml,
      wasEncodingIssue: hadEncodingIssue,
      wasTruncated: false,
      wasTooShort: false,
      wasPureTitle: false,
      wasPureLinks: false,
      wasEmpty: false,
    },
  };
}
