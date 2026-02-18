/**
 * @file core/self-description/world-model.ts
 * @description WorldModel 模块 - 世界模型
 * @author Ouroboros
 * @date 2026-02-18
 */

import { randomUUID } from 'crypto';
import type {
  WorldModel,
  Pattern,
  Risk,
  Opportunity,
  CapabilityAssessment,
} from '@/types/index';
import { createContextLogger } from '@utils/logger';
import { ConfigError, tryCatch } from '@utils/error';

const logger = createContextLogger('WorldModel');

/**
 * WorldModel 管理类
 * 管理模式、风险、机会和能力评估
 */
export class WorldModelManager {
  private worldModel: WorldModel;

  /**
   * 构造函数
   */
  constructor() {
    this.worldModel = {
      patterns: [],
      risks: [],
      opportunities: [],
      capabilities: {
        strengths: [],
        weaknesses: [],
        learning: [],
      },
    };

    logger.info('WorldModel 初始化完成');
  }

  /**
   * 添加模式
   * @param description 模式描述
   * @param confidence 置信度 (0-1)
   * @returns 模式 ID
   */
  addPattern(description: string, confidence: number): string {
    const add = tryCatch(
      () => {
        if (!description || typeof description !== 'string') {
          throw new Error('模式描述不能为空');
        }
        if (confidence < 0 || confidence > 1) {
          throw new Error('置信度必须在 0-1 之间');
        }

        const pattern: Pattern = {
          id: randomUUID(),
          description,
          confidence,
          observations: 1,
          createdAt: new Date().toISOString(),
        };

        this.worldModel.patterns.push(pattern);
        logger.info('模式已添加', { id: pattern.id, description, confidence });

        return pattern.id;
      },
      'WorldModel.addPattern',
      ConfigError
    );

    return add();
  }

