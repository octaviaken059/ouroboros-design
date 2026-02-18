/**
 * @file types/index.ts
 * @description Ouroboros 核心类型定义
 * @author Ouroboros
 * @date 2026-02-18
 *
 * 本文件定义系统的所有核心接口和类型
 * 包括：Identity、Body、WorldModel、CognitiveState、Tool、Memory 等
 */

// ============================================================================
// 基础类型
// ============================================================================

/** 唯一标识符 */
export type UUID = string;

/** 时间戳（ISO 8601 格式） */
export type Timestamp = string;

/** 资源单位 */
export type Bytes = number;
export type Milliseconds = number;
export type Percentage = number; // 0-1

// ============================================================================
// Identity - 身份认知
// ============================================================================

/**
 * 身份信息
 * 描述 Agent 的基本身份属性
 */
export interface Identity {
  /** 唯一标识符 */
  id: UUID;
  /** 名称 */
  name: string;
  /** 版本号（语义化版本） */
  version: string;
  /** 进化阶段 */
  evolutionStage: 'newborn' | 'learning' | 'practicing' | 'mastering' | 'transcending';
  /** 创建时间 */
  createdAt: Timestamp;
  /** 描述 */
  description: string;
}

/**
 * 身份配置
 */
export interface IdentityConfig {
  name: string;
  version: string;
  description: string;
}

// ============================================================================
// Body - 身体图式
// ============================================================================

/**
 * 传感器
 * 感知外部世界的接口
 */
export interface Sensor {
  /** 传感器名称 */
  name: string;
  /** 传感器类型 */
  type: 'filesystem' | 'network' | 'process' | 'time' | 'resource' | 'custom';
  /** 当前状态 */
  status: 'active' | 'inactive' | 'error';
  /** 最后更新时间 */
  lastUpdate: Timestamp;
  /** 元数据 */
  metadata: Record<string, unknown>;
}

/**
 * 执行器
 * 对外部世界施加影响的接口
 */
export interface Actuator {
  /** 执行器名称 */
  name: string;
  /** 执行器类型 */
  type: 'file_write' | 'exec_command' | 'http_request' | 'websocket' | 'custom';
  /** 当前状态 */
  status: 'ready' | 'busy' | 'error';
  /** 最后使用时间 */
  lastUsed?: Timestamp;
}

/**
 * 系统资源状态
 */
export interface ResourceStatus {
  /** CPU 信息 */
  cpu: {
    /** 核心数 */
    cores: number;
    /** 使用率 (0-1) */
    usage: Percentage;
    /** 负载平均值 [1min, 5min, 15min] */
    loadAverage: [number, number, number];
  };
  /** 内存信息 */
  memory: {
    /** 总内存（字节） */
    total: Bytes;
    /** 已使用（字节） */
    used: Bytes;
    /** 使用率 (0-1) */
    usage: Percentage;
  };
  /** 磁盘信息 */
  disk: {
    /** 总容量（字节） */
    total: Bytes;
    /** 已使用（字节） */
    used: Bytes;
    /** 使用率 (0-1) */
    usage: Percentage;
  };
  /** 网络信息 */
  network: {
    /** 是否在线 */
    online: boolean;
    /** 接口列表 */
    interfaces: {
      name: string;
      address: string;
      family: 'IPv4' | 'IPv6';
    }[];
  };
  /** 运行时间（毫秒） */
  uptime: Milliseconds;
}

/**
 * 身体图式
 * 完整的身体状态描述
 */
export interface Body {
  /** 传感器列表 */
  sensors: Sensor[];
  /** 执行器列表 */
  actuators: Actuator[];
  /** 资源状态 */
  resources: ResourceStatus;
  /** 平台信息 */
  platform: {
    os: string;
    arch: string;
    nodeVersion: string;
  };
}

// ============================================================================
// WorldModel - 世界模型
// ============================================================================

/**
 * 模式
 * 从经验中发现的规律
 */
export interface Pattern {
  id: UUID;
  /** 模式描述 */
  description: string;
  /** 置信度 (0-1) */
  confidence: Percentage;
  /** 观察次数 */
  observations: number;
  /** 创建时间 */
  createdAt: Timestamp;
  /** 最后验证时间 */
  lastVerified?: Timestamp;
}

