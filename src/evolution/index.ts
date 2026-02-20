/**
 * @file evolution/index.ts
 * @description 进化模块入口
 * @author Ouroboros
 * @date 2026-02-19
 */

// 技能学习
export {
  SkillExtractor,
  SkillPractice,
  SkillLearningOrchestrator,
  type ExecutionRecord,
  type SkillPattern,
  type SkillInstance,
  type PracticeResult,
  type LearningConfig,
  type LearningProgress,
} from './skill-learning';

// 导出已有进化功能
export * from './hormone';
// self-evolution模块暂不导出
