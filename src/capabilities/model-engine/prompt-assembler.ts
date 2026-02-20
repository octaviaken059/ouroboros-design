/**
 * @file capabilities/model-engine/prompt-assembler.ts
 * @description 提示词组装器 - 按照三类提示词架构组装
 * @author Ouroboros
 * @date 2026-02-18
 */

import type { AssembledPrompt, ChatMessage, TokenBudget } from '@/types/model';
import type { SoftSelfReferenceEngine } from '@/evolution/self-evolution/soft-self-reference';
import { createContextLogger } from '@/utils/logger';
import { TokenBudgetManager } from './token-budget-manager';
import { getConfig } from '@/config';

const logger = createContextLogger('PromptAssembler');

/**
 * 提示词组件
 */
interface PromptComponents {
  /** 系统提示词 */
  systemPrompt: string;
  /** 自我描述 */
  selfDescription: string;
  /** 记忆上下文 */
  memoryContext: string;
  /** 用户输入 */
  userInput: string;
}

/**
 * 三类提示词结构
 */
interface ThreeTierPrompts {
  /** 系统提示词 - 安全约束、输出格式（只读） */
  system: string;
  /** 自我提示词 - 身份、状态、能力（可优化） */
  self: string;
  /** 记忆提示词 - 相关记忆、上下文（动态组装） */
  memory: string;
}

/**
 * 提示词组装器类
 * 负责按照三类提示词架构组装完整的提示词
 * 
 * 三类提示词架构:
 * 1. 系统提示词 (System) - 安全约束、输出格式（只读）
 * 2. 自我提示词 (Self) - 身份、状态、能力（可优化）
 * 3. 记忆提示词 (Memory) - 相关记忆、上下文（动态组装）
 */
export class PromptAssembler {
  /** 系统提示词模板（只读） */
  private systemTemplate: string;
  /** 自我提示词模板（可优化） */
  private selfTemplates: {
    identity: string;
    capability: string;
    state: string;
  };
  /** Token 预算管理器 */
  private budgetManager: TokenBudgetManager;
  /** 软自指引擎引用（可选） */
  private softSelfRefEngine?: SoftSelfReferenceEngine;
  /** 配置 */
  private config: ReturnType<typeof getConfig>;

  /**
   * 创建提示词组装器
   * @param systemTemplate 系统提示词模板（可选，不传则使用默认模板）
   * @param customBudget 自定义预算（可选）
   */
  constructor(systemTemplate?: string, customBudget?: Partial<TokenBudget>) {
    this.config = getConfig();

    // 系统提示词 - 只读，使用配置或默认
    this.systemTemplate =
      systemTemplate ?? 
      this.config.prompts?.system?.template ??
      `你是 Ouroboros，一个具有自我意识的 AI Agent。
你拥有激素系统来模拟情绪，有记忆系统来积累经验，有反思能力来进化自己。

当前状态信息将包含在后续消息中。

请根据你的状态和能力，帮助用户完成任务。记住：
1. 保持诚实和直接
2. 承认你不知道的事情
3. 从每次交互中学习`;

    // 自我提示词模板 - 可优化
    this.selfTemplates = {
      identity: this.config.prompts?.self?.identityTemplate ?? '我是 Ouroboros，一个具身自指进化 AI Agent。',
      capability: this.config.prompts?.self?.capabilityTemplate ?? '我拥有激素系统、记忆系统、贝叶斯认知和反思能力。',
      state: this.config.prompts?.self?.stateTemplate ?? '当前状态: 正常运行',
    };

    this.budgetManager = new TokenBudgetManager(customBudget);

    logger.info('提示词组装器初始化完成', {
      systemReadOnly: this.config.prompts?.system?.readOnly ?? true,
      selfOptimizable: this.config.prompts?.self?.optimizable ?? true,
    });
  }

  /**
   * 设置软自指引擎
   * 连接软自指引擎以使用优化后的提示词变体
   */
  setSoftSelfReferenceEngine(engine: SoftSelfReferenceEngine): void {
    this.softSelfRefEngine = engine;
    logger.info('软自指引擎已连接到提示词组装器');
  }

