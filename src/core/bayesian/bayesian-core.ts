/**
 * @file core/bayesian/bayesian-core.ts
 * @description 贝叶斯认知核心 - 置信度的贝叶斯更新
 * @author Ouroboros
 * @date 2026-02-18
 */

import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger('BayesianCore');

/**
 * Beta分布参数
 * α (alpha): 成功次数
 * β (beta): 失败次数
 */
export interface BetaDistribution {
  alpha: number;
  beta: number;
}

/**
 * 置信度结果
 */
export interface ConfidenceResult {
  /** 置信度 (0-1) */
  confidence: number;
  /** 不确定性 (方差) */
  uncertainty: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failureCount: number;
  /** 总次数 */
  totalCount: number;
}

/**
 * 贝叶斯更新函数
 * 使用Beta分布作为二项分布的共轭先验
 * 
 * 先验: Beta(α₀, β₀)
 * 似然: Binomial(k successes in n trials)
 * 后验: Beta(α₀ + k, β₀ + n - k)
 * 
 * 均值 (置信度): E[p] = α / (α + β)
 * 方差 (不确定性): Var[p] = αβ / ((α+β)²(α+β+1))
 */

/**
 * 创建均匀先验 (无信息先验)
 * @returns Beta(1, 1) - 均匀分布
 */
export function createUniformPrior(): BetaDistribution {
  return { alpha: 1, beta: 1 };
}

/**
 * 基于历史创建先验
 * @param successCount 历史成功次数
 * @param failureCount 历史失败次数
 * @returns Beta分布
 */
export function createPriorFromHistory(
  successCount: number,
  failureCount: number
): BetaDistribution {
  // 使用平滑处理，避免极端值
  return {
    alpha: Math.max(1, successCount),
    beta: Math.max(1, failureCount),
  };
}

/**
 * 贝叶斯更新
 * @param prior 先验分布
 * @param success 是否成功
 * @returns 更新后的分布
 */
export function bayesianUpdate(
  prior: BetaDistribution,
  success: boolean
): BetaDistribution {
  if (success) {
    return {
      alpha: prior.alpha + 1,
      beta: prior.beta,
    };
  } else {
    return {
      alpha: prior.alpha,
      beta: prior.beta + 1,
    };
  }
}

/**
 * 批量贝叶斯更新
 * @param prior 先验分布
 * @param results 结果数组 (true=成功, false=失败)
 * @returns 更新后的分布
 */
export function batchBayesianUpdate(
  prior: BetaDistribution,
  results: boolean[]
): BetaDistribution {
  const successCount = results.filter((r) => r).length;
  const failureCount = results.length - successCount;

  return {
    alpha: prior.alpha + successCount,
    beta: prior.beta + failureCount,
  };
}

/**
 * 计算置信度 (Beta分布均值)
 * @param distribution Beta分布
 * @returns 置信度 (0-1)
 */
export function calculateConfidence(
  distribution: BetaDistribution
): number {
  const { alpha, beta } = distribution;
  return alpha / (alpha + beta);
}

/**
 * 计算不确定性 (Beta分布方差)
 * @param distribution Beta分布
 * @returns 不确定性 (0-0.25, 越大越不确定)
 */
export function calculateUncertainty(
  distribution: BetaDistribution
): number {
  const { alpha, beta } = distribution;
  return (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1));
}

/**
 * 计算置信区间
 * @param distribution Beta分布
 * @param confidenceLevel 置信水平 (默认0.95)
 * @returns [下限, 上限]
 */
export function calculateConfidenceInterval(
  distribution: BetaDistribution,
  confidenceLevel = 0.95
): [number, number] {
  // 使用正态近似计算置信区间
  const mean = calculateConfidence(distribution);
  const variance = calculateUncertainty(distribution);
  const stdDev = Math.sqrt(variance);
  
  // 95% 置信区间约 ±1.96 标准差
  const zScore = confidenceLevel === 0.95 ? 1.96 : 1.645;
  const margin = zScore * stdDev;
  
  return [
    Math.max(0, mean - margin),
    Math.min(1, mean + margin),
  ];
}

