/**
 * Ouroboros - Bayesian Cognition System
 * 贝叶斯认知核心 - 能力置信度贝叶斯更新
 * 
 * 核心算法:
 * - Beta分布用于能力置信度建模
 * - 贝叶斯更新: P(H|E) = P(E|H) × P(H) / P(E)
 * - 不确定性量化与性能预测
 */

export interface BetaDistribution {
  alpha: number;      // 成功次数 (伪计数)
  beta: number;       // 失败次数 (伪计数)
}

export interface CapabilityBelief {
  capability: string;
  distribution: BetaDistribution;
  confidence: number;
  uncertainty: number;
  successCount: number;
  failCount: number;
  contextHistory: Array<{
    context: string;
    success: boolean;
    timestamp: number;
    result?: string;
  }>;
  lastUpdated: number;
}

export interface PerformancePrediction {
  capability: string;
  expectedSuccess: boolean;
  confidence: number;
  probability: number;
  recommendation: 'proceed' | 'caution' | 'avoid' | 'learn';
  reason: string;
}

export interface LearningRecommendation {
  capability: string;
  currentConfidence: number;
  targetConfidence: number;
  suggestedPracticeCount: number;
  estimatedTimeToMastery: number; // hours
  strategies: string[];
}

export interface BayesianUpdateContext {
  context?: string;
  result?: string;
  difficulty?: 'trivial' | 'easy' | 'medium' | 'hard' | 'extreme';
  timeTaken?: number; // ms
  resourcesUsed?: number;
}

export interface BayesianConfig {
  priorAlpha: number;
  priorBeta: number;
  confidenceThreshold: number;
  minSamplesForPrediction: number;
  maxContextHistory: number;
  learningRate: number;
}

const DEFAULT_CONFIG: BayesianConfig = {
  priorAlpha: 2,           // 弱先验 - 相信证据
  priorBeta: 2,
  confidenceThreshold: 0.7,
  minSamplesForPrediction: 5,
  maxContextHistory: 50,
  learningRate: 0.1,
};

/**
 * 贝叶斯认知核心
 * 使用Beta分布建模二项结果的能力置信度
 */
export class BayesianCognition {
  private beliefs: Map<string, CapabilityBelief> = new Map();
  private config: BayesianConfig;

