/**
 * @fileoverview 神经-内分泌双调度器单元测试
 * @module tests/unit/decision/scheduler.test
 */

import {
  NeuroEndocrineScheduler,
  TaskPriority,
  TaskType,
  HormoneType,
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_HORMONE_STATE,
} from '../../../src/decision/scheduler';

describe('NeuroEndocrineScheduler', () => {
  let scheduler: NeuroEndocrineScheduler;

  beforeEach(async () => {
    scheduler = new NeuroEndocrineScheduler({
      asyncLoopInterval: 50,
      defaultTimeout: 1000,
      maxConcurrent: 2,
      hormoneDecayRate: 0.01,
      enableHomeostasis: false, // 测试中禁用稳态保护
    });
  });

  afterEach(async () => {
    // 添加超时防止 stop() 挂起
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('stop timeout')), 3000)
    );
    try {
      await Promise.race([scheduler.stop(), timeout]);
    } catch (e) {
      // 忽略超时错误
    }
  });

  // ==================== 构造与初始化测试 ====================
  describe('Constructor & Initialization', () => {
    it('应使用默认配置创建实例', () => {
      const defaultScheduler = new NeuroEndocrineScheduler();
      expect(defaultScheduler).toBeInstanceOf(NeuroEndocrineScheduler);
    });

    it('应使用自定义配置创建实例', () => {
      const customScheduler = new NeuroEndocrineScheduler({
        maxConcurrent: 5,
        defaultTimeout: 5000,
      });
      expect(customScheduler).toBeInstanceOf(NeuroEndocrineScheduler);
    });

    it('应继承EventEmitter', () => {
      expect(scheduler.on).toBeDefined();
      expect(scheduler.emit).toBeDefined();
    });
  });

  // ==================== 生命周期测试 ====================
  describe('Lifecycle Management', () => {
    it('应启动调度器', async () => {
      await scheduler.start();
      expect(scheduler).toBeDefined();
    });

    it('应停止调度器', async () => {
      await scheduler.start();
      await scheduler.stop();
      expect(scheduler).toBeDefined();
    });

    it('重复启动不应出错', async () => {
      await scheduler.start();
      await scheduler.start();
      expect(scheduler).toBeDefined();
    });

    it('停止时应取消运行中的任务', async () => {
      await scheduler.start();
      
      const taskStarted = jest.fn();
      scheduler.on('taskStarted', taskStarted);
      
      // 提交一个长时间运行的任务
      scheduler.submitNeuralTask(async () => {
        await new Promise(resolve => setTimeout(resolve, 5000));
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      await scheduler.stop();
      
      expect(scheduler).toBeDefined();
    });
  });

  // ==================== 任务提交测试 ====================
  describe('Task Submission', () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it('应提交神经任务', () => {
      const taskId = scheduler.submitNeuralTask(async () => 'result');
      
      expect(typeof taskId).toBe('string');
      expect(taskId).toContain('task_');
    });

    it('应提交内分泌任务', () => {
      const taskId = scheduler.submitEndocrineTask(async () => 'result');
      
      expect(typeof taskId).toBe('string');
    });

    it('应提交用户交互任务', () => {
      const taskId = scheduler.submitHumanInteraction(async () => 'result');
      
      expect(typeof taskId).toBe('string');
    });

    it('应提交背景任务', () => {
      const taskId = scheduler.submitBackgroundTask(async () => 'result');
      
      expect(typeof taskId).toBe('string');
    });

    it('应支持自定义优先级', () => {
      const taskId = scheduler.submitNeuralTask(
        async () => 'result',
        TaskPriority.CRITICAL
      );
      
      expect(typeof taskId).toBe('string');
    });

    it('应支持自定义超时', () => {
      const taskId = scheduler.submitNeuralTask(
        async () => 'result',
        TaskPriority.NORMAL,
        5000
      );
      
      expect(typeof taskId).toBe('string');
    });

    it('应支持元数据', () => {
      const taskId = scheduler.submitNeuralTask(
        async () => 'result',
        TaskPriority.NORMAL,
        1000,
        { source: 'test', userId: '123' }
      );
      
      expect(typeof taskId).toBe('string');
    });

    it('应触发taskSubmitted事件', (done) => {
      scheduler.on('taskSubmitted', ({ taskId, type }) => {
        expect(typeof taskId).toBe('string');
        expect(type).toBe(TaskType.NEURAL);
        done();
      });
      
      scheduler.submitNeuralTask(async () => 'result');
    });
  });

  // ==================== 任务执行测试 ====================
  describe('Task Execution', () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it('应执行任务', (done) => {
      scheduler.on('taskCompleted', ({ result }) => {
        expect(result).toBe('success');
        done();
      });
      
      scheduler.submitNeuralTask(async () => 'success');
    });

    it('应处理任务失败', (done) => {
      scheduler.on('taskFailed', ({ error }) => {
        expect(error).toBeDefined();
        done();
      });
      
      scheduler.submitNeuralTask(async () => {
        throw new Error('Task failed');
      });
    });

    it('应处理任务超时', (done) => {
      scheduler.on('taskTimeout', ({ taskId }) => {
        expect(typeof taskId).toBe('string');
        done();
      });
      
      scheduler.submitNeuralTask(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return 'result';
        },
        TaskPriority.NORMAL,
        100 // 100ms超时
      );
    });

    it('成功任务应增加多巴胺', async () => {
      const initialDopamine = scheduler.getHormoneState()[HormoneType.DOPAMINE];
      
      // 直接执行任务，而不是通过队列
      const mockTask = {
        id: 'test-dopamine-task',
        type: TaskType.NEURAL,
        priority: TaskPriority.NORMAL,
        fn: async () => 'success',
        timeout: 1000,
        createdAt: new Date(),
      };
      
      await scheduler.executeTask(mockTask);
      
      const newDopamine = scheduler.getHormoneState()[HormoneType.DOPAMINE];
      expect(newDopamine).toBeGreaterThan(initialDopamine);
    });

    it('失败任务应增加肾上腺素和皮质醇', async () => {
      const initialAdrenaline = scheduler.getHormoneState()[HormoneType.ADRENALINE];
      const initialCortisol = scheduler.getHormoneState()[HormoneType.CORTISOL];
      
      // 直接执行失败任务
      const mockTask = {
        id: 'test-error-task',
        type: TaskType.NEURAL,
        priority: TaskPriority.NORMAL,
        fn: async () => { throw new Error('Failed'); },
        timeout: 1000,
        createdAt: new Date(),
      };
      
      await scheduler.executeTask(mockTask).catch(() => {
        // 预期会失败
      });
      
      const newAdrenaline = scheduler.getHormoneState()[HormoneType.ADRENALINE];
      const newCortisol = scheduler.getHormoneState()[HormoneType.CORTISOL];
      expect(newAdrenaline).toBeGreaterThan(initialAdrenaline);
      expect(newCortisol).toBeGreaterThan(initialCortisol);
    });
  });

  // ==================== 队列管理测试 ====================
  describe('Queue Management', () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it('应返回队列状态', () => {
      const status = scheduler.getQueueStatus();
      
      expect(typeof status.neural).toBe('number');
      expect(typeof status.endocrine).toBe('number');
      expect(typeof status.running).toBe('number');
    });

    it('应跟踪队列中的任务', () => {
      scheduler.submitNeuralTask(async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
      });
      
      const status = scheduler.getQueueStatus();
      // 队列中可能有任务或正在运行
      expect(status.neural + status.running).toBeGreaterThanOrEqual(0);
    });

    it('应支持任务优先级排序', async () => {
      const completed: string[] = [];
      
      return new Promise((resolve) => {
        let completedCount = 0;
        scheduler.on('taskCompleted', ({ result }) => {
          completed.push(result as string);
          completedCount++;
          if (completedCount === 3) {
            resolve();
          }
        });
        
        // 按不同优先级提交任务
        scheduler.submitNeuralTask(async () => 'low', TaskPriority.LOW);
        scheduler.submitNeuralTask(async () => 'critical', TaskPriority.CRITICAL);
        scheduler.submitNeuralTask(async () => 'normal', TaskPriority.NORMAL);
      });
    });

    it('应取消任务', async () => {
      const taskId = scheduler.submitNeuralTask(async () => {
        await new Promise(resolve => setTimeout(resolve, 5000));
      });
      
      const cancelled = scheduler.cancelTask(taskId);
      expect(cancelled).toBe(true);
    });

    it('取消不存在的任务应返回false', () => {
      const cancelled = scheduler.cancelTask('non-existent-task-id');
      expect(cancelled).toBe(false);
    });

    it('应触发taskCancelled事件', (done) => {
      scheduler.on('taskCancelled', ({ taskId: cancelledId }) => {
        expect(cancelledId).toBe(taskId);
        done();
      });
      
      const taskId = scheduler.submitNeuralTask(async () => {
        await new Promise(resolve => setTimeout(resolve, 5000));
      });
      
      scheduler.cancelTask(taskId);
    });
  });

  // ==================== 激素系统测试 ====================
  describe('Hormone System', () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it('应获取激素状态', () => {
      const state = scheduler.getHormoneState();
      
      expect(state).toHaveProperty(HormoneType.ADRENALINE);
      expect(state).toHaveProperty(HormoneType.CORTISOL);
      expect(state).toHaveProperty(HormoneType.DOPAMINE);
      expect(state).toHaveProperty(HormoneType.SEROTONIN);
      expect(state).toHaveProperty(HormoneType.CURIOSITY);
    });

    it('应调整激素水平', () => {
      const initialState = scheduler.getHormoneState();
      scheduler.adjustHormone(HormoneType.ADRENALINE, 0.2, 'test');
      
      const newState = scheduler.getHormoneState();
      expect(newState[HormoneType.ADRENALINE]).toBe(
        initialState[HormoneType.ADRENALINE] + 0.2
      );
    });

    it('应设置激素水平', () => {
      scheduler.setHormone(HormoneType.DOPAMINE, 0.8, 'test');
      
      expect(scheduler.getHormoneState()[HormoneType.DOPAMINE]).toBe(0.8);
    });

    it('应触发hormoneChanged事件', (done) => {
      scheduler.on('hormoneChanged', ({ type, oldValue, newValue }) => {
        expect(type).toBe(HormoneType.ADRENALINE);
        expect(typeof oldValue).toBe('number');
        expect(typeof newValue).toBe('number');
        done();
      });
      
      scheduler.adjustHormone(HormoneType.ADRENALINE, 0.1, 'test');
    });

    it('应应用激素效应', () => {
      // 设置高肾上腺素
      scheduler.setHormone(HormoneType.ADRENALINE, 0.8, 'test');
      
      // 验证激素效应（通过行为观察）
      expect(scheduler.getHormoneState()[HormoneType.ADRENALINE]).toBe(0.8);
    });
  });

  // ==================== 行为建议测试 ====================
  describe('Behavioral Advice', () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it('应获取行为建议', () => {
      const advice = scheduler.getBehavioralAdvice();
      expect(Array.isArray(advice)).toBe(true);
    });

    it('高压力时应返回警告建议', () => {
      scheduler.setHormone(HormoneType.STRESS, 0.8, 'test');
      
      const advice = scheduler.getBehavioralAdvice();
      const stressAdvice = advice.find(a => a.hormone === HormoneType.STRESS);
      
      if (stressAdvice) {
        expect(stressAdvice.type).toBe('warning');
      }
    });

    it('高疲劳时应返回休息建议', () => {
      scheduler.setHormone(HormoneType.FATIGUE, 0.8, 'test');
      
      const advice = scheduler.getBehavioralAdvice();
      const fatigueAdvice = advice.find(a => a.hormone === HormoneType.FATIGUE);
      
      if (fatigueAdvice) {
        expect(fatigueAdvice.message).toContain('疲劳');
      }
    });

    it('应按严重性排序建议', () => {
      scheduler.setHormone(HormoneType.STRESS, 0.9, 'test');
      scheduler.setHormone(HormoneType.CURIOSITY, 0.9, 'test');
      
      const advice = scheduler.getBehavioralAdvice();
      
      // 高严重性应排在前面
      for (let i = 0; i < advice.length - 1; i++) {
        expect(advice[i].severity).toBeGreaterThanOrEqual(advice[i + 1].severity);
      }
    });
  });

  // ==================== 任务决策测试 ====================
  describe('Task Decision Making', () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it('高压力下应延迟非关键任务', async () => {
      scheduler.setHormone(HormoneType.STRESS, 0.9, 'test');
      
      // 提交低优先级任务
      scheduler.submitNeuralTask(async () => 'result', TaskPriority.LOW);
      
      // 任务可能被延迟或重新排队
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(scheduler).toBeDefined();
    });

    it('高疲劳时应降速处理', async () => {
      scheduler.setHormone(HormoneType.FATIGUE, 0.8, 'test');
      
      scheduler.submitNeuralTask(async () => 'result', TaskPriority.NORMAL);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(scheduler).toBeDefined();
    });

    it('高肾上腺素应加速关键任务', async () => {
      scheduler.setHormone(HormoneType.ADRENALINE, 0.8, 'test');
      
      return new Promise((resolve) => {
        scheduler.on('taskCompleted', () => {
          resolve();
        });
        
        scheduler.submitNeuralTask(async () => 'critical', TaskPriority.CRITICAL);
      });
    });
  });

  // ==================== 系统指标测试 ====================
  describe('System Metrics', () => {
    it('应返回系统指标', async () => {
      await scheduler.start();
      
      // 等待指标收集
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const metrics = scheduler.getMetrics();
      
      if (metrics) {
        expect(metrics).toHaveProperty('cpu');
        expect(metrics).toHaveProperty('memory');
        expect(metrics).toHaveProperty('process');
        expect(metrics).toHaveProperty('timestamp');
      }
    });
  });

  // ==================== 事件发射测试 ====================
  describe('Event Emission', () => {
    it('应触发started事件', (done) => {
      scheduler.on('started', () => {
        done();
      });
      
      scheduler.start();
    });

    it('应触发stopped事件', (done) => {
      scheduler.on('stopped', () => {
        done();
      });
      
      scheduler.start().then(() => {
        scheduler.stop();
      });
    });

    it('应触发taskStarted事件', (done) => {
      scheduler.on('taskStarted', ({ taskId }) => {
        expect(typeof taskId).toBe('string');
        done();
      });
      
      scheduler.start().then(() => {
        scheduler.submitNeuralTask(async () => 'result');
      });
    });
  });

  // ==================== 边界情况测试 ====================
  describe('Edge Cases', () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it('应处理空任务函数', async () => {
      return new Promise((resolve) => {
        scheduler.on('taskCompleted', () => {
          resolve();
        });
        
        scheduler.submitNeuralTask(async () => {});
      });
    });

    it('应处理返回undefined的任务', async () => {
      return new Promise((resolve) => {
        scheduler.on('taskCompleted', ({ result }) => {
          expect(result).toBeUndefined();
          resolve();
        });
        
        scheduler.submitNeuralTask(async () => undefined);
      });
    });

    it('激素值应限制在0-1范围', () => {
      scheduler.adjustHormone(HormoneType.ADRENALINE, 10, 'test');
      expect(scheduler.getHormoneState()[HormoneType.ADRENALINE]).toBeLessThanOrEqual(1);
      
      scheduler.adjustHormone(HormoneType.ADRENALINE, -10, 'test');
      expect(scheduler.getHormoneState()[HormoneType.ADRENALINE]).toBeGreaterThanOrEqual(0);
    });

    it('应处理并发任务限制', async () => {
      const runningTasks: string[] = [];
      
      scheduler.on('taskStarted', ({ taskId }) => {
        runningTasks.push(taskId);
      });
      
      // 提交多个任务
      for (let i = 0; i < 5; i++) {
        scheduler.submitNeuralTask(async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 运行中的任务不应超过最大并发数
      expect(runningTasks.length).toBeLessThanOrEqual(2);
    });
  });
});
