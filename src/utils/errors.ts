/**
 * Ouroboros - 错误处理框架
 * 🐍⭕ 结构化错误类型、错误分类和恢复策略
 * 
 * @version 2.0.0
 * @module utils/errors
 */

import { 
  LogLevel, 
  type JSONValue,
  type Metadata,
} from '../types.js';

// ============================================================================
// 错误代码枚举
// ============================================================================

/**
 * 错误分类代码
 */
export enum ErrorCategory {
  /** 系统错误 */
  SYSTEM = 'SYSTEM',
  /** 网络错误 */
  NETWORK = 'NETWORK',
  /** 配置错误 */
  CONFIG = 'CONFIG',
  /** 验证错误 */
  VALIDATION = 'VALIDATION',
  /** 资源错误 */
  RESOURCE = 'RESOURCE',
  /** 安全错误 */
  SECURITY = 'SECURITY',
  /** 业务逻辑错误 */
  BUSINESS = 'BUSINESS',
  /** 外部服务错误 */
  EXTERNAL = 'EXTERNAL',
  /** 内存错误 */
  MEMORY = 'MEMORY',
  /** 调度器错误 */
  SCHEDULER = 'SCHEDULER',
  /** 工具错误 */
  TOOL = 'TOOL',
  /** 未知错误 */
  UNKNOWN = 'UNKNOWN',
}

/**
 * 具体错误代码
 */
export enum ErrorCode {
  // 系统错误 (SYS)
  SYS_INTERNAL = 'SYS_INTERNAL',
  SYS_NOT_IMPLEMENTED = 'SYS_NOT_IMPLEMENTED',
  SYS_SHUTDOWN = 'SYS_SHUTDOWN',
  SYS_INITIALIZATION_FAILED = 'SYS_INITIALIZATION_FAILED',
  
  // 网络错误 (NET)
  NET_TIMEOUT = 'NET_TIMEOUT',
  NET_CONNECTION_REFUSED = 'NET_CONNECTION_REFUSED',
  NET_DNS_FAILED = 'NET_DNS_FAILED',
  NET_UNREACHABLE = 'NET_UNREACHABLE',
  
  // 配置错误 (CFG)
  CFG_INVALID = 'CFG_INVALID',
  CFG_MISSING = 'CFG_MISSING',
  CFG_PARSE_ERROR = 'CFG_PARSE_ERROR',
  CFG_VALIDATION_FAILED = 'CFG_VALIDATION_FAILED',
  
  // 验证错误 (VAL)
  VAL_INVALID_INPUT = 'VAL_INVALID_INPUT',
  VAL_SCHEMA_MISMATCH = 'VAL_SCHEMA_MISMATCH',
  VAL_TYPE_ERROR = 'VAL_TYPE_ERROR',
  VAL_RANGE_ERROR = 'VAL_RANGE_ERROR',
  
  // 资源错误 (RES)
  RES_NOT_FOUND = 'RES_NOT_FOUND',
  RES_UNAVAILABLE = 'RES_UNAVAILABLE',
  RES_EXHAUSTED = 'RES_EXHAUSTED',
  RES_QUOTA_EXCEEDED = 'RES_QUOTA_EXCEEDED',
  
  // 安全错误 (SEC)
  SEC_UNAUTHORIZED = 'SEC_UNAUTHORIZED',
  SEC_FORBIDDEN = 'SEC_FORBIDDEN',
  SEC_AUTHENTICATION_FAILED = 'SEC_AUTHENTICATION_FAILED',
  SEC_ATTACK_DETECTED = 'SEC_ATTACK_DETECTED',
  
  // 业务错误 (BIZ)
  BIZ_INVALID_STATE = 'BIZ_INVALID_STATE',
  BIZ_OPERATION_FAILED = 'BIZ_OPERATION_FAILED',
  BIZ_TIMEOUT = 'BIZ_TIMEOUT',
  BIZ_CANCELLED = 'BIZ_CANCELLED',
  
  // 外部服务错误 (EXT)
  EXT_API_ERROR = 'EXT_API_ERROR',
  EXT_RATE_LIMIT = 'EXT_RATE_LIMIT',
  EXT_SERVICE_UNAVAILABLE = 'EXT_SERVICE_UNAVAILABLE',
  EXT_RESPONSE_INVALID = 'EXT_RESPONSE_INVALID',
  
