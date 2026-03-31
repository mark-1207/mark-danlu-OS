export interface CaseFile {
  path: string;
  filename: string;
  type: 'good' | 'bad';
  content: string;
  addedAt: string;
  tags: string[];
}

export interface LearnedInsight {
  id: string;
  sourceFile: string;
  type: 'good' | 'bad';
  insight: string;
  applicableDimensions: string[];
  extractedQuotes?: string[];
  extractedCases?: string[];
  generatedAt: string;
}

export interface LibraryIndex {
  lastUpdated: string;
  lastCheckedFile: string;
  goodCount: number;
  badCount: number;
  totalInsights: number;
}