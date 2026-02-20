/**
 * @file core/reflection/trigger-engine.ts
 * @description 反思触发器引擎 - Step 5.1
 * @author Ouroboros
 * @date 2026-02-18
 */

import type {
  ReflectionTrigger,
  ReflectionCondition,
  PerformanceAnalysis,
} from '@/types/reflection';
import { createContextLogger } from '@/utils/logger';
import { randomUUID } from 'crypto';

const logger = createContextLogger('ReflectionTriggerEngine');

/**
 * 触发器上下文
 */
interface TriggerContext {
  /** 当前性能分析 */
  performanceAnalysis?: PerformanceAnalysis;
  /** 最近错误数量 */
  recentErrorCount?: number;
  /** 系统运行时间(小时) */
  uptimeHours?: number;
  /** 连续失败计数 */
  consecutiveFailures?: number;
  /** 成功率历史 */
  successRateHistory?: number[];
  /** 自定义数据 */
  [key: string]: unknown;
}

/**
 * 触发器回调
 */
type TriggerCallback = (trigger: ReflectionTrigger, context: TriggerContext) => void;

/**
 * 反思触发器引擎
 * 
 * 管理所有反思触发器，根据条件自动触发反思流程
 */
export class ReflectionTriggerEngine {
  /** 触发器列表 */
  private triggers: Map<string, ReflectionTrigger> = new Map();
  /** 回调函数 */
  private callbacks: TriggerCallback[] = [];
  /** 检查间隔 */
  private checkIntervalMs: number;
  /** 定时器 */
  private intervalId?: NodeJS.Timeout | undefined;
  /** 是否运行中 */
  private running = false;
  /** 性能监控数据 */
  private performanceData: {
    avgResponseTime: number;
    successRate: number;
    sampleCount: number;
    /** 最近的响应时间记录 */
    recentResponseTimes: number[];
    /** 最近的成功状态记录 */
    recentSuccesses: boolean[];
    /** 最大历史记录数 */
    maxHistory: number;
  } = { 
    avgResponseTime: 0, 
    successRate: 1, 
    sampleCount: 0,
    recentResponseTimes: [],
    recentSuccesses: [],
    maxHistory: 50
  };

  /**
   * 创建触发器引擎
   * @param checkIntervalMs 检查间隔(默认30秒)
   */
  constructor(checkIntervalMs = 30000) {
    this.checkIntervalMs = checkIntervalMs;
    this.registerDefaultTriggers();
    logger.info('反思触发器引擎初始化完成', { checkIntervalMs });
  }

  /**
   * 注册触发器
   */
  registerTrigger(trigger: Omit<ReflectionTrigger, 'id' | 'triggerCount'>): ReflectionTrigger {
    const fullTrigger: ReflectionTrigger = {
      ...trigger,
      id: randomUUID(),
      triggerCount: 0,
    };
    
    this.triggers.set(fullTrigger.id, fullTrigger);
    logger.debug('触发器已注册', { 
      id: fullTrigger.id, 
      type: fullTrigger.type, 
      name: fullTrigger.name 
    });
    
    return fullTrigger;
  }

  /**
   * 注销触发器
   */
  unregisterTrigger(triggerId: string): boolean {
    const existed = this.triggers.delete(triggerId);
    if (existed) {
      logger.debug('触发器已注销', { triggerId });
    }
    return existed;
  }

  /**
   * 启用/禁用触发器
   */
  setTriggerEnabled(triggerId: string, enabled: boolean): boolean {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) return false;
    