  constructor(config: Partial<BayesianConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 初始化或获取能力信念
   */
  private getOrCreateBelief(capability: string): CapabilityBelief {
    if (!this.beliefs.has(capability)) {
      this.beliefs.set(capability, {
        capability,
        distribution: {
          alpha: this.config.priorAlpha,
          beta: this.config.priorBeta,
        },
        confidence: 0.5,
        uncertainty: this.calculateUncertainty({
          alpha: this.config.priorAlpha,
          beta: this.config.priorBeta,
        }),
        successCount: 0,
        failCount: 0,
        contextHistory: [],
        lastUpdated: Date.now(),
      });
    }
    return this.beliefs.get(capability)!;
  }

  /**
   * 贝叶斯更新 - 核心算法
   * P(H|E) ∝ P(E|H) × P(H)
   * Beta分布是二项似然的共轭先验
   */
  updateBelief(
    capability: string,
    success: boolean,
    context?: BayesianUpdateContext
  ): CapabilityBelief {
    const belief = this.getOrCreateBelief(capability);

    // 更新Beta分布参数
    if (success) {
      belief.distribution.alpha += 1;
      belief.successCount += 1;
    } else {
      belief.distribution.beta += 1;
      belief.failCount += 1;
    }

    // 重新计算置信度和不确定性
    belief.confidence = this.calculateConfidence(belief.distribution);
    belief.uncertainty = this.calculateUncertainty(belief.distribution);
    belief.lastUpdated = Date.now();

    // 记录上下文历史
    belief.contextHistory.unshift({
      context: context?.context || 'unspecified',
      success,
      timestamp: Date.now(),
      result: context?.result,
    });

    // 限制历史长度
    if (belief.contextHistory.length > this.config.maxContextHistory) {
      belief.contextHistory.pop();
    }

    return belief;
  }

  /**
   * 批量更新 - 处理多个观测
   */
  batchUpdate(
    capability: string,
    observations: Array<{ success: boolean; context?: BayesianUpdateContext }>
  ): CapabilityBelief {
    const belief = this.getOrCreateBelief(capability);
    
    let successDelta = 0;
    let failDelta = 0;

    for (const obs of observations) {
      if (obs.success) successDelta++;
      else failDelta++;
      
      belief.contextHistory.unshift({
        context: obs.context?.context || 'batch',
        success: obs.success,
        timestamp: Date.now(),
        result: obs.context?.result,
      });
    }

    belief.distribution.alpha += successDelta;
    belief.distribution.beta += failDelta;
    belief.successCount += successDelta;
    belief.failCount += failDelta;
    belief.confidence = this.calculateConfidence(belief.distribution);
    belief.uncertainty = this.calculateUncertainty(belief.distribution);
    belief.lastUpdated = Date.now();

    return belief;
  }

  /**
   * 性能预测
   */
  predictPerformance(capability: string, context?: string): PerformancePrediction {
    const belief = this.getOrCreateBelief(capability);
    const totalSamples = belief.successCount + belief.failCount;

    // Beta分布的期望值: E[X] = α / (α + β)
    const expectedProbability = belief.distribution.alpha / 
      (belief.distribution.alpha + belief.distribution.beta);

    // 置信区间计算 (95%)
    const ci = this.calculateConfidenceInterval(belief.distribution, 0.95);
    
    // 置信度 = 1 - 不确定性 (归一化到0-1)
    const confidence = 1 - belief.uncertainty;

    // 生成建议
    let recommendation: PerformancePrediction['recommendation'];
    let reason: string;

    if (totalSamples < this.config.minSamplesForPrediction) {
      recommendation = 'learn';
      reason = `Insufficient samples (${totalSamples} < ${this.config.minSamplesForPrediction}), more practice needed`;
    } else if (expectedProbability > 0.8 && confidence > 0.8) {
      recommendation = 'proceed';
      reason = `High success probability (${(expectedProbability * 100).toFixed(1)}%) with strong confidence`;
    } else if (expectedProbability > 0.6 && confidence > 0.6) {
      recommendation = 'caution';
      reason = `Moderate success rate (${(expectedProbability * 100).toFixed(1)}%), proceed with monitoring`;
    } else {
      recommendation = 'avoid';
      reason = `Low expected success rate (${(expectedProbability * 100).toFixed(1)}%), consider alternative approaches`;
    }

    // 上下文特异性分析
    if (context && belief.contextHistory.length > 0) {
      const contextSpecific = belief.contextHistory.filter(h => 
        h.context.toLowerCase().includes(context.toLowerCase())
      );
      if (contextSpecific.length >= 3) {
        const contextSuccess = contextSpecific.filter(h => h.success).length;
        const contextRate = contextSuccess / contextSpecific.length;
        if (Math.abs(contextRate - expectedProbability) > 0.2) {
          reason += ` (Note: Context-specific rate differs: ${(contextRate * 100).toFixed(1)}%)`;
        }
      }
    }

    return {
      capability,
      expectedSuccess: expectedProbability > 0.5,
      confidence,
      probability: expectedProbability,
      recommendation,
      reason,
    };
  }

  /**
   * 比较两种能力的置信度
   */
  compareCapabilities(capabilityA: string, capabilityB: string): {
    better: string;
    confidence: number;
    difference: number;
    explanation: string;
  } {
    const beliefA = this.getOrCreateBelief(capabilityA);
    const beliefB = this.getOrCreateBelief(capabilityB);

    const probA = beliefA.distribution.alpha / (beliefA.distribution.alpha + beliefA.distribution.beta);
    const probB = beliefB.distribution.alpha / (beliefB.distribution.alpha + beliefB.distribution.beta);

    const diff = Math.abs(probA - probB);
    const better = probA > probB ? capabilityA : capabilityB;
    const confidence = 1 - Math.sqrt(beliefA.uncertainty * beliefB.uncertainty);

    return {
      better,
      confidence,
      difference: diff,
      explanation: `${better} has ${(diff * 100).toFixed(1)}% higher success probability (${(Math.max(probA, probB) * 100).toFixed(1)}% vs ${(Math.min(probA, probB) * 100).toFixed(1)}%)`,
    };
  }

  /**
   * 获取学习建议
   */
  getLearningRecommendation(capability: string, targetConfidence = 0.9): LearningRecommendation {
    const belief = this.getOrCreateBelief(capability);
    const currentP = belief.distribution.alpha / (belief.distribution.alpha + belief.distribution.beta);
    const currentConfidence = belief.confidence;

    // 计算达到目标所需的额外成功次数
    // 假设失败率不变
    const currentFailures = belief.distribution.beta - this.config.priorBeta;
    const currentSuccesses = belief.distribution.alpha - this.config.priorAlpha;
    const failureRate = currentSuccesses + currentFailures > 0 
      ? currentFailures / (currentSuccesses + currentFailures) 
      : 0.5;

    let neededSuccesses = 0;
    let simulatedAlpha = belief.distribution.alpha;
    let simulatedBeta = belief.distribution.beta;

    while (simulatedAlpha / (simulatedAlpha + simulatedBeta) < targetConfidence && neededSuccesses < 1000) {
      simulatedAlpha += 1;
      if (Math.random() < failureRate) {
        simulatedBeta += 1;
      }
      neededSuccesses++;
    }

    // 生成策略建议
    const strategies: string[] = [];
    
    if (currentConfidence < 0.5) {
      strategies.push('Focus on fundamental understanding before advanced applications');
    }
    
    if (belief.uncertainty > 0.3) {
      strategies.push('Practice in varied contexts to reduce uncertainty');
    }
    
    if (belief.successCount < 10) {
      strategies.push('Increase practice frequency - aim for daily practice');
    }

    // 分析失败模式
    const recentFailures = belief.contextHistory
      .filter(h => !h.success)
      .slice(0, 5);
    
    if (recentFailures.length > 2) {
      const commonContexts = this.findCommonContext(recentFailures.map(f => f.context));
      if (commonContexts) {
        strategies.push(`Review techniques for: ${commonContexts}`);
      }
    }

    strategies.push('Seek feedback on each practice session');
    strategies.push('Reflect on successful attempts to reinforce patterns');

    return {
      capability,
      currentConfidence,
      targetConfidence,
      suggestedPracticeCount: neededSuccesses,
      estimatedTimeToMastery: neededSuccesses * 0.5, // Assume 30 min per practice
      strategies,
    };
  }

  /**
   * 获取能力置信度
   */
  getConfidence(capability: string): number {
    return this.getOrCreateBelief(capability).confidence;
  }

  /**
   * 获取不确定性
   */
  getUncertainty(capability: string): number {
    return this.getOrCreateBelief(capability).uncertainty;
  }

  /**
   * 获取信念详情
   */
  getBelief(capability: string): CapabilityBelief | undefined {
    return this.beliefs.get(capability);
  }

  /**
   * 获取所有能力
   */
  getAllCapabilities(): string[] {
    return Array.from(this.beliefs.keys());
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalCapabilities: number;
    averageConfidence: number;
    highConfidenceCount: number;
    totalObservations: number;
    mostPracticed: string | null;
    needsPractice: string[];
  } {
    let totalObs = 0;
    let totalConf = 0;
    let highConfCount = 0;
    let maxPractices = 0;
    let mostPracticed: string | null = null;
    const needsPractice: string[] = [];

    for (const [cap, belief] of this.beliefs.entries()) {
      const obs = belief.successCount + belief.failCount;
      totalObs += obs;
      totalConf += belief.confidence;
      
      if (belief.confidence >= this.config.confidenceThreshold) {
        highConfCount++;
      } else if (obs >= this.config.minSamplesForPrediction) {
        needsPractice.push(cap);
      }

      if (obs > maxPractices) {
        maxPractices = obs;
        mostPracticed = cap;
      }
    }

    return {
      totalCapabilities: this.beliefs.size,
      averageConfidence: this.beliefs.size > 0 ? totalConf / this.beliefs.size : 0,
      highConfidenceCount: highConfCount,
      totalObservations: totalObs,
      mostPracticed,
      needsPractice,
    };
  }

  /**
   * 导出所有信念
   */
  export(): Record<string, Omit<CapabilityBelief, 'contextHistory'>> {
    const exported: Record<string, Omit<CapabilityBelief, 'contextHistory'>> = {};
    for (const [cap, belief] of this.beliefs.entries()) {
      const { contextHistory, ...rest } = belief;
      exported[cap] = rest;
    }
    return exported;
  }

  /**
   * 导入信念
   */
  import(data: Record<string, Partial<CapabilityBelief>>): void {
    for (const [cap, beliefData] of Object.entries(data)) {
      const existing = this.getOrCreateBelief(cap);
      
      if (beliefData.distribution) {
        existing.distribution = beliefData.distribution;
      }
      if (beliefData.successCount !== undefined) {
        existing.successCount = beliefData.successCount;
      }
      if (beliefData.failCount !== undefined) {
        existing.failCount = beliefData.failCount;
      }
      
      existing.confidence = this.calculateConfidence(existing.distribution);
      existing.uncertainty = this.calculateUncertainty(existing.distribution);
    }
  }

  // ============ 私有方法 ============

  /**
   * 计算置信度: E[X] = α / (α + β)
   * Beta分布的期望值
   */
  private calculateConfidence(dist: BetaDistribution): number {
    return dist.alpha / (dist.alpha + dist.beta);
  }

  /**
   * 计算不确定性
   * Var[X] = αβ / ((α+β)²(α+β+1))
   */
  private calculateUncertainty(dist: BetaDistribution): number {
    const n = dist.alpha + dist.beta;
    return (dist.alpha * dist.beta) / (n * n * (n + 1));
  }

  /**
   * 计算置信区间
   */
  private calculateConfidenceInterval(
    dist: BetaDistribution,
    level: number
  ): { lower: number; upper: number } {
    // 使用正态近似
    const mean = dist.alpha / (dist.alpha + dist.beta);
    const variance = (dist.alpha * dist.beta) / 
      Math.pow(dist.alpha + dist.beta, 2) * (dist.alpha + dist.beta + 1);
    const std = Math.sqrt(variance);
    
    const z = level === 0.95 ? 1.96 : level === 0.99 ? 2.576 : 1.645;
    
    return {
      lower: Math.max(0, mean - z * std),
      upper: Math.min(1, mean + z * std),
    };
  }

  /**
   * 查找共同上下文模式
   */
  private findCommonContext(contexts: string[]): string | null {
    if (contexts.length === 0) return null;
    
    const words = contexts.flatMap(c => 
      c.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );
    
    const freq = new Map<string, number>();
    for (const word of words) {
      freq.set(word, (freq.get(word) || 0) + 1);
    }
    
    let maxFreq = 0;
    let commonWord: string | null = null;
    for (const [word, count] of freq.entries()) {
      if (count > maxFreq && count >= 2) {
        maxFreq = count;
        commonWord = word;
      }
    }
    
    return commonWord;
  }
}

export default BayesianCognition;
