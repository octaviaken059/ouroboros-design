/**
 * Ouroboros - Embodied Forgetting System
 * 具身遗忘算法 - 模拟生物记忆的遗忘与巩固
 * 
 * 核心算法:
 * - 保留分数: R = I × E × U × (1 - T) × C
 * - 艾宾浩斯遗忘曲线
 * - 睡眠巩固
 * - 新陈代谢式记忆管理
 */

import { MemoryEntry } from './memory.js';

export interface RetentionParams {
  importance: number;        // I: 重要性权重 (0.5-1.0)
  emotionalWeight: number;   // E: 情感因子 (0.7-1.0)
  usageFactor: number;       // U: 使用频率因子
  timeDecay: number;         // T: 时间衰减 (0-1)
  consolidationBonus: number; // C: 巩固加成
}

export interface ForgettingCurve {
  initialRetention: number;
  intervals: number[];       // 复习间隔 (分钟)
  retentionRates: number[];  // 对应保留率
}

export interface ConsolidationResult {
  memoriesConsolidated: number;
  totalRetentionBoost: number;
  insightsExtracted: string[];
  memoryPatterns: Array<{
    pattern: string;
    frequency: number;
    confidence: number;
  }>;
}

export interface PruningResult {
  removed: number;
  archived: number;
  retained: number;
  removedIds: string[];
  avgRetentionScore: number;
}

export interface ForgettingConfig {
  // 艾宾浩斯参数
  ebbinghausBaseDecay: number;      // 基础衰减率
  ebbinghausSpacingFactor: number;  // 间隔因子
  
  // 保留阈值
  minRetentionScore: number;        // 最小保留分数
  pruneThreshold: number;           // 剪枝阈值
  
  // 巩固参数
  consolidationThreshold: number;   // 巩固阈值
  sleepBoostFactor: number;         // 睡眠增强因子
  
  // 系统限制
  maxMemoryAge: number;             // 最大记忆年龄 (ms)
  targetMemoryCount: number;        // 目标记忆数量
}

const DEFAULT_CONFIG: ForgettingConfig = {
  ebbinghausBaseDecay: 0.15,      // 20分钟后保留约58%
  ebbinghausSpacingFactor: 1.5,   // 每次复习间隔增加1.5倍
  minRetentionScore: 0.05,
  pruneThreshold: 0.1,
  consolidationThreshold: 0.7,
  sleepBoostFactor: 1.3,
  maxMemoryAge: 365 * 24 * 60 * 60 * 1000, // 1年
  targetMemoryCount: 5000,
};

/**
 * 艾宾浩斯遗忘曲线实现
 * 基于: R = e^(-t/S) 其中 S 是记忆强度
 */
export class EbbinghausCurve {
  private baseDecay: number;
  private spacingFactor: number;

  constructor(baseDecay = 0.15, spacingFactor = 1.5) {
    this.baseDecay = baseDecay;
    this.spacingFactor = spacingFactor;
  }

  /**
   * 计算特定时间点的保留率
   * @param timeMinutes 经过的分钟数
   * @param repetitions 重复次数
   * @param memoryStrength 记忆强度 (1.0 = 正常)
   */
  calculateRetention(timeMinutes: number, repetitions = 0, memoryStrength = 1.0): number {
    // 增强记忆强度基于重复次数
    const strengthened = memoryStrength * Math.pow(this.spacingFactor, repetitions);
    
    // 艾宾浩斯遗忘公式
    const retention = Math.exp(-this.baseDecay * timeMinutes / strengthened);
    
    return Math.max(0, Math.min(1, retention));
  }

  /**
   * 计算最佳复习间隔
   */
  calculateOptimalIntervals(): number[] {
    // 标准艾宾浩斯间隔 (分钟): 20, 1天, 2天, 6天, 31天...
    const intervals: number[] = [];
    let current = 20; // 初始20分钟
    
    for (let i = 0; i < 10; i++) {
      intervals.push(current);
      current = current * this.spacingFactor;
    }
    
    return intervals;
  }

