/**
 * WebSocket Manager - 实时通信管理
 * 
 * 功能：
 * - WebSocket连接管理
 * - 实时消息推送
 * - 连接状态监控
 * - 心跳检测
 * - 广播/单播消息
 */

import { IncomingMessage } from 'http';
import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import { EventEmitter } from 'events';

export interface WebSocketConfig {
  path?: string;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  maxConnections?: number;
  perMessageDeflate?: boolean;
}

export interface WSMessage {
  type: string;
  payload?: unknown;
  timestamp?: number;
  id?: string;
}

export interface ConnectionInfo {
  id: string;
  socket: WebSocket;
  connectedAt: number;
  lastPing: number;
  isAlive: boolean;
  metadata: Record<string, unknown>;
  subscriptions: Set<string>;
}

export type MessageHandler = (message: WSMessage, connection: ConnectionInfo) => void | Promise<void>;

export class WebSocketManager extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private config: Required<WebSocketConfig>;
  private connections: Map<string, ConnectionInfo> = new Map();
  private messageHandlers: Map<string, MessageHandler> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connectionCounter = 0;

  constructor(config: WebSocketConfig = {}) {
    super();
    this.config = {
      path: '/ws',
      heartbeatInterval: 30000,  // 30秒
      heartbeatTimeout: 60000,   // 60秒超时
      maxConnections: 100,
      perMessageDeflate: false,
      ...config,
    };
  }

  /**
   * 初始化WebSocket服务器
   */
  initialize(server: HTTPServer): void {
    this.wss = new WebSocketServer({
      server,
      path: this.config.path,
      perMessageDeflate: this.config.perMessageDeflate,
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
      this.emit('error', error);
    });

    // 启动心跳检测
    this.startHeartbeat();

    console.log(`📡 WebSocket Manager initialized on ${this.config.path}`);
  }

  /**
   * 处理新连接
   */
  private handleConnection(socket: WebSocket, req: IncomingMessage): void {
    // 检查最大连接数
    if (this.connections.size >= this.config.maxConnections) {
      socket.close(1013, 'Maximum connections reached');
      return;
    }

    const connectionId = this.generateConnectionId();
    const connection: ConnectionInfo = {
      id: connectionId,
      socket,
      connectedAt: Date.now(),
      lastPing: Date.now(),
      isAlive: true,
      metadata: {
        remoteAddress: req.headers['x-forwarded-for'] || 
                       req.socket?.remoteAddress || 
                       'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      },
      subscriptions: new Set(),
    };

    this.connections.set(connectionId, connection);

    // 设置消息处理
    socket.on('message', (data: RawData) => {
      this.handleMessage(data, connection);
    });

    // 设置关闭处理
    socket.on('close', (code: number, reason: Buffer) => {
      this.handleDisconnect(connectionId, code, reason);
    });

    // 设置错误处理
    socket.on('error', (error: Error) => {
      console.error(`WebSocket error for ${connectionId}:`, error);
      this.emit('connectionError', { connectionId, error });
    });

    // 发送欢迎消息
    this.sendToConnection(connectionId, {
      type: 'connected',
      payload: {
        connectionId,
        serverTime: Date.now(),
        heartbeatInterval: this.config.heartbeatInterval,
      },
    });

    this.emit('connected', connection);
    console.log(`📡 Client connected: ${connectionId} (${this.connections.size} total)`);
  }

  /**
   * 处理消息
   */
  private handleMessage(data: RawData, connection: ConnectionInfo): void {
    try {
      const message = JSON.parse(data.toString()) as WSMessage;
      
      // 更新最后活动时间
      connection.lastPing = Date.now();
      connection.isAlive = true;

      // 处理ping消息
      if (message.type === 'ping') {
        this.sendToConnection(connection.id, {
          type: 'pong',
          payload: { timestamp: Date.now() },
        });
        return;
      }

      // 处理订阅消息
      if (message.type === 'subscribe') {
        const channels = message.payload as string[] || [];
        for (const channel of channels) {
          connection.subscriptions.add(channel);
        }
        this.sendToConnection(connection.id, {
          type: 'subscribed',
          payload: { channels: Array.from(connection.subscriptions) },
        });
        return;
      }

      // 处理取消订阅
      if (message.type === 'unsubscribe') {
        const channels = message.payload as string[] || [];
        for (const channel of channels) {
          connection.subscriptions.delete(channel);
        }
        this.sendToConnection(connection.id, {
          type: 'unsubscribed',
          payload: { channels: Array.from(connection.subscriptions) },
        });
        return;
      }

      // 调用注册的消息处理器
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        handler(message, connection);
      } else {
        // 未处理的消息类型，触发事件
        this.emit('message', message, connection);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      this.sendToConnection(connection.id, {
        type: 'error',
        payload: { message: 'Invalid message format' },
      });
    }
  }

  /**
   * 处理断开连接
   */
  private handleDisconnect(connectionId: string, code: number, reason: Buffer): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.connections.delete(connectionId);
      this.emit('disconnected', { connectionId, code, reason: reason.toString() });
      console.log(`📡 Client disconnected: ${connectionId} (${this.connections.size} total)`);
    }
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      
      for (const [id, connection] of this.connections) {
        // 检查是否超时
        if (now - connection.lastPing > this.config.heartbeatTimeout) {
          console.log(`📡 Connection timeout: ${id}`);
          connection.socket.terminate();
          this.connections.delete(id);
          this.emit('timeout', { connectionId: id });
          continue;
        }

        // 发送ping检查
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.isAlive = false;
          this.sendToConnection(id, { type: 'ping' });
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * 注册消息处理器
   */
  registerHandler(type: string, handler: MessageHandler): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * 注销消息处理器
   */
  unregisterHandler(type: string): void {
    this.messageHandlers.delete(type);
  }

  /**
   * 发送消息到指定连接
   */
  sendToConnection(connectionId: string, message: WSMessage): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      message.timestamp = Date.now();
      message.id = message.id || this.generateMessageId();
      connection.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`Failed to send message to ${connectionId}:`, error);
      return false;
    }
  }

  /**
   * 广播消息到所有连接
   */
  broadcast(message: WSMessage, excludeId?: string): number {
    let sent = 0;
    message.timestamp = Date.now();
    message.id = message.id || this.generateMessageId();
    const data = JSON.stringify(message);

    for (const [id, connection] of this.connections) {
      if (id !== excludeId && connection.socket.readyState === WebSocket.OPEN) {
        try {
          connection.socket.send(data);
          sent++;
        } catch (error) {
          console.error(`Failed to broadcast to ${id}:`, error);
        }
      }
    }

    return sent;
  }

  /**
   * 按频道广播
   */
  broadcastToChannel(channel: string, message: WSMessage): number {
    let sent = 0;
    message.timestamp = Date.now();
    message.id = message.id || this.generateMessageId();
    const data = JSON.stringify(message);

    for (const connection of this.connections.values()) {
      if (connection.subscriptions.has(channel) && 
          connection.socket.readyState === WebSocket.OPEN) {
        try {
          connection.socket.send(data);
          sent++;
        } catch (error) {
          console.error(`Failed to send to channel ${channel}:`, error);
        }
      }
    }

    return sent;
  }

  /**
   * 推送系统状态更新
   */
  pushStatusUpdate(status: Record<string, unknown>): void {
    this.broadcastToChannel('status', {
      type: 'status_update',
      payload: status,
    });
  }

  /**
   * 推送日志消息
   */
  pushLog(level: string, message: string, metadata?: Record<string, unknown>): void {
    this.broadcastToChannel('logs', {
      type: 'log',
      payload: {
        level,
        message,
        metadata,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * 推送通知
   */
  pushNotification(title: string, body: string, type = 'info'): void {
    this.broadcast({
      type: 'notification',
      payload: {
        title,
        body,
        type,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * 获取连接信息
   */
  getConnectionInfo(connectionId: string): ConnectionInfo | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * 获取所有连接
   */
  getAllConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  /**
   * 获取连接统计
   */
  getStats(): {
    totalConnections: number;
    totalSubscriptions: number;
    channels: Record<string, number>;
  } {
    const channels: Record<string, number> = {};
    let totalSubscriptions = 0;

    for (const connection of this.connections.values()) {
      totalSubscriptions += connection.subscriptions.size;
      for (const channel of connection.subscriptions) {
        channels[channel] = (channels[channel] || 0) + 1;
      }
    }

    return {
      totalConnections: this.connections.size,
      totalSubscriptions,
      channels,
    };
  }

  /**
   * 断开指定连接
   */
  disconnect(connectionId: string, code = 1000, reason = 'Server disconnect'): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.socket.close(code, reason);
      this.connections.delete(connectionId);
    }
  }

  /**
   * 断开所有连接
   */
  disconnectAll(code = 1001, reason = 'Server shutting down'): void {
    for (const [id, connection] of this.connections) {
      connection.socket.close(code, reason);
    }
    this.connections.clear();
  }

  /**
   * 关闭WebSocket服务器
   */
  async close(): Promise<void> {
    // 停止心跳
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // 断开所有连接
    this.disconnectAll();

    // 关闭服务器
    if (this.wss) {
      return new Promise((resolve) => {
        this.wss?.close(() => {
          console.log('📡 WebSocket Manager closed');
          resolve();
        });
      });
    }
  }

  /**
   * 生成连接ID
   */
  private generateConnectionId(): string {
    return `ws_${Date.now()}_${++this.connectionCounter}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成消息ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default WebSocketManager;
