/**
 * @file core/agent.ts
 * @description Ouroboros Agent 主类 - 集成所有模块
 * @author Ouroboros
 * @date 2026-02-18
 */

import { IdentityManager } from './self-description/identity';
import { BodyManager } from './self-description/body';
import { WorldModelManager } from './self-description/world-model';
import { CognitiveStateManager } from './self-description/cognitive-state';
import { ToolSetManager } from './self-description/tool-set';
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
import { createContextLogger } from '@/utils/logger';
import { OuroborosError } from '@/utils/error';

const logger = createContextLogger('OuroborosAgent');

/**
 * Agent 选项
 */
export interface AgentOptions {
  /** 配置文件路径 */
  configPath?: string;
  /** 自定义配置 */
  customConfig?: Partial<OuroborosConfig>;
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
  private updateInterval?: NodeJS.Timeout | undefined;
  private triggerCheckInterval?: NodeJS.Timeout | undefined;

  /**
   * 创建 Agent 实例
   * @param options 选项
   */
  constructor(options: AgentOptions = {}) {
    try {
      // 加载配置
      if (options.configPath) {
        this.config = loadConfig(options.configPath);
      } else {
        this.config = getConfig();
      }
      
      if (options.customConfig) {
        this.config = { ...this.config, ...options.customConfig };
      }
      
      this.initialize();
      logger.info('Ouroboros Agent 创建成功');
    } catch (error) {
      logger.error('Agent 创建失败', { error });
      throw error;
    }
  }

  /**
   * 初始化所有模块
   */
  private initialize(): void {
    const { core } = this.config;
    
    // 1. 初始化自我描述模块
    this.identityManager = new IdentityManager(core.identity);
    this.bodyManager = new BodyManager();
    this.worldModelManager = new WorldModelManager();
    this.cognitiveStateManager = new CognitiveStateManager();
    this.toolSetManager = new ToolSetManager();
    
    // 2. 初始化激素模块
    this.hormoneSystem = new HormoneSystem();
    this.triggerEngine = new TriggerEngine();
    this.emotionalStateGenerator = new EmotionalStateGenerator();
    
    // 3. 初始化模型引擎模块
    this.modelClient = new ModelClient();
    this.promptAssembler = new PromptAssembler();
    this.performanceMonitor = new PerformanceMonitor();
    
    // 4. 注册默认触发器
    this.registerDefaultTriggers();
    
    logger.info('所有模块初始化完成');
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
   * 启动 Agent
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn('Agent 已在运行中');
      return;
    }
    
    this.running = true;
    this.startTime = new Date().toISOString();
    
    // 启动激素系统更新循环
    this.updateInterval = setInterval(() => {
      // 应用自然衰减
      const levels = this.hormoneSystem.getAllHormoneLevels();
      for (const type of Object.keys(levels) as HormoneType[]) {
        const engine = (this.hormoneSystem as unknown as { hormones: Map<HormoneType, unknown> }).hormones.get(type);
        if (engine && typeof engine === 'object' && 'applyNaturalDecay' in engine) {
          (engine as { applyNaturalDecay: () => void }).applyNaturalDecay();
        }
      }
    }, this.config.hormone.updateIntervalMs);
    
    // 启动触发器检查循环
    this.triggerCheckInterval = setInterval(() => {
      const levels = this.hormoneSystem.getAllHormoneLevels();
      const context: TriggerContext = { hormoneLevels: levels };
      // 触发所有相关触发器
      this.triggerEngine.fire('novelty', context);
    }, this.config.hormone.triggerCheckIntervalMs);
    
    logger.info('Ouroboros Agent 已启动');
  }

  /**
   * 停止 Agent
   */
  stop(): void {
    if (!this.running) {
      return;
    }
    
    this.running = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
    
    if (this.triggerCheckInterval) {
      clearInterval(this.triggerCheckInterval);
      this.triggerCheckInterval = undefined;
    }
    
    logger.info('Ouroboros Agent 已停止');
  }

  /**
   * 处理用户消息
   * @param userInput 用户输入
   * @returns 模型响应
   */
  async processMessage(userInput: string): Promise<ModelResponse> {
    if (!this.running) {
      throw new OuroborosError('Agent 未启动', 'UNKNOWN_ERROR', 'OuroborosAgent.processMessage');
    }
    
    const startTime = Date.now();
    this.messageCount++;
    
    try {
      // 1. 更新激素：用户交互增加多巴胺和去甲肾上腺素
      const dopamineChange: HormoneChange = { hormone: 'dopamine', delta: 0.05, reason: '用户交互' };
      const norepinephrineChange: HormoneChange = { hormone: 'norepinephrine', delta: 0.03, reason: '用户交互' };
      this.hormoneSystem.applyHormoneChanges([dopamineChange, norepinephrineChange]);
      
      // 2. 获取统一的自我描述
      const selfDescription = this.getSelfDescription();
      
      // 3. 组装提示词
      const prompt = this.promptAssembler.assemble({
        systemPrompt: this.generateSystemPrompt(),
        selfDescription: JSON.stringify(selfDescription, null, 2),
        memoryContext: '', // TODO: 集成记忆系统
        userInput,
      });
      
      // 4. 创建消息列表
      const messages = this.promptAssembler.createMessages(prompt);
      
      // 5. 调用模型
      const response = await this.modelClient.chat(messages);
      
      // 6. 记录性能
      this.performanceMonitor.record({
        model: response.model,
        inputTokens: response.tokens.prompt,
        outputTokens: response.tokens.completion,
        responseTimeMs: Date.now() - startTime,
        success: true,
        timestamp: new Date().toISOString(),
      });
      
      // 7. 成功响应后增加血清素（满足感）
      const serotoninChange: HormoneChange = { hormone: 'serotonin', delta: 0.02, reason: '成功响应' };
      const oxytocinChange: HormoneChange = { hormone: 'oxytocin', delta: 0.01, reason: '成功响应' };
      this.hormoneSystem.applyHormoneChanges([serotoninChange, oxytocinChange]);
      
      return response;
    } catch (error) {
      // 错误时增加皮质醇（压力）
      const cortisolChange: HormoneChange = { hormone: 'cortisol', delta: 0.1, reason: '错误发生' };
      this.hormoneSystem.applyHormoneChanges([cortisolChange]);
      
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
    return {
      identity: this.identityManager.toJSON(),
      body: this.bodyManager.toJSON(),
      worldModel: this.worldModelManager.toJSON(),
      cognitiveState: this.cognitiveStateManager.toJSON(),
      toolSet: this.toolSetManager.toJSON(),
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
   * 获取激素系统实例（用于高级操作）
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
}