/**
 * 风险
 * 潜在的问题或威胁
 */
export interface Risk {
  id: UUID;
  /** 风险描述 */
  description: string;
  /** 严重程度 */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** 概率 (0-1) */
  probability: Percentage;
  /** 是否活跃 */
  active: boolean;
  /** 创建时间 */
  createdAt: Timestamp;
  /** 解决时间 */
  resolvedAt?: Timestamp;
}

/**
 * 机会
 * 潜在的有利情况
 */
export interface Opportunity {
  id: UUID;
  /** 机会描述 */
  description: string;
  /** 潜在价值 (0-1) */
  potential: Percentage;
  /** 可行性 (0-1) */
  feasibility: Percentage;
  /** 是否活跃 */
  active: boolean;
  /** 创建时间 */
  createdAt: Timestamp;
}

/**
 * 能力评估
 */
export interface CapabilityAssessment {
  /** 强项 */
  strengths: string[];
  /** 弱项 */
  weaknesses: string[];
  /** 学习中的能力 */
  learning: string[];
}

/**
 * 世界模型
 */
export interface WorldModel {
  /** 已识别的模式 */
  patterns: Pattern[];
  /** 活跃风险 */
  risks: Risk[];
  /** 活跃机会 */
  opportunities: Opportunity[];
  /** 能力评估 */
  capabilities: CapabilityAssessment;
}

// ============================================================================
// CognitiveState - 认知状态
// ============================================================================

/**
 * 激素水平
 * 模拟神经内分泌调节
 */
export interface HormoneLevels {
  /** 肾上腺素：警觉/紧急响应 */
  adrenaline: Percentage;
  /** 皮质醇：压力/资源紧张 */
  cortisol: Percentage;
  /** 多巴胺：奖励/学习动力 */
  dopamine: Percentage;
  /** 血清素：稳定/情绪调节 */
  serotonin: Percentage;
  /** 好奇心：探索/学习欲望 */
  curiosity: Percentage;
}

/**
 * 工作模式
 */
export type AgentMode = 'serving' | 'evolving' | 'reflection' | 'maintenance';

/**
 * 目标
 */
export interface Goal {
  id: UUID;
  /** 目标描述 */
  description: string;
  /** 优先级 */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** 进度 (0-1) */
  progress: Percentage;
  /** 创建时间 */
  createdAt: Timestamp;
  /** 截止时间 */
  deadline?: Timestamp;
  /** 是否完成 */
  completed: boolean;
}

/**
 * 认知状态
 */
export interface CognitiveState {
  /** 激素水平 */
  hormoneLevels: HormoneLevels;
  /** 当前模式 */
  mode: AgentMode;
  /** 当前目标 */
  currentGoal?: Goal;
  /** 目标队列 */
  goals: Goal[];
  /** 专注度 (0-1) */
  focus: Percentage;
  /** 最后更新时间 */
  lastUpdate: Timestamp;
}

// ============================================================================
// Tool - 工具
// ============================================================================

/**
 * 工具定义
 */
export interface Tool {
  id: UUID;
  /** 工具名称 */
  name: string;
  /** 工具类型 */
  type: 'cli' | 'api' | 'mcp' | 'builtin';
  /** 分类路径 */
  category: string;
  /** 描述 */
  description: string;
  /** 能力列表 */
  capabilities: string[];
  /** 置信度 (0-1) */
  confidence: Percentage;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failureCount: number;
  /** 状态 */
  status: 'available' | 'unavailable' | 'error';
  /** 加载优先级 */
  priority: 'critical' | 'high' | 'medium' | 'low' | 'on_demand';
}

// ============================================================================
// Memory - 记忆
// ============================================================================

/**
 * 记忆类型
 */
export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'reflective';

/**
 * 基础记忆接口
 */
export interface BaseMemory {
  id: UUID;
  type: MemoryType;
  content: unknown;
  timestamp: Timestamp;
  importance: number; // 0-1
  embedding?: number[];
  metadata: Record<string, unknown>;
}

/**
 * 情景记忆：事件和对话
 */
export interface EpisodicMemory extends BaseMemory {
  type: 'episodic';
  content: {
    event: string;
    context?: string;
    outcome?: string;
  };
}

/**
 * 语义记忆：知识和事实
 */
