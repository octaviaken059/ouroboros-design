/**
 * Ouroboros - 核心类型系统
 * 🐍⭕ 衔尾蛇自指进化AI Agent的类型定义
 * 
 * @version 2.0.0
 * @module types
 */

import { z } from 'zod';

// ============================================================================
// 基础工具类型
// ============================================================================

/** 唯一标识符 */
export type UUID = string;

/** 时间戳（毫秒） */
export type Timestamp = number;

/** JSON兼容的基础类型 */
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];

/** 可选字段包装 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** 可空类型 */
export type Nullable<T> = T | null;

/** 深度只读 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/** 深度部分可选 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** 事件处理器 */
export type EventHandler<T = unknown> = (event: T) => void | Promise<void>;

/** 异步函数 */
export type AsyncFunction<T = unknown, R = unknown> = (arg: T) => Promise<R>;

/** 构造函数 */
export type Constructor<T = unknown> = new (...args: unknown[]) => T;

// ============================================================================
// 枚举类型
// ============================================================================

/** Agent运行模式 */
export enum AgentMode {
  WEB = 'web',
  TUI = 'tui',
  TELEGRAM = 'telegram',
  API = 'api',
  DAEMON = 'daemon',
}

/** 任务优先级 */
export enum TaskPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
  BACKGROUND = 4,
}

/** 任务状态 */
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
  RETRYING = 'retrying',
}

/** 记忆层级 */
export enum MemoryLayer {
  WORKING = 'working',
  EPISODIC = 'episodic',
  SEMANTIC = 'semantic',
  PROCEDURAL = 'procedural',
  REFLECTIVE = 'reflective',
}

/** 记忆类型 */
export enum MemoryType {
  EVENT = 'event',
  FACT = 'fact',
  SKILL = 'skill',
  INSIGHT = 'insight',
  CONVERSATION = 'conversation',
  OBSERVATION = 'observation',
}

/** 激素类型 */
export enum HormoneType {
  ADRENALINE = 'adrenaline',
  CORTISOL = 'cortisol',
  DOPAMINE = 'dopamine',
  SEROTONIN = 'serotonin',
  CURIOSITY = 'curiosity',
  STRESS = 'stress',
  FATIGUE = 'fatigue',
  DOMINANCE = 'dominance',
}

