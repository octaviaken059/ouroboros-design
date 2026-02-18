/**
 * Ouroboros - 配置管理系统
 * 🐍⭕ 基于Zod的配置验证、加载和管理
 * 
 * @version 2.0.0
 * @module config
 */

import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  AgentMode,
  EmbeddingProvider,
  VectorStoreBackend,
  LogLevel,
  HealthStatus,
  MemoryLayer,
  HormoneType,
  ExplorationStrategy,
  ForgettingStrategy,
  type GlobalConfig,
  type ConfigLoadOptions,
  type DeepPartial,
} from '../types.js';

// ============================================================================
// Zod Schema 定义
// ============================================================================

/**
 * JSON值Schema
 */
const JSONValueSchema: z.ZodType = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.record(JSONValueSchema),
    z.array(JSONValueSchema),
  ])
);

/**
 * 元数据Schema
 */
const MetadataSchema = z.object({
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  version: z.number().int().nonnegative().default(1),
  tags: z.array(z.string()).optional(),
  properties: z.record(JSONValueSchema).optional(),
});

/**
 * 重试策略Schema
 */
const RetryPolicySchema = z.object({
  maxRetries: z.number().int().min(0).max(10).default(3),
  backoff: z.enum(['fixed', 'linear', 'exponential']).default('exponential'),
  initialDelay: z.number().int().min(100).default(1000),
  maxDelay: z.number().int().min(1000).default(30000),
  retryableErrors: z.array(z.string()).default([]),
});

/**
 * 优先级队列配置Schema
 */
const PriorityQueueConfigSchema = z.object({
  capacity: z.number().int().positive().default(10000),
  priorityInheritance: z.boolean().default(false),
  preemption: z.boolean().default(false),
  starvationThreshold: z.number().min(0).max(1).default(0.8),
});

/**
 * 反射触发条件Schema
 */
const ReflectionTriggerSchema = z.object({
  type: z.enum(['time', 'event', 'error_rate', 'uncertainty']),
  threshold: z.number().min(0).max(1),
  cooldown: z.number().int().positive().default(60000),
});

/**
 * 反射任务配置Schema
 */
const ReflectionTaskConfigSchema = z.object({
  enabled: z.boolean().default(true),
  interval: z.number().int().positive().default(300000),
  minInterval: z.number().int().positive().default(60000),
  maxDepth: z.number().int().positive().default(3),
  triggers: z.array(ReflectionTriggerSchema).default([
    { type: 'error_rate', threshold: 0.3, cooldown: 300000 },
    { type: 'uncertainty', threshold: 0.7, cooldown: 600000 },
  ]),
});

/**
 * 后台任务配置Schema
 */
const BackgroundTaskConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxConcurrent: z.number().int().positive().default(5),
  interval: z.number().int().positive().default(5000),
  allowedTypes: z.array(z.string()).default(['reflection', 'exploration', 'maintenance']),
});

/**
 * 探索任务配置Schema
 */
const ExplorationTaskConfigSchema = z.object({
  enabled: z.boolean().default(true),
  interval: z.number().int().positive().default(600000),
  strategy: z.nativeEnum(ExplorationStrategy).default(ExplorationStrategy.CURIOSITY_DRIVEN),
  budget: z.number().int().positive().default(100),
  depth: z.number().int().positive().default(3),
});

/**
 * 调度器配置Schema
 */
const SchedulerConfigSchema = z.object({
  asyncLoopInterval: z.number().int().positive().default(1000),
  defaultTimeout: z.number().int().positive().default(30000),
  maxConcurrent: z.number().int().positive().default(10),
  homeostasisEnable: z.boolean().default(true),
  cpuThreshold: z.number().min(0).max(100).default(80),
  memoryThreshold: z.number().min(0).max(100).default(85),
  fatigueThreshold: z.number().min(0).max(1).default(0.7),
  retryPolicy: RetryPolicySchema.default({}),
  priorityQueue: PriorityQueueConfigSchema.default({}),
  backgroundTask: BackgroundTaskConfigSchema.default({}),
  reflectionTask: ReflectionTaskConfigSchema.default({}),
  explorationTask: ExplorationTaskConfigSchema.default({}),
});

