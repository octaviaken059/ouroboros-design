/**
 * @file core/metacognition/reasoning-monitor.ts
 * @description 推理监控器 - 跟踪和评估推理过程
 * @author Ouroboros
 * @date 2026-02-20
 * 
 * 核心能力：
 * 1. 跟踪多步推理链
 * 2. 评估每一步的置信度
 * 3. 识别潜在的推理错误
 * 4. 生成推理过程的可解释性报告
 */

import { createContextLogger } from '@/utils/logger';
import { randomUUID } from 'crypto';

const logger = createContextLogger('ReasoningMonitor');

/** 推理步骤 */
export interface ReasoningStep {
  /** 步骤ID */
  id: string;
  /** 步骤序号 */
  stepNumber: number;
  /** 步骤类型 */
  type: 'observation' | 'inference' | 'deduction' | 'induction' | 'analogy' | 'decision';
  /** 输入 */
  input: string;
  /** 输出 */
  output: string;
  /** 推理依据 */
  rationale: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 使用的知识/记忆 */
  referencedKnowledge: string[];
  /** 潜在问题 */
  potentialIssues?: string[];
  /** 时间戳 */
  timestamp: string;
}

/** 推理链 */
export interface ReasoningChain {
  /** 链ID */
  id: string;
  /** 任务ID */
  taskId: string;
  /** 任务描述 */
  taskDescription: string;
  /** 步骤列表 */
  steps: ReasoningStep[];
  /** 最终结论 */
  conclusion: string;
  /** 整体置信度 */
  overallConfidence: number;
  /** 开始时间 */
  startTime: string;
  /** 结束时间 */
  endTime?: string;
  /** 元数据 */
  metadata: {
    totalSteps: number;
    averageStepConfidence: number;
    hasUncertainty: boolean;
    hasContradiction: boolean;
  };
}

/** 推理错误类型 */
export type ReasoningErrorType = 
  | 'circular_reasoning'      // 循环推理
  | 'false_premise'           // 错误前提
  | 'hasty_generalization'    // 草率概括
  | 'false_analogy'           // 错误类比
  | 'ignoring_alternatives'   // 忽视替代方案
  | 'overconfidence'          // 过度自信
  | 'uncertainty_ignored'     // 忽视不确定性
  | 'knowledge_gap';          // 知识缺口

/** 推理缺陷 */
export interface ReasoningFlaw {
  /** 缺陷ID */
  id: string;
  /** 错误类型 */
  type: ReasoningErrorType;
  /** 涉及的步骤ID */
  stepIds: string[];
  /** 问题描述 */
  description: string;
  /** 严重程度 */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** 建议修复 */
  suggestedFix: string;
  /** 检测时间 */
  detectedAt: string;
}

/** 推理评估结果 */
export interface ReasoningAssessment {
  /** 推理链ID */
  chainId: string;
  /** 评估时间 */
  assessedAt: string;
  /** 发现的缺陷 */
  flaws: ReasoningFlaw[];
  /** 质量评分 (0-1) */
  qualityScore: number;
  /** 可靠性评级 */
  reliabilityRating: 'high' | 'medium' | 'low' | 'unreliable';
  /** 改进建议 */
  improvementSuggestions: string[];
  /** 不确定性分析 */
  uncertaintyAnalysis: {
    totalUncertainty: number;
    primarySources: string[];
    recommendations: string[];
  };
}

/**
 * 推理监控器
 * 
 * 实时监控和评估推理过程的质量
 */
export class ReasoningMonitor {
  /** 活跃的推理链 */
  private activeChains = new Map<string, ReasoningChain>();
  
  /** 历史推理链 */
  private chainHistory: ReasoningChain[] = [];
  
  /** 最大历史记录数 */
  private readonly maxHistorySize = 100;
  
  /** 缺陷模式库 */
  private flawPatterns: Array<{
    type: ReasoningErrorType;
    pattern: RegExp;
    description: string;
  }> = [
    {
      type: 'overconfidence',
      pattern: /毫无疑问|绝对|必然|肯定|100%/i,
      description: '检测到过度确定性的表述',
    },
    {
      type: 'hasty_generalization',
      pattern: /所有|总是|从不|每个人都知道/i,
      description: '可能进行了草率概括',
    },
    {
      type: 'false_analogy',
      pattern: /就像|类似于|打个比方说/i,
      description: '使用了类比推理，需要验证有效性',
    },
  ];

  constructor() {
    logger.info('推理监控器初始化完成');
  }