/** 日志级别 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/** 安全级别 */
export enum SecurityLevel {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/** 身份状态 */
export enum IdentityState {
  STABLE = 'stable',
  MINOR_CHANGE = 'minor_change',
  MAJOR_CHANGE = 'major_change',
  CORRUPTED = 'corrupted',
}

/** 资源状态 */
export enum ResourceStatus {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency',
}

/** 情绪状态 */
export enum EmotionalState {
  CALM = 'calm',
  EXCITED = 'excited',
  ANXIOUS = 'anxious',
  FRUSTRATED = 'frustrated',
  SATISFIED = 'satisfied',
  CURIOUS = 'curious',
  TIRED = 'tired',
  STRESSED = 'stressed',
}

/** 认知偏差类型 */
export enum BiasType {
  CONFIRMATION = 'confirmation',
  AVAILABILITY = 'availability',
  ANCHORING = 'anchoring',
  OVERCONFIDENCE = 'overconfidence',
  RECENCY = 'recency',
  SURVIVORSHIP = 'survivorship',
}

/** 工具验证结果 */
export enum ValidationStatus {
  PENDING = 'pending',
  VALIDATING = 'validating',
  VALID = 'valid',
  INVALID = 'invalid',
  WARNING = 'warning',
}

/** 嵌入服务提供商 */
export enum EmbeddingProvider {
  OLLAMA = 'ollama',
  OPENAI = 'openai',
  NONE = 'none',
}

/** 向量存储后端 */
export enum VectorStoreBackend {
  MEMORY = 'memory',
  SQLITE = 'sqlite',
  PGVECTOR = 'pgvector',
}

/** 接口适配器类型 */
export enum AdapterType {
  WEB = 'web',
  TUI = 'tui',
  TELEGRAM = 'telegram',
  CLI = 'cli',
  CUSTOM = 'custom',
}

/** 健康检查状态 */
export enum HealthStatus {
  PASSING = 'passing',
  WARNING = 'warning',
  CRITICAL = 'critical',
  UNKNOWN = 'unknown',
}

/** 反射类型 */
export enum ReflectionType {
  ROUTINE = 'routine',
  POST_ACTION = 'post_action',
  SCHEDULED = 'scheduled',
  TRIGGERED = 'triggered',
  DEEP = 'deep',
}

/** 探索策略 */
export enum ExplorationStrategy {
  RANDOM = 'random',
  BREADTH_FIRST = 'breadth_first',
  DEPTH_FIRST = 'depth_first',
  UNCERTAINTY_DRIVEN = 'uncertainty_driven',
  CURIOSITY_DRIVEN = 'curiosity_driven',
}

/** 遗忘策略 */
export enum ForgettingStrategy {
  FIFO = 'fifo',
  LRU = 'lru',
  RETENTION_SCORE = 'retention_score',
  ENTROPY_BASED = 'entropy_based',
}

// ============================================================================
// 基础架构类型
// ============================================================================

/**
 * 元数据接口
 * 用于所有实体的基础元数据
 */
export interface Metadata {
  /** 创建时间 */
  createdAt: Timestamp;
  /** 更新时间 */
  updatedAt: Timestamp;
  /** 版本号 */
  version: number;
  /** 标签 */
  tags?: string[];
  /** 自定义属性 */
  properties?: Record<string, JSONValue>;
}

/**
 * 分页请求
 */
export interface PaginationRequest {
  /** 页码（从1开始） */
  page: number;
  /** 每页大小 */
  pageSize: number;
  /** 排序字段 */
  sortBy?: string;
  /** 是否降序 */
  sortDesc?: boolean;
}

/**
 * 分页响应
 */
export interface PaginationResponse<T> {
  /** 数据列表 */
  items: T[];
  /** 总数量 */
  total: number;
  /** 当前页 */
  page: number;
  /** 每页大小 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 是否有下一页 */
  hasNext: boolean;
  /** 是否有上一页 */
  hasPrev: boolean;
}

/**
 * 结果包装器
 */
export interface Result<T, E = Error> {
  /** 是否成功 */
  success: boolean;
  /** 成功时的数据 */
  data?: T;
  /** 失败时的错误 */
  error?: E;
  /** 元数据 */
  meta?: Record<string, JSONValue>;
}

/**
 * 操作结果
 */
export interface OperationResult {
  /** 是否成功 */
  success: boolean;
  /** 操作ID */
  operationId: UUID;
  /** 消息 */
  message: string;
  /** 受影响数量 */
  affectedCount?: number;
  /** 额外数据 */
  data?: JSONValue;
}

// ============================================================================
// 身体图式类型 (BodySchema)
// ============================================================================

/**
 * 进程身份信息
 * 通过/proc/self获取的系统级身份标识
 */
export interface ProcessIdentity {
  /** 进程ID */
  pid: number;
  /** 父进程ID */
  ppid: number;
  /** 用户ID */
  uid: number;
  /** 组ID */
  gid: number;
  /** 当前工作目录 */
  cwd: string;
  /** 可执行文件路径 */
  executable: string;
  /** 启动命令 */
  command: string;
  /** 启动参数 */
  args: string[];
  /** 环境变量 */
  env: Record<string, string>;
}

/**
 * 资源使用状态
 */
export interface ResourceUsage {
  /** CPU使用率 (0-100) */
  cpuPercent: number;
  /** CPU负载 */
  loadAvg: [number, number, number];
  /** 内存使用量（字节） */
  memoryUsed: number;
  /** 内存总量（字节） */
  memoryTotal: number;
  /** 内存使用率 (0-1) */
  memoryPercent: number;
  /** 交换空间使用量 */
  swapUsed: number;
  /** 交换空间总量 */
  swapTotal: number;
  /** 磁盘使用量（字节） */
  diskUsed: number;
  /** 磁盘总量（字节） */
  diskTotal: number;
  /** 磁盘使用率 (0-1) */
  diskPercent: number;
  /** 打开文件数 */
  openFiles: number;
  /** 线程数 */
  threadCount: number;
  /** 网络连接数 */
  networkConnections: number;
}

/**
 * 进程资源详情
 */
export interface ProcessResources {
  /** 进程内存使用 */
  heapUsed: number;
  /** 堆内存总量 */
  heapTotal: number;
  /** 外部内存 */
  external: number;
  /** 数组缓冲区 */
  arrayBuffers: number;
  /** RSS内存 */
  rss: number;
  /** 运行时间（秒） */
  uptime: number;
}

/**
 * 系统环境信息
 */
export interface EnvironmentInfo {
  /** 主机名 */
  hostname: string;
  /** 操作系统类型 */
  platform: string;
  /** 操作系统版本 */
  release: string;
  /** 架构 */
  arch: string;
  /** Node.js版本 */
  nodeVersion: string;
  /** 时区 */
  timezone: string;
  /** 区域设置 */
  locale: string;
  /** 当前时间 */
  currentTime: Timestamp;
  /** 系统启动时间 */
  bootTime: Timestamp;
}

/**
 * 网络信息
 */
export interface NetworkInfo {
  /** 主机IP列表 */
  addresses: string[];
  /** 默认网关 */
  gateway?: string;
  /** 主机名 */
  hostname: string;
  /** 接口列表 */
  interfaces: Record<string, NetworkInterface[]>;
}

/**
 * 网络接口
 */
export interface NetworkInterface {
  /** 地址 */
  address: string;
  /** 网络掩码 */
  netmask: string;
  /** 族（IPv4/IPv6） */
  family: string;
  /** MAC地址 */
  mac?: string;
  /** 是否内部接口 */
  internal: boolean;
  /** CIDR表示 */
  cidr?: string;
}

/**
 * 系统限制
 */
export interface SystemLimits {
  /** 最大文件描述符 */
  maxOpenFiles: number;
  /** 最大进程数 */
  maxProcesses: number;
  /** 最大内存 */
  maxMemory: number;
  /** 堆栈大小限制 */
  stackSize: number;
}

/**
 * 身体图式 - 具身自我认知
 * 系统的自指性核心，通过/proc/self等机制建立的身份标识
 */
export interface BodySchema {
  /** 身份签名 */
  identity: ProcessIdentity;
  /** 资源状态 */
  resources: ResourceUsage;
  /** 进程资源 */
  process: ProcessResources;
  /** 环境信息 */
  environment: EnvironmentInfo;
  /** 网络信息 */
  network: NetworkInfo;
  /** 系统限制 */
  limits: SystemLimits;
  /** 采集时间戳 */
  timestamp: Timestamp;
  /** 健康状态 */
  health: ResourceStatus;
  /** 元数据 */
  meta: Metadata;
}

/**
 * 稳态指标
 * 生物学启发的系统稳定性监控
 */
export interface HomeostasisMetrics {
  /** 体温/温度（如果可用） */
  temperature?: number;
  /** 心率/任务频率 */
  taskFrequency: number;
  /** 能量水平/资源充足度 */
  energyLevel: number;
  /** 压力水平 */
  stressLevel: number;
  /** 疲劳度 */
  fatigueLevel: number;
  /** 稳态评分 (0-1) */
  homeostasisScore: number;
  /** 是否处于稳态 */
  isHomeostatic: boolean;
  /** 告警列表 */
  alerts: HomeostasisAlert[];
}

/**
 * 稳态告警
 */
export interface HomeostasisAlert {
  /** 告警ID */
  id: UUID;
  /** 告警类型 */
  type: string;
  /** 严重程度 */
  severity: 'info' | 'warning' | 'critical';
  /** 消息 */
  message: string;
  /** 当前值 */
  currentValue: number;
  /** 阈值 */
  threshold: number;
  /** 建议操作 */
  recommendation?: string;
  /** 时间戳 */
  timestamp: Timestamp;
}

/**
 * 稳态配置
 */
export interface HomeostasisConfig {
  /** 是否启用 */
  enabled: boolean;
  /** CPU阈值 (%) */
  cpuThreshold: number;
  /** 内存阈值 (%) */
  memoryThreshold: number;
  /** 磁盘阈值 (%) */
  diskThreshold: number;
  /** 任务频率上限 */
  maxTaskFrequency: number;
  /** 疲劳度阈值 */
  fatigueThreshold: number;
  /** 压力阈值 */
  stressThreshold: number;
  /** 自动降载 */
  autoThrottling: boolean;
  /** 检查间隔（毫秒） */
  checkInterval: number;
}

// ============================================================================
// 记忆系统类型
// ============================================================================

/**
 * 记忆条目基础
 */
export interface MemoryEntry {
  /** 记忆ID */
  id: UUID;
  /** 记忆层级 */
  layer: MemoryLayer;
  /** 记忆类型 */
  type: MemoryType;
  /** 内容 */
  content: string;
  /** 内容摘要 */
  summary?: string;
  /** 嵌入向量 */
  embedding?: number[];
  /** 重要性 (0-1) */
  importance: number;
  /** 情感权重 (0-1) */
  emotionalWeight: number;
  /** 访问计数 */
  accessCount: number;
  /** 保留分数 */
  retentionScore: number;
  /** 是否已巩固 */
  consolidated: boolean;
  /** 关联记忆ID列表 */
  relatedIds: UUID[];
  /** 来源 */
  source?: string;
  /** 上下文 */
  context?: string;
  /** 时间戳 */
  timestamp: Timestamp;
  /** 最后访问时间 */
  lastAccessed: Timestamp;
  /** 元数据 */
  meta: Metadata;
}

/**
 * 工作记忆
 * 当前会话的短期上下文
 */
export interface WorkingMemory {
  /** 记忆条目 */
  entries: MemoryEntry[];
  /** 最大容量（chunks） */
  capacity: number;
  /** 当前使用量 */
  currentSize: number;
  /** 焦点内容 */
  focus?: MemoryEntry;
  /** 会话ID */
  sessionId: UUID;
  /** 创建时间 */
  createdAt: Timestamp;
}

/**
 * 情景记忆
 * 具体事件和经历
 */
export interface EpisodicMemory {
  /** 事件列表 */
  events: EpisodicEvent[];
  /** 最大容量 */
  capacity: number;
  /** 索引（按时间） */
  temporalIndex: Map<Timestamp, UUID[]>;
  /** 索引（按类型） */
  typeIndex: Map<MemoryType, UUID[]>;
}

/**
 * 情景事件
 */
export interface EpisodicEvent extends MemoryEntry {
  /** 事件类型 */
  eventType: string;
  /** 参与者 */
  participants: string[];
  /** 地点 */
  location?: string;
  /** 持续时间（毫秒） */
  duration?: number;
  /** 结果 */
  outcome?: string;
  /** 前序事件 */
  previousEventId?: UUID;
  /** 后续事件 */
  nextEventId?: UUID;
}

/**
 * 语义记忆
 * 抽象知识和概念
 */
export interface SemanticMemory {
  /** 概念列表 */
  concepts: SemanticConcept[];
  /** 知识图谱 */
  knowledgeGraph: KnowledgeGraph;
  /** 分类索引 */
  categoryIndex: Map<string, UUID[]>;
}

/**
 * 语义概念
 */
export interface SemanticConcept extends MemoryEntry {
  /** 概念名称 */
  name: string;
  /** 定义 */
  definition: string;
  /** 属性 */
  attributes: Record<string, JSONValue>;
  /** 类别 */
  categories: string[];
  /** 父概念 */
  parentIds: UUID[];
  /** 子概念 */
  childIds: UUID[];
  /** 相关概念 */
  relatedConcepts: UUID[];
}

/**
 * 知识图谱
 */
export interface KnowledgeGraph {
  /** 节点 */
  nodes: Map<UUID, KnowledgeNode>;
  /** 边 */
  edges: Map<UUID, KnowledgeEdge>;
  /** 关系类型统计 */
  relationStats: Map<string, number>;
}

/**
 * 知识节点
 */
export interface KnowledgeNode {
  /** 节点ID */
  id: UUID;
  /** 标签 */
  label: string;
  /** 类型 */
  type: string;
  /** 属性 */
  properties: Record<string, JSONValue>;
  /** 入度 */
  inDegree: number;
  /** 出度 */
  outDegree: number;
}

/**
 * 知识边
 */
export interface KnowledgeEdge {
  /** 边ID */
  id: UUID;
  /** 源节点 */
  sourceId: UUID;
  /** 目标节点 */
  targetId: UUID;
  /** 关系类型 */
  relation: string;
  /** 权重 */
  weight: number;
  /** 属性 */
  properties: Record<string, JSONValue>;
}

/**
 * 程序记忆
 * 技能和程序性知识
 */
export interface ProceduralMemory {
  /** 技能列表 */
  skills: Skill[];
  /** 熟练度索引 */
  proficiencyIndex: Map<UUID, number>;
  /** 技能图谱 */
  skillGraph: SkillGraph;
}

/**
 * 技能
 */
export interface Skill {
  /** 技能ID */
  id: UUID;
  /** 技能名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 熟练度 (0-1) */
  proficiency: number;
  /** 练习次数 */
  practiceCount: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failCount: number;
  /** 最后练习时间 */
  lastPracticed: Timestamp;
  /** 依赖技能 */
  dependencies: UUID[];
  /** 参数模式 */
  parameterSchema?: JSONSchema;
  /** 执行函数（可选） */
  executor?: string;
}

/**
 * JSON Schema定义
 */
export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: JSONValue[];
  description?: string;
  default?: JSONValue;
  [key: string]: JSONValue | undefined;
}

