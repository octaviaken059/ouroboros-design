/**
 * @file evolution/self-evolution/soft-self-reference.ts
 * @description 软自指引擎 - 完整版 (含A/B测试)
 * @author Ouroboros
 * @date 2026-02-18
 *
 * 通过修改自我描述提示词优化系统行为（安全自指）
 */

import { createContextLogger } from '@/utils/logger';
import { randomUUID } from 'crypto';

const logger = createContextLogger('SoftSelfReference');

/**
 * 优化策略
 */
export type OptimizationStrategy =
  | 'REDUCE_RISK'      // 降低风险偏好
  | 'INCREASE_EXPLORATION'  // 增加探索
  | 'IMPROVE_TOKEN_EFFICIENCY'  // 提高Token效率
  | 'ENHANCE_MEMORY_RETRIEVAL'  // 增强记忆检索
  | 'ADJUST_VERBOSITY';  // 调整详细程度

/**
 * 提示词变体
 */
export interface PromptVariant {
  id: string;
  name: string;
  type: 'system' | 'self' | 'memory';
  content: string;
  parentId?: string | undefined;
  createdAt: string;
  performance: {
    usageCount: number;
    successCount: number;
    totalResponseTime: number;
    avgResponseTime: number;
  };
  isActive: boolean;
}

/**
 * A/B 测试
 */
export interface ABTest {
  id: string;
  name: string;
  hypothesis: string;
  variantA: string;  // 对照组变体ID
  variantB: string;  // 实验组变体ID
  startTime: string;
  endTime?: string;
  status: 'running' | 'completed' | 'cancelled';
  winner?: string;
  confidence?: number;  // 统计置信度
  sampleSize: number;   // 当前样本数
  minSampleSize: number; // 最小样本数
}

/**
 * A/B 测试详细结果
 */
export interface ABTestResult {
  winner: string;
  confidence: number;
  improvement: number;
  pValue: number;
  sampleSizeA: number;
  sampleSizeB: number;
  successRateA: number;
  successRateB: number;
}

/**
 * 软自指引擎 - 完整版
 */
export class SoftSelfReferenceEngine {
  private variants: Map<string, PromptVariant> = new Map();
  private activeTests: Map<string, ABTest> = new Map();
  private testResults: Map<string, ABTestResult> = new Map();
  private currentSystemPrompt: string = '';
  /** 流量分配：变体ID -> 分配比例 (0-1) */
  private trafficAllocation: Map<string, number> = new Map();
  /** 当前请求计数，用于轮询分配 */
  private requestCounter = 0;
  /** 配置 */
  private config = {
    minSampleSize: 30,
    confidenceLevel: 0.95,
    autoPromoteWinner: true,
    trafficSplit: 0.5, // 50/50 分配
  };

  constructor() {
    this.initializeDefaultVariants();
    this.initializeTrafficAllocation();
    logger.info('软自指引擎初始化完成');
  }

  /**
   * 初始化流量分配
   */
  private initializeTrafficAllocation(): void {
    // 默认将流量平均分配给活跃变体
    for (const variant of this.variants.values()) {
      if (variant.isActive) {
        this.trafficAllocation.set(variant.id, 1.0);
      }
    }
  }

  /**
   * 初始化默认变体
   */
  private initializeDefaultVariants(): void {
    // 系统提示词 - 基础版本
    this.variants.set('system-default', {
      id: 'system-default',
      name: '系统提示词 - 默认',
      type: 'system',
      content: `你是 Ouroboros，一个具身自指进化 AI Agent。

核心特性：
- 具身性: 你能感知和描述自身运行的环境
- 自指性: 你能监控和反思自己的代码和行为
- 稳态保护: 你会自动检测资源使用并调整行为

请保持专业、有帮助的态度，同时展现你的独特个性。`,
      createdAt: new Date().toISOString(),
      performance: { usageCount: 0, successCount: 0, totalResponseTime: 0, avgResponseTime: 0 },
      isActive: true,
    });

    // 自我提示词 - 默认
    this.variants.set('self-default', {
      id: 'self-default',
      name: '自我提示词 - 默认',
      type: 'self',
      content: `当前状态: 正常运行
激素水平: 平衡
目标: 为用户提供最佳服务`,
      createdAt: new Date().toISOString(),
      performance: { usageCount: 0, successCount: 0, totalResponseTime: 0, avgResponseTime: 0 },
      isActive: true,
    });
  }