  /**
   * 获取模式
   * @param minConfidence 最小置信度
   * @returns 符合条件的模式
   */
  getPatterns(minConfidence = 0): Pattern[] {
    return this.worldModel.patterns
      .filter((p) => p.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 更新模式置信度
   * @param id 模式 ID
   * @param delta 变化量
   */
  updatePatternConfidence(id: string, delta: number): void {
    const update = tryCatch(
      () => {
        const pattern = this.worldModel.patterns.find((p) => p.id === id);
        if (!pattern) {
          throw new Error(`模式 ${id} 不存在`);
        }

        pattern.confidence = Math.max(0, Math.min(1, pattern.confidence + delta));
        pattern.observations += delta > 0 ? 1 : 0;
        pattern.lastVerified = new Date().toISOString();

        logger.debug('模式置信度已更新', {
          id,
          newConfidence: pattern.confidence,
          observations: pattern.observations,
        });
      },
      'WorldModel.updatePatternConfidence',
      ConfigError
    );

    update();
  }

  /**
   * 添加风险
   * @param description 风险描述
   * @param severity 严重程度
   * @returns 风险 ID
   */
  addRisk(description: string, severity: Risk['severity']): string {
    const add = tryCatch(
      () => {
        if (!description) {
          throw new Error('风险描述不能为空');
        }

        const risk: Risk = {
          id: randomUUID(),
          description,
          severity,
          probability: 0.5,
          active: true,
          createdAt: new Date().toISOString(),
        };

        this.worldModel.risks.push(risk);
        logger.warn('风险已添加', { id: risk.id, description, severity });

        return risk.id;
      },
      'WorldModel.addRisk',
      ConfigError
    );

    return add();
  }

  /**
   * 解决风险
   * @param id 风险 ID
   */
  resolveRisk(id: string): void {
    const resolve = tryCatch(
      () => {
        const risk = this.worldModel.risks.find((r) => r.id === id);
        if (!risk) {
          throw new Error(`风险 ${id} 不存在`);
        }

        risk.active = false;
        risk.resolvedAt = new Date().toISOString();

        logger.info('风险已解决', { id, description: risk.description });
      },
      'WorldModel.resolveRisk',
      ConfigError
    );

    resolve();
  }

  /**
   * 获取活跃风险
   * @returns 活跃风险列表
   */
  getActiveRisks(): Risk[] {
    return this.worldModel.risks
      .filter((r) => r.active)
      .sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
  }

  /**
   * 添加机会
   * @param description 机会描述
   * @param potential 潜在价值 (0-1)
   * @returns 机会 ID
   */
  addOpportunity(description: string, potential: number): string {
    const add = tryCatch(
      () => {
        if (!description) {
          throw new Error('机会描述不能为空');
        }

        const opportunity: Opportunity = {
          id: randomUUID(),
          description,
          potential: Math.max(0, Math.min(1, potential)),
          feasibility: 0.5,
          active: true,
          createdAt: new Date().toISOString(),
        };

        this.worldModel.opportunities.push(opportunity);
        logger.info('机会已添加', { id: opportunity.id, description, potential });

        return opportunity.id;
      },
      'WorldModel.addOpportunity',
      ConfigError
    );

    return add();
  }

  /**
   * 获取活跃机会
   * @returns 活跃机会列表
   */
  getOpportunities(): Opportunity[] {
    return this.worldModel.opportunities
      .filter((o) => o.active)
      .sort((a, b) => b.potential - a.potential);
  }

  /**
   * 更新能力评估
   * @param assessment 能力评估
   */
  updateCapabilities(assessment: Partial<CapabilityAssessment>): void {
    if (assessment.strengths) {
      this.worldModel.capabilities.strengths = assessment.strengths;
    }
    if (assessment.weaknesses) {
      this.worldModel.capabilities.weaknesses = assessment.weaknesses;
    }
    if (assessment.learning) {
      this.worldModel.capabilities.learning = assessment.learning;
    }

    logger.debug('能力评估已更新', {
      strengths: this.worldModel.capabilities.strengths.length,
      weaknesses: this.worldModel.capabilities.weaknesses.length,
      learning: this.worldModel.capabilities.learning.length,
    });
  }

  /**
   * 生成世界模型描述
   * @returns 描述文本
   */
  generateWorldModelPrompt(): string {
    const patterns = this.getPatterns(0.5).slice(0, 5);
    const risks = this.getActiveRisks().slice(0, 5);
    const opportunities = this.getOpportunities().slice(0, 5);

    let prompt = '### World Model\n';

    if (patterns.length > 0) {
      prompt += '\n- Patterns:\n';
      for (const p of patterns) {
        prompt += `  - ${p.description} (${(p.confidence * 100).toFixed(0)}%)\n`;
      }
    }

    if (risks.length > 0) {
      prompt += '\n- Active Risks:\n';
      for (const r of risks) {
        prompt += `  - [${r.severity.toUpperCase()}] ${r.description}\n`;
      }
    }

    if (opportunities.length > 0) {
      prompt += '\n- Opportunities:\n';
      for (const o of opportunities) {
        prompt += `  - ${o.description} (${(o.potential * 100).toFixed(0)}%)\n`;
      }
    }

    return prompt.trim();
  }

  /**
   * 序列化为 JSON
   */
  toJSON(): Record<string, unknown> {
    return { ...this.worldModel };
  }

  /**
   * 从 JSON 恢复
   */
  static fromJSON(data: Record<string, unknown>): WorldModelManager {
    const manager = new WorldModelManager();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    manager.worldModel.patterns = (data.patterns as Pattern[]) ?? [];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    manager.worldModel.risks = (data.risks as Risk[]) ?? [];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    manager.worldModel.opportunities = (data.opportunities as Opportunity[]) ?? [];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    manager.worldModel.capabilities = (data.capabilities as CapabilityAssessment) ?? {
      strengths: [],
      weaknesses: [],
      learning: [],
    };
    return manager;
  }
}
