/**
 * @file capabilities/model-engine/token-budget-manager.ts
 * @description Token 预算管理器 - 分配和监控 Token 使用
 * @author Ouroboros
 * @date 2026-02-18
 */

import type { TokenBudget, BudgetAllocation } from '@/types/model';
import { createContextLogger } from '@/utils/logger';
import { ConfigError, tryCatch } from '@/utils/error';
import { getConfig } from '@/config';

const logger = createContextLogger('TokenBudgetManager');

/**
 * Token 使用记录
 */
interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
  timestamp: string;
}

/**
 * Token 预算管理器类
 * 管理 Token 分配和使用追踪
 */
export class TokenBudgetManager {
  /** 预算配置 */
  private budget: TokenBudget;
  /** 使用历史 */
  private usageHistory: TokenUsage[] = [];
  /** 总预算 */
  private totalBudget: number;
  /** 最大记录数 */
  private maxHistorySize: number;

  /**
   * 创建 Token 预算管理器
   * @param customBudget 自定义预算（可选，不传则使用全局配置）
   * @param customTotalBudget 自定义总预算（可选）
   */
  constructor(customBudget?: Partial<TokenBudget>, customTotalBudget?: number) {
    const config = getConfig();

    this.totalBudget = customTotalBudget ?? config.model.totalTokenBudget;
    this.budget = customBudget
      ? { ...config.model.tokenBudget, ...customBudget }
      : config.model.tokenBudget;
    this.maxHistorySize = 100;

    this.validateBudget();

    logger.info('Token预算管理器初始化完成', {
      totalBudget: this.totalBudget,
      allocation: this.budget,
    });
  }

  /**
   * 验证预算分配
   */
  private validateBudget(): void {
    const total = Object.values(this.budget).reduce((a, b) => a + b, 0);

    if (Math.abs(total - 1) > 0.001) {
      logger.warn('预算分配总和不为1，自动归一化', { total });

      // 归一化
      const factor = 1 / total;
      this.budget = {
        system: this.budget.system * factor,
        self: this.budget.self * factor,
        memory: this.budget.memory * factor,
        user: this.budget.user * factor,
      };
    }
  }

  /**
   * 计算预算分配
   * @returns 预算分配结果
   */
  calculateBudgets(): BudgetAllocation {
    return {
      systemBudget: Math.floor(this.totalBudget * this.budget.system),
      selfBudget: Math.floor(this.totalBudget * this.budget.self),
      memoryBudget: Math.floor(this.totalBudget * this.budget.memory),
      userBudget: Math.floor(this.totalBudget * this.budget.user),
      totalBudget: this.totalBudget,
    };
  }

  /**
   * 更新预算配置
   * @param budget 部分预算配置
   */
  updateBudget(budget: Partial<TokenBudget>): void {
    this.budget = { ...this.budget, ...budget };
    this.validateBudget();

    logger.info('预算配置已更新', { budget: this.budget });
  }

  /**
   * 更新总预算
   * @param totalBudget 新的总预算
   */
  updateTotalBudget(totalBudget: number): void {
    if (totalBudget <= 0) {
      throw new ConfigError(
        '总预算必须大于0',
        'TokenBudgetManager.updateTotalBudget'
      );
    }

    this.totalBudget = totalBudget;
    logger.info('总预算已更新', { totalBudget });
  }

  /**
   * 记录 Token 使用
   * @param usage Token 使用情况
   */
  recordUsage(usage: TokenUsage): void {
    this.usageHistory.push(usage);

    // 保留最近N条记录
    if (this.usageHistory.length > this.maxHistorySize) {
      this.usageHistory.shift();
    }

    logger.debug('Token使用已记录', {
      prompt: usage.prompt,
      completion: usage.completion,
      total: usage.total,
    });
  }

  /**
   * 获取平均 Token 使用
   * @returns 平均使用情况
   */
  getAverageUsage(): { prompt: number; completion: number; total: number } {
    if (this.usageHistory.length === 0) {
      return { prompt: 0, completion: 0, total: 0 };
    }

    const sum = this.usageHistory.reduce(
      (acc, usage) => ({
        prompt: acc.prompt + usage.prompt,
        completion: acc.completion + usage.completion,
        total: acc.total + usage.total,
      }),
      { prompt: 0, completion: 0, total: 0 }
    );

    return {
      prompt: Math.floor(sum.prompt / this.usageHistory.length),
      completion: Math.floor(sum.completion / this.usageHistory.length),
      total: Math.floor(sum.total / this.usageHistory.length),
    };
  }

  /**
   * 检查是否超出预算
   * @param estimatedTokens 预估 Token 数
   * @returns 是否超出
   */
  isOverBudget(estimatedTokens: number): boolean {
    return estimatedTokens > this.totalBudget;
  }

  /**
   * 截断文本以适应预算
   * @param text 原始文本
   * @param maxTokens 最大 Token 数
   * @returns 截断后的文本
   */
  truncateToFit(text: string, maxTokens: number): string {
    return tryCatch(
      () => {
        // 简单估算：平均每个字符约 0.75 个 Token
        const estimatedChars = Math.floor(maxTokens * 0.75);

        if (text.length <= estimatedChars) {
          return text;
        }

        // 截断并添加省略号
        const truncated = text.slice(0, estimatedChars - 10);
        return truncated + '\n... (内容已截断)';
      },
      'TokenBudgetManager.truncateToFit',
      ConfigError
    )();
  }

  /**
   * 获取预算使用情况报告
   * @returns 使用报告
   */
  getUsageReport(): {
    totalBudget: number;
    averageUsage: { prompt: number; completion: number; total: number };
    utilizationRate: number;
    historyCount: number;
  } {
    const avgUsage = this.getAverageUsage();
    const utilizationRate = this.totalBudget > 0
      ? (avgUsage.total / this.totalBudget) * 100
      : 0;

    return {
      totalBudget: this.totalBudget,
      averageUsage: avgUsage,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
      historyCount: this.usageHistory.length,
    };
  }

  /**
   * 获取当前预算配置
   * @returns 预算配置副本
   */
  getBudget(): TokenBudget {
    return { ...this.budget };
  }

  /**
   * 获取总预算
   * @returns 总预算
   */
  getTotalBudget(): number {
    return this.totalBudget;
  }

  /**
   * 重置使用历史
   */
  resetHistory(): void {
    this.usageHistory = [];
    logger.info('Token使用历史已重置');
  }

  /**
   * 序列化为 JSON
   * @returns 序列化数据
   */
  toJSON(): object {
    return {
      budget: { ...this.budget },
      totalBudget: this.totalBudget,
      usageHistory: [...this.usageHistory],
    };
  }

  /**
   * 从 JSON 恢复
   * @param data 序列化数据
   * @returns TokenBudgetManager 实例
   */
  static fromJSON(data: {
    budget: TokenBudget;
    totalBudget: number;
    usageHistory: TokenUsage[];
  }): TokenBudgetManager {
    const manager = new TokenBudgetManager(data.budget, data.totalBudget);
    manager.usageHistory = [...data.usageHistory];
    return manager;
  }
}
