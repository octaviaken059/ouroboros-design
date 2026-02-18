/**
 * @file types/hormone.ts
 * @description 激素系统类型定义
 * @author Ouroboros
 * @date 2026-02-18
 *
 * 定义激素系统的所有核心类型和接口
 */

/**
 * 激素类型枚举
 */
export type HormoneType =
  | 'dopamine'      // 多巴胺 - 奖励、动机
  | 'serotonin'     // 血清素 - 情绪稳定、满足
  | 'cortisol'      // 皮质醇 - 压力、警觉
  | 'oxytocin'      // 催产素 - 信任、社交连接
  | 'norepinephrine'; // 去甲肾上腺素 - 专注、警觉

/**
 * 所有激素类型的数组
 */
export const HORMONE_TYPES: HormoneType[] = [
  'dopamine',
  'serotonin',
  'cortisol',
  'oxytocin',
  'norepinephrine',
];

/**
 * 激素配置接口
 */
export interface HormoneConfig {
  /** 基线水平 (0-1) */
  baseline: number;
  /** 衰减率 (每秒衰减量) */
  decayRate: number;
  /** 半衰期 (秒) */
  halfLife: number;
  /** 最大值 */
  maxValue: number;
  /** 最小值 */
  minValue: number;
}

/**
 * 激素状态接口
 */
export interface HormoneState {
  /** 当前值 (0-1) */
  value: number;
  /** 基线水平 */
  baseline: number;
  /** 衰减率 */
  decayRate: number;
  /** 最后更新时间 */
  lastUpdated: number;
}

/**
 * 完整激素配置集合
 */
export interface HormoneSystemConfig {
  /** 多巴胺配置 */
  dopamine: HormoneConfig;
  /** 血清素配置 */
  serotonin: HormoneConfig;
  /** 皮质醇配置 */
  cortisol: HormoneConfig;
  /** 催产素配置 */
  oxytocin: HormoneConfig;
  /** 去甲肾上腺素配置 */
  norepinephrine: HormoneConfig;
  /** 衰减检查间隔 (毫秒) */
  decayIntervalMs: number;
}

/**
 * 默认激素系统配置
 */
export const DEFAULT_HORMONE_CONFIG: HormoneSystemConfig = {
  dopamine: {
    baseline: 0.5,
    decayRate: 0.001,
    halfLife: 300, // 5分钟
    maxValue: 1.0,
    minValue: 0.0,
  },
  serotonin: {
    baseline: 0.6,
    decayRate: 0.0005,
    halfLife: 600, // 10分钟
    maxValue: 1.0,
    minValue: 0.0,
  },
  cortisol: {
    baseline: 0.2,
    decayRate: 0.002,
    halfLife: 180, // 3分钟
    maxValue: 1.0,
    minValue: 0.0,
  },
  oxytocin: {
    baseline: 0.4,
    decayRate: 0.0008,
    halfLife: 450, // 7.5分钟
    maxValue: 1.0,
    minValue: 0.0,
  },
  norepinephrine: {
    baseline: 0.3,
    decayRate: 0.003,
    halfLife: 120, // 2分钟
    maxValue: 1.0,
    minValue: 0.0,
  },
  decayIntervalMs: 1000, // 每秒检查一次
};

/**
 * 触发器类型枚举
 */
export type TriggerType =
  | 'task_success'      // 任务成功
  | 'task_failure'      // 任务失败
  | 'system_overload'   // 系统过载
  | 'security_threat'   // 安全威胁
  | 'novelty'           // 新奇事物
  | 'routine'           // 例行公事
  | 'social_interaction' // 社交互动
  | 'learning_opportunity' // 学习机会
  | 'error_occurred'    // 发生错误
  | 'goal_achieved';    // 达成目标

/**
 * 激素变化定义
 */
export interface HormoneChange {
  /** 激素类型 */
  hormone: HormoneType;
  /** 变化量 (可以是负数) */
  delta: number;
  /** 变化原因 */
  reason?: string;
}

/**
 * 触发器定义
 */
export interface Trigger {
  /** 触发器ID */
  id: string;
  /** 触发器类型 */
  type: TriggerType;
  /** 触发器名称 */
  name: string;
  /** 触发条件 */
  condition: TriggerCondition;
  /** 激素变化列表 */
  effects: HormoneChange[];
  /** 冷却时间 (毫秒) */
  cooldownMs: number;
  /** 最后触发时间 */
  lastFired?: number;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 触发条件类型
 */
export type TriggerCondition =
  | { type: 'immediate' }                          // 立即触发
  | { type: 'threshold'; hormone: HormoneType; min?: number; max?: number }  // 阈值条件
  | { type: 'time'; intervalMs: number }           // 时间间隔
  | { type: 'event'; eventName: string };          // 事件触发

/**
 * 情绪状态描述
 */
export interface EmotionalState {
  /** 主导情绪 */
  dominantEmotion: string;
  /** 情绪强度 (0-1) */
  intensity: number;
  /** 情绪描述文本 */
  description: string;
  /** 建议的行为 */
  suggestedAction?: string;
}

/**
 * 激素水平快照
 */
export interface HormoneSnapshot {
  /** 时间戳 */
  timestamp: number;
  /** 各激素水平 */
  levels: Record<HormoneType, number>;
  /** 主导激素 */
  dominantHormone: HormoneType;
  /** 平均唤醒水平 */
  averageArousal: number;
}