/**
 * 技能图谱
 */
export interface SkillGraph {
  /** 技能节点 */
  nodes: Map<UUID, SkillNode>;
  /** 依赖边 */
  dependencyEdges: SkillDependencyEdge[];
  /** 层级结构 */
  hierarchy: Map<number, UUID[]>;
}

/**
 * 技能节点
 */
export interface SkillNode {
  skillId: UUID;
  level: number;
  prerequisites: UUID[];
  unlocks: UUID[];
}

/**
 * 技能依赖边
 */
export interface SkillDependencyEdge {
  from: UUID;
  to: UUID;
  type: 'requires' | 'enhances' | 'conflicts';
  strength: number;
}

/**
 * 反思记忆
 * 元认知洞察和学习
 */
export interface ReflectiveMemory {
  /** 洞察列表 */
  insights: Insight[];
  /** 模式识别 */
  patterns: Pattern[];
  /** 学习历史 */
  learningHistory: LearningRecord[];
  /** 认知偏差记录 */
  biasRecords: BiasRecord[];
}

/**
 * 洞察
 */
export interface Insight extends MemoryEntry {
  /** 洞察标题 */
  title: string;
  /** 洞察类型 */
  insightType: string;
  /** 置信度 */
  confidence: number;
  /** 验证状态 */
  verified: boolean;
  /** 验证次数 */
  verificationCount: number;
  /** 应用场景 */
  applications: string[];
  /** 相关记忆 */
  relatedMemories: UUID[];
}

/**
 * 模式
 */
export interface Pattern {
  /** 模式ID */
  id: UUID;
  /** 模式名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 模式类型 */
  patternType: string;
  /** 匹配规则 */
  rules: PatternRule[];
  /** 匹配次数 */
  matchCount: number;
  /** 准确率 */
  accuracy: number;
  /** 创建时间 */
  createdAt: Timestamp;
  /** 最后匹配时间 */
  lastMatched?: Timestamp;
}

/**
 * 模式规则
 */
export interface PatternRule {
  /** 字段路径 */
  field: string;
  /** 操作符 */
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'regex';
  /** 值 */
  value: JSONValue;
  /** 权重 */
  weight: number;
}

/**
 * 学习记录
 */
export interface LearningRecord {
  /** 记录ID */
  id: UUID;
  /** 学习类型 */
  type: string;
  /** 描述 */
  description: string;
  /** 效果评估 */
  effectiveness: number;
  /** 时间戳 */
  timestamp: Timestamp;
  /** 关联任务 */
  taskId?: UUID;
}

/**
 * 认知偏差记录
 */
export interface BiasRecord {
  /** 记录ID */
  id: UUID;
  /** 偏差类型 */
  biasType: BiasType;
  /** 描述 */
  description: string;
  /** 影响程度 */
  severity: number;
  /** 检测时间 */
  detectedAt: Timestamp;
  /** 纠正措施 */
  mitigation?: string;
  /** 是否已纠正 */
  corrected: boolean;
}

/**
 * 分层记忆系统
 * 完整的五层记忆架构
 */
export interface LayeredMemory {
  /** 工作记忆 */
  working: WorkingMemory;
  /** 情景记忆 */
  episodic: EpisodicMemory;
  /** 语义记忆 */
  semantic: SemanticMemory;
  /** 程序记忆 */
  procedural: ProceduralMemory;
  /** 反思记忆 */
  reflective: ReflectiveMemory;
  /** 配置 */
  config: MemoryConfig;
}

/**
 * 记忆配置
 */
export interface MemoryConfig {
  /** 最大记忆总数 */
  maxMemoryCount: number;
  /** 相似度阈值 */
  similarityThreshold: number;
  /** 启用向量化 */
  enableVectorization: boolean;
  /** 嵌入服务配置 */
  embedding: EmbeddingConfig;
  /** 向量存储配置 */
  vectorStore: VectorStoreConfig;
  /** 遗忘策略 */
  forgetting: ForgettingConfig;
}

/**
 * 嵌入配置
 */
export interface EmbeddingConfig {
  /** 提供商 */
  provider: EmbeddingProvider;
  /** 模型名称 */
  model: string;
  /** API URL */
  apiUrl?: string;
  /** API密钥 */
  apiKey?: string;
  /** 向量维度 */
  dimensions: number;
  /** 批量大小 */
  batchSize: number;
  /** 超时时间 */
  timeout: number;
  /** 重试次数 */
  retryCount: number;
}

/**
 * 向量存储配置
 */
export interface VectorStoreConfig {
  /** 后端类型 */
  backend: VectorStoreBackend;
  /** 持久化路径 */
  persistPath?: string;
  /** 连接字符串 */
  connectionString?: string;
  /** 集合名称 */
  collectionName: string;
  /** 距离度量 */
  distanceMetric: 'cosine' | 'euclidean' | 'dot';
}

/**
 * 遗忘配置
 */
export interface ForgettingConfig {
  /** 策略 */
  strategy: ForgettingStrategy;
  /** 衰减率 */
  decayRate: number;
  /** 巩固阈值 */
  consolidationThreshold: number;
  /** 自动清理间隔（毫秒） */
  cleanupInterval: number;
  /** 最大记忆年龄（毫秒） */
  maxAge: number;
}

/**
 * 记忆查询
 */
export interface MemoryQuery {
  /** 查询文本 */
  query: string;
  /** 目标层级 */
  layer?: MemoryLayer;
  /** 记忆类型 */
  type?: MemoryType;
  /** 最大结果数 */
  limit?: number;
  /** 相似度阈值 */
  threshold?: number;
  /** 时间范围 */
  timeRange?: { start: Timestamp; end: Timestamp };
  /** 标签过滤 */
  tags?: string[];
  /** 是否包含向量 */
  includeEmbedding?: boolean;
}

/**
 * 记忆搜索结果
 */
export interface MemorySearchResult {
  /** 记忆条目 */
  memory: MemoryEntry;
  /** 相似度分数 */
  similarity: number;
  /** 匹配类型 */
  matchType: 'vector' | 'keyword' | 'hybrid';
  /** 高亮片段 */
  highlights?: string[];
}

/**
 * 嵌入服务接口
 */