/**
 * 嵌入配置Schema
 */
const EmbeddingConfigSchema = z.object({
  provider: z.nativeEnum(EmbeddingProvider).default(EmbeddingProvider.OLLAMA),
  model: z.string().default('nomic-embed-text'),
  apiUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
  dimensions: z.number().int().positive().default(768),
  batchSize: z.number().int().positive().default(32),
  timeout: z.number().int().positive().default(30000),
  retryCount: z.number().int().min(0).default(3),
});

/**
 * 向量存储配置Schema
 */
const VectorStoreConfigSchema = z.object({
  backend: z.nativeEnum(VectorStoreBackend).default(VectorStoreBackend.SQLITE),
  persistPath: z.string().optional(),
  connectionString: z.string().optional(),
  collectionName: z.string().default('ouroboros_memories'),
  distanceMetric: z.enum(['cosine', 'euclidean', 'dot']).default('cosine'),
});

/**
 * 遗忘配置Schema
 */
const ForgettingConfigSchema = z.object({
  strategy: z.nativeEnum(ForgettingStrategy).default(ForgettingStrategy.RETENTION_SCORE),
  decayRate: z.number().positive().default(0.01),
  consolidationThreshold: z.number().min(0).max(1).default(0.8),
  cleanupInterval: z.number().int().positive().default(3600000),
  maxAge: z.number().int().positive().default(2592000000), // 30天
});

/**
 * 记忆配置Schema
 */
const MemoryConfigSchema = z.object({
  maxMemoryCount: z.number().int().positive().default(10000),
  similarityThreshold: z.number().min(0).max(1).default(0.7),
  enableVectorization: z.boolean().default(true),
  embedding: EmbeddingConfigSchema.default({}),
  vectorStore: VectorStoreConfigSchema.default({}),
  forgetting: ForgettingConfigSchema.default({}),
});

/**
 * 激素影响权重Schema
 */
const HormoneInfluenceWeightsSchema = z.object({
  decisionSpeed: z.record(z.nativeEnum(HormoneType), z.number()).default({
    [HormoneType.ADRENALINE]: 0.3,
    [HormoneType.CORTISOL]: -0.2,
    [HormoneType.DOPAMINE]: 0.1,
    [HormoneType.SEROTONIN]: 0.0,
    [HormoneType.CURIOSITY]: 0.1,
    [HormoneType.STRESS]: 0.4,
    [HormoneType.FATIGUE]: -0.3,
    [HormoneType.DOMINANCE]: 0.2,
  }),
  exploration: z.record(z.nativeEnum(HormoneType), z.number()).default({
    [HormoneType.ADRENALINE]: 0.1,
    [HormoneType.CORTISOL]: -0.3,
    [HormoneType.DOPAMINE]: 0.4,
    [HormoneType.SEROTONIN]: 0.0,
    [HormoneType.CURIOSITY]: 0.5,
    [HormoneType.STRESS]: -0.2,
    [HormoneType.FATIGUE]: -0.4,
    [HormoneType.DOMINANCE]: 0.1,
  }),
  riskTolerance: z.record(z.nativeEnum(HormoneType), z.number()).default({
    [HormoneType.ADRENALINE]: 0.4,
    [HormoneType.CORTISOL]: -0.4,
    [HormoneType.DOPAMINE]: 0.3,
    [HormoneType.SEROTONIN]: 0.1,
    [HormoneType.CURIOSITY]: 0.2,
    [HormoneType.STRESS]: -0.2,
    [HormoneType.FATIGUE]: -0.1,
    [HormoneType.DOMINANCE]: 0.3,
  }),
  learningRate: z.record(z.nativeEnum(HormoneType), z.number()).default({
    [HormoneType.ADRENALINE]: 0.2,
    [HormoneType.CORTISOL]: -0.3,
    [HormoneType.DOPAMINE]: 0.4,
    [HormoneType.SEROTONIN]: 0.1,
    [HormoneType.CURIOSITY]: 0.5,
    [HormoneType.STRESS]: -0.3,
    [HormoneType.FATIGUE]: -0.4,
    [HormoneType.DOMINANCE]: 0.1,
  }),
  creativity: z.record(z.nativeEnum(HormoneType), z.number()).default({
    [HormoneType.ADRENALINE]: 0.1,
    [HormoneType.CORTISOL]: -0.4,
    [HormoneType.DOPAMINE]: 0.5,
    [HormoneType.SEROTONIN]: 0.2,
    [HormoneType.CURIOSITY]: 0.4,
    [HormoneType.STRESS]: -0.3,
    [HormoneType.FATIGUE]: -0.3,
    [HormoneType.DOMINANCE]: 0.1,
  }),
});

