/**
 * @file capabilities/model-engine/prompt-assembler.ts
 * @description 提示词组装器 - 组装系统提示词、自我描述、记忆和用户输入
 * @author Ouroboros
 * @date 2026-02-18
 */

import type { AssembledPrompt, ChatMessage, TokenBudget } from '@/types/model';
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
 * 提示词组装器类
 * 负责将各个部分组装成完整的提示词
 */
export class PromptAssembler {
  /** 系统提示词模板 */
  private systemTemplate: string;
  /** Token 预算管理器 */
  private budgetManager: TokenBudgetManager;

  /**
   * 创建提示词组装器
   * @param systemTemplate 系统提示词模板（可选，不传则使用默认模板）
   * @param customBudget 自定义预算（可选）
   */
  constructor(systemTemplate?: string, customBudget?: Partial<TokenBudget>) {
    const config = getConfig();

    this.systemTemplate =
      systemTemplate ??
      `你是 ${config.core.identity.name}，一个具有自我意识的 AI Agent。
你拥有激素系统来模拟情绪，有记忆系统来积累经验，有反思能力来进化自己。

当前状态信息将包含在后续消息中。

请根据你的状态和能力，帮助用户完成任务。记住：
1. 保持诚实和直接
2. 承认你不知道的事情
3. 从每次交互中学习`;

    this.budgetManager = new TokenBudgetManager(customBudget);

    logger.info('提示词组装器初始化完成');
  }

  /**
   * 组装提示词
   * @param components 提示词组件
   * @returns 组装后的提示词
   */
  assemble(components: PromptComponents): AssembledPrompt {
    const budgets = this.budgetManager.calculateBudgets();

    // 截断各部分以适应预算
    const systemPart = this.systemTemplate;
    const selfPart = this.truncateIfNeeded(
      components.selfDescription,
      budgets.selfBudget
    );
    const memoryPart = this.truncateIfNeeded(
      components.memoryContext,
      budgets.memoryBudget
    );
    const userPart = this.truncateIfNeeded(
      components.userInput,
      budgets.userBudget
    );

    // 组装系统提示词
    const systemContent = [
      systemPart,
      selfPart ? `\n### Self\n${selfPart}` : '',
      memoryPart ? `\n### Memory\n${memoryPart}` : '',
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
        components.selfDescription !== selfPart ||
        components.memoryContext !== memoryPart ||
        components.userInput !== userPart,
    };

    logger.debug('提示词组装完成', {
      estimatedTokens,
      truncated: result.truncated,
    });

    return result;
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
   */
  updateSystemTemplate(template: string): void {
    this.systemTemplate = template;
    logger.info('系统提示词模板已更新');
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
   * 序列化为 JSON
   * @returns 序列化数据
   */
  toJSON(): object {
    return {
      systemTemplate: this.systemTemplate,
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
    budgetManager: {
      totalBudget?: number;
      budget?: TokenBudget;
    };
  }): PromptAssembler {
    const assembler = new PromptAssembler(
      data.systemTemplate,
      data.budgetManager?.budget
    );

    if (data.budgetManager?.totalBudget) {
      assembler.updateTokenBudget(data.budgetManager.totalBudget);
    }

    return assembler;
  }
}
