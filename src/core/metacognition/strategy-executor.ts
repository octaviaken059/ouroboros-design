/**
 * @file core/metacognition/strategy-executor.ts
 * @description 策略执行引擎 - 将策略转化为可执行代码
 * @author Ouroboros
 * @date 2026-02-20
 * 
 * 核心能力：
 * 1. 将策略编译为可执行函数
 * 2. 策略运行时注入
 * 3. 策略效果跟踪
 * 4. 策略版本管理
 */

import type { Strategy, StrategyType } from './strategy-encoder';
import { createContextLogger } from '@/utils/logger';
import { randomUUID } from 'crypto';

const logger = createContextLogger('StrategyExecutor');

/** 可执行策略 */
export interface ExecutableStrategy {
  /** 策略ID */
  id: string;
  /** 原始策略 */
  sourceStrategy: Strategy;
  /** 编译后的执行函数 */
  execute: StrategyFunction;
  /** 代码表示 */
  code: string;
  /** 依赖 */
  dependencies: string[];
  /** 编译时间 */
  compiledAt: string;
  /** 版本 */
  version: number;
  /** 执行统计 */
  executionStats: {
    callCount: number;
    successCount: number;
    failureCount: number;
    lastExecuted?: string;
    averageExecutionTime: number;
  };
  /** 是否激活 */
  isActive: boolean;
}

/** 策略函数类型 */
export type StrategyFunction = (context: StrategyContext) => StrategyResult;

/** 策略执行上下文 */
export interface StrategyContext {
  /** 当前任务类型 */
  taskType?: string;
  /** 当前输入 */
  userInput?: string;
  /** 当前不确定性水平 */
  uncertaintyLevel?: number;
  /** 当前置信度 */
  confidence?: number;
  /** 记忆上下文 */
  memoryContext?: string;
  /** 最近的反思 */
  recentReflections?: string[];
  /** 原始消息 */
  messages?: Array<{ role: string; content: string }>;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/** 策略执行结果 */
export interface StrategyResult {
  /** 是否成功 */
  success: boolean;
  /** 修改后的上下文 */
  modifiedContext?: Partial<StrategyContext>;
  /** 建议的操作 */
  suggestions?: string[];
  /** 生成的Prompt片段 */
  promptSnippet?: string;
  /** 执行日志 */
  logs: string[];
  /** 执行时间 */
  executionTime: number;
  /** 错误信息 */
  error?: string;
}

/** 策略运行时 */
export interface StrategyRuntime {
  /** 运行时ID */
  id: string;
  /** 策略ID */
  strategyId: string;
  /** 开始时间 */
  startTime: string;
  /** 结束时间 */
  endTime?: string;
  /** 执行结果 */
  result?: StrategyResult;
  /** 上下文快照 */
  contextSnapshot: StrategyContext;
}

/**
 * 策略执行引擎
 * 
 * 将策略转化为可执行代码并管理执行
 */
export class StrategyExecutor {
  /** 可执行策略库 */
  private executableStrategies = new Map<string, ExecutableStrategy>();
  
  /** 运行时历史 */
  private runtimeHistory: StrategyRuntime[] = [];
  
  /** 最大历史记录 */
  private readonly maxHistorySize = 1000;
  