  /**
   * 计算下次复习时间
   */
  calculateNextReview(
    createdAt: number,
    reviewCount: number,
    lastReviewAt?: number
  ): number {
    const intervals = this.calculateOptimalIntervals();
    const intervalIndex = Math.min(reviewCount, intervals.length - 1);
    const nextIntervalMs = intervals[intervalIndex] * 60 * 1000;
    
    const baseTime = lastReviewAt || createdAt;
    return baseTime + nextIntervalMs;
  }

  /**
   * 生成完整的遗忘曲线数据
   */
  generateCurve(initialRetention = 1.0, durationHours = 168): ForgettingCurve {
    const intervals: number[] = [];
    const retentionRates: number[] = [];
    
    for (let hour = 0; hour <= durationHours; hour += 0.5) {
      intervals.push(hour * 60); // 转换为分钟
      retentionRates.push(this.calculateRetention(hour * 60) * initialRetention);
    }

    return {
      initialRetention,
      intervals,
      retentionRates,
    };
  }
}

/**
 * 具身遗忘系统
 * 模拟生物记忆的新城代谢
 */
export class EmbodiedForgetting {
  private config: ForgettingConfig;
  private ebbinghaus: EbbinghausCurve;
  private archivedMemories: MemoryEntry[] = [];
  private consolidationLog: ConsolidationResult[] = [];

  constructor(config: Partial<ForgettingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ebbinghaus = new EbbinghausCurve(
      this.config.ebbinghausBaseDecay,
      this.config.ebbinghausSpacingFactor
    );
  }

  /**
   * 计算保留分数
   * R = I × E × U × (1 - T) × C
   * 
   * I: 重要性权重 (0.5-1.0)
   * E: 情感因子 (0.7-1.0)
   * U: 使用频率因子
   * T: 时间衰减
   * C: 巩固加成
   */
  calculateRetentionScore(entry: MemoryEntry): number {
    const now = Date.now();
    const ageMs = now - entry.timestamp;
    
    // 计算参数
    const importance = Math.max(0.5, Math.min(1.0, entry.importance));
    const emotional = Math.max(0.7, Math.min(1.0, entry.emotionalWeight));
    const usage = this.calculateUsageFactor(entry);
    const timeDecay = this.calculateTimeDecay(ageMs, entry.accessCount);
    const consolidation = this.calculateConsolidationBonus(entry);

    // 应用公式
    const rawScore = importance * emotional * usage * (1 - timeDecay) * consolidation;
    
    return Math.max(0, Math.min(1, rawScore));
  }

  /**
   * 计算使用频率因子
   */
  private calculateUsageFactor(entry: MemoryEntry): number {
    // 使用次数的对数增长，避免无限制增加
    return 1 + Math.log(1 + entry.accessCount) * 0.1;
  }

  /**
   * 计算时间衰减
   */
  private calculateTimeDecay(ageMs: number, accessCount: number): number {
    const ageMinutes = ageMs / (1000 * 60);
    
    // 基础艾宾浩斯衰减
    let decay = 1 - this.ebbinghaus.calculateRetention(ageMinutes, accessCount);
    
    // 访问次数延缓衰减
    const accessBonus = Math.min(accessCount * 0.05, 0.5);
    decay *= (1 - accessBonus);
    
    return Math.max(0, Math.min(1, decay));
  }

  /**
   * 计算巩固加成
   */
  private calculateConsolidationBonus(entry: MemoryEntry): number {
    // 检查是否经过睡眠/长期未访问后的巩固
    const consolidated = entry.importance > this.config.consolidationThreshold || 
                        entry.accessCount > 5;
    
    return consolidated ? this.config.sleepBoostFactor : 1.0;
  }

