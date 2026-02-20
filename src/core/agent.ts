/**
 * @file core/agent.ts
 * @description Ouroboros Agent 主类 - 集成所有模块，支持持久化
 * @author Ouroboros
 * @date 2026-02-18
 */

import { IdentityManager } from './self-description/identity';
import { BodyManager } from './self-description/body';
import { WorldModelManager } from './self-description/world-model';
import { CognitiveStateManager } from './self-description/cognitive-state';
import { ToolSetManager } from './self-description/tool-set';
import { MemorySystem } from './memory/memory-system';
import { BayesianCore } from './bayesian/bayesian-core';
import { ReflectionEngine } from './reflection/reflection-engine';
import { HormoneSystem } from '@/evolution/hormone/hormone-system';
import { TriggerEngine } from '@/evolution/hormone/trigger-engine';
import { EmotionalStateGenerator } from '@/evolution/hormone/emotional-state-generator';
import type { HormoneType, HormoneChange, Trigger } from '@/types/hormone';
import type { TriggerContext } from '@/evolution/hormone/trigger-engine';
import { ModelClient } from '@/capabilities/model-engine/model-client';
import { PromptAssembler } from '@/capabilities/model-engine/prompt-assembler';
import { PerformanceMonitor } from '@/capabilities/model-engine/performance-monitor';
import type { ModelResponse } from '@/types/model';
import type { AnyMemory } from '@/types/memory';
import { loadConfig, getConfig, type OuroborosConfig } from '@/config';
import { initDatabase, saveAgentState, loadAgentState } from '@/db';
import { createContextLogger } from '@/utils/logger';
import { OuroborosError } from '@/utils/error';
import { MetaCognitionCore, DynamicPromptAssembler, ReasoningMonitor, StrategyEncoder, SelfReferentialMemory, StrategyExecutor } from './metacognition';
import { WebServer } from '@/adapter/web/server';

const logger = createContextLogger('OuroborosAgent');

/**
 * Agent 选项
 */
export interface AgentOptions {
  /** 配置文件路径 */
  configPath?: string;
  /** 自定义配置 */
  customConfig?: Partial<OuroborosConfig>;
  /** 是否启用持久化 */
  enablePersistence?: boolean;
}

/**
 * Agent 运行状态
 */
export interface AgentStatus {
  /** 是否运行中 */
  running: boolean;
  /** 当前情绪 */
  emotion: string;
  /** 激素水平 */
  hormoneLevels: Record<HormoneType, number>;
  /** 已处理消息数 */
  messageCount: number;
  /** 启动时间 */
  startTime: string;
  /** 当前认知负荷 */
  cognitiveLoad: number;
}

/**
 * Ouroboros Agent 主类
 *
 * 集成模块：
 * - 自我描述系统（Identity/Body/WorldModel/CognitiveState/ToolSet）
 * - 激素系统（5种激素 + 触发器 + 情绪生成）
 * - 模型引擎（ModelClient + PromptAssembler + PerformanceMonitor）
 * - 持久化（SQLite）
 */
export class OuroborosAgent {
  /** 配置 */
  private config!: OuroborosConfig;

  // 自我描述模块
  private identityManager!: IdentityManager;
  private bodyManager!: BodyManager;
  private worldModelManager!: WorldModelManager;
  private cognitiveStateManager!: CognitiveStateManager;
  private toolSetManager!: ToolSetManager;

  // 记忆模块
  private memorySystem!: MemorySystem;

  // 贝叶斯认知核心
  private bayesianCore!: BayesianCore;

  // 反思引擎
  private reflectionEngine!: ReflectionEngine;

  // 元认知核心 (新增)
  private metaCognition!: MetaCognitionCore;

  // 动态提示生成器 (新增)
  private dynamicPromptAssembler!: DynamicPromptAssembler;

  // 推理监控器 (P2新增)
  private reasoningMonitor!: ReasoningMonitor;

  // 策略编码器 (P2新增)
  private strategyEncoder!: StrategyEncoder;

  // 自指编码记忆 (P3新增)
  private selfReferentialMemory!: SelfReferentialMemory;

  // 策略执行器 (P4新增)
  private strategyExecutor!: StrategyExecutor;

  // 激素模块
  private hormoneSystem!: HormoneSystem;
  private triggerEngine!: TriggerEngine;
  private emotionalStateGenerator!: EmotionalStateGenerator;

  // 模型引擎模块
  private modelClient!: ModelClient;
  private promptAssembler!: PromptAssembler;
  private performanceMonitor!: PerformanceMonitor;

