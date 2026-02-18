/**
 * 神经-内分泌双调度器 (Neuro-Endocrine Scheduler)
 * 
 * 模拟生物神经和内分泌系统的双调度机制：
 * - 神经系统：快速响应、高优先级任务
 * - 内分泌系统：慢速调节、激素水平影响行为
 * 
 * @module decision/scheduler
 */

import { EventEmitter } from 'events';

// ============================================================================
// 类型定义
// ============================================================================

/** 任务优先级 */
export enum TaskPriority {
  CRITICAL = 0,    // 关键任务：系统故障、安全警报
  HIGH = 1,        // 高优先级：用户交互
  NORMAL = 2,      // 普通任务：常规操作
  LOW = 3,         // 低优先级：后台维护
  BACKGROUND = 4,  // 背景任务：探索、反思
}

/** 任务类型 */
export enum TaskType {
  NEURAL = 'neural',       // 神经任务：快速响应
  ENDOCRINE = 'endocrine', // 内分泌任务：慢速调节
}

/** 激素类型 */
export enum HormoneType {
  ADRENALINE = 'adrenaline',   // 肾上腺素：提升专注
  CORTISOL = 'cortisol',       // 皮质醇：降低功耗
  DOPAMINE = 'dopamine',       // 多巴胺：增强探索
  SEROTONIN = 'serotonin',     // 血清素：稳定情绪
  CURIOSITY = 'curiosity',     // 好奇心：驱动探索
  STRESS = 'stress',           // 压力：影响决策
  FATIGUE = 'fatigue',         // 疲劳：降低响应
  DOMINANCE = 'dominance',     // 支配：影响主动性
}

/** 任务接口 */
export interface Task {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  fn: () => Promise<unknown>;
  timeout: number;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

/** 激素水平状态 */
export interface HormoneState {
  [HormoneType.ADRENALINE]: number;  // 0-1
  [HormoneType.CORTISOL]: number;
  [HormoneType.DOPAMINE]: number;
  [HormoneType.SEROTONIN]: number;
  [HormoneType.CURIOSITY]: number;
  [HormoneType.STRESS]: number;
  [HormoneType.FATIGUE]: number;
  [HormoneType.DOMINANCE]: number;
}

/** 调度器配置 */
export interface SchedulerConfig {
  asyncLoopInterval: number;    // 事件循环间隔 (ms)
  defaultTimeout: number;       // 默认任务超时 (ms)
  maxConcurrent: number;        // 最大并发数
  hormoneDecayRate: number;     // 激素衰减速率 (每周期)
  enableHomeostasis: boolean;   // 启用稳态保护
  cpuThreshold: number;         // CPU阈值 (%)
  memoryThreshold: number;      // 内存阈值 (%)
  fatigueThreshold: number;     // 疲劳度阈值 (0-1)
}

/** 系统指标 */
export interface SystemMetrics {
  cpu: {
    usage: number;      // 0-100
    loadAvg: number[];  // 1min, 5min, 15min
  };
  memory: {
    used: number;
    total: number;
    percentage: number; // 0-100
  };
  process: {
    pid: number;
    uptime: number;
    heapUsed: number;
    heapTotal: number;
  };
  timestamp: Date;
}

/** 行为建议 */
export interface BehavioralAdvice {
  type: 'warning' | 'info' | 'suggestion';
  hormone: HormoneType;
  message: string;
  severity: number; // 0-1
}

// ============================================================================
// 默认配置
// ============================================================================

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  asyncLoopInterval: 100,
  defaultTimeout: 30000,
  maxConcurrent: 5,
  hormoneDecayRate: 0.01,
  enableHomeostasis: true,
  cpuThreshold: 80,
  memoryThreshold: 85,
  fatigueThreshold: 0.7,
};

export const DEFAULT_HORMONE_STATE: HormoneState = {
  [HormoneType.ADRENALINE]: 0.1,
  [HormoneType.CORTISOL]: 0.1,
  [HormoneType.DOPAMINE]: 0.5,
  [HormoneType.SEROTONIN]: 0.5,
  [HormoneType.CURIOSITY]: 0.3,
  [HormoneType.STRESS]: 0.1,
  [HormoneType.FATIGUE]: 0.1,
  [HormoneType.DOMINANCE]: 0.5,
};

// ============================================================================
// 神经-内分泌双调度器
// ============================================================================

export class NeuroEndocrineScheduler extends EventEmitter {
  private config: SchedulerConfig;
  private neuralQueue: Task[] = [];
  private endocrineQueue: Task[] = [];
  private runningTasks: Map<string, AbortController> = new Map();
  private hormoneState: HormoneState;
  private isRunning = false;
  private loopTimer: NodeJS.Timeout | null = null;
  private metrics: SystemMetrics | null = null;
  private os: typeof import('os') | null = null;

