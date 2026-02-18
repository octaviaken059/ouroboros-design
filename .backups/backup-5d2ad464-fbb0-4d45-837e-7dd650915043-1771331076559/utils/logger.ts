/**
 * Ouroboros - 日志系统
 * 🐍⭕ 基于Winston的结构化日志系统
 * 
 * @version 2.0.0
 * @module utils/logger
 */

import winston, { 
  Logger as WinstonLogger, 
  createLogger as createWinstonLogger, 
  format, 
  transports
} from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import os from 'os';
import { 
  LogLevel, 
  type LogEntry, 
  type Logger as ILogger,
  type LoggerConfig,
  type LogTransport,
  type Metadata,
  type JSONValue,
} from '../types.js';

// ============================================================================
// 日志级别映射
// ============================================================================

/** Winston日志级别映射 */
const LOG_LEVEL_MAP: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARN]: 'warn',
  [LogLevel.ERROR]: 'error',
  [LogLevel.FATAL]: 'error', // Winston没有fatal级别，映射到error
};

/** 日志级别优先级（数字越小优先级越高） */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 5,
  [LogLevel.INFO]: 4,
  [LogLevel.WARN]: 3,
  [LogLevel.ERROR]: 2,
  [LogLevel.FATAL]: 1,
};

/** 日志级别颜色 */
const LOG_LEVEL_COLORS: Record<string, string> = {
  debug: '\x1b[36m',    // Cyan
  info: '\x1b[32m',     // Green
  warn: '\x1b[33m',     // Yellow
  error: '\x1b[31m',    // Red
  fatal: '\x1b[35m',    // Magenta
};

const COLOR_RESET = '\x1b[0m';

// ============================================================================
// 格式处理器
// ============================================================================

/**
 * 创建错误格式化器
 * 处理Error对象的序列化
 */
const errorFormatter = format((info: any) => {
  if (info.error instanceof Error) {
    info.error = {
      message: info.error.message,
      name: info.error.name,
      stack: info.error.stack,
    };
  }
  return info;
});

/**
 * 创建时间戳格式化器
 */
const timestampFormatter = format.timestamp({
  format: 'YYYY-MM-DD HH:mm:ss.SSS',
});

/**
 * 创建JSON格式化器
 */
const jsonFormatter = format.combine(
  errorFormatter(),
  timestampFormatter,
  format.json()
);

/**
 * 创建美观格式化器
 */
const prettyFormatter = format.combine(
  errorFormatter(),
  timestampFormatter,
  format.printf((info: any) => {
    const { timestamp, level, message, context, ...metadata } = info;
    const color = LOG_LEVEL_COLORS[level as string] || '';
    const levelStr = level.toUpperCase().padEnd(5);
    const contextStr = context ? ` [${context}]` : '';
    
    let output = `${timestamp} ${color}${levelStr}${COLOR_RESET}${contextStr}: ${message}`;
    
    // 添加元数据（如果有）
    const metaKeys = Object.keys(metadata).filter(
      key => key !== 'error' && key !== 'splat'
    );
    
    if (metaKeys.length > 0) {
      const meta = metaKeys.reduce((acc, key) => {
        acc[key] = metadata[key];
        return acc;
      }, {} as unknown as Record<string, JSONValue>);
      output += ` ${JSON.stringify(meta)}`;
    }
    
    // 添加错误详情
    if (metadata.error) {
      const err = metadata.error as { message: string; stack?: string };
      output += `\n  Error: ${err.message}`;
      if (err.stack) {
        output += `\n  Stack: ${err.stack.split('\n').slice(1, 4).join('\n         ')}`;
      }
    }
    
    return output;
  })
);

/**
 * 创建简单格式化器
 */
const simpleFormatter = format.combine(
  format.printf((info: any) => {
    const { level, message } = info;
    return `[${level.toUpperCase()}] ${message}`;
  })
);

// ============================================================================
// 传输层创建
// ============================================================================

/**
 * 获取日志目录
 */
function getLogDirectory(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, '.ouroboros', 'logs');
}

/**
 * 创建传输层
 */
