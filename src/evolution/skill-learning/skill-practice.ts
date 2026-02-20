/**
 * @file evolution/skill-learning/skill-practice.ts
 * @description 技能练习器 - 练习新技能并提升置信度
 * @author Ouroboros
 * @date 2026-02-19
 */

import { createContextLogger } from '@/utils/logger';
import type { SkillPattern } from './skill-extractor';
import type { CapabilityRegistry } from '@/capabilities/discovery/capability-registry';

const logger = createContextLogger('SkillPractice');

/** 练习结果 */
export interface PracticeResult {
  /** 是否成功 */
  success: boolean;
  /** 执行时间 (毫秒) */
  duration: number;
  /** 输出结果 */
  output?: unknown;
  /** 错误信息 */
  error?: string | undefined;
  /** 置信度变化 */
  confidenceDelta: number;
}

/** 技能实例 */
export interface SkillInstance {
  /** 实例 ID */
  id: string;
  /** 技能模式 */
  pattern: SkillPattern;
  /** 当前置信度 */
  confidence: number;
  /** 练习次数 */
  practiceCount: number;
  /** 成功次数 */
  successCount: number;
  /** 平均执行时间 */
  averageDuration: number;
  /** 最后练习时间 */
  lastPracticedAt?: string;
  /** 状态 */
  status: 'novice' | 'practicing' | 'proficient' | 'mastered';
}

/** 练习选项 */
export interface PracticeOptions {
  /** 最大练习次数 */
  maxIterations?: number | undefined;
  /** 目标置信度 */
  targetConfidence?: number | undefined;
  /** 测试数据集 */
  testData?: Array<Record<string, unknown>> | undefined;
  /** 验证模式 */
  validationMode?: 'auto' | 'manual' | 'hybrid' | undefined;
}

/**
 * 技能练习器
 * 
 * 通过反复练习和验证来提升技能的置信度和稳定性
 */
export class SkillPractice {
  private registry: CapabilityRegistry;
  private skills = new Map<string, SkillInstance>();

  constructor(registry: CapabilityRegistry) {
    this.registry = registry;
  }

  /**
   * 注册新技能
   */
  registerSkill(pattern: SkillPattern): SkillInstance {
    const id = `skill_${pattern.name}_${Date.now()}`;
    
    const instance: SkillInstance = {
      id,
      pattern,
      confidence: pattern.confidence * 0.5, // 初始置信度打折扣
      practiceCount: 0,
      successCount: 0,
      averageDuration: 0,
      status: 'novice',
    };

    this.skills.set(id, instance);
    logger.info(`Registered new skill: ${id} (initial confidence: ${instance.confidence.toFixed(2)})`);
    
    return instance;
  }

  /**
   * 练习技能
   */
  async practice(
    skillId: string,
    input: Record<string, unknown>,
    _options: PracticeOptions = {}
  ): Promise<PracticeResult> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    const startTime = Date.now();
    
    logger.debug(`Practicing skill ${skillId}...`);

