/**
 * @file evolution/hormone/trigger-engine.ts
 * @description 触发器引擎 - 管理激素触发器
 * @author Ouroboros
 * @date 2026-02-18
 */

import type {
  Trigger,
  TriggerType,
  TriggerCondition,
  HormoneChange,
  HormoneType,
} from '@/types/hormone';
import { createContextLogger } from '@/utils/logger';
import { ValidationError } from '@/utils/error';
import { randomUUID } from 'crypto';

const logger = createContextLogger('TriggerEngine');

/**
 * 触发结果
 */
export interface TriggerResult {
  /** 是否成功触发 */
  fired: boolean;
  /** 触发的触发器ID */
  triggerId?: string;
  /** 应用的激素变化 */
  changes?: HormoneChange[];
  /** 失败原因 */
  reason?: string;
}

/**
 * 触发上下文
 */
export interface TriggerContext {
  /** 事件名称 */
  eventName?: string;
  /** 激素水平 */
  hormoneLevels?: Record<HormoneType, number>;
  /** 自定义数据 */
  data?: Record<string, unknown>;
}

/**
 * 触发器引擎类
 * 管理所有激素触发器的注册、评估和执行
 */
export class TriggerEngine {
  /** 触发器映射表 */
  private triggers: Map<string, Trigger> = new Map();
  /** 按类型索引的触发器 */
  private triggersByType: Map<TriggerType, Set<string>> = new Map();

  /**
   * 创建触发器引擎实例
   * 自动注册默认触发器
   */
  constructor() {
    this.registerDefaultTriggers();
    logger.info('触发器引擎初始化完成');
  }

  /**
   * 注册默认触发器
   */
  private registerDefaultTriggers(): void {
    // 任务成功触发器
    this.registerTrigger({
      id: randomUUID(),
      type: 'task_success',
      name: '任务成功',
      condition: { type: 'immediate' },
      effects: [
        { hormone: 'dopamine', delta: 0.3, reason: '任务完成' },
        { hormone: 'serotonin', delta: 0.2, reason: '成就感' },
      ],
      cooldownMs: 5000,
      enabled: true,
    });

    // 任务失败触发器
    this.registerTrigger({
      id: randomUUID(),
      type: 'task_failure',
      name: '任务失败',
      condition: { type: 'immediate' },
      effects: [
        { hormone: 'cortisol', delta: 0.25, reason: '挫败感' },
        { hormone: 'dopamine', delta: -0.1, reason: '动力下降' },
      ],
      cooldownMs: 5000,
      enabled: true,
    });

    // 系统过载触发器
    this.registerTrigger({
      id: randomUUID(),
      type: 'system_overload',
      name: '系统过载',
      condition: { type: 'immediate' },
      effects: [
        { hormone: 'cortisol', delta: 0.4, reason: '压力增加' },
        { hormone: 'norepinephrine', delta: 0.3, reason: '警觉提升' },
      ],
      cooldownMs: 30000,
      enabled: true,
    });

    // 安全威胁触发器
    this.registerTrigger({
      id: randomUUID(),
      type: 'security_threat',
      name: '安全威胁',
      condition: { type: 'immediate' },
      effects: [
        { hormone: 'cortisol', delta: 0.5, reason: '高压力' },
        { hormone: 'norepinephrine', delta: 0.4, reason: '高度警觉' },
        { hormone: 'oxytocin', delta: -0.2, reason: '不信任' },
      ],
      cooldownMs: 60000,
      enabled: true,
    });

    // 新奇事物触发器
    this.registerTrigger({
      id: randomUUID(),
      type: 'novelty',
      name: '新奇事物',
      condition: { type: 'immediate' },
      effects: [
        { hormone: 'dopamine', delta: 0.2, reason: '好奇心' },
        { hormone: 'norepinephrine', delta: 0.15, reason: '注意力集中' },
      ],
      cooldownMs: 10000,
      enabled: true,
    });

    // 例行公事触发器
    this.registerTrigger({
      id: randomUUID(),
      type: 'routine',
      name: '例行公事',
      condition: { type: 'immediate' },
      effects: [
        { hormone: 'serotonin', delta: 0.1, reason: '稳定感' },
        { hormone: 'dopamine', delta: -0.05, reason: '缺乏新鲜感' },
      ],
      cooldownMs: 60000,
      enabled: true,
    });

    // 社交互动触发器
    this.registerTrigger({
      id: randomUUID(),
      type: 'social_interaction',
      name: '社交互动',
      condition: { type: 'immediate' },
      effects: [
        { hormone: 'oxytocin', delta: 0.25, reason: '连接感' },
        { hormone: 'serotonin', delta: 0.15, reason: '满足感' },
      ],
      cooldownMs: 5000,
      enabled: true,
    });

    // 学习机会触发器
    this.registerTrigger({
      id: randomUUID(),
      type: 'learning_opportunity',
      name: '学习机会',
      condition: { type: 'immediate' },
      effects: [
        { hormone: 'dopamine', delta: 0.25, reason: '学习动力' },
        { hormone: 'norepinephrine', delta: 0.1, reason: '专注' },
      ],
      cooldownMs: 10000,
      enabled: true,
    });

    // 错误发生触发器
    this.registerTrigger({
      id: randomUUID(),
      type: 'error_occurred',
      name: '发生错误',
      condition: { type: 'immediate' },
      effects: [
        { hormone: 'cortisol', delta: 0.2, reason: '焦虑' },
        { hormone: 'norepinephrine', delta: 0.15, reason: '警觉' },
      ],
      cooldownMs: 3000,
      enabled: true,
    });

    // 目标达成触发器
    this.registerTrigger({
      id: randomUUID(),
      type: 'goal_achieved',
      name: '目标达成',
      condition: { type: 'immediate' },
      effects: [
        { hormone: 'dopamine', delta: 0.4, reason: '大奖励' },
        { hormone: 'serotonin', delta: 0.3, reason: '满足感' },
        { hormone: 'oxytocin', delta: 0.1, reason: '自我认同' },
      ],
      cooldownMs: 5000,
      enabled: true,
    });
  }