/**
 * 获取完整的置信度结果
 * @param distribution Beta分布
 * @returns 置信度结果
 */
export function getConfidenceResult(
  distribution: BetaDistribution
): ConfidenceResult {
  const confidence = calculateConfidence(distribution);
  const uncertainty = calculateUncertainty(distribution);
  
  // 计算有效成功/失败次数 (减去先验的1,1)
  const successCount = Math.max(0, distribution.alpha - 1);
  const failureCount = Math.max(0, distribution.beta - 1);
  
  return {
    confidence: Math.round(confidence * 1000) / 1000,
    uncertainty: Math.round(uncertainty * 1000) / 1000,
    successCount,
    failureCount,
    totalCount: successCount + failureCount,
  };
}

/**
 * 判断是否应该使用 (探索-利用平衡)
 * @param distribution Beta分布
 * @param threshold 最小置信度阈值
 * @param minSamples 最小样本数
 * @returns 是否应该使用
 */
export function shouldUse(
  distribution: BetaDistribution,
  threshold = 0.5,
  minSamples = 5
): boolean {
  const result = getConfidenceResult(distribution);
  
  // 样本不足时给予探索机会
  if (result.totalCount < minSamples) {
    return true;
  }
  
  return result.confidence >= threshold;
}

/**
 * 计算探索价值 (Upper Confidence Bound)
 * @param distribution Beta分布
 * @param explorationFactor 探索因子 (默认2)
 * @returns UCB值
 */
export function calculateUCB(
  distribution: BetaDistribution,
  explorationFactor = 2
): number {
  const mean = calculateConfidence(distribution);
  const variance = calculateUncertainty(distribution);
  
  // UCB = mean + explorationFactor * sqrt(variance)
  return mean + explorationFactor * Math.sqrt(variance);
}

/**
 * 比较两个分布的优劣
 * @param distA 分布A
 * @param distB 分布B
 * @returns 比较结果: 'A' | 'B' | 'uncertain'
 */
export function compareDistributions(
  distA: BetaDistribution,
  distB: BetaDistribution
): 'A' | 'B' | 'uncertain' {
  const confA = calculateConfidence(distA);
  const confB = calculateConfidence(distB);
  const uncA = calculateUncertainty(distA);
  const uncB = calculateUncertainty(distB);
  
  // 如果置信区间重叠较大，则不确定
  const overlapThreshold = 0.2;
  const diff = Math.abs(confA - confB);
  const avgUncertainty = (Math.sqrt(uncA) + Math.sqrt(uncB)) / 2;
  
  if (diff < overlapThreshold * avgUncertainty) {
    return 'uncertain';
  }
  
  return confA > confB ? 'A' : 'B';
}

/**
 * 序列化Beta分布
 * @param distribution Beta分布
 * @returns JSON对象
 */
export function serializeDistribution(
  distribution: BetaDistribution
): { alpha: number; beta: number } {
  return { ...distribution };
}

/**
 * 从JSON恢复Beta分布
 * @param data JSON数据
 * @returns Beta分布
 */
export function deserializeDistribution(
  data: { alpha: number; beta: number }
): BetaDistribution {
  return {
    alpha: Math.max(1, data.alpha),
    beta: Math.max(1, data.beta),
  };
}

// ============================================================================
// 贝叶斯核心类 - 用于工具置信度管理
// ============================================================================

/**
 * 贝叶斯核心类
 * 管理工具/技能的置信度
 */
export class BayesianCore {
  /** 工具置信度映射 */
  private toolConfidences: Map<string, BetaDistribution> = new Map();
  /** 学习历史 */
  private learningHistory: Array<{
    toolName: string;
    timestamp: string;
    confidence: number;
    success: boolean;
  }> = [];

