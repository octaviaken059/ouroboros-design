/**
 * @file core/reflection/reflection-engine.ts
 * @description 反思执行引擎 - Step 5.3
 * @author Ouroboros
 * @date 2026-02-18
 */

import type {
  ReflectionResult,
  ReflectionConfig,
  ReflectionEngineState,
  ReflectionTrigger,
  SuggestedAction,
  ApprovalMode,
} from '@/types/reflection';
import type { PerformanceMetrics } from '@/types/model';
import { ReflectionTriggerEngine } from './trigger-engine';
import { ReflectionAnalyzer } from './analyzer';
import { SoftSelfReferenceEngine } from '@/evolution/self-evolution/soft-self-reference';
import { createContextLogger } from '@/utils/logger';
import { randomUUID } from 'crypto';

const logger = createContextLogger('ReflectionEngine');

/**
 * 反思引擎配置接口
 */
interface ReflectionEngineOptions {
  config?: Partial<ReflectionConfig>;
  onReflectionComplete?: (result: ReflectionResult) => void;
  onActionApproved?: (action: SuggestedAction) => void;
  onConfigChange?: (changes: Array<{ path: string; value: unknown }>) => void;
  /** Phase 6: 记忆清理回调 */
  onMemoryPrune?: (threshold: number) => number;
}

/**
 * 反思引擎
 * 
 * 管理完整的反思流程：触发 → 分析 → 生成洞察 → 执行改进行动
 */
export class ReflectionEngine {
  /** 配置 */
  private config: ReflectionConfig;
  /** 状态 */
  private state: ReflectionEngineState;
  /** 触发器引擎 */
  private triggerEngine: ReflectionTriggerEngine;
  /** 分析器 */
  private analyzer: ReflectionAnalyzer;
  /** 性能指标历史 */
  private performanceMetrics: PerformanceMetrics[] = [];
  /** 记忆统计 */
  private memoryStats: {
    typeCounts: Record<string, number>;
    salienceReport: {
      highSalience: number;
      mediumSalience: number;
      lowSalience: number;
      shouldForget: number;
    };
  } = { typeCounts: {}, salienceReport: { highSalience: 0, mediumSalience: 0, lowSalience: 0, shouldForget: 0 } };
  /** 回调函数 */
  private onReflectionComplete?: ((result: ReflectionResult) => void) | undefined;
  /** 行动批准回调 */
  private onActionApproved?: ((action: SuggestedAction) => void) | undefined;
  /** 配置变更回调 */
  private onConfigChange?: ((changes: Array<{ path: string; value: unknown }>) => void) | undefined;
  /** 记忆清理回调 */
  private onMemoryPrune?: ((threshold: number) => number) | undefined;
  /** 等待审批的行动 */
  private pendingActions: SuggestedAction[] = [];
  /** 变更历史 */
  private changeHistory: Array<{
    timestamp: string;
    action: SuggestedAction;
    result: 'success' | 'failure';
    error?: string;
  }> = [];
  /** Phase 6: 软自指引擎 */
  private softSelfRefEngine: SoftSelfReferenceEngine;

  constructor(options: ReflectionEngineOptions = {}) {
    // 默认配置
    this.config = {
      enabled: true,
      approvalMode: options.config?.approvalMode || 'conservative',
      scheduleIntervalMs: options.config?.scheduleIntervalMs || 30 * 60 * 1000,
      performanceThreshold: options.config?.performanceThreshold || 0.7,
      maxInsights: options.config?.maxInsights || 10,
      autoExecuteLowRisk: options.config?.autoExecuteLowRisk ?? true,
    };

    // 初始状态
    this.state = {
      running: false,
      reflectionCount: 0,
      appliedInsightsCount: 0,
      pendingActionsCount: 0,
      currentMode: this.config.approvalMode,
    };

    // 初始化组件
    this.triggerEngine = new ReflectionTriggerEngine(this.config.scheduleIntervalMs);
    this.analyzer = new ReflectionAnalyzer();
    this.softSelfRefEngine = new SoftSelfReferenceEngine();  // Phase 6: 初始化软自指引擎

    // 设置回调
    this.onReflectionComplete = options.onReflectionComplete;
    this.onActionApproved = options.onActionApproved;
    this.onConfigChange = options.onConfigChange;
    this.onMemoryPrune = options.onMemoryPrune;

    // 注册触发器回调
    this.triggerEngine.onTrigger(this.handleTrigger.bind(this));

    logger.info('反思引擎初始化完成', { mode: this.config.approvalMode });
  }