  // 内存错误 (MEM)
  MEM_NOT_FOUND = 'MEM_NOT_FOUND',
  MEM_OVERFLOW = 'MEM_OVERFLOW',
  MEM_PERSISTENCE_FAILED = 'MEM_PERSISTENCE_FAILED',
  MEM_VECTORIZATION_FAILED = 'MEM_VECTORIZATION_FAILED',
  
  // 调度器错误 (SCH)
  SCH_TASK_FAILED = 'SCH_TASK_FAILED',
  SCH_QUEUE_FULL = 'SCH_QUEUE_FULL',
  SCH_EXECUTION_TIMEOUT = 'SCH_EXECUTION_TIMEOUT',
  SCH_DEPENDENCY_CYCLE = 'SCH_DEPENDENCY_CYCLE',
  
  // 工具错误 (TOL)
  TOL_EXECUTION_FAILED = 'TOL_EXECUTION_FAILED',
  TOL_NOT_FOUND = 'TOL_NOT_FOUND',
  TOL_VALIDATION_FAILED = 'TOL_VALIDATION_FAILED',
  TOL_RESOURCE_LIMIT = 'TOL_RESOURCE_LIMIT',
  
  // 未知错误
  UNKNOWN = 'UNKNOWN',
}

/**
 * 错误严重性级别
 */
export enum ErrorSeverity {
  /** 轻微 - 可忽略 */
  LOW = 'low',
  /** 中等 - 需要关注 */
  MEDIUM = 'medium',
  /** 严重 - 需要处理 */
  HIGH = 'high',
  /** 致命 - 系统可能无法继续 */
  CRITICAL = 'critical',
  /** 紧急 - 需要立即响应 */
  EMERGENCY = 'emergency',
}

/**
 * 错误代码到分类的映射
 */
