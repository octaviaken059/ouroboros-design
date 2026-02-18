/**
 * @file evolution/hormone/index.ts
 * @description 激素系统模块导出
 * @author Ouroboros
 * @date 2026-02-18
 */

export * from '@/types/hormone';
export { HormoneEngine } from './hormone-engine';
export { TriggerEngine, type TriggerResult, type TriggerContext } from './trigger-engine';
export { EmotionalStateGenerator } from './emotional-state-generator';
export { HormoneSystem } from './hormone-system';
