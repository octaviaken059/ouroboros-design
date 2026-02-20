/**
 * @file evolution/hormone/hormone-system.ts
 * @description 激素系统 - 整合所有激素相关功能的主类
 * @author Ouroboros
 * @date 2026-02-18
 */

import type {
  HormoneType,
  HormoneSystemConfig,
  HormoneSnapshot,
  EmotionalState,
  TriggerType,
  HormoneChange,
  Trigger,
} from '@/types/hormone';
import { DEFAULT_HORMONE_CONFIG } from '@/types/hormone';
import { HormoneEngine } from './hormone-engine';
import { TriggerEngine, type TriggerResult, type TriggerContext } from './trigger-engine';
import { EmotionalStateGenerator } from './emotional-state-generator';
import { createContextLogger } from '@/utils/logger';
import { ValidationError } from '@/utils/error';

const logger = createContextLogger('HormoneSystem');

/**
 * 激素系统主类
 * 整合激素引擎、触发器引擎和情绪生成器
 */
export class HormoneSystem {
  /** 激素引擎映射表 */
  private hormones: Map<HormoneType, HormoneEngine> = new Map();
  /** 触发器引擎 */
  private triggerEngine: TriggerEngine;
  /** 情绪生成器 */
  private emotionalGenerator: EmotionalStateGenerator;
  /** 配置 */
  private config: HormoneSystemConfig;
  /** 衰减定时器 */
  private decayInterval: NodeJS.Timeout | null = null;
  /** 是否运行中 */
  private isRunning = false;

  /** 激素历史记录 */
  private history: Array<{
    timestamp: string;
    levels: Record<HormoneType, number>;
  }> = [];
  /** 历史记录最大长度 */
  private maxHistoryLength = 100;

  /**
   * 创建激素系统实例
   * @param config 可选配置，使用默认配置
   */
  constructor(config?: Partial<HormoneSystemConfig>) {
    this.config = { ...DEFAULT_HORMONE_CONFIG, ...config };
    this.triggerEngine = new TriggerEngine();
    this.emotionalGenerator = new EmotionalStateGenerator();

    // 初始化所有激素引擎
    this.initializeHormones();

    logger.info('激素系统初始化完成', {
      hormones: this.hormones.size,
      decayIntervalMs: this.config.decayIntervalMs,
    });
  }

  /**
   * 初始化所有激素引擎
   */
  private initializeHormones(): void {
    const hormoneConfigs: Record<HormoneType, HormoneSystemConfig['dopamine']> = {
      dopamine: this.config.dopamine,
      serotonin: this.config.serotonin,
      cortisol: this.config.cortisol,
      oxytocin: this.config.oxytocin,
      norepinephrine: this.config.norepinephrine,
    };

    for (const [type, hormoneConfig] of Object.entries(hormoneConfigs)) {
      const engine = new HormoneEngine(type as HormoneType, hormoneConfig);
      this.hormones.set(type as HormoneType, engine);
    }
  }

  /**
   * 启动激素系统
   * 开始自动衰减循环
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('激素系统已经在运行中');
      return;
    }

    this.isRunning = true;

    // 启动衰减循环
    this.decayInterval = setInterval(() => {
      this.applyNaturalDecay();
      this.recordHistory();
    }, this.config.decayIntervalMs);

    logger.info('激素系统已启动');
  }

  /**
   * 记录激素历史
   */
  private recordHistory(): void {
    this.history.push({
      timestamp: new Date().toISOString(),
      levels: this.getAllHormoneLevels(),
    });

    // 限制历史记录数量
    if (this.history.length > this.maxHistoryLength) {
      this.history = this.history.slice(-this.maxHistoryLength / 2);
    }
  }

  /**
   * 获取激素历史
   * @returns 激素历史记录
   */
  getHistory(): Array<{
    timestamp: string;
    levels: Record<HormoneType, number>;
  }> {
    return [...this.history];
  }

  /**
   * 停止激素系统
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('激素系统未运行');
      return;
    }

    this.isRunning = false;

    if (this.decayInterval) {
      clearInterval(this.decayInterval);
      this.decayInterval = null;
    }

    logger.info('激素系统已停止');
  }

  /**
   * 获取指定激素的当前值
   * @param type 激素类型
   * @returns 当前值
   */
  getHormoneValue(type: HormoneType): number {
    const engine = this.hormones.get(type);
    if (!engine) {
      throw new ValidationError('无效的激素类型', { type });
    }
    return engine.getValue();
  }

  /**
   * 获取所有激素水平
   * @returns 激素水平映射
   */
  getAllHormoneLevels(): Record<HormoneType, number> {
    const levels: Partial<Record<HormoneType, number>> = {};

    for (const [type, engine] of this.hormones) {
      levels[type] = engine.getValue();
    }

    return levels as Record<HormoneType, number>;
  }