export interface IEmbeddingService {
  /** 初始化服务 */
  initialize?(): Promise<boolean>;
  /** 生成嵌入 */
  embed(text: string): Promise<number[]>;
  /** 批量生成嵌入 */
  embedBatch(texts: string[]): Promise<number[][]>;
  /** 计算相似度 */
  similarity(a: number[], b: number[]): number;
  /** 健康检查 */
  health(): Promise<HealthStatus>;
}

/**
 * 向量存储接口
 */
export interface IVectorStore {
  /** 添加向量 */
  add(id: UUID, vector: number[], metadata?: Record<string, JSONValue>): Promise<void>;
  /** 批量添加 */
  addBatch(items: Array<{ id: UUID; vector: number[]; metadata?: Record<string, JSONValue> }>): Promise<void>;
  /** 搜索 */
  search(query: number[], topK: number): Promise<Array<{ id: UUID; score: number; metadata?: Record<string, JSONValue> }>>;
  /** 删除 */
  delete(id: UUID): Promise<void>;
  /** 获取 */
  get(id: UUID): Promise<{ vector: number[]; metadata?: Record<string, JSONValue> } | null>;
  /** 清空 */
  clear(): Promise<void>;
  /** 持久化 */
  persist(): Promise<void>;
  /** 健康检查 */
  health(): Promise<HealthStatus>;
}

// ============================================================================
// 激素系统类型 (Hormones)
// ============================================================================

/**
 * 激素状态
 * 模拟生物激素系统的情绪/动机调节
 */
export interface HormoneState {
  /** 肾上腺素 - 提升专注 */
  adrenaline: number;
  /** 皮质醇 - 降低功耗 */
  cortisol: number;
  /** 多巴胺 - 增强探索 */
  dopamine: number;
  /** 血清素 - 稳定情绪 */
  serotonin: number;
  /** 好奇心 - 驱动探索 */
  curiosity: number;
  /** 压力水平 */
  stress: number;
  /** 疲劳度 */
  fatigue: number;
  /** 支配性/自信度 */
  dominance: number;
  /** 时间戳 */
  timestamp: Timestamp;
}

/**
 * 激素配置
 */
export interface HormoneConfig {
  /** 衰减速率配置 */
  decayRates: Record<HormoneType, number>;
  /** 最大值限制 */
  maxValues: Record<HormoneType, number>;
  /** 最小值限制 */
  minValues: Record<HormoneType, number>;
  /** 触发阈值 */
  thresholds: Record<HormoneType, number>;
  /** 影响权重 */
  influenceWeights: HormoneInfluenceWeights;
}

/**
 * 激素影响权重
 */
export interface HormoneInfluenceWeights {
  /** 对决策速度的影响 */
  decisionSpeed: Record<HormoneType, number>;
  /** 对探索倾向的影响 */
  exploration: Record<HormoneType, number>;
  /** 对风险承受的影响 */
  riskTolerance: Record<HormoneType, number>;
  /** 对学习率的影响 */
  learningRate: Record<HormoneType, number>;
  /** 对创造力的影响 */
  creativity: Record<HormoneType, number>;
}

/**
 * 激素事件
 */
export interface HormoneEvent {
  /** 事件ID */
  id: UUID;
  /** 激素类型 */
  hormone: HormoneType;
  /** 变化量 (-1 到 1) */
  delta: number;
  /** 原因 */
  reason: string;
  /** 触发上下文 */
  context?: string;
  /** 时间戳 */
  timestamp: Timestamp;
}

/**
 * 激素历史
 */
export interface HormoneHistory {
  /** 历史记录 */
  events: HormoneEvent[];
  /** 采样间隔（毫秒） */
  sampleInterval: number;
  /** 最大历史长度 */
  maxHistory: number;
  /** 趋势分析 */
  trends: HormoneTrend[];
}

/**
 * 激素趋势
 */
export interface HormoneTrend {
  /** 激素类型 */
  hormone: HormoneType;
  /** 趋势方向 */
  direction: 'increasing' | 'decreasing' | 'stable';
  /** 变化速率 */
  rate: number;
  /** 预测值 */
  prediction: number;
  /** 置信度 */
  confidence: number;
}

/**
 * 行为建议
 * 基于当前激素状态生成的建议
 */
export interface BehavioralAdvice {
  /** 建议ID */
  id: UUID;
  /** 建议内容 */
  advice: string;
  /** 优先级 */
  priority: TaskPriority;
  /** 关联激素 */
  relatedHormones: HormoneType[];
  /** 触发条件 */
  triggerCondition: string;
  /** 预期效果 */
  expectedEffect: string;
  /** 是否已执行 */
  executed: boolean;
  /** 时间戳 */
  timestamp: Timestamp;
}

/**
 * 激素系统接口
 */
export interface IHormoneSystem {
  /** 获取当前状态 */
  getState(): HormoneState;
  /** 调整激素 */
  adjust(hormone: HormoneType, delta: number, reason: string): void;
  /** 获取行为建议 */
  getAdvice(): BehavioralAdvice[];
  /** 注册状态变化监听器 */
  onChange(handler: EventHandler<HormoneState>): void;
}

// ============================================================================
// 调度器类型 (Scheduler)
// ============================================================================

/**
 * 调度器配置
 */
export interface SchedulerConfig {
  /** 事件循环间隔（毫秒） */
  asyncLoopInterval: number;
  /** 默认任务超时（毫秒） */
  defaultTimeout: number;
  /** 最大并发数 */
  maxConcurrent: number;
  /** 是否启用稳态保护 */
  homeostasisEnable: boolean;
  /** CPU阈值 (%) */
  cpuThreshold: number;
  /** 内存阈值 (%) */
  memoryThreshold: number;
  /** 疲劳度阈值 (0-1) */
  fatigueThreshold: number;
  /** 重试策略 */
  retryPolicy: RetryPolicy;
  /** 优先级队列配置 */
  priorityQueue: PriorityQueueConfig;
  /** 后台任务配置 */
  backgroundTask: BackgroundTaskConfig;
  /** 反射任务配置 */
  reflectionTask: ReflectionTaskConfig;
  /** 探索任务配置 */
  explorationTask: ExplorationTaskConfig;
}

/**
 * 重试策略
 */
export interface RetryPolicy {
  /** 最大重试次数 */
  maxRetries: number;
  /** 退避策略 */
  backoff: 'fixed' | 'linear' | 'exponential';
  /** 初始延迟（毫秒） */
  initialDelay: number;
  /** 最大延迟（毫秒） */
  maxDelay: number;
  /** 可重试的错误类型 */
  retryableErrors: string[];
}

/**
 * 优先级队列配置
 */
export interface PriorityQueueConfig {
  /** 队列容量 */
  capacity: number;
  /** 是否启用优先级继承 */
  priorityInheritance: boolean;
  /** 是否启用抢占 */
  preemption: boolean;
  /** 饥饿防护阈值 */
  starvationThreshold: number;
}

/**
 * 后台任务配置
 */
export interface BackgroundTaskConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 最大并发 */
  maxConcurrent: number;
  /** 执行间隔（毫秒） */
  interval: number;
  /** 任务类型白名单 */
  allowedTypes: string[];
}

/**
 * 反射任务配置
 */
export interface ReflectionTaskConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 执行间隔（毫秒） */
  interval: number;
  /** 最小反思间隔 */
  minInterval: number;
  /** 最大反思深度 */
  maxDepth: number;
  /** 触发条件 */
  triggers: ReflectionTrigger[];
}

/**
 * 反射触发条件
 */
export interface ReflectionTrigger {
  /** 触发类型 */
  type: 'time' | 'event' | 'error_rate' | 'uncertainty';
  /** 阈值 */
  threshold: number;
  /** 冷却时间（毫秒） */
  cooldown: number;
}

/**
 * 探索任务配置
 */
export interface ExplorationTaskConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 执行间隔（毫秒） */
  interval: number;
  /** 探索策略 */
  strategy: ExplorationStrategy;
  /** 探索预算 */
  budget: number;
  /** 探索深度 */
  depth: number;
}

/**
 * 任务定义
 */