  // 状态
  private running = false;
  private messageCount = 0;
  private startTime: string = '';
  private triggerCheckInterval?: NodeJS.Timeout | undefined;
  private enablePersistence = true;
  private _ebbinghausIntervals: NodeJS.Timeout[] = [];

  // Web 服务器
  private webServer?: WebServer | undefined;
  private webEnabled = true;

  // 对话历史 (用于保持上下文)
  private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  private readonly maxHistoryLength = 20;

  // 调试信息
  private lastDebugInfo?: {
    timestamp: string;
    systemPrompt: string;
    messages: unknown[];
    assembledPrompt: unknown;
    memoryContext: string;
    selfDescription: unknown;
  };

  /**
   * 创建 Agent 实例（工厂方法）
   * @param options 选项
   * @returns Agent 实例
   */
  static create(options: AgentOptions = {}): OuroborosAgent {
    const agent = new OuroborosAgent();
    agent.initialize(options);
    return agent;
  }

  /**
   * 私有构造函数，使用 OuroborosAgent.create() 创建实例
   */
  private constructor() {
    // 初始化在 initialize() 中完成
  }

  /**
   * 初始化所有模块
   */
  private initialize(options: AgentOptions): void {
    this.enablePersistence = options.enablePersistence ?? true;

    try {
      // 1. 初始化数据库
      if (this.enablePersistence) {
        initDatabase();
      }

      // 2. 加载配置
      if (options.configPath) {
        this.config = loadConfig(options.configPath, this.enablePersistence);
      } else {
        this.config = loadConfig(undefined, this.enablePersistence);
      }

      if (options.customConfig) {
        this.config = { ...this.config, ...options.customConfig };
      }

      // 3. 初始化所有模块
      this.initModules();

      // 4. 尝试从数据库恢复状态
      if (this.enablePersistence) {
        this.restoreState();
      }

      logger.info('Ouroboros Agent 初始化完成');
    } catch (error) {
      logger.error('Agent 初始化失败', { error });
      throw error;
    }
  }

  /**
   * 初始化所有模块
   */
  private initModules(): void {
    const { core, model } = this.config;

    // 1. 初始化自我描述模块
    this.identityManager = new IdentityManager(core.identity);
    this.bodyManager = new BodyManager();
    this.worldModelManager = new WorldModelManager();
    this.cognitiveStateManager = new CognitiveStateManager();
    this.toolSetManager = new ToolSetManager();

    // 2. 初始化记忆系统
    this.memorySystem = new MemorySystem();

    // 3. 初始化贝叶斯认知核心
    this.bayesianCore = new BayesianCore();
    this.registerDefaultTools();

    // 4. 初始化反思引擎
    this.reflectionEngine = new ReflectionEngine({
      config: {
        enabled: true,
        approvalMode: 'conservative',
        scheduleIntervalMs: 30 * 60 * 1000, // 30分钟
        performanceThreshold: 0.7,
        maxInsights: 10,
        autoExecuteLowRisk: true,
      },
      onReflectionComplete: (result) => {
        logger.info('反思完成', {
          insightCount: result.insights.length,
          approvedActions: result.approvedActions.length,
        });
      },
      onActionApproved: (action) => {
        logger.info('改进行动已批准', {
          type: action.type,
          description: action.description,
        });
      },
      onConfigChange: (changes) => {
        // 处理配置变更，特别是Token预算调整
        for (const change of changes) {
          if (change.path.startsWith('budget.')) {
            const budgetType = change.path.replace('budget.', '') as 'system' | 'self' | 'memory' | 'user';
            const value = change.value as number;

            // 更新Token预算
            this.promptAssembler.updateBudget({ [budgetType]: value });

            logger.info('Token预算已调整', {
              type: budgetType,
              value,
            });
          }
        }
      },
    });

    // Phase 6: 设置记忆清理回调，使反思引擎可以执行遗忘
    this.reflectionEngine.setMemoryPruneCallback((threshold: number) => {
      const count = this.memorySystem.pruneMemories(threshold);
      logger.info('反思引擎触发记忆清理', { prunedCount: count, threshold });
      return count;
    });

    // 4.1 初始化元认知核心 (新增)
    this.metaCognition = new MetaCognitionCore();
    logger.info('元认知核心已初始化');

    // 4.2 初始化动态提示生成器 (新增)
    this.dynamicPromptAssembler = new DynamicPromptAssembler(this.metaCognition);
    logger.info('动态提示生成器已初始化');

    // 4.3 初始化推理监控器 (P2新增)
    this.reasoningMonitor = new ReasoningMonitor();
    logger.info('推理监控器已初始化');

    // 4.4 初始化策略编码器 (P2新增)
    this.strategyEncoder = new StrategyEncoder();
    logger.info('策略编码器已初始化');

    // 4.5 初始化自指编码记忆 (P3新增)
    this.selfReferentialMemory = new SelfReferentialMemory(this.memorySystem);
    logger.info('自指编码记忆已初始化');

    // 4.6 初始化策略执行器 (P4新增)
    this.strategyExecutor = new StrategyExecutor();
    logger.info('策略执行器已初始化');

    // 保留静态提示词方法备用（避免tree-shaking）
    void this.generateSystemPrompt;

    // 5. 初始化激素模块
    this.hormoneSystem = new HormoneSystem();
    this.triggerEngine = new TriggerEngine();
    this.emotionalStateGenerator = new EmotionalStateGenerator();

    // 6. 初始化模型引擎模块（带备用模型）
    this.modelClient = new ModelClient(
      model.defaultModel,
      model.fallbackModel ?? undefined
    );
    this.promptAssembler = new PromptAssembler();
    this.performanceMonitor = new PerformanceMonitor();

    // Phase 6: 连接 PromptAssembler 到软自指引擎
    this.connectPromptAssemblerToSoftSelfRef();

    // 7. 连接反思引擎数据源
    this.connectReflectionEngineDataSources();

    // 8. 注册默认触发器
    this.registerDefaultTriggers();

    logger.info('所有模块初始化完成');
  }

