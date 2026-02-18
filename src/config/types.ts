/**
 * @file config/types.ts
 * @description 配置系统类型定义
 * @author Ouroboros
 * @date 2026-02-18
 */

import type { ModelConfig, TokenBudget } from '@/types/model';
import type { HormoneType } from '@/types/hormone';

/**
 * 核心模块配置
 */
export interface CoreConfig {
  /** Agent 身份配置 */
  identity: {
    name: string;
    version: string;
    description: string;
    creator: string;
  };
  /** 自我描述更新频率(毫秒) */
  selfDescriptionIntervalMs: number;
  /** 认知状态衰减系数(0-1) */
  cognitiveDecayRate: number;
}

/**
 * 激素系统配置
 */
export interface HormoneConfig {
  /** 激素基础水平 */
  baselineLevels: Record<HormoneType, number>;
  /** 激素衰减率(每秒) */
  decayRates: Record<HormoneType, number>;
  /** 激素最大值 */
  maxLevels: Record<HormoneType, number>;
  /** 激素最小值 */
  minLevels: Record<HormoneType, number>;
  /** 更新间隔(毫秒) */
  updateIntervalMs: number;
  /** 触发器检查间隔(毫秒) */
  triggerCheckIntervalMs: number;
}

/**
 * 模型引擎配置
 */
export interface ModelEngineConfig {
  /** 默认模型配置 */
  defaultModel: ModelConfig;
  /** 备用模型配置（可选） */
  fallbackModel: ModelConfig | undefined;
  /** Token 预算配置 */
  tokenBudget: TokenBudget;
  /** 总 Token 预算 */
  totalTokenBudget: number;
  /** 重试次数 */
  maxRetries: number;
  /** 重试延迟(毫秒) */
  retryDelayMs: number;
  /** 性能监控记录数上限 */
  performanceMonitorMaxRecords: number;
}

/**
 * 记忆系统配置
 */
export interface MemoryConfig {
  /** 短期记忆容量 */
  shortTermCapacity: number;
  /** 长期记忆存储目录 */
  longTermStorageDir: string;
  /** 记忆巩固阈值 */
  consolidationThreshold: number;
  /** 遗忘系数(0-1) */
  forgettingRate: number;
  /** 最大记忆数量 */
  maxMemories: number;
  /** 自动归档天数 */
  autoArchiveDays: number;
  /** 向量存储配置 */
  vectorStore: {
    enabled: boolean;
    dimension: number;
    similarityThreshold: number;
  };
  /** 检索配置 */
  retrieval: {
    /** 默认返回记忆数量 */
    defaultLimit: number;
    /** 最大返回记忆数量 */
    maxLimit: number;
    /** 语义检索权重 */
    semanticWeight: number;
    /** 时间衰减权重 */
    temporalWeight: number;
    /** 重要性权重 */
    importanceWeight: number;
  };
}

/**
 * 工具系统配置
 */
export interface ToolConfig {
  /** 工具超时时间(毫秒) */
  timeoutMs: number;
  /** 工具置信度初始值 */
  initialConfidence: number;
  /** 工具置信度学习率 */
  confidenceLearningRate: number;
  /** 启用/禁用的工具列表 */
  enabledTools: string[];
  disabledTools: string[];
}

/**
 * 安全系统配置
 */
export interface SafetyConfig {
  /** 双思维验证启用 */
  dualMindEnabled: boolean;
  /** 硬件看门狗启用 */
  hardwareWatchdogEnabled: boolean;
  /** 身份锚定检查间隔(毫秒) */
  identityAnchorIntervalMs: number;
  /** 最大连续错误次数 */
  maxConsecutiveErrors: number;
  /** 哥德尔免疫启用 */
  godelImmunityEnabled: boolean;
}

/**
 * 进化系统配置
 */
export interface EvolutionConfig {
  /** 心跳间隔(毫秒) */
  heartbeatIntervalMs: number;
  /** 深度进化触发间隔(毫秒) */
  deepEvolutionIntervalMs: number;
  /** 自我反思触发阈值 */
  reflectionThreshold: number;
  /** A/B 测试启用 */
  abTestingEnabled: boolean;
  /** 学习队列最大长度 */
  learningQueueMaxSize: number;
}

/**
 * 日志配置
 */
export interface LogConfig {
  /** 日志级别 */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** 日志输出目录 */
  outputDir: string;
  /** 是否输出到控制台 */
  consoleOutput: boolean;
  /** 是否输出到文件 */
  fileOutput: boolean;
  /** 日志保留天数 */
  retentionDays: number;
}

/**
 * 适配器配置
 */
export interface AdapterConfig {
  /** Web 服务配置 */
  web: {
    enabled: boolean;
    port: number;
    host: string;
    corsOrigins: string[];
  };
  /** MCP 配置 */
  mcp: {
    enabled: boolean;
    serverName: string;
  };
  /** WebSocket 配置 */
  websocket: {
    enabled: boolean;
    port: number;
  };
}

/**
 * 完整配置
 */
export interface OuroborosConfig {
  /** 版本 */
  version: string;
  /** 核心模块 */
  core: CoreConfig;
  /** 激素系统 */
  hormone: HormoneConfig;
  /** 模型引擎 */
  model: ModelEngineConfig;
  /** 记忆系统 */
  memory: MemoryConfig;
  /** 工具系统 */
  tool: ToolConfig;
  /** 安全系统 */
  safety: SafetyConfig;
  /** 进化系统 */
  evolution: EvolutionConfig;
  /** 日志 */
  log: LogConfig;
  /** 适配器 */
  adapter: AdapterConfig;
}
