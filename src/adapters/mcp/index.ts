/**
 * @file adapters/mcp/index.ts
 * @description MCP 模块入口
 * @author Ouroboros
 * @date 2026-02-19
 */

// 导出传输层
export {
  BaseTransport,
  StdioTransport,
  SSETransport,
  HTTPTransport,
  TransportFactory,
  type ITransport,
  type TransportConfig,
} from './transport';

// 导出客户端
export { MCPClient, type MCPClientOptions } from './client';

// 导出工具管理器
export { MCPToolManager, type MCPToolManagerOptions } from './tool-manager';

// 导出集成功能
export {
  MCPToolSetIntegration,
  createMCPIntegration,
  type MCPIntegrationOptions,
} from './toolset-integration';

// 默认导出工具管理器
export { MCPToolManager as default } from './tool-manager';
