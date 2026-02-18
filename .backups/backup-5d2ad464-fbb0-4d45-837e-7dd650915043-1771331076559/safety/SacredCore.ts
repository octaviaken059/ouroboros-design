/**
 * 神圣核心 (SacredCore)
 * 
 * 安全层4: 神圣核心 - 不可变核心保护
 * 通过闭包封装核心调度逻辑，防止运行时篡改
 * 
 * @module safety/SacredCore
 */

import { createHash } from 'crypto';
import { EventEmitter } from 'events';

// ============================================================================
// 类型定义
// ============================================================================

/** 核心保护状态 */
export interface CoreProtectionStatus {
  protected: boolean;
  tamperingDetected: boolean;
  lastVerification: Date;
  integrityHash: string;
}

/** 受保护函数 */
export interface ProtectedFunction {
  name: string;
  hash: string;
  wrapped: boolean;
}

/** 核心配置 */
export interface SacredCoreConfig {
  enableTamperDetection: boolean;
  verificationInterval: number;
  strictMode: boolean;
}

/** 执行上下文 */
export interface ExecutionContext {
  functionName: string;
  timestamp: Date;
  args: unknown[];
  result?: unknown;
  error?: Error;
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: SacredCoreConfig = {
  enableTamperDetection: true,
  verificationInterval: 30000, // 30秒
  strictMode: true,
};

// ============================================================================
// 神圣核心
// ============================================================================

export class SacredCore extends EventEmitter {
  private config: SacredCoreConfig;
  private coreFunctions: Map<string, Function> = new Map();
  private functionHashes: Map<string, string> = new Map();
  private executionLog: ExecutionContext[] = [];
  private maxLogSize = 1000;
  private protectionActive = false;
  private verificationTimer: NodeJS.Timeout | null = null;
  private tamperAttempts = 0;

  // 闭包封装的保护状态
  private sacredState: {
    isSealed: boolean;
    sealTimestamp: number;
    coreHash: string;
  };

  constructor(config: Partial<SacredCoreConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // 初始化神圣状态（闭包保护）
    this.sacredState = this.createSacredState();
  }

  // ============================================================================
  // 神圣状态创建 (闭包封装)
  // ============================================================================

  /**
   * 创建受闭包保护的神圣状态
   * 这个状态无法从外部直接访问
   */
  private createSacredState(): {
    isSealed: boolean;
    sealTimestamp: number;
    coreHash: string;
  } {
    // 使用立即执行函数创建闭包
    const state = (() => {
      let sealed = false;
      let timestamp = 0;
      let hash = '';

      return {
        get isSealed() {
          return sealed;
        },
        set isSealed(value: boolean) {
          if (!sealed) {
            sealed = value;
            if (value) timestamp = Date.now();
          }
        },
        get sealTimestamp() {
          return timestamp;
        },
        get coreHash() {
          return hash;
        },
        set coreHash(value: string) {
          hash = value;
        },
      };
    })();

    return state;
  }

  // ============================================================================
  // 生命周期
  // ============================================================================

  /**
   * 启动核心保护
   */
  startProtection(): void {
    if (this.protectionActive) return;

    // 封印核心
    this.sealCore();

    // 启动篡改检测
    if (this.config.enableTamperDetection) {
      this.verificationTimer = setInterval(() => {
        this.verifyIntegrity();
      }, this.config.verificationInterval);
    }

    this.protectionActive = true;
    this.emit('protectionStarted');
  }

  /**
   * 停止核心保护
   */
  stopProtection(): void {
    this.protectionActive = false;
    
    if (this.verificationTimer) {
      clearInterval(this.verificationTimer);
      this.verificationTimer = null;
    }

    this.emit('protectionStopped');
  }

  // ============================================================================
  // 核心封印
  // ============================================================================