function createTransport(config: LogTransport): any {
  const level = config.level ? LOG_LEVEL_MAP[config.level] : undefined;

  switch (config.type) {
    case 'console':
      return new transports.Console({
        level,
        stderrLevels: ['error'],
        consoleWarnLevels: ['warn'],
      });

    case 'file': {
      const filename = config.options?.filename as string || 
        path.join(getLogDirectory(), 'ouroboros.log');
      
      return new DailyRotateFile({
        level,
        filename: filename.replace('.log', '-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: (config.options?.maxSize as string) || '20m',
        maxFiles: (config.options?.maxFiles as string) || '14d',
      });
    }

    case 'http':
      return new transports.Http({
        level,
        host: config.options?.host as string || 'localhost',
        port: config.options?.port as number || 3000,
        path: config.options?.path as string || '/log',
        ssl: config.options?.ssl as boolean || false,
      });

    case 'syslog':
      // syslog传输需要额外包，这里返回文件传输作为降级
      console.warn('Syslog transport not implemented, falling back to file');
      return new transports.File({
        level,
        filename: path.join(getLogDirectory(), 'syslog-fallback.log'),
      });

    default:
      throw new Error(`Unknown transport type: ${config.type}`);
  }
}

// ============================================================================
// OuroborosLogger 类
// ============================================================================

/**
 * Ouroboros日志记录器
 * 实现了ILogger接口，基于Winston
 */
export class OuroborosLogger implements ILogger {
  private winstonLogger: WinstonLogger;
  private config: LoggerConfig;
  private metadata: Record<string, JSONValue> = {};
  private samplingRate: number = 1.0;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      format: 'pretty',
      colorize: true,
      timestamp: true,
      transports: [{ type: 'console' }],
      samplingRate: 1.0,
      ...config,
    };

    this.samplingRate = this.config.samplingRate;
    this.winstonLogger = this.createWinstonLogger();
  }

  /**
   * 创建Winston Logger实例
   */
  private createWinstonLogger(): WinstonLogger {
    const formatters: any[] = [];

    // 添加时间戳
    if (this.config.timestamp) {
      formatters.push(timestampFormatter);
    }

    // 添加格式
    switch (this.config.format) {
      case 'json':
        formatters.push(jsonFormatter);
        break;
      case 'simple':
        formatters.push(simpleFormatter);
        break;
      case 'pretty':
      default:
        formatters.push(prettyFormatter);
        break;
    }

    // 颜色化（仅用于pretty格式和控制台）
    if (this.config.colorize && this.config.format === 'pretty') {
      formatters.unshift(format.colorize({ all: true }));
    }

    // 合并格式
    const logFormat = formatters.length > 0 
      ? format.combine(...formatters)
      : format.simple();

    // 创建传输层
    const transportInstances = this.config.transports.map(createTransport);

    return createWinstonLogger({
      level: LOG_LEVEL_MAP[this.config.level],
      format: logFormat,
      transports: transportInstances,
      exitOnError: false,
      exceptionHandlers: transportInstances,
      rejectionHandlers: transportInstances,
    }) as any;
  }

  /**
   * 检查是否应该采样
   */
  private shouldLog(): boolean {
    if (this.samplingRate >= 1.0) return true;
    return Math.random() < this.samplingRate;
  }

  /**
   * 构建日志元数据
   */
  private buildMeta(
    additionalMeta?: Record<string, JSONValue>,
    error?: Error
  ): Record<string, JSONValue> {
    return {
      ...this.metadata,
      ...additionalMeta,
      ...(error && { error: error.message }),
    } as Record<string, JSONValue>;
  }

  /**
   * 记录调试日志
   */
  debug(message: string, meta?: Record<string, JSONValue>): void {
    if (!this.shouldLog()) return;
    this.winstonLogger.debug(message, this.buildMeta(meta));
  }

  /**
   * 记录信息日志
   */
  info(message: string, meta?: Record<string, JSONValue>): void {
    if (!this.shouldLog()) return;
    this.winstonLogger.info(message, this.buildMeta(meta));
  }

  /**
   * 记录警告日志
   */
  warn(message: string, meta?: Record<string, JSONValue>): void {
    if (!this.shouldLog()) return;
    this.winstonLogger.warn(message, this.buildMeta(meta));
  }

  /**
   * 记录错误日志
   */
  error(message: string, error?: Error, meta?: Record<string, JSONValue>): void {
    if (!this.shouldLog()) return;
    this.winstonLogger.error(message, this.buildMeta(meta, error));
  }

  /**
   * 记录致命错误日志
   */
  fatal(message: string, error?: Error, meta?: Record<string, JSONValue>): void {
    if (!this.shouldLog()) return;
    // Winston没有fatal级别，使用error并添加标记
    this.winstonLogger.error(`[FATAL] ${message}`, {
      ...this.buildMeta(meta, error),
      fatal: true,
    });
  }

  /**
   * 创建子记录器
   */
  child(meta: Record<string, JSONValue>): ILogger {
    const childLogger = new OuroborosLogger(this.config);
    childLogger.metadata = { ...this.metadata, ...meta };
    childLogger.samplingRate = this.samplingRate;
    return childLogger;
  }

  /**
   * 添加上下文
   */
  addContext(key: string, value: unknown): void {
    this.metadata[key] = value as JSONValue;
  }

  /**
   * 移除上下文
   */
  removeContext(key: string): void {
    delete this.metadata[key];
  }

  /**
   * 清空上下文
   */
  clearContext(): void {
    this.metadata = {};
  }

  /**
   * 获取当前配置
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    this.samplingRate = this.config.samplingRate;
    
    // 关闭旧logger
    this.winstonLogger.close();
    
    // 创建新logger
    this.winstonLogger = this.createWinstonLogger();
  }

  /**
   * 关闭日志记录器
   */
  close(): Promise<void> {
    return new Promise((resolve) => {
      this.winstonLogger.on('finish', resolve);
      this.winstonLogger.end();
    });
  }

  /**
   * 刷新日志缓冲区
   */
  flush(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.winstonLogger.on('finish', resolve);
      this.winstonLogger.on('error', reject);
      this.winstonLogger.end();
    });
  }
}