  /**
   * 连接反思引擎数据源
   * 将性能监控、记忆系统的数据连接到反思引擎
   */
  private connectReflectionEngineDataSources(): void {
    // 定期同步性能数据到反思引擎（每30秒）
    setInterval(() => {
      const recentRecords = this.performanceMonitor.getRecentRecords(10);
      for (const record of recentRecords) {
        this.reflectionEngine.updatePerformanceMetric({
          model: record.model,
          inputTokens: record.inputTokens,
          outputTokens: record.outputTokens,
          responseTimeMs: record.responseTimeMs,
          success: record.success,
          timestamp: record.timestamp,
        });
      }
    }, 30000);

    // 定期更新记忆统计到反思引擎（每5分钟）
    setInterval(() => {
      const memoryStats = this.memorySystem.getStats();

      // 计算显著性分布
      const allMemories = this.memorySystem.getStore().getAll();
      const highSalience = allMemories.filter((m: AnyMemory) => m.importance >= 0.7).length;
      const mediumSalience = allMemories.filter((m: AnyMemory) => m.importance >= 0.4 && m.importance < 0.7).length;
      const lowSalience = allMemories.filter((m: AnyMemory) => m.importance < 0.4).length;
      const shouldForget = allMemories.filter((m: AnyMemory) => {
        const age = Date.now() - new Date(m.createdAt).getTime();
        return m.importance < 0.3 && age > 7 * 24 * 60 * 60 * 1000; // 7天以上低重要性
      }).length;

      this.reflectionEngine.updateMemoryStats({
        typeCounts: memoryStats.typeCounts || {},
        salienceReport: {
          highSalience,
          mediumSalience,
          lowSalience,
          shouldForget,
        },
      });
    }, 5 * 60 * 1000);

    logger.info('反思引擎数据源已连接');
  }

  /**
   * Phase 6: 连接 PromptAssembler 到软自指引擎
   * 使提示词组装器能够使用优化后的提示词变体
   */
  private connectPromptAssemblerToSoftSelfRef(): void {
    try {
      const softRefEngine = this.reflectionEngine.getSoftSelfReferenceEngine();
      if (softRefEngine) {
        this.promptAssembler.setSoftSelfReferenceEngine(softRefEngine);
        logger.info('PromptAssembler 已连接到软自指引擎');
      }
    } catch (error) {
      logger.warn('连接 PromptAssembler 到软自指引擎失败', { error });
    }
  }

  /**
   * 从数据库恢复状态
   */
  private restoreState(): void {
    const state = loadAgentState();
    if (state) {
      this.messageCount = state.messageCount;
      logger.info('Agent 状态已从数据库恢复', {
        messageCount: this.messageCount,
        updatedAt: state.updatedAt,
      });
    }
  }