  /**
   * 封印核心
   * 封印后核心函数将被保护，无法被修改
   */
  private sealCore(): void {
    // 计算核心哈希
    const coreFunctions = Array.from(this.coreFunctions.entries());
    const hash = this.calculateCoreHash(coreFunctions);
    
    this.sacredState.coreHash = hash;
    this.sacredState.isSealed = true;

    // 存储函数哈希用于验证
    for (const [name, fn] of coreFunctions) {
      this.functionHashes.set(name, this.hashFunction(fn));
    }

    this.emit('coreSealed', {
      timestamp: this.sacredState.sealTimestamp,
      hash,
    });
  }

  /**
   * 计算核心哈希
   */
  private calculateCoreHash(functions: [string, Function][]): string {
    const functionStrings = functions
      .map(([name, fn]) => `${name}:${fn.toString()}`)
      .sort()
      .join('|');
    
    return createHash('sha256').update(functionStrings).digest('hex');
  }

  /**
   * 计算函数哈希
   */
  private hashFunction(fn: Function): string {
    return createHash('sha256').update(fn.toString()).digest('hex');
  }

  // ============================================================================
  // 函数注册与执行
  // ============================================================================

  /**
   * 注册核心函数
   * 必须在封印前完成
   */
  registerFunction(name: string, fn: Function): void {
    if (this.sacredState.isSealed) {
      this.emit('tamperAttempt', {
        type: 'registration_after_seal',
        functionName: name,
        timestamp: new Date(),
      });
      
      if (this.config.strictMode) {
        throw new Error('Cannot register function after core is sealed');
      }
      
      return;
    }

    this.coreFunctions.set(name, fn);
    this.functionHashes.set(name, this.hashFunction(fn));
    
    this.emit('functionRegistered', { name });
  }

  /**
   * 执行核心函数 (受保护)
   */
  execute<T>(operation: () => T): T {
    // 验证核心完整性
    if (this.config.strictMode && !this.verifyBeforeExecution()) {
      throw new Error('Core integrity check failed - execution blocked');
    }

    const context: ExecutionContext = {
      functionName: operation.name || 'anonymous',
      timestamp: new Date(),
      args: [],
    };

    try {
      const result = operation();
      context.result = result;
      this.logExecution(context);
      return result;
    } catch (error) {
      context.error = error instanceof Error ? error : new Error(String(error));
      this.logExecution(context);
      throw error;
    }
  }

  /**
   * 异步执行核心函数 (受保护)
   */
  async executeAsync<T>(operation: () => Promise<T>): Promise<T> {
    // 验证核心完整性
    if (this.config.strictMode && !this.verifyBeforeExecution()) {
      throw new Error('Core integrity check failed - execution blocked');
    }

    const context: ExecutionContext = {
      functionName: operation.name || 'anonymous',
      timestamp: new Date(),
      args: [],
    };

    try {
      const result = await operation();
      context.result = result;
      this.logExecution(context);
      return result;
    } catch (error) {
      context.error = error instanceof Error ? error : new Error(String(error));
      this.logExecution(context);
      throw error;
    }
  }

  /**
   * 调用已注册的核心函数
   */
  invoke<T>(name: string, ...args: unknown[]): T {
    const fn = this.coreFunctions.get(name);
    if (!fn) {
      throw new Error(`Core function '${name}' not found`);
    }

    // 验证函数未被篡改
    if (this.config.enableTamperDetection) {
      const currentHash = this.hashFunction(fn);
      const expectedHash = this.functionHashes.get(name);
      
      if (currentHash !== expectedHash) {
        this.handleTampering('function_modified', name);
        throw new Error(`Core function '${name}' has been tampered with`);
      }
    }

    return this.execute(() => fn(...args));
  }

  // ============================================================================
  // 完整性验证
  // ============================================================================