  /**
   * 注册工具
   * @param toolName 工具名称
   * @param initialSuccess 初始成功次数
   * @param initialFailure 初始失败次数
   */
  registerTool(
    toolName: string,
    initialSuccess = 0,
    initialFailure = 0
  ): void {
    const prior = createPriorFromHistory(initialSuccess, initialFailure);
    this.toolConfidences.set(toolName, prior);
    logger.debug('工具已注册', { toolName, prior });
  }

  /**
   * 更新工具置信度
   * @param toolName 工具名称
   * @param success 是否成功
   */
  updateToolConfidence(toolName: string, success: boolean): void {
    const current = this.toolConfidences.get(toolName);
    if (!current) {
      // 自动注册
      this.registerTool(toolName);
      return this.updateToolConfidence(toolName, success);
    }

    const updated = bayesianUpdate(current, success);
    this.toolConfidences.set(toolName, updated);
    
    const result = getConfidenceResult(updated);
    
    // 记录学习历史
    this.learningHistory.push({
      toolName,
      timestamp: new Date().toISOString(),
      confidence: result.confidence,
      success,
    });
    
    // 限制历史记录数量
    if (this.learningHistory.length > 1000) {
      this.learningHistory = this.learningHistory.slice(-500);
    }
    
    logger.debug('工具置信度已更新', {
      toolName,
      success,
      confidence: result.confidence,
    });
  }

  /**
   * 获取学习历史
   * @returns 学习历史记录
   */
  getLearningHistory(): Array<{
    toolName: string;
    timestamp: string;
    confidence: number;
    success: boolean;
  }> {
    return [...this.learningHistory];
  }

  /**
   * 获取工具置信度
   * @param toolName 工具名称
   * @returns 置信度结果
   */
  getToolConfidence(toolName: string): ConfidenceResult | null {
    const distribution = this.toolConfidences.get(toolName);
    if (!distribution) {
      return null;
    }
    return getConfidenceResult(distribution);
  }

  /**
   * 判断是否应该使用工具
   * @param toolName 工具名称
   * @param threshold 置信度阈值
   * @returns 是否应该使用
   */
  shouldUseTool(toolName: string, threshold = 0.5): boolean {
    const distribution = this.toolConfidences.get(toolName);
    if (!distribution) {
      // 未注册的工具给予探索机会
      return true;
    }
    return shouldUse(distribution, threshold);
  }

  /**
   * 获取最佳工具
   * @param toolNames 工具名称列表
   * @returns 最佳工具名称
   */
  getBestTool(toolNames: string[]): string | null {
    if (toolNames.length === 0) return null;

    let bestTool = toolNames[0];
    let bestUCB = -1;

    for (const toolName of toolNames) {
      const distribution = this.toolConfidences.get(toolName);
      if (!distribution) {
        // 未注册的工具给予高UCB值以鼓励探索
        if (bestUCB < 0.8) {
          bestTool = toolName;
          bestUCB = 0.8;
        }
        continue;
      }

      const ucb = calculateUCB(distribution);
      if (ucb > bestUCB) {
        bestTool = toolName;
        bestUCB = ucb;
      }
    }

    return bestTool;
  }

  /**
   * 获取所有工具置信度
   * @returns 工具置信度映射
   */
  getAllToolConfidences(): Map<string, ConfidenceResult> {
    const result = new Map<string, ConfidenceResult>();
    for (const [toolName, distribution] of this.toolConfidences) {
      result.set(toolName, getConfidenceResult(distribution));
    }
    return result;
  }

  /**
   * 序列化
   * @returns 序列化数据
   */
  serialize(): Record<string, { alpha: number; beta: number }> {
    const result: Record<string, { alpha: number; beta: number }> = {};
    for (const [toolName, distribution] of this.toolConfidences) {
      result[toolName] = serializeDistribution(distribution);
    }
    return result;
  }

  /**
   * 从序列化数据恢复
   * @param data 序列化数据
   */
  deserialize(data: Record<string, { alpha: number; beta: number }>): void {
    this.toolConfidences.clear();
    for (const [toolName, distData] of Object.entries(data)) {
      this.toolConfidences.set(toolName, deserializeDistribution(distData));
    }
  }
}