  /**
   * 保存状态到数据库
   */
  private saveState(): void {
    if (!this.enablePersistence) return;

    saveAgentState({
      identity: this.identityManager.toJSON(),
      body: this.bodyManager.toJSON(),
      worldModel: this.worldModelManager.toJSON(),
      cognitiveState: this.cognitiveStateManager.toJSON(),
      toolSet: this.toolSetManager.toJSON(),
      hormones: this.hormoneSystem.toJSON(),
      performanceMonitor: this.performanceMonitor.toJSON(),
      messageCount: this.messageCount,
    });
  }

  /**
   * 注册默认触发器
   */
  private registerDefaultTriggers(): void {
    // 高皮质醇（压力）触发器
    const highStressTrigger: Trigger = {
      id: 'high_stress',
      type: 'system_overload',
      name: '高压力检测',
      condition: { type: 'threshold', hormone: 'cortisol', min: 0.7 },
      effects: [{ hormone: 'serotonin', delta: -0.1 }],
      cooldownMs: 60000,
      enabled: true,
    };
    this.triggerEngine.registerTrigger(highStressTrigger);

    // 高多巴胺（动力）触发器
    const highMotivationTrigger: Trigger = {
      id: 'high_motivation',
      type: 'goal_achieved',
      name: '高动力状态',
      condition: { type: 'threshold', hormone: 'dopamine', min: 0.75 },
      effects: [{ hormone: 'norepinephrine', delta: 0.1 }],
      cooldownMs: 30000,
      enabled: true,
    };
    this.triggerEngine.registerTrigger(highMotivationTrigger);

    logger.info('默认触发器注册完成');
  }

  /**
   * 注册默认工具（用于贝叶斯置信度学习）
   */
  private registerDefaultTools(): void {
    // 注册模型调用工具
    this.bayesianCore.registerTool('model_call', 5, 1); // 5次成功，1次失败

    // 注册记忆检索工具
    this.bayesianCore.registerTool('memory_retrieval', 3, 0);

    // 注册提示词组装工具
    this.bayesianCore.registerTool('prompt_assembly', 4, 0);

    // 同时注册到工具集管理器 (用于Web界面显示)
    this.toolSetManager.registerTool({
      name: 'model_call',
      type: 'builtin',
      category: 'core',
      description: '调用AI模型生成响应',
      capabilities: ['generation', 'inference'],
      confidence: 0.83,
      status: 'available',
      priority: 'critical',
      parameters: {
        prompt: { type: 'string', required: true, description: '输入提示词' },
        model: { type: 'string', required: false, description: '模型名称' },
      },
    });

    this.toolSetManager.registerTool({
      name: 'memory_retrieval',
      type: 'builtin',
      category: 'memory',
      description: '从记忆系统检索相关记忆',
      capabilities: ['memory', 'retrieval'],
      confidence: 0.75,
      status: 'available',
      priority: 'high',
      parameters: {
        query: { type: 'string', required: true, description: '检索查询' },
        limit: { type: 'number', required: false, description: '返回数量限制' },
      },
    });

    this.toolSetManager.registerTool({
      name: 'prompt_assembly',
      type: 'builtin',
      category: 'core',
      description: '组装系统提示词',
      capabilities: ['assembly', 'prompt'],
      confidence: 0.8,
      status: 'available',
      priority: 'high',
      parameters: {
        context: { type: 'object', required: false, description: '上下文信息' },
      },
    });

    this.toolSetManager.registerTool({
      name: 'memory_store',
      type: 'builtin',
      category: 'memory',
      description: '存储新记忆到记忆系统',
      capabilities: ['memory', 'storage'],
      confidence: 0.9,
      status: 'available',
      priority: 'medium',
      parameters: {
        content: { type: 'string', required: true, description: '记忆内容' },
        type: { type: 'string', required: true, description: '记忆类型' },
        importance: { type: 'number', required: false, description: '重要性 (0-1)' },
      },
    });

    this.toolSetManager.registerTool({
      name: 'self_describe',
      type: 'builtin',
      category: 'introspection',
      description: '获取自我描述和状态信息',
      capabilities: ['introspection', 'description'],
      confidence: 0.95,
      status: 'available',
      priority: 'low',
      parameters: {},
    });

    logger.info('默认工具已注册', {
      bayesianTools: 3,
      toolSetTools: this.toolSetManager.getAllTools().length
    });
  }

