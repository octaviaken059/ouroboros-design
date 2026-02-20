/**
 * @file cognitive/index.ts
 * @description 认知层模块入口
 * @author Ouroboros
 * @date 2026-02-19
 */

// 思维链
export {
  ChainOfThoughtManager,
  createChainOfThought,
  type ReasoningStep,
  type ChainOfThought,
  type ReasoningStepType,
  type ChainOfThoughtOptions,
  type StepHandler,
} from './chain-of-thought';