/**
 * 激素配置Schema
 */
const HormoneConfigSchema = z.object({
  decayRates: z.record(z.nativeEnum(HormoneType), z.number()).default({
    [HormoneType.ADRENALINE]: 0.1,
    [HormoneType.CORTISOL]: 0.05,
    [HormoneType.DOPAMINE]: 0.02,
    [HormoneType.SEROTONIN]: 0.01,
    [HormoneType.CURIOSITY]: 0.03,
    [HormoneType.STRESS]: 0.04,
    [HormoneType.FATIGUE]: 0.02,
    [HormoneType.DOMINANCE]: 0.015,
  }),
  maxValues: z.record(z.nativeEnum(HormoneType), z.number()).default({
    [HormoneType.ADRENALINE]: 1.0,
    [HormoneType.CORTISOL]: 1.0,
    [HormoneType.DOPAMINE]: 1.0,
    [HormoneType.SEROTONIN]: 1.0,
    [HormoneType.CURIOSITY]: 1.0,
    [HormoneType.STRESS]: 1.0,
    [HormoneType.FATIGUE]: 1.0,
    [HormoneType.DOMINANCE]: 1.0,
  }),
  minValues: z.record(z.nativeEnum(HormoneType), z.number()).default({
    [HormoneType.ADRENALINE]: 0.0,
    [HormoneType.CORTISOL]: 0.0,
    [HormoneType.DOPAMINE]: 0.0,
    [HormoneType.SEROTONIN]: 0.0,
    [HormoneType.CURIOSITY]: 0.0,
    [HormoneType.STRESS]: 0.0,
    [HormoneType.FATIGUE]: 0.0,
    [HormoneType.DOMINANCE]: 0.0,
  }),
  thresholds: z.record(z.nativeEnum(HormoneType), z.number()).default({
    [HormoneType.ADRENALINE]: 0.6,
    [HormoneType.CORTISOL]: 0.5,
    [HormoneType.DOPAMINE]: 0.5,
    [HormoneType.SEROTONIN]: 0.4,
    [HormoneType.CURIOSITY]: 0.5,
    [HormoneType.STRESS]: 0.7,
    [HormoneType.FATIGUE]: 0.6,
    [HormoneType.DOMINANCE]: 0.5,
  }),
  influenceWeights: HormoneInfluenceWeightsSchema.default({}),
});

/**
 * 稳态配置Schema
 */
const HomeostasisConfigSchema = z.object({
  enabled: z.boolean().default(true),
  cpuThreshold: z.number().min(0).max(100).default(80),
  memoryThreshold: z.number().min(0).max(100).default(85),
  diskThreshold: z.number().min(0).max(100).default(90),
  maxTaskFrequency: z.number().int().positive().default(100),
  fatigueThreshold: z.number().min(0).max(1).default(0.7),
  stressThreshold: z.number().min(0).max(1).default(0.8),
  autoThrottling: z.boolean().default(true),
  checkInterval: z.number().int().positive().default(5000),
});

/**
 * 告警规则Schema
 */
const AlertRuleSchema = z.object({
  id: z.string().uuid().optional(),
  metric: z.string(),
  operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'neq']),
  threshold: z.number(),
  duration: z.number().int().nonnegative().default(0),
  severity: z.enum(['info', 'warning', 'critical']).default('warning'),
  actions: z.array(z.object({
    type: z.enum(['log', 'notify', 'throttle', 'restart', 'shutdown']),
    target: z.string().optional(),
    params: z.record(JSONValueSchema).optional(),
  })).default([{ type: 'log' }]),
});

/**
 * 身份锚定配置Schema
 */
