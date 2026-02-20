/**
 * @file tests/unit/evolution/skill-learning/skill-extractor.test.ts
 * @description 技能提取器测试
 * @author Ouroboros
 * @date 2026-02-19
 */

import { SkillExtractor } from '@/evolution/skill-learning/skill-extractor';
import type { ExecutionRecord } from '@/evolution/skill-learning/skill-extractor';

// Mock logger
jest.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

describe('SkillExtractor', () => {
  let extractor: SkillExtractor;

  beforeEach(() => {
    extractor = new SkillExtractor();
  });

  afterEach(() => {
    extractor.clearPatterns();
    jest.clearAllMocks();
  });

  const createMockRecord = (
    id: string,
    intent: string,
    toolSequence: string[],
    success = true
  ): ExecutionRecord => ({
    id,
    task: `Task ${id}`,
    intent,
    toolSequence: toolSequence.map((tool, i) => ({
      tool,
      args: { input: `arg${i}` },
      result: `result${i}`,
      success: true,
      duration: 100,
    })),
    finalResult: 'success',
    success,
    timestamp: new Date().toISOString(),
  });

  describe('Pattern Extraction', () => {
    it('should extract patterns from successful records', () => {
      const records: ExecutionRecord[] = [
        createMockRecord('1', 'code', ['tool1', 'tool2']),
        createMockRecord('2', 'code', ['tool1', 'tool2']),
        createMockRecord('3', 'code', ['tool1', 'tool2']),
      ];

      const patterns = extractor.extractSkills(records);

      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should not extract patterns from failed records', () => {
      const records: ExecutionRecord[] = [
        createMockRecord('1', 'code', ['tool1'], false),
        createMockRecord('2', 'code', ['tool1'], false),
        createMockRecord('3', 'code', ['tool1'], false),
      ];

      const patterns = extractor.extractSkills(records);

      expect(patterns.length).toBe(0);
    });

    it('should group records by intent', () => {
      const records: ExecutionRecord[] = [
        createMockRecord('1', 'code', ['lint', 'format']),
        createMockRecord('2', 'code', ['lint', 'format']),
        createMockRecord('3', 'code', ['lint', 'format']),
        createMockRecord('4', 'search', ['query', 'fetch']),
        createMockRecord('5', 'search', ['query', 'fetch']),
        createMockRecord('6', 'search', ['query', 'fetch']),
      ];

      const patterns = extractor.extractSkills(records);

      // Should have patterns for both intents
      const codePatterns = patterns.filter(p => p.applicableIntents.includes('code'));
      const searchPatterns = patterns.filter(p => p.applicableIntents.includes('search'));

      expect(codePatterns.length).toBeGreaterThan(0);
      expect(searchPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('Pattern Validation', () => {
    it('should validate minimum success rate', () => {
      const strictExtractor = new SkillExtractor({ minSuccessRate: 0.9 });

      const records: ExecutionRecord[] = [
        createMockRecord('1', 'code', ['tool1']),
        createMockRecord('2', 'code', ['tool1']),
        { ...createMockRecord('3', 'code', ['tool1']), success: false },
      ];

      const patterns = strictExtractor.extractSkills(records);
      expect(patterns.length).toBe(0);
    });

    it('should validate minimum success count', () => {
      const strictExtractor = new SkillExtractor({ minSuccessCount: 5 });

      const records: ExecutionRecord[] = [
        createMockRecord('1', 'code', ['tool1']),
        createMockRecord('2', 'code', ['tool1']),
      ];

      const patterns = strictExtractor.extractSkills(records);
      expect(patterns.length).toBe(0);
    });

    it('should validate maximum sequence length', () => {
      const strictExtractor = new SkillExtractor({ maxSequenceLength: 2 });

      const records: ExecutionRecord[] = [
        createMockRecord('1', 'code', ['t1', 't2', 't3', 't4', 't5']),
        createMockRecord('2', 'code', ['t1', 't2', 't3', 't4', 't5']),
        createMockRecord('3', 'code', ['t1', 't2', 't3', 't4', 't5']),
      ];

      const patterns = strictExtractor.extractSkills(records);
      expect(patterns.length).toBe(0);
    });
  });

  describe('Pattern Properties', () => {
    it('should generate pattern with correct properties', () => {
      const records: ExecutionRecord[] = [
        createMockRecord('1', 'code', ['lint', 'format']),
        createMockRecord('2', 'code', ['lint', 'format']),
        createMockRecord('3', 'code', ['lint', 'format']),
      ];

      const patterns = extractor.extractSkills(records);

      expect(patterns.length).toBeGreaterThan(0);
      
      const pattern = patterns[0];
      expect(pattern.id).toBeDefined();
      expect(pattern.name).toBeDefined();
      expect(pattern.description).toBeDefined();
      expect(pattern.applicableIntents).toContain('code');
      expect(pattern.toolSequence).toHaveLength(2);
      expect(pattern.successCount).toBe(3);
      expect(pattern.confidence).toBe(1);
      expect(pattern.extractedAt).toBeDefined();
    });

    it('should create tool sequence correctly', () => {
      const records: ExecutionRecord[] = [
        createMockRecord('1', 'code', ['step1', 'step2']),
        createMockRecord('2', 'code', ['step1', 'step2']),
        createMockRecord('3', 'code', ['step1', 'step2']),
      ];

      const patterns = extractor.extractSkills(records);

      expect(patterns[0].toolSequence[0].tool).toBe('step1');
      expect(patterns[0].toolSequence[1].tool).toBe('step2');
    });
  });

  describe('Pattern Merging', () => {
    it('should merge similar patterns', () => {
      const records: ExecutionRecord[] = [
        createMockRecord('1', 'code', ['tool1']),
        createMockRecord('2', 'code', ['tool1']),
        createMockRecord('3', 'code', ['tool1']),
        createMockRecord('4', 'code', ['tool1']),
        createMockRecord('5', 'code', ['tool1']),
        createMockRecord('6', 'code', ['tool1']),
      ];

      const patterns = extractor.extractSkills(records);

      // Similar patterns should be merged
      expect(patterns.length).toBe(1);
      expect(patterns[0].successCount).toBe(6);
    });
  });

  describe('Pattern Queries', () => {
    beforeEach(() => {
      const records: ExecutionRecord[] = [
        createMockRecord('1', 'code', ['lint', 'format']),
        createMockRecord('2', 'code', ['lint', 'format']),
        createMockRecord('3', 'code', ['lint', 'format']),
        createMockRecord('4', 'search', ['query', 'fetch']),
        createMockRecord('5', 'search', ['query', 'fetch']),
        createMockRecord('6', 'search', ['query', 'fetch']),
      ];
      extractor.extractSkills(records);
    });

    it('should get all patterns', () => {
      const patterns = extractor.getPatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should get patterns for intent', () => {
      const codePatterns = extractor.getPatternsForIntent('code');
      const searchPatterns = extractor.getPatternsForIntent('search');

      expect(codePatterns.length).toBeGreaterThan(0);
      expect(searchPatterns.length).toBeGreaterThan(0);
    });

    it('should get high confidence patterns', () => {
      const patterns = extractor.getHighConfidencePatterns(0.9);
      expect(patterns.every(p => p.confidence >= 0.9)).toBe(true);
    });
  });

  describe('Pattern Management', () => {
    it('should delete pattern', () => {
      const records: ExecutionRecord[] = [
        createMockRecord('1', 'code', ['tool1']),
        createMockRecord('2', 'code', ['tool1']),
        createMockRecord('3', 'code', ['tool1']),
      ];

      const patterns = extractor.extractSkills(records);
      const patternId = patterns[0].id;

      const result = extractor.deletePattern(patternId);
      expect(result).toBe(true);

      expect(extractor.getPatterns().every(p => p.id !== patternId)).toBe(true);
    });

    it('should return false when deleting non-existent pattern', () => {
      expect(extractor.deletePattern('non-existent')).toBe(false);
    });

    it('should clear all patterns', () => {
      const records: ExecutionRecord[] = [
        createMockRecord('1', 'code', ['tool1']),
        createMockRecord('2', 'code', ['tool1']),
        createMockRecord('3', 'code', ['tool1']),
      ];

      extractor.extractSkills(records);
      expect(extractor.getPatterns().length).toBeGreaterThan(0);

      extractor.clearPatterns();
      expect(extractor.getPatterns()).toHaveLength(0);
    });
  });
});
