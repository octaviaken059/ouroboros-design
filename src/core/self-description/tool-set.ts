/**
 * @file core/self-description/tool-set.ts
 * @description ToolSet 模块 - 工具集管理
 * @author Ouroboros
 * @date 2026-02-18
 */

import { randomUUID } from 'crypto';
import type { Tool } from '@/types/index';
import { createContextLogger } from '@utils/logger';
import { ConfigError, tryCatch } from '@utils/error';

const logger = createContextLogger('ToolSet');

/**
 * ToolSet 管理类
 * 管理工具注册、置信度和描述生成
 */
export class ToolSetManager {
  private tools: Map<string, Tool>;

  /**
   * 构造函数
   */
  constructor() {
    this.tools = new Map();
    logger.info('ToolSet 初始化完成');
  }

  /**
   * 注册工具
   * @param tool 工具定义
   */
  registerTool(tool: Omit<Tool, 'id' | 'successCount' | 'failureCount'>): string {
    const register = tryCatch(
      () => {
        if (!tool.name || typeof tool.name !== 'string') {
          throw new Error('工具名称不能为空');
        }

        // 检查是否已存在
        if (this.tools.has(tool.name)) {
          throw new Error(`工具 ${tool.name} 已存在`);
        }

        const newTool: Tool = {
          ...tool,
          id: randomUUID(),
          successCount: 0,
          failureCount: 0,
        };

        this.tools.set(tool.name, newTool);
        logger.info('工具已注册', { name: tool.name, type: tool.type });

        return newTool.id;
      },
      'ToolSet.registerTool',
      ConfigError
    );

    return register();
  }

  /**
   * 注销工具
   * @param name 工具名称
   */
  unregisterTool(name: string): void {
    const unregister = tryCatch(
      () => {
        if (!this.tools.has(name)) {
          throw new Error(`工具 ${name} 不存在`);
        }

        this.tools.delete(name);
        logger.info('工具已注销', { name });
      },
      'ToolSet.unregisterTool',
      ConfigError
    );

    unregister();
  }

  /**
   * 获取工具
   * @param name 工具名称
   * @returns 工具或 undefined
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * 获取所有工具
   * @returns 工具列表
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 按类别获取工具
   * @param category 类别
   * @returns 工具列表
   */
  getToolsByCategory(category: string): Tool[] {
    return this.getAllTools().filter((t) => t.category === category);
  }

  /**
   * 按置信度获取工具
   * @param min 最小置信度
   * @returns 工具列表
   */
  getToolsByConfidence(min: number): Tool[] {
    return this.getAllTools()
      .filter((t) => t.confidence >= min)
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 更新工具置信度
   * @param name 工具名称
   * @param success 是否成功
   */
  updateConfidence(name: string, success: boolean): void {
    const update = tryCatch(
      () => {
        const tool = this.tools.get(name);
        if (!tool) {
          throw new Error(`工具 ${name} 不存在`);
        }

        if (success) {
          tool.successCount++;
        } else {
          tool.failureCount++;
        }

        // 贝叶斯更新置信度
        const total = tool.successCount + tool.failureCount;
        tool.confidence = tool.successCount / total;

        logger.debug('工具置信度已更新', {
          name,
          success,
          newConfidence: tool.confidence,
          totalUses: total,
        });
      },
      'ToolSet.updateConfidence',
      ConfigError
    );

    update();
  }

  /**
   * 生成工具描述
   * @returns 描述文本
   */
  generateToolPrompt(): string {
    const availableTools = this.getAllTools()
      .filter((t) => t.status === 'available')
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);

    if (availableTools.length === 0) {
      return '';
    }

    let prompt = '### Tool Set\n';
    for (const tool of availableTools) {
      prompt += `- ${tool.name} (${tool.type}, ${(tool.confidence * 100).toFixed(0)}%): ${tool.description}\n`;
    }

    return prompt.trim();
  }

  /**
   * 序列化为 JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      tools: Array.from(this.tools.values()),
    };
  }

  /**
   * 从 JSON 恢复
   */
  static fromJSON(data: Record<string, unknown>): ToolSetManager {
    const manager = new ToolSetManager();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const tools = (data.tools as Tool[]) ?? [];
    for (const tool of tools) {
      manager.tools.set(tool.name, tool);
    }
    return manager;
  }
}
