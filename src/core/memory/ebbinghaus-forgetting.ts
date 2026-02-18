/**
 * @file core/memory/ebbinghaus-forgetting.ts
 * @description 艾宾浩斯遗忘曲线 - 情景记忆的时间衰减机制
 * @author Ouroboros
 * @date 2026-02-18
 */

/**
 * 艾宾浩斯遗忘曲线参数
 * 
 * 原始艾宾浩斯曲线:
 * - 20分钟后: 保留58%
 * - 1小时后: 保留44%
 * - 9小时后: 保留36%
 * - 1天后: 保留33%
 * - 2天后: 保留28%
 * - 6天后: 保留25%
 * - 31天后: 保留21%
 * 
 * 公式: R = e^(-t/S)
 * R: 记忆保留率
 * t: 时间间隔
 * S: 记忆强度(与复习次数相关)
 */

/**
 * 计算记忆保留率
 * @param hoursPassed 经过的小时数
 * @param reviewCount 复习次数
 * @returns 保留率 (0-1)
 */
export function calculateRetentionRate(
  hoursPassed: number,
  reviewCount: number
): number {
  // 基础遗忘率 (艾宾浩斯曲线)
  const baseForgettingRate = 0.56; // 1小时后的遗忘率
  
  // 记忆强度因子 (随复习次数增加)
  // 每次复习增加记忆强度，减缓遗忘
  const strengthMultiplier = 1 + reviewCount * 0.5;
  
  // 计算保留率: R = e^(-λt/S)
  // λ: 遗忘系数, S: 记忆强度
  const lambda = -Math.log(1 - baseForgettingRate);
  const retentionRate = Math.exp(-(lambda * hoursPassed) / strengthMultiplier);
  
  // 确保最小保留率 (重要记忆不会完全遗忘)
  return Math.max(0.01, retentionRate);
}

/**
 * 计算记忆显著性分数
 * @param importance 原始重要性 (0-1)
 * @param hoursPassed 经过的小时数
 * @param accessCount 访问次数
 * @param reviewCount 复习次数
 * @returns 显著性分数 (0-1)
 */
export function calculateSalience(
  importance: number,
  hoursPassed: number,
  accessCount: number,
  reviewCount: number
): number {
  // 1. 基础保留率
  const retentionRate = calculateRetentionRate(hoursPassed, reviewCount);
  
  // 2. 访问频率因子 (访问越多越显著)
  const accessBoost = Math.min(0.3, accessCount * 0.05);
  
  // 3. 重要性权重
  const importanceWeight = importance * 0.4;
  
  // 4. 时间因子 (近期记忆更显著，但有衰减)
  const timeFactor = Math.exp(-hoursPassed / 168) * 0.3; // 168小时 = 1周
  
  // 综合显著性分数
  const salience = 
    retentionRate * 0.3 +     // 记忆保留
    accessBoost +              // 访问频率
    importanceWeight +         // 重要性
    timeFactor;                // 时间因子
  
  return Math.min(1, salience);
}

/**
 * 判断是否应该遗忘
 * @param salience 显著性分数
 * @param threshold 遗忘阈值 (默认0.1)
 * @returns 是否应该遗忘
 */
export function shouldForget(salience: number, threshold = 0.1): boolean {
  return salience < threshold;
}

/**
 * 计算下次复习时间
 * @param reviewCount 已复习次数
 * @returns 建议的下次复习间隔 (小时)
 */
export function calculateNextReviewInterval(reviewCount: number): number {
  // 间隔重复算法 (Spaced Repetition)
  // 第1次: 1小时
  // 第2次: 1天
  // 第3次: 3天
  // 第4次: 7天
  // 第5次: 14天
  // 第6次+: 30天
  
  const intervals = [1, 24, 72, 168, 336, 720];
  
  if (reviewCount < intervals.length) {
    return intervals[reviewCount];
  }
  
  // 超过6次后，每增加一次增加约10%
  const baseInterval = intervals[intervals.length - 1];
  const additionalReviews = reviewCount - intervals.length + 1;
  return Math.floor(baseInterval * (1 + additionalReviews * 0.1));
}