  /**
   * 增加激素水平
   * @param type 激素类型
   * @param amount 增加量
   * @param reason 原因
   * @returns 增加后的值
   */
  increaseHormone(
    type: HormoneType,
    amount: number,
    reason?: string
  ): number {
    try {
      const engine = this.hormones.get(type);
      if (!engine) {
        throw new ValidationError('无效的激素类型', { type });
      }

      return engine.increase(amount, reason);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 减少激素水平
   * @param type 激素类型
   * @param amount 减少量
   * @param reason 原因
   * @returns 减少后的值
   */
  decreaseHormone(
    type: HormoneType,
    amount: number,
    reason?: string
  ): number {
    try {
      const engine = this.hormones.get(type);
      if (!engine) {
        throw new ValidationError('无效的激素类型', { type });
      }

      return engine.decrease(amount, reason);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 设置激素水平
   * @param type 激素类型
   * @param value 目标值
   * @param reason 原因
   * @returns 设置后的值
   */
  setHormoneValue(
    type: HormoneType,
    value: number,
    reason?: string
  ): number {
    try {
      const engine = this.hormones.get(type);
      if (!engine) {
        throw new ValidationError('无效的激素类型', { type });
      }

      return engine.setValue(value, reason);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 应用激素变化列表
   * @param changes 变化列表
   */
  applyHormoneChanges(changes: HormoneChange[]): void {
    for (const change of changes) {
      if (change.delta > 0) {
        this.increaseHormone(change.hormone, change.delta, change.reason);
      } else if (change.delta < 0) {
        this.decreaseHormone(change.hormone, Math.abs(change.delta), change.reason);
      }
    }
  }

  /**
   * 触发特定类型的触发器
   * @param type 触发器类型
   * @param context 上下文
   * @returns 触发结果
   */
  fireTrigger(type: TriggerType, context?: TriggerContext): TriggerResult[] {
    try {
      // 添加上下文激素水平
      const fullContext: TriggerContext = {
        ...context,
        hormoneLevels: this.getAllHormoneLevels(),
      };

      // 触发器引擎执行
      const results = this.triggerEngine.fire(type, fullContext);

      // 应用激素变化
      for (const result of results) {
        if (result.fired && result.changes) {
          this.applyHormoneChanges(result.changes);
        }
      }

      logger.debug('触发器执行完成', {
        type,
        triggered: results.filter((r) => r.fired).length,
      });

      return results;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 应用自然衰减
   */
  private applyNaturalDecay(): void {
    for (const engine of this.hormones.values()) {
      engine.applyNaturalDecay();
    }
  }

  /**
   * 获取激素快照
   * @returns 当前激素快照
   */
  getSnapshot(): HormoneSnapshot {
    const levels = this.getAllHormoneLevels();
    const values = Object.values(levels);

    // 找出主导激素
    let dominantHormone: HormoneType = 'dopamine';
    let maxValue = -1;

    for (const [type, value] of Object.entries(levels)) {
      if (value > maxValue) {
        maxValue = value;
        dominantHormone = type as HormoneType;
      }
    }

    // 计算平均唤醒水平
    const averageArousal = values.reduce((a, b) => a + b, 0) / values.length;

    return {
      timestamp: Date.now(),
      levels,
      dominantHormone,
      averageArousal,
    };
  }

  /**
   * 获取当前情绪状态
   * @returns 情绪状态
   */
  getEmotionalState(): EmotionalState {
    const snapshot = this.getSnapshot();
    return this.emotionalGenerator.generateEmotionalState(snapshot);
  }

  /**
   * 获取情绪标签
   * @returns 情绪标签
   */
  getEmotionLabel(): string {
    const snapshot = this.getSnapshot();
    return this.emotionalGenerator.generateEmotionLabel(snapshot);
  }

  /**
   * 重置所有激素到基线
   * @param reason 原因
   */
  resetAllToBaseline(reason?: string): void {
    for (const engine of this.hormones.values()) {
      engine.resetToBaseline(reason);
    }

    logger.info('所有激素已重置为基线', { reason });
  }

  /**
   * 获取触发器引擎
   * @returns 触发器引擎
   */
  getTriggerEngine(): TriggerEngine {
    return this.triggerEngine;
  }

  /**
   * 获取运行状态
   * @returns 是否运行中
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 序列化为JSON
   * @returns 序列化数据
   */
  toJSON(): object {
    return {
      config: { ...this.config },
      hormones: Array.from(this.hormones.entries()).map(([type, engine]) => ({
        type,
        ...engine.toJSON(),
      })),
      triggers: this.triggerEngine.toJSON(),
    };
  }

  /**
   * 从JSON恢复
   * @param data 序列化数据
   * @returns HormoneSystem实例
   */
  static fromJSON(data: {
    config: HormoneSystemConfig;
    hormones: Array<{ type: HormoneType } & ReturnType<HormoneEngine['toJSON']>>;
    triggers: { triggers: Trigger[] };
  }): HormoneSystem {
    const system = new HormoneSystem(data.config);

    // 恢复激素状态
    system.hormones.clear();
    for (const hormoneData of data.hormones) {
      const engine = HormoneEngine.fromJSON(hormoneData as Parameters<typeof HormoneEngine.fromJSON>[0]);
      system.hormones.set(hormoneData.type, engine);
    }

    // 恢复触发器
    system.triggerEngine = TriggerEngine.fromJSON(data.triggers);

    return system;
  }
}