    try {
      // 执行技能
      const result = await this.executeSkill(skill, input);
      
      const duration = Date.now() - startTime;
      
      // 更新技能统计
      this.updateSkillStats(skill, result.success, duration);
      
      // 计算置信度变化
      const confidenceDelta = this.calculateConfidenceDelta(skill, result.success);
      skill.confidence = Math.max(0, Math.min(1, skill.confidence + confidenceDelta));
      
      // 更新状态
      this.updateSkillStatus(skill);

      logger.info(`Skill practice: ${skillId} - ${result.success ? 'success' : 'failed'} (confidence: ${skill.confidence.toFixed(2)})`);

      return {
        success: result.success,
        duration,
        output: result.output,
        error: result.error,
        confidenceDelta,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // 失败降低置信度
      const confidenceDelta = -0.1;
      skill.confidence = Math.max(0, skill.confidence + confidenceDelta);
      this.updateSkillStats(skill, false, duration);
      
      return {
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error),
        confidenceDelta,
      };
    }
  }

  /**
   * 批量练习
   */
  async practiceBatch(
    skillId: string,
    options: PracticeOptions = {}
  ): Promise<{
    iterations: number;
    successes: number;
    finalConfidence: number;
    averageDuration: number;
  }> {
    const testData = options.testData || this.generateTestData(skillId);
    const maxIterations = options.maxIterations || 10;
    const targetConfidence = options.targetConfidence || 0.8;

    logger.info(`Starting batch practice for ${skillId}: max ${maxIterations} iterations`);

    let successes = 0;
    
    for (let i = 0; i < Math.min(maxIterations, testData.length); i++) {
      const result = await this.practice(skillId, testData[i], options);
      
      if (result.success) {
        successes++;
      }

      const skill = this.skills.get(skillId)!;
      
      // 检查是否达到目标
      if (skill.confidence >= targetConfidence && skill.practiceCount >= 5) {
        logger.info(`Target confidence reached after ${i + 1} iterations`);
        break;
      }
    }

    const skill = this.skills.get(skillId)!;
    
    return {
      iterations: skill.practiceCount,
      successes,
      finalConfidence: skill.confidence,
      averageDuration: skill.averageDuration,
    };
  }

  /**
   * 执行技能
   */
  private async executeSkill(
    skill: SkillInstance,
    input: Record<string, unknown>
  ): Promise<{ success: boolean; output?: unknown; error?: string }> {
    // 这里实现技能的具体执行逻辑
    // 根据技能模式中的工具序列执行
    
    try {
      const outputs: unknown[] = [];
      
      for (const step of skill.pattern.toolSequence) {
        // 获取工具
        const tool = this.registry.getByName(step.tool);
        if (!tool) {
          return { success: false, error: `Tool not found: ${step.tool}` };
        }

        // 准备参数
        const args = this.prepareArgs(step, input, outputs);
        
        // 执行工具 (简化版，实际需要调用工具执行器)
        logger.debug(`Executing tool: ${step.tool}`);
        
        // 模拟执行成功
        outputs.push({ tool: step.tool, args, status: 'executed' });
      }

      return { success: true, output: outputs };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 准备工具参数
   */
  private prepareArgs(
    step: { tool: string; requiredArgs: string[]; optionalArgs: string[] },
    input: Record<string, unknown>,
    _previousOutputs: unknown[]
  ): Record<string, unknown> {
    const args: Record<string, unknown> = {};

    // 映射输入参数
    for (const argName of step.requiredArgs) {
      if (input[argName] !== undefined) {
        args[argName] = input[argName];
      } else if (step.optionalArgs.includes(argName)) {
        // 可选参数，跳过
      }
    }

    return args;
  }

  /**
   * 更新技能统计
   */
  private updateSkillStats(
    skill: SkillInstance,
    success: boolean,
    duration: number
  ): void {
    skill.practiceCount++;
    skill.lastPracticedAt = new Date().toISOString();
    
    if (success) {
      skill.successCount++;
    }

    // 更新平均执行时间
    skill.averageDuration = 
      (skill.averageDuration * (skill.practiceCount - 1) + duration) /
      skill.practiceCount;
  }

  /**
   * 计算置信度变化
   */
  private calculateConfidenceDelta(skill: SkillInstance, success: boolean): number {
    // 成功的奖励随着练习次数增加而递减
    const successBonus = success ? 0.05 / Math.sqrt(skill.practiceCount + 1) : 0;
    
    // 失败的惩罚
    const failurePenalty = success ? 0 : -0.1;
    
    return successBonus + failurePenalty;
  }

  /**
   * 更新技能状态
   */
  private updateSkillStatus(skill: SkillInstance): void {
    const successRate = skill.successCount / Math.max(1, skill.practiceCount);
    
    if (skill.practiceCount < 5) {
      skill.status = 'novice';
    } else if (skill.confidence < 0.6 || successRate < 0.7) {
      skill.status = 'practicing';
    } else if (skill.confidence < 0.9 || skill.practiceCount < 20) {
      skill.status = 'proficient';
    } else {
      skill.status = 'mastered';
    }
  }

  /**
   * 生成测试数据
   */
  private generateTestData(_skillId: string): Array<Record<string, unknown>> {
    // 简化的测试数据生成
    // 实际应该根据技能模式生成有意义的测试用例
    return [
      { test: 'case1' },
      { test: 'case2' },
      { test: 'case3' },
    ];
  }

  /**
   * 获取技能实例
   */
  getSkill(skillId: string): SkillInstance | undefined {
    return this.skills.get(skillId);
  }

  /**
   * 获取所有技能
   */
  getAllSkills(): SkillInstance[] {
    return Array.from(this.skills.values());
  }

  /**
   * 获取指定状态的技能
   */
  getSkillsByStatus(status: SkillInstance['status']): SkillInstance[] {
    return this.getAllSkills().filter(s => s.status === status);
  }

  /**
   * 获取技能统计
   */
  getStats(): {
    total: number;
    byStatus: Record<SkillInstance['status'], number>;
    averageConfidence: number;
  } {
    const all = this.getAllSkills();
    const byStatus: Record<SkillInstance['status'], number> = {
      novice: 0,
      practicing: 0,
      proficient: 0,
      mastered: 0,
    };

    for (const skill of all) {
      byStatus[skill.status]++;
    }

    return {
      total: all.length,
      byStatus,
      averageConfidence: all.length > 0
        ? all.reduce((sum, s) => sum + s.confidence, 0) / all.length
        : 0,
    };
  }
}
