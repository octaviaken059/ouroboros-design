/**
 * @file utils/error.ts
 * @description 错误处理基础设施
 * @author Ouroboros
 * @date 2026-02-18
 *
 * 提供统一的错误类型和错误处理工具
 */

import type { ErrorCode, Timestamp } from '@/types/index';
import { logger } from './logger';

/**
 * Ouroboros 错误类
 * 系统中所有错误的基类
 */
export class OuroborosError extends Error {
  /** 错误代码 */
  readonly code: ErrorCode;
  /** 错误上下文 */
  readonly context: string;
  /** 是否可恢复 */
  readonly recoverable: boolean;
  /** 时间戳 */
  readonly timestamp: Timestamp;
  /**
   * 原始错误
   * 使用 declare 来避免与 Error.cause 的冲突
   */
  declare readonly cause: Error | undefined;

  constructor(
    message: string,
    code: ErrorCode,
    context: string,
    recoverable = false,
    cause?: Error
  ) {
    super(message);
    this.name = 'OuroborosError';
    this.code = code;
    this.context = context;
    this.recoverable = recoverable;
    this.timestamp = new Date().toISOString();
    this.cause = cause;

    // 记录错误日志
    logger.error(message, {
      code,
      context,
      recoverable,
      cause: cause?.message,
      stack: this.stack,
    });
  }

  /**
   * 转换为 JSON 格式
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
      stack: this.stack,
      cause: this.cause?.message,
    };
  }
}

/**
 * 配置错误
 */
export class ConfigError extends OuroborosError {
  constructor(message: string, context: string, recoverable = true, cause?: Error) {
    super(message, 'CONFIG_ERROR', context, recoverable, cause);
    this.name = 'ConfigError';
  }
}

/**
 * 记忆错误
 */
export class MemoryError extends OuroborosError {
  constructor(message: string, context: string, recoverable = true, cause?: Error) {
    super(message, 'MEMORY_ERROR', context, recoverable, cause);
    this.name = 'MemoryError';
  }
}

/**
 * 工具错误
 */
export class ToolError extends OuroborosError {
  constructor(message: string, context: string, recoverable = true, cause?: Error) {
    super(message, 'TOOL_ERROR', context, recoverable, cause);
    this.name = 'ToolError';
  }
}

/**
 * 模型错误
 */
export class ModelError extends OuroborosError {
  constructor(message: string, context: string, recoverable = true, cause?: Error) {
    super(message, 'MODEL_ERROR', context, recoverable, cause);
    this.name = 'ModelError';
  }
}

/**
 * 反思错误
 */
export class ReflectionError extends OuroborosError {
  constructor(message: string, context: string, recoverable = true, cause?: Error) {
    super(message, 'REFLECTION_ERROR', context, recoverable, cause);
    this.name = 'ReflectionError';
  }
}

/**
 * 进化错误
 */
export class EvolutionError extends OuroborosError {
  constructor(message: string, context: string, recoverable = false, cause?: Error) {
    super(message, 'EVOLUTION_ERROR', context, recoverable, cause);
    this.name = 'EvolutionError';
  }
}

/**
 * 安全错误
 */
export class SafetyError extends OuroborosError {
  constructor(message: string, context: string, recoverable = false, cause?: Error) {
    super(message, 'SAFETY_ERROR', context, recoverable, cause);
    this.name = 'SafetyError';
  }
}

/**
 * 验证错误
 */
export class ValidationError extends OuroborosError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', JSON.stringify(context ?? {}), true);
    this.name = 'ValidationError';
  }
}

/**
 * 异步函数的 try-catch 包装器
 * @param fn 异步函数
 * @param context 错误上下文
 * @param ErrorClass 错误类
 * @returns 包装后的函数
 */
export function tryCatchAsync<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  context: string,
  ErrorClass: new (message: string, context: string, recoverable?: boolean, cause?: Error) => OuroborosError
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof OuroborosError) {
        throw error;
      }
      throw new ErrorClass(
        error instanceof Error ? error.message : String(error),
        context,
        true,
        error instanceof Error ? error : undefined
      );
    }
  };
}

/**
 * 同步函数的 try-catch 包装器
 * @param fn 同步函数
 * @param context 错误上下文
 * @param ErrorClass 错误类
 * @returns 包装后的函数
 */
export function tryCatch<T, Args extends unknown[]>(
  fn: (...args: Args) => T,
  context: string,
  ErrorClass: new (message: string, context: string, recoverable?: boolean, cause?: Error) => OuroborosError
): (...args: Args) => T {
  return (...args: Args): T => {
    try {
      return fn(...args);
    } catch (error) {
      if (error instanceof OuroborosError) {
        throw error;
      }
      throw new ErrorClass(
        error instanceof Error ? error.message : String(error),
        context,
        true,
        error instanceof Error ? error : undefined
      );
    }
  };
}

/**
 * 全局错误处理器
 */
export function setupGlobalErrorHandlers(): void {
  // 未捕获的异常
  process.on('uncaughtException', (error) => {
    logger.error('未捕获的异常', {
      error: error.message,
      stack: error.stack,
    });
    // 给日志写入时间后退出
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // 未处理的 Promise 拒绝
  process.on('unhandledRejection', (reason) => {
    logger.error('未处理的 Promise 拒绝', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}