  /**
   * 启动反思引擎
   */
  start(): void {
    if (this.state.running) {
      logger.warn('反思引擎已在运行');
      return;
    }

    if (!this.config.enabled) {
      logger.info('反思引擎已禁用，不启动');
      return;
    }

    this.state.running = true;
    this.triggerEngine.start();

    // 生成初始模拟性能数据（用于演示）
    this.generateMockPerformanceData();

    logger.info('反思引擎已启动', { mode: this.config.approvalMode });
  }

  /**
   * 生成模拟性能数据（用于演示和测试）
   */
  private generateMockPerformanceData(): void {
    // 生成20条模拟性能数据
    const now = Date.now();
    for (let i = 0; i < 20; i++) {
      const responseTimeMs = 500 + Math.random() * 1000; // 500-1500ms
      const success = Math.random() > 0.1; // 90%成功率
      
      // 添加到反思引擎的指标数组
      this.performanceMetrics.push({
        model: 'deepseek-r1:8b',
        inputTokens: 500 + Math.floor(Math.random() * 1000),
        outputTokens: 200 + Math.floor(Math.random() * 800),
        responseTimeMs,
        success,
        timestamp: new Date(now - (20 - i) * 60000).toISOString(), // 每分钟一条
      });
      
      // 同时更新触发器引擎的性能数据
      this.triggerEngine.updatePerformanceData({
        responseTime: responseTimeMs,
        success,
      });
    }
    logger.info('生成模拟性能数据', { count: this.performanceMetrics.length });
  }

  /**
   * 停止反思引擎
   */
  stop(): void {
    if (!this.state.running) return;

    this.state.running = false;
    this.triggerEngine.stop();

    logger.info('反思引擎已停止');
  }

  /**
   * 手动触发反思
   */
  async triggerReflection(): Promise<ReflectionResult | null> {
    if (!this.config.enabled) {
      logger.warn('反思引擎已禁用');
      return null;
    }

    logger.info('手动触发反思');
    return this.performReflection({
      id: randomUUID(),
      type: 'manual',
      name: '手动反思',
      description: '用户手动触发的反思',
      enabled: true,
      condition: {},
      cooldownMs: 0,
      triggerCount: 0,
    });
  }

  /**
   * 更新性能指标
   */
  updatePerformanceMetric(metric: PerformanceMetrics): void {
    this.performanceMetrics.push(metric);
    
    // 限制历史记录数量
    if (this.performanceMetrics.length > 1000) {
      this.performanceMetrics = this.performanceMetrics.slice(-500);
    }

    // 更新触发器引擎
    this.triggerEngine.updatePerformanceData({
      responseTime: metric.responseTimeMs,
      success: metric.success,
    });
  }

  /**
   * 更新记忆统计
   */
  updateMemoryStats(stats: {
    typeCounts: Record<string, number>;
    salienceReport: {
      highSalience: number;
      mediumSalience: number;
      lowSalience: number;
      shouldForget: number;
    };
  }): void {
    this.memoryStats = stats;
  }

  /**
   * 审批行动
   */
  approveAction(actionId: string): boolean {
    const actionIndex = this.pendingActions.findIndex(a => a.id === actionId);
    if (actionIndex === -1) {
      logger.warn('未找到待审批的行动', { actionId });
      return false;
    }

    const action = this.pendingActions.splice(actionIndex, 1)[0];
    this.state.pendingActionsCount = this.pendingActions.length;

    this.executeAction(action);
    
    if (this.onActionApproved) {
      this.onActionApproved(action);
    }

    return true;
  }

  /**
   * 拒绝行动
   */
  rejectAction(actionId: string): boolean {
    const actionIndex = this.pendingActions.findIndex(a => a.id === actionId);
    if (actionIndex === -1) return false;

    this.pendingActions.splice(actionIndex, 1);
    this.state.pendingActionsCount = this.pendingActions.length;

    logger.info('行动已拒绝', { actionId });
    return true;
  }

  /**
   * 设置审批模式
   */
  setApprovalMode(mode: ApprovalMode): void {
    this.config.approvalMode = mode;
    this.state.currentMode = mode;
    logger.info('审批模式已更改', { mode });
  }

  /**
   * 获取状态
   */
  getState(): ReflectionEngineState {
    return { ...this.state };
  }

  /**
   * 获取待审批的行动
   */
  getPendingActions(): SuggestedAction[] {
    return [...this.pendingActions];
  }

  /**
   * 获取变更历史
   */
  getChangeHistory(): typeof this.changeHistory {
    return [...this.changeHistory];
  }

  /**
   * 获取触发器引擎（用于获取性能统计）
   */
  getTriggerEngine(): ReflectionTriggerEngine {
    return this.triggerEngine;
  }