// ============================================================================
// 日志管理器（单例）
// ============================================================================

/**
 * 日志管理器
 * 提供全局日志记录器实例管理
 */
export class LoggerManager {
  private static instance: LoggerManager | null = null;
  private loggers: Map<string, OuroborosLogger> = new Map();
  private defaultLogger: OuroborosLogger | null = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): LoggerManager {
    if (!LoggerManager.instance) {
      LoggerManager.instance = new LoggerManager();
    }
    return LoggerManager.instance;
  }

  /**
   * 创建日志记录器
   */
  create(name: string, config?: Partial<LoggerConfig>): ILogger {
    const logger = new OuroborosLogger(config);
    this.loggers.set(name, logger);
    return logger;
  }

  /**
   * 获取日志记录器
   */
  get(name: string): ILogger | undefined {
    return this.loggers.get(name);
  }

  /**
   * 设置默认日志记录器
   */
  setDefault(logger: ILogger): void {
    this.defaultLogger = logger as OuroborosLogger;
  }

  /**
   * 获取默认日志记录器
   */
  getDefault(): ILogger {
    if (!this.defaultLogger) {
      this.defaultLogger = new OuroborosLogger();
    }
    return this.defaultLogger;
  }

  /**
   * 关闭所有日志记录器
   */
  async closeAll(): Promise<void> {
    const closings = Array.from(this.loggers.values()).map(l => l.close());
    if (this.defaultLogger) {
      closings.push(this.defaultLogger.close());
    }
    await Promise.all(closings);
    this.loggers.clear();
    this.defaultLogger = null;
  }

  /**
   * 更新所有日志记录器的配置
   */
  updateAll(config: Partial<LoggerConfig>): void {
    for (const logger of this.loggers.values()) {
      logger.updateConfig(config);
    }
    if (this.defaultLogger) {
      this.defaultLogger.updateConfig(config);
    }
  }

  /**
   * 列出所有日志记录器
   */
  listLoggers(): string[] {
    return Array.from(this.loggers.keys());
  }
}

// ============================================================================
// 快捷函数
// ============================================================================

/**
 * 获取默认日志记录器
 */
export function getLogger(): ILogger {
  return LoggerManager.getInstance().getDefault();
}

/**
 * 创建日志记录器
 */
export function createLogger(config?: Partial<LoggerConfig>): ILogger {
  return new OuroborosLogger(config);
}

/**
 * 创建模块日志记录器
 */
export function createModuleLogger(moduleName: string, config?: Partial<LoggerConfig>): ILogger {
  const manager = LoggerManager.getInstance();
  const existing = manager.get(moduleName);
  if (existing) return existing;

  const logger = manager.create(moduleName, config);
  return logger.child({ module: moduleName });
}

/**
 * 调试日志（快捷函数）
 */
export function debug(message: string, meta?: Record<string, JSONValue>): void {
  getLogger().debug(message, meta);
}

/**
 * 信息日志（快捷函数）
 */
export function info(message: string, meta?: Record<string, JSONValue>): void {
  getLogger().info(message, meta);
}

/**
 * 警告日志（快捷函数）
 */
export function warn(message: string, meta?: Record<string, JSONValue>): void {
  getLogger().warn(message, meta);
}

/**
 * 错误日志（快捷函数）
 */
export function error(message: string, err?: Error, meta?: Record<string, JSONValue>): void {
  getLogger().error(message, err, meta);
}

/**
 * 致命错误日志（快捷函数）
 */
export function fatal(message: string, err?: Error, meta?: Record<string, JSONValue>): void {
  getLogger().fatal(message, err, meta);
}

// ============================================================================
// 日志流处理
// ============================================================================

