/**
 * @file tests/unit/cognitive/chain-of-thought/chain-of-thought.test.ts
 * @description 思维链测试
 * @author Ouroboros
 * @date 2026-02-19
 */

import { ChainOfThoughtManager, createChainOfThought } from '@/cognitive/chain-of-thought';

describe('ChainOfThoughtManager', () => {
  let manager: ChainOfThoughtManager;

  beforeEach(() => {
    manager = new ChainOfThoughtManager({ verbose: false });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Chain Creation', () => {
    it('should create a new chain', () => {
      const chain = manager.start('What is 2 + 2?');

      expect(chain.id).toBeDefined();
      expect(chain.input).toBe('What is 2 + 2?');
      expect(chain.steps).toEqual([]);
      expect(chain.status).toBe('active');
      expect(chain.overallConfidence).toBe(1.0);
    });

    it('should generate unique chain IDs', () => {
      const chain1 = manager.start('Question 1');
      const chain2 = manager.start('Question 2');

      expect(chain1.id).not.toBe(chain2.id);
    });
  });

  describe('Step Management', () => {
    it('should add reasoning step', async () => {
      const chain = manager.start('Test input');

      const step = await manager.addStep(
        chain.id,
        'understand',
        'Understand the problem',
        'I need to understand what is being asked'
      );

      expect(step.id).toBeDefined();
      expect(step.type).toBe('understand');
      expect(step.description).toBe('Understand the problem');
      expect(step.thought).toBe('I need to understand what is being asked');
      expect(step.status).toBe('completed');
    });

    it('should add multiple steps', async () => {
      const chain = manager.start('Test input');

      await manager.addStep(chain.id, 'understand', 'Understand', 'Thought 1');
      await manager.addStep(chain.id, 'analyze', 'Analyze', 'Thought 2');
      await manager.addStep(chain.id, 'conclude', 'Conclude', 'Thought 3');

      const updatedChain = manager.getChain(chain.id);
      expect(updatedChain?.steps).toHaveLength(3);
    });

    it('should throw when adding step to non-existent chain', async () => {
      await expect(
        manager.addStep('non-existent', 'understand', 'Test', 'Thought')
      ).rejects.toThrow("Chain not found: non-existent");
    });

    it('should enforce max steps limit', async () => {
      const limitedManager = new ChainOfThoughtManager({ maxSteps: 2 });
      const chain = limitedManager.start('Test');

      await limitedManager.addStep(chain.id, 'understand', 'Step 1', 'Thought 1');
      await limitedManager.addStep(chain.id, 'analyze', 'Step 2', 'Thought 2');

      await expect(
        limitedManager.addStep(chain.id, 'conclude', 'Step 3', 'Thought 3')
      ).rejects.toThrow('Maximum steps (2) reached');
    });
  });

  describe('Chain Completion', () => {
    it('should complete chain', () => {
      const chain = manager.start('Test input');
      const completed = manager.complete(chain.id, 'The answer is 4');

      expect(completed.status).toBe('completed');
      expect(completed.conclusion).toBe('The answer is 4');
      expect(completed.completedAt).toBeDefined();
      expect(completed.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('should throw when completing non-existent chain', () => {
      expect(() => {
        manager.complete('non-existent', 'Conclusion');
      }).toThrow("Chain not found: non-existent");
    });
  });

  describe('Step Handlers', () => {
    it('should register custom step handler', async () => {
      const customHandler = jest.fn().mockResolvedValue({
        output: { custom: true },
        confidence: 0.95,
      });

      manager.registerStepHandler('conclude', customHandler);

      const chain = manager.start('Test');
      await manager.addStep(chain.id, 'conclude', 'Conclusion Step', 'Thought');

      expect(customHandler).toHaveBeenCalled();
    });

    it('should handle step execution error', async () => {
      const errorHandler = jest.fn().mockRejectedValue(new Error('Step failed'));

      manager.registerStepHandler('execute', errorHandler);

      const chain = manager.start('Test');
      const step = await manager.addStep(chain.id, 'execute', 'Execute Step', 'Thought');

      expect(step.status).toBe('error');
      expect(step.error).toBe('Step failed');
      expect(step.confidence).toBe(0);
    });
  });

  describe('Chain Retrieval', () => {
    it('should get chain by id', () => {
      const chain = manager.start('Test input');
      const retrieved = manager.getChain(chain.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(chain.id);
    });

    it('should return undefined for non-existent chain', () => {
      expect(manager.getChain('non-existent')).toBeUndefined();
    });

    it('should get all chains', () => {
      manager.start('Chain 1');
      manager.start('Chain 2');
      manager.start('Chain 3');

      const all = manager.getAllChains();
      expect(all).toHaveLength(3);
    });
  });

  describe('Readable Format', () => {
    it('should format chain as readable string', async () => {
      const chain = manager.start('What is 2 + 2?');
      await manager.addStep(chain.id, 'understand', 'Understand', 'Need to add numbers');
      await manager.addStep(chain.id, 'execute', 'Calculate', '2 + 2 = 4');
      manager.complete(chain.id, 'The answer is 4');

      const readable = manager.getReadableChain(chain.id);

      expect(readable).toContain('Chain of Thought');
      expect(readable).toContain('What is 2 + 2?');
      expect(readable).toContain('Understand');
      expect(readable).toContain('Calculate');
      expect(readable).toContain('Conclusion: The answer is 4');
    });

    it('should return not found message for non-existent chain', () => {
      const readable = manager.getReadableChain('non-existent');
      expect(readable).toBe('Chain not found');
    });
  });

  describe('Export for Memory', () => {
    it('should export chain for memory storage', async () => {
      const chain = manager.start('Test');
      await manager.addStep(chain.id, 'understand', 'Understand', 'Thought');
      manager.complete(chain.id, 'Conclusion');

      const exported = manager.exportForMemory(chain.id);

      expect(exported).toBeDefined();
      expect(exported?.type).toBe('chain_of_thought');
      expect(exported?.content).toContain('Chain of Thought');
      expect(exported?.metadata.steps).toBe(1);
      expect(exported?.metadata.confidence).toBe(1.0);
    });

    it('should return undefined for non-existent chain', () => {
      expect(manager.exportForMemory('non-existent')).toBeUndefined();
    });
  });

  describe('Statistics', () => {
    it('should calculate stats', async () => {
      const chain1 = manager.start('Chain 1');
      await manager.addStep(chain1.id, 'understand', 'Step 1', 'Thought');
      manager.complete(chain1.id, 'Done');

      const chain2 = manager.start('Chain 2');
      await manager.addStep(chain2.id, 'understand', 'Step 1', 'Thought');
      await manager.addStep(chain2.id, 'execute', 'Step 2', 'Thought');
      manager.complete(chain2.id, 'Done');

      const stats = manager.getStats();

      expect(stats.totalChains).toBe(2);
      expect(stats.completedChains).toBe(2);
      expect(stats.totalSteps).toBe(3);
      expect(stats.averageSteps).toBe(1.5);
    });
  });

  describe('Convenience Function', () => {
    it('should create chain with convenience function', () => {
      const { manager: m, chain } = createChainOfThought('Test input');

      expect(m).toBeInstanceOf(ChainOfThoughtManager);
      expect(chain.input).toBe('Test input');
      expect(chain.status).toBe('active');
    });

    it('should accept options in convenience function', () => {
      const { manager: m } = createChainOfThought('Test', { verbose: true });

      expect(m).toBeInstanceOf(ChainOfThoughtManager);
    });
  });
});