  /**
   * Phase 6: 获取软自指引擎
   */
  getSoftSelfReferenceEngine(): SoftSelfReferenceEngine {
    return this.softSelfRefEngine;
  }

  /**
   * Phase 6: 获取自进化统计
   */
  getEvolutionStats(): {
    variantCount: number;
    activeVariantCount: number;
    activeTestCount: number;
    completedTestCount: number;
  } {
    return this.softSelfRefEngine.getStats();
  }

  /**
   * Phase 6: 记录变体性能（供外部调用）
   */
  recordVariantPerformance(variantId: string, success: boolean, responseTime: number): void {
    this.softSelfRefEngine.recordVariantPerformance(variantId, success, responseTime);
  }

  /**
   * 处理触发器触发
   */
  private async handleTrigger(trigger: ReflectionTrigger): Promise<void> {
    if (!this.config.enabled) return;

    logger.info('处理触发器', { type: trigger.type, name: trigger.name });
    await this.performReflection(trigger);
  }

  /**
   * 执行反思流程
   */
  private async performReflection(trigger: ReflectionTrigger): Promise<ReflectionResult> {
    const startTime = Date.now();

    // 1. 分析
    const analysis = this.analyzer.analyze(
      this.performanceMetrics,
      this.memoryStats
    );

    // 2. 应用审批策略
    const { approvedActions, rejectedActions } = this.applyApprovalPolicy(
      analysis.suggestedActions
    );

    // 3. 构建结果
    const result: ReflectionResult = {
      id: randomUUID(),
      triggerType: trigger.type,
      triggeredAt: new Date().toISOString(),
      analysisDurationMs: Date.now() - startTime,
      insights: analysis.insights,
      suggestedActions: analysis.suggestedActions,
      approvedActions,
      rejectedActions,
      approvalMode: this.config.approvalMode,
      status: approvedActions.length > 0 ? 'approved' : 'pending',
    };

    // 4. 执行自动批准的低风险行动
    for (const action of approvedActions) {
      if (action.riskLevel === 'low' && this.config.autoExecuteLowRisk) {
        await this.executeAction(action);
      } else {
        this.pendingActions.push(action);
      }
    }

    this.state.pendingActionsCount = this.pendingActions.length;
    this.state.reflectionCount++;
    this.state.appliedInsightsCount += analysis.insights.filter(i => !i.applied).length;
    this.state.lastReflectionAt = result.triggeredAt;

    // 5. 回调通知
    if (this.onReflectionComplete) {
      this.onReflectionComplete(result);
    }

    logger.info('反思完成', {
      id: result.id,
      insightCount: result.insights.length,
      approvedCount: approvedActions.length,
      pendingCount: this.pendingActions.length,
    });

    return result;
  }

  /**
   * 应用审批策略
   */
  private applyApprovalPolicy(actions: SuggestedAction[]): {
    approvedActions: SuggestedAction[];
    rejectedActions: SuggestedAction[];
  } {
    const approvedActions: SuggestedAction[] = [];
    const rejectedActions: SuggestedAction[] = [];

    for (const action of actions) {
      let approved = false;

      switch (this.config.approvalMode) {
        case 'auto':
          // 自动模式：所有行动自动批准
          approved = true;
          break;

        case 'conservative':
          // 保守模式：只批准低风险行动
          approved = action.riskLevel === 'low';
          break;

        case 'human':
          // 人工模式：所有行动都需人工审批
          approved = false;
          break;
      }

      if (approved) {
        approvedActions.push(action);
      } else {
        rejectedActions.push(action);
      }
    }

    return { approvedActions, rejectedActions };
  }

  /**
   * 执行行动
   */
  private async executeAction(action: SuggestedAction): Promise<void> {
    logger.info('执行改进行动', {
      id: action.id,
      type: action.type,
      description: action.description,
    });

    try {
      // 根据行动类型执行不同的变更
      switch (action.type) {
        case 'budgetAdjustment':
          await this.executeBudgetAdjustment(action);
          break;

        case 'promptOptimization':
          await this.executePromptOptimization(action);
          break;

        case 'parameterTuning':
          await this.executeParameterTuning(action);
          break;

        case 'workflowChange':
          await this.executeWorkflowChange(action);
          break;

        default:
          logger.warn('未知的行动类型', { type: action.type });
      }

      // 记录成功
      this.changeHistory.push({
        timestamp: new Date().toISOString(),
        action,
        result: 'success',
      });

      logger.info('行动执行成功', { actionId: action.id });

    } catch (error) {
      // 记录失败
      this.changeHistory.push({
        timestamp: new Date().toISOString(),
        action,
        result: 'failure',
        error: error instanceof Error ? error.message : String(error),
      });

      logger.error('行动执行失败', { actionId: action.id, error });
    }
  }