  /**
   * 执行记忆剪枝
   * 移除低保留分数的记忆
   */
  prune(memories: MemoryEntry[]): PruningResult {
    const now = Date.now();
    const removedIds: string[] = [];
    const toRemove: number[] = [];
    const toArchive: MemoryEntry[] = [];

    for (let i = 0; i < memories.length; i++) {
      const entry = memories[i];
      const score = this.calculateRetentionScore(entry);
      const age = now - entry.timestamp;

      // 检查是否需要移除
      if (score < this.config.minRetentionScore || age > this.config.maxMemoryAge) {
        toRemove.push(i);
        removedIds.push(entry.id);
        
        // 如果是重要记忆，归档而非删除
        if (entry.importance > 0.7) {
          toArchive.push(entry);
        }
      }
    }

    // 如果记忆数量超过目标，额外移除最低分的
    let targetCount = this.config.targetMemoryCount;
    
    while (memories.length - toRemove.length > targetCount) {
      let lowestScore = Infinity;
      let lowestIndex = -1;

      for (let i = 0; i < memories.length; i++) {
        if (!toRemove.includes(i)) {
          const score = this.calculateRetentionScore(memories[i]);
          if (score < lowestScore) {
            lowestScore = score;
            lowestIndex = i;
          }
        }
      }

      if (lowestIndex >= 0 && lowestScore < this.config.pruneThreshold) {
        toRemove.push(lowestIndex);
        removedIds.push(memories[lowestIndex].id);
      } else {
        break;
      }
    }

    // 归档重要记忆
    this.archivedMemories.push(...toArchive);

    // 计算平均保留分数
    const remaining = memories.filter((_, i) => !toRemove.includes(i));
    const avgScore = remaining.length > 0
      ? remaining.reduce((sum, m) => sum + this.calculateRetentionScore(m), 0) / remaining.length
      : 0;

    return {
      removed: toRemove.length,
      archived: toArchive.length,
      retained: remaining.length,
      removedIds,
      avgRetentionScore: avgScore,
    };
  }

  /**
   * 执行睡眠巩固
   * 模拟睡眠期间的记忆巩固过程
   */
  performSleepConsolidation(memories: MemoryEntry[]): ConsolidationResult {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    let consolidated = 0;
    let totalBoost = 0;
    const insights: string[] = [];
    const patterns: ConsolidationResult['memoryPatterns'] = [];

    // 识别最近的重要记忆
    const recentImportant = memories.filter(m => 
      m.timestamp > oneDayAgo && m.importance > 0.6
    );

    // 识别重复模式
    const contentPatterns = this.extractPatterns(recentImportant);
    for (const [pattern, count] of contentPatterns.entries()) {
      if (count >= 2) {
        patterns.push({
          pattern,
          frequency: count,
          confidence: Math.min(0.9, 0.5 + count * 0.1),
        });
      }
    }

    // 巩固符合条件的记忆
    for (const memory of memories) {
      const age = now - memory.timestamp;
      const daysOld = age / (24 * 60 * 60 * 1000);
      
      // 巩固标准：高重要性 或 频繁访问 或 已存在的关联模式
      const shouldConsolidate = 
        memory.importance > this.config.consolidationThreshold ||
        memory.accessCount > 5 ||
        (daysOld > 7 && memory.accessCount > 0);

      if (shouldConsolidate) {
        // 应用巩固加成
        const boost = this.config.sleepBoostFactor - 1.0;
        memory.importance = Math.min(1.0, memory.importance * this.config.sleepBoostFactor);
        memory.emotionalWeight = Math.min(1.0, memory.emotionalWeight * 1.1);
        
        consolidated++;
        totalBoost += boost;
      }
    }

    // 生成洞察
    if (patterns.length > 0) {
      insights.push(`Identified ${patterns.length} recurring patterns during consolidation`);
    }
    if (consolidated > 0) {
      insights.push(`Consolidated ${consolidated} memories, boosting long-term retention`);
    }

    const result: ConsolidationResult = {
      memoriesConsolidated: consolidated,
      totalRetentionBoost: totalBoost,
      insightsExtracted: insights,
      memoryPatterns: patterns,
    };

    this.consolidationLog.push(result);
    return result;
  }

  /**
   * 执行选择性记忆增强
   * 对特定记忆主动增强
   */
  enhanceMemory(
    memory: MemoryEntry,
    enhancementType: 'importance' | 'emotional' | 'association'
  ): MemoryEntry {
    switch (enhancementType) {
      case 'importance':
        memory.importance = Math.min(1.0, memory.importance * 1.2);
        break;
      case 'emotional':
        memory.emotionalWeight = Math.min(1.0, memory.emotionalWeight * 1.15);
        break;
      case 'association':
        // 增加访问计数模拟强化关联
        memory.accessCount += 3;
        break;
    }
    
    return memory;
  }

