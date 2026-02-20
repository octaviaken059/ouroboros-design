/**
 * @file core/metacognition/metacognition-core.ts
 * @description 元认知核心 - 自我监控、不确定性管理和认知决策
 * @author Ouroboros
 * @date 2026-02-20
 * 
 * 核心能力：
 * 1. 维护能力边界认知 (capabilityBounds)
 * 2. 不确定性量化与监控
 * 3. 智能任务分发 (shouldOffload)
 * 4. 认知资源管理
 */

import type { BetaDistribution } from '@/core/bayesian/bayesian-core';
import {
  calculateConfidence,
  calculateUncertainty,
  getConfidenceResult,
  createUniformPrior,
} from '@/core/bayesian/bayesian-core';
import { createContextLogger } from '@/utils/logger';
import { randomUUID } from 'crypto';

const logger = createContextLogger('MetaCognition');

/** 能力边界类型 */
export type CapabilityType = 'tool' | 'skill' | 'domain' | 'reasoning';

/** 能力边界定义 */
export interface CapabilityBound {
  /** 能力ID */
  id: string;
  /** 能力名称 */
  name: string;
  /** 能力类型 */
  type: CapabilityType;
  /** 描述 */
  description: string;
  /** Beta分布参数 (成功/失败次数) */
  distribution: BetaDistribution;
  /** 最后一次使用 */
  lastUsed: string;
  /** 使用次数 */
  usageCount: number;
  /** 不确定性阈值 */
  uncertaintyThreshold: number;
  /** 最小置信度 */
  minConfidence: number;
}

/** 不确定性评估结果 */
export interface UncertaintyAssessment {
  /** 整体不确定性 (0-1) */
  overall: number;
  /** 各领域不确定性 */
  byDomain: Map<string, number>;
  /** 高风险能力 (不确定性超过阈值) */
  highRiskCapabilities: string[];
  /** 建议采取的行动 */
  recommendations: string[];
}

/** 任务分发决策 */
export interface OffloadDecision {
  /** 是否应该分发 */
  shouldOffload: boolean;
  /** 决策原因 */
  reason: string;
  /** 推荐工具/能力 (如果shouldOffload为true) */
  recommendedTool?: string;
  /** 置信度 */
  confidence: number;
  /** 不确定性 */
  uncertainty: number;
  /** 风险等级 */
  riskLevel: 'low' | 'medium' | 'high';
}

/** 认知状态快照 */
export interface CognitiveSnapshot {
  /** 时间戳 */
  timestamp: string;
  /** 能力边界状态 */
  capabilityBounds: Map<string, CapabilityBound>;
  /** 整体不确定性 */
  overallUncertainty: number;
  /** 认知负载 */
  cognitiveLoad: number;
  /** 最近反思 */
  recentReflections: string[];
}

/**
 * 元认知核心类
 * 
 * 实现自我监控、不确定性量化和智能决策
 */
export class MetaCognitionCore {
  /** 能力边界映射 */
  private capabilityBounds = new Map<string, CapabilityBound>();
  
  /** 历史认知快照 */
  private cognitiveSnapshots: CognitiveSnapshot[] = [];
  
  /** 最大快照数量 */
  private readonly maxSnapshots = 100;
  
  /** 默认不确定性阈值 */
  private readonly defaultUncertaintyThreshold = 0.15;
  
  /** 默认最小置信度 */
  private readonly defaultMinConfidence = 0.6;

  constructor() {
    logger.info('元认知核心初始化完成');
    this.initializeDefaultCapabilities();
  }

