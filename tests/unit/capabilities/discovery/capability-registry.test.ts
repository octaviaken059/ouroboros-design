/**
 * @file tests/unit/capabilities/discovery/capability-registry.test.ts
 * @description 能力注册表测试
 * @author Ouroboros
 * @date 2026-02-19
 */

import { CapabilityRegistry } from '@/capabilities/discovery/capability-registry';
import type { Capability } from '@/capabilities/discovery/capability-registry';

// Mock logger
jest.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

describe('CapabilityRegistry', () => {
  let registry: CapabilityRegistry;

  beforeEach(() => {
    registry = new CapabilityRegistry();
  });

  afterEach(() => {
    registry.clear();
    jest.clearAllMocks();
  });

  const mockCapability: Omit<Capability, 'id' | 'registeredAt' | 'updatedAt' | 'stats'> = {
    name: 'test.tool',
    displayName: 'Test Tool',
    type: 'system-tool',
    description: 'A test tool',
    source: { type: 'system', id: 'test', name: 'Test' },
    tags: ['test'],
    category: 'test',
    confidence: 0.8,
    available: true,
    metadata: {},
  };

  describe('Registration', () => {
    it('should register a capability', () => {
      const capability = registry.register(mockCapability);

      expect(capability.id).toBeDefined();
      expect(capability.name).toBe('test.tool');
      expect(capability.stats.callCount).toBe(0);
      expect(capability.registeredAt).toBeDefined();
      expect(capability.updatedAt).toBeDefined();
    });

    it('should throw when max capabilities reached', () => {
      const limitedRegistry = new CapabilityRegistry({ maxCapabilities: 2 });
      
      limitedRegistry.register(mockCapability);
      limitedRegistry.register({ ...mockCapability, name: 'test2' });
      
      expect(() => {
        limitedRegistry.register({ ...mockCapability, name: 'test3' });
      }).toThrow('Maximum capability limit (2) reached');
    });

    it('should emit registered event', (done) => {
      registry.on('registered', (cap) => {
        expect(cap.name).toBe('test.tool');
        done();
      });

      registry.register(mockCapability);
    });
  });

  describe('Update', () => {
    it('should update existing capability', () => {
      const registered = registry.register(mockCapability);
      
      const updated = registry.update(registered.id, {
        description: 'Updated description',
        confidence: 0.9,
      });

      expect(updated.description).toBe('Updated description');
      expect(updated.confidence).toBe(0.9);
      expect(updated.id).toBe(registered.id);
    });

    it('should throw when updating non-existent capability', () => {
      expect(() => {
        registry.update('non-existent-id', { confidence: 0.9 });
      }).toThrow("Capability with id 'non-existent-id' not found");
    });

    it('should emit updated event', (done) => {
      const registered = registry.register(mockCapability);
      
      registry.on('updated', (cap) => {
        expect(cap.name).toBe('test.tool');
        done();
      });

      registry.update(registered.id, { confidence: 0.9 });
    });
  });

  describe('Retrieval', () => {
    beforeEach(() => {
      registry.register(mockCapability);
      registry.register({
        ...mockCapability,
        name: 'test.tool2',
        type: 'mcp-tool',
        category: 'development',
        tags: ['test', 'mcp'],
      });
    });

    it('should get capability by id', () => {
      const all = registry.getAll();
      const first = all[0];
      
      const found = registry.get(first.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(first.id);
    });

    it('should get capability by name', () => {
      const found = registry.getByName('test.tool');
      expect(found).toBeDefined();
      expect(found?.name).toBe('test.tool');
    });

    it('should return undefined for non-existent capability', () => {
      expect(registry.get('non-existent')).toBeUndefined();
      expect(registry.getByName('non-existent')).toBeUndefined();
    });

    it('should get all capabilities', () => {
      const all = registry.getAll();
      expect(all).toHaveLength(2);
    });

    it('should get by type', () => {
      const systemTools = registry.getByType('system-tool');
      expect(systemTools).toHaveLength(1);
      expect(systemTools[0].name).toBe('test.tool');

      const mcpTools = registry.getByType('mcp-tool');
      expect(mcpTools).toHaveLength(1);
    });

    it('should get by tag', () => {
      const testTools = registry.getByTag('test');
      expect(testTools.length).toBeGreaterThanOrEqual(1);

      const mcpTools = registry.getByTag('mcp');
      expect(mcpTools).toHaveLength(1);
    });

    it('should search capabilities', () => {
      const results = registry.search('test');
      expect(results.length).toBeGreaterThanOrEqual(1);

      const noResults = registry.search('nonexistentxyz');
      expect(noResults).toHaveLength(0);
    });

    it('should get by confidence', () => {
      const highConfidence = registry.getByConfidence(0.7);
      expect(highConfidence.length).toBeGreaterThanOrEqual(1);

      const veryHigh = registry.getByConfidence(0.95);
      expect(veryHigh).toHaveLength(0);
    });

    it('should get available capabilities', () => {
      const available = registry.getAvailable();
      expect(available.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Usage Recording', () => {
    it('should record successful usage', () => {
      const registered = registry.register(mockCapability);
      
      registry.recordUsage(registered.id, true, 100);
      
      const updated = registry.get(registered.id)!;
      expect(updated.stats.callCount).toBe(1);
      expect(updated.stats.successCount).toBe(1);
      expect(updated.stats.averageResponseTime).toBe(100);
      expect(updated.confidence).toBeGreaterThan(0.8); // Should increase
    });

    it('should record failed usage', () => {
      const registered = registry.register(mockCapability);
      
      registry.recordUsage(registered.id, false, 50);
      
      const updated = registry.get(registered.id)!;
      expect(updated.stats.callCount).toBe(1);
      expect(updated.stats.failureCount).toBe(1);
      expect(updated.confidence).toBeLessThan(0.8); // Should decrease
    });

    it('should calculate average response time', () => {
      const registered = registry.register(mockCapability);
      
      registry.recordUsage(registered.id, true, 100);
      registry.recordUsage(registered.id, true, 200);
      
      const updated = registry.get(registered.id)!;
      expect(updated.stats.averageResponseTime).toBe(150);
    });
  });

  describe('Stats', () => {
    beforeEach(() => {
      registry.register(mockCapability);
      registry.register({
        ...mockCapability,
        name: 'test2',
        type: 'mcp-tool',
      });
    });

    it('should get stats', () => {
      const stats = registry.getStats();
      
      expect(stats.total).toBe(2);
      expect(stats.available).toBe(2);
      expect(stats.byType['system-tool']).toBe(1);
      expect(stats.byType['mcp-tool']).toBe(1);
    });
  });

  describe('Unregistration', () => {
    it('should unregister capability', () => {
      const registered = registry.register(mockCapability);
      
      const result = registry.unregister(registered.id);
      expect(result).toBe(true);
      expect(registry.get(registered.id)).toBeUndefined();
    });

    it('should return false for non-existent capability', () => {
      expect(registry.unregister('non-existent')).toBe(false);
    });

    it('should emit unregistered event', (done) => {
      const registered = registry.register(mockCapability);
      
      registry.on('unregistered', (cap) => {
        expect(cap.id).toBe(registered.id);
        done();
      });

      registry.unregister(registered.id);
    });
  });

  describe('Clear', () => {
    it('should clear all capabilities', () => {
      registry.register(mockCapability);
      registry.register({ ...mockCapability, name: 'test2' });
      
      registry.clear();
      
      expect(registry.getAll()).toHaveLength(0);
    });

    it('should emit cleared event', (done) => {
      registry.register(mockCapability);
      
      registry.on('cleared', () => {
        done();
      });

      registry.clear();
    });
  });
});