/**
 * 日志流
 * 用于将日志输出转换为流
 */
export class LogStream {
  private handlers: Array<(entry: LogEntry) => void> = [];
  private buffer: LogEntry[] = [];
  private maxBufferSize: number = 1000;

  constructor(maxBufferSize = 1000) {
    this.maxBufferSize = maxBufferSize;
  }

  /**
   * 写入日志
   */
  write(entry: LogEntry): void {
    // 添加到缓冲区
    this.buffer.push(entry);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    // 通知处理器
    for (const handler of this.handlers) {
      try {
        handler(entry);
      } catch (e) {
        console.error('Log stream handler error:', e);
      }
    }
  }

  /**
   * 订阅日志
   */
  subscribe(handler: (entry: LogEntry) => void): () => void {
    this.handlers.push(handler);
    
    // 返回取消订阅函数
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index > -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  /**
   * 获取缓冲区内容
   */
  getBuffer(): LogEntry[] {
    return [...this.buffer];
  }

  /**
   * 清空缓冲区
   */
  clear(): void {
    this.buffer = [];
  }
}

// ============================================================================
// 审计日志
// ============================================================================

/**
 * 审计日志记录器
 * 用于记录安全和合规相关事件
 */
export class AuditLogger {
  private logger: ILogger;

  constructor(logger?: ILogger) {
    this.logger = logger || getLogger().child({ audit: true });
  }

  /**
   * 记录访问事件
   */
  access(
    action: string,
    resource: string,
    userId: string,
    success: boolean,
    details?: Record<string, JSONValue>
  ): void {
    this.logger.info('Access event', {
      auditType: 'access',
      action,
      resource,
      userId,
      success,
      ...details,
    });
  }

  /**
   * 记录配置变更
   */
  configChange(
    key: string,
    oldValue: unknown,
    newValue: unknown,
    userId: string
  ): void {
    this.logger.info('Configuration changed', {
      auditType: 'config',
      key,
      oldValue: oldValue as JSONValue,
      newValue: newValue as JSONValue,
      userId,
    });
  }

  /**
   * 记录安全事件
   */
  security(
    eventType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, JSONValue>
  ): void {
    const logMethod = severity === 'critical' ? 'fatal' : 'error';
    this.logger[logMethod]('Security event', undefined, {
      auditType: 'security',
      eventType,
      severity,
      ...details,
    });
  }

  /**
   * 记录数据操作
   */
  data(
    operation: 'create' | 'read' | 'update' | 'delete',
    dataType: string,
    dataId: string,
    userId: string,
    details?: Record<string, JSONValue>
  ): void {
    this.logger.info('Data operation', {
      auditType: 'data',
      operation,
      dataType,
      dataId,
      userId,
      ...details,
    });
  }
}

// ============================================================================
// 性能日志
// ============================================================================

/**
 * 性能计时器
 */
export class PerformanceTimer {
  private startTime: number;
  private logger: ILogger;
  private label: string;

  constructor(label: string, logger?: ILogger) {
    this.label = label;
    this.logger = logger || getLogger();
    this.startTime = performance.now();
  }

  /**
   * 结束计时并记录
   */
  end(meta?: Record<string, JSONValue>): number {
    const duration = performance.now() - this.startTime;
    this.logger.debug(`Performance: ${this.label}`, {
      duration: Math.round(duration * 100) / 100,
      label: this.label,
      ...meta,
    });
    return duration;
  }

  /**
   * 获取当前耗时（不结束）
   */
  elapsed(): number {
    return performance.now() - this.startTime;
  }
}

/**
 * 性能日志装饰器
 */
export function logPerformance(
  label?: string,
  threshold?: number
): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const methodName = label || `${target.constructor.name}.${String(propertyKey)}`;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const timer = new PerformanceTimer(methodName);
      try {
        const result = await originalMethod.apply(this, args);
        const duration = timer.end({ success: true });
        
        if (threshold && duration > threshold) {
          getLogger().warn(`Performance threshold exceeded: ${methodName}`, {
            duration,
            threshold,
          });
        }
        
        return result;
      } catch (error) {
        timer.end({ success: false, error });
        throw error;
      }
    };

    return descriptor;
  };
}

// ============================================================================
// 默认导出
// ============================================================================

export const LOGGER_MODULE = {
  name: 'logger',
  version: '2.0.0',
  description: 'Ouroboros日志系统',
  exports: [
    'OuroborosLogger',
    'LoggerManager',
    'LogStream',
    'AuditLogger',
    'PerformanceTimer',
    'createLogger',
    'createModuleLogger',
    'getLogger',
  ],
} as const;

export default OuroborosLogger;