  /** 策略代码模板库 */
  private codeTemplates: Record<StrategyType, string> = {
    prompt_template: `
// Prompt模板策略
function execute(context) {
  const logs = [];
  logs.push('执行Prompt模板策略: {{name}}');
  
  // 检查触发条件
  if (context.uncertaintyLevel > {{uncertaintyThreshold}}) {
    logs.push('触发条件满足: 不确定性 ' + context.uncertaintyLevel);
    
    // 生成Prompt片段
    const promptSnippet = \`{{promptSnippet}}\`;
    
    return {
      success: true,
      promptSnippet,
      logs,
      executionTime: Date.now() - startTime,
    };
  }
  
  logs.push('触发条件不满足');
  return {
    success: true,
    logs,
    executionTime: Date.now() - startTime,
  };
}
`,
    
    reasoning_pattern: `
// 推理模式策略
function execute(context) {
  const logs = [];
  logs.push('执行推理模式策略: {{name}}');
  
  const suggestions = [];
  
  // 应用推理模式
  {{codeLogic}}
  
  suggestions.push('使用{{reasoningType}}推理模式');
  
  return {
    success: true,
    suggestions,
    logs,
    executionTime: Date.now() - startTime,
  };
}
`,
    
    tool_selection: `
// 工具选择策略
function execute(context) {
  const logs = [];
  logs.push('执行工具选择策略: {{name}}');
  
  // 评估是否需要工具增强
  if (context.uncertaintyLevel > {{threshold}} || context.confidence < {{minConfidence}}) {
    logs.push('建议寻求外部工具增强');
    
    return {
      success: true,
      suggestions: ['使用{{recommendedTool}}工具'],
      modifiedContext: {
        shouldOffload: true,
      },
      logs,
      executionTime: Date.now() - startTime,
    };
  }
  
  return {
    success: true,
    logs,
    executionTime: Date.now() - startTime,
  };
}
`,
    
    uncertainty_handling: `
// 不确定性处理策略
function execute(context) {
  const logs = [];
  logs.push('执行不确定性处理策略: {{name}}');
  
  const modifiedContext: Partial<StrategyContext> = {};
  
  // 应用不确定性处理逻辑
  if (context.uncertaintyLevel > {{threshold}}) {
    modifiedContext.uncertaintyLevel = context.uncertaintyLevel;
    
    return {
      success: true,
      modifiedContext,
      promptSnippet: '{{promptSnippet}}',
      suggestions: ['明确标记不确定性'],
      logs,
      executionTime: Date.now() - startTime,
    };
  }
  
  return {
    success: true,
    logs,
    executionTime: Date.now() - startTime,
  };
}
`,
    
    self_correction: `
// 自我修正策略
function execute(context) {
  const logs = [];
  logs.push('执行自我修正策略: {{name}}');
  
  // 检查需要修正的内容
  {{codeLogic}}
  
  return {
    success: true,
    suggestions: ['检查逻辑一致性', '验证前提条件'],
    logs,
    executionTime: Date.now() - startTime,
  };
}
`,
  };

  constructor() {
    logger.info('策略执行引擎初始化完成');
  }

  /**
   * 编译策略为可执行代码
   * 
   * 核心方法：将策略转化为函数
   */
  compileStrategy(strategy: Strategy): ExecutableStrategy {
    logger.info('编译策略', { strategyId: strategy.id, name: strategy.name });
    
    // 获取代码模板
    const template = this.codeTemplates[strategy.type];
    
    // 填充模板
    const code = this.fillTemplate(template, strategy);
    
    // 创建执行函数
    const execute = this.createExecutableFunction(code, strategy);
    
    const executable: ExecutableStrategy = {
      id: randomUUID(),
      sourceStrategy: strategy,
      execute,
      code,
      dependencies: this.extractDependencies(code),
      compiledAt: new Date().toISOString(),
      version: strategy.version,
      executionStats: {
        callCount: 0,
        successCount: 0,
        failureCount: 0,
        averageExecutionTime: 0,
      },
      isActive: strategy.isActive,
    };
    
    this.executableStrategies.set(strategy.id, executable);
    
    logger.info('策略编译完成', {
      executableId: executable.id,
      strategyName: strategy.name,
      codeLength: code.length,
    });
    
    return executable;
  }

  /**
   * 填充代码模板
   */
  private fillTemplate(template: string, strategy: Strategy): string {
    let code = template;
    
    // 替换基本字段
    code = code.replace(/{{name}}/g, strategy.name);
    code = code.replace(/{{description}}/g, strategy.description);
    
    // 替换触发条件
    if (strategy.triggerCondition.uncertaintyThreshold !== undefined) {
      code = code.replace(
        /{{uncertaintyThreshold}}/g,
        strategy.triggerCondition.uncertaintyThreshold.toString()
      );
    }
    
    if (strategy.triggerCondition.minConfidence !== undefined) {
      code = code.replace(
        /{{minConfidence}}/g,
        strategy.triggerCondition.minConfidence.toString()
      );
    }
    
    // 替换内容
    if (strategy.content.promptSnippet) {
      code = code.replace(/{{promptSnippet}}/g, strategy.content.promptSnippet);
    }
    
    if (strategy.content.codeLogic) {
      code = code.replace(/{{codeLogic}}/g, strategy.content.codeLogic);
    }
    
    // 添加策略元数据
    code = `// 策略: ${strategy.name}\n` +
           `// 类型: ${strategy.type}\n` +
           `// 版本: ${strategy.version}\n` +
           `// 编译时间: ${new Date().toISOString()}\n\n` +
           code;
    
    return code;
  }