export interface SemanticMemory extends BaseMemory {
  type: 'semantic';
  content: {
    fact: string;
    key?: string;
    value?: unknown;
    confidence: Percentage;
  };
}

/**
 * 程序记忆：技能和流程
 */
export interface ProceduralMemory extends BaseMemory {
  type: 'procedural';
  content: {
    skill: string;
    steps: string[];
    successRate: Percentage;
  };
}

/**
 * 反思记忆：洞察和模式
 */
export interface ReflectiveMemory extends BaseMemory {
  type: 'reflective';
  content: {
    insight: string;
    source: string;
    confidence: Percentage;
  };
}

/**
 * 记忆联合类型
 */
export type Memory = EpisodicMemory | SemanticMemory | ProceduralMemory | ReflectiveMemory;

// ============================================================================
// 配置类型
// ============================================================================

/**
 * Token 预算配置
 */
export interface TokenBudgetConfig {
  /** 系统提示词占比 */
  system: Percentage;
  /** 自我描述占比 */
  self: Percentage;
  /** 记忆占比 */
  memory: Percentage;
  /** 用户输入预留占比 */
  user: Percentage;
  /** 最大总 Token 数 */
  maxTotalTokens: number;
}

/**
 * 自我进化配置
 */
export interface SelfEvolutionConfig {
  enabled: boolean;
  mode: 'manual' | 'semi_autonomous' | 'fully_autonomous';
  softSelfReference: {
    enabled: boolean;
    maxContextWindow: number;
    autoOptimize: boolean;
  };
  hardSelfReference: {
    enabled: boolean;
    requireHumanApproval: boolean;
    sandboxTimeout: number;
  };
  abTesting: {
    enabled: boolean;
    minSamples: number;
  };
}

/**
 * 安全配置
 */
export interface SafetyConfig {
  enableGodelImmunity: boolean;
  enableDualMind: boolean;
  enableIdentityAnchor: boolean;
  autoRollbackThreshold: Percentage;
}

/**
 * 主配置
 */
export interface AgentConfig {
  identity: IdentityConfig;
  promptBudget: TokenBudgetConfig;
  selfEvolution: SelfEvolutionConfig;
  safety: SafetyConfig;
}

// ============================================================================
// 错误类型
// ============================================================================

/**
 * Ouroboros 错误代码
 */
export type ErrorCode =
  | 'CONFIG_ERROR'
  | 'VALIDATION_ERROR'
  | 'MEMORY_ERROR'
  | 'TOOL_ERROR'
  | 'MODEL_ERROR'
  | 'REFLECTION_ERROR'
  | 'EVOLUTION_ERROR'
  | 'SAFETY_ERROR'
  | 'UNKNOWN_ERROR';

// 注意：OuroborosError 类在 utils/error.ts 中定义，这里不重复定义接口

// ============================================================================
// 事件类型
// ============================================================================

/**
 * 基础事件
 */
export interface BaseEvent {
  id: UUID;
  type: string;
  timestamp: Timestamp;
  payload: unknown;
}

/**
 * 激素变化事件
 */
export interface HormoneChangeEvent extends BaseEvent {
  type: 'hormone:change';
  payload: {
    hormone: keyof HormoneLevels;
    oldValue: Percentage;
    newValue: Percentage;
    reason: string;
  };
}

/**
 * 记忆记录事件
 */
export interface MemoryRecordEvent extends BaseEvent {
  type: 'memory:record';
  payload: {
    memoryId: UUID;
    memoryType: MemoryType;
  };
}

/**
 * 工具使用事件
 */
export interface ToolUseEvent extends BaseEvent {
  type: 'tool:use';
  payload: {
    toolId: UUID;
    toolName: string;
    success: boolean;
    duration: Milliseconds;
  };
}

/**
 * 反思完成事件
 */
export interface ReflectionCompleteEvent extends BaseEvent {
  type: 'reflection:complete';
  payload: {
    reflectionId: UUID;
    insightsCount: number;
    changesCount: number;
  };
}

/**
 * 事件联合类型
 */
export type AgentEvent =
  | HormoneChangeEvent
  | MemoryRecordEvent
  | ToolUseEvent
  | ReflectionCompleteEvent;

// 导出模型类型
export * from './model';
export * from './hormone';