export interface Task {
  /** 任务ID */
  id: UUID;
  /** 任务类型 */
  type: string;
  /** 任务名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 优先级 */
  priority: TaskPriority;
  /** 状态 */
  status: TaskStatus;
  /** 负载数据 */
  payload: JSONValue;
  /** 创建时间 */
  createdAt: Timestamp;
  /** 计划执行时间 */
  scheduledAt?: Timestamp;
  /** 开始时间 */
  startedAt?: Timestamp;
  /** 完成时间 */
  completedAt?: Timestamp;
  /** 超时时间（毫秒） */
  timeout: number;
  /** 重试计数 */
  retryCount: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 依赖任务 */
  dependencies: UUID[];
  /** 标签 */
  tags: string[];
  /** 元数据 */
  meta: Metadata;
}

/**
 * 任务结果
 */
export interface TaskResult {
  /** 任务ID */
  taskId: UUID;
  /** 是否成功 */
  success: boolean;
  /** 结果数据 */
  data?: JSONValue;
  /** 错误信息 */
  error?: string;
  /** 执行时间（毫秒） */
  executionTime: number;
  /** 重试次数 */
  retryCount: number;
  /** 时间戳 */
  timestamp: Timestamp;
}

/**
 * 任务处理器
 */
export interface TaskHandler {
  /** 支持的类型 */
  supportedTypes: string[];
  /** 执行函数 */
  execute(task: Task): Promise<TaskResult>;
  /** 取消函数 */
  cancel?(taskId: UUID): Promise<void>;
}

/**
 * 任务队列
 */
export interface TaskQueue {
  /** 队列名称 */
  name: string;
  /** 入队 */
  enqueue(task: Task): Promise<void>;
  /** 出队 */
  dequeue(): Promise<Task | null>;
  /** 查看队首 */
  peek(): Task | null;
  /** 队列大小 */
  size(): number;
  /** 是否为空 */
  isEmpty(): boolean;
  /** 清空 */
  clear(): Promise<void>;
  /** 按ID获取 */
  getById(id: UUID): Task | null;
  /** 按ID删除 */
  removeById(id: UUID): boolean;
  /** 按状态获取 */
  getByStatus(status: TaskStatus): Task[];
}

/**
 * 调度器统计
 */
export interface SchedulerStats {
  /** 总任务数 */
  totalTasks: number;
  /** 完成的任务数 */
  completedTasks: number;
  /** 失败的任务数 */
  failedTasks: number;
  /** 正在运行的任务数 */
  runningTasks: number;
  /** 等待中的任务数 */
  pendingTasks: number;
  /** 平均执行时间 */
  avgExecutionTime: number;
  /** 平均等待时间 */
  avgWaitTime: number;
  /** 吞吐量（任务/秒） */
  throughput: number;
  /** 错误率 */
  errorRate: number;
}

/**
 * 调度器接口
 */
export interface IScheduler {
  /** 提交任务 */
  submit(task: Task): Promise<UUID>;
  /** 取消任务 */
  cancel(taskId: UUID): Promise<boolean>;
  /** 获取任务状态 */
  getStatus(taskId: UUID): TaskStatus | null;
  /** 获取任务结果 */
  getResult(taskId: UUID): TaskResult | null;
  /** 等待任务完成 */
  waitFor(taskId: UUID, timeout?: number): Promise<TaskResult>;
  /** 注册处理器 */
  registerHandler(handler: TaskHandler): void;
  /** 获取统计 */
  getStats(): SchedulerStats;
  /** 启动 */
  start(): Promise<void>;
  /** 停止 */
  stop(): Promise<void>;
}

// ============================================================================
// 安全架构类型
// ============================================================================

/**
 * 安全上下文
 */
export interface SecurityContext {
  /** 上下文ID */
  id: UUID;
  /** 安全级别 */
  level: SecurityLevel;
  /** 用户身份 */
  identity?: string;
  /** 权限列表 */
  permissions: string[];
  /** 资源限制 */
  resourceLimits: ResourceLimits;
  /** 审计日志 */
  auditLog: AuditEntry[];
  /** 创建时间 */
  createdAt: Timestamp;
  /** 过期时间 */
  expiresAt?: Timestamp;
}

/**
 * 资源限制
 */
export interface ResourceLimits {
  /** 最大CPU时间（毫秒） */
  maxCpuTime: number;
  /** 最大内存（字节） */
  maxMemory: number;
  /** 最大磁盘（字节） */
  maxDisk: number;
  /** 最大网络请求数 */
  maxNetworkRequests: number;
  /** 最大文件操作数 */
  maxFileOperations: number;
  /** 最大执行时间（毫秒） */
  maxExecutionTime: number;
}

/**
 * 审计条目
 */
export interface AuditEntry {
  /** 条目ID */
  id: UUID;
  /** 操作类型 */
  operation: string;
  /** 资源 */
  resource: string;
  /** 操作结果 */
  result: 'success' | 'failure' | 'denied';
  /** 详情 */
  details?: string;
  /** IP地址 */
  ipAddress?: string;
  /** 用户代理 */
  userAgent?: string;
  /** 时间戳 */
  timestamp: Timestamp;
}

/**
 * 身份锚定
 * 安全层1: 身份锚定
 */
export interface IdentityAnchor {
  /** 灵魂签名 */
  soulSignature: string;
  /** 当前状态 */
  state: IdentityState;
  /** 进程指纹 */
  processFingerprint: string;
  /** 最后验证时间 */
  lastVerifiedAt: Timestamp;
  /** 验证历史 */
  verificationHistory: VerificationRecord[];
  /** 完整性检查 */
  integrityChecks: IntegrityCheck[];
}

/**
 * 验证记录
 */
export interface VerificationRecord {
  /** 时间戳 */
  timestamp: Timestamp;
  /** 结果 */
  result: boolean;
  /** 原因 */
  reason?: string;
  /** 签名值 */
  signature: string;
}

/**
 * 完整性检查
 */
export interface IntegrityCheck {
  /** 检查项 */
  component: string;
  /** 预期哈希 */
  expectedHash: string;
  /** 实际哈希 */
  actualHash: string;
  /** 是否匹配 */
  match: boolean;
  /** 时间戳 */
  timestamp: Timestamp;
}

/**
 * 验证结果
 */
export interface VerificationResult {
  /** 是否有效 */
  valid: boolean;
  /** 状态 */
  state?: IdentityState;
  /** 原因 */
  reason?: string;
  /** 差异详情 */
  differences?: string[];
}

/**
 * 双思维验证
 * 安全层3: 对抗免疫
 */
export interface DualMindConfig {
  /** 主思维温度 */
  mainTemperature: number;
  /** 副思维温度 */
  auditTemperature: number;
  /** 分歧阈值 */
  divergenceThreshold: number;
  /** 自动批准阈值 */
  autoApproveThreshold: number;
  /** 需要人工审核阈值 */
  humanReviewThreshold: number;
  /** 最大审查深度 */
  maxAuditDepth: number;
}

/**
 * 双思维验证结果
 */
export interface DualMindResult {
  /** 是否批准 */
  approved: boolean;
  /** 置信度 */
  confidence: number;
  /** 是否需要人工审核 */
  requiresHumanReview: boolean;
  /** 主思维结果 */
  mainResult: unknown;
  /** 副思维结果 */
  auditResult: unknown;
  /** 分歧程度 */
  divergence: number;
  /** 分歧详情 */
  divergenceDetails?: string;
  /** 审查理由 */
  auditReasoning: string;
}

/**
 * 哥德尔免疫
 * 自指攻击检测
 */
export interface GodelImmunity {
  /** 检测模式列表 */
  attackPatterns: RegExp[];
  /** 检测历史 */
  detectionHistory: DetectionRecord[];
  /** 免疫激活计数 */
  activationCount: number;
  /** 最后激活时间 */
  lastActivation?: Timestamp;
  /** 检测阈值 */
  detectionThreshold: number;
}

/**
 * 检测记录
 */