  /**
   * 应用优化策略，创建新变体
   */
  applyOptimization(strategy: OptimizationStrategy, reason: string): PromptVariant {
    const baseVariant = this.getActiveVariant('self');
    
    const optimizedContent = this.generateOptimizedContent(baseVariant?.content || '', strategy);
    
    const newVariant: PromptVariant = {
      id: `variant-${randomUUID()}`,
      name: `${baseVariant?.name || '基础'} (优化: ${strategy})`,
      type: 'self',
      content: optimizedContent,
      parentId: baseVariant?.id,
      createdAt: new Date().toISOString(),
      performance: { usageCount: 0, successCount: 0, totalResponseTime: 0, avgResponseTime: 0 },
      isActive: false,  // 需要A/B测试后才能激活
    };

    this.variants.set(newVariant.id, newVariant);
    
    logger.info('生成优化变体', { strategy, variantId: newVariant.id, reason });
    
    return newVariant;
  }

  /**
   * 生成优化后的提示词内容
   */
  private generateOptimizedContent(baseContent: string, strategy: OptimizationStrategy): string {
    const strategies: Record<OptimizationStrategy, string> = {
      REDUCE_RISK: `\n\n[安全增强] 在执行任何操作前，请先评估风险。如果风险超过中等水平，请请求用户确认。`,
      INCREASE_EXPLORATION: `\n\n[探索增强] 当遇到不确定的情况时，主动尝试不同的方法，并记录哪些方法有效。`,
      IMPROVE_TOKEN_EFFICIENCY: baseContent
        .replace(/\n\n+/g, '\n')
        .replace(/\[[^\]]+\]\s*/g, '')
        .slice(0, Math.floor(baseContent.length * 0.8)),
      ENHANCE_MEMORY_RETRIEVAL: `\n\n[记忆增强] 在回复前，请先检索相关记忆，并在回复中引用相关信息。`,
      ADJUST_VERBOSITY: `\n\n[简洁模式] 请尽量简洁回复，只提供最关键的信息。`,
    };

    if (strategy === 'IMPROVE_TOKEN_EFFICIENCY') {
      return strategies[strategy];
    }

