/**
 * @file evolution/hormone/hormone-engine.ts
 * @description 激素引擎 - 管理单个激素的状态和衰减
 * @author Ouroboros
 * @date 2026-02-18
 */

import type {
  HormoneType,
  HormoneConfig,
  HormoneState,
} from '@/types/hormone';
import { createContextLogger } from '@/utils/logger';
import { ValidationError } from '@/utils/error';

const logger = createContextLogger('HormoneEngine');

/**
 * 激素引擎类
 * 管理单个激素的状态、衰减和更新
 */
export class HormoneEngine {
  /** 激素类型 */
  readonly type: HormoneType;
  /** 当前状态 */
  private state: HormoneState;
  /** 配置 */
  private config: HormoneConfig;

  /**
   * 创建激素引擎实例
   * @param type 激素类型
   * @param config 激素配置
   */
  constructor(type: HormoneType, config: HormoneConfig) {
    this.type = type;
    this.config = { ...config };
    this.state = {
      value: config.baseline,
      baseline: config.baseline,
      decayRate: config.decayRate,
      lastUpdated: Date.now(),
    };

    logger.info(`${this.getChineseName()}引擎初始化完成`, {
      type,
      baseline: config.baseline,
    });
  }

  /**
   * 获取激素中文名称
   * @returns 中文名称
   */
  private getChineseName(): string {
    const names: Record<HormoneType, string> = {
      dopamine: '多巴胺',
      serotonin: '血清素',
      cortisol: '皮质醇',
      oxytocin: '催产素',
      norepinephrine: '去甲肾上腺素',
    };
    return names[this.type];
  }

  /**
   * 获取当前激素值
   * @returns 当前值 (0-1)
   */
  getValue(): number {
    this.applyNaturalDecay();
    return this.state.value;
  }

  /**
   * 获取完整状态
   * @returns 状态副本
   */
  getState(): HormoneState {
    this.applyNaturalDecay();
    return { ...this.state };
  }

  /**
   * 增加激素水平
   * @param amount 增加量 (0-1)
   * @param reason 原因
   * @returns 增加后的值
   * @throws ValidationError 如果amount无效
   */
  increase(amount: number, reason?: string): number {
    try {
      if (amount < 0 || amount > 1) {
        throw new ValidationError(
          '增加量必须在 0-1 之间',
          { hormone: this.type, amount }
        );
      }

      this.applyNaturalDecay();
      const oldValue = this.state.value;
      this.state.value = Math.min(
        this.config.maxValue,
        this.state.value + amount
      );
      this.state.lastUpdated = Date.now();

      logger.debug(`${this.getChineseName()}增加`, {
        oldValue: oldValue.toFixed(3),
        newValue: this.state.value.toFixed(3),
        amount: amount.toFixed(3),
        reason,
      });

      return this.state.value;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 减少激素水平
   * @param amount 减少量 (0-1)
   * @param reason 原因
   * @returns 减少后的值
   * @throws ValidationError 如果amount无效
   */
  decrease(amount: number, reason?: string): number {
    try {
      if (amount < 0 || amount > 1) {
        throw new ValidationError(
          '减少量必须在 0-1 之间',
          { hormone: this.type, amount }
        );
      }

      this.applyNaturalDecay();
      const oldValue = this.state.value;
      this.state.value = Math.max(
        this.config.minValue,
        this.state.value - amount
      );
      this.state.lastUpdated = Date.now();

      logger.debug(`${this.getChineseName()}减少`, {
        oldValue: oldValue.toFixed(3),
        newValue: this.state.value.toFixed(3),
        amount: amount.toFixed(3),
        reason,
      });

      return this.state.value;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 设置激素水平
   * @param value 目标值 (0-1)
   * @param reason 原因
   * @returns 设置后的值
   * @throws ValidationError 如果value无效
   */
  setValue(value: number, reason?: string): number {
    try {
      if (value < 0 || value > 1) {
        throw new ValidationError(
          '激素水平必须在 0-1 之间',
          { hormone: this.type, value }
        );
      }

      const oldValue = this.state.value;
      this.state.value = Math.max(
        this.config.minValue,
        Math.min(this.config.maxValue, value)
      );
      this.state.lastUpdated = Date.now();

      logger.debug(`${this.getChineseName()}设置`, {
        oldValue: oldValue.toFixed(3),
        newValue: this.state.value.toFixed(3),
        reason,
      });

      return this.state.value;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 应用自然衰减
   * 基于时间差计算衰减量
   */
  applyNaturalDecay(): void {
    const now = Date.now();
    const deltaTime = (now - this.state.lastUpdated) / 1000; // 转换为秒

    if (deltaTime <= 0) return;

    // 计算衰减量
    const decayAmount = this.config.decayRate * deltaTime;

    // 向基线衰减
    if (this.state.value > this.state.baseline) {
      this.state.value = Math.max(
        this.state.baseline,
        this.state.value - decayAmount
      );
    } else if (this.state.value < this.state.baseline) {
      this.state.value = Math.min(
        this.state.baseline,
        this.state.value + decayAmount * 0.5 // 恢复较慢
      );
    }

    this.state.lastUpdated = now;
  }

  /**
   * 重置为基线水平
   * @param reason 原因
   */
  resetToBaseline(reason?: string): void {
    const oldValue = this.state.value;
    this.state.value = this.state.baseline;
    this.state.lastUpdated = Date.now();

    logger.info(`${this.getChineseName()}重置为基线`, {
      oldValue: oldValue.toFixed(3),
      baseline: this.state.baseline,
      reason,
    });
  }

  /**
   * 获取当前偏离基线的程度
   * @returns 偏离程度 (-1 到 1, 正值表示高于基线)
   */
  getDeviation(): number {
    return this.getValue() - this.state.baseline;
  }

  /**
   * 序列化为JSON
   * @returns 序列化数据
   */
  toJSON(): object {
    return {
      type: this.type,
      state: { ...this.state },
      config: { ...this.config },
    };
  }

  /**
   * 从JSON恢复
   * @param data 序列化数据
   * @returns HormoneEngine实例
   */
  static fromJSON(data: {
    type: HormoneType;
    state: HormoneState;
    config: HormoneConfig;
  }): HormoneEngine {
    const engine = new HormoneEngine(data.type, data.config);
    engine.state = { ...data.state };
    return engine;
  }
}
