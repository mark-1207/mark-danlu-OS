/**
 * L1 禁词扫描器（卡兹克质检）
 * 自动扫描文章中的AI味禁词，并提供替换建议。
 */

export const L1_FORBIDDEN_WORDS = [
  '说白了',
  '这意味着',
  '意味着什么',
  '本质上',
  '换句话说',
  '不可否认',
  '综上所述',
  '总的来说',
  '首先...其次...最后',
  '值得注意的是',
  '不难发现',
  '让我们来看看',
  '接下来让我们',
  '在当今...的时代',
  '随着...的发展',
] as const;

export const L1_REPLACEMENTS: Record<string, string> = {
  '说白了': '坦率的讲',
  '这意味着': '那结果会怎样呢',
  '意味着什么': '那结果会怎样呢',
  '本质上': '说到底',
  '换句话说': '你想想看',
  '不可否认': '',
  '综上所述': '',
  '总的来说': '',
  '首先...其次...最后': '',
  '值得注意的是': '',
  '不难发现': '',
  '让我们来看看': '',
  '接下来让我们': '',
  '在当今...的时代': '',
  '随着...的发展': '',
};

export interface L1Hit {
  word: string;
  position: number;
  replacement: string;
}

export interface L1ScanResult {
  hits: L1Hit[];
  cleanText: string;
}

export class L1ForbiddenWordScanner {
  /**
   * Scan text for forbidden words and return hits with positions and replacements.
   */
  scan(text: string): L1ScanResult {
    const hits: L1Hit[] = [];
    for (const word of L1_FORBIDDEN_WORDS) {
      let position = 0;
      while (true) {
        const idx = text.indexOf(word, position);
        if (idx === -1) break;
        hits.push({
          word,
          position: idx,
          replacement: L1_REPLACEMENTS[word] ?? '',
        });
        position = idx + word.length;
      }
    }
    hits.sort((a, b) => a.position - b.position);
    return { hits, cleanText: this.replace(text, hits) };
  }

  /**
   * Apply all replacements to the text.
   */
  private replace(text: string, hits: L1Hit[]): string {
    let result = text;
    // Apply in reverse order to preserve positions
    const sortedHits = [...hits].sort((a, b) => b.position - a.position);
    for (const hit of sortedHits) {
      if (hit.replacement === '') {
        result = result.slice(0, hit.position) + result.slice(hit.position + hit.word.length);
      } else {
        result = result.slice(0, hit.position) + hit.replacement + result.slice(hit.position + hit.word.length);
      }
    }
    return result;
  }
}