const IdentityAnchorConfigSchema = z.object({
  verificationInterval: z.number().int().positive().default(60000),
  signatureAlgorithm: z.string().default('sha256'),
  entropySources: z.array(z.string()).default(['pid', 'ppid', 'hostname', 'uptime', 'timestamp']),
});

/**
 * 看门狗配置Schema
 */
const WatchdogConfigSchema = z.object({
  enabled: z.boolean().default(true),
  checkInterval: z.number().int().positive().default(5000),
  alertRules: z.array(AlertRuleSchema).default([
    { metric: 'cpu', operator: 'gt', threshold: 80, severity: 'warning' },
    { metric: 'memory', operator: 'gt', threshold: 85, severity: 'critical' },
  ]),
  autoRecovery: z.boolean().default(false),
});

/**
 * 双思维配置Schema
 */
const DualMindConfigSchema = z.object({
  mainTemperature: z.number().min(0).max(2).default(0.7),
  auditTemperature: z.number().min(0).max(2).default(0.3),
  divergenceThreshold: z.number().min(0).max(1).default(0.3),
  autoApproveThreshold: z.number().min(0).max(1).default(0.9),
  humanReviewThreshold: z.number().min(0).max(1).default(0.5),
  maxAuditDepth: z.number().int().positive().default(3),
});

/**
 * 哥德尔免疫配置Schema
 */
const GodelImmunityConfigSchema = z.object({
  enabled: z.boolean().default(true),
  customPatterns: z.array(z.string()).default([]),
  whitelist: z.array(z.string()).default([]),
  responseMode: z.enum(['block', 'warn', 'log']).default('block'),
});

/**
 * 安全引擎配置Schema
 */
const SafetyEngineConfigSchema = z.object({
  enabledLayers: z.array(z.number().int().min(1).max(4)).default([1, 2, 3, 4]),
  identity: IdentityAnchorConfigSchema.default({}),
  watchdog: WatchdogConfigSchema.default({}),
  dualMind: DualMindConfigSchema.default({}),
  godelImmunity: GodelImmunityConfigSchema.default({}),
});

/**
 * 日志传输Schema
 */
const LogTransportSchema = z.object({
  type: z.enum(['console', 'file', 'http', 'syslog']),
  level: z.nativeEnum(LogLevel).optional(),
  options: z.record(JSONValueSchema).optional(),
});

/**
 * 日志配置Schema
 */
const LoggerConfigSchema = z.object({
  level: z.nativeEnum(LogLevel).default(LogLevel.INFO),
  format: z.enum(['json', 'pretty', 'simple']).default('pretty'),
  colorize: z.boolean().default(true),
  timestamp: z.boolean().default(true),
  transports: z.array(LogTransportSchema).default([{ type: 'console' }]),
  samplingRate: z.number().min(0).max(1).default(1.0),
});

/**
 * 告警配置Schema
 */
const AlertConfigSchema = z.object({
  name: z.string(),
  condition: z.string(),
  threshold: z.number(),
  duration: z.number().int().nonnegative(),
  severity: z.enum(['warning', 'critical']),
  channels: z.array(z.string()),
});

/**
 * 监控配置Schema
 */
const MonitoringConfigSchema = z.object({
  enabled: z.boolean().default(true),
  checkInterval: z.number().int().positive().default(5000),
  retentionPeriod: z.number().int().positive().default(604800000), // 7天
  alerts: z.array(AlertConfigSchema).default([]),
  prometheus: z.object({
    enabled: z.boolean().default(false),
    port: z.number().int().positive().default(9090),
    path: z.string().default('/metrics'),
  }).optional(),
});

/**
 * Web适配器配置Schema
 */
