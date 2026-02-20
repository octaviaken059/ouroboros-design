/**
 * @file evolution/skill-learning/skill-learning-orchestrator.ts
 * @description 技能学习编排器 - 整合技能提取、练习和注册
 * @author Ouroboros
 * @date 2026-02-19
 */

import { EventEmitter } from 'events';
import { createContextLogger } from '@/utils/logger';
import { SkillExtractor, type ExecutionRecord, type SkillPattern } from './skill-extractor';
import { SkillPractice, type SkillInstance } from './skill-practice';
import type { CapabilityRegistry } from '@/capabilities/discovery/capability-registry';

const logger = createContextLogger('SkillLearningOrchestrator');

/** 学习配置 */
export interface LearningConfig {
  /** 启用自动提取 */
  autoExtract?: boolean;
  /** 启用自动练习 */
  autoPractice?: boolean;
  /** 最小提取记录数 */
  minRecordsForExtraction?: number;
  /** 目标置信度 */
  targetConfidence?: number;
  /** 最大练习迭代 */
  maxPracticeIterations?: number;
  /** 自动注册熟练技能 */
  autoRegisterMastered?: boolean;
}

/** 学习进度 */
export interface LearningProgress {
  /** 总执行记录数 */
  totalRecords: number;
  /** 已提取模式数 */
  extractedPatterns: number;
  /** 正在练习的技能数 */
  practicingSkills: number;
  /** 已掌握技能数 */
  masteredSkills: number;
  /** 总体进度 (0-1) */
  overallProgress: number;
}

/**
 * 技能学习编排器
 * 
 * 协调技能提取和练习的完整流程
 */
export class SkillLearningOrchestrator extends EventEmitter {
  private registry: CapabilityRegistry;
  private extractor: SkillExtractor;
  private practice: SkillPractice;
  private config: LearningConfig;
  
  /** 执行记录存储 */
  private executionHistory: ExecutionRecord[] = [];
  /** 学习中的技能 */
  private learningSkills = new Map<string, SkillInstance>();

  constructor(
    registry: CapabilityRegistry,
    config: LearningConfig = {}
  ) {
    super();
    
    this.registry = registry;
    this.extractor = new SkillExtractor();
    this.practice = new SkillPractice(registry);
    this.config = {
      autoExtract: true,
      autoPractice: true,
      minRecordsForExtraction: 5,
      targetConfidence: 0.8,
      maxPracticeIterations: 20,
      autoRegisterMastered: true,
      ...config,
    };
  }

  /**
   * 记录执行
   */
  recordExecution(record: ExecutionRecord): void {
    this.executionHistory.push(record);
    
    logger.debug(`Recorded execution: ${record.id} (total: ${this.executionHistory.length})`);

    // 检查是否触发自动提取
    if (this.config.autoExtract && 
        this.executionHistory.length >= this.config.minRecordsForExtraction!) {
      this.tryExtractSkills();
    }
  }

  /**
   * 尝试提取技能
   */
  async tryExtractSkills(): Promise<SkillPattern[]> {
    logger.info('Attempting to extract skills from execution history...');

    const patterns = this.extractor.extractSkills(this.executionHistory);

    if (patterns.length > 0) {
      logger.info(`Extracted ${patterns.length} skill patterns`);

      // 注册技能并开始练习
      for (const pattern of patterns) {
        await this.startLearning(pattern);
      }

      this.emit('skills-extracted', patterns);
    }

    return patterns;
  }

  /**
   * 开始学习新技能
   */
  async startLearning(pattern: SkillPattern): Promise<SkillInstance> {
    logger.info(`Starting learning for skill pattern: ${pattern.name}`);

    // 注册技能
    const skill = this.practice.registerSkill(pattern);
    this.learningSkills.set(skill.id, skill);

    this.emit('learning-started', skill);

    // 自动开始练习
    if (this.config.autoPractice) {
      this.runPracticeLoop(skill.id);
    }

    return skill;
  }

  /**
   * 运行练习循环
   */
  private async runPracticeLoop(skillId: string): Promise<void> {
    const skill = this.learningSkills.get(skillId);
    if (!skill) return;

    logger.info(`Starting practice loop for ${skillId}`);

    const result = await this.practice.practiceBatch(skillId, {
      maxIterations: this.config.maxPracticeIterations,
      targetConfidence: this.config.targetConfidence,
    });

    logger.info(`Practice complete for ${skillId}: ${result.finalConfidence.toFixed(2)} confidence after ${result.iterations} iterations`);

    // 检查是否达到掌握
    if (result.finalConfidence >= this.config.targetConfidence!) {
      await this.onSkillMastered(skillId);
    }

    this.emit('practice-complete', { skillId, result });
  }

