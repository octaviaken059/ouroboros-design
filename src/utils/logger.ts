/**
 * @file utils/logger.ts
 * @description Winston 日志配置
 * @author Ouroboros
 * @date 2026-02-18
 *
 * 提供分级的日志记录，支持文件轮转和控制台输出
 */

import winston, { type Logger, type Logform } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// 日志级别定义
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

// 日志级别颜色
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
  trace: 'gray',
};

winston.addColors(colors);

/**
 * 创建日志格式
 * @returns winston.Logform.Format 日志格式
 */
const createFormat = (): Logform.Format => {
  return winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );
};

/**
 * 创建控制台日志格式（开发环境使用）
 * @returns winston.Logform.Format 控制台日志格式
 */
const createConsoleFormat = (): Logform.Format => {
  return winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf((info: Logform.TransformableInfo) => {
      const { level, message, timestamp, ...metadata } = info;
      let msg = `${String(timestamp)} [${level}]: ${String(message)}`;
      const metaKeys = Object.keys(metadata).filter((k) => k !== 'service');
      if (metaKeys.length > 0) {
        const metaObj = Object.fromEntries(metaKeys.map((k) => [k, metadata[k]]));
        msg += ` ${JSON.stringify(metaObj)}`;
      }
      return msg;
    })
  );
};

/**
 * 创建 Logger 实例
 * @param logDir 日志目录，默认为 './logs'
 * @returns winston.Logger 实例
 */
export function createLogger(logDir = './logs'): Logger {
  const loggerInstance = winston.createLogger({
    level: process.env.LOG_LEVEL ?? 'info',
    levels,
    format: createFormat(),
    defaultMeta: { service: 'ouroboros' },
    transports: [
      // 错误日志（单独文件）
      new DailyRotateFile({
        filename: path.join(logDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '14d',
        format: createFormat(),
      }),
      // 所有日志
      new DailyRotateFile({
        filename: path.join(logDir, 'combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        format: createFormat(),
      }),
    ],
    // 未捕获的异常处理
    exceptionHandlers: [
      new DailyRotateFile({
        filename: path.join(logDir, 'exceptions-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
      }),
    ],
    // 未处理的 Promise 拒绝
    rejectionHandlers: [
      new DailyRotateFile({
        filename: path.join(logDir, 'rejections-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
      }),
    ],
  });

  // 开发环境添加控制台输出
  if (process.env.NODE_ENV !== 'production') {
    loggerInstance.add(
      new winston.transports.Console({
        format: createConsoleFormat(),
      })
    );
  }

  return loggerInstance;
}

// 默认 logger 实例
export const logger = createLogger();

/**
 * 上下文日志记录器接口
 */
export interface ContextLogger {
  error: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
  trace: (message: string, meta?: Record<string, unknown>) => void;
}

/**
 * 创建带上下文的日志记录器
 * @param context 上下文标识
 * @returns 带上下文的日志方法对象
 */
export function createContextLogger(context: string): ContextLogger {
  return {
    error: (message: string, meta?: Record<string, unknown>): void => {
      logger.error(message, { context, ...meta });
    },
    warn: (message: string, meta?: Record<string, unknown>): void => {
      logger.warn(message, { context, ...meta });
    },
    info: (message: string, meta?: Record<string, unknown>): void => {
      logger.info(message, { context, ...meta });
    },
    debug: (message: string, meta?: Record<string, unknown>): void => {
      logger.debug(message, { context, ...meta });
    },
    trace: (message: string, meta?: Record<string, unknown>): void => {
      logger.log('trace', message, { context, ...meta });
    },
  };
}
