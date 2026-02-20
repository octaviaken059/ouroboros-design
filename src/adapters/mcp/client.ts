/**
 * @file adapters/mcp/client.ts
 * @description MCP 客户端 - 管理单个 MCP 服务器连接
 * @author Ouroboros
 * @date 2026-02-19
 */

import { EventEmitter } from 'events';
import type {
  MCPServerConfig,
  MCPConnectionState,
  MCPConnectionStatus,
  MCPInitializeResult,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPToolCallRequest,
  MCPToolCallResult,
  MCPEvent,
  MCPServerCapabilities,
} from '@/types/mcp';
import type { TransportConfig } from './transport';
import type { ITransport } from './transport';
import { TransportFactory } from './transport';
import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger('MCPClient');

/** MCP 客户端选项 */
export interface MCPClientOptions {
  /** 调试模式 */
  debug?: boolean;
  /** 连接超时 (毫秒) */
  connectTimeout?: number;
  /** 请求超时 (毫秒) */
  requestTimeout?: number;
}

/**
 * MCP 客户端类
 * 管理单个 MCP 服务器的连接、初始化和通信
 */
export class MCPClient extends EventEmitter {
  private config: MCPServerConfig;
  private options: MCPClientOptions;
  private transport?: ITransport;
  private state: MCPConnectionState = 'disconnected';
  private capabilities: MCPServerCapabilities | undefined;
  private tools: Map<string, MCPTool> = new Map();
  private resources: Map<string, MCPResource> = new Map();
  private prompts: Map<string, MCPPrompt> = new Map();
  private requestId = 0;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private retryCount = 0;
  private lastConnectedAt: string | undefined;
  private disconnectedAt: string | undefined;
  private errorMessage: string | undefined;

  constructor(config: MCPServerConfig, options: MCPClientOptions = {}) {
    super();
    this.config = config;
    this.options = {
      debug: false,
      connectTimeout: 30000,
      requestTimeout: 60000,
      ...options,
    };
  }

  /** 获取服务器 ID */
  get serverId(): string {
    return this.config.id;
  }

  /** 获取服务器名称 */
  get serverName(): string {
    return this.config.name;
  }

  /** 获取当前状态 */
  get connectionState(): MCPConnectionState {
    return this.state;
  }

  /** 获取连接状态详情 */
  get status(): MCPConnectionStatus {
    return {
      serverId: this.config.id,
      state: this.state,
      lastConnectedAt: this.lastConnectedAt,
      disconnectedAt: this.disconnectedAt,
      error: this.errorMessage,
      retryCount: this.retryCount,
      toolCount: this.tools.size,
      resourceCount: this.resources.size,
      protocolVersion: this.capabilities ? '2024-11-05' : undefined,
    };
  }

  /** 是否已连接 */
  get isConnected(): boolean {
    return this.state === 'connected';
  }

  /** 获取工具列表 */
  getTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /** 获取资源列表 */
  getResources(): MCPResource[] {
    return Array.from(this.resources.values());
  }

  /** 获取提示词列表 */
  getPrompts(): MCPPrompt[] {
    return Array.from(this.prompts.values());
  }

  /** 获取特定工具 */
  getTool(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  /** 获取服务器能力 */
  getCapabilities(): MCPServerCapabilities | undefined {
    return this.capabilities;
  }

  /**
   * 连接到 MCP 服务器
   */
  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      logger.warn(`Already ${this.state}, skipping connect`);
      return;
    }

    this.setState('connecting');
    this.errorMessage = undefined;

