/**
 * @file types/mcp.ts
 * @description MCP (Model Context Protocol) 类型定义 - 修复版
 * @author Ouroboros
 * @date 2026-02-19
 */

import type { UUID, Timestamp } from './index';

// ============================================================================
// MCP Server 连接配置
// ============================================================================

/** MCP 传输类型 */
export type MCPTransportType = 'stdio' | 'sse' | 'websocket' | 'http';

/** MCP Server 基础配置 */
export interface MCPServerConfig {
  /** 服务器唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 服务器描述 */
  description: string | undefined;
  /** 传输类型 */
  transport: MCPTransportType;
  /** 连接配置 */
  connection: {
    /** 命令 (stdio 类型使用) */
    command: string | undefined;
    /** 参数 */
    args: string[] | undefined;
    /** 环境变量 */
    env: Record<string, string> | undefined;
    /** URL (sse/websocket/http 类型使用) */
    url: string | undefined;
    /** 请求头 */
    headers: Record<string, string> | undefined;
    /** 超时时间 (毫秒) */
    timeout: number | undefined;
  };
  /** 自动连接 */
  autoConnect: boolean | undefined;
  /** 重连配置 */
  reconnect: {
    /** 启用自动重连 */
    enabled: boolean;
    /** 最大重试次数 */
    maxRetries: number;
    /** 重试间隔 (毫秒) */
    interval: number;
    /** 指数退避倍数 */
    backoffMultiplier: number;
  } | undefined;
  /** 能力过滤 */
  capabilities: {
    /** 启用的工具 */
    tools: string[] | undefined;
    /** 启用的资源 */
    resources: string[] | undefined;
    /** 启用的提示词 */
    prompts: string[] | undefined;
  } | undefined;
}

/** MCP 配置集合 */
export interface MCPConfig {
  /** 服务器列表 */
  servers: MCPServerConfig[];
  /** 全局重连配置 */
  globalReconnect: {
    enabled: boolean;
    maxRetries: number;
    interval: number;
    backoffMultiplier: number;
  } | undefined;
  /** 发现配置 */
  discovery: {
    /** 启用自动发现 */
    enabled: boolean;
    /** 扫描间隔 (毫秒) */
    scanInterval: number;
    /** 本地扫描路径 */
    localPaths: string[] | undefined;
    /** 已知服务注册表 */
    registries: string[] | undefined;
  } | undefined;
  /** 缓存配置 */
  cache: {
    /** 工具列表缓存时间 (毫秒) */
    toolsTTL: number;
    /** 资源列表缓存时间 (毫秒) */
    resourcesTTL: number;
  } | undefined;
}

// ============================================================================
// MCP 协议消息类型
// ============================================================================

/** MCP JSON-RPC 请求 */
export interface MCPRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params: unknown | undefined;
}

/** MCP JSON-RPC 响应 */
export interface MCPResponse {
  jsonrpc: '2.0';
  id: number | string;
  result: unknown | undefined;
  error: {
    code: number;
    message: string;
    data: unknown | undefined;
  } | undefined;
}

/** MCP JSON-RPC 通知 */
export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params: unknown | undefined;
}

// ============================================================================
// MCP 能力定义
// ============================================================================

/** MCP 工具定义 */
export interface MCPTool {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 输入参数 schema */
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[] | undefined;
  };
}

/** MCP 资源定义 */
export interface MCPResource {
  /** 资源 URI */
  uri: string;
  /** 资源名称 */
  name: string;
  /** 资源描述 */
  description: string | undefined;
  /** MIME 类型 */
  mimeType: string | undefined;
}

/** MCP 资源内容 */
export interface MCPResourceContent {
  /** 资源 URI */
  uri: string;
  /** MIME 类型 */
  mimeType: string;
  /** 文本内容 */
  text: string | undefined;
  /** 二进制内容 (base64) */
  blob: string | undefined;
}

/** MCP 提示词定义 */
export interface MCPPrompt {
  /** 提示词名称 */
  name: string;
  /** 提示词描述 */
  description: string | undefined;
  /** 参数定义 */
  arguments: Array<{
    name: string;
    description: string | undefined;
    required: boolean | undefined;
  }> | undefined;
}

/** MCP 服务器能力 */
export interface MCPServerCapabilities {
  /** 支持的日志级别 */
  logging: Record<string, never> | undefined;
  /** 支持的提示词 */
  prompts: Record<string, never> | undefined;
  /** 支持的资源 */
  resources: {
    /** 是否支持订阅 */
    subscribe: boolean | undefined;
    /** 是否支持列表变更通知 */
    listChanged: boolean | undefined;
  } | undefined;
  /** 支持的工具 */
  tools: {
    /** 是否支持列表变更通知 */
    listChanged: boolean | undefined;
  } | undefined;
  /** 实验性功能 */
  experimental: Record<string, unknown> | undefined;
}

/** MCP 服务器信息 */
export interface MCPServerInfo {
  /** 服务器名称 */
  name: string;
  /** 服务器版本 */
  version: string;
}

