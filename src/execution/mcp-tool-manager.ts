/**
 * MCP (Model Context Protocol) 工具集成
 * 
 * 将每个 MCP 服务器作为 Agent 的工具使用
 * 支持 SSE 和 stdio 两种传输方式
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// 类型定义
// ============================================================================

/** MCP 工具定义 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/** MCP 服务器配置 */
export interface MCPServerConfig {
  name: string;
  command?: string;           // stdio 模式
  args?: string[];
  env?: Record<string, string>;
  url?: string;               // SSE 模式
  timeout?: number;
  enabled: boolean;
}

/** MCP 连接状态 */
export enum MCPConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

/** MCP 请求 */
export interface MCPRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

/** MCP 响应 */
export interface MCPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// ============================================================================
// MCP 客户端基类
// ============================================================================

export abstract class MCPClient extends EventEmitter {
  protected serverName: string;
  protected status: MCPConnectionStatus = MCPConnectionStatus.DISCONNECTED;
  protected tools: Map<string, MCPTool> = new Map();
  private requestId = 0;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();

  constructor(serverName: string) {
    super();
    this.serverName = serverName;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract sendRequest(request: MCPRequest): Promise<MCPResponse>;

  getStatus(): MCPConnectionStatus {
    return this.status;
  }

  getTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  getTool(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  protected setStatus(status: MCPConnectionStatus): void {
    this.status = status;
    this.emit('statusChange', { server: this.serverName, status });
  }

  protected addTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
    this.emit('toolAdded', { server: this.serverName, tool });
  }

  protected generateRequestId(): number {
    return ++this.requestId;
  }

  /**
   * 初始化：获取工具列表
   */
  async initialize(): Promise<void> {
    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.generateRequestId(),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'OuroborosAgent',
          version: '1.0.0',
        },
      },
    });

    if (response.error) {
      throw new Error(`MCP init failed: ${response.error.message}`);
    }

    // 获取工具列表
    await this.listTools();
  }

  /**
   * 获取工具列表
   */
  private async listTools(): Promise<void> {
    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.generateRequestId(),
      method: 'tools/list',
    });

    if (response.error) {
      throw new Error(`List tools failed: ${response.error.message}`);
    }

    const result = response.result as { tools: MCPTool[] };
    for (const tool of result.tools) {
      this.addTool(tool);
    }
  }

  /**
   * 调用工具
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.generateRequestId(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    });

    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }

    return response.result;
  }
}

// ============================================================================
// Stdio MCP 客户端
// ============================================================================

export class StdioMCPClient extends MCPClient {
  private process: ChildProcess | null = null;
  private command: string;
  private args: string[];
  private env: Record<string, string>;
  private buffer = '';

  constructor(config: MCPServerConfig) {
    super(config.name);
    this.command = config.command!;
    this.args = config.args || [];
    this.env = config.env || {};
  }

  async connect(): Promise<void> {
    this.setStatus(MCPConnectionStatus.CONNECTING);

    return new Promise((resolve, reject) => {
      this.process = spawn(this.command, this.args, {
        env: { ...process.env, ...this.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout!.on('data', (data: Buffer) => {
        this.handleData(data.toString());
      });

      this.process.stderr!.on('data', (data: Buffer) => {
        this.emit('stderr', data.toString());
      });

      this.process.on('error', (error) => {
        this.setStatus(MCPConnectionStatus.ERROR);
        reject(error);
      });

      this.process.on('exit', (code) => {
        this.setStatus(MCPConnectionStatus.DISCONNECTED);
        this.emit('exit', code);
      });

      // 等待初始化完成
      setTimeout(async () => {
        try {
          await this.initialize();
          this.setStatus(MCPConnectionStatus.CONNECTED);
          resolve();
        } catch (error) {
          this.setStatus(MCPConnectionStatus.ERROR);
          reject(error);
        }
      }, 1000);
    });
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.setStatus(MCPConnectionStatus.DISCONNECTED);
  }

  sendRequest(request: MCPRequest): Promise<MCPResponse> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('Not connected'));
        return;
      }

      this.pendingRequests.set(request.id, { resolve, reject });

      // 发送请求
      const message = JSON.stringify(request) + '\n';
      this.process.stdin.write(message);

      // 超时处理
      setTimeout(() => {
        if (this.pendingRequests.has(request.id)) {
          this.pendingRequests.delete(request.id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  private handleData(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line) as MCPResponse;
          const pending = this.pendingRequests.get(response.id);
          if (pending) {
            this.pendingRequests.delete(response.id);
            pending.resolve(response);
          }
        } catch {
          this.emit('invalidMessage', line);
        }
      }
    }
  }
}

// ============================================================================
// MCP 工具管理器
// ============================================================================

export class MCPToolManager extends EventEmitter {
  private clients: Map<string, MCPClient> = new Map();
  private configPath: string;

  constructor(configPath: string = './data/mcp-servers.json') {
    super();
    this.configPath = configPath;
  }

  /**
   * 加载配置文件
   */
  async loadConfig(): Promise<MCPServerConfig[]> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  /**
   * 保存配置文件
   */
  async saveConfig(servers: MCPServerConfig[]): Promise<void> {
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(servers, null, 2));
  }

  /**
   * 连接 MCP 服务器
   */
  async connectServer(config: MCPServerConfig): Promise<MCPClient> {
    if (this.clients.has(config.name)) {
      throw new Error(`Server ${config.name} already connected`);
    }

    let client: MCPClient;

    if (config.command) {
      // stdio 模式
      client = new StdioMCPClient(config);
    } else if (config.url) {
      // SSE 模式 (待实现)
      throw new Error('SSE mode not yet implemented');
    } else {
      throw new Error('Invalid server config: need command or url');
    }

    // 监听事件
    client.on('statusChange', ({ server, status }) => {
      this.emit('serverStatusChange', { server, status });
    });

    client.on('toolAdded', ({ server, tool }) => {
      this.emit('toolRegistered', { server, tool });
    });

    await client.connect();
    this.clients.set(config.name, client);

    return client;
  }

  /**
   * 断开 MCP 服务器
   */
  async disconnectServer(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.disconnect();
      this.clients.delete(name);
    }
  }

  /**
   * 获取所有工具（转换为 Agent 工具格式）
   */
  getAllTools(): Array<{
    name: string;
    description: string;
    server: string;
    parameters: MCPTool['inputSchema'];
    execute: (args: Record<string, unknown>) => Promise<unknown>;
  }> {
    const tools: ReturnType<typeof this.getAllTools> = [];

    for (const [serverName, client] of this.clients) {
      for (const mcpTool of client.getTools()) {
        tools.push({
          name: `${serverName}.${mcpTool.name}`,
          description: `[${serverName}] ${mcpTool.description}`,
          server: serverName,
          parameters: mcpTool.inputSchema,
          execute: async (args: Record<string, unknown>) => {
            return client.callTool(mcpTool.name, args);
          },
        });
      }
    }

    return tools;
  }

  /**
   * 调用工具
   */
  async callTool(fullName: string, args: Record<string, unknown>): Promise<unknown> {
    const [serverName, toolName] = fullName.split('.');
    const client = this.clients.get(serverName);
    
    if (!client) {
      throw new Error(`Server not found: ${serverName}`);
    }

    return client.callTool(toolName, args);
  }

  /**
   * 获取连接状态
   */
  getStatus(): Array<{ name: string; status: MCPConnectionStatus; tools: number }> {
    return Array.from(this.clients.entries()).map(([name, client]) => ({
      name,
      status: client.getStatus(),
      tools: client.getTools().length,
    }));
  }

  /**
   * 断开所有连接
   */
  async disconnectAll(): Promise<void> {
    for (const [name, client] of this.clients) {
      await client.disconnect();
    }
    this.clients.clear();
  }
}

export default MCPToolManager;