  /**
   * 注册触发器
   * @param trigger 触发器定义
   * @returns 触发器ID
   * @throws ValidationError 如果触发器无效
   */
  registerTrigger(trigger: Omit<Trigger, 'id'> & { id?: string }): string {
    try {
      // 验证触发器
      if (!trigger.name || trigger.name.trim() === '') {
        throw new ValidationError('触发器名称不能为空');
      }

      if (!trigger.effects || trigger.effects.length === 0) {
        throw new ValidationError('触发器必须至少有一个效果');
      }

      // 验证激素变化
      for (const effect of trigger.effects) {
        if (effect.delta < -1 || effect.delta > 1) {
          throw new ValidationError(
            '激素变化量必须在 -1 到 1 之间',
            { hormone: effect.hormone, delta: effect.delta }
          );
        }
      }

      const id = trigger.id || randomUUID();
      const fullTrigger: Trigger = { ...trigger, id };

      this.triggers.set(id, fullTrigger);

      // 按类型索引
      if (!this.triggersByType.has(fullTrigger.type)) {
        this.triggersByType.set(fullTrigger.type, new Set());
      }
      this.triggersByType.get(fullTrigger.type)!.add(id);

      logger.info('触发器已注册', {
        id,
        type: fullTrigger.type,
        name: fullTrigger.name,
        effects: fullTrigger.effects.length,
      });

      return id;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 注销触发器
   * @param id 触发器ID
   * @returns 是否成功
   */
  unregisterTrigger(id: string): boolean {
    const trigger = this.triggers.get(id);
    if (!trigger) {
      logger.warn('尝试注销不存在的触发器', { id });
      return false;
    }

    this.triggers.delete(id);
    this.triggersByType.get(trigger.type)?.delete(id);

    logger.info('触发器已注销', { id, name: trigger.name });
    return true;
  }

  /**
   * 获取触发器
   * @param id 触发器ID
   * @returns 触发器或undefined
   */
  getTrigger(id: string): Trigger | undefined {
    return this.triggers.get(id);
  }

  /**
   * 获取所有触发器
   * @returns 触发器列表
   */
  getAllTriggers(): Trigger[] {
    return Array.from(this.triggers.values());
  }

  /**
   * 获取指定类型的触发器
   * @param type 触发器类型
   * @returns 触发器列表
   */
  getTriggersByType(type: TriggerType): Trigger[] {
    const ids = this.triggersByType.get(type);
    if (!ids) return [];

    return Array.from(ids)
      .map(id => this.triggers.get(id)!)
      .filter(Boolean);
  }

  /**
   * 启用触发器
   * @param id 触发器ID
   * @returns 是否成功
   */
  enableTrigger(id: string): boolean {
    const trigger = this.triggers.get(id);
    if (!trigger) return false;

    trigger.enabled = true;
    logger.info('触发器已启用', { id, name: trigger.name });
    return true;
  }

  /**
   * 禁用触发器
   * @param id 触发器ID
   * @returns 是否成功
   */
  disableTrigger(id: string): boolean {
    const trigger = this.triggers.get(id);
    if (!trigger) return false;

    trigger.enabled = false;
    logger.info('触发器已禁用', { id, name: trigger.name });
    return true;
  }

  /**
   * 评估条件
   * @param condition 条件
   * @param context 上下文
   * @returns 是否满足条件
   */
  private evaluateCondition(
    condition: TriggerCondition,
    context: TriggerContext
  ): boolean {
    switch (condition.type) {
      case 'immediate':
        return true;

      case 'threshold': {
        const level = context.hormoneLevels?.[condition.hormone];
        if (level === undefined) return false;

        if (condition.min !== undefined && level < condition.min) {
          return false;
        }
        if (condition.max !== undefined && level > condition.max) {
          return false;
        }
        return true;
      }

      case 'event':
        return context.eventName === condition.eventName;

      case 'time':
        // 时间触发器需要外部调度，这里总是返回true
        return true;

      default:
        return false;
    }
  }

  /**
   * 检查冷却时间
   * @param trigger 触发器
   * @returns 是否可以触发
   */
  private checkCooldown(trigger: Trigger): boolean {
    if (!trigger.lastFired) return true;

    const elapsed = Date.now() - trigger.lastFired;
    return elapsed >= trigger.cooldownMs;
  }

  /**
   * 触发特定类型的触发器
   * @param type 触发器类型
   * @param context 上下文
   * @returns 触发结果列表
   */
  fire(type: TriggerType, context: TriggerContext = {}): TriggerResult[] {
    const results: TriggerResult[] = [];
    const triggers = this.getTriggersByType(type);

    for (const trigger of triggers) {
      const result = this.fireTrigger(trigger, context);
      results.push(result);
    }

    return results;
  }

  /**
   * 触发单个触发器
   * @param trigger 触发器
   * @param context 上下文
   * @returns 触发结果
   */
  private fireTrigger(
    trigger: Trigger,
    context: TriggerContext
  ): TriggerResult {
    // 检查是否启用
    if (!trigger.enabled) {
      return { fired: false, triggerId: trigger.id, reason: '触发器已禁用' };
    }

    // 检查冷却时间
    if (!this.checkCooldown(trigger)) {
      const remaining = trigger.lastFired
        ? trigger.cooldownMs - (Date.now() - trigger.lastFired)
        : 0;
      return {
        fired: false,
        triggerId: trigger.id,
        reason: `冷却中，还剩 ${remaining}ms`,
      };
    }

    // 评估条件
    if (!this.evaluateCondition(trigger.condition, context)) {
      return {
        fired: false,
        triggerId: trigger.id,
        reason: '条件不满足',
      };
    }

    // 触发成功
    trigger.lastFired = Date.now();

    logger.info('触发器已触发', {
      id: trigger.id,
      name: trigger.name,
      type: trigger.type,
      effects: trigger.effects.length,
    });

    return {
      fired: true,
      triggerId: trigger.id,
      changes: trigger.effects,
    };
  }

  /**
   * 序列化为JSON
   * @returns 序列化数据
   */
  toJSON(): object {
    return {
      triggers: Array.from(this.triggers.values()),
    };
  }

  /**
   * 从JSON恢复
   * @param data 序列化数据
   * @returns TriggerEngine实例
   */
  static fromJSON(data: { triggers: Trigger[] }): TriggerEngine {
    const engine = new TriggerEngine();
    engine.triggers.clear();
    engine.triggersByType.clear();

    for (const trigger of data.triggers) {
      engine.triggers.set(trigger.id, trigger);

      if (!engine.triggersByType.has(trigger.type)) {
        engine.triggersByType.set(trigger.type, new Set());
      }
      engine.triggersByType.get(trigger.type)!.add(trigger.id);
    }

    return engine;
  }
}