  /**
   * 开始新的推理链
   */
  startChain(taskDescription: string): string {
    const chainId = randomUUID();
    const chain: ReasoningChain = {
      id: chainId,
      taskId: randomUUID(),
      taskDescription,
      steps: [],
      conclusion: '',
      overallConfidence: 0,
      startTime: new Date().toISOString(),
      metadata: {
        totalSteps: 0,
        averageStepConfidence: 0,
        hasUncertainty: false,
        hasContradiction: false,
      },
    };

    this.activeChains.set(chainId, chain);
    logger.debug('推理链开始', { chainId, task: taskDescription });
    
    return chainId;
  }

  /**
   * 记录推理步骤
   */
  recordStep(
    chainId: string,
    stepData: Omit<ReasoningStep, 'id' | 'stepNumber' | 'timestamp' | 'potentialIssues'>
  ): ReasoningStep {
    const chain = this.activeChains.get(chainId);
    if (!chain) {
      throw new Error(`推理链不存在: ${chainId}`);
    }

    const stepNumber = chain.steps.length + 1;
    
    // 检测潜在问题
    const potentialIssues = this.detectPotentialIssues(stepData);
    
    const step: ReasoningStep = {
      id: randomUUID(),
      stepNumber,
      ...stepData,
      potentialIssues,
      timestamp: new Date().toISOString(),
    };

    chain.steps.push(step);
    chain.metadata.totalSteps = stepNumber;
    
    // 更新元数据
    if (step.confidence < 0.6) {
      chain.metadata.hasUncertainty = true;
    }
    
    logger.debug(`记录推理步骤 ${stepNumber}`, {
      chainId,
      type: step.type,
      confidence: step.confidence,
      issues: potentialIssues.length,
    });

    return step;
  }

  /**
   * 结束推理链
   */
  endChain(chainId: string, conclusion: string, overallConfidence: number): ReasoningChain {
    const chain = this.activeChains.get(chainId);
    if (!chain) {
      throw new Error(`推理链不存在: ${chainId}`);
    }

    chain.conclusion = conclusion;
    chain.overallConfidence = overallConfidence;
    chain.endTime = new Date().toISOString();
    
    // 计算平均置信度
    const confidences = chain.steps.map(s => s.confidence);
    chain.metadata.averageStepConfidence = 
      confidences.reduce((a, b) => a + b, 0) / confidences.length;

    // 保存到历史
    this.chainHistory.push({ ...chain });
    if (this.chainHistory.length > this.maxHistorySize) {
      this.chainHistory.shift();
    }

    // 清理活跃链
    this.activeChains.delete(chainId);

    logger.info('推理链结束', {
      chainId,
      steps: chain.metadata.totalSteps,
      overallConfidence,
      quality: this.calculateQualityScore(chain),
    });

    return chain;
  }

  /**
   * 检测潜在问题
   */
  private detectPotentialIssues(step: Omit<ReasoningStep, 'id' | 'stepNumber' | 'timestamp' | 'potentialIssues'>): string[] {
    const issues: string[] = [];

    // 置信度检查
    if (step.confidence < 0.5) {
      issues.push(`置信度较低 (${(step.confidence * 100).toFixed(0)}%)，建议验证`);
    }

    // 知识引用检查
    if (step.referencedKnowledge.length === 0 && step.type !== 'observation') {
      issues.push('缺乏知识引用，推理依据可能不足');
    }

    // 模式匹配检查
    for (const pattern of this.flawPatterns) {
      if (pattern.pattern.test(step.rationale)) {
        issues.push(`${pattern.description} [${pattern.type}]`);
      }
    }

    // 推理类型特定检查
    switch (step.type) {
      case 'deduction':
        if (!step.rationale.includes('因为') && !step.rationale.includes('由于')) {
          issues.push('演绎推理缺乏明确的因果说明');
        }
        break;
      case 'induction':
        if (step.confidence > 0.8) {
          issues.push('归纳推理置信度过高，可能存在过度泛化风险');
        }
        break;
      case 'analogy':
        issues.push('类比推理的有效性需要验证');
        break;
    }

    return issues;
  }