  /**
   * 创建可执行函数
   */
  private createExecutableFunction(
    code: string,
    strategy: Strategy
  ): StrategyFunction {
    // 使用Function构造函数创建执行函数
    // 注意：这是一个简化的实现，生产环境应该使用更安全的沙箱
    try {
      // 包装代码为完整函数
      const wrappedCode = `
        return function(context) {
          const startTime = Date.now();
          try {
            ${code}
            return execute(context);
          } catch (error) {
            return {
              success: false,
              error: error.message,
              logs: ['执行出错: ' + error.message],
              executionTime: Date.now() - startTime,
            };
          }
        };
      `;
      
      const fn = new Function(wrappedCode)();
      
      // 返回包装函数，添加统计
      return (context: StrategyContext): StrategyResult => {
        const execStart = Date.now();
        const result = fn(context);
        const execTime = Date.now() - execStart;
        
        // 更新统计
        const executable = this.executableStrategies.get(strategy.id);
        if (executable) {
          executable.executionStats.callCount++;
          if (result.success) {
            executable.executionStats.successCount++;
          } else {
            executable.executionStats.failureCount++;
          }
          executable.executionStats.lastExecuted = new Date().toISOString();
          
          // 更新平均执行时间
          const stats = executable.executionStats;
          stats.averageExecutionTime = 
            (stats.averageExecutionTime * (stats.callCount - 1) + execTime) / stats.callCount;
        }
        
        return {
          ...result,
          executionTime: execTime,
        };
      };
    } catch (error) {
      logger.error('策略编译失败', { error, strategyId: strategy.id });
      
      // 返回失败函数
      return (): StrategyResult => ({
        success: false,
        error: `编译失败: ${error}`,
        logs: ['策略编译失败'],
        executionTime: 0,
      });
    }
  }

  /**
   * 提取依赖
   */
  private extractDependencies(code: string): string[] {
    const dependencies: string[] = [];
    
    // 简单的依赖检测
    if (code.includes('memorySystem')) dependencies.push('memorySystem');
    if (code.includes('metaCognition')) dependencies.push('metaCognition');
    if (code.includes('reasoningMonitor')) dependencies.push('reasoningMonitor');
    if (code.includes('hormoneSystem')) dependencies.push('hormoneSystem');
    
    return dependencies;
  }

  /**
   * 执行策略
   */
  executeStrategy(
    strategyId: string,
    context: StrategyContext
  ): StrategyResult {
    const executable = this.executableStrategies.get(strategyId);
    
    if (!executable) {
      return {
        success: false,
        error: `策略不存在: ${strategyId}`,
        logs: ['策略未找到'],
        executionTime: 0,
      };
    }
    
    if (!executable.isActive) {
      return {
        success: false,
        error: '策略已停用',
        logs: ['策略未激活'],
        executionTime: 0,
      };
    }
    
    // 记录运行时
    const runtime: StrategyRuntime = {
      id: randomUUID(),
      strategyId,
      startTime: new Date().toISOString(),
      contextSnapshot: { ...context },
    };
    
    // 执行
    const result = executable.execute(context);
    
    // 完成记录
    runtime.endTime = new Date().toISOString();
    runtime.result = result;
    
    this.runtimeHistory.push(runtime);
    if (this.runtimeHistory.length > this.maxHistorySize) {
      this.runtimeHistory.shift();
    }
    
    return result;
  }

  /**
   * 批量执行策略
   */
  executeStrategies(
    strategyIds: string[],
    context: StrategyContext
  ): Array<{ strategyId: string; result: StrategyResult }> {
    return strategyIds.map(id => ({
      strategyId: id,
      result: this.executeStrategy(id, context),
    }));
  }

  /**
   * 查找适用的策略并执行
   */
  executeApplicableStrategies(
    strategies: Strategy[],
    context: StrategyContext
  ): StrategyResult[] {
    const results: StrategyResult[] = [];
    
    for (const strategy of strategies) {
      // 检查触发条件
      if (this.shouldExecute(strategy, context)) {
        // 确保已编译
        let executable = this.executableStrategies.get(strategy.id);
        if (!executable) {
          executable = this.compileStrategy(strategy);
        }
        
        const result = this.executeStrategy(strategy.id, context);
        results.push(result);
      }
    }
    
    return results;
  }

