/**
 * @file core/cognition/thinking/integration.ts
 * @description 思维链系统与现有 Ouroboros 系统的集成
 */

import { OuroborosAgent } from '@/core/agent';
import { ChainOfThoughtEngine, ThinkingChain, ThinkingOptions } from './engine';
import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger('ThinkingIntegration');

/**
 * 思维系统集成器
 */
export class ThinkingSystemIntegration {
  private agent: OuroborosAgent;
  private engine: ChainOfThoughtEngine;

  constructor(_agent: OuroborosAgent) {
    this.agent = _agent;
    this.engine = new ChainOfThoughtEngine();
  }

  /**
   * 为复杂问题启用思维链模式
   */
  async processWithThinking(
    userMessage: string,
    options: ThinkingOptions = {}
  ): Promise<{
    thinking?: string;
    response: string;
    chain?: ThinkingChain;
  }> {
    logger.info('启用思维链模式', { message: userMessage.slice(0, 100) });

    // 执行思维链
    const chain = await this.engine.execute(
      userMessage,
      {
        enableThinkingOutput: true,
        ...options,
      },
      async (prompt) => {
        // 使用 agent 的能力生成回复
        // 实际项目中这里应该调用 agent 的模型调用方法
        // 暂时使用 agent 的状态信息
        const status = await this.agent.getStatus?.();
        logger.debug('调用模型生成思考', { 
          promptLength: prompt.length,
          agentEmotion: status?.emotion 
        });
        return `[思考步骤回复] 基于提示词长度 ${prompt.length} 生成回复 (情绪: ${status?.emotion || '未知'})`;
      }
    );

    // 构建包含思考过程的输出
    const thinking = this.formatThinking(chain);

    return {
      thinking,
      response: chain.finalAnswer || '未能生成答案',
      chain,
    };
  }

  /**
   * 格式化思考过程
   */
  private formatThinking(chain: ThinkingChain): string {
    const lines: string[] = [];

    lines.push('🧠 思考过程：');
    lines.push('');

    // 问题分类
    lines.push(`问题类型：${chain.classification.primary}`);
    if (chain.classification.secondary) {
      lines.push(`次要类型：${chain.classification.secondary}`);
    }
    lines.push(`置信度：${(chain.classification.confidence * 100).toFixed(0)}%`);
    lines.push('');

    // 使用的模板
    lines.push(`使用模板：${chain.template.name}`);
    lines.push('');

    // 各步骤的思考
    for (const step of chain.steps) {
      lines.push(`【${step.name}】`);
      lines.push(step.content);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 获取思维统计
   */
  getThinkingStats(): {
    totalChains: number;
    avgSteps: number;
    avgDurationMs: number;
    successRate: number;
  } {
    // 这里可以从持久化存储中读取统计
    return {
      totalChains: 0,
      avgSteps: 0,
      avgDurationMs: 0,
      successRate: 0,
    };
  }
}