const ERROR_CODE_TO_CATEGORY: Record<ErrorCode, ErrorCategory> = {
  [ErrorCode.SYS_INTERNAL]: ErrorCategory.SYSTEM,
  [ErrorCode.SYS_NOT_IMPLEMENTED]: ErrorCategory.SYSTEM,
  [ErrorCode.SYS_SHUTDOWN]: ErrorCategory.SYSTEM,
  [ErrorCode.SYS_INITIALIZATION_FAILED]: ErrorCategory.SYSTEM,
  
  [ErrorCode.NET_TIMEOUT]: ErrorCategory.NETWORK,
  [ErrorCode.NET_CONNECTION_REFUSED]: ErrorCategory.NETWORK,
  [ErrorCode.NET_DNS_FAILED]: ErrorCategory.NETWORK,
  [ErrorCode.NET_UNREACHABLE]: ErrorCategory.NETWORK,
  
  [ErrorCode.CFG_INVALID]: ErrorCategory.CONFIG,
  [ErrorCode.CFG_MISSING]: ErrorCategory.CONFIG,
  [ErrorCode.CFG_PARSE_ERROR]: ErrorCategory.CONFIG,
  [ErrorCode.CFG_VALIDATION_FAILED]: ErrorCategory.CONFIG,
  
  [ErrorCode.VAL_INVALID_INPUT]: ErrorCategory.VALIDATION,
  [ErrorCode.VAL_SCHEMA_MISMATCH]: ErrorCategory.VALIDATION,
  [ErrorCode.VAL_TYPE_ERROR]: ErrorCategory.VALIDATION,
  [ErrorCode.VAL_RANGE_ERROR]: ErrorCategory.VALIDATION,
  
  [ErrorCode.RES_NOT_FOUND]: ErrorCategory.RESOURCE,
  [ErrorCode.RES_UNAVAILABLE]: ErrorCategory.RESOURCE,
  [ErrorCode.RES_EXHAUSTED]: ErrorCategory.RESOURCE,
  [ErrorCode.RES_QUOTA_EXCEEDED]: ErrorCategory.RESOURCE,
  
  [ErrorCode.SEC_UNAUTHORIZED]: ErrorCategory.SECURITY,
  [ErrorCode.SEC_FORBIDDEN]: ErrorCategory.SECURITY,
  [ErrorCode.SEC_AUTHENTICATION_FAILED]: ErrorCategory.SECURITY,
  [ErrorCode.SEC_ATTACK_DETECTED]: ErrorCategory.SECURITY,
  
  [ErrorCode.BIZ_INVALID_STATE]: ErrorCategory.BUSINESS,
  [ErrorCode.BIZ_OPERATION_FAILED]: ErrorCategory.BUSINESS,
  [ErrorCode.BIZ_TIMEOUT]: ErrorCategory.BUSINESS,
  [ErrorCode.BIZ_CANCELLED]: ErrorCategory.BUSINESS,
  
  [ErrorCode.EXT_API_ERROR]: ErrorCategory.EXTERNAL,
  [ErrorCode.EXT_RATE_LIMIT]: ErrorCategory.EXTERNAL,
  [ErrorCode.EXT_SERVICE_UNAVAILABLE]: ErrorCategory.EXTERNAL,
  [ErrorCode.EXT_RESPONSE_INVALID]: ErrorCategory.EXTERNAL,
  
  [ErrorCode.MEM_NOT_FOUND]: ErrorCategory.MEMORY,
  [ErrorCode.MEM_OVERFLOW]: ErrorCategory.MEMORY,
  [ErrorCode.MEM_PERSISTENCE_FAILED]: ErrorCategory.MEMORY,
  [ErrorCode.MEM_VECTORIZATION_FAILED]: ErrorCategory.MEMORY,
  
  [ErrorCode.SCH_TASK_FAILED]: ErrorCategory.SCHEDULER,
  [ErrorCode.SCH_QUEUE_FULL]: ErrorCategory.SCHEDULER,
  [ErrorCode.SCH_EXECUTION_TIMEOUT]: ErrorCategory.SCHEDULER,
  [ErrorCode.SCH_DEPENDENCY_CYCLE]: ErrorCategory.SCHEDULER,
  
  [ErrorCode.TOL_EXECUTION_FAILED]: ErrorCategory.TOOL,
  [ErrorCode.TOL_NOT_FOUND]: ErrorCategory.TOOL,
  [ErrorCode.TOL_VALIDATION_FAILED]: ErrorCategory.TOOL,
  [ErrorCode.TOL_RESOURCE_LIMIT]: ErrorCategory.TOOL,
  
  [ErrorCode.UNKNOWN]: ErrorCategory.UNKNOWN,
};

/**
 * 错误代码到严重性的映射
 */
