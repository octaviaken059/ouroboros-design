/**
 * @file adapters/mcp/transport.ts
 * @description MCP 传输层实现 - 支持 stdio、sse、websocket、http
 * @author Ouroboros
 * @date 2026-02-19
 */

import { EventEmitter } from 'events';
import { spawn, type ChildProcess } from 'child_process';
import type { MCPRequest, MCPResponse, MCPNotification } from '@/types/mcp';
import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger('MCPTransport');

/** 传输层配置 */
export interface TransportConfig {
  /** 超时时间 (毫秒) */
  timeout?: number;
  /** 调试模式 */
  debug?: boolean;
}

/** 传输层接口 */
export interface ITransport extends EventEmitter {
  /** 连接 */
  connect(): Promise<void>;
  /** 断开连接 */
  disconnect(): Promise<void>;
  /** 发送请求 */
  send(request: MCPRequest): Promise<MCPResponse>;
  /** 发送通知 */
  notify(notification: MCPNotification): void;
  /** 是否已连接 */
  readonly isConnected: boolean;
}

/** 传输层基类 */
export abstract class BaseTransport extends EventEmitter implements ITransport {
  protected config: TransportConfig;
  protected _isConnected = false;
  protected requestId = 0;
  protected pendingRequests = new Map<number | string, {
    resolve: (value: MCPResponse) => void;
    reject: (reason: Error) => void;
    timer: NodeJS.Timeout;
  }>();

  constructor(config: TransportConfig = {}) {
    super();
    this.config = {
      timeout: 30000,
      debug: false,
      ...config,
    };
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract send(request: MCPRequest): Promise<MCPResponse>;
  abstract notify(notification: MCPNotification): void;

  protected generateId(): number {
    return ++this.requestId;
  }

  protected handleResponse(response: MCPResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(response.id);
      
      if (response.error) {
        pending.reject(new Error(`MCP Error ${response.error.code}: ${response.error.message}`));
      } else {
        pending.resolve(response);
      }
    }
  }

  protected createTimeoutTimer(id: number | string): NodeJS.Timeout {
    return setTimeout(() => {
      const pending = this.pendingRequests.get(id);
      if (pending) {
        this.pendingRequests.delete(id);
        pending.reject(new Error(`Request timeout after ${this.config.timeout}ms`));
      }
    }, this.config.timeout);
  }

  protected cleanup(): void {
    // 清理所有挂起的请求
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Transport disconnected'));
    }
    this.pendingRequests.clear();
  }
}

/** stdio 传输层 - 用于本地进程通信 */
export class StdioTransport extends BaseTransport {
  private process?: ChildProcess;
  private buffer = '';
  private command: string;
  private args: string[];
  private env: Record<string, string>;

  constructor(
    command: string,
    args: string[] = [],
    env: Record<string, string> = {},
    config?: TransportConfig
  ) {
    super(config);
    this.command = command;
    this.args = args;
    this.env = env;
  }