const WebAdapterConfigSchema = z.object({
  port: z.number().int().positive().default(8080),
  host: z.string().default('0.0.0.0'),
  cors: z.object({
    enabled: z.boolean().default(true),
    origins: z.array(z.string()).default(['*']),
    methods: z.array(z.string()).default(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']),
  }).default({}),
  auth: z.object({
    enabled: z.boolean().default(false),
    type: z.enum(['jwt', 'apikey', 'basic']).default('jwt'),
    secret: z.string().optional(),
  }).optional(),
  rateLimit: z.object({
    enabled: z.boolean().default(true),
    windowMs: z.number().int().positive().default(60000),
    maxRequests: z.number().int().positive().default(100),
  }).default({}),
});

/**
 * Telegram适配器配置Schema
 */
const TelegramAdapterConfigSchema = z.object({
  botToken: z.string().min(1),
  allowedUsers: z.array(z.string()).optional(),
  commandPrefix: z.string().default('/'),
  parseMode: z.enum(['Markdown', 'HTML', 'MarkdownV2']).default('Markdown'),
  pollingTimeout: z.number().int().positive().default(30),
});

/**
 * TUI适配器配置Schema
 */
const TUIAdapterConfigSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  refreshRate: z.number().int().positive().default(100),
  logLevel: z.nativeEnum(LogLevel).default(LogLevel.INFO),
  keybindings: z.record(z.string()).default({}),
});

/**
 * 适配器配置Schema
 */
const AdapterConfigsSchema = z.object({
  web: WebAdapterConfigSchema.optional(),
  telegram: TelegramAdapterConfigSchema.optional(),
  tui: TUIAdapterConfigSchema.optional(),
});

/**
 * 全局配置Schema
 */
export const GlobalConfigSchema = z.object({
  name: z.string().default('Ouroboros'),
  version: z.string().default('2.0.0'),
  mode: z.nativeEnum(AgentMode).default(AgentMode.WEB),
  debug: z.boolean().default(false),
  instanceId: z.string().uuid().optional(),
  scheduler: SchedulerConfigSchema.default({}),
  memory: MemoryConfigSchema.default({}),
  hormones: HormoneConfigSchema.default({}),
  homeostasis: HomeostasisConfigSchema.default({}),
  safety: SafetyEngineConfigSchema.default({}),
  logging: LoggerConfigSchema.default({}),
  monitoring: MonitoringConfigSchema.default({}),
  adapters: AdapterConfigsSchema.default({}),
});

/**
 * 全局配置类型推断
 */
export type ValidatedGlobalConfig = z.infer<typeof GlobalConfigSchema>;

// ============================================================================
// 配置加载器
// ============================================================================

/**
 * 配置加载错误
 */
export class ConfigLoadError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly validationErrors?: z.ZodError
  ) {
    super(message);
    this.name = 'ConfigLoadError';
  }
}

/**
 * 配置验证错误
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: z.ZodError
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * 配置管理器
 */
export class ConfigManager {
  private config: ValidatedGlobalConfig | null = null;
  private options: ConfigLoadOptions;
  private watchers: Set<(config: ValidatedGlobalConfig) => void> = new Set();

  constructor(options: Partial<ConfigLoadOptions> = {}) {
    this.options = {
      envPrefix: 'OUROBOROS',
      allowEnvOverride: true,
      ...options,
    };
  }

  /**
   * 加载配置
   */
  async load(): Promise<ValidatedGlobalConfig> {
    // 1. 从默认配置开始
    let config = this.getDefaultConfig();

    // 2. 从文件加载（如果指定）
    if (this.options.configPath) {
      const fileConfig = await this.loadFromFile(this.options.configPath);
      config = this.mergeConfigs(config, fileConfig);
    }

    // 3. 从环境变量加载
    if (this.options.allowEnvOverride) {
      const envConfig = this.loadFromEnv();
      config = this.mergeConfigs(config, envConfig);
    }

    // 4. 应用默认值
    if (this.options.defaults) {
      config = this.mergeConfigs(config, this.options.defaults);
    }

    // 5. 验证配置
    const validated = this.validate(config);
    
    // 6. 生成实例ID（如果没有）
    if (!validated.instanceId) {
      validated.instanceId = this.generateInstanceId();
    }

    this.config = validated;
    this.notifyWatchers();

    return validated;
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): DeepPartial<ValidatedGlobalConfig> {
    return {
      name: 'Ouroboros',
      version: '2.0.0',
      mode: AgentMode.WEB,
      debug: false,
    };
  }

  /**
   * 从文件加载配置
   */
  private async loadFromFile(filePath: string): Promise<DeepPartial<ValidatedGlobalConfig>> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();

