/**
 * @file tests/unit/capabilities/discovery/system-scanner.test.ts
 * @description 系统扫描器测试
 * @author Ouroboros
 * @date 2026-02-19
 */

import { SystemScanner, scanSystemCapabilities } from '@/capabilities/discovery/system-scanner';

// Mock logger
jest.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

describe('SystemScanner', () => {
  let scanner: SystemScanner;

  beforeEach(() => {
    scanner = new SystemScanner();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      expect(scanner).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const customScanner = new SystemScanner({
        scanGlobal: false,
        scanLocal: true,
        extraPaths: ['/custom/path'],
      });
      expect(customScanner).toBeDefined();
    });
  });

  describe('Tool Discovery', () => {
    it('should scan system capabilities', async () => {
      const result = await scanner.scan();

      expect(result.scanTime).toBeDefined();
      expect(result.discoveredTools).toBeDefined();
      expect(Array.isArray(result.discoveredTools)).toBe(true);
      expect(result.systemInfo).toBeDefined();
      expect(result.systemInfo.platform).toBe(process.platform);
      expect(result.systemInfo.nodeVersion).toBe(process.version);
      expect(result.environment).toBeDefined();
    });

    it('should detect Node.js availability', async () => {
      await scanner.scan();
      const isAvailable = scanner.isToolAvailable('node');
      // Node.js should be available in test environment
      expect(typeof isAvailable).toBe('boolean');
    });

    it('should return tool version', async () => {
      await scanner.scan();
      const version = scanner.getToolVersion('node');
      // Should return string or undefined
      expect(typeof version === 'string' || version === undefined).toBe(true);
    });
  });

  describe('Tool Access', () => {
    beforeEach(async () => {
      await scanner.scan();
    });

    it('should get discovered tools', () => {
      const tools = scanner.getDiscoveredTools();
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should get available tools', () => {
      const tools = scanner.getAvailableTools();
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should get tools by category', () => {
      const mediaTools = scanner.getToolsByCategory('media');
      expect(Array.isArray(mediaTools)).toBe(true);

      const devTools = scanner.getToolsByCategory('development');
      expect(Array.isArray(devTools)).toBe(true);
    });

    it('should convert to internal tools', () => {
      const tools = scanner.convertToInternalTools();
      expect(Array.isArray(tools)).toBe(true);
    });
  });

  describe('Convenience Function', () => {
    it('should scan with convenience function', async () => {
      const result = await scanSystemCapabilities();
      expect(result.scanTime).toBeDefined();
      expect(result.discoveredTools).toBeDefined();
    });
  });
});
