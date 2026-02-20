/**
 * @file adapters/mcp/tool-manager.ts
 * @description MCP 工具管理器 - 统一管理所有 MCP 服务器和工具
 * @author Ouroboros
 * @date 2026-02-19
 */

import { EventEmitter } from 'events';
import type {
  MCPServerConfig,
  MCPConfig,
  MCPWrappedTool,
  MCPConnectionStatus,
  MCPEvent,
  MCPDiscoveredServer,
  MCPDiscoveryReport,
  MCPToolCallResult,
} from '@/types/mcp';
import { MCPClient, type MCPClientOptions } from './client';
import { createContextLogger } from '@/utils/logger';
import { randomUUID } from 'crypto';

const logger = createContextLogger('MCPToolManager');

/** MCP 工具管理器选项 */
export interface MCPToolManagerOptions {
  /** 调试模式 */
  debug: boolean | undefined;
  /** 自动连接 */
  autoConnect: boolean | undefined;
  /** 启用发现 */
  enableDiscovery: boolean | undefined;
}

/**
 * MCP 工具管理器
 * 
 * 核心职责：
 * 1. 管理多个 MCP 服务器连接
 * 2. 统一暴露所有 MCP 工具给 Agent 使用
 * 3. 处理工具调用路由
 * 4. 维护工具置信度统计
 * 5. 自动发现和注册服务器
 */
export class MCPToolManager extends EventEmitter {
  private config: MCPConfig;
  private options: MCPToolManagerOptions;
  private clients: Map<string, MCPClient> = new Map();
  private wrappedTools: Map<string, MCPWrappedTool> = new Map();
  private discoveredServers: Map<string, MCPDiscoveredServer> = new Map();
  private discoveryTimer?: NodeJS.Timeout | undefined;
  private isDiscovering = false;

  constructor(
    config: MCPConfig = { servers: [], globalReconnect: undefined, discovery: undefined, cache: undefined },
    options: MCPToolManagerOptions = { debug: false, autoConnect: true, enableDiscovery: true }
  ) {
    super();
    this.config = config;
    this.options = options;
  }

  // ========================================================================
  // 服务器管理
  // ========================================================================

  /**
   * 初始化并连接所有配置的服务器
   */
  async initialize(): Promise<void> {
    logger.info(`Initializing MCP Tool Manager with ${this.config.servers.length} servers`);

    // 创建客户端实例
    for (const serverConfig of this.config.servers) {
      this.createClient(serverConfig);
    }

    // 自动连接
    if (this.options.autoConnect) {
      await this.connectAll();
    }

    // 启动发现服务
    if (this.options.enableDiscovery && this.config.discovery?.enabled) {
      this.startDiscovery();
    }
  }

  /**
   * 创建客户端实例
   */
  private createClient(config: MCPServerConfig): MCPClient {
    const clientOptions: MCPClientOptions = {
      debug: this.options.debug ?? false,
    };
    const client = new MCPClient(config, clientOptions);

    // 监听客户端事件
    client.on('event', (event: MCPEvent) => {
      this.handleClientEvent(event);
    });

    this.clients.set(config.id, client);
    return client;
  }

  /**
   * 添加并连接新服务器
   */
  async addServer(config: MCPServerConfig): Promise<void> {
    if (this.clients.has(config.id)) {
      throw new Error(`Server with id '${config.id}' already exists`);
    }

    logger.info(`Adding new MCP server: ${config.name}`);
    
    const client = this.createClient(config);
    
    if (config.autoConnect !== false) {
      await client.connect();
      await this.wrapServerTools(client);
    }
  }