const ERROR_CODE_TO_SEVERITY: Record<ErrorCode, ErrorSeverity> = {
  [ErrorCode.SYS_INTERNAL]: ErrorSeverity.HIGH,
  [ErrorCode.SYS_NOT_IMPLEMENTED]: ErrorSeverity.MEDIUM,
  [ErrorCode.SYS_SHUTDOWN]: ErrorSeverity.CRITICAL,
  [ErrorCode.SYS_INITIALIZATION_FAILED]: ErrorSeverity.CRITICAL,
  
  [ErrorCode.NET_TIMEOUT]: ErrorSeverity.MEDIUM,
  [ErrorCode.NET_CONNECTION_REFUSED]: ErrorSeverity.HIGH,
  [ErrorCode.NET_DNS_FAILED]: ErrorSeverity.MEDIUM,
  [ErrorCode.NET_UNREACHABLE]: ErrorSeverity.HIGH,
  
  [ErrorCode.CFG_INVALID]: ErrorSeverity.HIGH,
  [ErrorCode.CFG_MISSING]: ErrorSeverity.CRITICAL,
  [ErrorCode.CFG_PARSE_ERROR]: ErrorSeverity.HIGH,
  [ErrorCode.CFG_VALIDATION_FAILED]: ErrorSeverity.HIGH,
  
  [ErrorCode.VAL_INVALID_INPUT]: ErrorSeverity.LOW,
  [ErrorCode.VAL_SCHEMA_MISMATCH]: ErrorSeverity.MEDIUM,
  [ErrorCode.VAL_TYPE_ERROR]: ErrorSeverity.LOW,
  [ErrorCode.VAL_RANGE_ERROR]: ErrorSeverity.LOW,
  
  [ErrorCode.RES_NOT_FOUND]: ErrorSeverity.MEDIUM,
  [ErrorCode.RES_UNAVAILABLE]: ErrorSeverity.HIGH,
  [ErrorCode.RES_EXHAUSTED]: ErrorSeverity.CRITICAL,
  [ErrorCode.RES_QUOTA_EXCEEDED]: ErrorSeverity.HIGH,
  
  [ErrorCode.SEC_UNAUTHORIZED]: ErrorSeverity.HIGH,
  [ErrorCode.SEC_FORBIDDEN]: ErrorSeverity.HIGH,
  [ErrorCode.SEC_AUTHENTICATION_FAILED]: ErrorSeverity.HIGH,
  [ErrorCode.SEC_ATTACK_DETECTED]: ErrorSeverity.EMERGENCY,
  
  [ErrorCode.BIZ_INVALID_STATE]: ErrorSeverity.MEDIUM,
  [ErrorCode.BIZ_OPERATION_FAILED]: ErrorSeverity.MEDIUM,
  [ErrorCode.BIZ_TIMEOUT]: ErrorSeverity.MEDIUM,
  [ErrorCode.BIZ_CANCELLED]: ErrorSeverity.LOW,
  
  [ErrorCode.EXT_API_ERROR]: ErrorSeverity.MEDIUM,
  [ErrorCode.EXT_RATE_LIMIT]: ErrorSeverity.LOW,
  [ErrorCode.EXT_SERVICE_UNAVAILABLE]: ErrorSeverity.HIGH,
  [ErrorCode.EXT_RESPONSE_INVALID]: ErrorSeverity.MEDIUM,
  
  [ErrorCode.MEM_NOT_FOUND]: ErrorSeverity.LOW,
  [ErrorCode.MEM_OVERFLOW]: ErrorSeverity.HIGH,
  [ErrorCode.MEM_PERSISTENCE_FAILED]: ErrorSeverity.MEDIUM,
  [ErrorCode.MEM_VECTORIZATION_FAILED]: ErrorSeverity.LOW,
  
  [ErrorCode.SCH_TASK_FAILED]: ErrorSeverity.MEDIUM,
  [ErrorCode.SCH_QUEUE_FULL]: ErrorSeverity.HIGH,
  [ErrorCode.SCH_EXECUTION_TIMEOUT]: ErrorSeverity.MEDIUM,
  [ErrorCode.SCH_DEPENDENCY_CYCLE]: ErrorSeverity.HIGH,
  
  [ErrorCode.TOL_EXECUTION_FAILED]: ErrorSeverity.MEDIUM,
  [ErrorCode.TOL_NOT_FOUND]: ErrorSeverity.LOW,
  [ErrorCode.TOL_VALIDATION_FAILED]: ErrorSeverity.MEDIUM,
  [ErrorCode.TOL_RESOURCE_LIMIT]: ErrorSeverity.HIGH,
  
  [ErrorCode.UNKNOWN]: ErrorSeverity.HIGH,
};

// ============================================================================
// 基础错误类
// ============================================================================

/**
 * Ouroboros基础错误类
 * 所有自定义错误的基类
 */
export class OuroborosError extends Error {
  /** 错误代码 */
  readonly code: ErrorCode;
  /** 错误分类 */
  readonly category: ErrorCategory;
  /** 错误严重性 */
  readonly severity: ErrorSeverity;
  /** HTTP状态码（如果适用） */
  readonly statusCode: number;
  /** 错误元数据 */
  readonly metadata: Record<string, JSONValue>;
  /** 原始错误 */
  readonly cause?: Error;
  /** 错误ID */
  readonly errorId: string;
  /** 时间戳 */
  readonly timestamp: number;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN,
    options: {
      statusCode?: number;
      metadata?: Record<string, JSONValue>;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.category = ERROR_CODE_TO_CATEGORY[code];
    this.severity = ERROR_CODE_TO_SEVERITY[code];
    this.statusCode = options.statusCode || this.getDefaultStatusCode();
    this.metadata = options.metadata || {};
    this.cause = options.cause;
    this.errorId = this.generateErrorId();
    this.timestamp = Date.now();

    // 确保原型链正确
    Object.setPrototypeOf(this, OuroborosError.prototype);
  }