  /**
   * 执行预算调整 - 真正生效
   */
  private async executeBudgetAdjustment(action: SuggestedAction): Promise<void> {
    if (!action.configChanges || action.configChanges.length === 0) return;

    const changes = action.configChanges.map(change => ({
      path: change.path,
      value: change.proposedValue,
    }));

    // 调用配置变更回调
    if (this.onConfigChange) {
      this.onConfigChange(changes);
      
      for (const change of action.configChanges) {
        logger.info('Token预算调整已应用', {
          path: change.path,
          from: change.currentValue,
          to: change.proposedValue,
          reason: change.reason,
        });
      }
    } else {
      logger.warn('未设置配置变更回调，预算调整未应用');
    }
    
    // 记录变更历史
    this.changeHistory.push({
      timestamp: new Date().toISOString(),
      action,
      result: 'success',
    });
  }

  /**
   * 执行提示词优化 - Phase 6 软自指 + A/B测试
   * 真正创建A/B测试并激活优化策略
   */
  private async executePromptOptimization(action: SuggestedAction): Promise<void> {
    logger.info('执行提示词优化（软自指+A/B测试）', { description: action.description });

    // 根据问题类型选择优化策略
    let strategy: 'REDUCE_RISK' | 'INCREASE_EXPLORATION' | 'IMPROVE_TOKEN_EFFICIENCY' | 'ENHANCE_MEMORY_RETRIEVAL' | 'ADJUST_VERBOSITY';

    if (action.description.includes('风险') || action.description.includes('错误')) {
      strategy = 'REDUCE_RISK';
    } else if (action.description.includes('探索')) {
      strategy = 'INCREASE_EXPLORATION';
    } else if (action.description.includes('Token') || action.description.includes('成本')) {
      strategy = 'IMPROVE_TOKEN_EFFICIENCY';
    } else if (action.description.includes('记忆')) {
      strategy = 'ENHANCE_MEMORY_RETRIEVAL';
    } else {
      strategy = 'ADJUST_VERBOSITY';
    }

    // 创建优化变体
    const newVariant = this.softSelfRefEngine.applyOptimization(strategy, action.description);

    // 获取当前活跃变体作为对照组
    const currentVariant = this.softSelfRefEngine.getActiveVariant('self');

    if (currentVariant && newVariant) {
      // 创建 A/B 测试
      const test = this.softSelfRefEngine.createABTest(
        `反思优化: ${action.description.slice(0, 50)}`,
        action.description,
        currentVariant.id,
        newVariant.id,
        30  // 最小样本数
      );

      // 记录成功
      this.changeHistory.push({
        timestamp: new Date().toISOString(),
        action: {
          ...action,
          metadata: {
            testId: test.id,
            variantId: newVariant.id,
            strategy,
          },
        },
        result: 'success',
      });

      logger.info('已创建A/B测试', { 
        testId: test.id, 
        variantA: currentVariant.id, 
        variantB: newVariant.id,
        strategy,
      });
    }
  }

  /**
   * 执行参数调整 - 包括记忆清理
   */
  private async executeParameterTuning(action: SuggestedAction): Promise<void> {
    logger.info('执行参数调整', { description: action.description });
    
    // 记忆清理操作
    if (action.description.includes('记忆') || action.description.includes('遗忘') || action.description.includes('清理')) {
      if (this.onMemoryPrune) {
        // 使用阈值 0.1 清理低显著性记忆
        const prunedCount = this.onMemoryPrune(0.1);
        
        logger.info('记忆清理已执行', { 
          prunedCount,
          threshold: 0.1,
        });
        
        // 记录成功
        this.changeHistory.push({
          timestamp: new Date().toISOString(),
          action: {
            ...action,
            metadata: {
              prunedCount,
              threshold: 0.1,
            },
          },
          result: 'success',
        });
      } else {
        logger.warn('未设置记忆清理回调，清理未执行');
      }
    }
  }

  /**
   * 执行工作流变更
   */
  private async executeWorkflowChange(action: SuggestedAction): Promise<void> {
    logger.info('变更工作流', { description: action.description });
    // 实际应用中，这里应该修改工作流配置
  }

  /**
   * 设置记忆清理回调
   */
  setMemoryPruneCallback(callback: (threshold: number) => number): void {
    this.onMemoryPrune = callback;
    logger.info('记忆清理回调已设置');
  }
}
