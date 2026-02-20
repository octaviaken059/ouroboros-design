/**
 * @file tests/unit/adapters/mcp/client.test.ts
 * @description MCP 客户端测试
 * @author Ouroboros
 * @date 2026-02-19
 */

import { MCPClient } from '@/adapters/mcp/client';
import type { MCPServerConfig } from '@/types/mcp';

// Mock dependencies
jest.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

describe('MCPClient', () => {
  const mockConfig: MCPServerConfig = {
    id: 'test-server',
    name: 'Test Server',
    description: undefined,
    transport: 'stdio',
    connection: {
      command: 'node',
      args: ['server.js'],
      env: undefined,
      url: undefined,
      headers: undefined,
      timeout: undefined,
    },
    autoConnect: false,
    reconnect: {
      enabled: true,
      maxRetries: 3,
      interval: 1000,
      backoffMultiplier: 2,
    },
    capabilities: undefined,
  };

  let client: MCPClient;

  beforeEach(() => {
    client = new MCPClient(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct properties', () => {
      expect(client.serverId).toBe('test-server');
      expect(client.serverName).toBe('Test Server');
      expect(client.connectionState).toBe('disconnected');
      expect(client.isConnected).toBe(false);
    });

    it('should return correct status', () => {
      const status = client.status;
      
      expect(status.serverId).toBe('test-server');
      expect(status.state).toBe('disconnected');
      expect(status.retryCount).toBe(0);
      expect(status.toolCount).toBe(0);
    });
  });

  describe('State Management', () => {
    it('should track connection state', () => {
      expect(client.connectionState).toBe('disconnected');
      
      // isConnected should reflect state
      expect(client.isConnected).toBe(false);
    });

    it('should return empty tools when disconnected', () => {
      expect(client.getTools()).toEqual([]);
      expect(client.getResources()).toEqual([]);
      expect(client.getPrompts()).toEqual([]);
    });
  });

  describe('Event Handling', () => {
    it('should emit events', (done) => {
      client.on('event', (event) => {
        expect(event.serverId).toBe('test-server');
        expect(event.type).toBe('test');
        done();
      });

      // Emit test event through internal method
      (client as any).emitEvent('test', { data: 'value' });
    });
  });

  describe('Error Handling', () => {
    it('should handle disconnect gracefully', async () => {
      // Disconnect when not connected should not throw
      await expect(client.disconnect()).resolves.not.toThrow();
    });

    it('should track error state', () => {
      // Simulate error
      (client as any).handleError(new Error('Test error'));
      
      expect(client.status.error).toBe('Test error');
    });
  });
});