  /**
   * 获取默认HTTP状态码
   */
  private getDefaultStatusCode(): number {
    switch (this.category) {
      case ErrorCategory.VALIDATION:
        return 400;
      case ErrorCategory.SECURITY:
        return this.code === ErrorCode.SEC_UNAUTHORIZED ? 401 : 403;
      case ErrorCategory.RESOURCE:
        return 404;
      case ErrorCategory.EXTERNAL:
        return 502;
      case ErrorCategory.BUSINESS:
        return 409;
      default:
        return 500;
    }
  }

  /**
   * 生成错误ID
   */
  private generateErrorId(): string {
    return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  /**
   * 转换为JSON
   */
  toJSON(): Record<string, JSONValue> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      severity: this.severity,
      statusCode: this.statusCode,
      errorId: this.errorId,
      timestamp: this.timestamp,
      metadata: this.metadata as JSONValue,
      stack: this.stack,
      cause: this.cause ? {
        message: this.cause.message,
        stack: this.cause.stack,
      } : undefined,
    };
  }

  /**
   * 转换为字符串
   */
  toString(): string {
    return `[${this.code}] ${this.message} (ID: ${this.errorId})`;
  }

  /**
   * 获取日志级别
   */
  getLogLevel(): LogLevel {
    switch (this.severity) {
      case ErrorSeverity.LOW:
        return LogLevel.DEBUG;
      case ErrorSeverity.MEDIUM:
        return LogLevel.WARN;
      case ErrorSeverity.HIGH:
        return LogLevel.ERROR;
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.EMERGENCY:
        return LogLevel.FATAL;
      default:
        return LogLevel.ERROR;
    }
  }

  /**
   * 是否可恢复
   */
  isRecoverable(): boolean {
    return this.severity < ErrorSeverity.CRITICAL;
  }

  /**
   * 添加元数据
   */
  withMetadata(metadata: Record<string, JSONValue>): this {
    Object.assign(this.metadata, metadata);
    return this;
  }

  /**
   * 创建子错误
   */
  static from(
    error: Error,
    code: ErrorCode = ErrorCode.UNKNOWN,
    message?: string
  ): OuroborosError {
    if (error instanceof OuroborosError) {
      return error;
    }
    return new OuroborosError(
      message || error.message,
      code,
      { cause: error }
    );
  }
}

// ============================================================================
// 具体错误类
// ============================================================================

/**
 * 配置错误
 */
export class ConfigError extends OuroborosError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.CFG_INVALID,
    options?: { cause?: Error; metadata?: Record<string, JSONValue> }
  ) {
    super(message, code, options);
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

/**
 * 验证错误
 */
export class ValidationError extends OuroborosError {
  /** 验证错误详情 */
  readonly validationErrors: Array<{ field: string; message: string; value?: unknown }>;

  constructor(
    message: string,
    validationErrors: Array<{ field: string; message: string; value?: unknown }> = [],
    options?: { cause?: Error; metadata?: Record<string, JSONValue> }
  ) {
    super(message, ErrorCode.VAL_INVALID_INPUT, options);
    this.validationErrors = validationErrors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }

  override toJSON(): Record<string, JSONValue> {
    return {
      ...super.toJSON(),
      validationErrors: this.validationErrors as unknown as JSONValue,
    };
  }
}

/**
 * 资源错误
 */
export class ResourceError extends OuroborosError {
  /** 资源名称 */
  readonly resourceName: string;

  constructor(
    message: string,
    resourceName: string,
    code: ErrorCode = ErrorCode.RES_NOT_FOUND,
    options?: { cause?: Error; metadata?: Record<string, JSONValue> }
  ) {
    super(message, code, options);
    this.resourceName = resourceName;
    Object.setPrototypeOf(this, ResourceError.prototype);
  }
}

/**
 * 安全错误
 */
export class SecurityError extends OuroborosError {
  /** 攻击类型（如果是攻击检测） */
  readonly attackType?: string;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.SEC_UNAUTHORIZED,
    options?: { 
      cause?: Error; 
      metadata?: Record<string, JSONValue>;
      attackType?: string;
    }
  ) {
    super(message, code, options);
    this.attackType = options?.attackType;
    Object.setPrototypeOf(this, SecurityError.prototype);
  }
}

