/**
 * 模板验证器模块导出
 *
 * 注意：格式化功能已迁移到 templateFormatter.ts
 * 本模块仅保留 validateTemplate 用于校验
 */

export {
  validateTemplate,
} from './TemplateValidator';

export type {
  ValidationResult,
} from '../../data/templateSpecs';
