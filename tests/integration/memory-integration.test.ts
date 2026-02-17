/**
 * Memory System Integration Tests
 * 记忆系统集成测试 - 验证5层记忆架构完整流程
 */

import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { LayeredMemory } from '../../src/cognitive/memory';

describe('Memory System Integration', () => {
  let memory: LayeredMemory;

  beforeEach(() => {
    memory = new LayeredMemory({
      workingCapacity: 5,
      maxMemoryCount: 100,
      enableVectorization: false,
      embeddingProvider: 'none',
    });
  });

  afterEach(async () => {
    await memory.clear();
  });

  describe('Initialization', () => {
    it('should initialize with default config', async () => {
      const newMemory = new LayeredMemory();
      await newMemory.initialize();
      const stats = newMemory.getStats();
      expect(stats.total).toBe(0);
      await newMemory.clear();
    });

    it('should accept custom configuration', () => {
      const customMemory = new LayeredMemory({
        workingCapacity: 10,
        maxMemoryCount: 500,
        similarityThreshold: 0.8,
        enableVectorization: false,
      });
      const stats = customMemory.getStats();
      expect(stats.vectorizationActive).toBe(false);
    });
  });

  describe('Episodic Memory Lifecycle', () => {
    it('should complete full episodic memory flow', async () => {
      await memory.addEpisodic({
        type: 'episodic',
        content: 'User asked about weather in Tokyo',
        context: 'weather_query',
        outcome: 'Successfully provided forecast',
        importance: 0.8,
        emotionalWeight: 0.3,
        tags: ['weather', 'tokyo'],
      });

      const results = await memory.search('weather Tokyo', { limit: 5 });
      expect(results).toHaveLength(1);
      expect(results[0].entry.type).toBe('episodic');
      expect(results[0].entry.content).toContain('Tokyo');
      expect(results[0].score).toBeGreaterThan(0);
    });
  });

  describe('Semantic Memory Lifecycle', () => {
    it('should complete full semantic memory flow', async () => {
      await memory.addSemantic({
        type: 'semantic',
        content: 'Machine learning is a subset of AI',
        category: 'ai_knowledge',
        confidence: 0.95,
        sources: ['wikipedia'],
        importance: 0.9,
        emotionalWeight: 0.1,
        tags: ['ai', 'ml'],
      });

      const results = await memory.search('machine learning AI', { limit: 5 });
      expect(results).toHaveLength(1);
      expect(results[0].entry.type).toBe('semantic');
    });
  });

  describe('Procedural Memory Lifecycle', () => {
    it('should complete full procedural memory flow', async () => {
      await memory.addProcedural({
        type: 'procedural',
        content: 'Process user authentication request',
        skillName: 'user_auth',
        successRate: 0.95,
        executionCount: 100,
        parameters: { timeout: 5000 },
        importance: 0.85,
        emotionalWeight: 0.2,
        tags: ['auth', 'security'],
      });

      const results = await memory.search('authentication process', { limit: 5 });
      expect(results).toHaveLength(1);
      expect(results[0].entry.type).toBe('procedural');
    });
  });

  describe('Reflective Memory Lifecycle', () => {
    it('should complete full reflective memory flow', async () => {
      await memory.addReflective({
        type: 'reflective',
        content: 'I notice I often provide verbose responses',
        insight: 'Need to be more concise',
        biasDetected: ['verbosity_bias'],
        learningDirection: 'practice_concise',
        impact: 0.7,
        importance: 0.8,
        emotionalWeight: 0.4,
        tags: ['self_awareness'],
      });

      const results = await memory.search('concise responses', { limit: 5 });
      expect(results).toHaveLength(1);
      expect(results[0].entry.type).toBe('reflective');
    });
  });

  describe('Working Memory', () => {
    it('should manage working memory capacity', () => {
      for (let i = 0; i < 15; i++) {
        memory.addToWorking({
          id: `wm_${i}`,
          content: `Working memory ${i}`,
          timestamp: Date.now(),
          accessCount: 0,
          importance: 0.5,
          emotionalWeight: 0.3,
        });
      }

      const stats = memory.getStats();
      expect(stats.working).toBeLessThanOrEqual(7);
    });

    it('should recall with pattern matching', () => {
      memory.addToWorking({
        id: 'wm_1',
        content: 'Meeting with engineering team',
        timestamp: Date.now(),
        accessCount: 0,
        importance: 0.6,
        emotionalWeight: 0.3,
        tags: ['meeting', 'engineering'],
      });

      const recalled = memory.recallWorking('meeting');
      expect(recalled).toHaveLength(1);
      expect(recalled[0].content).toContain('Meeting');
    });
  });

  describe('Hybrid Search', () => {
    beforeEach(async () => {
      await memory.addSemantic({
        type: 'semantic',
        content: 'Python is a programming language',
        category: 'programming',
        confidence: 0.99,
        sources: ['docs'],
        importance: 0.7,
        emotionalWeight: 0.1,
        tags: ['python'],
      });

      await memory.addEpisodic({
        type: 'episodic',
        content: 'Learned Python basics yesterday',
        context: 'learning',
        importance: 0.6,
        emotionalWeight: 0.5,
        tags: ['python', 'learning'],
      });
    });

    it('should search across memory types', async () => {
      const results = await memory.search('Python', { limit: 10 });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by memory type', async () => {
      const results = await memory.search('Python', {
        limit: 10,
        memoryTypes: ['semantic'],
      });
      expect(results.every(r => r.entry.type === 'semantic')).toBe(true);
    });

    it('should filter by tags', async () => {
      const results = await memory.search('Python', {
        limit: 10,
        tags: ['learning'],
      });
      expect(results.every(r => r.entry.tags?.includes('learning'))).toBe(true);
    });

    it('should update access count', async () => {
      await memory.search('Python');
      await memory.search('Python');
      const results = await memory.search('Python', { limit: 1 });
      expect(results[0].entry.accessCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Memory Capacity Management', () => {
    it('should enforce memory limit', async () => {
      const smallMemory = new LayeredMemory({
        maxMemoryCount: 5,
        enableVectorization: false,
      });

      for (let i = 0; i < 10; i++) {
        await smallMemory.addSemantic({
          type: 'semantic',
          content: `Content ${i}`,
          category: 'test',
          confidence: 0.8,
          sources: ['test'],
          importance: Math.random(),
          emotionalWeight: 0.5,
          tags: ['test'],
        });
      }

      const stats = smallMemory.getStats();
      expect(stats.total).toBeLessThanOrEqual(5);
      await smallMemory.clear();
    });
  });

  describe('Error Handling', () => {
    it('should handle search gracefully', async () => {
      await memory.addSemantic({
        type: 'semantic',
        content: 'Test content',
        category: 'test',
        confidence: 0.8,
        sources: ['test'],
        importance: 0.6,
        emotionalWeight: 0.4,
        tags: ['test'],
      });

      const results = await memory.search('Test');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle concurrent operations', async () => {
      const operations: Promise<unknown>[] = [];
      for (let i = 0; i < 10; i++) {
        operations.push(
          memory.addSemantic({
            type: 'semantic',
            content: `Concurrent ${i}`,
            category: 'test',
            confidence: 0.8,
            sources: ['test'],
            importance: 0.6,
            emotionalWeight: 0.4,
            tags: ['concurrent'],
          })
        );
      }
      await Promise.all(operations);
      const stats = memory.getStats();
      expect(stats.total).toBeGreaterThanOrEqual(10);
    });

    it('should clear all memories', async () => {
      await memory.addSemantic({
        type: 'semantic',
        content: 'Test',
        category: 'test',
        confidence: 0.8,
        sources: ['test'],
        importance: 0.6,
        emotionalWeight: 0.4,
        tags: ['test'],
      });

      await memory.clear();
      const stats = memory.getStats();
      expect(stats.total).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should report accurate stats', async () => {
      await memory.addEpisodic({
        type: 'episodic',
        content: 'Event',
        context: 'test',
        importance: 0.6,
        emotionalWeight: 0.4,
        tags: ['test'],
      });

      await memory.addSemantic({
        type: 'semantic',
        content: 'Knowledge',
        category: 'test',
        confidence: 0.8,
        sources: ['test'],
        importance: 0.7,
        emotionalWeight: 0.3,
        tags: ['test'],
      });

      memory.addToWorking({
        id: 'wm_test',
        content: 'Working',
        timestamp: Date.now(),
        accessCount: 0,
        importance: 0.5,
        emotionalWeight: 0.5,
      });

      const stats = memory.getStats();
      expect(stats.total).toBe(3);
      expect(stats.working).toBe(1);
      expect(stats.episodic).toBe(1);
      expect(stats.semantic).toBe(1);
    });
  });
});