  /**
   * 初始化默认能力边界
   */
  private initializeDefaultCapabilities(): void {
    const defaultCapabilities: Omit<CapabilityBound, 'id'>[] = [
      {
        name: 'model_call',
        type: 'tool',
        description: '调用AI模型生成响应',
        distribution: createUniformPrior(),
        lastUsed: new Date().toISOString(),
        usageCount: 0,
        uncertaintyThreshold: this.defaultUncertaintyThreshold,
        minConfidence: this.defaultMinConfidence,
      },
      {
        name: 'memory_retrieval',
        type: 'tool',
        description: '从记忆系统检索信息',
        distribution: createUniformPrior(),
        lastUsed: new Date().toISOString(),
        usageCount: 0,
        uncertaintyThreshold: this.defaultUncertaintyThreshold,
        minConfidence: this.defaultMinConfidence,
      },
      {
        name: 'tool_execution',
        type: 'tool',
        description: '执行外部工具',
        distribution: createUniformPrior(),
        lastUsed: new Date().toISOString(),
        usageCount: 0,
        uncertaintyThreshold: 0.2, // 工具执行容忍更高不确定性
        minConfidence: 0.5,
      },
      {
        name: 'complex_reasoning',
        type: 'reasoning',
        description: '复杂多步推理',
        distribution: createUniformPrior(),
        lastUsed: new Date().toISOString(),
        usageCount: 0,
        uncertaintyThreshold: 0.1, // 推理需要低不确定性
        minConfidence: 0.7,
      },
      {
        name: 'code_generation',
        type: 'skill',
        description: '生成代码',
        distribution: createUniformPrior(),
        lastUsed: new Date().toISOString(),
        usageCount: 0,
        uncertaintyThreshold: 0.12,
        minConfidence: 0.65,
      },
    ];

    for (const cap of defaultCapabilities) {
      const id = randomUUID();
      this.capabilityBounds.set(id, { ...cap, id });
    }

    logger.info('默认能力边界已初始化', { count: defaultCapabilities.length });
  }

  /**
   * 注册新能力边界
   */
  registerCapability(capability: Omit<CapabilityBound, 'id'>): string {
    const id = randomUUID();
    const bound: CapabilityBound = {
      ...capability,
      id,
      distribution: capability.distribution || createUniformPrior(),
      lastUsed: new Date().toISOString(),
    };
    
    this.capabilityBounds.set(id, bound);
    logger.info('能力边界已注册', { name: bound.name, type: bound.type });
    
    return id;
  }

  /**
   * 更新能力边界 (基于执行结果)
   */
  updateCapabilityResult(capabilityId: string, success: boolean): void {
    const bound = this.capabilityBounds.get(capabilityId);
    if (!bound) {
      logger.warn('尝试更新不存在的能力边界', { capabilityId });
      return;
    }

    // 贝叶斯更新
    if (success) {
      bound.distribution.alpha += 1;
    } else {
      bound.distribution.beta += 1;
    }
    
    bound.usageCount++;
    bound.lastUsed = new Date().toISOString();
    
    const result = getConfidenceResult(bound.distribution);
    logger.debug('能力边界已更新', {
      name: bound.name,
      success,
      confidence: result.confidence,
      uncertainty: result.uncertainty,
    });
  }

  /**
   * 获取能力边界
   */
  getCapabilityBound(capabilityId: string): CapabilityBound | undefined {
    return this.capabilityBounds.get(capabilityId);
  }

  /**
   * 通过名称获取能力边界
   */
  getCapabilityByName(name: string): CapabilityBound | undefined {
    return Array.from(this.capabilityBounds.values()).find(
      (cap) => cap.name === name
    );
  }

  /**
   * 评估整体不确定性
   */
  assessUncertainty(): UncertaintyAssessment {
    const byDomain = new Map<string, number>();
    const highRiskCapabilities: string[] = [];
    const recommendations: string[] = [];
    
    let totalUncertainty = 0;
    let count = 0;

    for (const [, bound] of this.capabilityBounds) {
      const uncertainty = calculateUncertainty(bound.distribution);
      byDomain.set(bound.name, uncertainty);
      
      totalUncertainty += uncertainty;
      count++;

      // 检查是否超过阈值
      if (uncertainty > bound.uncertaintyThreshold) {
        highRiskCapabilities.push(bound.name);
        
        // 生成建议
        if (bound.usageCount < 5) {
          recommendations.push(`多练习 ${bound.name} 以积累经验`);
        } else {
          recommendations.push(`考虑使用外部工具辅助 ${bound.name}`);
        }
      }
    }

    const overall = count > 0 ? totalUncertainty / count : 0.25;

    return {
      overall,
      byDomain,
      highRiskCapabilities,
      recommendations,
    };
  }

