/**
 * @file tests/unit/core/memory/memory-system.test.ts
 * @description 记忆系统单元测试
 * @author Ouroboros
 * @date 2026-02-18
 */

import { MemorySystem } from '@/core/memory/memory-system';
import { MemoryStore } from '@/core/memory/memory-store';
import type { SemanticMemory } from '@/types/memory';

// Mock 配置
jest.mock('@/config', () => ({
  getConfig: () => ({
    memory: {
      shortTermCapacity: 10,
      longTermStorageDir: './test-data/memory',
      consolidationThreshold: 0.7,
      forgettingRate: 0.01,
      maxMemories: 100,
      autoArchiveDays: 30,
      vectorStore: {
        enabled: false, // 测试中禁用向量存储
        dimension: 768,
        similarityThreshold: 0.7,
      },
      retrieval: {
        defaultLimit: 5,
        maxLimit: 20,
        semanticWeight: 0.4,
        temporalWeight: 0.3,
        importanceWeight: 0.3,
      },
    },
    model: {
      defaultModel: {
        baseUrl: 'http://localhost:11434',
      },
    },
  }),
}));

// Mock 数据库
jest.mock('@/db/connection', () => ({
  query: jest.fn((sql: string) => {
    if (sql.includes('COUNT(*)')) {
      return [{ count: 0 }];
    }
    if (sql.includes('GROUP BY type')) {
      return [];
    }
    return [];
  }),
  run: jest.fn(),
}));

describe('MemorySystem', () => {
  let memorySystem: MemorySystem;

  beforeEach(() => {
    memorySystem = new MemorySystem();
  });

  describe('记忆记录', () => {
    it('应该记录对话', () => {
      const memory = memorySystem.recordConversation(
        '你好，我是Ken',
        '你好Ken，很高兴认识你！'
      );

      expect(memory).toBeDefined();
      expect(memory.type).toBe('episodic');
      expect(memory.content).toContain('你好，我是Ken');
      expect(memory.content).toContain('很高兴认识你');
    });

    it('应该记录事实', () => {
      const memory = memorySystem.recordFact(
        'Ken喜欢编程',
        'preference',
        0.8
      );

      expect(memory).toBeDefined();
      expect(memory.type).toBe('semantic');
      expect(memory.importance).toBe(0.8);
    });

    it('应该记录技能执行', () => {
      const memory = memorySystem.recordSkillExecution(
        'web_search',
        '搜索天气信息',
        true
      );

      expect(memory).toBeDefined();
      expect(memory.type).toBe('procedural');
    });

    it('应该记录洞察', () => {
      const memory = memorySystem.recordInsight(
        '用户喜欢简洁的回答',
        '根据多次对话观察，用户对简短直接的回复反应更积极'
      );

      expect(memory).toBeDefined();
      expect(memory.type).toBe('reflective');
      expect(memory.importance).toBeGreaterThan(0.5);
    });
  });

  describe('记忆检索', () => {
    beforeEach(async () => {
      // 预先添加一些记忆
      await memorySystem.recordConversation('今天天气如何？', '今天晴朗，25度');
      await memorySystem.recordConversation('明天会下雨吗？', '预报显示有雨');
      memorySystem.recordFact('Ken住在上海', 'location', 0.9);
    });

    it('应该检索相关记忆', async () => {
      const results = await memorySystem.retrieveRelevant('天气', 3);
      expect(results.length).toBeGreaterThan(0);
    });

    it('应该获取最近记忆', () => {
      const memories = memorySystem.getRecentMemories(2);
      expect(memories.length).toBeLessThanOrEqual(2);
    });
  });

  describe('提示词上下文生成', () => {
    it('应该生成记忆上下文', async () => {
      await memorySystem.recordConversation('你好', '你好！有什么我可以帮助你的？');
      
      const context = await memorySystem.generateMemoryContext('你好');
      
      expect(context).toBeDefined();
      expect(context.contextText).toBeDefined();
      expect(context.relevantMemories).toBeDefined();
      expect(context.recentConversation).toBeDefined();
    });

    it('上下文应该包含最近对话', async () => {
      await memorySystem.recordConversation('问题1', '回答1');
      await memorySystem.recordConversation('问题2', '回答2');
      
      const context = await memorySystem.generateMemoryContext('问题3');
      
      expect(context.contextText).toContain('问题1');
      expect(context.contextText).toContain('回答1');
    });
  });

  describe('记忆统计', () => {
    it('应该返回记忆统计', () => {
      memorySystem.recordConversation('测试', '测试回复');
      
      const stats = memorySystem.getStats();
      
      expect(stats.totalCount).toBeGreaterThanOrEqual(0);
      expect(stats.typeCounts).toBeDefined();
      expect(stats.conversationHistoryLength).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore(10);
  });

  it('应该保存和检索记忆', () => {
    const memory = store.save({
      type: 'semantic',
      fact: '测试事实',
      category: 'test',
      verified: true,
      conflictingMemoryIds: [],
      content: '测试事实',
      emotionalIntensity: 0,
      importance: 0.5,
      confidence: 1,
      relatedMemoryIds: [],
      tags: ['test'],
    } as Omit<SemanticMemory, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>);

    expect(memory.id).toBeDefined();
    
    const retrieved = store.getById(memory.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.content).toBe('测试事实');
  });

  it('应该查询记忆', () => {
    store.save({
      type: 'semantic',
      fact: '事实1',
      category: 'cat1',
      verified: true,
      conflictingMemoryIds: [],
      content: '事实1',
      emotionalIntensity: 0,
      importance: 0.5,
      confidence: 1,
      relatedMemoryIds: [],
      tags: ['tag1'],
    } as Omit<SemanticMemory, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>);

    const results = store.query({ type: 'semantic', tags: ['tag1'] });
    expect(results.length).toBeGreaterThan(0);
  });

  it('应该搜索记忆', () => {
    store.save({
      type: 'semantic',
      fact: '搜索测试',
      category: 'test',
      verified: true,
      conflictingMemoryIds: [],
      content: '搜索测试',
      emotionalIntensity: 0,
      importance: 0.5,
      confidence: 1,
      relatedMemoryIds: [],
      tags: ['search'],
    } as Omit<SemanticMemory, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>);

    const results = store.search(['搜索'], 5);
    expect(results.length).toBeGreaterThan(0);
  });
});
