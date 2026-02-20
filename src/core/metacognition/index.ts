/**
 * @file core/metacognition/index.ts
 * @description 元认知模块入口
 * @author Ouroboros
 * @date 2026-02-20
 */

export {
  MetaCognitionCore,
  type CapabilityBound,
  type CapabilityType,
  type UncertaintyAssessment,
  type OffloadDecision,
  type CognitiveSnapshot,
} from './metacognition-core';

export {
  DynamicPromptAssembler,
  type PromptFragment,
  type DynamicIdentity,
  type PromptContext,
} from './dynamic-prompt-assembler';

export {
  ReasoningMonitor,
  type ReasoningStep,
  type ReasoningChain,
  type ReasoningFlaw,
  type ReasoningAssessment,
} from './reasoning-monitor';

export {
  StrategyEncoder,
  type Strategy,
  type StrategyType,
} from './strategy-encoder';

export {
  SelfReferentialMemory,
  type MemoryLayer,
  type MemoryEncodingDecision,
  type MemoryAssociation,
  type MemorySelfMetadata,
} from './self-referential-memory';

export {
  StrategyExecutor,
  type ExecutableStrategy,
  type StrategyContext,
  type StrategyResult,
  type StrategyFunction,
} from './strategy-executor';