      switch (ext) {
        case '.json':
          return JSON.parse(content);
        case '.yaml':
        case '.yml':
          // 需要yaml解析器，这里简化为JSON
          throw new ConfigLoadError('YAML parsing not implemented, use JSON');
        default:
          throw new ConfigLoadError(`Unsupported config file format: ${ext}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw new ConfigLoadError(
        `Failed to load config from ${filePath}`,
        error as Error
      );
    }
  }

  /**
   * 从环境变量加载配置
   */
  private loadFromEnv(): DeepPartial<ValidatedGlobalConfig> {
    const prefix = this.options.envPrefix;
    const envConfig: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(process.env)) {
      if (!value || !key.startsWith(prefix)) continue;

      const configPath = key
        .slice(prefix.length)
        .toLowerCase()
        .split('_')
        .filter(Boolean);

      this.setNestedValue(envConfig, configPath, this.parseEnvValue(value));
    }

    return envConfig as DeepPartial<ValidatedGlobalConfig>;
  }

  /**
   * 解析环境变量值
   */
  private parseEnvValue(value: string): unknown {
    // 布尔值
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    // 数字
    if (/^-?\d+$/.test(value)) return parseInt(value, 10);
    if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
    
    // JSON数组或对象
    if (value.startsWith('[') || value.startsWith('{')) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }

    return value;
  }

  /**
   * 设置嵌套值
   */
  private setNestedValue(obj: Record<string, unknown>, path: string[], value: unknown): void {
    let current: Record<string, unknown> = obj;
    
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    
    current[path[path.length - 1]] = value;
  }

  /**
   * 合并配置
   */
  private mergeConfigs(
    base: DeepPartial<ValidatedGlobalConfig>,
    override: DeepPartial<ValidatedGlobalConfig>
  ): DeepPartial<ValidatedGlobalConfig> {
    const merged = { ...base };

    for (const key of Object.keys(override)) {
      const overrideValue = override[key as keyof typeof override];
      const baseValue = base[key as keyof typeof base];

      if (
        typeof overrideValue === 'object' && 
        overrideValue !== null && 
        !Array.isArray(overrideValue) &&
        typeof baseValue === 'object' && 
        baseValue !== null
      ) {
        (merged as Record<string, unknown>)[key] = this.mergeConfigs(
          baseValue as DeepPartial<ValidatedGlobalConfig>,
          overrideValue as DeepPartial<ValidatedGlobalConfig>
        );
      } else if (overrideValue !== undefined) {
        (merged as Record<string, unknown>)[key] = overrideValue;
      }
    }

    return merged;
  }

  /**
   * 验证配置
   */
  private validate(config: DeepPartial<ValidatedGlobalConfig>): ValidatedGlobalConfig {
    const result = GlobalConfigSchema.safeParse(config);

    if (!result.success) {
      throw new ConfigValidationError(
        'Configuration validation failed',
        result.error
      );
    }

    return result.data;
  }

  /**
   * 生成实例ID
   */
  private generateInstanceId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * 获取当前配置
   */
  getConfig(): ValidatedGlobalConfig {
    if (!this.config) {
      throw new ConfigLoadError('Configuration not loaded. Call load() first.');
    }
    return this.config;
  }

  /**
   * 获取配置项（支持点号路径）
   */
  get<T = unknown>(path: string): T | undefined {
    if (!this.config) {
      throw new ConfigLoadError('Configuration not loaded. Call load() first.');
    }
    
    const keys = path.split('.');
    let value: unknown = this.config;
    
    for (const key of keys) {
      if (value === null || typeof value !== 'object') {
        return undefined;
      }
      value = (value as Record<string, unknown>)[key];
    }
    
    return value as T;
  }

  /**
   * 更新配置（部分更新）
   */
  updateConfig(updates: DeepPartial<ValidatedGlobalConfig>): ValidatedGlobalConfig {
    if (!this.config) {
      throw new ConfigLoadError('Configuration not loaded. Call load() first.');
    }

    const merged = this.mergeConfigs(this.config, updates);
    this.config = this.validate(merged);
    this.notifyWatchers();

    return this.config;
  }

  /**
   * 订阅配置变更
   */
  onChange(handler: (config: ValidatedGlobalConfig) => void): () => void {
    this.watchers.add(handler);
    return () => this.watchers.delete(handler);
  }

  /**
   * 通知所有观察者
   */
  private notifyWatchers(): void {
    if (!this.config) return;
    for (const watcher of this.watchers) {
      try {
        watcher(this.config);
      } catch (error) {
        console.error('Config watcher failed:', error);
      }
    }
  }

  /**
   * 保存配置到文件
   */
  async saveToFile(filePath: string): Promise<void> {
    if (!this.config) {
      throw new ConfigLoadError('Configuration not loaded');
    }

    const content = JSON.stringify(this.config, null, 2);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }
}

// ============================================================================
// 配置助手
// ============================================================================

/**
 * 创建配置管理器实例
 */
export function createConfigManager(options?: Partial<ConfigLoadOptions>): ConfigManager {
  return new ConfigManager(options);
}

/**
 * 加载配置（快捷函数）
 */
export async function loadConfig(
  options?: Partial<ConfigLoadOptions>
): Promise<ValidatedGlobalConfig> {
  const manager = createConfigManager(options);
  return manager.load();
}

/**
 * 获取默认配置（用于测试）
 */
export function getDefaultConfig(): ValidatedGlobalConfig {
  return GlobalConfigSchema.parse({});
}

/**
 * 验证配置对象
 */
export function validateConfig(
  config: unknown
): { success: true; data: ValidatedGlobalConfig } | { success: false; error: z.ZodError } {
  const result = GlobalConfigSchema.safeParse(config);
  return result.success 
    ? { success: true, data: result.data }
    : { success: false, error: result.error };
}

/**
 * 获取环境变量配置路径
 */
export function getConfigPathFromEnv(): string | undefined {
  return process.env.OUROBOROS_CONFIG_PATH;
}

/**
 * 获取配置目录
 */
export function getConfigDirectory(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, '.ouroboros');
}

/**
 * 获取默认配置文件路径
 */
export function getDefaultConfigPath(): string {
  return path.join(getConfigDirectory(), 'config.json');
}

// ============================================================================
// 配置片段（用于特定模块）

/**
 * 获取调度器配置
 */
export function getSchedulerConfig(config: ValidatedGlobalConfig): typeof config.scheduler {
  return config.scheduler;
}

/**
 * 获取记忆配置
 */
export function getMemoryConfig(config: ValidatedGlobalConfig): typeof config.memory {
  return config.memory;
}

/**
 * 获取激素配置
 */
export function getHormoneConfig(config: ValidatedGlobalConfig): typeof config.hormones {
  return config.hormones;
}

/**
 * 获取安全引擎配置
 */
export function getSafetyConfig(config: ValidatedGlobalConfig): typeof config.safety {
  return config.safety;
}

/**
 * 获取日志配置
 */
export function getLoggingConfig(config: ValidatedGlobalConfig): typeof config.logging {
  return config.logging;
}

/**
 * 获取监控配置
 */
export function getMonitoringConfig(config: ValidatedGlobalConfig): typeof config.monitoring {
  return config.monitoring;
}

// ============================================================================
// 配置常量
// ============================================================================

export const CONFIG_CONSTANTS = {
  /** 默认配置文件名 */
  DEFAULT_CONFIG_FILENAME: 'config.json',
  /** 最小检查间隔（毫秒） */
  MIN_CHECK_INTERVAL: 100,
  /** 最大检查间隔（毫秒） */
  MAX_CHECK_INTERVAL: 3600000,
  /** 最小超时（毫秒） */
  MIN_TIMEOUT: 1000,
  /** 最大超时（毫秒） */
  MAX_TIMEOUT: 3600000,
  /** 默认内存限制（字节） */
  DEFAULT_MEMORY_LIMIT: 512 * 1024 * 1024, // 512MB
  /** 默认CPU阈值 */
  DEFAULT_CPU_THRESHOLD: 80,
} as const;

// ============================================================================
// 模块元数据
// ============================================================================

export const CONFIG_MODULE = {
  name: 'config',
  version: '2.0.0',
  description: 'Ouroboros配置管理系统',
  exports: [
    'ConfigManager',
    'ConfigLoadError',
    'ConfigValidationError',
    'GlobalConfigSchema',
    'createConfigManager',
    'loadConfig',
    'validateConfig',
  ],
} as const;

// 默认导出
export default ConfigManager;