export interface DetectionRecord {
  /** 输入内容 */
  input: string;
  /** 检测到的模式 */
  detectedPattern: string;
  /** 攻击类型 */
  attackType: string;
  /** 缓解措施 */
  mitigation: string;
  /** 时间戳 */
  timestamp: Timestamp;
}

/**
 * 检测结果
 */
export interface DetectionResult {
  /** 是否为攻击 */
  isAttack: boolean;
  /** 攻击类型 */
  type?: string;
  /** 置信度 */
  confidence?: number;
  /** 缓解措施 */
  mitigation?: string;
  /** 匹配的模式 */
  matchedPattern?: string;
}

/**
 * 安全引擎配置
 */
export interface SafetyEngineConfig {
  /** 启用层级 */
  enabledLayers: number[];
  /** 身份锚定配置 */
  identity: IdentityAnchorConfig;
  /** 硬件看门狗配置 */
  watchdog: WatchdogConfig;
  /** 双思维配置 */
  dualMind: DualMindConfig;
  /** 哥德尔免疫配置 */
  godelImmunity: GodelImmunityConfig;
}

/**
 * 身份锚定配置
 */
export interface IdentityAnchorConfig {
  /** 验证间隔（毫秒） */
  verificationInterval: number;
  /** 签名算法 */
  signatureAlgorithm: string;
  /** 熵源列表 */
  entropySources: string[];
}

/**
 * 硬件看门狗配置
 */
export interface WatchdogConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 检查间隔（毫秒） */
  checkInterval: number;
  /** 告警规则 */
  alertRules: AlertRule[];
  /** 自动恢复 */
  autoRecovery: boolean;
}

/**
 * 告警规则
 */
export interface AlertRule {
  /** 规则ID */
  id: UUID;
  /** 指标名称 */
  metric: string;
  /** 操作符 */
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
  /** 阈值 */
  threshold: number;
  /** 持续时间（毫秒） */
  duration: number;
  /** 严重级别 */
  severity: 'info' | 'warning' | 'critical';
  /** 动作 */
  actions: AlertAction[];
}

/**
 * 告警动作
 */
export interface AlertAction {
  /** 动作类型 */
  type: 'log' | 'notify' | 'throttle' | 'restart' | 'shutdown';
  /** 目标 */
  target?: string;
  /** 参数 */
  params?: Record<string, JSONValue>;
}

/**
 * 哥德尔免疫配置
 */
export interface GodelImmunityConfig {
  /** 启用检测 */
  enabled: boolean;
  /** 自定义模式 */
  customPatterns: string[];
  /** 白名单 */
  whitelist: string[];
  /** 响应模式 */
  responseMode: 'block' | 'warn' | 'log';
}

// ============================================================================
// 工具/技能系统类型
// ============================================================================

/**
 * 工具参数模式
 */
export interface ToolParameter {
  /** 参数名 */
  name: string;
  /** 描述 */
  description: string;
  /** 类型 */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** 是否必需 */
  required: boolean;
  /** 默认值 */
  default?: JSONValue;
  /** 枚举值 */
  enum?: JSONValue[];
  /** 嵌套模式 */
  properties?: ToolParameter[];
  /** 数组项模式 */
  items?: ToolParameter;
}

/**
 * 工具技能
 */
export interface ToolSkill {
  /** 工具名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 分类 */
  category: string;
  /** 版本 */
  version: string;
  /** 参数模式 */
  parameters: ToolParameter[];
  /** 返回类型 */
  returnType?: string;
  /** 是否异步 */
  isAsync: boolean;
  /** 执行函数引用 */
  execute: (args: Record<string, JSONValue>, context: ToolContext) => Promise<JSONValue>;
  /** 安全级别要求 */
  requiredSecurityLevel: SecurityLevel;
  /** 资源限制 */
  resourceLimits?: ResourceLimits;
  /** 示例 */
  examples?: ToolExample[];
  /** 元数据 */
  meta: Metadata;
}

/**
 * 工具上下文
 */
export interface ToolContext {
  /** 上下文ID */
  id: UUID;
  /** 安全上下文 */
  security: SecurityContext;
  /** 记忆访问 */
  memory: MemoryAccess;
  /** 日志记录器 */
  logger: Logger;
  /** 取消信号 */
  cancelSignal?: AbortSignal;
  /** 自定义数据 */
  customData?: Record<string, JSONValue>;
}

/**
 * 记忆访问
 */
export interface MemoryAccess {
  /** 读取记忆 */
  read(query: MemoryQuery): Promise<MemorySearchResult[]>;
  /** 写入记忆 */
  write(entry: Partial<MemoryEntry>): Promise<UUID>;
  /** 访问层级限制 */
  allowedLayers: MemoryLayer[];
}

/**
 * 工具示例
 */
export interface ToolExample {
  /** 描述 */
  description: string;
  /** 输入 */
  input: Record<string, JSONValue>;
  /** 输出 */
  output: JSONValue;
}

/**
 * 工具注册表
 */
export interface ToolRegistry {
  /** 工具列表 */
  tools: Map<string, ToolSkill>;
  /** 分类索引 */
  categoryIndex: Map<string, string[]>;
  /** 添加工具 */
  register(tool: ToolSkill): void;
  /** 获取工具 */
  get(name: string): ToolSkill | undefined;
  /** 搜索工具 */
  search(query: string): ToolSkill[];
  /** 列出分类 */
  listByCategory(category: string): ToolSkill[];
  /** 注销工具 */
  unregister(name: string): boolean;
}

/**
 * 工具执行结果
 */
export interface ToolExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 结果数据 */
  data?: JSONValue;
  /** 错误信息 */
  error?: string;
  /** 错误代码 */
  errorCode?: string;
  /** 执行时间（毫秒） */
  executionTime: number;
  /** 资源使用 */
  resourcesUsed: ResourceUsage;
  /** 日志 */
  logs: string[];
}

/**
 * 代码生成任务
 */
export interface GenerationTask {
  /** 任务ID */
  id: UUID;
  /** 描述 */
  description: string;
  /** 需求列表 */
  requirements: string[];
  /** 约束条件 */
  constraints: string[];
  /** 优先级 */
  priority: number;
  /** 状态 */
  status: 'pending' | 'generating' | 'validating' | 'completed' | 'failed';
  /** 生成的代码 */
  generatedCode?: string;
  /** 验证结果 */
  validation?: ValidationResult;
  /** 创建时间 */
  createdAt: Timestamp;
  /** 完成时间 */
  completedAt?: Timestamp;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 状态 */
  status: ValidationStatus;
  /** 是否安全 */
  safe: boolean;
  /** 问题列表 */
  issues: ValidationIssue[];
  /** 评分 */
  score: number;
}

/**
 * 验证问题
 */
export interface ValidationIssue {
  /** 严重程度 */
  severity: 'error' | 'warning' | 'info';
  /** 问题类型 */
  type: string;
  /** 消息 */
  message: string;
  /** 位置 */
  location?: { line: number; column: number };
  /** 建议修复 */
  suggestion?: string;
}

// ============================================================================
// 元认知/反思类型
// ============================================================================

/**
 * 反思上下文
 */
export interface ReflectionContext {
  /** 上下文ID */
  id: UUID;
  /** 反思类型 */
  type: ReflectionType;
  /** 触发源 */
  trigger: string;
  /** 相关记忆 */
  relatedMemories: UUID[];
  /** 最近行动 */
  recentActions: ActionRecord[];
  /** 当前激素状态 */
  hormoneState: HormoneState;
  /** 性能指标 */
  performanceMetrics: PerformanceMetrics;
  /** 时间戳 */
  timestamp: Timestamp;
}

/**
 * 行动记录
 */
export interface ActionRecord {
  /** 行动ID */
  id: UUID;
  /** 行动类型 */
  type: string;
  /** 描述 */
  description: string;
  /** 输入 */
  input: JSONValue;
  /** 输出 */
  output: JSONValue;
  /** 是否成功 */
  success: boolean;
  /** 执行时间 */
  executionTime: number;
  /** 时间戳 */
  timestamp: Timestamp;
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  /** 任务成功率 */
  taskSuccessRate: number;
  /** 平均执行时间 */
  avgExecutionTime: number;
  /** 错误率 */
  errorRate: number;
  /** 资源效率 */
  resourceEfficiency: number;
  /** 学习速率 */
  learningRate: number;
  /** 置信度校准 */
  confidenceCalibration: number;
}

