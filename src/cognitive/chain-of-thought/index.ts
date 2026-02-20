/**
 * @file cognitive/chain-of-thought/index.ts
 * @description 显式思维链模块 - 可解释的推理步骤
 * @author Ouroboros
 * @date 2026-02-19
 */

import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger('ChainOfThought');

/** 推理步骤类型 */
export type ReasoningStepType =
  | 'understand'      // 理解问题/输入
  | 'retrieve'        // 检索相关信息
  | 'analyze'         // 分析
  | 'plan'            // 制定计划
  | 'execute'         // 执行
  | 'verify'          // 验证结果
  | 'reflect'         // 反思
  | 'conclude';       // 得出结论

/** 推理步骤 */
export interface ReasoningStep {
  /** 步骤 ID */
  id: string;
  /** 步骤类型 */
  type: ReasoningStepType;
  /** 步骤描述 */
  description: string;
  /** 详细思考过程 */
  thought: string;
  /** 使用的工具/能力 */
  tools?: string[];
  /** 输入 */
  input?: unknown;
  /** 输出 */
  output?: unknown;
  /** 置信度 */
  confidence: number;
  /** 开始时间 */
  startedAt: string;
  /** 结束时间 */
  completedAt?: string;
  /** 状态 */
  status: 'pending' | 'active' | 'completed' | 'error';
  /** 错误信息 */
  error?: string;
}

/** 思维链 */
export interface ChainOfThought {
  /** 链 ID */
  id: string;
  /** 原始输入 */
  input: string;
  /** 推理步骤 */
  steps: ReasoningStep[];
  /** 最终结论 */
  conclusion?: string;
  /** 整体置信度 */
  overallConfidence: number;
  /** 总耗时 (毫秒) */
  totalDuration: number;
  /** 创建时间 */
  createdAt: string;
  /** 完成时间 */
  completedAt?: string;
  /** 状态 */
  status: 'active' | 'completed' | 'error' | 'paused';
}

/** 思维链选项 */
export interface ChainOfThoughtOptions {
  /** 启用详细日志 */
  verbose?: boolean;
  /** 最大步骤数 */
  maxSteps?: number;
  /** 每步超时 (毫秒) */
  stepTimeout?: number;
  /** 保存到记忆 */
  saveToMemory?: boolean;
}

/** 步骤处理器 */
export type StepHandler = (
  step: ReasoningStep,
  context: ChainOfThought
) => Promise<{ output: unknown; confidence: number }>;

/**
 * 思维链管理器
 * 
 * 实现显式、可解释的推理过程
 */
export class ChainOfThoughtManager {
  private chains = new Map<string, ChainOfThought>();
  private stepHandlers = new Map<ReasoningStepType, StepHandler>();
  private options: ChainOfThoughtOptions;

  constructor(options: ChainOfThoughtOptions = {}) {
    this.options = {
      verbose: false,
      maxSteps: 20,
      stepTimeout: 30000,
      saveToMemory: true,
      ...options,
    };

    // 注册默认步骤处理器
    this.registerDefaultHandlers();
  }

