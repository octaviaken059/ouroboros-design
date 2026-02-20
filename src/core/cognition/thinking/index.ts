/**
 * @file core/cognition/thinking/index.ts
 * @description 思维链系统导出
 */

// 类型导出 (使用 export type 明确标识)
export type {
  ClassificationResult,
  ProblemType,
} from './classifier';

export type {
  ThinkingTemplate,
  ThinkingStep,
} from './templates';

export type {
  ThinkingChain,
  ThoughtStep,
  ThinkingOptions,
  ThoughtBranch,
} from './engine';

// 值导出
export {
  ProblemClassifier,
  problemClassifier,
} from './classifier';

export {
  ThinkingTemplateManager,
  templateManager,
  defaultTemplates,
} from './templates';

export {
  ChainOfThoughtEngine,
  chainOfThoughtEngine,
} from './engine';

export {
  ThinkingSystemIntegration,
} from './integration';