/**
 * 网络错误
 */
export class NetworkError extends OuroborosError {
  /** 重试次数 */
  readonly retryCount: number;
  /** 是否可重试 */
  readonly retryable: boolean;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.NET_TIMEOUT,
    options?: { 
      cause?: Error; 
      metadata?: Record<string, JSONValue>;
      retryCount?: number;
      retryable?: boolean;
    }
  ) {
    super(message, code, options);
    this.retryCount = options?.retryCount || 0;
    this.retryable = options?.retryable ?? this.isRetryableCode(code);
    Object.setPrototypeOf(this, NetworkError.prototype);
  }

  private isRetryableCode(code: ErrorCode): boolean {
    return [
      ErrorCode.NET_TIMEOUT,
      ErrorCode.NET_CONNECTION_REFUSED,
      ErrorCode.NET_DNS_FAILED,
      ErrorCode.EXT_RATE_LIMIT,
      ErrorCode.EXT_SERVICE_UNAVAILABLE,
    ].includes(code);
  }
}

/**
 * 内存错误
 */
export class MemoryError extends OuroborosError {
  /** 内存操作 */
  readonly operation: string;

  constructor(
    message: string,
    operation: string,
    code: ErrorCode = ErrorCode.MEM_NOT_FOUND,
    options?: { cause?: Error; metadata?: Record<string, JSONValue> }
  ) {
    super(message, code, options);
    this.operation = operation;
    Object.setPrototypeOf(this, MemoryError.prototype);
  }
}

/**
 * 调度器错误
 */
export class SchedulerError extends OuroborosError {
  /** 任务ID */
  readonly taskId?: string;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.SCH_TASK_FAILED,
    options?: { 
      cause?: Error; 
      metadata?: Record<string, JSONValue>;
      taskId?: string;
    }
  ) {
    super(message, code, options);
    this.taskId = options?.taskId;
    Object.setPrototypeOf(this, SchedulerError.prototype);
  }
}

/**
 * 工具错误
 */
export class ToolError extends OuroborosError {
  /** 工具名称 */
  readonly toolName: string;

  constructor(
    message: string,
    toolName: string,
    code: ErrorCode = ErrorCode.TOL_EXECUTION_FAILED,
    options?: { cause?: Error; metadata?: Record<string, JSONValue> }
  ) {
    super(message, code, options);
    this.toolName = toolName;
    Object.setPrototypeOf(this, ToolError.prototype);
  }
}

/**
 * 超时错误
 */
export class TimeoutError extends OuroborosError {
  /** 超时时间（毫秒） */
  readonly timeoutMs: number;
  /** 操作名称 */
  readonly operation: string;

