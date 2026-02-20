/**
 * @file tests/unit/adapters/mcp/tool-manager.test.ts
 * @description MCP 工具管理器测试
 * @author Ouroboros
 * @date 2026-02-19
 */

import { MCPToolManager } from '@/adapters/mcp/tool-manager';
import type { MCPConfig, MCPServerConfig } from '@/types/mcp';

// Mock dependencies
jest.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

describe('MCPToolManager', () => {
  const mockConfig: MCPConfig = {
    servers: [
      {
        id: 'server1',
        name: 'Server 1',
        description: undefined,
        transport: 'stdio',
        connection: { command: 'node', args: ['server1.js'], env: undefined, url: undefined, headers: undefined, timeout: undefined },
        autoConnect: false,
        reconnect: { enabled: true, maxRetries: 3, interval: 1000, backoffMultiplier: 2 },
        capabilities: undefined,
      },
    ],
    globalReconnect: undefined,
    discovery: undefined,
    cache: undefined,
  };

  let manager: MCPToolManager;

  beforeEach(() => {
    manager = new MCPToolManager(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with config', () => {
      expect(manager).toBeDefined();
    });

    it('should get config', () => {
      const config = manager.getConfig();
      expect(config.servers).toHaveLength(1);
      expect(config.servers[0].id).toBe('server1');
    });
  });

  describe('Server Management', () => {
    it('should add server', async () => {
      const newServer: MCPServerConfig = {
        id: 'server2',
        name: 'Server 2',
        description: undefined,
        transport: 'stdio',
        connection: { command: 'node', args: ['server2.js'], env: undefined, url: undefined, headers: undefined, timeout: undefined },
        autoConnect: false,
        reconnect: { enabled: true, maxRetries: 3, interval: 1000, backoffMultiplier: 2 },
        capabilities: undefined,
      };

      await manager.addServer(newServer);
      const config = manager.getConfig();
      expect(config.servers).toHaveLength(2);
    });

    it('should throw when adding duplicate server', async () => {
      await expect(manager.addServer(mockConfig.servers[0])).rejects.toThrow(
        "Server with id 'server1' already exists"
      );
    });

    it('should remove server', async () => {
      await manager.removeServer('server1');
      expect(manager.getConfig().servers).toHaveLength(0);
    });

    it('should throw when removing non-existent server', async () => {
      await expect(manager.removeServer('non-existent')).rejects.toThrow(
        "Server 'non-existent' not found"
      );
    });
  });

  describe('Tool Management', () => {
    it('should return empty tools initially', () => {
      expect(manager.getAllTools()).toEqual([]);
    });

    it('should return tool stats', () => {
      const stats = manager.getToolStats();
      expect(stats.totalTools).toBe(0);
      expect(stats.totalCalls).toBe(0);
      expect(stats.totalSuccesses).toBe(0);
      expect(stats.totalFailures).toBe(0);
    });

    it('should convert to internal tools', () => {
      const tools = manager.convertToInternalTools();
      expect(tools).toEqual([]);
    });
  });

  describe('Discovery', () => {
    it('should run discovery', async () => {
      const configWithDiscovery: MCPConfig = {
        ...mockConfig,
        discovery: {
          enabled: true,
          scanInterval: 60000,
          localPaths: undefined,
          registries: undefined,
        },
      };

      const managerWithDiscovery = new MCPToolManager(configWithDiscovery);
      const report = await managerWithDiscovery.runDiscovery();

      expect(report.scanTime).toBeDefined();
      expect(report.discoveredCount).toBe(0);
      expect(report.newServers).toEqual([]);
    });

    it('should return discovered servers', () => {
      const servers = manager.getDiscoveredServers();
      expect(servers).toEqual([]);
    });
  });

  describe('Status', () => {
    it('should return all server statuses', () => {
      const statuses = manager.getAllServerStatuses();
      expect(statuses).toHaveLength(1);
      expect(statuses[0].serverId).toBe('server1');
    });

    it('should return specific server status', () => {
      const status = manager.getServerStatus('server1');
      expect(status).toBeDefined();
      expect(status?.serverId).toBe('server1');
    });

    it('should return undefined for non-existent server', () => {
      const status = manager.getServerStatus('non-existent');
      expect(status).toBeUndefined();
    });
  });

  describe('Event Handling', () => {
    it('should emit events', (done) => {
      manager.on('mcp-event', (event) => {
        expect(event.serverId).toBe('server1');
        done();
      });

      // Trigger event through addServer
      const newServer: MCPServerConfig = {
        id: 'server3',
        name: 'Server 3',
        description: undefined,
        transport: 'stdio',
        connection: { command: 'node', args: ['server3.js'], env: undefined, url: undefined, headers: undefined, timeout: undefined },
        autoConnect: false,
        reconnect: { enabled: true, maxRetries: 3, interval: 1000, backoffMultiplier: 2 },
        capabilities: undefined,
      };

      manager.addServer(newServer).catch(() => {});
    });
  });
});