  /**
   * 评估推理链质量
   */
  assessReasoning(chainId: string): ReasoningAssessment {
    // 从历史中查找（已结束的链）
    const chain = this.chainHistory.find(c => c.id === chainId);
    if (!chain) {
      throw new Error(`推理链不存在或尚未结束: ${chainId}`);
    }

    const flaws: ReasoningFlaw[] = [];
    const improvementSuggestions: string[] = [];

    // 1. 检查置信度模式
    const lowConfidenceSteps = chain.steps.filter(s => s.confidence < 0.5);
    if (lowConfidenceSteps.length > 0) {
      flaws.push({
        id: randomUUID(),
        type: 'uncertainty_ignored',
        stepIds: lowConfidenceSteps.map(s => s.id),
        description: `${lowConfidenceSteps.length} 个步骤存在低置信度，但未被妥善处理`,
        severity: lowConfidenceSteps.length > chain.steps.length / 2 ? 'high' : 'medium',
        suggestedFix: '明确标记不确定性区域，建议使用外部验证',
        detectedAt: new Date().toISOString(),
      });
      
      improvementSuggestions.push('对低置信度步骤进行标记和说明');
    }

    // 2. 检查过度自信
    const overconfidentSteps = chain.steps.filter(s => 
      s.confidence > 0.9 && s.potentialIssues?.some(i => i.includes('过度确定性'))
    );
    if (overconfidentSteps.length > 0) {
      flaws.push({
        id: randomUUID(),
        type: 'overconfidence',
        stepIds: overconfidentSteps.map(s => s.id),
        description: '检测到过度自信的表述，可能与实际能力不符',
        severity: 'medium',
        suggestedFix: '使用更谨慎的措辞，明确能力边界',
        detectedAt: new Date().toISOString(),
      });
      
      improvementSuggestions.push('使用概率性语言而非绝对性表述');
    }

    // 3. 检查推理类型分布
    const inferenceTypes = new Map<string, number>();
    chain.steps.forEach(s => {
      inferenceTypes.set(s.type, (inferenceTypes.get(s.type) || 0) + 1);
    });
    
    if (inferenceTypes.get('analogy') || 0 > chain.steps.length * 0.3) {
      flaws.push({
        id: randomUUID(),
        type: 'false_analogy',
        stepIds: chain.steps.filter(s => s.type === 'analogy').map(s => s.id),
        description: '过度依赖类比推理，可能产生不恰当的比较',
        severity: 'medium',
        suggestedFix: '验证类比的适用性，考虑其他推理方式',
        detectedAt: new Date().toISOString(),
      });
      
      improvementSuggestions.push('减少类比推理的依赖，增加演绎和归纳');
    }

    // 4. 检查结论与步骤的一致性
    if (chain.overallConfidence > chain.metadata.averageStepConfidence + 0.2) {
      flaws.push({
        id: randomUUID(),
        type: 'overconfidence',
        stepIds: [],
        description: '最终结论置信度显著高于各步骤平均置信度',
        severity: 'high',
        suggestedFix: '重新评估结论，使其与各步骤置信度一致',
        detectedAt: new Date().toISOString(),
      });
      
      improvementSuggestions.push('确保结论置信度反映推理链的整体质量');
    }

    // 5. 知识缺口检查
    const stepsWithNoKnowledge = chain.steps.filter(
      s => s.referencedKnowledge.length === 0 && s.type !== 'observation'
    );
    if (stepsWithNoKnowledge.length > 0) {
      flaws.push({
        id: randomUUID(),
        type: 'knowledge_gap',
        stepIds: stepsWithNoKnowledge.map(s => s.id),
        description: '部分推理步骤缺乏知识支撑',
        severity: 'high',
        suggestedFix: '检索相关知识或承认知识局限',
        detectedAt: new Date().toISOString(),
      });
      
      improvementSuggestions.push('在推理前检索相关知识');
    }

    // 计算质量评分
    const qualityScore = this.calculateQualityScore(chain);
    
    // 确定可靠性评级
    let reliabilityRating: ReasoningAssessment['reliabilityRating'];
    if (qualityScore >= 0.8 && flaws.filter(f => f.severity === 'high' || f.severity === 'critical').length === 0) {
      reliabilityRating = 'high';
    } else if (qualityScore >= 0.6 && flaws.filter(f => f.severity === 'critical').length === 0) {
      reliabilityRating = 'medium';
    } else if (qualityScore >= 0.4) {
      reliabilityRating = 'low';
    } else {
      reliabilityRating = 'unreliable';
    }

    // 不确定性分析
    const uncertaintySources: string[] = [];
    if (chain.metadata.hasUncertainty) {
      uncertaintySources.push('部分推理步骤置信度较低');
    }
    if (chain.metadata.averageStepConfidence < 0.7) {
      uncertaintySources.push('整体推理置信度不高');
    }

    return {
      chainId,
      assessedAt: new Date().toISOString(),
      flaws,
      qualityScore,
      reliabilityRating,
      improvementSuggestions: [...new Set(improvementSuggestions)],
      uncertaintyAnalysis: {
        totalUncertainty: 1 - qualityScore,
        primarySources: uncertaintySources,
        recommendations: [
          '明确标记不确定性区域',
          '提供置信度量化指标',
          '建议验证方法',
        ],
      },
    };
  }

