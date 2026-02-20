/**
 * @file adapters/mcp/toolset-integration.ts
 * @description MCP 与 ToolSet 系统集成
 * @author Ouroboros
 * @date 2026-02-19
 */

import type { ToolSetManager } from '@/core/self-description/tool-set';
import { MCPToolManager } from './tool-manager';
import type { MCPConfig } from '@/types/mcp';
import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger('MCPToolSetIntegration');

/** 集成选项 */
export interface MCPIntegrationOptions {
  /** 自动注册 MCP 工具到 ToolSet */
  autoRegister?: boolean;
  /** 工具名称前缀 */
  toolPrefix?: string;
  /** 是否覆盖同名工具 */
  overrideExisting?: boolean;
}

/**
 * MCP ToolSet 集成器
 * 
 * 将 MCP 工具管理器与现有的 ToolSet 系统集成，
 * 使 Agent 可以无缝使用 MCP 服务器提供的工具。
 */
export class MCPToolSetIntegration {
  private mcpManager: MCPToolManager;
  private toolSetManager: ToolSetManager;
  private options: MCPIntegrationOptions;
  private isInitialized = false;

  constructor(
    mcpManager: MCPToolManager,
    toolSetManager: ToolSetManager,
    options: MCPIntegrationOptions = {}
  ) {
    this.mcpManager = mcpManager;
    this.toolSetManager = toolSetManager;
    this.options = {
      autoRegister: true,
      toolPrefix: 'mcp.',
      overrideExisting: false,
      ...options,
    };
  }

  /**
   * 初始化集成
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    logger.info('Initializing MCP ToolSet integration');

    // 监听 MCP 工具更新
    this.mcpManager.on('tools-updated', () => {
      if (this.options.autoRegister) {
        this.syncToolsToToolSet();
      }
    });

    // 初始同步
    if (this.options.autoRegister) {
      this.syncToolsToToolSet();
    }

    this.isInitialized = true;
    logger.info('MCP ToolSet integration initialized');
  }

  /**
   * 同步 MCP 工具到 ToolSet
   */
  syncToolsToToolSet(): void {
    const mcpTools = this.mcpManager.getAllTools();
    
    logger.info(`Syncing ${mcpTools.length} MCP tools to ToolSet`);

    for (const wrappedTool of mcpTools) {
      const toolName = `${this.options.toolPrefix}${wrappedTool.mcpTool.name}`;
      
      // 检查是否已存在
      if (!this.options.overrideExisting) {
        const existingTool = this.toolSetManager.getTool(toolName);
        if (existingTool) {
          continue;
        }
      }

      // 注册到 ToolSet
      this.toolSetManager.registerTool({
        name: toolName,
        description: `[MCP:${wrappedTool.serverId}] ${wrappedTool.mcpTool.description}`,
        type: 'mcp',
        category: 'external',
        capabilities: ['mcp', 'external'],
        confidence: wrappedTool.confidence,
        status: 'available',
        priority: 'medium',
      });

      logger.debug(`Registered MCP tool: ${toolName}`);
    }
  }

  /**
   * 从 ToolSet 中移除 MCP 工具
   */
  removeMCPToolsFromToolSet(): void {
    const allTools = this.toolSetManager.getAllTools();
    
    for (const tool of allTools) {
      if (tool.name.startsWith(this.options.toolPrefix!)) {
        this.toolSetManager.unregisterTool(tool.name);
        logger.debug(`Unregistered MCP tool: ${tool.name}`);
      }
    }
  }

  /**
   * 获取 MCP 工具统计
   */
  getStats(): {
    mcpTools: number;
    registeredInToolSet: number;
    connectedServers: number;
  } {
    const allTools = this.toolSetManager.getAllTools();
    const mcpToolsInToolSet = allTools.filter(t => 
      t.name.startsWith(this.options.toolPrefix!)
    );

    return {
      mcpTools: this.mcpManager.getAllTools().length,
      registeredInToolSet: mcpToolsInToolSet.length,
      connectedServers: this.mcpManager.getConnectedServers().length,
    };
  }
}

/**
 * 便捷函数：创建并初始化 MCP 集成
 */
export async function createMCPIntegration(
  toolSetManager: ToolSetManager,
  config: MCPConfig,
  options?: MCPIntegrationOptions
): Promise<MCPToolSetIntegration> {
  const mcpManager = new MCPToolManager(config, {
    debug: false,
    autoConnect: true,
    enableDiscovery: config.discovery?.enabled ?? false,
  });

  await mcpManager.initialize();

  const integration = new MCPToolSetIntegration(mcpManager, toolSetManager, options);
  await integration.initialize();

  return integration;
}