  constructor(config: Partial<SchedulerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
    this.hormoneState = { ...DEFAULT_HORMONE_STATE };
  }

  // ============================================================================
  // 生命周期管理
  // ============================================================================

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.os = await import('os');
    
    // 启动事件循环
    this.loopTimer = setInterval(
      () => this.eventLoop(),
      this.config.asyncLoopInterval
    );

    // 启动激素衰减循环
    setInterval(
      () => this.decayHormones(),
      1000  // 每秒衰减一次
    );

    // 启动系统监控
    if (this.config.enableHomeostasis) {
      this.startHomeostasisMonitor();
    }

    this.emit('started');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }

    // 取消所有运行中的任务
    for (const [id, controller] of this.runningTasks) {
      controller.abort();
      this.emit('taskCancelled', { taskId: id });
    }
    this.runningTasks.clear();

    this.emit('stopped');
  }

  // ============================================================================
  // 任务提交
  // ============================================================================

  /**
   * 提交神经任务 - 快速响应
   */
  submitNeuralTask(
    fn: () => Promise<unknown>,
    priority: TaskPriority = TaskPriority.NORMAL,
    timeout: number = this.config.defaultTimeout,
    metadata?: Record<string, unknown>
  ): string {
    const task: Task = {
      id: this.generateTaskId(),
      type: TaskType.NEURAL,
      priority,
      fn,
      timeout,
      createdAt: new Date(),
      metadata,
    };

    this.insertTaskByPriority(this.neuralQueue, task);
    this.emit('taskSubmitted', { taskId: task.id, type: TaskType.NEURAL });
    
    return task.id;
  }

  /**
   * 提交内分泌任务 - 慢速调节
   */
  submitEndocrineTask(
    fn: () => Promise<unknown>,
    priority: TaskPriority = TaskPriority.LOW,
    timeout: number = this.config.defaultTimeout * 2,
    metadata?: Record<string, unknown>
  ): string {
    const task: Task = {
      id: this.generateTaskId(),
      type: TaskType.ENDOCRINE,
      priority,
      fn,
      timeout,
      createdAt: new Date(),
      metadata,
    };

    this.insertTaskByPriority(this.endocrineQueue, task);
    this.emit('taskSubmitted', { taskId: task.id, type: TaskType.ENDOCRINE });
    
    return task.id;
  }

  /**
   * 提交用户交互任务 - 最高优先级
   */
  submitHumanInteraction(
    fn: () => Promise<unknown>,
    metadata?: Record<string, unknown>
  ): string {
    return this.submitNeuralTask(
      fn,
      TaskPriority.HIGH,
      this.config.defaultTimeout,
      { ...metadata, source: 'human' }
    );
  }

  /**
   * 提交背景任务 - 低优先级
   */
  submitBackgroundTask(
    fn: () => Promise<unknown>,
    metadata?: Record<string, unknown>
  ): string {
    return this.submitEndocrineTask(
      fn,
      TaskPriority.BACKGROUND,
      this.config.defaultTimeout * 3,
      { ...metadata, source: 'background' }
    );
  }

  // ============================================================================
  // 事件循环
  // ============================================================================

  private async eventLoop(): Promise<void> {
    if (!this.isRunning) return;

    // 检查并发限制
    if (this.runningTasks.size >= this.config.maxConcurrent) {
      return;
    }

    // 稳态检查
    if (this.config.enableHomeostasis && !this.isSystemHealthy()) {
      this.emit('homeostasisAlert', { 
        metrics: this.metrics,
        advice: this.getBehavioralAdvice(),
      });
      return;
    }

    // 优先处理神经任务
    const task = this.neuralQueue.shift() || this.endocrineQueue.shift();
    if (!task) return;

    // 激素影响任务执行
    if (!this.shouldExecuteTask(task)) {
      // 放回队列等待下次
      this.requeueTask(task);
      return;
    }

    this.executeTask(task);
  }

  public async executeTask(task: Task): Promise<void> {
    const controller = new AbortController();
    this.runningTasks.set(task.id, controller);

    this.emit('taskStarted', { taskId: task.id });

    const timeoutTimer = setTimeout(() => {
      controller.abort();
      this.emit('taskTimeout', { taskId: task.id });
    }, task.timeout);

    try {
      const result = await task.fn();
      clearTimeout(timeoutTimer);
      this.emit('taskCompleted', { taskId: task.id, result });
      
      // 成功时增加多巴胺
      this.adjustHormone(HormoneType.DOPAMINE, 0.05, 'task success');
    } catch (error) {
      clearTimeout(timeoutTimer);
      this.emit('taskFailed', { taskId: task.id, error });
      
      // 失败时增加肾上腺素和皮质醇
      this.adjustHormone(HormoneType.ADRENALINE, 0.1, 'task error');
      this.adjustHormone(HormoneType.CORTISOL, 0.05, 'task error');
      this.adjustHormone(HormoneType.STRESS, 0.08, 'task error');
    } finally {
      this.runningTasks.delete(task.id);
      
      // 增加疲劳度
      this.adjustHormone(HormoneType.FATIGUE, 0.01, 'task execution');
    }
  }

  private shouldExecuteTask(task: Task): boolean {
    const { stress, fatigue, adrenaline } = this.hormoneState;

    // 高压力状态下只执行关键任务
    if (stress > 0.8 && task.priority > TaskPriority.HIGH) {
      return false;
    }

    // 高疲劳状态下降低处理速度
    if (fatigue > this.config.fatigueThreshold) {
      // 只有关键任务才能执行
      if (task.priority > TaskPriority.HIGH) {
        return Math.random() > 0.5; // 50%概率延迟
      }
    }

    // 高肾上腺素状态下加速处理关键任务
    if (adrenaline > 0.6 && task.priority <= TaskPriority.HIGH) {
      return true;
    }

    return true;
  }

  private requeueTask(task: Task): void {
    if (task.type === TaskType.NEURAL) {
      this.neuralQueue.unshift(task);
    } else {
      this.endocrineQueue.unshift(task);
    }
  }

  // ============================================================================
  // 激素系统
  // ============================================================================

  /**
   * 调节激素水平
   */
  adjustHormone(
    type: HormoneType,
    delta: number,
    reason: string
  ): void {
    const oldValue = this.hormoneState[type];
    const newValue = Math.max(0, Math.min(1, oldValue + delta));
    
    this.hormoneState[type] = newValue;
    
    this.emit('hormoneChanged', {
      type,
      oldValue,
      newValue,
      delta,
      reason,
    });

    // 应用激素效应
    this.applyHormonalEffects(type, newValue);
  }

  /**
   * 获取当前激素水平
   */
  getHormoneState(): HormoneState {
    return { ...this.hormoneState };
  }

  /**
   * 设置激素水平
   */
  setHormone(type: HormoneType, value: number, reason: string): void {
    const clamped = Math.max(0, Math.min(1, value));
    const oldValue = this.hormoneState[type];
    this.hormoneState[type] = clamped;
    
    this.emit('hormoneChanged', {
      type,
      oldValue,
      newValue: clamped,
      delta: clamped - oldValue,
      reason,
    });
  }

  /**
   * 激素自然衰减
   */
  private decayHormones(): void {
    const decayRates: Record<HormoneType, number> = {
      [HormoneType.ADRENALINE]: 0.05,  // 快速衰减
      [HormoneType.CORTISOL]: 0.02,    // 中等衰减
      [HormoneType.DOPAMINE]: 0.01,    // 慢速衰减
      [HormoneType.SEROTONIN]: 0.005,  // 极慢衰减
      [HormoneType.CURIOSITY]: 0.01,
      [HormoneType.STRESS]: 0.03,
      [HormoneType.FATIGUE]: 0.02,
      [HormoneType.DOMINANCE]: 0.005,
    };

    for (const [type, rate] of Object.entries(decayRates)) {
      const hormoneType = type as HormoneType;
      const current = this.hormoneState[hormoneType];
      
      if (current > DEFAULT_HORMONE_STATE[hormoneType]) {
        this.hormoneState[hormoneType] = Math.max(
          DEFAULT_HORMONE_STATE[hormoneType],
          current - rate
        );
      }
    }
  }

  /**
   * 应用激素效应
   */
  private applyHormonalEffects(type: HormoneType, value: number): void {
    switch (type) {
      case HormoneType.ADRENALINE:
        // 高肾上腺素降低皮质醇
        if (value > 0.6) {
          this.hormoneState[HormoneType.CORTISOL] *= 0.95;
        }
        break;
      
      case HormoneType.DOPAMINE:
        // 高多巴胺增加支配感
        if (value > 0.7) {
          this.hormoneState[HormoneType.DOMINANCE] += 0.02;
        }
        break;
      
      case HormoneType.SEROTONIN:
        // 血清素稳定情绪
        if (value > 0.6) {
          this.hormoneState[HormoneType.STRESS] *= 0.95;
        }
        break;
      
      case HormoneType.CURIOSITY:
        // 高好奇心降低疲劳感
        if (value > 0.7) {
          this.hormoneState[HormoneType.FATIGUE] *= 0.95;
        }
        break;
    }
  }

  /**
   * 获取行为建议
   */
  getBehavioralAdvice(): BehavioralAdvice[] {
    const advice: BehavioralAdvice[] = [];
    const state = this.hormoneState;

    if (state[HormoneType.STRESS] > 0.7) {
      advice.push({
        type: 'warning',
        hormone: HormoneType.STRESS,
        message: '⚠️ 高压力状态：建议降低任务复杂度，启用降载模式',
        severity: 0.8,
      });
    }

    if (state[HormoneType.CURIOSITY] > 0.8) {
      advice.push({
        type: 'suggestion',
        hormone: HormoneType.CURIOSITY,
        message: '🤔 高好奇心：适合探索性任务和知识发现',
        severity: 0.3,
      });
    }

    if (state[HormoneType.FATIGUE] > this.config.fatigueThreshold) {
      advice.push({
        type: 'warning',
        hormone: HormoneType.FATIGUE,
        message: '😴 疲劳状态：建议休息或降低响应频率',
        severity: 0.7,
      });
    }

    if (state[HormoneType.ADRENALINE] > 0.6) {
      advice.push({
        type: 'info',
        hormone: HormoneType.ADRENALINE,
        message: '🔥 高专注状态：适合处理关键任务',
        severity: 0.4,
      });
    }

    if (state[HormoneType.DOPAMINE] > 0.8) {
      advice.push({
        type: 'suggestion',
        hormone: HormoneType.DOPAMINE,
        message: '✨ 高奖励状态：学习效果提升',
        severity: 0.2,
      });
    }

    return advice.sort((a, b) => b.severity - a.severity);
  }

  // ============================================================================
  // 稳态保护 (Homeostasis)
  // ============================================================================

  private startHomeostasisMonitor(): void {
    setInterval(async () => {
      this.metrics = await this.collectSystemMetrics();
      
      // 根据系统状态调节激素
      if (this.metrics.cpu.usage > this.config.cpuThreshold) {
        this.adjustHormone(HormoneType.CORTISOL, 0.1, 'high cpu usage');
        this.adjustHormone(HormoneType.STRESS, 0.05, 'high cpu usage');
      }

      if (this.metrics.memory.percentage > this.config.memoryThreshold) {
        this.adjustHormone(HormoneType.CORTISOL, 0.15, 'high memory usage');
        this.adjustHormone(HormoneType.STRESS, 0.1, 'high memory usage');
      }

      this.emit('metricsCollected', this.metrics);
    }, 5000);
  }

  private async collectSystemMetrics(): Promise<SystemMetrics> {
    if (!this.os) {
      throw new Error('OS module not loaded');
    }

    const totalMem = this.os.totalmem();
    const freeMem = this.os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      cpu: {
        usage: this.getCPUUsage(),
        loadAvg: this.os.loadavg(),
      },
      memory: {
        used: usedMem,
        total: totalMem,
        percentage: (usedMem / totalMem) * 100,
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
      },
      timestamp: new Date(),
    };
  }

  private getCPUUsage(): number {
    // 简化实现，使用负载平均值估算
    if (!this.os) return 0;
    const loadAvg = this.os.loadavg()[0];
    const cpus = this.os.cpus().length;
    return Math.min(100, (loadAvg / cpus) * 100);
  }

  private isSystemHealthy(): boolean {
    if (!this.metrics) return true;

    return (
      this.metrics.cpu.usage < this.config.cpuThreshold &&
      this.metrics.memory.percentage < this.config.memoryThreshold &&
      this.hormoneState[HormoneType.FATIGUE] < this.config.fatigueThreshold
    );
  }

  /**
   * 获取当前系统指标
   */
  getMetrics(): SystemMetrics | null {
    return this.metrics;
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private insertTaskByPriority(queue: Task[], task: Task): void {
    const index = queue.findIndex(t => t.priority > task.priority);
    if (index === -1) {
      queue.push(task);
    } else {
      queue.splice(index, 0, task);
    }
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    neural: number;
    endocrine: number;
    running: number;
  } {
    return {
      neural: this.neuralQueue.length,
      endocrine: this.endocrineQueue.length,
      running: this.runningTasks.size,
    };
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    const controller = this.runningTasks.get(taskId);
    if (controller) {
      controller.abort();
      this.runningTasks.delete(taskId);
      this.emit('taskCancelled', { taskId });
      return true;
    }

    // 从队列中移除
    const neuralIndex = this.neuralQueue.findIndex(t => t.id === taskId);
    if (neuralIndex !== -1) {
      this.neuralQueue.splice(neuralIndex, 1);
      this.emit('taskCancelled', { taskId });
      return true;
    }

    const endocrineIndex = this.endocrineQueue.findIndex(t => t.id === taskId);
    if (endocrineIndex !== -1) {
      this.endocrineQueue.splice(endocrineIndex, 1);
      this.emit('taskCancelled', { taskId });
      return true;
    }

    return false;
  }
}

export default NeuroEndocrineScheduler;