/** MCP 初始化结果 */
export interface MCPInitializeResult {
  /** 协议版本 */
  protocolVersion: string;
  /** 服务器能力 */
  capabilities: MCPServerCapabilities;
  /** 服务器信息 */
  serverInfo: MCPServerInfo;
}

// ============================================================================
// MCP 工具调用
// ============================================================================

/** MCP 工具调用请求 */
export interface MCPToolCallRequest {
  /** 工具名称 */
  name: string;
  /** 工具参数 */
  arguments: Record<string, unknown>;
}

/** MCP 工具调用结果 */
export interface MCPToolCallResult {
  /** 内容列表 */
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mimeType: string }
    | { type: 'resource'; resource: MCPResourceContent }
  >;
  /** 是否错误 */
  isError: boolean | undefined;
}

// ============================================================================
// MCP 连接状态
// ============================================================================

/** MCP 连接状态 */
export type MCPConnectionState = 
  | 'disconnected'    // 未连接
  | 'connecting'      // 连接中
  | 'initializing'    // 初始化中
  | 'connected'       // 已连接
  | 'error'           // 错误状态
  | 'reconnecting';   // 重连中

/** MCP 连接状态详情 */
export interface MCPConnectionStatus {
  /** 服务器 ID */
  serverId: string;
  /** 当前状态 */
  state: MCPConnectionState;
  /** 最后连接时间 */
  lastConnectedAt: string | undefined;
  /** 断开时间 */
  disconnectedAt: string | undefined;
  /** 错误信息 */
  error: string | undefined;
  /** 重试次数 */
  retryCount: number;
  /** 已注册工具数量 */
  toolCount: number;
  /** 已注册资源数量 */
  resourceCount: number;
  /** 协议版本 */
  protocolVersion: string | undefined;
}

// ============================================================================
// MCP 工具包装器
// ============================================================================

/** 内部工具格式 (与现有 Tool 系统兼容) */
export interface MCPWrappedTool {
  /** 工具唯一 ID */
  id: UUID;
  /** 来源服务器 ID */
  serverId: string;
  /** MCP 工具定义 */
  mcpTool: MCPTool;
  /** 本地包装后的执行函数 */
  execute: (args: Record<string, unknown>) => Promise<MCPToolCallResult>;
  /** 置信度 */
  confidence: number;
  /** 使用统计 */
  stats: {
    callCount: number;
    successCount: number;
    failureCount: number;
    lastUsedAt: string | undefined;
    averageResponseTime: number;
  };
}

// ============================================================================
// MCP 发现结果
// ============================================================================

/** 发现的服务器 */
export interface MCPDiscoveredServer {
  /** 服务器 ID */
  id: string;
  /** 发现方式 */
  discoveryMethod: 'local-scan' | 'registry' | 'manual' | 'network';
  /** 配置信息 */
  config: MCPServerConfig;
  /** 发现时间 */
  discoveredAt: Timestamp;
  /** 是否已验证可用 */
  verified: boolean;
  /** 验证时间 */
  verifiedAt: string | undefined;
}

/** MCP 发现报告 */
export interface MCPDiscoveryReport {
  /** 扫描时间 */
  scanTime: Timestamp;
  /** 发现的服务器数量 */
  discoveredCount: number;
  /** 新发现的服务器 */
  newServers: MCPDiscoveredServer[];
  /** 已移除的服务器 */
  removedServers: string[];
  /** 扫描路径 */
  scannedPaths: string[];
  /** 扫描的注册表 */
  scannedRegistries: string[];
}

// ============================================================================
// MCP 事件
// ============================================================================

/** MCP 事件类型 */
export type MCPEventType = 
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'tools-changed'
  | 'resources-changed'
  | 'prompts-changed'
  | 'tool-called'
  | 'tool-succeeded'
  | 'tool-failed';

/** MCP 事件 */
export interface MCPEvent {
  type: MCPEventType;
  serverId: string;
  timestamp: Timestamp;
  data: unknown | undefined;
}

/** MCP 事件处理器 */
export type MCPEventHandler = (event: MCPEvent) => void | Promise<void>;

// ============================================================================
// MCP 客户端选项
// ============================================================================

/** MCP 客户端选项 */
export interface MCPClientOptions {
  /** 调试模式 */
  debug: boolean | undefined;
  /** 连接超时 (毫秒) */
  connectTimeout: number | undefined;
  /** 请求超时 (毫秒) */
  requestTimeout: number | undefined;
}

/** MCP 工具管理器选项 */
export interface MCPToolManagerOptions {
  /** 调试模式 */
  debug: boolean | undefined;
  /** 自动连接 */
  autoConnect: boolean | undefined;
  /** 启用发现 */
  enableDiscovery: boolean | undefined;
}

/** MCP 集成选项 */
export interface MCPIntegrationOptions {
  /** 自动注册 MCP 工具到 ToolSet */
  autoRegister: boolean | undefined;
  /** 工具名称前缀 */
  toolPrefix: string | undefined;
  /** 是否覆盖同名工具 */
  overrideExisting: boolean | undefined;
}