  /**
   * 启动艾宾浩斯遗忘调度
   */
  private startEbbinghausScheduler(): void {
    // 每30分钟运行一次记忆巩固检查
    const consolidationInterval = setInterval(() => {
      const consolidated = this.memorySystem.consolidateMemories();
      if (consolidated.length > 0) {
        logger.info('记忆自动巩固完成', { count: consolidated.length });
      }
    }, 30 * 60 * 1000); // 30分钟

    // 每2小时运行一次记忆修剪（遗忘低显著性记忆）
    const pruningInterval = setInterval(() => {
      const pruned = this.memorySystem.pruneMemories(0.1); // 阈值0.1
      if (pruned > 0) {
        logger.info('低显著性记忆已清理', { count: pruned });
      }
    }, 2 * 60 * 60 * 1000); // 2小时

    // 保存定时器引用以便清理
    this._ebbinghausIntervals = [consolidationInterval, pruningInterval];

    logger.info('艾宾浩斯遗忘调度已启动');
  }

  /**
   * 停止艾宾浩斯遗忘调度
   */
  private stopEbbinghausScheduler(): void {
    this._ebbinghausIntervals.forEach(clearInterval);
    this._ebbinghausIntervals = [];
    logger.info('艾宾浩斯遗忘调度已停止');
  }

  /**
   * 启动 MemorySystem 到 ReflectionEngine 的连接
   * 定期更新记忆统计供反思引擎使用
   */
  private startMemoryStatsUpdate(): void {
    // 立即更新一次
    this.updateMemoryStatsForReflection();

    // 每5分钟更新一次记忆统计
    const intervalId = setInterval(() => {
      this.updateMemoryStatsForReflection();
    }, 5 * 60 * 1000);

    this._ebbinghausIntervals.push(intervalId);
    logger.info('MemorySystem → ReflectionEngine 连接已建立');
  }

  /**
   * 更新记忆统计到反思引擎
   */
  private updateMemoryStatsForReflection(): void {
    try {
      const stats = this.memorySystem.getStats();
      const salienceReport = this.memorySystem.getSalienceReport();

      this.reflectionEngine.updateMemoryStats({
        typeCounts: stats.typeCounts,
        salienceReport: {
          highSalience: salienceReport.highSalience,
          mediumSalience: salienceReport.mediumSalience,
          lowSalience: salienceReport.lowSalience,
          shouldForget: salienceReport.shouldForget,
        },
      });

      logger.debug('记忆统计已更新到反思引擎', {
        total: stats.totalCount,
        shouldForget: salienceReport.shouldForget
      });
    } catch (error) {
      logger.error('更新记忆统计失败', { error });
    }
  }

  /**
   * 启动 Agent
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn('Agent 已在运行中');
      return;
    }

    this.running = true;
    this.startTime = new Date().toISOString();

    // 启动激素系统（包含自然衰减）
    this.hormoneSystem.start();

    // 启动艾宾浩斯遗忘调度
    this.startEbbinghausScheduler();

    // 启动反思引擎
    this.reflectionEngine.start();

    // 连接 MemorySystem 到 ReflectionEngine - 定期更新记忆统计
    this.startMemoryStatsUpdate();

    // 启动 Web 服务器
    if (this.webEnabled) {
      this.webServer = new WebServer({
        port: this.config.adapter?.web?.port || 8080,
        host: this.config.adapter?.web?.host || '0.0.0.0',
        agent: this,
      });
      this.webServer.start();
    }

    // 启动触发器检查循环
    this.triggerCheckInterval = setInterval(() => {
      const snapshot = this.hormoneSystem.getSnapshot();
      const context: TriggerContext = { hormoneLevels: snapshot.levels };
      this.triggerEngine.fire('novelty', context);
    }, this.config.hormone.triggerCheckIntervalMs);

    logger.info('Ouroboros Agent 已启动');
  }

  /**
   * 停止 Agent
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    // 停止激素系统
    this.hormoneSystem.stop();

    // 停止艾宾浩斯遗忘调度
    this.stopEbbinghausScheduler();

    // 停止反思引擎
    this.reflectionEngine.stop();

    // 停止 Web 服务器
    if (this.webServer) {
      this.webServer.stop();
      this.webServer = undefined;
    }

    if (this.triggerCheckInterval) {
      clearInterval(this.triggerCheckInterval);
      this.triggerCheckInterval = undefined;
    }

    // 保存状态
    this.saveState();

    logger.info('Ouroboros Agent 已停止');
  }

  /**
   * 处理用户消息
   * @param userInput 用户输入
   * @returns 模型响应
   */
  async processMessage(userInput: string): Promise<ModelResponse> {
    if (!this.running) {
      throw new OuroborosError(
        'Agent 未启动',
        'UNKNOWN_ERROR',
        'OuroborosAgent.processMessage'
      );
    }

    const startTime = Date.now();
    this.messageCount++;

    try {
      // ===== 元认知：不确定性检查与任务分发 =====
      const offloadDecision = this.metaCognition.shouldOffload(
        'model_call',
        'complex',
        { criticality: 'medium' }
      );

      if (offloadDecision.shouldOffload) {
        logger.warn('元认知：不确定性过高，建议寻求外部增强', {
          reason: offloadDecision.reason,
          uncertainty: offloadDecision.uncertainty,
          recommendedTool: offloadDecision.recommendedTool,
        });

        // 更新激素：不确定性增加皮质醇（压力）
        this.hormoneSystem.applyHormoneChanges([{
          hormone: 'cortisol',
          delta: 0.05,
          reason: '不确定性检测',
        }]);
      }

      // 更新元认知：记录模型调用尝试
      this.metaCognition.updateCapabilityResult(
        this.metaCognition.getCapabilityByName('model_call')?.id || '',
        true // 暂时记录为成功，实际结果在后续更新
      );

      // 1. 更新激素：用户交互增加多巴胺和去甲肾上腺素
      const dopamineChange: HormoneChange = { hormone: 'dopamine', delta: 0.05, reason: '用户交互' };
      const norepinephrineChange: HormoneChange = { hormone: 'norepinephrine', delta: 0.03, reason: '用户交互' };
      this.hormoneSystem.applyHormoneChanges([dopamineChange, norepinephrineChange]);

      // 2. 获取记忆上下文
      const memoryContext = await this.memorySystem.generateMemoryContext(userInput);

      // 3. 获取最近的反思（用于动态Prompt）
      const recentReflections = this.getRecentReflections(3);

      // 4. ===== 动态提示词生成（基于自我状态）=====
      const dynamicSystemPrompt = this.dynamicPromptAssembler.assembleDynamicPrompt({
        userInput,
        memoryContext: memoryContext.contextText,
        recentReflections,
        taskType: 'conversation',
        complexity: 'medium',
      });

      // 5. 创建消息列表 (包含历史对话上下文)
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: dynamicSystemPrompt },
      ];