/**
 * 记忆巩固检查
 * @param createdAt 创建时间
 * @param accessCount 访问次数
 * @param lastAccessedAt 最后访问时间
 * @returns 是否应该巩固为长期记忆
 */
export function shouldConsolidate(
  createdAt: string,
  accessCount: number,
  lastAccessedAt: string
): boolean {
  const now = new Date();
  const created = new Date(createdAt);
  const lastAccessed = new Date(lastAccessedAt);
  
  const hoursSinceCreation = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
  const hoursSinceLastAccess = (now.getTime() - lastAccessed.getTime()) / (1000 * 60 * 60);
  
  // 巩固条件:
  // 1. 创建超过24小时
  // 2. 被访问超过3次
  // 3. 最近24小时内被访问过
  
  return (
    hoursSinceCreation >= 24 &&
    accessCount >= 3 &&
    hoursSinceLastAccess <= 24
  );
}

/**
 * 遗忘曲线调试信息
 * @param hoursPassed 经过的小时数
 * @param reviewCount 复习次数
 * @returns 调试信息对象
 */
export function getForgettingCurveDebug(
  hoursPassed: number,
  reviewCount: number
): {
  retentionRate: number;
  forgottenRate: number;
  nextReviewIn: number;
} {
  const retentionRate = calculateRetentionRate(hoursPassed, reviewCount);
  const forgottenRate = 1 - retentionRate;
  const nextReviewIn = calculateNextReviewInterval(reviewCount);
  
  return {
    retentionRate: Math.round(retentionRate * 100) / 100,
    forgottenRate: Math.round(forgottenRate * 100) / 100,
    nextReviewIn,
  };
}

/**
 * 批量评估记忆显著性
 * @param memories 记忆列表
 * @returns 显著性评估结果
 */
export function evaluateMemoriesSalience(
  memories: Array<{
    id: string;
    importance: number;
    createdAt: string;
    lastAccessedAt: string;
    accessCount: number;
  }>
): Array<{
  id: string;
  salience: number;
  shouldForget: boolean;
  hoursPassed: number;
}> {
  const now = new Date();
  
  return memories.map((memory) => {
    const lastAccessed = new Date(memory.lastAccessedAt);
    const hoursPassed = (now.getTime() - lastAccessed.getTime()) / (1000 * 60 * 60);
    
    // 复习次数基于访问次数估算
    const reviewCount = Math.floor(memory.accessCount / 2);
    
    const salience = calculateSalience(
      memory.importance,
      hoursPassed,
      memory.accessCount,
      reviewCount
    );
    
    return {
      id: memory.id,
      salience: Math.round(salience * 100) / 100,
      shouldForget: shouldForget(salience),
      hoursPassed: Math.round(hoursPassed),
    };
  });
}

// 导出类便于使用
export class EbbinghausForgettingCurve {
  /**
   * 应用遗忘曲线到记忆
   * @param memory 记忆对象
   * @returns 更新后的显著性
   */
  static applyForgetting(memory: {
    importance: number;
    createdAt: string;
    lastAccessedAt: string;
    accessCount: number;
  }): number {
    const now = new Date();
    const lastAccessed = new Date(memory.lastAccessedAt);
    const hoursPassed = (now.getTime() - lastAccessed.getTime()) / (1000 * 60 * 60);
    const reviewCount = Math.floor(memory.accessCount / 2);
    
    return calculateSalience(
      memory.importance,
      hoursPassed,
      memory.accessCount,
      reviewCount
    );
  }
  
  /**
   * 检查是否应该巩固
   */
  static shouldConsolidate(memory: {
    createdAt: string;
    accessCount: number;
    lastAccessedAt: string;
  }): boolean {
    return shouldConsolidate(
      memory.createdAt,
      memory.accessCount,
      memory.lastAccessedAt
    );
  }
}