  /**
   * 获取复习提醒
   */
  getReviewReminders(memories: MemoryEntry[]): Array<{
    memory: MemoryEntry;
    urgency: 'high' | 'medium' | 'low';
    estimatedRetention: number;
    recommendedAction: string;
  }> {
    const now = Date.now();
    const reminders: ReturnType<typeof this.getReviewReminders> = [];

    for (const memory of memories) {
      const ageMs = now - memory.timestamp;
      const ageMinutes = ageMs / (1000 * 60);
      const retention = this.ebbinghaus.calculateRetention(ageMinutes, memory.accessCount);
      
      // 计算下次复习时间
      const nextReview = this.ebbinghaus.calculateNextReview(
        memory.timestamp,
        memory.accessCount
      );
      
      const timeUntilReview = nextReview - now;

      if (timeUntilReview < 0 && retention < 0.5) {
        reminders.push({
          memory,
          urgency: retention < 0.3 ? 'high' : 'medium',
          estimatedRetention: retention,
          recommendedAction: `Review this ${memory.type} memory - retention dropping to ${(retention * 100).toFixed(0)}%`,
        });
      } else if (timeUntilReview < 60 * 60 * 1000) { // < 1 hour
        reminders.push({
          memory,
          urgency: 'low',
          estimatedRetention: retention,
          recommendedAction: 'Upcoming review recommended',
        });
      }
    }

    // 按紧急程度排序
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    return reminders.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
  }

  /**
   * 获取记忆健康报告
   */
  getMemoryHealthReport(memories: MemoryEntry[]): {
    totalMemories: number;
    avgRetentionScore: number;
    highRetentionCount: number;
    lowRetentionCount: number;
    atRiskCount: number;
    consolidationHealth: number;
    recommendations: string[];
  } {
    const scores = memories.map(m => this.calculateRetentionScore(m));
    const avgScore = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
    const highRetention = scores.filter(s => s > 0.7).length;
    const lowRetention = scores.filter(s => s < 0.3).length;
    const atRisk = scores.filter(s => s < this.config.minRetentionScore).length;

    const recommendations: string[] = [];
    
    if (avgScore < 0.5) {
      recommendations.push('Overall memory retention is low - consider more frequent reviews');
    }
    if (atRisk > memories.length * 0.1) {
      recommendations.push('High number of at-risk memories - pruning recommended');
    }
    if (lowRetention > highRetention) {
      recommendations.push('More memories need strengthening than are well-retained');
    }

    return {
      totalMemories: memories.length,
      avgRetentionScore: avgScore,
      highRetentionCount: highRetention,
      lowRetentionCount: lowRetention,
      atRiskCount: atRisk,
      consolidationHealth: avgScore,
      recommendations,
    };
  }

  /**
   * 获取归档记忆
   */
  getArchivedMemories(): MemoryEntry[] {
    return [...this.archivedMemories];
  }

  /**
   * 恢复归档记忆
   */
  restoreFromArchive(id: string): MemoryEntry | undefined {
    const index = this.archivedMemories.findIndex(m => m.id === id);
    if (index >= 0) {
      const memory = this.archivedMemories[index];
      this.archivedMemories.splice(index, 1);
      // 恢复时增加重要性
      memory.importance = Math.min(1.0, memory.importance * 1.1);
      return memory;
    }
    return undefined;
  }

  /**
   * 清空归档
   */
  clearArchive(): number {
    const count = this.archivedMemories.length;
    this.archivedMemories = [];
    return count;
  }

  /**
   * 获取巩固历史
   */
  getConsolidationHistory(): ConsolidationResult[] {
    return [...this.consolidationLog];
  }

  // ============ 私有方法 ============

  /**
   * 从记忆中提取模式
   */
  private extractPatterns(memories: MemoryEntry[]): Map<string, number> {
    const patterns = new Map<string, number>();
    
    for (const memory of memories) {
      const words = memory.content.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3);
      
      // 提取2-gram模式
      for (let i = 0; i < words.length - 1; i++) {
        const pattern = `${words[i]} ${words[i + 1]}`;
        patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
      }
    }

    return patterns;
  }
}

export default EmbodiedForgetting;