  /**
   * 计算质量评分
   */
  private calculateQualityScore(chain: ReasoningChain): number {
    if (chain.steps.length === 0) return 0;

    // 基础分数：平均置信度
    let score = chain.metadata.averageStepConfidence;

    // 调整因素
    
    // 步骤数量奖励（适当的深度）
    if (chain.steps.length >= 3 && chain.steps.length <= 10) {
      score += 0.05;
    }

    // 多样性奖励
    const uniqueTypes = new Set(chain.steps.map(s => s.type)).size;
    if (uniqueTypes >= 3) {
      score += 0.05;
    }

    // 知识引用奖励
    const avgKnowledgeRefs = chain.steps.reduce(
      (sum, s) => sum + s.referencedKnowledge.length, 0
    ) / chain.steps.length;
    if (avgKnowledgeRefs >= 2) {
      score += 0.05;
    }

    // 潜在问题惩罚
    const totalIssues = chain.steps.reduce(
      (sum, s) => sum + (s.potentialIssues?.length || 0), 0
    );
    score -= (totalIssues / chain.steps.length) * 0.1;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 获取推理统计
   */
  getStats(): {
    totalChains: number;
    averageStepsPerChain: number;
    averageQuality: number;
    commonFlawTypes: Array<{ type: ReasoningErrorType; count: number }>;
  } {
    if (this.chainHistory.length === 0) {
      return {
        totalChains: 0,
        averageStepsPerChain: 0,
        averageQuality: 0,
        commonFlawTypes: [],
      };
    }

    const totalSteps = this.chainHistory.reduce((sum, c) => sum + c.steps.length, 0);
    const averageQuality = this.chainHistory.reduce(
      (sum, c) => sum + this.calculateQualityScore(c), 0
    ) / this.chainHistory.length;

    // 统计常见缺陷类型
    const flawCounts = new Map<ReasoningErrorType, number>();
    for (const chain of this.chainHistory) {
      try {
        const assessment = this.assessReasoning(chain.id);
        for (const flaw of assessment.flaws) {
          flawCounts.set(flaw.type, (flawCounts.get(flaw.type) || 0) + 1);
        }
      } catch {
        // 忽略评估失败的链
      }
    }

    const commonFlawTypes = Array.from(flawCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    return {
      totalChains: this.chainHistory.length,
      averageStepsPerChain: totalSteps / this.chainHistory.length,
      averageQuality,
      commonFlawTypes,
    };
  }

  /**
   * 生成推理批评报告
   * 
   * 这是核心方法："我哪里想错了？"
   */
  generateCritique(chainId: string): {
    summary: string;
    flaws: ReasoningFlaw[];
    lessons: string[];
    improvements: string[];
  } {
    const assessment = this.assessReasoning(chainId);
    const chain = this.chainHistory.find(c => c.id === chainId);
    
    if (!chain) {
      throw new Error(`推理链不存在: ${chainId}`);
    }

    // 生成批评总结
    let summary: string;
    if (assessment.qualityScore >= 0.8) {
      summary = `这次推理质量良好 (${(assessment.qualityScore * 100).toFixed(0)}%)，但仍有改进空间。`;
    } else if (assessment.qualityScore >= 0.6) {
      summary = `这次推理质量中等 (${(assessment.qualityScore * 100).toFixed(0)}%)，存在${assessment.flaws.length}个需要关注的问题。`;
    } else {
      summary = `这次推理质量较低 (${(assessment.qualityScore * 100).toFixed(0)}%)，需要认真审视推理过程。`;
    }

    // 提取教训
    const lessons: string[] = [];
    for (const flaw of assessment.flaws) {
      switch (flaw.type) {
        case 'overconfidence':
          lessons.push('需要更加谨慎地评估自己的确定性水平');
          break;
        case 'uncertainty_ignored':
          lessons.push('应该明确标记和沟通不确定性区域');
          break;
        case 'knowledge_gap':
          lessons.push('在推理前应该充分检索相关知识');
          break;
        case 'false_analogy':
          lessons.push('使用类比时要验证其适用性');
          break;
        default:
          lessons.push(flaw.suggestedFix);
      }
    }

    // 去重
    const uniqueLessons = [...new Set(lessons)];

    return {
      summary,
      flaws: assessment.flaws,
      lessons: uniqueLessons,
      improvements: assessment.improvementSuggestions,
    };
  }
}

export default ReasoningMonitor;
