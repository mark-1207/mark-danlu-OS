/**
 * 模板验证器模块导出
 */

export {
  analyzeTemplateContent,
  autoFixTemplate,
  validateTemplate,
  analyzeAndFix,
  getFixPreview,
} from './TemplateValidator';

export type {
  AnalysisResult,
  FixedTemplate,
  ValidationResult,
} from '../../data/templateSpecs';
