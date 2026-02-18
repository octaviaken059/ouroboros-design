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
import { HormoneSystem } from '@/evolution/hormone/hormone-system';
import { TriggerEngine } from '@/evolution/hormone/trigger-engine';
import { EmotionalStateGenerator } from '@/evolution/hormone/emotional-state-generator';
import type { HormoneType, HormoneChange, Trigger } from '@/types/hormone';
import type { TriggerContext } from '@/evolution/hormone/trigger-engine';
import { ModelClient } from '@/capabilities/model-engine/model-client';
import { PromptAssembler } from '@/capabilities/model-engine/prompt-assembler';
import { PerformanceMonitor } from '@/capabilities/model-engine/performance-monitor';
import type { ModelResponse } from '@/types/model';
import { loadConfig, getConfig, type OuroborosConfig } from '@/config';
import { initDatabase, saveAgentState, loadAgentState } from '@/db';
import { createContextLogger } from '@/utils/logger';
import { OuroborosError } from '@/utils/error';
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
    
    // 4. 初始化激素模块
    this.hormoneSystem = new HormoneSystem();
    this.triggerEngine = new TriggerEngine();
    this.emotionalStateGenerator = new EmotionalStateGenerator();
    
    // 3. 初始化模型引擎模块（带备用模型）
    this.modelClient = new ModelClient(
      model.defaultModel,
      model.fallbackModel ?? undefined
    );
    this.promptAssembler = new PromptAssembler();
    this.performanceMonitor = new PerformanceMonitor();
    
    // 4. 注册默认触发器
    this.registerDefaultTriggers();
    
    logger.info('所有模块初始化完成');
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
    
    logger.info('默认工具已注册到贝叶斯核心');
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
      // 1. 更新激素：用户交互增加多巴胺和去甲肾上腺素
      const dopamineChange: HormoneChange = { hormone: 'dopamine', delta: 0.05, reason: '用户交互' };
      const norepinephrineChange: HormoneChange = { hormone: 'norepinephrine', delta: 0.03, reason: '用户交互' };
      this.hormoneSystem.applyHormoneChanges([dopamineChange, norepinephrineChange]);
      
      // 2. 获取记忆上下文
      const memoryContext = await this.memorySystem.generateMemoryContext(userInput);
      
      // 3. 获取统一的自我描述
      const selfDescription = this.getSelfDescription();
      
      // 4. 组装提示词（系统提示词 + 自我描述 + 记忆上下文）
      const prompt = this.promptAssembler.assemble({
        systemPrompt: this.generateSystemPrompt(),
        selfDescription: JSON.stringify(selfDescription, null, 2),
        memoryContext: memoryContext.contextText,
        userInput,
      });
      
      // 5. 创建消息列表
      const messages = this.promptAssembler.createMessages(prompt);
      
      // 记录调试信息
      this.lastDebugInfo = {
        timestamp: new Date().toISOString(),
        systemPrompt: prompt.system,
        messages: messages,
        assembledPrompt: prompt,
        memoryContext: memoryContext.contextText,
        selfDescription: selfDescription,
      };
      
      // 6. 调用模型（自动支持备用模型切换）
      const response = await this.modelClient.chat(messages);
      
      // 7. 记录对话到记忆系统
      await this.memorySystem.recordConversation(userInput, response.content);
      
      // 8. 记录性能
      this.performanceMonitor.record({
        model: response.model,
        inputTokens: response.tokens.prompt,
        outputTokens: response.tokens.completion,
        responseTimeMs: Date.now() - startTime,
        success: true,
        timestamp: new Date().toISOString(),
      });
      
      // 9. 成功响应后增加血清素（满足感）
      const serotoninChange: HormoneChange = { hormone: 'serotonin', delta: 0.02, reason: '成功响应' };
      const oxytocinChange: HormoneChange = { hormone: 'oxytocin', delta: 0.01, reason: '成功响应' };
      this.hormoneSystem.applyHormoneChanges([serotoninChange, oxytocinChange]);
      
      // 10. 更新贝叶斯置信度（成功）
      this.bayesianCore.updateToolConfidence('model_call', true);
      this.bayesianCore.updateToolConfidence('memory_retrieval', true);
      this.bayesianCore.updateToolConfidence('prompt_assembly', true);
      
      // 11. 定期保存状态
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
      
      throw error;
    }
  }

  /**
   * 生成系统提示词
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
   * 获取最后调试信息
   */
  getLastDebugInfo(): typeof this.lastDebugInfo {
    return this.lastDebugInfo;
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
