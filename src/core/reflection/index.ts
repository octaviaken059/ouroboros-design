/**
 * @file core/reflection/index.ts
 * @description 反思系统模块入口
 * @author Ouroboros
 * @date 2026-02-18
 */

export { ReflectionTriggerEngine } from './trigger-engine';
export { ReflectionAnalyzer } from './analyzer';
export { ReflectionEngine } from './reflection-engine';

// 类型导出
export type {
  ReflectionTrigger,
  ReflectionTriggerType,
  ReflectionCondition,
  Insight,
  InsightType,
  SuggestedAction,
  ConfigChange,
  ApprovalMode,
  ReflectionResult,
  ReflectionConfig,
  ReflectionEngineState,
  PerformanceAnalysis,
  MemoryAnalysis,
} from '@/types/reflection';