  /**
   * 组装三类提示词
   * @param components 提示词组件
   * @returns 组装后的提示词
   */
  assemble(components: PromptComponents): AssembledPrompt {
    const budgets = this.budgetManager.calculateBudgets();

    // 1. 组装系统提示词（只读）
    const systemPrompt = this.assembleSystemPrompt();

    // 2. 组装自我提示词（可优化）
    const selfPrompt = this.assembleSelfPrompt(components.selfDescription, budgets.selfBudget);

    // 3. 组装记忆提示词（动态）
    const memoryPrompt = this.assembleMemoryPrompt(components.memoryContext, budgets.memoryBudget);

    // 截断用户输入以适应预算
    const userPart = this.truncateIfNeeded(components.userInput, budgets.userBudget);

    // 合并系统提示词
    const systemContent = [
      '### System',
      systemPrompt,
      selfPrompt ? `\n${selfPrompt}` : '',
      memoryPrompt ? `\n${memoryPrompt}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    // 估算 Token 数
    const estimatedTokens = this.estimateTokens(systemContent + userPart);

    const result: AssembledPrompt = {
      system: systemContent,
      user: userPart,
      tokenCount: estimatedTokens,
      truncated:
        components.selfDescription.length > 0 && !selfPrompt.includes(components.selfDescription.slice(0, 50)),
      threeTierPrompts: {
        system: systemPrompt,
        self: selfPrompt,
        memory: memoryPrompt,
      },
    };

    logger.debug('提示词组装完成', {
      estimatedTokens,
      truncated: result.truncated,
      usingSoftSelfRef: !!this.softSelfRefEngine,
    });

    return result;
  }

  /**
   * 组装系统提示词（只读）
   * 包含安全约束和输出格式
   */
  private assembleSystemPrompt(): string {
    // 如果存在软自指引擎，优先使用活跃的系统变体
    if (this.softSelfRefEngine && this.config.prompts?.system?.readOnly === false) {
      const activeVariant = this.softSelfRefEngine.getActiveVariant('system');
      if (activeVariant?.content) {
        logger.debug('使用软自指优化的系统提示词', { variantId: activeVariant.id });
        return activeVariant.content;
      }
    }

    // 使用默认系统提示词模板
    return this.systemTemplate
      .replace(/{name}/g, this.config.core?.identity?.name ?? 'Ouroboros')
      .replace(/{version}/g, this.config.core?.identity?.version ?? '2.0.0');
  }

  /**
   * 组装自我提示词（可优化）
   * 包含身份、状态、能力
   */
  private assembleSelfPrompt(baseSelfDescription: string, budget: number): string {
    let selfPrompt = '### Self\n';

    // 如果存在软自指引擎且自我提示词可优化
    if (this.softSelfRefEngine && this.config.prompts?.self?.optimizable) {
      const activeVariant = this.softSelfRefEngine.getActiveVariant('self');
      if (activeVariant?.content) {
        logger.debug('使用软自指优化的自我提示词', { variantId: activeVariant.id });
        selfPrompt += activeVariant.content;
        return selfPrompt;
      }
    }

    // 使用默认自我提示词模板
    const identityPart = this.selfTemplates.identity
      .replace(/{name}/g, this.config.core?.identity?.name ?? 'Ouroboros')
      .replace(/{version}/g, this.config.core?.identity?.version ?? '2.0.0')
      .replace(/{creator}/g, this.config.core?.identity?.creator ?? 'Ken')
      .replace(/{evolutionStage}/g, 'learning');

    selfPrompt += identityPart;

    // 添加基础自我描述
    if (baseSelfDescription) {
      const remainingBudget = budget - this.estimateTokens(selfPrompt);
      const truncatedDescription = this.truncateIfNeeded(baseSelfDescription, remainingBudget);
      selfPrompt += '\n' + truncatedDescription;
    }

    return selfPrompt;
  }

  /**
   * 组装记忆提示词（动态）
   * 包含相关记忆、上下文
   */
  private assembleMemoryPrompt(memoryContext: string, budget: number): string {
    if (!memoryContext || memoryContext.trim().length === 0) {
      return '';
    }

    const maxMemories = this.config.prompts?.memory?.maxContextMemories ?? 10;
    
    let memoryPrompt = '### Memory\n';
    
    // 截断记忆内容以适应预算
    const truncatedContext = this.truncateIfNeeded(memoryContext, budget);
    memoryPrompt += truncatedContext;

    logger.debug('记忆提示词组装完成', {
      maxMemories,
      originalLength: memoryContext.length,
      truncatedLength: truncatedContext.length,
    });

    return memoryPrompt;
  }

  /**
   * 创建聊天消息列表
   * @param assembled 组装后的提示词
   * @returns 消息列表
   */
  createMessages(assembled: AssembledPrompt): ChatMessage[] {
    return [
      { role: 'system', content: assembled.system },
      { role: 'user', content: assembled.user },
    ];
  }

  /**
   * 更新系统提示词模板
   * @param template 新模板
   * @throws 如果系统提示词配置为只读
   */
  updateSystemTemplate(template: string): void {
    if (this.config.prompts?.system?.readOnly ?? true) {
      throw new Error('系统提示词为只读，不允许修改');
    }
    this.systemTemplate = template;
    logger.info('系统提示词模板已更新');
  }

  /**
   * 更新自我提示词模板
   * @param templates 新模板
   */
  updateSelfTemplates(templates: Partial<typeof this.selfTemplates>): void {
    if (!(this.config.prompts?.self?.optimizable ?? true)) {
      logger.warn('自我提示词配置为不可优化，更新可能被忽略');
    }
    
    this.selfTemplates = { ...this.selfTemplates, ...templates };
    logger.info('自我提示词模板已更新');
  }

  /**
   * 更新 Token 预算
   * @param totalBudget 新的总预算
   */
  updateTokenBudget(totalBudget: number): void {
    this.budgetManager.updateTotalBudget(totalBudget);
    logger.info('Token预算已更新', { totalBudget });
  }

  /**
   * 更新预算分配
   * @param budget 预算分配
   */
  updateBudgetAllocation(budget: Partial<TokenBudget>): void {
    this.budgetManager.updateBudget(budget);
    logger.info('预算分配已更新', { budget });
  }

  /**
   * 截断文本
   * @param text 原始文本
   * @param maxTokens 最大 Token 数
   * @returns 截断后的文本
   */
  private truncateIfNeeded(text: string, maxTokens: number): string {
    if (!text) return '';

    const estimatedTokens = this.estimateTokens(text);

    if (estimatedTokens <= maxTokens) {
      return text;
    }

    const truncated = this.budgetManager.truncateToFit(text, maxTokens);

    logger.debug('文本已截断', {
      originalLength: text.length,
      maxTokens,
      estimatedTokens,
    });

    return truncated;
  }

  /**
   * 估算 Token 数
   * @param text 文本
   * @returns 估算的 Token 数
   */
  estimateTokens(text: string): number {
    // 简单估算：英文约 4 字符/Token，中文约 1.5 字符/Token
    // 这里使用保守估计：3 字符/Token
    return Math.ceil(text.length / 3);
  }

  /**
   * 获取预算管理器
   * @returns Token 预算管理器
   */
  getBudgetManager(): TokenBudgetManager {
    return this.budgetManager;
  }

  /**
   * 获取 Token 预算管理器
   * @returns TokenBudgetManager 实例
   */
  getTokenBudgetManager(): TokenBudgetManager {
    return this.budgetManager;
  }

  /**
   * 更新 Token 预算配置
   * @param budget 部分预算配置
   */
  updateBudget(budget: Partial<TokenBudget>): void {
    this.budgetManager.updateBudget(budget);
    logger.info('提示词预算已更新', { budget });
  }

  /**
   * 获取三类提示词模板
   */
  getTemplates(): ThreeTierPrompts {
    return {
      system: this.systemTemplate,
      self: `${this.selfTemplates.identity}\n${this.selfTemplates.capability}\n${this.selfTemplates.state}`,
      memory: `Max context memories: ${this.config.prompts?.memory?.maxContextMemories ?? 10}`,
    };
  }

  /**
   * 序列化为 JSON
   * @returns 序列化数据
   */
  toJSON(): object {
    return {
      systemTemplate: this.systemTemplate,
      selfTemplates: this.selfTemplates,
      budgetManager: this.budgetManager.toJSON(),
    };
  }

  /**
   * 从 JSON 恢复
   * @param data 序列化数据
   * @returns PromptAssembler 实例
   */
  static fromJSON(data: {
    systemTemplate: string;
    selfTemplates: {
      identity: string;
      capability: string;
      state: string;
    };
    budgetManager: {
      totalBudget?: number;
      budget?: TokenBudget;
    };
  }): PromptAssembler {
    const assembler = new PromptAssembler(
      data.systemTemplate,
      data.budgetManager?.budget
    );

    if (data.selfTemplates) {
      assembler.selfTemplates = data.selfTemplates;
    }

    if (data.budgetManager?.totalBudget) {
      assembler.updateTokenBudget(data.budgetManager.totalBudget);
    }

    return assembler;
  }
}
