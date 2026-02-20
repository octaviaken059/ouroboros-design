/**
 * @file tests/unit/capabilities/loader/capability-selector.test.ts
 * @description 能力选择器测试
 * @author Ouroboros
 * @date 2026-02-19
 */

import { CapabilitySelector } from '@/capabilities/loader/capability-selector';
import { CapabilityRegistry } from '@/capabilities/discovery/capability-registry';
import type { RecognizedIntent } from '@/capabilities/intent';

// Mock logger
jest.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

describe('CapabilitySelector', () => {
  let registry: CapabilityRegistry;
  let selector: CapabilitySelector;

  beforeEach(() => {
    registry = new CapabilityRegistry();
    selector = new CapabilitySelector(registry);

    // Register test capabilities
    registry.register({
      name: 'code.linter',
      displayName: 'Code Linter',
      type: 'system-tool',
      description: 'Lint code files',
      source: { type: 'system', id: 'test', name: 'Test' },
      tags: ['code', 'development', 'linting'],
      category: 'development',
      confidence: 0.9,
      available: true,
      metadata: {},
    });

    registry.register({
      name: 'code.formatter',
      displayName: 'Code Formatter',
      type: 'system-tool',
      description: 'Format code files',
      source: { type: 'system', id: 'test', name: 'Test' },
      tags: ['code', 'development', 'formatting'],
      category: 'development',
      confidence: 0.8,
      available: true,
      metadata: {},
    });

    registry.register({
      name: 'search.web',
      displayName: 'Web Search',
      type: 'api-service',
      description: 'Search the web',
      source: { type: 'system', id: 'test', name: 'Test' },
      tags: ['search', 'web', 'information'],
      category: 'search',
      confidence: 0.7,
      available: true,
      metadata: {},
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Selection', () => {
    it('should select capabilities for code intent', () => {
      const intent: RecognizedIntent = {
        primary: 'code',
        confidence: 0.9,
        entities: [],
        keywords: ['code', 'development'],
        requiredCapabilities: ['code-generation'],
        rawInput: 'Write code',
      };

      const selected = selector.selectForIntent(intent);

      expect(selected.primary.length).toBeGreaterThan(0);
      expect(selected.reasoning).toContain('Intent: code');
      expect(selected.confidence).toBeGreaterThan(0);
    });

    it('should return secondary and fallback capabilities', () => {
      const intent: RecognizedIntent = {
        primary: 'search',
        confidence: 0.9,
        entities: [],
        keywords: ['search', 'web'],
        requiredCapabilities: ['web-search'],
        rawInput: 'Search web',
      };

      const selected = selector.selectForIntent(intent);

      expect(selected.primary).toBeDefined();
      expect(selected.secondary).toBeDefined();
      expect(selected.fallback).toBeDefined();
    });

    it('should select best capability', () => {
      const intent: RecognizedIntent = {
        primary: 'code',
        confidence: 0.9,
        entities: [],
        keywords: ['code'],
        requiredCapabilities: [],
        rawInput: 'Code something',
      };

      const best = selector.selectBest(intent);

      expect(best).toBeDefined();
    });

    it('should select best by type', () => {
      const intent: RecognizedIntent = {
        primary: 'code',
        confidence: 0.9,
        entities: [],
        keywords: ['code'],
        requiredCapabilities: [],
        rawInput: 'Code something',
      };

      const best = selector.selectBest(intent, 'system-tool');

      expect(best).toBeDefined();
      expect(best?.type).toBe('system-tool');
    });
  });

  describe('Selection by Names', () => {
    it('should select capabilities by names', () => {
      const selected = selector.selectByNames(['code.linter', 'code.formatter']);

      expect(selected).toHaveLength(2);
      expect(selected.map(c => c.name)).toContain('code.linter');
      expect(selected.map(c => c.name)).toContain('code.formatter');
    });

    it('should filter unavailable capabilities', () => {
      registry.register({
        name: 'unavailable.tool',
        displayName: 'Unavailable',
        type: 'system-tool',
        description: 'Not available',
        source: { type: 'system', id: 'test', name: 'Test' },
        tags: [],
        category: 'test',
        confidence: 0.5,
        available: false,
        metadata: {},
      });

      const selected = selector.selectByNames(['unavailable.tool']);

      expect(selected).toHaveLength(0);
    });
  });

  describe('Selection by Type', () => {
    it('should select by type', () => {
      const selected = selector.selectByType('system-tool');

      expect(selected.length).toBeGreaterThan(0);
      expect(selected.every(c => c.type === 'system-tool')).toBe(true);
    });

    it('should sort by confidence', () => {
      const selected = selector.selectByType('system-tool');

      for (let i = 1; i < selected.length; i++) {
        expect(selected[i - 1].confidence).toBeGreaterThanOrEqual(selected[i].confidence);
      }
    });
  });

  describe('Options', () => {
    it('should update options', () => {
      selector.updateOptions({ maxCapabilities: 5 });

      const intent: RecognizedIntent = {
        primary: 'code',
        confidence: 0.9,
        entities: [],
        keywords: ['code'],
        requiredCapabilities: [],
        rawInput: 'Code',
      };

      const selected = selector.selectForIntent(intent);
      const total = selected.primary.length + selected.secondary.length + selected.fallback.length;

      expect(total).toBeLessThanOrEqual(5);
    });
  });
});
