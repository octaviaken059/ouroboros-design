/**
 * 软自指提示词系统 - 基础测试
 */

import {
  PromptAssembler,
  SelfPromptManager,
  MemoryPromptManager,
  TokenBudgetManager,
  PROMPT_TEMPLATES,
  PromptType,
  PerformanceMetrics,
} from '../../../src/cognitive/soft-self-reference';

import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Soft Self-Reference System', () => {
  const TEST_DIR = './test-data';
  const TEST_CONFIG_PATH = path.join(TEST_DIR, 'test-self-prompt.json');

  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    try {
      await fs.rm(TEST_DIR, { recursive: true });
    } catch {}
  });

  // ============================================================================
  // Token预算管理器测试
  // ============================================================================
  describe('TokenBudgetManager', () => {
    it('应该正确分配Token预算', () => {
      const manager = new TokenBudgetManager(8192);
      const budget = manager.getBudget();

      expect(budget.maxTotal).toBe(8192);
      expect(budget.system).toBeGreaterThan(0);
      expect(budget.self).toBeGreaterThan(0);
      expect(budget.memory).toBeGreaterThan(0);
      expect(budget.working).toBeGreaterThan(0);
      expect(budget.reserve).toBeGreaterThan(0);
      
      // 总预算应该等于各部分之和 (允许1个token的舍入误差)
      const sum = budget.system + budget.self + budget.memory + budget.working + budget.reserve;
      expect(Math.abs(sum - 8192)).toBeLessThanOrEqual(1);
    });

    it('应该正确计算Token数', () => {
      const manager = new TokenBudgetManager(4096);
      const tokens = manager.countTokens('Hello World');
      
      // 简单估算: 11字符 / 4 = 3 tokens
      expect(tokens).toBe(3);
    });

    it('应该检测是否超出预算', () => {
      const manager = new TokenBudgetManager(1000);
      
      const segments = [
        { type: PromptType.SYSTEM, content: 'test', tokens: 100, priority: 1, mutable: false, lastOptimized: 0, version: 1 },
        { type: PromptType.SELF, content: 'test', tokens: 200, priority: 0.8, mutable: true, lastOptimized: 0, version: 1 },
      ];
      
      expect(manager.isWithinBudget(segments)).toBe(true);
      
      const largeSegments = [
        { type: PromptType.SYSTEM, content: 'x'.repeat(4000), tokens: 1000, priority: 1, mutable: false, lastOptimized: 0, version: 1 },
      ];
      
      expect(manager.isWithinBudget(largeSegments)).toBe(false);
    });
  });

  // ============================================================================
  // 自我提示词管理器测试
  // ============================================================================
  describe('SelfPromptManager', () => {
    let manager: SelfPromptManager;

    beforeEach(async () => {
      // 清理测试文件
      try {
        await fs.unlink(TEST_CONFIG_PATH);
      } catch {}
      
      manager = new SelfPromptManager(TEST_CONFIG_PATH, 2000);
    });

    it('应该生成默认内容', () => {
      const content = manager.getContent();
      
      expect(content.identity.name).toBe('Ouroboros');
      expect(content.currentState.mode).toBe('serving');
      expect(content.responsibilities.length).toBeGreaterThan(0);
      expect(content.worldModel.capabilities.length).toBeGreaterThan(0);
    });

    it('应该渲染提示词', () => {
      const segment = manager.render((text) => Math.ceil(text.length / 4));
      
      expect(segment.type).toBe(PromptType.SELF);
      expect(segment.tokens).toBeGreaterThan(0);
      expect(segment.priority).toBe(0.8);
      expect(segment.mutable).toBe(true);
      expect(segment.content).toContain('Ouroboros');
    });

    it('应该更新状态', () => {
      const updateSpy = jest.fn();
      manager.on('stateUpdated', updateSpy);
      
      manager.updateState({
        activeTasks: 5,
        bodyStatus: 'busy',
      });
      
      expect(updateSpy).toHaveBeenCalled();
      
      const content = manager.getContent();
      expect(content.currentState.activeTasks).toBe(5);
      expect(content.currentState.bodyStatus).toBe('busy');
    });

    it('应该添加技能', () => {
      const addSpy = jest.fn();
      manager.on('skillAdded', addSpy);
      
      manager.addSkill({
        name: 'test_skill',
        level: 'intermediate',
        successRate: 0.75,
      });
      
      expect(addSpy).toHaveBeenCalled();
      
      const content = manager.getContent();
      const skill = content.skills.find(s => s.name === 'test_skill');
      expect(skill).toBeDefined();
      expect(skill?.level).toBe('intermediate');
    });

    it('应该更新偏好', () => {
      manager.updatePreferences({
        riskTolerance: 0.3,
        verbosity: 'concise',
      });
      
      const content = manager.getContent();
      expect(content.preferences.riskTolerance).toBe(0.3);
      expect(content.preferences.verbosity).toBe('concise');
    });

    it('应该持久化到磁盘', async () => {
      manager.addSkill({
        name: 'persistent_skill',
        level: 'expert',
        successRate: 0.95,
      });
      
      // 等待持久化完成
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 创建新实例，应该立即加载已保存的内容（同步加载）
      const newManager = new SelfPromptManager(TEST_CONFIG_PATH, 2000);
      
      const content = newManager.getContent();
      const skill = content.skills.find(s => s.name === 'persistent_skill');
      expect(skill).toBeDefined();
    });

    it('应该在失败时优化', async () => {
      const metrics: PerformanceMetrics = {
        taskSuccess: false,
        executionTime: 5000,
        tokenEfficiency: 0.3,
        toolSelectionAccuracy: 0.4,
        memoryRetrievalAccuracy: 0.5,
      };
      
      const record = await manager.optimize(metrics);
      
      expect(record).toBeDefined();
      expect(record.type).toBe('self');
      expect(record.strategy).toBe('reduce_risk');
      expect(record.changes.length).toBeGreaterThan(0);
    });

    it('应该在成功时奖励探索', async () => {
      const metrics: PerformanceMetrics = {
        taskSuccess: true,
        executionTime: 1000,
        tokenEfficiency: 0.8,
        toolSelectionAccuracy: 0.95,
        memoryRetrievalAccuracy: 0.9,
      };
      
      const record = await manager.optimize(metrics);
      
      expect(record).toBeDefined();
      expect(record.strategy).toBe('reward_exploration');
    });
  });

  // ============================================================================
  // 记忆提示词管理器测试
  // ============================================================================
  describe('MemoryPromptManager', () => {
    let manager: MemoryPromptManager;

    beforeEach(() => {
      manager = new MemoryPromptManager(2000);
    });

    it('应该组装记忆提示词', () => {
      const segment = manager.assemble(
        {
          userMessage: 'test message',
          recentMemories: [
            { timestamp: Date.now(), type: 'event', content: 'Memory 1', importance: 0.8 },
            { timestamp: Date.now(), type: 'event', content: 'Memory 2', importance: 0.6 },
          ],
          retrievedMemories: [
            { relevance: 0.9, memory: 'Relevant context', source: 'semantic' },
          ],
          summary: {
            keyInsights: ['Insight 1'],
            recurringPatterns: ['Pattern 1'],
            lessonsLearned: ['Lesson 1'],
          },
          context: {
            topic: 'test_topic',
            userIntent: 'test_intent',
            pendingQuestions: [],
            establishedFacts: ['Fact 1'],
          },
        },
        (text) => Math.ceil(text.length / 4)
      );
      
      expect(segment.type).toBe(PromptType.MEMORY);
      expect(segment.tokens).toBeGreaterThan(0);
      expect(segment.content).toContain('Memory 1');
      expect(segment.content).toContain('Relevant context');
    });

    it('应该根据预算选择记忆', () => {
      // 创建大量记忆
      const manyMemories = Array.from({ length: 50 }, (_, i) => ({
        timestamp: Date.now() - i * 1000,
        type: 'event',
        content: `Memory ${i + 1} with some content`,
        importance: Math.random(),
      }));
      
      const segment = manager.assemble(
        {
          userMessage: 'test',
          recentMemories: manyMemories,
          retrievedMemories: [],
        },
        (text) => Math.ceil(text.length / 4)
      );
      
      // 应该只选择了部分记忆
      expect(segment.tokens).toBeLessThanOrEqual(2000);
    });

    it('应该按重要性排序记忆', () => {
      const memories = [
        { timestamp: Date.now(), type: 'event', content: 'Low importance', importance: 0.2 },
        { timestamp: Date.now(), type: 'event', content: 'High importance', importance: 0.9 },
        { timestamp: Date.now(), type: 'event', content: 'Medium importance', importance: 0.5 },
      ];
      
      const segment = manager.assemble(
        {
          userMessage: 'test',
          recentMemories: memories,
          retrievedMemories: [],
        },
        (text) => Math.ceil(text.length / 4)
      );
      
      // 高重要性记忆应该先出现
      const highIndex = segment.content.indexOf('High importance');
      const lowIndex = segment.content.indexOf('Low importance');
      expect(highIndex).toBeLessThan(lowIndex);
    });
  });

  // ============================================================================
  // 提示词组装器测试
  // ============================================================================
  describe('PromptAssembler', () => {
    let assembler: PromptAssembler;

    beforeEach(() => {
      assembler = new PromptAssembler(
        {
          nodeVersion: 'v18.0.0',
          platform: 'linux',
          arch: 'x64',
          safetyRules: ['Rule 1', 'Rule 2'],
          forbiddenActions: ['Action 1', 'Action 2'],
        },
        TEST_CONFIG_PATH,
        4096
      );
    });

    it('应该组装完整提示词', () => {
      const result = assembler.assemble({
        userMessage: 'Hello',
        recentMemories: [],
        retrievedMemories: [],
      });
      
      expect(result.fullPrompt).toBeDefined();
      expect(result.segments.length).toBeGreaterThanOrEqual(2);
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.budgetUsed).toBeGreaterThan(0);
      expect(result.budgetUsed).toBeLessThanOrEqual(1);
      
      // 应该包含系统提示词
      expect(result.fullPrompt).toContain('You are operating within');
      
      // 应该包含自我提示词
      expect(result.fullPrompt).toContain('Ouroboros');
    });

    it('应该在超出预算时截断', () => {
      // 创建一个很小的预算
      const smallAssembler = new PromptAssembler(
        {
          nodeVersion: 'v18.0.0',
          platform: 'linux',
          arch: 'x64',
          safetyRules: [],
          forbiddenActions: [],
        },
        TEST_CONFIG_PATH,
        500 // 很小的上下文窗口
      );
      
      const result = smallAssembler.assemble({
        userMessage: 'A'.repeat(1000), // 很长的用户消息
        recentMemories: [],
        retrievedMemories: [],
      });
      
      expect(result.truncated).toBe(true);
      expect(result.optimizations.length).toBeGreaterThan(0);
    });

    it('应该正确排序提示词段', () => {
      const result = assembler.assemble({
        userMessage: 'Test',
        recentMemories: [
          { timestamp: Date.now(), type: 'event', content: 'Memory', importance: 0.5 },
        ],
        retrievedMemories: [],
      });
      
      // 顺序应该是: System -> Self -> Memory
      const systemIndex = result.fullPrompt.indexOf('You are operating');
      const selfIndex = result.fullPrompt.indexOf('Identity');
      const memoryIndex = result.fullPrompt.indexOf('Context');
      
      expect(systemIndex).toBeLessThan(selfIndex);
      expect(selfIndex).toBeLessThan(memoryIndex);
    });

    it('应该在失败时触发优化', async () => {
      const metrics: PerformanceMetrics = {
        taskSuccess: false,
        executionTime: 3000,
        tokenEfficiency: 0.4,
        toolSelectionAccuracy: 0.5,
        memoryRetrievalAccuracy: 0.6,
      };
      
      const record = await assembler.recordPerformance(metrics);
      
      expect(record).toBeDefined();
      expect(record?.type).toBe('self');
    });

    it('应该在成功时不触发优化', async () => {
      const metrics: PerformanceMetrics = {
        taskSuccess: true,
        executionTime: 500,
        tokenEfficiency: 0.9,
        toolSelectionAccuracy: 1.0,
        memoryRetrievalAccuracy: 0.95,
      };
      
      const record = await assembler.recordPerformance(metrics);
      
      // 成功且性能良好，不应该触发优化
      expect(record).toBeNull();
    });

    it('应该提供管理器访问', () => {
      const selfManager = assembler.getSelfManager();
      const memoryManager = assembler.getMemoryManager();
      
      expect(selfManager).toBeInstanceOf(SelfPromptManager);
      expect(memoryManager).toBeInstanceOf(MemoryPromptManager);
    });
  });

  // ============================================================================
  // 模板测试
  // ============================================================================
  describe('Prompt Templates', () => {
    it('应该包含所有三类模板', () => {
      expect(PROMPT_TEMPLATES.system).toBeDefined();
      expect(PROMPT_TEMPLATES.self).toBeDefined();
      expect(PROMPT_TEMPLATES.memory).toBeDefined();
    });

    it('系统模板应该包含安全约束', () => {
      expect(PROMPT_TEMPLATES.system).toContain('Safety Constraints');
      expect(PROMPT_TEMPLATES.system).toContain('Forbidden Actions');
    });

    it('自我模板应该包含身份和状态', () => {
      expect(PROMPT_TEMPLATES.self).toContain('Identity');
      expect(PROMPT_TEMPLATES.self).toContain('Current State');
      expect(PROMPT_TEMPLATES.self).toContain('Responsibilities');
    });

    it('记忆模板应该包含上下文', () => {
      expect(PROMPT_TEMPLATES.memory).toContain('Context');
      expect(PROMPT_TEMPLATES.memory).toContain('Recent Memories');
    });
  });
});