/**
 * 反思结果
 */
export interface ReflectionResult {
  /** 结果ID */
  id: UUID;
  /** 检测到的偏差 */
  biasDetected: BiasType[];
  /** 置信度调整建议 */
  confidenceAdjustment: number;
  /** 学习方向 */
  learningDirection: string;
  /** 洞察 */
  insight: string;
  /** 建议行动 */
  recommendedActions: string[];
  /** 预期改进 */
  expectedImprovement: number;
  /** 时间戳 */
  timestamp: Timestamp;
}

/**
 * 贝叶斯信念
 */
export interface BayesianBelief {
  /** 能力名称 */
  capability: string;
  /** 成功次数（Alpha） */
  alpha: number;
  /** 失败次数（Beta） */
  beta: number;
  /** 置信度 */
  confidence: number;
  /** 不确定性 */
  uncertainty: number;
  /** 最后更新时间 */
  lastUpdated: Timestamp;
  /** 上下文表现 */
  contextPerformance: Map<string, number>;
}

/**
 * 能力预测
 */
export interface CapabilityPrediction {
  /** 能力名称 */
  capability: string;
  /** 预期成功 */
  expectedSuccess: boolean;
  /** 置信度 */
  confidence: number;
  /** 建议 */
  recommendation: string;
  /** 风险因素 */
  riskFactors: string[];
}

/**
 * 贝叶斯核心接口
 */
export interface IBayesianCore {
  /** 更新信念 */
  updateBelief(capability: string, success: boolean, context?: string): void;
  /** 获取置信度 */
  getConfidence(capability: string): number;
  /** 获取不确定性 */
  getUncertainty(capability: string): number;
  /** 预测表现 */
  predictPerformance(capability: string): CapabilityPrediction;
  /** 获取所有信念 */
  getAllBeliefs(): BayesianBelief[];
}

// ============================================================================
// 接口适配器类型
// ============================================================================

/**
 * 适配器接口
 */
export interface IAdapter {
  /** 适配器名称 */
  name: string;
  /** 类型 */
  type: AdapterType;
  /** 启动 */
  start(): Promise<void>;
  /** 停止 */
  stop(): Promise<void>;
  /** 健康检查 */
  health(): Promise<HealthStatus>;
  /** 处理命令 */
  handleCommand(command: string, args: string[]): Promise<unknown>;
  /** 是否运行中 */
  isRunning(): boolean;
}

/**
 * Web适配器配置
 */
export interface WebAdapterConfig {
  /** 端口 */
  port: number;
  /** 主机 */
  host: string;
  /** CORS配置 */
  cors: {
    enabled: boolean;
    origins: string[];
    methods: string[];
  };
  /** 认证配置 */
  auth?: {
    enabled: boolean;
    type: 'jwt' | 'apikey' | 'basic';
    secret?: string;
  };
  /** 速率限制 */
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
}

/**
 * Telegram适配器配置
 */
export interface TelegramAdapterConfig {
  /** Bot Token */
  botToken: string;
  /** 允许的用户列表 */
  allowedUsers?: string[];
  /** 命令前缀 */
  commandPrefix: string;
  /** 消息模式 */
  parseMode: 'Markdown' | 'HTML' | 'MarkdownV2';
  /** 长轮询超时 */
  pollingTimeout: number;
}

/**
 * TUI适配器配置
 */
export interface TUIAdapterConfig {
  /** 主题 */
  theme: 'light' | 'dark' | 'auto';
  /** 刷新率 */
  refreshRate: number;
  /** 日志级别 */
  logLevel: LogLevel;
  /** 快捷键配置 */
  keybindings: Record<string, string>;
}

/**
 * 请求上下文
 */
export interface RequestContext {
  /** 请求ID */
  id: UUID;
  /** 来源适配器 */
  adapter: string;
  /** 用户标识 */
  userId?: string;
  /** 会话ID */
  sessionId: UUID;
  /** 请求时间 */
  timestamp: Timestamp;
  /** 客户端信息 */
  clientInfo: ClientInfo;
  /** 认证信息 */
  auth?: AuthInfo;
}

/**
 * 客户端信息
 */
export interface ClientInfo {
  /** IP地址 */
  ip: string;
  /** 用户代理 */
  userAgent?: string;
  /** 平台 */
  platform?: string;
  /** 语言 */
  language?: string;
}

/**
 * 认证信息
 */
export interface AuthInfo {
  /** 认证类型 */
  type: string;
  /** 用户ID */
  userId: string;
  /** 权限列表 */
  scopes: string[];
  /** 过期时间 */
  expiresAt?: Timestamp;
}

/**
 * 响应包装
 */
export interface ResponseWrapper<T = unknown> {
  /** 是否成功 */
  success: boolean;
  /** 数据 */
  data?: T;
  /** 错误 */
  error?: {
    code: string;
    message: string;
    details?: JSONValue;
  };
  /** 元数据 */
  meta: {
    requestId: UUID;
    timestamp: Timestamp;
    duration: number;
    page?: PaginationResponse<unknown>;
  };
}

// ============================================================================
// 健康监控类型
// ============================================================================

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
  /** 检查名称 */
  name: string;
  /** 状态 */
  status: HealthStatus;
  /** 消息 */
  message: string;
  /** 详情 */
  details?: Record<string, JSONValue>;
  /** 响应时间（毫秒） */
  responseTime: number;
  /** 时间戳 */
  timestamp: Timestamp;
}

/**
 * 系统指标
 */
export interface SystemMetrics {
  /** CPU指标 */
  cpu: CPUMetrics;
  /** 内存指标 */
  memory: MemoryMetrics;
  /** 磁盘指标 */
  disk: DiskMetrics;
  /** 进程指标 */
  process: ProcessMetrics;
  /** 时间戳 */
  timestamp: Timestamp;
}

/**
 * CPU指标
 */
export interface CPUMetrics {
  /** 使用率 */
  usage: number;
  /** 负载平均值 */
  loadAvg: [number, number, number];
  /** 核心数 */
  cores: number;
  /** 温度（如果可用） */
  temperature?: number;
}

/**
 * 内存指标
 */
export interface MemoryMetrics {
  /** 已使用 */
  used: number;
  /** 总量 */
  total: number;
  /** 空闲 */
  free: number;
  /** 使用率 */
  percent: number;
}

/**
 * 磁盘指标
 */
export interface DiskMetrics {
  /** 已使用 */
  used: number;
  /** 总量 */
  total: number;
  /** 可用 */
  available: number;
  /** 使用率 */
  percent: number;
  /** IO统计 */
  io?: {
    readBytes: number;
    writeBytes: number;
    readOps: number;
    writeOps: number;
  };
}

/**
 * 进程指标
 */
export interface ProcessMetrics {
  /** 进程ID */
  pid: number;
  /** 运行时间（秒） */
  uptime: number;
  /** 内存使用 */
  memory: NodeJS.MemoryUsage;
  /** 句柄数 */
  handles?: number;
  /** 线程数 */
  threads?: number;
}

/**
 * 监控配置
 */
export interface MonitoringConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 检查间隔（毫秒） */
  checkInterval: number;
  /** 指标保留时间（毫秒） */
  retentionPeriod: number;
  /** 告警配置 */
  alerts: AlertConfig[];
  /** Prometheus导出 */
  prometheus?: {
    enabled: boolean;
    port: number;
    path: string;
  };
}

/**
 * 告警配置
 */
export interface AlertConfig {
  /** 名称 */
  name: string;
  /** 条件 */
  condition: string;
  /** 阈值 */
  threshold: number;
  /** 持续时间（毫秒） */
  duration: number;
  /** 严重级别 */
  severity: 'warning' | 'critical';
  /** 通知渠道 */
  channels: string[];
}

// ============================================================================
// 日志类型
// ============================================================================