    try {
      // 创建传输层
      logger.info(`Creating ${this.config.transport} transport for ${this.config.name}`);
      
      this.transport = TransportFactory.create(
        this.config.transport,
        {
          ...(this.config.connection.command ? { command: this.config.connection.command } : {}),
          ...(this.config.connection.args ? { args: this.config.connection.args } : {}),
          ...(this.config.connection.env ? { env: this.config.connection.env } : {}),
          ...(this.config.connection.url ? { url: this.config.connection.url } : {}),
          ...(this.config.connection.headers ? { headers: this.config.connection.headers } : {}),
        } as {
          command?: string;
          args?: string[];
          env?: Record<string, string>;
          url?: string;
          headers?: Record<string, string>;
        },
        {
          ...(this.config.connection.timeout ? { timeout: this.config.connection.timeout } : {}),
          ...(this.options.debug ? { debug: this.options.debug } : {}),
        } as TransportConfig
      );

      // 监听传输层事件
      this.transport.on('disconnect', () => {
        this.handleDisconnect();
      });

      this.transport.on('error', (error) => {
        this.handleError(error);
      });

      this.transport.on('notification', (notification) => {
        this.handleNotification(notification);
      });

      // 连接传输层
      await this.transport.connect();

      // 初始化 MCP 会话
      await this.initialize();

      // 获取服务器能力
      await this.fetchCapabilities();

      this.setState('connected');
      this.lastConnectedAt = new Date().toISOString();
      this.retryCount = 0;

      logger.info(`Successfully connected to MCP server: ${this.config.name}`);
      this.emitEvent('connected');

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to connect to MCP server ${this.config.name}:`, { error: errorMsg });
      
      this.errorMessage = errorMsg;
      this.setState('error');
      
      // 尝试重连
      this.scheduleReconnect();
      
      throw error;
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    // 清除重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.transport) {
      await this.transport.disconnect();
    }

    this.handleDisconnect();
  }

  /**
   * 初始化 MCP 会话
   */
  private async initialize(): Promise<void> {
    const id = ++this.requestId;
    
    const response = await this.transport!.send({
      jsonrpc: '2.0',
      id,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: true },
          resources: { subscribe: true, listChanged: true },
          prompts: { listChanged: true },
          logging: {},
        },
        clientInfo: {
          name: 'ouroboros-mcp-client',
          version: '2.0.0',
        },
      },
    });

    const result = response.result as MCPInitializeResult;
    
    this.capabilities = result.capabilities;
    // serverInfo is kept for future use (server name and version tracking)
    void result.serverInfo;

    logger.info(`MCP server initialized: ${result.serverInfo.name} v${result.serverInfo.version}`);

    // 发送 initialized 通知
    this.transport!.notify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: undefined,
    });
  }

  /**
   * 获取服务器能力
   */
  private async fetchCapabilities(): Promise<void> {
    // 获取工具列表
    if (this.capabilities?.tools) {
      await this.fetchTools();
    }

    // 获取资源列表
    if (this.capabilities?.resources) {
      await this.fetchResources();
    }

    // 获取提示词列表
    if (this.capabilities?.prompts) {
      await this.fetchPrompts();
    }
  }

  /**
   * 获取工具列表
   */
  private async fetchTools(): Promise<void> {
    const id = ++this.requestId;
    
    const response = await this.transport!.send({
      jsonrpc: '2.0',
      id,
      method: 'tools/list',
      params: undefined,
    });

    const result = response.result as { tools: MCPTool[] };
    
    this.tools.clear();
    for (const tool of result.tools) {
      // 应用能力过滤
      if (this.shouldIncludeTool(tool.name)) {
        this.tools.set(tool.name, tool);
      }
    }

    logger.info(`Loaded ${this.tools.size} tools from ${this.config.name}`);
  }

  /**
   * 获取资源列表
   */
  private async fetchResources(): Promise<void> {
    const id = ++this.requestId;
    
    const response = await this.transport!.send({
      jsonrpc: '2.0',
      id,
      method: 'resources/list',
      params: undefined,
    });

    const result = response.result as { resources: MCPResource[] };
    
    this.resources.clear();
    for (const resource of result.resources) {
      if (this.shouldIncludeResource(resource.uri)) {
        this.resources.set(resource.uri, resource);
      }
    }

    logger.info(`Loaded ${this.resources.size} resources from ${this.config.name}`);
  }

  /**
   * 获取提示词列表
   */
  private async fetchPrompts(): Promise<void> {
    const id = ++this.requestId;
    
    const response = await this.transport!.send({
      jsonrpc: '2.0',
      id,
      method: 'prompts/list',
      params: undefined,
    });

    const result = response.result as { prompts: MCPPrompt[] };
    
    this.prompts.clear();
    for (const prompt of result.prompts) {
      if (this.shouldIncludePrompt(prompt.name)) {
        this.prompts.set(prompt.name, prompt);
      }
    }

    logger.info(`Loaded ${this.prompts.size} prompts from ${this.config.name}`);
  }

  /**
   * 调用工具
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolCallResult> {
    if (!this.isConnected) {
      throw new Error('Not connected to MCP server');
    }

    if (!this.tools.has(name)) {
      throw new Error(`Tool '${name}' not found`);
    }

    const id = ++this.requestId;
    
    logger.debug(`Calling tool ${name} on ${this.config.name}`, args);

    const response = await this.transport!.send({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      } as MCPToolCallRequest,
    });

    const result = response.result as MCPToolCallResult;
    
    this.emitEvent('tool-called', { toolName: name, args });
    
    if (result.isError) {
      this.emitEvent('tool-failed', { toolName: name, error: result.content });
    } else {
      this.emitEvent('tool-succeeded', { toolName: name, result: result.content });
    }

    return result;
  }

  /**
   * 读取资源
   */
  async readResource(uri: string): Promise<{ contents: Array<{ uri: string; mimeType?: string; text?: string; blob?: string }> }> {
    if (!this.isConnected) {
      throw new Error('Not connected to MCP server');
    }

    const id = ++this.requestId;
    
    const response = await this.transport!.send({
      jsonrpc: '2.0',
      id,
      method: 'resources/read',
      params: { uri },
    });

    return response.result as { contents: Array<{ uri: string; mimeType?: string; text?: string; blob?: string }> };
  }

  /**
   * 获取提示词
   */
  async getPrompt(name: string, args?: Record<string, string>): Promise<{ description?: string; messages: unknown[] }> {
    if (!this.isConnected) {
      throw new Error('Not connected to MCP server');
    }

    const id = ++this.requestId;
    
    const response = await this.transport!.send({
      jsonrpc: '2.0',
      id,
      method: 'prompts/get',
      params: { name, arguments: args },
    });

    return response.result as { description?: string; messages: unknown[] };
  }

  /**
   * 设置日志级别
   */
  async setLogLevel(level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency'): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to MCP server');
    }

    this.transport!.notify({
      jsonrpc: '2.0',
      method: 'logging/setLevel',
      params: { level },
    });
  }

  /**
   * 检查是否应该包含工具 (应用能力过滤)
   */
  private shouldIncludeTool(toolName: string): boolean {
    if (!this.config.capabilities?.tools) {
      return true; // 没有过滤配置，包含所有
    }
    return this.config.capabilities.tools.includes(toolName);
  }

  /**
   * 检查是否应该包含资源
   */
  private shouldIncludeResource(uri: string): boolean {
    if (!this.config.capabilities?.resources) {
      return true;
    }
    return this.config.capabilities.resources.includes(uri);
  }

  /**
   * 检查是否应该包含提示词
   */
  private shouldIncludePrompt(promptName: string): boolean {
    if (!this.config.capabilities?.prompts) {
      return true;
    }
    return this.config.capabilities.prompts.includes(promptName);
  }

  /**
   * 处理断开连接
   */
  private handleDisconnect(): void {
    const wasConnected = this.state === 'connected';
    
    this.setState('disconnected');
    this.disconnectedAt = new Date().toISOString();
    this.tools.clear();
    this.resources.clear();
    this.prompts.clear();
    this.capabilities = undefined;

    if (wasConnected) {
      logger.warn(`Disconnected from MCP server: ${this.config.name}`);
      this.emitEvent('disconnected');
      
      // 尝试重连
      this.scheduleReconnect();
    }
  }

  /**
   * 处理错误
   */
  private handleError(error: Error): void {
    logger.error(`MCP client error for ${this.config.name}:`, { message: error.message, stack: error.stack });
    this.errorMessage = error.message;
    this.setState('error');
    this.emitEvent('error', { error: error.message });
  }

  /**
   * 处理通知
   */
  private handleNotification(notification: { method: string; params?: unknown }): void {
    logger.debug(`Received notification from ${this.config.name}: ${notification.method}`);

    switch (notification.method) {
      case 'notifications/tools/list_changed':
        this.fetchTools().then(() => {
          this.emitEvent('tools-changed', { tools: this.getTools() });
        });
        break;
      
      case 'notifications/resources/list_changed':
        this.fetchResources().then(() => {
          this.emitEvent('resources-changed', { resources: this.getResources() });
        });
        break;
      
      case 'notifications/prompts/list_changed':
        this.fetchPrompts().then(() => {
          this.emitEvent('prompts-changed', { prompts: this.getPrompts() });
        });
        break;
      
      case 'notifications/message':
        // 日志消息通知
        if (this.options.debug) {
          logger.debug(`MCP server message: ${JSON.stringify(notification.params)}`);
        }
        break;
    }
  }

  /**
   * 设置状态
   */
  private setState(newState: MCPConnectionState): void {
    const oldState = this.state;
    this.state = newState;
    
    if (oldState !== newState) {
      logger.debug(`MCP client ${this.config.id} state: ${oldState} -> ${newState}`);
    }
  }

  /**
   * 调度重连
   */
  private scheduleReconnect(): void {
    if (!this.config.reconnect?.enabled) {
      return;
    }

    if (this.retryCount >= this.config.reconnect.maxRetries) {
      logger.error(`Max reconnection attempts reached for ${this.config.name}`);
      return;
    }

    this.retryCount++;
    this.setState('reconnecting');

    const delay = this.config.reconnect.interval * 
      Math.pow(this.config.reconnect.backoffMultiplier, this.retryCount - 1);

    logger.info(`Scheduling reconnect for ${this.config.name} in ${delay}ms (attempt ${this.retryCount}/${this.config.reconnect.maxRetries})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // 错误已在 connect 中处理
      });
    }, delay);
  }

  /**
   * 发出事件
   */
  private emitEvent(type: MCPEvent['type'], data?: unknown): void {
    const event: MCPEvent = {
      type,
      serverId: this.config.id,
      timestamp: new Date().toISOString(),
      data,
    };
    
    this.emit('event', event);
  }
}