  async connect(): Promise<void> {
    if (this._isConnected) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        logger.info(`Starting MCP server process: ${this.command} ${this.args.join(' ')}`);
        
        this.process = spawn(this.command, this.args, {
          env: { ...process.env, ...this.env },
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stderrBuffer = '';

        this.process.stdout?.on('data', (data: Buffer) => {
          this.handleData(data.toString());
        });

        this.process.stderr?.on('data', (data: Buffer) => {
          stderrBuffer += data.toString();
          if (this.config.debug) {
            logger.debug(`MCP server stderr: ${data.toString().trim()}`);
          }
        });

        this.process.on('error', (error) => {
          logger.error('MCP server process error:', { message: error.message, stack: error.stack });
          this._isConnected = false;
          this.emit('error', error);
          reject(error);
        });

        this.process.on('exit', (code) => {
          logger.warn(`MCP server process exited with code ${code}`);
          this._isConnected = false;
          this.cleanup();
          this.emit('disconnect', code);
        });

        // 等待进程启动
        setTimeout(() => {
          if (this.process?.pid) {
            this._isConnected = true;
            logger.info(`MCP server process started with PID ${this.process.pid}`);
            resolve();
          } else {
            reject(new Error('Failed to start MCP server process'));
          }
        }, 100);

      } catch (error) {
        reject(error);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (!this._isConnected || !this.process) {
      return;
    }

    this._isConnected = false;
    this.cleanup();

    // 优雅关闭进程
    this.process.kill('SIGTERM');
    
    // 5秒后强制关闭
    setTimeout(() => {
      if (this.process && !this.process.killed) {
        this.process.kill('SIGKILL');
      }
    }, 5000);

    this.emit('disconnect');
  }

  async send(request: MCPRequest): Promise<MCPResponse> {
    if (!this._isConnected || !this.process?.stdin) {
      throw new Error('Transport not connected');
    }

    return new Promise((resolve, reject) => {
      const timer = this.createTimeoutTimer(request.id);
      
      this.pendingRequests.set(request.id, {
        resolve,
        reject,
        timer,
      });

      const message = JSON.stringify(request) + '\n';
      
      if (this.config.debug) {
        logger.debug('Sending:', message.trim());
      }

      this.process!.stdin!.write(message, (error) => {
        if (error) {
          clearTimeout(timer);
          this.pendingRequests.delete(request.id);
          reject(error);
        }
      });
    });
  }

  notify(notification: MCPNotification): void {
    if (!this._isConnected || !this.process?.stdin) {
      throw new Error('Transport not connected');
    }

    const message = JSON.stringify(notification) + '\n';
    this.process.stdin.write(message);
  }

  private handleData(data: string): void {
    this.buffer += data;
    
    // 处理完整行 (JSON-RPC messages are newline-delimited)
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // 保留不完整的最后一行

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line) as MCPResponse | MCPNotification;
          
          if (this.config.debug) {
            logger.debug('Received:', line.trim());
          }

          // 检查是否是响应 (有 id 字段且不是 notification)
          if ('id' in message && message.id !== undefined) {
            this.handleResponse(message as MCPResponse);
          } else {
            // 通知消息
            this.emit('notification', message as MCPNotification);
          }
        } catch (error) {
          logger.error('Failed to parse MCP message:', { line, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }
  }
}

/** SSE (Server-Sent Events) 传输层 */
export class SSETransport extends BaseTransport {
  private url: string;
  private headers: Record<string, string>;

  constructor(
    url: string,
    headers: Record<string, string> = {},
    config?: TransportConfig
  ) {
    super(config);
    this.url = url;
    this.headers = headers;
  }

  async connect(): Promise<void> {
    // SSE 传输需要使用原生 EventSource 或实现自定义 SSE 客户端
    // 这里使用简单的 fetch 轮询作为示例
    throw new Error('SSE transport not yet implemented');
  }

  async disconnect(): Promise<void> {
    this._isConnected = false;
    this.cleanup();
  }

  async send(request: MCPRequest): Promise<MCPResponse> {
    if (!this._isConnected) {
      throw new Error('Transport not connected');
    }

    return new Promise((resolve, reject) => {
      const timer = this.createTimeoutTimer(request.id);
      
      this.pendingRequests.set(request.id, {
        resolve,
        reject,
        timer,
      });

      fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify(request),
      }).catch((error) => {
        clearTimeout(timer);
        this.pendingRequests.delete(request.id);
        reject(error);
      });
    });
  }

  notify(notification: MCPNotification): void {
    if (!this._isConnected) {
      throw new Error('Transport not connected');
    }

    fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
      body: JSON.stringify(notification),
    }).catch((error) => {
      logger.error('Failed to send notification:', error);
    });
  }
}

/** HTTP 传输层 - 简单的 HTTP POST */
export class HTTPTransport extends BaseTransport {
  private url: string;
  private headers: Record<string, string>;

  constructor(
    url: string,
    headers: Record<string, string> = {},
    config?: TransportConfig
  ) {
    super(config);
    this.url = url;
    this.headers = headers;
  }

  async connect(): Promise<void> {
    // HTTP 是无连接的，只需验证端点可用
    try {
      const response = await fetch(this.url, {
        method: 'HEAD',
        headers: this.headers,
      });
      
      if (response.ok) {
        this._isConnected = true;
        this.emit('connect');
      } else {
        throw new Error(`HTTP endpoint returned ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Failed to connect to HTTP endpoint: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    this._isConnected = false;
    this.cleanup();
    this.emit('disconnect');
  }

  async send(request: MCPRequest): Promise<MCPResponse> {
    if (!this._isConnected) {
      throw new Error('Transport not connected');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      return await response.json() as MCPResponse;
    } catch (error) {
      clearTimeout(timeout);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  notify(notification: MCPNotification): void {
    if (!this._isConnected) {
      throw new Error('Transport not connected');
    }

    fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
      body: JSON.stringify(notification),
    }).catch((error) => {
      logger.error('Failed to send notification:', error);
    });
  }
}

/** 传输层工厂 */
export class TransportFactory {
  static create(
    type: 'stdio' | 'sse' | 'http' | 'websocket',
    config: {
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      url?: string;
      headers?: Record<string, string>;
    },
    transportConfig?: TransportConfig
  ): ITransport {
    switch (type) {
      case 'stdio':
        if (!config.command) {
          throw new Error('Command is required for stdio transport');
        }
        return new StdioTransport(
          config.command,
          config.args,
          config.env,
          transportConfig
        );
      
      case 'sse':
        if (!config.url) {
          throw new Error('URL is required for SSE transport');
        }
        return new SSETransport(config.url, config.headers, transportConfig);
      
      case 'http':
        if (!config.url) {
          throw new Error('URL is required for HTTP transport');
        }
        return new HTTPTransport(config.url, config.headers, transportConfig);
      
      case 'websocket':
        throw new Error('WebSocket transport not yet implemented');
      
      default:
        throw new Error(`Unknown transport type: ${type}`);
    }
  }
}