  /**
   * 智能任务分发决策 - shouldOffload 核心逻辑
   * 
   * 当检测到不确定性高时，建议寻求外部增强
   */
  shouldOffload(
    taskType: string,
    taskComplexity: 'simple' | 'medium' | 'complex' = 'medium',
    context?: {
      deadline?: number; // 截止时间（毫秒）
      criticality?: 'low' | 'medium' | 'high'; // 任务重要性
    }
  ): OffloadDecision {
    // 查找对应能力
    const capability = this.getCapabilityByName(taskType);
    
    if (!capability) {
      // 未知任务类型，建议分发
      return {
        shouldOffload: true,
        reason: `未知任务类型: ${taskType}，建议寻求外部工具支持`,
        confidence: 0,
        uncertainty: 0.25,
        riskLevel: 'high',
      };
    }

    const confidence = calculateConfidence(capability.distribution);
    const uncertainty = calculateUncertainty(capability.distribution);
    
    // 计算有效样本数
    const result = getConfidenceResult(capability.distribution);
    
    // 决策因素
    const factors: string[] = [];
    let shouldOffload = false;
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // 1. 不确定性检查
    if (uncertainty > capability.uncertaintyThreshold) {
      factors.push(`不确定性过高 (${uncertainty.toFixed(3)} > ${capability.uncertaintyThreshold})`);
      shouldOffload = true;
      riskLevel = 'high';
    }

    // 2. 置信度检查
    if (confidence < capability.minConfidence) {
      factors.push(`置信度不足 (${confidence.toFixed(3)} < ${capability.minConfidence})`);
      shouldOffload = true;
      riskLevel = riskLevel === 'low' ? 'medium' : 'high';
    }

    // 3. 样本不足
    if (result.totalCount < 3) {
      factors.push(`经验不足 (${result.totalCount} 次使用)`);
      shouldOffload = true;
      riskLevel = 'medium';
    }

    // 4. 任务复杂度调整
    if (taskComplexity === 'complex' && confidence < 0.8) {
      factors.push('复杂任务需要更高置信度');
      shouldOffload = true;
      riskLevel = 'high';
    }

    // 5. 时间压力
    if (context?.deadline && context.deadline < 60000) {
      // 时间紧迫 (< 1分钟)
      if (uncertainty > 0.1) {
        factors.push('时间紧迫，不确定性可能延误任务');
        shouldOffload = true;
      }
    }

    // 6. 重要性调整
    if (context?.criticality === 'high' && uncertainty > 0.08) {
      factors.push('关键任务，不容失误');
      shouldOffload = true;
      riskLevel = 'high';
    }

    // 构建决策结果
    const decision: OffloadDecision = {
      shouldOffload,
      reason: factors.length > 0 
        ? factors.join('; ')
        : `能力 ${taskType} 状态良好 (置信度: ${confidence.toFixed(3)}, 不确定性: ${uncertainty.toFixed(3)})`,
      confidence,
      uncertainty,
      riskLevel,
    };

    if (shouldOffload) {
      decision.recommendedTool = this.recommendTool(taskType);
    }

    logger.debug('任务分发决策', {
      taskType,
      shouldOffload,
      confidence: confidence.toFixed(3),
      uncertainty: uncertainty.toFixed(3),
    });

    return decision;
  }

  /**
   * 推荐外部工具
   */
  private recommendTool(taskType: string): string {
    const toolMap: Record<string, string> = {
      'model_call': 'coding-agent',
      'code_generation': 'coding-agent',
      'complex_reasoning': 'canvas',
      'tool_execution': 'healthcheck',
      'memory_retrieval': 'notion',
    };

    return toolMap[taskType] || 'web_search';
  }

  /**
   * 获取所有能力边界
   */
  getAllCapabilityBounds(): Map<string, CapabilityBound> {
    return new Map(this.capabilityBounds);
  }