  constructor(
    message: string,
    operation: string,
    timeoutMs: number,
    options?: { cause?: Error; metadata?: Record<string, JSONValue> }
  ) {
    super(message, ErrorCode.BIZ_TIMEOUT, options);
    this.operation = operation;
    this.timeoutMs = timeoutMs;
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * 取消错误
 */
export class CancellationError extends OuroborosError {
  /** 取消原因 */
  readonly reason?: string;

  constructor(
    message: string = 'Operation was cancelled',
    reason?: string,
    options?: { cause?: Error; metadata?: Record<string, JSONValue> }
  ) {
    super(message, ErrorCode.BIZ_CANCELLED, options);
    this.reason = reason;
    Object.setPrototypeOf(this, CancellationError.prototype);
  }
}

// ============================================================================
// 错误聚合
// ============================================================================

/**
 * 聚合错误
 * 包含多个错误的集合
 */
export class AggregateError extends OuroborosError {
  /** 子错误列表 */
  readonly errors: OuroborosError[];

  constructor(
    message: string,
    errors: OuroborosError[],
    options?: { metadata?: Record<string, JSONValue> }
  ) {
    super(message, ErrorCode.UNKNOWN, options);
    this.errors = errors;
    Object.setPrototypeOf(this, AggregateError.prototype);
  }

  /**
   * 获取最严重的错误
   */
  getMostSevere(): OuroborosError {
    const severityOrder = [
      ErrorSeverity.LOW,
      ErrorSeverity.MEDIUM,
      ErrorSeverity.HIGH,
      ErrorSeverity.CRITICAL,
      ErrorSeverity.EMERGENCY,
    ];

    return this.errors.reduce((mostSevere, error) => {
      const currentIndex = severityOrder.indexOf(error.severity);
      const mostIndex = severityOrder.indexOf(mostSevere.severity);
      return currentIndex > mostIndex ? error : mostSevere;
    }, this.errors[0]);
  }

  override toJSON(): Record<string, JSONValue> {
    return {
      ...super.toJSON(),
      errors: this.errors.map(e => e.toJSON()),
    };
  }
}

// ============================================================================
// 错误处理工具
// ============================================================================

/**
 * 错误处理器
 */
export type ErrorHandler = (error: OuroborosError) => void | Promise<void>;

/**
 * 错误恢复策略
 */
export type RecoveryStrategy = (error: OuroborosError) => boolean | Promise<boolean>;

/**
 * 错误管理器
 */
export class ErrorManager {
  private handlers: Map<ErrorCategory, ErrorHandler[]> = new Map();
  private recoveryStrategies: Map<ErrorCode, RecoveryStrategy> = new Map();
  private globalHandlers: ErrorHandler[] = [];
  private errorHistory: OuroborosError[] = [];
  private maxHistorySize: number = 100;

  /**
   * 注册分类处理器
   */
  on(category: ErrorCategory, handler: ErrorHandler): () => void {
    const handlers = this.handlers.get(category) || [];
    handlers.push(handler);
    this.handlers.set(category, handlers);

    return () => {
      const idx = handlers.indexOf(handler);
      if (idx > -1) handlers.splice(idx, 1);
    };
  }

  /**
   * 注册全局处理器
   */
  onAny(handler: ErrorHandler): () => void {
    this.globalHandlers.push(handler);
    return () => {
      const idx = this.globalHandlers.indexOf(handler);
      if (idx > -1) this.globalHandlers.splice(idx, 1);
    };
  }

  /**
   * 注册恢复策略
   */
  registerRecovery(code: ErrorCode, strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(code, strategy);
  }

  /**
   * 处理错误
   */
  async handle(error: Error | OuroborosError): Promise<void> {
    const ouroError = error instanceof OuroborosError 
      ? error 
      : OuroborosError.from(error);

    // 记录错误
    this.recordError(ouroError);

    // 执行全局处理器
    for (const handler of this.globalHandlers) {
      try {
        await handler(ouroError);
      } catch (e) {
        console.error('Global error handler failed:', e);
      }
    }

    // 执行分类处理器
    const categoryHandlers = this.handlers.get(ouroError.category) || [];
    for (const handler of categoryHandlers) {
      try {
        await handler(ouroError);
      } catch (e) {
        console.error('Category error handler failed:', e);
      }
    }

    // 尝试恢复
    await this.attemptRecovery(ouroError);
  }

  /**
   * 记录错误
   */
  private recordError(error: OuroborosError): void {
    this.errorHistory.push(error);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
  }

  /**
   * 尝试恢复
   */
  private async attemptRecovery(error: OuroborosError): Promise<boolean> {
    const strategy = this.recoveryStrategies.get(error.code);
    if (!strategy) return false;

    try {
      return await strategy(error);
    } catch (e) {
      console.error('Recovery strategy failed:', e);
      return false;
    }
  }

  /**
   * 获取错误历史
   */
  getHistory(options?: { 
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    limit?: number;
  }): OuroborosError[] {
    let history = [...this.errorHistory];

    if (options?.category) {
      history = history.filter(e => e.category === options.category);
    }

    if (options?.severity) {
      history = history.filter(e => e.severity === options.severity);
    }

    if (options?.limit) {
      history = history.slice(-options.limit);
    }

    return history;
  }

  /**
   * 获取错误统计
   */
  getStats(): {
    total: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
  } {
    const byCategory = {} as Record<ErrorCategory, number>;
    const bySeverity = {} as Record<ErrorSeverity, number>;

    for (const error of this.errorHistory) {
      byCategory[error.category] = (byCategory[error.category] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    }

    return {
      total: this.errorHistory.length,
      byCategory,
      bySeverity,
    };
  }

  /**
   * 清空历史
   */
  clearHistory(): void {
    this.errorHistory = [];
  }
}

// ============================================================================
// 错误边界
// ============================================================================

/**
 * 函数包装器
 * 将函数包装在错误处理中
 */
export function withErrorHandling<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: {
    onError?: (error: OuroborosError) => void;
    defaultValue?: ReturnType<T>;
    rethrow?: boolean;
  } = {}
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  return (...args: Parameters<T>): ReturnType<T> | undefined => {
    try {
      return fn(...args) as ReturnType<T>;
    } catch (error) {
      const ouroError = error instanceof OuroborosError
        ? error
        : OuroborosError.from(error as Error);

      options.onError?.(ouroError);

      if (options.rethrow) {
        throw ouroError;
      }

      return options.defaultValue as ReturnType<T>;
    }
  };
}

/**
 * 异步函数包装器
 */
export function withAsyncErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: {
    onError?: (error: OuroborosError) => void | Promise<void>;
    defaultValue?: Awaited<ReturnType<T>>;
    rethrow?: boolean;
  } = {}
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | undefined> {
  return async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>> | undefined> => {
    try {
      return await fn(...args) as Awaited<ReturnType<T>>;
    } catch (error) {
      const ouroError = error instanceof OuroborosError
        ? error
        : OuroborosError.from(error as Error);

      await options.onError?.(ouroError);

      if (options.rethrow) {
        throw ouroError;
      }

      return options.defaultValue as Awaited<ReturnType<T>>;
    }
  };
}

/**
 * 重试包装器
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    backoff?: 'fixed' | 'linear' | 'exponential';
    onRetry?: (error: Error, attempt: number) => void;
    retryable?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const { 
    maxRetries = 3, 
    delay = 1000, 
    backoff = 'exponential',
    onRetry,
    retryable = () => true,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries || !retryable(lastError)) {
        throw lastError;
      }

      onRetry?.(lastError, attempt + 1);

      const waitTime = backoff === 'exponential' 
        ? delay * Math.pow(2, attempt)
        : backoff === 'linear'
          ? delay * (attempt + 1)
          : delay;

      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
}

/**
 * 超时包装器
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string = 'operation'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(
        `${operation} timed out after ${timeoutMs}ms`,
        operation,
        timeoutMs
      ));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

// ============================================================================
// 类型守卫
// ============================================================================

/**
 * 检查是否为Ouroboros错误
 */
export function isOuroborosError(error: unknown): error is OuroborosError {
  return error instanceof OuroborosError;
}

/**
 * 检查是否为特定错误代码
 */
export function isErrorCode(error: unknown, code: ErrorCode): boolean {
  return isOuroborosError(error) && error.code === code;
}

/**
 * 检查是否为特定分类
 */
export function isErrorCategory(error: unknown, category: ErrorCategory): boolean {
  return isOuroborosError(error) && error.category === category;
}

/**
 * 检查是否为可恢复错误
 */
export function isRecoverableError(error: unknown): boolean {
  return isOuroborosError(error) && error.isRecoverable();
}

/**
 * 检查是否为网络错误
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * 检查是否为安全错误
 */
export function isSecurityError(error: unknown): error is SecurityError {
  return error instanceof SecurityError;
}

// ============================================================================
// 导出
// ============================================================================

export const ERRORS_MODULE = {
  name: 'errors',
  version: '2.0.0',
  description: 'Ouroboros错误处理框架',
  exports: [
    'OuroborosError',
    'ConfigError',
    'ValidationError',
    'ResourceError',
    'SecurityError',
    'NetworkError',
    'MemoryError',
    'SchedulerError',
    'ToolError',
    'TimeoutError',
    'CancellationError',
    'AggregateError',
    'ErrorManager',
    'ErrorCode',
    'ErrorCategory',
    'ErrorSeverity',
    'withRetry',
    'withTimeout',
    'withErrorHandling',
  ],
} as const;

export default OuroborosError;
