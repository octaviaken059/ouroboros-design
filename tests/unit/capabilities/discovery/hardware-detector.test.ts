/**
 * @file tests/unit/capabilities/discovery/hardware-detector.test.ts
 * @description 硬件检测器测试
 * @author Ouroboros
 * @date 2026-02-19
 */

import { HardwareDetector, detectHardware } from '@/capabilities/discovery/hardware-detector';

// Mock logger
jest.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

describe('HardwareDetector', () => {
  let detector: HardwareDetector;

  beforeEach(() => {
    detector = new HardwareDetector();
  });

  afterEach(() => {
    detector.stopMonitoring();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize', () => {
      expect(detector).toBeDefined();
    });
  });

  describe('Hardware Detection', () => {
    it('should detect hardware info', async () => {
      const info = await detector.getHardwareInfo();

      expect(info.timestamp).toBeDefined();
      expect(info.cpu).toBeDefined();
      expect(info.cpu.cores).toBeGreaterThan(0);
      expect(info.memory).toBeDefined();
      expect(info.memory.total).toBeGreaterThan(0);
      expect(info.storage).toBeDefined();
      expect(Array.isArray(info.storage)).toBe(true);
      expect(info.network).toBeDefined();
      expect(Array.isArray(info.network)).toBe(true);
    });

    it('should detect CPU info', async () => {
      const info = await detector.getHardwareInfo();
      
      expect(info.cpu.model).toBeDefined();
      expect(info.cpu.cores).toBeGreaterThan(0);
      expect(info.cpu.architecture).toBe(process.arch);
    });

    it('should detect memory info', async () => {
      const info = await detector.getHardwareInfo();
      
      expect(info.memory.total).toBeGreaterThan(0);
      expect(info.memory.available).toBeGreaterThanOrEqual(0);
      expect(info.memory.used).toBeGreaterThanOrEqual(0);
      expect(info.memory.used).toBeLessThanOrEqual(info.memory.total);
    });

    it('should detect network interfaces', async () => {
      const info = await detector.getHardwareInfo();
      
      expect(Array.isArray(info.network)).toBe(true);
      
      if (info.network.length > 0) {
        const iface = info.network[0];
        expect(iface.name).toBeDefined();
        expect(iface.type).toBeDefined();
        expect(iface.status).toBeDefined();
      }
    });
  });

  describe('GPU Detection', () => {
    it('should check GPU availability', async () => {
      await detector.getHardwareInfo();
      const hasGPU = detector.hasGPU();
      expect(typeof hasGPU).toBe('boolean');
    });

    it('should get GPU list', async () => {
      await detector.getHardwareInfo();
      const gpus = detector.getGPUs();
      expect(Array.isArray(gpus)).toBe(true);
    });
  });

  describe('Storage Info', () => {
    it('should calculate available storage', async () => {
      await detector.getHardwareInfo();
      const available = detector.getAvailableStorage();
      expect(typeof available).toBe('number');
      expect(available).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Monitoring', () => {
    it('should start monitoring', () => {
      detector.startMonitoring(1000);
      // Should not throw
    });

    it('should stop monitoring', () => {
      detector.startMonitoring(1000);
      detector.stopMonitoring();
      // Should not throw
    });

    it('should not start monitoring twice', () => {
      detector.startMonitoring(1000);
      detector.startMonitoring(1000); // Second call should be ignored
      // Should not throw
    });
  });

  describe('Convenience Function', () => {
    it('should detect hardware with convenience function', async () => {
      const info = await detectHardware();
      expect(info.timestamp).toBeDefined();
      expect(info.cpu).toBeDefined();
    });
  });
});