  /**
   * 开始新的思维链
   */
  start(input: string): ChainOfThought {
    const chain: ChainOfThought = {
      id: `cot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      input,
      steps: [],
      overallConfidence: 1.0,
      totalDuration: 0,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    this.chains.set(chain.id, chain);
    logger.info(`Started chain of thought: ${chain.id}`);

    return chain;
  }

  /**
   * 添加推理步骤
   */
  async addStep(
    chainId: string,
    type: ReasoningStepType,
    description: string,
    thought: string,
    input?: unknown
  ): Promise<ReasoningStep> {
    const chain = this.chains.get(chainId);
    if (!chain) {
      throw new Error(`Chain not found: ${chainId}`);
    }

    // 检查步骤限制
    if (chain.steps.length >= this.options.maxSteps!) {
      throw new Error(`Maximum steps (${this.options.maxSteps}) reached`);
    }

    const step: ReasoningStep = {
      id: `${chainId}_step_${chain.steps.length + 1}`,
      type,
      description,
      thought,
      input,
      confidence: 1.0,
      startedAt: new Date().toISOString(),
      status: 'active',
    };

    chain.steps.push(step);

    if (this.options.verbose) {
      logger.debug(`[CoT] ${type}: ${description}`);
    }

    // 执行步骤处理器
    const handler = this.stepHandlers.get(type);
    if (handler) {
      try {
        const result = await this.executeWithTimeout(
          () => handler(step, chain),
          this.options.stepTimeout!
        );

        step.output = result.output;
        step.confidence = result.confidence;
        step.completedAt = new Date().toISOString();
        step.status = 'completed';

        // 更新整体置信度
        chain.overallConfidence *= result.confidence;
      } catch (error) {
        step.status = 'error';
        step.error = error instanceof Error ? error.message : String(error);
        step.confidence = 0;
        chain.overallConfidence = 0;
      }
    } else {
      step.status = 'completed';
      step.completedAt = new Date().toISOString();
    }

    return step;
  }

  /**
   * 完成思维链
   */
  complete(chainId: string, conclusion: string): ChainOfThought {
    const chain = this.chains.get(chainId);
    if (!chain) {
      throw new Error(`Chain not found: ${chainId}`);
    }

    chain.conclusion = conclusion;
    chain.completedAt = new Date().toISOString();
    chain.status = 'completed';
    
    const startTime = new Date(chain.createdAt).getTime();
    chain.totalDuration = Date.now() - startTime;

    logger.info(`Completed chain of thought: ${chainId} (${chain.steps.length} steps)`);

    return chain;
  }

  /**
   * 注册步骤处理器
   */
  registerStepHandler(type: ReasoningStepType, handler: StepHandler): void {
    this.stepHandlers.set(type, handler);
  }

  /**
   * 注册默认处理器
   */
  private registerDefaultHandlers(): void {
    // 理解步骤
    this.registerStepHandler('understand', async (step) => {
      // 分析输入，提取关键信息
      return {
        output: { understood: step.input || step.description },
        confidence: 0.95,
      };
    });

    // 检索步骤
    this.registerStepHandler('retrieve', async (step) => {
      // 检索相关信息
      return {
        output: { retrieved: `Information for: ${step.description}` },
        confidence: 0.9,
      };
    });

    // 分析步骤
    this.registerStepHandler('analyze', async (step) => {
      // 执行分析
      return {
        output: { analysis: `Analyzed: ${step.description}` },
        confidence: 0.85,
      };
    });

    // 计划步骤
    this.registerStepHandler('plan', async (step) => {
      // 制定计划
      return {
        output: { plan: `Plan for: ${step.description}` },
        confidence: 0.8,
      };
    });

    // 执行步骤
    this.registerStepHandler('execute', async (step) => {
      // 执行操作
      return {
        output: { executed: step.description },
        confidence: 0.9,
      };
    });

    // 验证步骤
    this.registerStepHandler('verify', async (_step) => {
      // 验证结果
      return {
        output: { verified: true },
        confidence: 0.95,
      };
    });

    // 反思步骤
    this.registerStepHandler('reflect', async (step) => {
      // 反思过程
      return {
        output: { reflection: `Reflection on: ${step.description}` },
        confidence: 0.85,
      };
    });

    // 结论步骤
    this.registerStepHandler('conclude', async (step) => {
      // 得出结论
      return {
        output: { conclusion: step.description },
        confidence: 0.95,
      };
    });
  }

  /**
   * 带超时执行
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Step timeout after ${timeout}ms`));
      }, timeout);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * 获取思维链
   */
  getChain(chainId: string): ChainOfThought | undefined {
    return this.chains.get(chainId);
  }

  /**
   * 获取思维链的可读格式
   */
  getReadableChain(chainId: string): string {
    const chain = this.chains.get(chainId);
    if (!chain) return 'Chain not found';

    const lines: string[] = [
      `🧠 Chain of Thought: ${chain.id}`,
      `Input: ${chain.input}`,
      '',
      'Steps:',
    ];

    for (const step of chain.steps) {
      const icon = this.getStepIcon(step.type);
      lines.push(`  ${icon} [${step.type}] ${step.description}`);
      lines.push(`     Thought: ${step.thought}`);
      if (step.confidence !== 1.0) {
        lines.push(`     Confidence: ${(step.confidence * 100).toFixed(1)}%`);
      }
      if (step.error) {
        lines.push(`     ❌ Error: ${step.error}`);
      }
      lines.push('');
    }

    if (chain.conclusion) {
      lines.push(`📋 Conclusion: ${chain.conclusion}`);
    }

    lines.push(`Overall Confidence: ${(chain.overallConfidence * 100).toFixed(1)}%`);
    lines.push(`Duration: ${chain.totalDuration}ms`);

    return lines.join('\n');
  }

  /**
   * 获取步骤图标
   */
  private getStepIcon(type: ReasoningStepType): string {
    const icons: Record<ReasoningStepType, string> = {
      understand: '📖',
      retrieve: '🔍',
      analyze: '📊',
      plan: '📋',
      execute: '⚡',
      verify: '✅',
      reflect: '🤔',
      conclude: '🎯',
    };
    return icons[type] || '•';
  }

  /**
   * 获取所有思维链
   */
  getAllChains(): ChainOfThought[] {
    return Array.from(this.chains.values());
  }

  /**
   * 导出思维链 (用于保存到记忆)
   */
  exportForMemory(chainId: string): {
    type: 'chain_of_thought';
    content: string;
    metadata: {
      steps: number;
      confidence: number;
      duration: number;
    };
  } | undefined {
    const chain = this.chains.get(chainId);
    if (!chain) return undefined;

    return {
      type: 'chain_of_thought',
      content: this.getReadableChain(chainId),
      metadata: {
        steps: chain.steps.length,
        confidence: chain.overallConfidence,
        duration: chain.totalDuration,
      },
    };
  }

  /**
   * 获取统计
   */
  getStats(): {
    totalChains: number;
    activeChains: number;
    completedChains: number;
    totalSteps: number;
    averageSteps: number;
    averageConfidence: number;
  } {
    const all = this.getAllChains();
    const active = all.filter(c => c.status === 'active');
    const completed = all.filter(c => c.status === 'completed');
    const totalSteps = all.reduce((sum, c) => sum + c.steps.length, 0);

    return {
      totalChains: all.length,
      activeChains: active.length,
      completedChains: completed.length,
      totalSteps,
      averageSteps: all.length > 0 ? totalSteps / all.length : 0,
      averageConfidence: all.length > 0
        ? all.reduce((sum, c) => sum + c.overallConfidence, 0) / all.length
        : 0,
    };
  }
}

// 导出便捷函数
export function createChainOfThought(
  input: string,
  options?: ChainOfThoughtOptions
): { manager: ChainOfThoughtManager; chain: ChainOfThought } {
  const manager = new ChainOfThoughtManager(options);
  const chain = manager.start(input);
  return { manager, chain };
}

// 类型已在上方导出