  /**
   * 获取能力统计
   */
  getCapabilityStats(): {
    total: number;
    byType: Record<CapabilityType, number>;
    averageConfidence: number;
    averageUncertainty: number;
    highRiskCount: number;
  } {
    const byType: Record<CapabilityType, number> = {
      tool: 0,
      skill: 0,
      domain: 0,
      reasoning: 0,
    };

    let totalConfidence = 0;
    let totalUncertainty = 0;
    let highRiskCount = 0;

    for (const bound of this.capabilityBounds.values()) {
      byType[bound.type]++;
      totalConfidence += calculateConfidence(bound.distribution);
      totalUncertainty += calculateUncertainty(bound.distribution);
      
      if (calculateUncertainty(bound.distribution) > bound.uncertaintyThreshold) {
        highRiskCount++;
      }
    }

    const count = this.capabilityBounds.size;

    return {
      total: count,
      byType,
      averageConfidence: count > 0 ? totalConfidence / count : 0,
      averageUncertainty: count > 0 ? totalUncertainty / count : 0.25,
      highRiskCount,
    };
  }

  /**
   * 保存认知快照
   */
  saveSnapshot(): CognitiveSnapshot {
    const snapshot: CognitiveSnapshot = {
      timestamp: new Date().toISOString(),
      capabilityBounds: new Map(this.capabilityBounds),
      overallUncertainty: this.assessUncertainty().overall,
      cognitiveLoad: this.estimateCognitiveLoad(),
      recentReflections: [], // 可由外部填充
    };

    this.cognitiveSnapshots.push(snapshot);

    // 限制快照数量
    if (this.cognitiveSnapshots.length > this.maxSnapshots) {
      this.cognitiveSnapshots.shift();
    }

    return snapshot;
  }

  /**
   * 估计认知负载
   */
  private estimateCognitiveLoad(): number {
    // 基于高不确定性能力数量和最近活动
    const highRiskCount = this.assessUncertainty().highRiskCapabilities.length;
    const baseLoad = highRiskCount / this.capabilityBounds.size;
    
    return Math.min(1, baseLoad * 2);
  }

  /**
   * 获取认知趋势
   */
  getCognitiveTrend(): {
    improving: boolean;
    trend: 'improving' | 'stable' | 'degrading';
    changeRate: number;
  } {
    if (this.cognitiveSnapshots.length < 2) {
      return { improving: false, trend: 'stable', changeRate: 0 };
    }

    const recent = this.cognitiveSnapshots.slice(-5);
    const older = this.cognitiveSnapshots.slice(-10, -5);

    const recentAvg = recent.reduce((sum, s) => sum + s.overallUncertainty, 0) / recent.length;
    const olderAvg = older.length > 0 
      ? older.reduce((sum, s) => sum + s.overallUncertainty, 0) / older.length
      : recentAvg;

    const changeRate = olderAvg > 0 ? (recentAvg - olderAvg) / olderAvg : 0;

    if (changeRate < -0.1) {
      return { improving: true, trend: 'improving', changeRate };
    } else if (changeRate > 0.1) {
      return { improving: false, trend: 'degrading', changeRate };
    } else {
      return { improving: false, trend: 'stable', changeRate };
    }
  }

  /**
   * 生成元认知报告
   */
  generateReport(): string {
    const stats = this.getCapabilityStats();
    const trend = this.getCognitiveTrend();
    const assessment = this.assessUncertainty();

    return `
## 元认知状态报告

### 整体认知状态
- **不确定性**: ${(assessment.overall * 100).toFixed(1)}%
- **趋势**: ${trend.trend === 'improving' ? '📈 改善中' : trend.trend === 'degrading' ? '📉 恶化中' : '➡️ 稳定'}
- **认知负载**: ${(this.estimateCognitiveLoad() * 100).toFixed(1)}%

### 能力边界统计
- **总能力数**: ${stats.total}
- **工具**: ${stats.byType.tool} | **技能**: ${stats.byType.skill} | **推理**: ${stats.byType.reasoning} | **领域**: ${stats.byType.domain}
- **平均置信度**: ${(stats.averageConfidence * 100).toFixed(1)}%
- **高风险能力**: ${stats.highRiskCount} 个

### 高风险能力
${assessment.highRiskCapabilities.map(c => `- ⚠️ ${c}`).join('\n') || '无'}

### 改进建议
${assessment.recommendations.map(r => `- 💡 ${r}`).join('\n') || '暂无建议'}
`;
  }
}

export default MetaCognitionCore;
