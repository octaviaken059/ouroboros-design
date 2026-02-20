/**
 * @file adapters/index.ts
 * @description 适配器模块入口
 * @author Ouroboros
 * @date 2026-02-19
 */

// MCP 适配器
export {
  // 传输层
  BaseTransport,
  StdioTransport,
  SSETransport,
  HTTPTransport,
  TransportFactory,
  type ITransport,
  type TransportConfig,
  
  // 客户端
  MCPClient,
  type MCPClientOptions,
  
  // 工具管理
  MCPToolManager,
  type MCPToolManagerOptions,
  
  // 集成
  MCPToolSetIntegration,
  createMCPIntegration,
  type MCPIntegrationOptions,
} from './mcp';

// 注意: web适配器暂未实现
// export * from './web';
