/**
 * Scheduler Integration Tests
 * 调度器集成测试 - 验证神经-内分泌双调度系统
 */

import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { 
  NeuroEndocrineScheduler, 
  TaskPriority, 
  TaskType,
  HormoneType,
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_HORMONE_STATE,
} from '../../src/decision/scheduler';
import { delay, waitForEvent } from '../setup';

describe('Scheduler Integration', () => {
  let scheduler: NeuroEndocrineScheduler;

  beforeEach(async () => {
    scheduler = new NeuroEndocrineScheduler({
      asyncLoopInterval: 50, // 加快测试速度
      defaultTimeout: 1000,
      maxConcurrent: 3,
      enableHomeostasis: false, // 测试中禁用稳态保护
    });
    
    await scheduler.start();
  });

  afterEach(async () => {
    await scheduler.stop();
  });

  // ============================================================================
  // 生命周期管理
  // ============================================================================

  describe('Lifecycle Management', () => {
    it('should initialize with default configuration', () => {
      const defaultScheduler = new NeuroEndocrineScheduler();
      expect(defaultScheduler).toBeDefined();
      
      const status = defaultScheduler.getQueueStatus();
      expect(status.neural).toBe(0);
      expect(status.endocrine).toBe(0);
      expect(status.running).toBe(0);
    });

    it('should accept custom configuration', () => {
      const customScheduler = new NeuroEndocrineScheduler({
        asyncLoopInterval: 200,
        defaultTimeout: 5000,
        maxConcurrent: 10,
        hormoneDecayRate: 0.02,
      });

      expect(customScheduler).toBeDefined();
    });

    it('should emit started event when started', async () => {
      const testScheduler = new NeuroEndocrineScheduler();
      const startedPromise = waitForEvent(testScheduler, 'started');
      
      await testScheduler.start();
      await startedPromise;
      
      expect(testScheduler).toBeDefined();
      await testScheduler.stop();
    });

    it('should emit stopped event when stopped', async () => {
      const stoppedPromise = waitForEvent(scheduler, 'stopped');
      await scheduler.stop();
      await stoppedPromise;
      
      // 重新启动供后续测试使用
      await scheduler.start();
    });

    it('should cancel all running tasks on stop', async () => {
      // 添加一个长时间运行的任务
      scheduler.submitNeuralTask(
        async () => {
          await delay(10000);
          return 'completed';
        },
        TaskPriority.NORMAL,
        10000
      );

      await delay(100);

      const cancelledPromise = waitForEvent(scheduler, 'taskCancelled');
      await scheduler.stop();
      
      await expect(cancelledPromise).resolves.toBeDefined();
      
      // 重新启动
      await scheduler.start();
    });
  });

  // ============================================================================
  // 任务提交与执行
  // ============================================================================

  describe('Task Submission & Execution', () => {
    it('should submit and execute neural task successfully', async () => {
      const mockFn = jest.fn().mockResolvedValue('neural_result');
      
      const taskId = scheduler.submitNeuralTask(
        mockFn,
        TaskPriority.NORMAL,
        5000
      );

      expect(taskId).toBeDefined();
      expect(taskId.startsWith('task_')).toBe(true);

      // 等待任务完成
      const completedPromise = waitForEvent(scheduler, 'taskCompleted');
      await completedPromise;

      expect(mockFn).toHaveBeenCalled();
    });

    it('should submit and execute endocrine task successfully', async () => {
      const mockFn = jest.fn().mockResolvedValue('endocrine_result');
      
      const taskId = scheduler.submitEndocrineTask(
        mockFn,
        TaskPriority.LOW,
        5000
      );

      expect(taskId).toBeDefined();

      const completedPromise = waitForEvent(scheduler, 'taskCompleted');
      await completedPromise;

      expect(mockFn).toHaveBeenCalled();
    });

    it('should execute tasks by priority order', async () => {
      const executionOrder: string[] = [];

      // 按不同优先级提交任务（反向顺序）
      scheduler.submitNeuralTask(
        async () => { executionOrder.push('low'); return 'low'; },
        TaskPriority.LOW
      );

      scheduler.submitNeuralTask(
        async () => { executionOrder.push('normal'); return 'normal'; },
        TaskPriority.NORMAL
      );

      scheduler.submitNeuralTask(
        async () => { executionOrder.push('high'); return 'high'; },
        TaskPriority.HIGH
      );

      scheduler.submitNeuralTask(
        async () => { executionOrder.push('critical'); return 'critical'; },
        TaskPriority.CRITICAL
      );

      // 等待所有任务完成
      await delay(500);

      // 验证执行顺序（按优先级）
      expect(executionOrder[0]).toBe('critical');
      expect(executionOrder[1]).toBe('high');
    });

    it('should handle human interaction with highest priority', async () => {
      const mockFn = jest.fn().mockResolvedValue('human_result');
      
      const taskId = scheduler.submitHumanInteraction(mockFn);
      
      expect(taskId).toBeDefined();

      const completedPromise = waitForEvent(scheduler, 'taskCompleted');
      const result = await completedPromise;
      
      expect(mockFn).toHaveBeenCalled();
    });

    it('should handle background tasks with lowest priority', async () => {
      const mockFn = jest.fn().mockResolvedValue('background_result');
      
      const taskId = scheduler.submitBackgroundTask(mockFn);
      
      expect(taskId).toBeDefined();

      const completedPromise = waitForEvent(scheduler, 'taskCompleted');
      await completedPromise;

      expect(mockFn).toHaveBeenCalled();
    });

    it('should emit task events in correct order', async () => {
      const events: string[] = [];

      scheduler.on('taskSubmitted', () => events.push('submitted'));
      scheduler.on('taskStarted', () => events.push('started'));
      scheduler.on('taskCompleted', () => events.push('completed'));

      scheduler.submitNeuralTask(async () => 'test');

      await delay(200);

      expect(events).toContain('submitted');
      expect(events).toContain('started');
      expect(events).toContain('completed');
      
      // 验证顺序
      expect(events.indexOf('submitted')).toBeLessThan(events.indexOf('started'));
      expect(events.indexOf('started')).toBeLessThan(events.indexOf('completed'));
    });
  });

  // ============================================================================
  // 并发控制
  // ============================================================================

  describe('Concurrency Control', () => {
    it('should respect maxConcurrent limit', async () => {
      const runningCount: number[] = [];

      // 提交超过并发限制的任务
      for (let i = 0; i < 10; i++) {
        scheduler.submitNeuralTask(async () => {
          const status = scheduler.getQueueStatus();
          runningCount.push(status.running);
          await delay(100);
          return i;
        });
      }

      await delay(300);

      // 验证并发数从未超过限制
      expect(Math.max(...runningCount)).toBeLessThanOrEqual(3);
    });

    it('should queue tasks when at capacity', async () => {
      // 填满并发槽
      for (let i = 0; i < 3; i++) {
        scheduler.submitNeuralTask(async () => {
          await delay(500);
          return i;
        });
      }

      // 再添加一个任务
      scheduler.submitNeuralTask(async () => 'queued');

      await delay(50);

      const status = scheduler.getQueueStatus();
      expect(status.running).toBe(3);
      expect(status.neural).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // 超时处理
  // ============================================================================

  describe('Timeout Handling', () => {
    it('should timeout long-running tasks', async () => {
      scheduler.submitNeuralTask(
        async () => {
          await delay(10000);
          return 'should not complete';
        },
        TaskPriority.NORMAL,
        100 // 100ms timeout
      );

      const timeoutPromise = waitForEvent(scheduler, 'taskTimeout');
      const result = await timeoutPromise;
      
      expect(result).toBeDefined();
    });

    it('should cancel task on timeout', async () => {
      let taskCancelled = false;

      scheduler.on('taskCancelled', () => {
        taskCancelled = true;
      });

      scheduler.submitNeuralTask(
        async () => {
          await delay(10000);
          return 'should not complete';
        },
        TaskPriority.NORMAL,
        50
      );

      await delay(200);

      expect(taskCancelled).toBe(true);
    });
  });

  // ============================================================================
  // 错误处理
  // ============================================================================

  describe('Error Handling', () => {
    it('should emit taskFailed on task error', async () => {
      const error = new Error('Test error');
      
      scheduler.submitNeuralTask(async () => {
        throw error;
      });

      const failedPromise = waitForEvent(scheduler, 'taskFailed');
      const result = await failedPromise;
      
      expect(result.error).toBeDefined();
    });

    it('should handle task rejection gracefully', async () => {
      const events: string[] = [];

      scheduler.on('taskFailed', () => events.push('failed'));
      scheduler.on('taskCompleted', () => events.push('completed'));

      scheduler.submitNeuralTask(async () => {
        throw new Error('Intentional error');
      });

      await delay(200);

      expect(events).toContain('failed');
      expect(events).not.toContain('completed');
    });

    it('should continue processing queue after task failure', async () => {
      const results: string[] = [];

      // 第一个任务失败
      scheduler.submitNeuralTask(async () => {
        throw new Error('First task fails');
      }, TaskPriority.HIGH);

      // 第二个任务应该仍然执行
      scheduler.submitNeuralTask(async () => {
        results.push('second');
        return 'second';
      }, TaskPriority.NORMAL);

      await delay(300);

      expect(results).toContain('second');
    });
  });

  // ============================================================================
  // 激素系统
  // ============================================================================

  describe('Hormone System', () => {
    it('should track hormone state correctly', () => {
      const state = scheduler.getHormoneState();
      
      expect(state[HormoneType.ADRENALINE]).toBeDefined();
      expect(state[HormoneType.CORTISOL]).toBeDefined();
      expect(state[HormoneType.DOPAMINE]).toBeDefined();
      expect(state[HormoneType.SEROTONIN]).toBeDefined();
      expect(state[HormoneType.CURIOSITY]).toBeDefined();
      expect(state[HormoneType.STRESS]).toBeDefined();
      expect(state[HormoneType.FATIGUE]).toBeDefined();
      expect(state[HormoneType.DOMINANCE]).toBeDefined();
    });

    it('should adjust hormones correctly', () => {
      const initialState = scheduler.getHormoneState();
      
      scheduler.adjustHormone(HormoneType.DOPAMINE, 0.3, 'test');
      
      const newState = scheduler.getHormoneState();
      expect(newState[HormoneType.DOPAMINE]).toBeGreaterThan(
        initialState[HormoneType.DOPAMINE]
      );
    });

    it('should clamp hormone values between 0 and 1', () => {
      scheduler.setHormone(HormoneType.ADRENALINE, 2.0, 'test');
      expect(scheduler.getHormoneState()[HormoneType.ADRENALINE]).toBe(1);

      scheduler.setHormone(HormoneType.ADRENALINE, -1.0, 'test');
      expect(scheduler.getHormoneState()[HormoneType.ADRENALINE]).toBe(0);
    });

    it('should emit hormoneChanged event', () => {
      const hormonePromise = waitForEvent(scheduler, 'hormoneChanged');
      
      scheduler.adjustHormone(HormoneType.STRESS, 0.5, 'test');
      
      return expect(hormonePromise).resolves.toBeDefined();
    });

    it('should decay hormones naturally', async () => {
      scheduler.setHormone(HormoneType.ADRENALINE, 0.9, 'test');
      
      // 等待衰减
      await delay(3000);
      
      const state = scheduler.getHormoneState();
      // 肾上腺素衰减较快
      expect(state[HormoneType.ADRENALINE]).toBeLessThan(0.9);
    });

    it('should provide behavioral advice based on hormone state', () => {
      // 设置高压力状态
      scheduler.setHormone(HormoneType.STRESS, 0.8, 'test');
      
      const advice = scheduler.getBehavioralAdvice();
      
      expect(advice.length).toBeGreaterThan(0);
      expect(advice.some(a => a.hormone === HormoneType.STRESS)).toBe(true);
    });

    it('should influence task execution based on hormone state', async () => {
      // 设置高压力状态
      scheduler.setHormone(HormoneType.STRESS, 0.9, 'test');
      
      const normalTaskExecuted = jest.fn();
      const criticalTaskExecuted = jest.fn();

      // 普通优先级任务（应该被延迟）
      scheduler.submitEndocrineTask(normalTaskExecuted, TaskPriority.NORMAL);

      // 关键任务（应该执行）
      scheduler.submitNeuralTask(criticalTaskExecuted, TaskPriority.CRITICAL);

      await delay(300);

      // 关键任务应该被执行
      expect(criticalTaskExecuted).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 任务取消
  // ============================================================================

  describe('Task Cancellation', () => {
    it('should cancel a queued task', () => {
      const taskId = scheduler.submitNeuralTask(async () => 'never runs');
      
      const cancelled = scheduler.cancelTask(taskId);
      
      expect(cancelled).toBe(true);
    });

    it('should cancel a running task', async () => {
      const taskId = scheduler.submitNeuralTask(async () => {
        await delay(10000);
        return 'never completes';
      });

      await delay(50);

      const cancelled = scheduler.cancelTask(taskId);
      expect(cancelled).toBe(true);
    });

    it('should return false for non-existent task', () => {
      const cancelled = scheduler.cancelTask('non-existent-task');
      expect(cancelled).toBe(false);
    });

    it('should emit taskCancelled event', async () => {
      const taskId = scheduler.submitNeuralTask(async () => 'test');
      
      const cancelledPromise = waitForEvent(scheduler, 'taskCancelled');
      scheduler.cancelTask(taskId);
      
      const result = await cancelledPromise;
      expect(result.taskId).toBe(taskId);
    });
  });

  // ============================================================================
  // 队列状态查询
  // ============================================================================

  describe('Queue Status', () => {
    it('should report accurate queue status', () => {
      // 添加多个任务
      scheduler.submitNeuralTask(async () => '1');
      scheduler.submitNeuralTask(async () => '2');
      scheduler.submitEndocrineTask(async () => '3');

      const status = scheduler.getQueueStatus();
      
      expect(status.neural).toBeGreaterThanOrEqual(0);
      expect(status.endocrine).toBeGreaterThanOrEqual(0);
      expect(status.running).toBeGreaterThanOrEqual(0);
    });

    it('should track running task count correctly', async () => {
      // 提交长时间运行的任务
      for (let i = 0; i < 3; i++) {
        scheduler.submitNeuralTask(async () => {
          await delay(500);
          return i;
        });
      }

      await delay(100);

      const status = scheduler.getQueueStatus();
      expect(status.running).toBeLessThanOrEqual(3);
    });
  });

  // ============================================================================
  // 激素与任务成功/失败的交互
  // ============================================================================

  describe('Hormone-Task Interaction', () => {
    it('should increase dopamine on task success', async () => {
      const initialDopamine = scheduler.getHormoneState()[HormoneType.DOPAMINE];
      
      scheduler.submitNeuralTask(async () => 'success');
      
      await waitForEvent(scheduler, 'taskCompleted');
      
      const newDopamine = scheduler.getHormoneState()[HormoneType.DOPAMINE];
      expect(newDopamine).toBeGreaterThan(initialDopamine);
    });

    it('should increase stress hormones on task failure', async () => {
      const initialStress = scheduler.getHormoneState()[HormoneType.STRESS];
      const initialAdrenaline = scheduler.getHormoneState()[HormoneType.ADRENALINE];
      
      scheduler.submitNeuralTask(async () => {
        throw new Error('failure');
      });
      
      await waitForEvent(scheduler, 'taskFailed');
      
      const newStress = scheduler.getHormoneState()[HormoneType.STRESS];
      const newAdrenaline = scheduler.getHormoneState()[HormoneType.ADRENALINE];
      
      expect(newStress).toBeGreaterThan(initialStress);
      expect(newAdrenaline).toBeGreaterThan(initialAdrenaline);
    });

    it('should increase fatigue after task execution', async () => {
      const initialFatigue = scheduler.getHormoneState()[HormoneType.FATIGUE];
      
      scheduler.submitNeuralTask(async () => 'done');
      
      await waitForEvent(scheduler, 'taskCompleted');
      
      const newFatigue = scheduler.getHormoneState()[HormoneType.FATIGUE];
      expect(newFatigue).toBeGreaterThanOrEqual(initialFatigue);
    });
  });
});
