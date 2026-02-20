/**
 * @file evolution/skill-learning/index.ts
 * @description 技能学习模块入口
 * @author Ouroboros
 * @date 2026-02-19
 */

export {
  SkillExtractor,
  type ExecutionRecord,
  type SkillPattern,
  type SkillExtractionOptions,
} from './skill-extractor';

export {
  SkillPractice,
  type PracticeResult,
  type SkillInstance,
  type PracticeOptions,
} from './skill-practice';

export {
  SkillLearningOrchestrator,
  type LearningConfig,
  type LearningProgress,
} from './skill-learning-orchestrator';