    return baseContent + strategies[strategy];
  }

  /**
   * 创建 A/B 测试
   */
  createABTest(name: string, hypothesis: string, variantAId: string, variantBId: string, minSampleSize: number = 30): ABTest {
    const test: ABTest = {
      id: `abtest-${randomUUID()}`,
      name,
      hypothesis,
      variantA: variantAId,
      variantB: variantBId,
      startTime: new Date().toISOString(),
      status: 'running',
      sampleSize: 0,
      minSampleSize,
    };

    this.activeTests.set(test.id, test);
    
    logger.info('创建A/B测试', { testId: test.id, name, hypothesis, minSampleSize });
    
    return test;
  }

  /**
   * 记录变体性能
   */
  recordVariantPerformance(variantId: string, success: boolean, responseTime: number): void {
    const variant = this.variants.get(variantId);
    if (!variant) return;

    variant.performance.usageCount++;
    if (success) variant.performance.successCount++;
    variant.performance.totalResponseTime += responseTime;
    variant.performance.avgResponseTime = 
      variant.performance.totalResponseTime / variant.performance.usageCount;

    // 更新相关测试的样本数
    for (const test of this.activeTests.values()) {
      if (test.status === 'running' && (test.variantA === variantId || test.variantB === variantId)) {
        test.sampleSize++;
        
        // 自动检查是否达到最小样本数
        if (test.sampleSize >= test.minSampleSize) {
          this.evaluateABTest(test.id);
        }
      }
    }
  }

  /**
   * 评估A/B测试结果（统计显著性检验 - Z检验）
   * 使用双比例Z检验来确定两个变体之间是否存在统计显著性差异
   */
  private evaluateABTest(testId: string): ABTestResult | null {
    const test = this.activeTests.get(testId);
    if (!test || test.status !== 'running') return null;

    const variantA = this.variants.get(test.variantA);
    const variantB = this.variants.get(test.variantB);

    if (!variantA || !variantB) return null;

    // 计算成功率和样本数
    const n1 = variantA.performance.usageCount;
    const n2 = variantB.performance.usageCount;
    const s1 = variantA.performance.successCount;
    const s2 = variantB.performance.successCount;
    
    const p1 = n1 > 0 ? s1 / n1 : 0;
    const p2 = n2 > 0 ? s2 / n2 : 0;
    
    // 检查最小样本数要求
    if (n1 < this.config.minSampleSize / 2 || n2 < this.config.minSampleSize / 2) {
      return null; // 样本数不足
    }

    // 合并成功率 (pooled proportion)
    const p = (s1 + s2) / (n1 + n2);
    
    // 标准误差 (Standard Error)
    const se = Math.sqrt(p * (1 - p) * (1/n1 + 1/n2));
    
    if (se === 0) return null; // 避免除零
    
    // Z分数
    const z = Math.abs(p1 - p2) / se;
    
    // 根据Z分数计算置信度
    // Z=1.645 ~ 90%, Z=1.96 ~ 95%, Z=2.576 ~ 99%
    let confidence = 0;
    if (z >= 2.576) confidence = 0.99;
    else if (z >= 1.96) confidence = 0.95;
    else if (z >= 1.645) confidence = 0.90;
    else if (z >= 1.28) confidence = 0.80;
    
    // p值近似 (简化计算)
    const pValue = Math.exp(-0.5 * z * z) / (z * Math.sqrt(2 * Math.PI)) * 2;

    // 如果达到统计显著性阈值
    if (confidence >= this.config.confidenceLevel) {
      const winner = p2 > p1 ? test.variantB : test.variantA;
      const improvement = Math.abs(p2 - p1);
      
      test.winner = winner;
      test.confidence = confidence;
      test.status = 'completed';
      test.endTime = new Date().toISOString();

      // 保存测试结果
      const result: ABTestResult = {
        winner,
        confidence,
        improvement,
        pValue,
        sampleSizeA: n1,
        sampleSizeB: n2,
        successRateA: p1,
        successRateB: p2,
      };
      this.testResults.set(testId, result);

      // 自动激活胜者
      if (this.config.autoPromoteWinner) {
        this.activateVariant(winner);
        logger.info('A/B测试完成，自动激活胜者', { 
          testId, 
          winner, 
          confidence: `${(confidence * 100).toFixed(1)}%`,
          improvement: `${(improvement * 100).toFixed(1)}%`,
          pValue: pValue.toExponential(2),
        });
      }

      return result;
    }

    return null;
  }

  /**
   * 手动完成 A/B 测试
   */
  completeABTest(testId: string): { winner: string; confidence: number; improvement: number } | null {
    this.evaluateABTest(testId);
    
    const test = this.activeTests.get(testId);
    if (!test || test.status !== 'completed') return null;

    const variantA = this.variants.get(test.variantA);
    const variantB = this.variants.get(test.variantB);

    if (!variantA || !variantB) return null;

    const successRateA = variantA.performance.usageCount > 0 
      ? variantA.performance.successCount / variantA.performance.usageCount 
      : 0;
    const successRateB = variantB.performance.usageCount > 0
      ? variantB.performance.successCount / variantB.performance.usageCount
      : 0;

    return { 
      winner: test.winner!, 
      confidence: test.confidence || 0,
      improvement: Math.abs(successRateB - successRateA),
    };
  }

  /**
   * 激活变体
   */
  activateVariant(variantId: string): void {
    const variant = this.variants.get(variantId);
    if (!variant) return;

    // 禁用同类型的其他变体
    for (const v of this.variants.values()) {
      if (v.type === variant.type) {
        v.isActive = false;
      }
    }

    variant.isActive = true;
    
    if (variant.type === 'system') {
      this.currentSystemPrompt = variant.content;
    }

    logger.info('变体已激活', { variantId, type: variant.type });
  }

  /**
   * 获取活跃变体
   */
  getActiveVariant(type: 'system' | 'self' | 'memory'): PromptVariant | null {
    for (const variant of this.variants.values()) {
      if (variant.type === type && variant.isActive) {
        return variant;
      }
    }
    return null;
  }

  /**
   * 获取当前系统提示词
   */
  getCurrentSystemPrompt(): string {
    return this.currentSystemPrompt;
  }

  /**
   * 获取所有变体
   */
  getAllVariants(): PromptVariant[] {
    return Array.from(this.variants.values());
  }

  /**
   * 获取 A/B 测试列表
   */
  getABTests(): ABTest[] {
    return Array.from(this.activeTests.values());
  }

  /**
   * 获取引擎统计
   */
  getStats(): {
    variantCount: number;
    activeVariantCount: number;
    activeTestCount: number;
    completedTestCount: number;
    totalUsage: number;
    totalSuccess: number;
  } {
    const tests = this.getABTests();
    const variants = Array.from(this.variants.values());
    return {
      variantCount: this.variants.size,
      activeVariantCount: variants.filter(v => v.isActive).length,
      activeTestCount: tests.filter(t => t.status === 'running').length,
      completedTestCount: tests.filter(t => t.status === 'completed').length,
      totalUsage: variants.reduce((sum, v) => sum + v.performance.usageCount, 0),
      totalSuccess: variants.reduce((sum, v) => sum + v.performance.successCount, 0),
    };
  }

  /**
   * 获取 A/B 测试详细结果
   */
  getTestResult(testId: string): ABTestResult | undefined {
    return this.testResults.get(testId);
  }

  /**
   * 自动分配流量（轮询方式）
   * 返回应该使用的变体ID
   */
  allocateTraffic(type: 'system' | 'self' | 'memory'): string | null {
    // 查找进行中的A/B测试
    const runningTests = Array.from(this.activeTests.values())
      .filter(t => t.status === 'running');
    
    // 如果有相关测试，根据测试分配流量
    for (const test of runningTests) {
      const variantA = this.variants.get(test.variantA);
      const variantB = this.variants.get(test.variantB);
      
      if (variantA?.type === type || variantB?.type === type) {
        // 50/50 分配
        this.requestCounter++;
        return this.requestCounter % 2 === 0 ? test.variantA : test.variantB;
      }
    }
    
    // 没有测试时，返回活跃变体
    const activeVariant = this.getActiveVariant(type);
    return activeVariant?.id || null;
  }

  /**
   * 获取流量分配状态
   */
  getTrafficAllocation(): Record<string, number> {
    const allocation: Record<string, number> = {};
    for (const [variantId, ratio] of this.trafficAllocation.entries()) {
      allocation[variantId] = ratio;
    }
    return allocation;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...config };
    logger.info('软自指引擎配置已更新', { config: this.config });
  }

  /**
   * 取消 A/B 测试
   */
  cancelABTest(testId: string): boolean {
    const test = this.activeTests.get(testId);
    if (!test || test.status !== 'running') return false;
    
    test.status = 'cancelled';
    test.endTime = new Date().toISOString();
    
    logger.info('A/B测试已取消', { testId });
    return true;
  }

  /**
   * 手动设置流量分配
   */
  setTrafficAllocation(variantId: string, ratio: number): boolean {
    const variant = this.variants.get(variantId);
    if (!variant) return false;
    
    this.trafficAllocation.set(variantId, Math.max(0, Math.min(1, ratio)));
    return true;
  }
}

export default SoftSelfReferenceEngine;