  /**
   * 技能掌握处理
   */
  private async onSkillMastered(skillId: string): Promise<void> {
    const skill = this.learningSkills.get(skillId);
    if (!skill) return;

    logger.info(`Skill mastered: ${skillId}`);

    // 自动注册到能力注册表
    if (this.config.autoRegisterMastered) {
      this.registerAsCapability(skill);
    }

    this.emit('skill-mastered', skill);
  }

  /**
   * 注册为能力
   */
  private registerAsCapability(skill: SkillInstance): void {
    try {
      this.registry.register({
        name: `skill.${skill.pattern.name}`,
        displayName: skill.pattern.name,
        type: 'skill',
        description: skill.pattern.description,
        source: {
          type: 'internal',
          id: 'skill-learning',
          name: 'Skill Learning System',
        },
        tags: ['skill', 'learned', 'mastered'],
        category: 'learned',
        confidence: skill.confidence,
        available: true,
        metadata: {
          patternId: skill.pattern.id,
          practiceCount: skill.practiceCount,
          successRate: skill.successCount / Math.max(1, skill.practiceCount),
        },
      });

      logger.info(`Registered mastered skill as capability: ${skill.pattern.name}`);
    } catch (error) {
      logger.error(`Failed to register skill as capability:`, error);
    }
  }

  /**
   * 手动触发技能练习
   */
  async practiceSkill(skillId: string, iterations = 5): Promise<{
    success: boolean;
    finalConfidence: number;
  }> {
    const skill = this.learningSkills.get(skillId);
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    const result = await this.practice.practiceBatch(skillId, {
      maxIterations: iterations,
      targetConfidence: this.config.targetConfidence,
    });

    // 检查掌握
    if (result.finalConfidence >= this.config.targetConfidence! && 
        skill.status !== 'mastered') {
      await this.onSkillMastered(skillId);
    }

    return {
      success: result.finalConfidence >= this.config.targetConfidence!,
      finalConfidence: result.finalConfidence,
    };
  }

  /**
   * 获取学习进度
   */
  getProgress(): LearningProgress {
    const allSkills = this.practice.getAllSkills();
    const mastered = allSkills.filter(s => s.status === 'mastered');
    const practicing = allSkills.filter(s => s.status !== 'mastered');

    const totalPatterns = this.extractor.getPatterns().length;
    const totalRecords = this.executionHistory.length;

    // 计算总体进度
    const maxExpectedSkills = Math.max(5, Math.floor(totalRecords / 3));
    const overallProgress = Math.min(1, mastered.length / maxExpectedSkills);

    return {
      totalRecords,
      extractedPatterns: totalPatterns,
      practicingSkills: practicing.length,
      masteredSkills: mastered.length,
      overallProgress,
    };
  }

  /**
   * 获取详细报告
   */
  getDetailedReport(): {
    progress: LearningProgress;
    patterns: SkillPattern[];
    skills: ReturnType<SkillPractice['getAllSkills']>;
    recentExecutions: ExecutionRecord[];
  } {
    return {
      progress: this.getProgress(),
      patterns: this.extractor.getPatterns(),
      skills: this.practice.getAllSkills(),
      recentExecutions: this.executionHistory.slice(-10),
    };
  }

  /**
   * 清空所有数据
   */
  clear(): void {
    this.executionHistory = [];
    this.learningSkills.clear();
    this.extractor.clearPatterns();
    logger.info('Skill learning data cleared');
  }

  /**
   * 导出学习数据
   */
  export(): {
    executionHistory: ExecutionRecord[];
    patterns: SkillPattern[];
    skills: ReturnType<SkillPractice['getAllSkills']>;
  } {
    return {
      executionHistory: this.executionHistory,
      patterns: this.extractor.getPatterns(),
      skills: this.practice.getAllSkills(),
    };
  }

  /**
   * 导入学习数据
   */
  import(data: {
    executionHistory?: ExecutionRecord[];
    patterns?: SkillPattern[];
  }): void {
    if (data.executionHistory) {
      this.executionHistory = data.executionHistory;
    }
    
    logger.info(`Imported learning data: ${this.executionHistory.length} executions`);
  }
}