  /**
   * 移除服务器
   */
  async removeServer(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server '${serverId}' not found`);
    }

    logger.info(`Removing MCP server: ${client.serverName}`);

    // 断开连接
    await client.disconnect();

    // 移除该服务器的所有工具
    for (const [toolId, wrappedTool] of this.wrappedTools) {
      if (wrappedTool.serverId === serverId) {
        this.wrappedTools.delete(toolId);
      }
    }

    // 移除客户端
    this.clients.delete(serverId);

    this.emit('server-removed', { serverId });
  }

  /**
   * 连接到所有服务器
   */
  async connectAll(): Promise<void> {
    const results = await Promise.allSettled(
      Array.from(this.clients.values()).map(async (client) => {
        try {
          await client.connect();
          await this.wrapServerTools(client);
        } catch (error) {
          logger.error(`Failed to connect to ${client.serverName}:`, { error: error instanceof Error ? error.message : String(error) });
          throw error;
        }
      })
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    logger.info(`MCP connection results: ${succeeded} succeeded, ${failed} failed`);
  }

  /**
   * 断开所有连接
   */
  async disconnectAll(): Promise<void> {
    // 停止发现服务
    this.stopDiscovery();

    // 断开所有客户端
    await Promise.all(
      Array.from(this.clients.values()).map(client => client.disconnect())
    );

    this.wrappedTools.clear();
    logger.info('All MCP servers disconnected');
  }

  // ========================================================================
  // 工具管理
  // ========================================================================

  /**
   * 包装服务器工具为内部格式
   */
  private async wrapServerTools(client: MCPClient): Promise<void> {
    const tools = client.getTools();
    const serverId = client.serverId;

    logger.info(`Wrapping ${tools.length} tools from ${client.serverName}`);

    for (const tool of tools) {
      const wrappedTool: MCPWrappedTool = {
        id: randomUUID(),
        serverId,
        mcpTool: tool,
        execute: async (args) => {
          return this.executeTool(serverId, tool.name, args);
        },
        confidence: 0.5, // 初始置信度
        stats: {
          callCount: 0,
          successCount: 0,
          failureCount: 0,
          lastUsedAt: undefined,
          averageResponseTime: 0,
        },
      };

      this.wrappedTools.set(`${serverId}.${tool.name}`, wrappedTool);
    }

    this.emit('tools-updated', {
      serverId,
      toolCount: tools.length,
    });
  }

  /**
   * 执行工具
   */
  private async executeTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPToolCallResult> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server '${serverId}' not found`);
    }

    const wrappedTool = this.wrappedTools.get(`${serverId}.${toolName}`);
    if (!wrappedTool) {
      throw new Error(`Tool '${toolName}' not found on server '${serverId}'`);
    }

    const startTime = Date.now();

    try {
      const result = await client.callTool(toolName, args);
      
      const duration = Date.now() - startTime;
      
      // 更新统计
      wrappedTool.stats.callCount++;
      wrappedTool.stats.successCount++;
      wrappedTool.stats.lastUsedAt = new Date().toISOString();
      wrappedTool.stats.averageResponseTime = 
        (wrappedTool.stats.averageResponseTime * (wrappedTool.stats.callCount - 1) + duration) /
        wrappedTool.stats.callCount;

      // 更新置信度 (成功提升)
      wrappedTool.confidence = Math.min(1, wrappedTool.confidence + 0.05);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // 更新统计
      wrappedTool.stats.callCount++;
      wrappedTool.stats.failureCount++;
      wrappedTool.stats.averageResponseTime = 
        (wrappedTool.stats.averageResponseTime * (wrappedTool.stats.callCount - 1) + duration) /
        wrappedTool.stats.callCount;

      // 更新置信度 (失败降低)
      wrappedTool.confidence = Math.max(0, wrappedTool.confidence - 0.1);

      throw error;
    }
  }

  /**
   * 获取所有可用的 MCP 工具
   */
  getAllTools(): MCPWrappedTool[] {
    return Array.from(this.wrappedTools.values());
  }

  /**
   * 转换为内部 Tool 格式 (与现有 ToolSet 兼容)
   */
  convertToInternalTools(): Array<{
    id: string;
    name: string;
    description: string;
    type: 'mcp';
    parameters: Record<string, { type: string; required: boolean; description: string | undefined }>;
    execute: (args: Record<string, unknown>) => Promise<MCPToolCallResult>;
    successCount: number;
    failureCount: number;
  }> {
    return this.getAllTools().map(wrapped => ({
      id: wrapped.id,
      name: wrapped.mcpTool.name,
      description: wrapped.mcpTool.description,
      type: 'mcp' as const,
      parameters: this.convertSchemaToParameters(wrapped.mcpTool.inputSchema),
      execute: wrapped.execute,
      successCount: wrapped.stats.successCount,
      failureCount: wrapped.stats.failureCount,
    }));
  }

  /**
   * 转换 JSON Schema 到内部参数格式
   */
  private convertSchemaToParameters(schema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[] | undefined;
  }): Record<string, { type: string; required: boolean; description: string | undefined }> {
    const parameters: Record<string, { type: string; required: boolean; description: string | undefined }> = {};

    for (const [key, prop] of Object.entries(schema.properties)) {
      const typedProp = prop as { type?: string; description?: string };
      parameters[key] = {
        type: typedProp.type || 'string',
        required: schema.required?.includes(key) || false,
        description: typedProp.description,
      };
    }

    return parameters;
  }

  /**
   * 获取工具置信度排名
   */
  getToolsByConfidence(): MCPWrappedTool[] {
    return this.getAllTools().sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 获取工具统计信息
   */
  getToolStats(): {
    totalTools: number;
    totalCalls: number;
    totalSuccesses: number;
    totalFailures: number;
    averageConfidence: number;
  } {
    const tools = this.getAllTools();
    const totalCalls = tools.reduce((sum, t) => sum + t.stats.callCount, 0);
    const totalSuccesses = tools.reduce((sum, t) => sum + t.stats.successCount, 0);
    const totalFailures = tools.reduce((sum, t) => sum + t.stats.failureCount, 0);
    const averageConfidence = tools.length > 0 
      ? tools.reduce((sum, t) => sum + t.confidence, 0) / tools.length 
      : 0;

    return {
      totalTools: tools.length,
      totalCalls,
      totalSuccesses,
      totalFailures,
      averageConfidence,
    };
  }

  // ========================================================================
  // 发现服务
  // ========================================================================

  /**
   * 启动自动发现服务
   */
  startDiscovery(): void {
    if (this.discoveryTimer || !this.config.discovery?.enabled) {
      return;
    }

    logger.info('Starting MCP server discovery service');

    // 立即执行一次发现
    this.runDiscovery().catch(error => {
      logger.error('Discovery error:', error);
    });

    // 设置定时扫描
    this.discoveryTimer = setInterval(() => {
      this.runDiscovery().catch(error => {
        logger.error('Discovery error:', error);
      });
    }, this.config.discovery.scanInterval);
  }

  /**
   * 停止发现服务
   */
  stopDiscovery(): void {
    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = undefined;
      logger.info('Stopped MCP server discovery service');
    }
  }

  /**
   * 执行发现扫描
   */
  async runDiscovery(): Promise<MCPDiscoveryReport> {
    if (this.isDiscovering) {
      throw new Error('Discovery already in progress');
    }

    this.isDiscovering = true;
    logger.debug('Running MCP server discovery...');

    const report: MCPDiscoveryReport = {
      scanTime: new Date().toISOString(),
      discoveredCount: 0,
      newServers: [],
      removedServers: [],
      scannedPaths: this.config.discovery?.localPaths || [],
      scannedRegistries: this.config.discovery?.registries || [],
    };

    try {
      // 扫描本地路径
      if (this.config.discovery?.localPaths) {
        for (const path of this.config.discovery.localPaths) {
          const servers = await this.scanLocalPath(path);
          for (const server of servers) {
            if (!this.discoveredServers.has(server.id)) {
              this.discoveredServers.set(server.id, server);
              report.newServers.push(server);
              report.discoveredCount++;

              // 自动添加到配置
              if (server.config.autoConnect !== false) {
                await this.addServer(server.config);
              }
            }
          }
        }
      }

      // 扫描注册表
      if (this.config.discovery?.registries) {
        for (const registry of this.config.discovery.registries) {
          const servers = await this.scanRegistry(registry);
          for (const server of servers) {
            if (!this.discoveredServers.has(server.id)) {
              this.discoveredServers.set(server.id, server);
              report.newServers.push(server);
              report.discoveredCount++;
            }
          }
        }
      }

      // 检查已移除的服务器
      for (const [id, server] of this.discoveredServers) {
        const stillExists = 
          report.newServers.some(s => s.id === id) ||
          this.config.servers.some(s => s.id === id);
        
        if (!stillExists && server.discoveryMethod !== 'manual') {
          report.removedServers.push(id);
          this.discoveredServers.delete(id);
        }
      }

      if (report.discoveredCount > 0 || report.removedServers.length > 0) {
        logger.info(`Discovery complete: ${report.discoveredCount} new, ${report.removedServers.length} removed`);
        this.emit('discovery', report);
      }

      return report;
    } finally {
      this.isDiscovering = false;
    }
  }

  /**
   * 扫描本地路径
   */
  private async scanLocalPath(path: string): Promise<MCPDiscoveredServer[]> {
    // TODO: 实现本地文件系统扫描
    // 扫描常见的 MCP 服务器配置位置
    logger.debug(`Scanning local path: ${path}`);
    return [];
  }

  /**
   * 扫描注册表
   */
  private async scanRegistry(registry: string): Promise<MCPDiscoveredServer[]> {
    // TODO: 实现注册表扫描
    // 从远程注册表获取可用服务器列表
    logger.debug(`Scanning registry: ${registry}`);
    return [];
  }

  /**
   * 获取发现的服务器列表
   */
  getDiscoveredServers(): MCPDiscoveredServer[] {
    return Array.from(this.discoveredServers.values());
  }

  // ========================================================================
  // 状态查询
  // ========================================================================

  /**
   * 获取所有服务器连接状态
   */
  getAllServerStatuses(): MCPConnectionStatus[] {
    return Array.from(this.clients.values()).map(client => client.status);
  }

  /**
   * 获取特定服务器状态
   */
  getServerStatus(serverId: string): MCPConnectionStatus | undefined {
    return this.clients.get(serverId)?.status;
  }

  /**
   * 获取已连接的服务器列表
   */
  getConnectedServers(): MCPClient[] {
    return Array.from(this.clients.values()).filter(c => c.isConnected);
  }

  // ========================================================================
  // 事件处理
  // ========================================================================

  /**
   * 处理客户端事件
   */
  private handleClientEvent(event: MCPEvent): void {
    // 转发事件
    this.emit('mcp-event', event);

    // 处理特定事件类型
    switch (event.type) {
      case 'tools-changed':
        // 重新包装工具
        const client = this.clients.get(event.serverId);
        if (client) {
          this.wrapServerTools(client);
        }
        break;
      
      case 'connected':
        this.emit('server-connected', { serverId: event.serverId });
        break;
      
      case 'disconnected':
        // 移除该服务器的工具
        for (const [toolId, wrappedTool] of this.wrappedTools) {
          if (wrappedTool.serverId === event.serverId) {
            this.wrappedTools.delete(toolId);
          }
        }
        this.emit('server-disconnected', { serverId: event.serverId });
        break;
      
      case 'error':
        this.emit('server-error', { 
          serverId: event.serverId, 
          error: event.data 
        });
        break;
    }
  }

  // ========================================================================
  // 配置管理
  // ========================================================================

  /**
   * 更新配置
   */
  updateConfig(config: Partial<MCPConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      servers: config.servers || this.config.servers,
    };

    // 如果启用了发现但服务未启动，启动它
    if (config.discovery?.enabled && !this.discoveryTimer) {
      this.startDiscovery();
    }

    // 如果禁用了发现但服务正在运行，停止它
    if (config.discovery?.enabled === false && this.discoveryTimer) {
      this.stopDiscovery();
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): MCPConfig {
    return { ...this.config };
  }
}