    trigger.enabled = enabled;
    logger.debug('触发器状态已更改', { triggerId, enabled });
    return true;
  }

  /**
   * 注册回调函数
   */
  onTrigger(callback: TriggerCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * 移除回调函数
   */
  offTrigger(callback: TriggerCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * 启动触发器引擎
   */
  start(): void {
    if (this.running) {
      logger.warn('触发器引擎已在运行');
      return;
    }

    this.running = true;
    this.intervalId = setInterval(() => {
      this.checkTriggers();
    }, this.checkIntervalMs);

    logger.info('触发器引擎已启动');
  }

  /**
   * 停止触发器引擎
   */
  stop(): void {
    if (!this.running) return;

    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    logger.info('触发器引擎已停止');
  }

  /**
   * 更新性能数据
   */
  updatePerformanceData(data: {
    responseTime: number;
    success: boolean;
  }): void {
    const { responseTime, success } = data;
    
    // 增量更新平均值
    const newCount = this.performanceData.sampleCount + 1;
    this.performanceData.avgResponseTime = 
      (this.performanceData.avgResponseTime * this.performanceData.sampleCount + responseTime) / newCount;
    
    this.performanceData.successRate = 
      (this.performanceData.successRate * this.performanceData.sampleCount + (success ? 1 : 0)) / newCount;
    
    this.performanceData.sampleCount = newCount;

    // 记录历史
    this.performanceData.recentResponseTimes.push(responseTime);
    this.performanceData.recentSuccesses.push(success);
    
    // 限制历史记录数量
    if (this.performanceData.recentResponseTimes.length > this.performanceData.maxHistory) {
      this.performanceData.recentResponseTimes.shift();
      this.performanceData.recentSuccesses.shift();
    }

    // 限制样本数量，避免历史数据影响过大
    if (this.performanceData.sampleCount > 1000) {
      this.performanceData.sampleCount = 500; // 保留一半权重
    }
  }

  /**
   * 手动触发
   */
  manualTrigger(name: string, context: TriggerContext = {}): void {
    const trigger = Array.from(this.triggers.values()).find(t => 
      t.type === 'manual' && t.name === name
    );
    
    if (trigger) {
      this.fireTrigger(trigger, context);
    } else {
      logger.warn('未找到手动触发器', { name });
    }
  }

  /**
   * 检查所有触发器
   */
  private checkTriggers(): void {
    const context = this.buildContext();
    
    for (const trigger of this.triggers.values()) {
      if (!trigger.enabled) continue;
      
      // 检查冷却时间
      if (trigger.lastTriggeredAt) {
        const elapsed = Date.now() - new Date(trigger.lastTriggeredAt).getTime();
        if (elapsed < trigger.cooldownMs) continue;
      }
      
      // 评估条件
      if (this.evaluateCondition(trigger, context)) {
        this.fireTrigger(trigger, context);
      }
    }
  }

  /**
   * 构建触发器上下文
   */
  private buildContext(): TriggerContext {
    // 计算连续失败次数
    let consecutiveFailures = 0;
    for (let i = this.performanceData.recentSuccesses.length - 1; i >= 0; i--) {
      if (!this.performanceData.recentSuccesses[i]) {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    // 计算响应时间趋势
    const recentTimes = this.performanceData.recentResponseTimes.slice(-10);
    const olderTimes = this.performanceData.recentResponseTimes.slice(-20, -10);
    const recentAvg = recentTimes.length > 0 
      ? recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length 
      : 0;
    const olderAvg = olderTimes.length > 0 
      ? olderTimes.reduce((a, b) => a + b, 0) / olderTimes.length 
      : recentAvg;
    
    let responseTimeTrend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (recentAvg > olderAvg * 1.3) {
      responseTimeTrend = 'degrading';
    } else if (recentAvg < olderAvg * 0.7) {
      responseTimeTrend = 'improving';
    }

    // 检测异常（响应时间突然增加）
    const anomalies: Array<{ type: string; severity: 'low' | 'medium' | 'high'; description: string }> = [];
    
    // 检测响应时间异常（超过平均值2倍）
    const lastResponseTime = this.performanceData.recentResponseTimes[this.performanceData.recentResponseTimes.length - 1];
    if (lastResponseTime && lastResponseTime > this.performanceData.avgResponseTime * 2) {
      anomalies.push({
        type: 'response_time_spike',
        severity: lastResponseTime > this.performanceData.avgResponseTime * 3 ? 'high' : 'medium',
        description: `响应时间异常: ${lastResponseTime}ms (平均: ${this.performanceData.avgResponseTime.toFixed(0)}ms)`,
      });
    }

    // 检测连续失败
    if (consecutiveFailures >= 3) {
      anomalies.push({
        type: 'consecutive_failures',
        severity: consecutiveFailures >= 5 ? 'high' : 'medium',
        description: `连续 ${consecutiveFailures} 次失败`,
      });
    }

    // 检测成功率下降
    const recentSuccessRate = this.performanceData.recentSuccesses.slice(-10).filter(s => s).length / 
      Math.min(10, this.performanceData.recentSuccesses.length) || 1;
    if (recentSuccessRate < 0.7 && this.performanceData.recentSuccesses.length >= 5) {
      anomalies.push({
        type: 'low_success_rate',
        severity: recentSuccessRate < 0.5 ? 'high' : 'medium',
        description: `成功率下降至 ${(recentSuccessRate * 100).toFixed(1)}%`,
      });
    }

    return {
      performanceAnalysis: {
        timeRange: { start: new Date(Date.now() - 3600000).toISOString(), end: new Date().toISOString() },
        avgResponseTime: this.performanceData.avgResponseTime,
        responseTimeTrend,
        successRate: this.performanceData.successRate,
        tokenEfficiency: 0,
        bottlenecks: [],
        anomalies,
      },
      recentErrorCount: this.performanceData.recentSuccesses.filter(s => !s).length,
      consecutiveFailures,
      successRateHistory: this.performanceData.recentSuccesses.map(s => s ? 1 : 0),
      uptimeHours: 0,
    };
  }

  /**
   * 评估触发条件
   */
  private evaluateCondition(trigger: ReflectionTrigger, context: TriggerContext): boolean {
    const { condition, type } = trigger;
    
    switch (type) {
      case 'scheduled':
        return this.evaluateScheduledCondition(condition);
        
      case 'performanceDrop':
        return this.evaluatePerformanceCondition(condition, context);
        
      case 'anomaly':
        return this.evaluateAnomalyCondition(condition, context);
        
      case 'manual':
        return false; // 手动触发器不自动触发
        
      default:
        return false;
    }
  }

  /**
   * 评估定期触发条件
   */
  private evaluateScheduledCondition(condition: ReflectionCondition): boolean {
    const { scheduleIntervalMs } = condition;
    if (!scheduleIntervalMs) return false;
    
    // 定期触发器在检查时直接触发（冷却时间已在 checkTriggers 中处理）
    return true;
  }

  /**
   * 评估性能下降条件
   */
  private evaluatePerformanceCondition(
    condition: ReflectionCondition, 
    context: TriggerContext
  ): boolean {
    const { performanceThreshold = 0.7, responseTimeThreshold = 5000 } = condition;
    const { performanceAnalysis } = context;
    
    if (!performanceAnalysis) return false;
    
    // 1. 成功率低于阈值
    if (performanceAnalysis.successRate < performanceThreshold) {
      logger.debug('性能下降触发: 成功率低于阈值', { 
        successRate: performanceAnalysis.successRate, 
        threshold: performanceThreshold 
      });
      return true;
    }
    
    // 2. 响应时间趋势恶化
    if (performanceAnalysis.responseTimeTrend === 'degrading') {
      logger.debug('性能下降触发: 响应时间趋势恶化');
      return true;
    }

    // 3. 平均响应时间超过阈值（5秒）
    if (performanceAnalysis.avgResponseTime > responseTimeThreshold) {
      logger.debug('性能下降触发: 平均响应时间过长', { 
        avgResponseTime: performanceAnalysis.avgResponseTime, 
        threshold: responseTimeThreshold 
      });
      return true;
    }
    
    return false;
  }

  /**
   * 评估异常条件
   */
  private evaluateAnomalyCondition(
    condition: ReflectionCondition,
    context: TriggerContext
  ): boolean {
    const { consecutiveFailures, recentErrorCount, performanceAnalysis } = context;
    
    // 1. 连续失败检测（默认3次）
    const failureThreshold = condition.consecutiveFailureThreshold || 3;
    if (consecutiveFailures && consecutiveFailures >= failureThreshold) {
      logger.debug('异常触发: 连续失败', { consecutiveFailures, threshold: failureThreshold });
      return true;
    }
    
    // 2. 最近错误过多（默认超过5个）
    const errorThreshold = condition.errorCountThreshold || 5;
    if (recentErrorCount && recentErrorCount >= errorThreshold) {
      logger.debug('异常触发: 错误数过多', { recentErrorCount, threshold: errorThreshold });
      return true;
    }

    // 3. 检测到严重异常
    if (performanceAnalysis?.anomalies && performanceAnalysis.anomalies.length > 0) {
      const highSeverityAnomalies = performanceAnalysis.anomalies.filter(
        (a): a is { type: string; severity: 'low' | 'medium' | 'high'; description: string } => 
          typeof a === 'object' && a.severity === 'high'
      );
      if (highSeverityAnomalies.length > 0) {
        logger.debug('异常触发: 检测到严重异常', { 
          anomalies: highSeverityAnomalies.map(a => a.type) 
        });
        return true;
      }
    }
    
    // 4. 自定义检查
    if (condition.customCheck) {
      return condition.customCheck();
    }
    
    return false;
  }

  /**
   * 触发回调
   */
  private fireTrigger(trigger: ReflectionTrigger, context: TriggerContext): void {
    // 更新触发记录
    trigger.lastTriggeredAt = new Date().toISOString();
    trigger.triggerCount++;
    
    logger.info('反思触发器已触发', {
      id: trigger.id,
      type: trigger.type,
      name: trigger.name,
    });
    
    // 执行回调
    for (const callback of this.callbacks) {
      try {
        callback(trigger, context);
      } catch (error) {
        logger.error('触发器回调执行失败', { triggerId: trigger.id, error });
      }
    }
  }

  /**
   * 注册默认触发器
   */
  private registerDefaultTriggers(): void {
    // 定期反思 (每30分钟)
    this.registerTrigger({
      type: 'scheduled',
      name: '定期反思',
      description: '每30分钟自动进行一次反思',
      enabled: true,
      condition: { scheduleIntervalMs: 30 * 60 * 1000 },
      cooldownMs: 30 * 60 * 1000,
    });
    
    // 性能下降检测
    this.registerTrigger({
      type: 'performanceDrop',
      name: '性能下降检测',
      description: '当成功率低于90%或响应时间>2秒或响应时间恶化时触发',
      enabled: true,
      condition: { 
        performanceThreshold: 0.9,  // 错误率>10%触发 (成功率<90%)
        responseTimeThreshold: 2000,  // 响应时间>2秒触发
      },
      cooldownMs: 5 * 60 * 1000, // 5分钟冷却
    });
    
    // 异常检测
    this.registerTrigger({
      type: 'anomaly',
      name: '异常检测',
      description: '当检测到异常模式时触发（连续3次失败/高严重异常）',
      enabled: true,
      condition: {
        consecutiveFailureThreshold: 3,  // 连续3次失败触发
        errorCountThreshold: 5,  // 5个错误触发
      },
      cooldownMs: 10 * 60 * 1000, // 10分钟冷却
    });
    
    // 手动触发器
    this.registerTrigger({
      type: 'manual',
      name: '立即反思',
      description: '用户手动触发的反思',
      enabled: true,
      condition: {},
      cooldownMs: 0,
    });
  }

  /**
   * 获取性能统计数据
   */
  getPerformanceStats(): {
    avgResponseTime: number;
    successRate: number;
    sampleCount: number;
    recentResponseTimes: number[];
    consecutiveFailures: number;
  } {
    // 计算连续失败次数
    let consecutiveFailures = 0;
    for (let i = this.performanceData.recentSuccesses.length - 1; i >= 0; i--) {
      if (!this.performanceData.recentSuccesses[i]) {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    return {
      avgResponseTime: this.performanceData.avgResponseTime,
      successRate: this.performanceData.successRate,
      sampleCount: this.performanceData.sampleCount,
      recentResponseTimes: [...this.performanceData.recentResponseTimes],
      consecutiveFailures,
    };
  }

  /**
   * 获取性能历史数据
   */
  getPerformanceHistory(): Array<{
    timestamp: string;
    responseTime: number;
    success: boolean;
  }> {
    return this.performanceData.recentResponseTimes.map((time, index) => ({
      timestamp: new Date(Date.now() - (this.performanceData.recentResponseTimes.length - index) * 60000).toISOString(),
      responseTime: time,
      success: this.performanceData.recentSuccesses[index] ?? true,
    }));
  }

  /**
   * 获取所有触发器
   */
  getTriggers(): ReflectionTrigger[] {
    return Array.from(this.triggers.values());
  }

  /**
   * 获取触发器统计
   */
  getStats(): {
    total: number;
    enabled: number;
    totalTriggers: number;
  } {
    const triggers = Array.from(this.triggers.values());
    return {
      total: triggers.length,
      enabled: triggers.filter(t => t.enabled).length,
      totalTriggers: triggers.reduce((sum, t) => sum + t.triggerCount, 0),
    };
  }
}
