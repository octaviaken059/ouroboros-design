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
 * 提示词系统配置
 */
export interface PromptsConfig {
  /** 系统提示词 */
  system: {
    template: string;
    readOnly: boolean;
  };
  /** 自我提示词 */
  self: {
    identityTemplate: string;
    capabilityTemplate: string;
    stateTemplate: string;
    optimizable: boolean;
  };
  /** 记忆提示词 */
  memory: {
    maxContextMemories: number;
    includeRecentConversation: boolean;
    includeRelevantFacts: boolean;
    dynamicAssembly: boolean;
  };
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
    provider: 'ollama' | 'openai' | 'none';
    model: string;
    dimension: number;
    baseUrl: string;
    similarityThreshold: number;
    maxResults: number;
  };
  /** 检索配置 */
  retrieval: {
    defaultLimit: number;
    maxLimit: number;
    semanticWeight: number;
    temporalWeight: number;
    importanceWeight: number;
    keywordSearchEnabled: boolean;
    vectorSearchEnabled: boolean;
  };
  /** 导入导出配置 */
  importExport: {
    allowedFormats: string[];
    maxExportSize: number;
    includeEmbeddings: boolean;
  };
}

/**
 * 身体图式配置
 */
export interface BodySchemaConfig {
  sensors: {
    enabled: string[];
    updateIntervalMs: number;
    filesystem: {
      watchPaths: string[];
      maxDepth: number;
    };
    network: {
      checkConnectivity: boolean;
      monitorInterfaces: boolean;
    };
    process: {
      monitorSelf: boolean;
      checkIntervalMs: number;
    };
    system_resources: {
      cpuThreshold: number;
      memoryThreshold: number;
      diskThreshold: number;
    };
  };
  actuators: {
    enabled: string[];
    timeoutMs: number;
    maxConcurrent: number;
    file_write: {
      allowedPaths: string[];
      maxFileSize: number;
    };
    exec_command: {
      allowedCommands: string[];
      blockedPatterns: string[];
    };
    http_request: {
      timeoutMs: number;
      maxRedirects: number;
      allowedProtocols: string[];
    };
  };
  resourceMonitor: {
    enabled: boolean;
    checkIntervalMs: number;
    alertThresholds: {
      cpu: number;
      memory: number;
      disk: number;
    };
  };
}

/**
 * 世界模型配置
 */
export interface WorldModelConfig {
  patternRecognition: {
    enabled: boolean;
    minConfidence: number;
    maxPatterns: number;
  };
  riskManagement: {
    enabled: boolean;
    autoEscalate: boolean;
    maxActiveRisks: number;
  };
  opportunityDetection: {
    enabled: boolean;
    minPotential: number;
    maxOpportunities: number;
  };
}

/**
 * 工具系统配置
 */
export interface ToolConfig {
  discovery: {
    enabled: boolean;
    scanIntervalMs: number;
    scanPaths: string[];
    mcpServers: {
      enabled: boolean;
      configPath: string;
    };
  };
  confidence: {
    initialValue: number;
    learningRate: number;
    minConfidence: number;
    maxConfidence: number;
  };
  timeoutMs: number;
  enabledTools: string[];
  disabledTools: string[];
}

/**
 * 技能系统配置
 */
export interface SkillsConfig {
  mastery: {
    noviceThreshold: number;
    intermediateThreshold: number;
    advancedThreshold: number;
    expertThreshold: number;
  };
  learning: {
    successXpGain: number;
    failureXpGain: number;
    complexityMultiplier: number;
  };
}

/**
 * 安全系统配置
 */
export interface SafetyConfig {
  dualMindEnabled: boolean;
  hardwareWatchdogEnabled: boolean;
  identityAnchorIntervalMs: number;
  maxConsecutiveErrors: number;
  godelImmunityEnabled: boolean;
  selfReferenceProtection: {
    codeModificationRequiresApproval: boolean;
    maxModificationSize: number;
    blockedPatterns: string[];
  };
}

/**
 * 进化系统配置
 */
export interface EvolutionConfig {
  heartbeatIntervalMs: number;
  deepEvolutionIntervalMs: number;
  reflectionThreshold: number;
  abTesting: {
    enabled: boolean;
    minSamples: number;
    confidenceLevel: number;
    maxConcurrentTests: number;
  };
  learningQueueMaxSize: number;
}

/**
 * 反思引擎配置
 */
export interface ReflectionConfig {
  enabled: boolean;
  mode: 'auto' | 'conservative' | 'human' | 'semi_autonomous';
  scheduleIntervalMs: number;
  performanceThreshold: number;
  maxInsights: number;
  autoExecuteLowRisk: boolean;
  triggers: {
    scheduled: boolean;
    performanceDrop: boolean;
    anomalyDetected: boolean;
    toolDiscovered: boolean;
    userRequest: boolean;
  };
}

/**
 * 日志配置
 */
export interface LogConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  outputDir: string;
  consoleOutput: boolean;
  fileOutput: boolean;
  retentionDays: number;
  errorMonitoring: {
    enabled: boolean;
    alertThreshold: number;
    alertIntervalMs: number;
  };
}

/**
 * 适配器配置
 */
export interface AdapterConfig {
  web: {
    enabled: boolean;
    port: number;
    host: string;
    corsOrigins: string[];
    dashboardRefreshIntervalMs: number;
    /** 调试页面配置 */
    debug: {
      /** 是否启用调试功能 */
      enabled: boolean;
      /** 是否记录提示词调试信息 */
      recordPrompts: boolean;
      /** 调试信息保留数量 */
      maxHistory: number;
    };
    /** Think 模式配置 */
    think?: {
      /** 是否启用 think 模式 */
      enabled: boolean;
      /** think 标签分隔符 */
      separator: string;
      /** 显示模式: collapsible/inline */
      displayMode: string;
    };
    /** 聊天界面配置 */
    chat?: {
      /** 是否启用 Markdown 渲染 */
      markdownEnabled: boolean;
      /** 是否使用浅色主题 */
      lightTheme: boolean;
      /** 是否启用代码高亮 */
      codeHighlighting: boolean;
    };
  };
  mcp: {
    enabled: boolean;
    serverName: string;
  };
  websocket: {
    enabled: boolean;
    port: number;
  };
}

/**
 * 完整配置
 */
export interface OuroborosConfig {
  version: string;
  core: CoreConfig;
  hormone: HormoneConfig;
  prompts: PromptsConfig;
  model: ModelEngineConfig;
  memory: MemoryConfig;
  bodySchema: BodySchemaConfig;
  worldModel: WorldModelConfig;
  tool: ToolConfig;
  skills: SkillsConfig;
  safety: SafetyConfig;
  evolution: EvolutionConfig;
  reflection: ReflectionConfig;
  log: LogConfig;
  adapter: AdapterConfig;
}
