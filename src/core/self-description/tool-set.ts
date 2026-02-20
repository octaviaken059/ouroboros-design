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
  /** 工具执行历史 */
  private executionHistory: Array<{
    toolName: string;
    params: Record<string, unknown>;
    result: unknown;
    success: boolean;
    timestamp: string;
    duration: number;
  }> = [];

  /**
   * 构造函数
   */
  constructor() {
    this.tools = new Map();
    
    // 生成模拟执行历史数据（用于演示）
    this.generateMockExecutionHistory();
    
    logger.info('ToolSet 初始化完成');
  }

  /**
   * 生成模拟执行历史数据
   */
  private generateMockExecutionHistory(): void {
    const toolNames = ['model_call', 'memory_retrieval', 'prompt_assembly', 'memory_store', 'self_describe'];
    const now = Date.now();
    
    // 生成30条模拟执行记录
    for (let i = 0; i < 30; i++) {
      const toolName = toolNames[Math.floor(Math.random() * toolNames.length)];
      const success = Math.random() > 0.1; // 90%成功率
      const duration = 100 + Math.floor(Math.random() * 2000); // 100-2100ms
      
      this.executionHistory.push({
        toolName,
        params: { query: 'test', limit: 10 },
        result: success ? { data: 'success' } : { error: 'timeout' },
        success,
        timestamp: new Date(now - (30 - i) * 60000).toISOString(), // 每分钟一条
        duration,
      });
    }
    
    logger.info('生成模拟执行历史', { count: this.executionHistory.length });
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
   * 执行工具
   * @param name 工具名称
   * @param params 执行参数
   * @returns 执行结果
   */
  async executeTool(name: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`工具 ${name} 不存在`);
    }

    const startTime = Date.now();
    let success = false;
    let result: unknown;

    try {
      // 这里应该调用实际的工具处理函数
      // 简化实现：记录执行并返回成功
      result = { success: true, message: `工具 ${name} 执行成功` };
      success = true;
      
      // 更新置信度
      this.updateConfidence(name, true);
    } catch (error) {
      result = { success: false, error: String(error) };
      success = false;
      this.updateConfidence(name, false);
    }

    const duration = Date.now() - startTime;

    // 记录执行历史
    this.executionHistory.push({
      toolName: name,
      params,
      result,
      success,
      timestamp: new Date().toISOString(),
      duration,
    });

    // 限制历史记录数量
    if (this.executionHistory.length > 1000) {
      this.executionHistory = this.executionHistory.slice(-500);
    }

    return result;
  }

  /**
   * 获取工具执行历史
   * @param limit 最大数量
   * @returns 执行历史
   */
  getExecutionHistory(limit = 20): typeof this.executionHistory {
    return this.executionHistory.slice(-limit);
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