  /**
   * 验证核心完整性
   */
  verifyIntegrity(): CoreProtectionStatus {
    if (!this.sacredState.isSealed) {
      return {
        protected: false,
        tamperingDetected: false,
        lastVerification: new Date(),
        integrityHash: '',
      };
    }

    let tamperingDetected = false;

    // 验证核心哈希
    const currentFunctions = Array.from(this.coreFunctions.entries());
    const currentHash = this.calculateCoreHash(currentFunctions);
    
    if (currentHash !== this.sacredState.coreHash) {
      tamperingDetected = true;
      this.handleTampering('core_hash_mismatch');
    }

    // 验证各个函数
    for (const [name, fn] of currentFunctions) {
      const currentFnHash = this.hashFunction(fn);
      const expectedFnHash = this.functionHashes.get(name);
      
      if (currentFnHash !== expectedFnHash) {
        tamperingDetected = true;
        this.handleTampering('function_hash_mismatch', name);
      }
    }

    return {
      protected: this.protectionActive,
      tamperingDetected,
      lastVerification: new Date(),
      integrityHash: this.sacredState.coreHash,
    };
  }

  private verifyBeforeExecution(): boolean {
    const status = this.verifyIntegrity();
    return !status.tamperingDetected;
  }

  // ============================================================================
  // 篡改处理
  // ============================================================================

  private handleTampering(type: string, details?: string): void {
    this.tamperAttempts++;
    
    this.emit('tamperingDetected', {
      type,
      details,
      attempts: this.tamperAttempts,
      timestamp: new Date(),
    });

    if (this.config.strictMode && this.tamperAttempts >= 3) {
      this.emit('criticalTampering', {
        attempts: this.tamperAttempts,
        action: 'emergency_shutdown',
      });
      
      // 紧急锁定
      this.emergencyLockdown();
    }
  }

  private emergencyLockdown(): void {
    this.protectionActive = false;
    this.coreFunctions.clear();
    
    this.emit('emergencyLockdown', {
      timestamp: new Date(),
      reason: 'Multiple tampering attempts detected',
    });
  }

  // ============================================================================
  // 日志记录
  // ============================================================================

  private logExecution(context: ExecutionContext): void {
    this.executionLog.push(context);
    
    if (this.executionLog.length > this.maxLogSize) {
      this.executionLog = this.executionLog.slice(-this.maxLogSize);
    }

    if (context.error) {
      this.emit('executionError', {
        functionName: context.functionName,
        error: context.error,
        timestamp: context.timestamp,
      });
    }
  }

  // ============================================================================
  // 查询
  // ============================================================================

  /**
   * 获取保护状态
   */
  getProtectionStatus(): CoreProtectionStatus {
    return this.verifyIntegrity();
  }

  /**
   * 是否已封印
   */
  isSealed(): boolean {
    return this.sacredState.isSealed;
  }

  /**
   * 获取封印时间
   */
  getSealTimestamp(): number {
    return this.sacredState.sealTimestamp;
  }

  /**
   * 获取核心哈希
   */
  getCoreHash(): string {
    return this.sacredState.coreHash;
  }

  /**
   * 获取已注册函数列表
   */
  getRegisteredFunctions(): string[] {
    return Array.from(this.coreFunctions.keys());
  }

  /**
   * 获取执行日志
   */
  getExecutionLog(limit = 100): ExecutionContext[] {
    return this.executionLog.slice(-limit);
  }

  /**
   * 获取篡改尝试次数
   */
  getTamperAttempts(): number {
    return this.tamperAttempts;
  }

  // ============================================================================
  // 配置
  // ============================================================================

  updateConfig(config: Partial<SacredCoreConfig>): void {
    if (this.sacredState.isSealed && config.strictMode !== undefined) {
      // 严格模式只能在封印前更改
      throw new Error('Cannot change strict mode after core is sealed');
    }
    
    this.config = { ...this.config, ...config };
  }

  // ============================================================================
  // 常量 (不可变)
  // ============================================================================

  /**
   * 获取神圣常量
   */
  getSacredConstants(): Readonly<{
    MAX_EXECUTION_TIME: number;
    MAX_MEMORY_USAGE: number;
    MAX_RECURSION_DEPTH: number;
  }> {
    // 返回冻结的对象，防止修改
    return Object.freeze({
      MAX_EXECUTION_TIME: 30000,    // 30秒
      MAX_MEMORY_USAGE: 512 * 1024 * 1024, // 512MB
      MAX_RECURSION_DEPTH: 100,
    });
  }
}

export default SacredCore;