  /**
   * 判断是否执行策略
   */
  private shouldExecute(strategy: Strategy, context: StrategyContext): boolean {
    const condition = strategy.triggerCondition;
    
    // 检查不确定性
    if (condition.uncertaintyThreshold !== undefined &&
        context.uncertaintyLevel !== undefined) {
      if (context.uncertaintyLevel < condition.uncertaintyThreshold) {
        return false;
      }
    }
    
    // 检查置信度
    if (condition.minConfidence !== undefined &&
        context.confidence !== undefined) {
      if (context.confidence < condition.minConfidence) {
        return false;
      }
    }
    
    // 检查任务类型
    if (condition.taskType && context.taskType !== condition.taskType) {
      return false;
    }
    
    // 检查能力类型
    if (condition.capabilityType && context.taskType !== condition.capabilityType) {
      return false;
    }
    
    return true;
  }

  /**
   * 获取可执行策略
   */
  getExecutableStrategy(strategyId: string): ExecutableStrategy | undefined {
    return this.executableStrategies.get(strategyId);
  }

  /**
   * 获取所有可执行策略
   */
  getAllExecutableStrategies(): ExecutableStrategy[] {
    return Array.from(this.executableStrategies.values());
  }

  /**
   * 激活/停用策略
   */
  setStrategyActive(strategyId: string, active: boolean): void {
    const executable = this.executableStrategies.get(strategyId);
    if (executable) {
      executable.isActive = active;
      logger.info(`可执行策略已${active ? '激活' : '停用'}`, { strategyId });
    }
  }

  /**
   * 获取策略代码
   */
  getStrategyCode(strategyId: string): string | undefined {
    return this.executableStrategies.get(strategyId)?.code;
  }

  /**
   * 获取执行统计
   */
  getExecutionStats(): {
    totalStrategies: number;
    activeStrategies: number;
    totalExecutions: number;
    averageSuccessRate: number;
    averageExecutionTime: number;
  } {
    const strategies = Array.from(this.executableStrategies.values());
    
    if (strategies.length === 0) {
      return {
        totalStrategies: 0,
        activeStrategies: 0,
        totalExecutions: 0,
        averageSuccessRate: 0,
        averageExecutionTime: 0,
      };
    }
    
    const totalExecutions = strategies.reduce(
      (sum, s) => sum + s.executionStats.callCount, 0
    );
    
    const totalSuccesses = strategies.reduce(
      (sum, s) => sum + s.executionStats.successCount, 0
    );
    
    return {
      totalStrategies: strategies.length,
      activeStrategies: strategies.filter(s => s.isActive).length,
      totalExecutions,
      averageSuccessRate: totalExecutions > 0 ? totalSuccesses / totalExecutions : 0,
      averageExecutionTime: strategies.reduce(
        (sum, s) => sum + s.executionStats.averageExecutionTime, 0
      ) / strategies.length,
    };
  }

  /**
   * 生成执行报告
   */
  generateReport(): string {
    const stats = this.getExecutionStats();
    const strategies = this.getAllExecutableStrategies();
    
    const topStrategies = strategies
      .sort((a, b) => b.executionStats.callCount - a.executionStats.callCount)
      .slice(0, 5);
    
    return `
## 策略执行引擎报告

### 执行统计
- **总策略数**: ${stats.totalStrategies}
- **激活策略**: ${stats.activeStrategies}
- **总执行次数**: ${stats.totalExecutions}
- **平均成功率**: ${(stats.averageSuccessRate * 100).toFixed(1)}%
- **平均执行时间**: ${stats.averageExecutionTime.toFixed(2)}ms

### 最活跃策略 (Top 5)
${topStrategies.map((s, i) => 
  `${i + 1}. ${s.sourceStrategy.name} - ${s.executionStats.callCount}次执行, ` +
  `${((s.executionStats.successCount / Math.max(1, s.executionStats.callCount)) * 100).toFixed(0)}%成功率`
).join('\n')}

### 最近编译
${strategies
  .sort((a, b) => new Date(b.compiledAt).getTime() - new Date(a.compiledAt).getTime())
  .slice(0, 3)
  .map(s => `- ${s.sourceStrategy.name} (v${s.version}) - ${new Date(s.compiledAt).toLocaleDateString()}`)
  .join('\n')}
`;
  }
}

export default StrategyExecutor;
