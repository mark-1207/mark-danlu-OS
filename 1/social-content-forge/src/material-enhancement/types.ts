import { MaterialPackage, AudienceProfile } from '../../types';

export interface MaterialEnhancementConfig {
  maxMaterialsPerQuery: number;
  minQuoteLength: number;
  minCaseLength: number;
}

export interface EnhancementResult {
  query: string;
  materialPackage: MaterialPackage;
  relatedTopics: string[];
  confidence: number;  // 0-1, how confident we are in the enhancement
}