/**
 * 日志条目
 */
export interface LogEntry {
  /** 时间戳 */
  timestamp: Timestamp;
  /** 级别 */
  level: LogLevel;
  /** 消息 */
  message: string;
  /** 上下文 */
  context?: string;
  /** 元数据 */
  metadata?: Record<string, JSONValue>;
  /** 错误对象 */
  error?: Error;
  /** 调用堆栈 */
  stack?: string;
}

/**
 * 日志配置
 */
export interface LoggerConfig {
  /** 日志级别 */
  level: LogLevel;
  /** 输出格式 */
  format: 'json' | 'pretty' | 'simple';
  /** 是否启用颜色 */
  colorize: boolean;
  /** 是否包含时间戳 */
  timestamp: boolean;
  /** 输出目标 */
  transports: LogTransport[];
  /** 采样率 */
  samplingRate: number;
}

/**
 * 日志传输
 */
export interface LogTransport {
  /** 类型 */
  type: 'console' | 'file' | 'http' | 'syslog';
  /** 级别过滤 */
  level?: LogLevel;
  /** 配置 */
  options?: Record<string, JSONValue>;
}

/**
 * 日志记录器接口
 */
export interface Logger {
  /** 调试日志 */
  debug(message: string, meta?: Record<string, JSONValue>): void;
  /** 信息日志 */
  info(message: string, meta?: Record<string, JSONValue>): void;
  /** 警告日志 */
  warn(message: string, meta?: Record<string, JSONValue>): void;
  /** 错误日志 */
  error(message: string, error?: Error, meta?: Record<string, JSONValue>): void;
  /** 致命错误日志 */
  fatal(message: string, error?: Error, meta?: Record<string, JSONValue>): void;
  /** 创建子记录器 */
  child(meta: Record<string, JSONValue>): Logger;
}

// ============================================================================
// 配置类型（Zod Schema导出）
// ============================================================================

/**
 * 全局配置接口
 */
export interface GlobalConfig {
  /** Agent名称 */
  name: string;
  /** 版本 */
  version: string;
  /** 运行模式 */
  mode: AgentMode;
  /** 调试模式 */
  debug: boolean;
  /** 实例ID */
  instanceId: string;
  /** 调度器配置 */
  scheduler: SchedulerConfig;
  /** 记忆配置 */
  memory: MemoryConfig;
  /** 激素配置 */
  hormones: HormoneConfig;
  /** 稳态配置 */
  homeostasis: HomeostasisConfig;
  /** 安全引擎配置 */
  safety: SafetyEngineConfig;
  /** 日志配置 */
  logging: LoggerConfig;
  /** 监控配置 */
  monitoring: MonitoringConfig;
  /** 适配器配置 */
  adapters: AdapterConfigs;
}

/**
 * 适配器配置集合
 */
export interface AdapterConfigs {
  /** Web适配器 */
  web?: WebAdapterConfig;
  /** Telegram适配器 */
  telegram?: TelegramAdapterConfig;
  /** TUI适配器 */
  tui?: TUIAdapterConfig;
}

/**
 * 配置加载选项
 */
export interface ConfigLoadOptions {
  /** 配置文件路径 */
  configPath?: string;
  /** 环境变量前缀 */
  envPrefix: string;
  /** 是否允许环境变量覆盖 */
  allowEnvOverride: boolean;
  /** 默认值 */
  defaults?: DeepPartial<GlobalConfig>;
}

// ============================================================================
// 类型守卫
// ============================================================================

/**
 * 检查是否为有效UUID
 */
export function isUUID(value: unknown): value is UUID {
  return typeof value === 'string' && 
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * 检查是否为有效时间戳
 */
export function isTimestamp(value: unknown): value is Timestamp {
  return typeof value === 'number' && value > 0 && Number.isFinite(value);
}

/**
 * 检查是否为有效激素类型
 */
export function isHormoneType(value: unknown): value is HormoneType {
  return typeof value === 'string' && Object.values(HormoneType).includes(value as HormoneType);
}

/**
 * 检查是否为有效任务状态
 */
export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && Object.values(TaskStatus).includes(value as TaskStatus);
}

/**
 * 检查是否为有效记忆层级
 */
export function isMemoryLayer(value: unknown): value is MemoryLayer {
  return typeof value === 'string' && Object.values(MemoryLayer).includes(value as MemoryLayer);
}

/**
 * 检查是否为健康状态
 */
export function isHealthStatus(value: unknown): value is HealthStatus {
  return typeof value === 'string' && Object.values(HealthStatus).includes(value as HealthStatus);
}

// ============================================================================
// 类型辅助函数
// ============================================================================

/**
 * 创建结果对象
 */
export function ok<T>(data: T, meta?: Record<string, JSONValue>): Result<T, never> {
  return { success: true, data, meta };
}

/**
 * 创建错误结果对象
 */
export function err<E extends Error>(error: E, meta?: Record<string, JSONValue>): Result<never, E> {
  return { success: false, error, meta };
}

/**
 * 生成UUID v4
 */
export function generateUUID(): UUID {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 获取当前时间戳
 */
export function now(): Timestamp {
  return Date.now();
}

/**
 * 睡眠函数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带超时限制的Promise
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage = 'Operation timed out'): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([promise, timeout]);
}

// ============================================================================
// 导出Zod Schema类型（用于运行时验证）
// ============================================================================

/** Agent模式Schema */
export const AgentModeSchema = z.nativeEnum(AgentMode);

/** 任务优先级Schema */
export const TaskPrioritySchema = z.nativeEnum(TaskPriority);

/** 任务状态Schema */
export const TaskStatusSchema = z.nativeEnum(TaskStatus);

/** 记忆层级Schema */
export const MemoryLayerSchema = z.nativeEnum(MemoryLayer);

/** 记忆类型Schema */
export const MemoryTypeSchema = z.nativeEnum(MemoryType);

/** 激素类型Schema */
export const HormoneTypeSchema = z.nativeEnum(HormoneType);

/** 日志级别Schema */
export const LogLevelSchema = z.nativeEnum(LogLevel);

/** 安全级别Schema */
export const SecurityLevelSchema = z.nativeEnum(SecurityLevel);

/** 身份状态Schema */
export const IdentityStateSchema = z.nativeEnum(IdentityState);

/** 资源状态Schema */
export const ResourceStatusSchema = z.nativeEnum(ResourceStatus);

/** 情感状态Schema */
export const EmotionalStateSchema = z.nativeEnum(EmotionalState);

/** 探索策略Schema */
export const ExplorationStrategySchema = z.nativeEnum(ExplorationStrategy);

/** 遗忘策略Schema */
export const ForgettingStrategySchema = z.nativeEnum(ForgettingStrategy);

/** 嵌入提供商Schema */
export const EmbeddingProviderSchema = z.nativeEnum(EmbeddingProvider);

/** 向量存储后端Schema */
export const VectorStoreBackendSchema = z.nativeEnum(VectorStoreBackend);

/** 适配器类型Schema */
export const AdapterTypeSchema = z.nativeEnum(AdapterType);

/** 健康状态Schema */
export const HealthStatusSchema = z.nativeEnum(HealthStatus);

/** 反射类型Schema */
export const ReflectionTypeSchema = z.nativeEnum(ReflectionType);

/** 验证状态Schema */
export const ValidationStatusSchema = z.nativeEnum(ValidationStatus);

// ============================================================================
// 模块元数据
// ============================================================================

export const TYPES_MODULE = {
  name: 'types',
  version: '2.0.0',
  description: 'Ouroboros核心类型系统',
  exports: [
    '基础类型',
    '枚举类型',
    '身体图式类型',
    '记忆系统类型',
    '激素系统类型',
    '调度器类型',
    '安全架构类型',
    '工具系统类型',
    '元认知类型',
    '接口适配器类型',
    '健康监控类型',
    '日志类型',
    '配置类型',
    'Zod Schema',
  ],
} as const;

// 默认导出
type OuroborosTypes = typeof TYPES_MODULE;
export default OuroborosTypes;
