/**
 * @file capabilities/index.ts
 * @description 能力模块统一入口
 * @author Ouroboros
 * @date 2026-02-19
 */

// 意图识别
export * from './intent';

// 能力发现
export * from './discovery';

// 能力加载
export * from './loader';

// 模型引擎
export {
  PromptAssembler,
  TokenBudgetManager,
  ModelClient,
  type AssembledPrompt,
  type TokenBudget,
} from './model-engine';