      // 添加历史对话 (最近 maxHistoryLength 条)
      for (const msg of this.conversationHistory.slice(-this.maxHistoryLength)) {
        messages.push({ role: msg.role, content: msg.content });
      }

      // 添加当前用户输入
      messages.push({ role: 'user', content: userInput });

      // 记录调试信息（仅在调试功能启用时）
      if (this.config.adapter?.web?.debug?.enabled) {
        this.lastDebugInfo = {
          timestamp: new Date().toISOString(),
          systemPrompt: this.config.adapter.web.debug.recordPrompts ? dynamicSystemPrompt : '[已隐藏]',
          messages,
          assembledPrompt: { system: dynamicSystemPrompt },
          memoryContext: this.config.adapter.web.debug.recordPrompts ? memoryContext.contextText : '[已隐藏]',
          selfDescription: this.dynamicPromptAssembler.generateQuickIdentity(),
        };
      }

      // 6. 调用模型（自动支持备用模型切换）
      const response = await this.modelClient.chat(messages);

      // 7. 更新对话历史
      this.conversationHistory.push({ role: 'user', content: userInput });
      this.conversationHistory.push({ role: 'assistant', content: response.content });

      // 限制历史长度
      if (this.conversationHistory.length > this.maxHistoryLength * 2) {
        this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength * 2);
      }

      // 8. 记录对话到记忆系统
      await this.memorySystem.recordConversation(userInput, response.content);

      // 8. 记录性能
      const responseTimeMs = Date.now() - startTime;
      this.performanceMonitor.record({
        model: response.model,
        inputTokens: response.tokens.prompt,
        outputTokens: response.tokens.completion,
        responseTimeMs,
        success: true,
        timestamp: new Date().toISOString(),
      });

      // 更新反思引擎性能指标
      this.reflectionEngine.updatePerformanceMetric({
        model: response.model,
        inputTokens: response.tokens.prompt,
        outputTokens: response.tokens.completion,
        responseTimeMs,
        success: true,
        timestamp: new Date().toISOString(),
      });

      // 9. 记录 A/B 测试变体性能（Phase 6: 软自指）
      this.recordABTestPerformance(responseTimeMs, true);

      // 10. 成功响应后增加血清素（满足感）
      const serotoninChange: HormoneChange = { hormone: 'serotonin', delta: 0.02, reason: '成功响应' };
      const oxytocinChange: HormoneChange = { hormone: 'oxytocin', delta: 0.01, reason: '成功响应' };
      this.hormoneSystem.applyHormoneChanges([serotoninChange, oxytocinChange]);

      // 11. 更新贝叶斯置信度（成功）
      this.bayesianCore.updateToolConfidence('model_call', true);
      this.bayesianCore.updateToolConfidence('memory_retrieval', true);
      this.bayesianCore.updateToolConfidence('prompt_assembly', true);

      // 12. 定期保存状态
      if (this.messageCount % 10 === 0) {
        this.saveState();
      }

      return response;
    } catch (error) {
      // 错误时增加皮质醇（压力）
      const cortisolChange: HormoneChange = { hormone: 'cortisol', delta: 0.1, reason: '错误发生' };
      this.hormoneSystem.applyHormoneChanges([cortisolChange]);

      // 更新贝叶斯置信度（失败）
      this.bayesianCore.updateToolConfidence('model_call', false);

      this.performanceMonitor.record({
        model: this.config.model.defaultModel.model,
        inputTokens: 0,
        outputTokens: 0,
        responseTimeMs: Date.now() - startTime,
        success: false,
        timestamp: new Date().toISOString(),
      });

      // 更新反思引擎性能指标（失败）
      this.reflectionEngine.updatePerformanceMetric({
        model: this.config.model.defaultModel.model,
        inputTokens: 0,
        outputTokens: 0,
        responseTimeMs: Date.now() - startTime,
        success: false,
        timestamp: new Date().toISOString(),
      });

      // 记录 A/B 测试变体性能（失败）
      this.recordABTestPerformance(Date.now() - startTime, false);

      throw error;
    }
  }

  /**
   * 生成系统提示词（静态版本，备用）
   * @deprecated 使用动态提示生成器替代
   */
  private generateSystemPrompt(): string {
    const identity = this.identityManager.getIdentity();
    const config = getConfig();
    return `你是 ${identity.name}，${identity.description}

版本: ${identity.version}
创造者: ${config.core.identity.creator}

你拥有以下能力：
1. 自我感知 - 能够感知自身的状态和情绪
2. 激素系统 - 通过多巴胺、血清素、皮质醇等激素模拟情绪
3. 记忆系统 - 能够积累经验并从中学习
4. 进化能力 - 能够持续改进和优化自己

请根据当前状态，真诚地与用户交流。`;
  }

  /**
   * 获取统一的自我描述
   */
  getSelfDescription(): Record<string, unknown> {
    const snapshot = this.hormoneSystem.getSnapshot();
    const memoryStats = this.memorySystem.getStats();
    return {
      identity: this.identityManager.toJSON(),
      body: this.bodyManager.toJSON(),
      worldModel: this.worldModelManager.toJSON(),
      cognitiveState: this.cognitiveStateManager.toJSON(),
      toolSet: this.toolSetManager.toJSON(),
      memory: {
        stats: memoryStats,
        recentMemories: this.memorySystem.getRecentMemories(3).map(m => ({
          type: m.type,
          content: m.content.slice(0, 100),
          importance: m.importance,
        })),
      },
      hormones: snapshot.levels,
      emotion: this.emotionalStateGenerator.generateEmotionalState(snapshot),
    };
  }

  /**
   * 获取 Agent 状态
   */
  getStatus(): AgentStatus {
    const snapshot = this.hormoneSystem.getSnapshot();
    const emotion = this.emotionalStateGenerator.generateEmotionalState(snapshot);

    return {
      running: this.running,
      emotion: emotion.dominantEmotion,
      hormoneLevels: snapshot.levels,
      messageCount: this.messageCount,
      startTime: this.startTime,
      cognitiveLoad: this.cognitiveStateManager.getState().focus,
    };
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): string {
    return this.performanceMonitor.generateReport();
  }

  /**
   * 记录 A/B 测试变体性能
   * Phase 6: 软自指数据收集
   */
  private recordABTestPerformance(responseTime: number, success: boolean): void {
    try {
      const reflectionEngine = this.reflectionEngine;
      const softRefEngine = reflectionEngine?.getSoftSelfReferenceEngine?.();

      if (!softRefEngine) return;

      // 获取当前活跃的系统变体
      const activeSystemVariant = softRefEngine.getActiveVariant('system');
      if (activeSystemVariant) {
        reflectionEngine.recordVariantPerformance(
          activeSystemVariant.id,
          success,
          responseTime
        );
      }

      // 获取当前活跃的自我变体
      const activeSelfVariant = softRefEngine.getActiveVariant('self');
      if (activeSelfVariant) {
        reflectionEngine.recordVariantPerformance(
          activeSelfVariant.id,
          success,
          responseTime
        );
      }

      logger.debug('A/B测试性能已记录', {
        systemVariant: activeSystemVariant?.id,
        selfVariant: activeSelfVariant?.id,
        responseTime,
        success
      });
    } catch (error) {
      // A/B测试记录失败不应该影响主流程
      logger.debug('记录A/B测试性能失败', { error });
    }
  }

  /**
   * 序列化 Agent 状态
   */
  serialize(): object {
    return {
      config: this.config,
      selfDescription: this.getSelfDescription(),
      hormoneSystem: this.hormoneSystem.toJSON(),
      performanceMonitor: this.performanceMonitor.toJSON(),
      messageCount: this.messageCount,
      startTime: this.startTime,
    };
  }

  /**
   * 获取激素系统实例
   */
  getHormoneSystem(): HormoneSystem {
    return this.hormoneSystem;
  }

  /**
   * 获取模型客户端实例
   */
  getModelClient(): ModelClient {
    return this.modelClient;
  }

  /**
   * 获取工具集管理器
   */
  getToolSetManager(): ToolSetManager {
    return this.toolSetManager;
  }

  /**
   * 获取记忆系统
   */
  getMemorySystem(): MemorySystem {
    return this.memorySystem;
  }

  /**
   * 获取贝叶斯认知核心
   */
  getBayesianCore(): BayesianCore {
    return this.bayesianCore;
  }

  /**
   * 获取反思引擎
   */
  getReflectionEngine(): ReflectionEngine {
    return this.reflectionEngine;
  }

  /**
   * 获取提示词组装器
   */
  getPromptAssembler(): PromptAssembler {
    return this.promptAssembler;
  }

  /**
   * 获取身体图式管理器
   */
  getBodyManager(): BodyManager {
    return this.bodyManager;
  }

  /**
   * 获取世界模型管理器
   */
  getWorldModel(): WorldModelManager {
    return this.worldModelManager;
  }

  /**
   * 获取工具集管理器
   */
  getToolSet(): ToolSetManager {
    return this.toolSetManager;
  }

  /**
   * 获取最后调试信息
   */
  getLastDebugInfo(): typeof this.lastDebugInfo {
    return this.lastDebugInfo;
  }

  /**
   * 获取对话历史
   */
  getConversationHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
    return [...this.conversationHistory];
  }

  /**
   * 清除对话历史
   */
  clearConversationHistory(): void {
    this.conversationHistory = [];
    logger.info('对话历史已清除');
  }

  /**
   * 获取最近的反思记录
   */
  private getRecentReflections(limit: number): string[] {
    try {
      const changeHistory = this.reflectionEngine.getChangeHistory();
      return changeHistory
        .slice(-limit)
        .map(change => `${change.action.type}: ${change.result}`);
    } catch {
      return [];
    }
  }

  /**
   * 获取元认知核心
   */
  getMetaCognition(): MetaCognitionCore {
    return this.metaCognition;
  }

  /**
   * 获取动态提示生成器
   */
  getDynamicPromptAssembler(): DynamicPromptAssembler {
    return this.dynamicPromptAssembler;
  }

  /**
   * 评估任务是否应该分发 (shouldOffload)
   */
  assessTaskOffload(
    taskType: string,
    complexity?: 'simple' | 'medium' | 'complex',
    context?: { deadline?: number; criticality?: 'low' | 'medium' | 'high' }
  ) {
    return this.metaCognition.shouldOffload(taskType, complexity, context);
  }

  /**
   * 获取推理监控器 (P2)
   */
  getReasoningMonitor(): ReasoningMonitor {
    return this.reasoningMonitor;
  }

  /**
   * 获取策略编码器 (P2)
   */
  getStrategyEncoder(): StrategyEncoder {
    return this.strategyEncoder;
  }

  /**
   * 获取自指编码记忆 (P3)
   */
  getSelfReferentialMemory(): SelfReferentialMemory {
    return this.selfReferentialMemory;
  }

  /**
   * 获取策略执行器 (P4)
   */
  getStrategyExecutor(): StrategyExecutor {
    return this.strategyExecutor;
  }

  /**
   * 检查是否在使用备用模型
   */
  isUsingFallbackModel(): boolean {
    return this.modelClient.isUsingFallback();
  }

  /**
   * 切换回主模型
   */
  switchToPrimaryModel(): void {
    this.modelClient.switchToPrimary();
  }
}
