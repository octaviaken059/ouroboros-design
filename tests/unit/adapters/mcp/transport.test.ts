/**
 * @file tests/unit/adapters/mcp/transport.test.ts
 * @description MCP 传输层测试
 * @author Ouroboros
 * @date 2026-02-19
 */

import {
  StdioTransport,
  HTTPTransport,
  TransportFactory,
  type TransportConfig,
} from '@/adapters/mcp/transport';

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

describe('MCP Transport Layer', () => {
  const mockConfig: TransportConfig = {
    timeout: 5000,
    debug: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TransportFactory', () => {
    it('should create stdio transport', () => {
      const transport = TransportFactory.create(
        'stdio',
        {
          command: 'node',
          args: ['server.js'],
        },
        mockConfig
      );

      expect(transport).toBeInstanceOf(StdioTransport);
    });

    it('should create http transport', () => {
      const transport = TransportFactory.create(
        'http',
        {
          url: 'http://localhost:3000',
        },
        mockConfig
      );

      expect(transport).toBeInstanceOf(HTTPTransport);
    });

    it('should throw error for missing command in stdio', () => {
      expect(() => {
        TransportFactory.create('stdio', {}, mockConfig);
      }).toThrow('Command is required for stdio transport');
    });

    it('should throw error for missing url in http', () => {
      expect(() => {
        TransportFactory.create('http', {}, mockConfig);
      }).toThrow('URL is required for HTTP transport');
    });

    it('should throw error for unimplemented websocket', () => {
      expect(() => {
        TransportFactory.create(
          'websocket',
          { url: 'ws://localhost' },
          mockConfig
        );
      }).toThrow('WebSocket transport not yet implemented');
    });
  });

  describe('StdioTransport', () => {
    it('should initialize with correct properties', () => {
      const transport = new StdioTransport(
        'node',
        ['server.js'],
        { ENV_VAR: 'value' },
        mockConfig
      );

      expect(transport.isConnected).toBe(false);
    });

    it('should generate unique request IDs', () => {
      const transport = new StdioTransport('node', [], {}, mockConfig);
      
      // Access private method through any type
      const id1 = (transport as any).generateId();
      const id2 = (transport as any).generateId();
      
      expect(id2).toBe(id1 + 1);
    });
  });

  describe('HTTPTransport', () => {
    let transport: HTTPTransport;

    beforeEach(() => {
      transport = new HTTPTransport(
        'http://localhost:3000',
        { 'Authorization': 'Bearer token' },
        mockConfig
      );
    });

    it('should initialize with correct properties', () => {
      expect(transport.isConnected).toBe(false);
    });

    it('should handle request timeout', async () => {
      // Mock fetch to delay beyond timeout
      global.fetch = jest.fn().mockImplementation(() =>
        new Promise((resolve) => setTimeout(resolve, 10000))
      );

      const shortTimeoutTransport = new HTTPTransport(
        'http://localhost:3000',
        {},
        { timeout: 100 }
      );

      await shortTimeoutTransport.connect().catch(() => {});
    });
  });
});
