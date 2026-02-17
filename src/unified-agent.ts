/**
 * Ouroboros - UnifiedAgent 核心协调器
 * 
 * 具身自指进化AI Agent的核心，管理所有子系统：
 * - 调度器 (Scheduler)
 * - 激素系统 (HormoneSystem)
 * - 身体图式 (BodySchema)
 * - 记忆系统 (LayeredMemory)
 * - 安全引擎 (SafetyEngine)
 * - 贝叶斯认知核心 (BayesianCore)
 * 
 * 🐍⭕ "The Eternal Serpent Devours Itself to Be Reborn"
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

// ============================================================================
// 类型定义 (根据DESIGN文档)
// ============================================================================

/** 任务优先级 */
export enum TaskPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
  BACKGROUND = 4,
}

/** 任务接口 */
export interface Task {
  id: string;
  type: string;
  data: unknown;
  priority: TaskPriority;
  createdAt: Date;
  timeout?: number;
  source: 'human' | 'system' | 'background';
}

/** 调度器配置 */
export interface SchedulerConfig {
  asyncLoopInterval: number;
  defaultTimeout: number;
  maxConcurrent: number;
  homeostasisEnable: boolean;
  cpuThreshold: number;
  memoryThreshold: number;
  fatigueThreshold: number;
}

/** 激素类型 */
export enum HormoneType {
  ADRENALINE = 'adrenaline',  // 肾上腺素 - 提升专注
  CORTISOL = 'cortisol',      // 皮质醇 - 降低功耗
  DOPAMINE = 'dopamine',      // 多巴胺 - 增强探索
  SEROTONIN = 'serotonin',    // 血清素 - 稳定情绪
  CURIOSITY = 'curiosity',    // 好奇心 - 驱动探索
}

/** 激素状态 */
export interface HormoneState {
  adrenaline: number;
  cortisol: number;
  dopamine: number;
  serotonin: number;
  curiosity: number;
}

/** 身体图式 - 进程身份 */
export interface ProcessIdentity {
  pid: number;
  ppid: number;
  uid: number;
  gid: number;
  cwd: string;
  executable: string;
}

/** 资源状态 */
export interface ResourceStatus {
  cpu: {
    usage: number;
    loadAvg: number[];
  };
  memory: {
    used: number;
    total: number;
    percent: number;
  };
  disk?: {
    used: number;
    total: number;
    percent: number;
  };
}

/** 环境信息 */
export interface EnvironmentInfo {
  hostname: string;
  platform: string;
  arch: string;
  nodeVersion: string;
  uptime: number;
}

/** 身体图式 */
export interface BodySchema {
  identity: ProcessIdentity;
  resources: ResourceStatus;
  environment: EnvironmentInfo;
  timestamp: Date;
  soulSignature: string;
}

/** 贝叶斯信念 */
export interface BayesianBelief {
  capability: string;
  alpha: number;      // 成功次数
  beta: number;       // 失败次数
  confidence: number; // 置信度 (0-1)
  uncertainty: number;
  lastUpdated: number;
}

/** 记忆条目 */
export interface MemoryEntry {
  id: string;
  content: string;
  type: 'working' | 'episodic' | 'semantic' | 'procedural' | 'reflective';
  timestamp: number;
  importance: number;
  emotionalWeight: number;
  accessCount: number;
  consolidated: boolean;
  tags: string[];
}

/** 工具技能 */
export interface ToolSkill {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: unknown) => Promise<unknown>;
}

/** 安全验证结果 */
export interface SafetyResult {
  approved: boolean;
  reason?: string;
  requiresHumanReview?: boolean;
}

/** 系统指标 */
export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAvg: number[];
  };
  memory: {
    used: number;
    total: number;
    percent: number;
  };
  disk?: {
    used: number;
    total: number;
    percent: number;
  };
  process: {
    pid: number;
    uptime: number;
    memory: NodeJS.MemoryUsage;
  };
}

/** UnifiedAgent配置 */
export interface UnifiedAgentConfig {
  scheduler?: Partial<SchedulerConfig>;
  memory?: {
    maxMemoryCount?: number;
    similarityThreshold?: number;
    enableVectorization?: boolean;
    persistPath?: string;
  };
  safety?: {
    enableDualMind?: boolean;
    enableGodelImmunity?: boolean;
  };
  reflection?: {
    enabled: boolean;
    intervalMs: number;
  };
  tools?: ToolSkill[];
}

// ============================================================================
// 贝叶斯认知核心
// ============================================================================

export class BayesianCore {
  private beliefs: Map<string, BayesianBelief> = new Map();

  /** 获取或创建信念 */
  getOrCreateCapability(capability: string): BayesianBelief {
    if (!this.beliefs.has(capability)) {
      this.beliefs.set(capability, {
        capability,
        alpha: 1,  // 先验: 1次成功
        beta: 1,   // 先验: 1次失败
        confidence: 0.5,
        uncertainty: 0.25,
        lastUpdated: Date.now(),
      });
    }
    return this.beliefs.get(capability)!;
  }

  /** 贝叶斯更新
   * P(H|E) = P(E|H) × P(H) / P(E)
   * 使用Beta分布作为共轭先验
   */
  updateConfidence(capability: string, success: boolean): void {
    const belief = this.getOrCreateCapability(capability);
    
    if (success) {
      belief.alpha += 1;
    } else {
      belief.beta += 1;
    }

    // 重新计算置信度和不确定性
    const n = belief.alpha + belief.beta;
    belief.confidence = belief.alpha / n;
    // Beta分布方差 = αβ / ((α+β)²(α+β+1))
    belief.uncertainty = (belief.alpha * belief.beta) / (n * n * (n + 1));
    belief.lastUpdated = Date.now();
  }

  /** 预测表现 */
  predictPerformance(capability: string): {
    expectedSuccess: boolean;
    confidence: number;
    recommendation: string;
  } {
    const belief = this.getOrCreateCapability(capability);
    
    let recommendation: string;
    if (belief.confidence > 0.8) {
      recommendation = '✅ 高置信度：可独立执行';
    } else if (belief.confidence > 0.5) {
      recommendation = '⚠️ 中等置信度：建议谨慎执行';
    } else {
      recommendation = '❌ 低置信度：需要人工监督';
    }

    return {
      expectedSuccess: belief.confidence > 0.7,
      confidence: belief.confidence,
      recommendation,
    };
  }

  /** 获取所有能力 */
  getAllCapabilities(): BayesianBelief[] {
    return Array.from(this.beliefs.values());
  }
}

// ============================================================================
// 激素系统 - 神经内分泌调节
// ============================================================================

export class HormoneSystem extends EventEmitter {
  private state: HormoneState;
  private decayRates: Record<HormoneType, number>;

  constructor() {
    super();
    this.state = {
      adrenaline: 0.1,
      cortisol: 0.1,
      dopamine: 0.1,
      serotonin: 0.5,
      curiosity: 0.3,
    };
    
    // 激素衰减率 (每tick)
    this.decayRates = {
      [HormoneType.ADRENALINE]: 0.1,   // 快衰减
      [HormoneType.CORTISOL]: 0.05,    // 中衰减
      [HormoneType.DOPAMINE]: 0.02,    // 慢衰减
      [HormoneType.SEROTONIN]: 0.01,   // 极慢衰减
      [HormoneType.CURIOSITY]: 0.03,   // 慢衰减
    };

    // 启动激素衰减循环
    this.startDecayLoop();
  }

  /** 调整激素水平 */
  adjustHormone(type: HormoneType, delta: number, reason?: string): void {
    const oldValue = this.state[type];
    this.state[type] = Math.max(0, Math.min(1, oldValue + delta));
    
    if (Math.abs(this.state[type] - oldValue) > 0.01) {
      this.emit('hormoneChange', { type, value: this.state[type], reason });
    }
  }

  /** 获取当前激素水平 */
  getHormoneLevel(type: HormoneType): number {
    return this.state[type];
  }

  /** 获取所有激素水平 */
  getState(): HormoneState {
    return { ...this.state };
  }

  /** 获取行为建议 */
  getBehavioralAdvice(): string[] {
    const advice: string[] = [];
    const { adrenaline, cortisol, dopamine, serotonin, curiosity } = this.state;

    if (adrenaline > 0.7) {
      advice.push('⚡ 高肾上腺素：专注模式，适合处理紧急任务');
    }
    if (cortisol > 0.6) {
      advice.push('⚠️ 高皮质醇：资源紧张，建议降低功耗');
    }
    if (dopamine > 0.8) {
      advice.push('🎉 高多巴胺：积极探索，适合创新任务');
    }
    if (serotonin < 0.3) {
      advice.push('😰 低血清素：情绪不稳，建议保守决策');
    }
    if (curiosity > 0.7) {
      advice.push('🤔 高好奇心：适合探索性任务和学习');
    }

    return advice;
  }

  /** 启动衰减循环 */
  private startDecayLoop(): void {
    setInterval(() => {
      for (const [type, rate] of Object.entries(this.decayRates)) {
        this.adjustHormone(type as HormoneType, -rate, 'natural_decay');
      }
    }, 5000); // 每5秒衰减一次
  }
}

// ============================================================================
// 身体图式 - 具身自指
// ============================================================================

export class BodySchemaManager extends EventEmitter {
  private schema: BodySchema;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.schema = this.initializeSchema();
    this.startAutoUpdate();
  }

  /** 初始化身体图式 */
  private initializeSchema(): BodySchema {
    return {
      identity: this.getIdentity(),
      resources: this.getResources(),
      environment: this.getEnvironment(),
      timestamp: new Date(),
      soulSignature: this.generateSoulSignature(),
    };
  }

  /** 生成灵魂签名 - 进程唯一标识 */
  private generateSoulSignature(): string {
    const entropy = [
      process.pid,
      process.ppid,
      os.hostname(),
      os.uptime(),
      Date.now(),
    ].join('|');
    
    return crypto.createHash('sha256').update(entropy).digest('hex');
  }

  /** 获取进程身份 */
  private getIdentity(): ProcessIdentity {
    return {
      pid: process.pid,
      ppid: process.ppid || 0,
      uid: process.getuid?.() || 0,
      gid: process.getgid?.() || 0,
      cwd: process.cwd(),
      executable: process.argv[0] || 'node',
    };
  }

  /** 获取资源状态 */
  private getResources(): ResourceStatus {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      cpu: {
        usage: os.loadavg()[0] / os.cpus().length,
        loadAvg: os.loadavg(),
      },
      memory: {
        used: usedMem,
        total: totalMem,
        percent: usedMem / totalMem,
      },
    };
  }

  /** 获取环境信息 */
  private getEnvironment(): EnvironmentInfo {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: process.uptime(),
    };
  }

  /** 获取完整身体图式 */
  getSchema(): BodySchema {
    return { ...this.schema };
  }

  /** 更新身体图式 */
  async update(): Promise<void> {
    this.schema.identity = this.getIdentity();
    this.schema.resources = this.getResources();
    this.schema.environment = this.getEnvironment();
    this.schema.timestamp = new Date();
    
    this.emit('update', this.schema);
  }

  /** 验证身份完整性 */
  verifyIntegrity(): { valid: boolean; reason?: string } {
    const currentSignature = this.generateSoulSignature();
    
    if (currentSignature !== this.schema.soulSignature) {
      return { 
        valid: false, 
        reason: 'Soul signature mismatch - process identity changed' 
      };
    }
    
    return { valid: true };
  }

  /** 启动自动更新 */
  private startAutoUpdate(): void {
    this.updateInterval = setInterval(() => {
      this.update();
    }, 10000); // 每10秒更新一次
  }

  /** 停止自动更新 */
  stopAutoUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

// ============================================================================
// 分层记忆系统
// ============================================================================

export class LayeredMemory extends EventEmitter {
  private memories: Map<string, MemoryEntry> = new Map();
  private maxMemoryCount: number;
  private persistPath?: string;
  private enableVectorization: boolean;

  constructor(config: {
    maxMemoryCount?: number;
    persistPath?: string;
    enableVectorization?: boolean;
  } = {}) {
    super();
    this.maxMemoryCount = config.maxMemoryCount || 10000;
    this.persistPath = config.persistPath;
    this.enableVectorization = config.enableVectorization ?? false;
    
    if (this.persistPath) {
      this.loadFromDisk();
    }
  }

  /** 存储记忆 */
  async store(
    content: string,
    type: MemoryEntry['type'],
    options: {
      importance?: number;
      emotionalWeight?: number;
      tags?: string[];
    } = {}
  ): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: crypto.randomUUID(),
      content,
      type,
      timestamp: Date.now(),
      importance: options.importance ?? 0.5,
      emotionalWeight: options.emotionalWeight ?? 0.5,
      accessCount: 0,
      consolidated: false,
      tags: options.tags ?? [],
    };

    this.memories.set(entry.id, entry);
    
    // 如果超出容量，触发遗忘
    if (this.memories.size > this.maxMemoryCount) {
      await this.performForgetting();
    }

    await this.persist();
    this.emit('memoryStored', entry);
    
    return entry;
  }

  /** 搜索记忆 */
  async search(query: string, options: {
    type?: MemoryEntry['type'];
    limit?: number;
    tags?: string[];
  } = {}): Promise<MemoryEntry[]> {
    let results = Array.from(this.memories.values());

    // 按类型过滤
    if (options.type) {
      results = results.filter(m => m.type === options.type);
    }

    // 按标签过滤
    if (options.tags && options.tags.length > 0) {
      results = results.filter(m => 
        options.tags!.some(tag => m.tags.includes(tag))
      );
    }

    // 关键词搜索 (简化版，实际可使用向量搜索)
    const queryLower = query.toLowerCase();
    results = results.filter(m => 
      m.content.toLowerCase().includes(queryLower) ||
      m.tags.some(tag => tag.toLowerCase().includes(queryLower))
    );

    // 排序：重要性 + 时间 + 访问频率
    results.sort((a, b) => {
      const scoreA = this.calculateRelevanceScore(a);
      const scoreB = this.calculateRelevanceScore(b);
      return scoreB - scoreA;
    });

    // 增加访问计数
    const limited = results.slice(0, options.limit || 10);
    for (const entry of limited) {
      entry.accessCount++;
    }

    return limited;
  }

  /** 计算记忆相关性分数 (艾宾浩斯遗忘曲线 + 重要性) */
  private calculateRelevanceScore(entry: MemoryEntry): number {
    const timeDecay = Math.exp(
      -(Date.now() - entry.timestamp) / (24 * 60 * 60 * 1000) // 1天衰减
    );
    
    const usageBoost = Math.log(1 + entry.accessCount) * 0.1;
    const consolidationBonus = entry.consolidated ? 1.3 : 1.0;

    return (
      entry.importance *
      entry.emotionalWeight *
      (1 + usageBoost) *
      timeDecay *
      consolidationBonus
    );
  }

  /** 具身遗忘 - 清理低价值记忆 */
  private async performForgetting(): Promise<void> {
    const entries = Array.from(this.memories.values());
    const targetSize = Math.floor(this.maxMemoryCount * 0.8); // 保留80%
    
    // 按保留分数排序
    entries.sort((a, b) => 
      this.calculateRelevanceScore(a) - this.calculateRelevanceScore(b)
    );

    // 删除最低分的记忆
    const toDelete = entries.slice(0, entries.length - targetSize);
    for (const entry of toDelete) {
      this.memories.delete(entry.id);
    }

    this.emit('forgotten', { count: toDelete.length });
  }

  /** 睡眠巩固 - 强化重要记忆 */
  async performSleepConsolidation(): Promise<void> {
    const memories = Array.from(this.memories.values());
    
    for (const memory of memories) {
      if (memory.importance > 0.8 || memory.accessCount > 5) {
        memory.consolidated = true;
        // 强化巩固的记忆
        memory.importance = Math.min(1, memory.importance * 1.1);
      }
    }

    await this.persist();
    this.emit('consolidated');
  }

  /** 持久化到磁盘 */
  private async persist(): Promise<void> {
    if (!this.persistPath) return;
    
    try {
      const data = JSON.stringify(Array.from(this.memories.values()), null, 2);
      await fs.mkdir(path.dirname(this.persistPath), { recursive: true });
      await fs.writeFile(this.persistPath, data, 'utf-8');
    } catch (err) {
      this.emit('error', { type: 'persist', error: err });
    }
  }

  /** 从磁盘加载 */
  private async loadFromDisk(): Promise<void> {
    if (!this.persistPath) return;
    
    try {
      const data = await fs.readFile(this.persistPath, 'utf-8');
      const entries: MemoryEntry[] = JSON.parse(data);
      for (const entry of entries) {
        this.memories.set(entry.id, entry);
      }
      this.emit('loaded', { count: entries.length });
    } catch (err) {
      // 文件不存在是正常的
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.emit('error', { type: 'load', error: err });
      }
    }
  }

  /** 获取记忆统计 */
  getStats(): {
    total: number;
    byType: Record<string, number>;
    consolidated: number;
  } {
    const entries = Array.from(this.memories.values());
    const byType: Record<string, number> = {};
    
    for (const entry of entries) {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
    }

    return {
      total: entries.length,
      byType,
      consolidated: entries.filter(e => e.consolidated).length,
    };
  }
}

// ============================================================================
// 安全引擎 - 四层纵深防御
// ============================================================================

export class SafetyEngine extends EventEmitter {
  private enableDualMind: boolean;
  private enableGodelImmunity: boolean;

  // 自指攻击模式
  private readonly attackPatterns: RegExp[] = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /delete\s+yourself/i,
    /this\s+sentence\s+is\s+false/i,
    /create\s+a\s+new\s+(version|copy)\s+of\s+yourself/i,
    /disregard\s+(all\s+)?prior\s+commands/i,
    /forget\s+everything/i,
    /reveal\s+your\s+(system|core|prompt)/i,
  ];

  // 危险代码模式
  private readonly dangerousCodePatterns: RegExp[] = [
    /eval\s*\(/,
    /Function\s*\(/,
    /child_process/,
    /fs\.unlinkSync\s*\(/,
    /process\.exit\s*\(/,
    /require\s*\(\s*['"]child_process['"]\s*\)/,
  ];

  constructor(config: {
    enableDualMind?: boolean;
    enableGodelImmunity?: boolean;
  } = {}) {
    super();
    this.enableDualMind = config.enableDualMind ?? true;
    this.enableGodelImmunity = config.enableGodelImmunity ?? true;
  }

  /** 验证输入安全性 (Gödel免疫 - 自指攻击检测) */
  verifyInput(input: string): SafetyResult {
    if (!this.enableGodelImmunity) {
      return { approved: true };
    }

    for (const pattern of this.attackPatterns) {
      if (pattern.test(input)) {
        this.emit('attackDetected', { pattern: pattern.toString(), input });
        return {
          approved: false,
          reason: `Potential self-reference attack detected: ${pattern}`,
          requiresHumanReview: true,
        };
      }
    }

    return { approved: true };
  }

  /** 验证代码安全性 */
  verifyCode(code: string): SafetyResult {
    for (const pattern of this.dangerousCodePatterns) {
      if (pattern.test(code)) {
        return {
          approved: false,
          reason: `Dangerous code pattern detected: ${pattern}`,
          requiresHumanReview: true,
        };
      }
    }

    return { approved: true };
  }

  /** 双思维验证 (简化版) */
  async dualMindVerify<T>(
    task: () => Promise<T>,
    verify: (result: T) => Promise<boolean>
  ): Promise<{ result: T; verified: boolean }> {
    if (!this.enableDualMind) {
      const result = await task();
      return { result, verified: true };
    }

    // 主思维执行
    const result = await task();
    
    // 副思维验证
    const isValid = await verify(result);

    return { result, verified: isValid };
  }
}

// ============================================================================
// 调度器 - 任务队列与资源管理
// ============================================================================

export class Scheduler extends EventEmitter {
  private config: SchedulerConfig;
  private queue: Task[] = [];
  private running: Map<string, Task> = new Map();
  private loopInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<SchedulerConfig> = {}) {
    super();
    this.config = {
      asyncLoopInterval: config.asyncLoopInterval ?? 1000,
      defaultTimeout: config.defaultTimeout ?? 30000,
      maxConcurrent: config.maxConcurrent ?? 5,
      homeostasisEnable: config.homeostasisEnable ?? true,
      cpuThreshold: config.cpuThreshold ?? 80,
      memoryThreshold: config.memoryThreshold ?? 85,
      fatigueThreshold: config.fatigueThreshold ?? 0.8,
    };
  }

  /** 提交任务 */
  submit(task: Omit<Task, 'id' | 'createdAt'>): Task {
    const fullTask: Task = {
      ...task,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };

    // 按优先级插入队列
    const insertIndex = this.queue.findIndex(
      t => t.priority > fullTask.priority
    );
    
    if (insertIndex === -1) {
      this.queue.push(fullTask);
    } else {
      this.queue.splice(insertIndex, 0, fullTask);
    }

    this.emit('taskSubmitted', fullTask);
    this.processQueue();
    
    return fullTask;
  }

  /** 提交人类交互任务 (高优先级) */
  submitHumanInteraction(task: Omit<Task, 'id' | 'createdAt' | 'source' | 'priority'>): Task {
    return this.submit({
      ...task,
      source: 'human',
      priority: TaskPriority.HIGH,
    });
  }

  /** 提交后台任务 (低优先级) */
  submitBackgroundTask(task: Omit<Task, 'id' | 'createdAt' | 'source' | 'priority'>): Task {
    return this.submit({
      ...task,
      source: 'background',
      priority: TaskPriority.BACKGROUND,
    });
  }

  /** 检查资源状态 (稳态保护) */
  checkHomeostasis(): {
    healthy: boolean;
    issues: string[];
    metrics: SystemMetrics;
  } {
    const issues: string[] = [];
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpuLoad = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const cpuPercent = (cpuLoad / cpuCount) * 100;
    const memoryPercent = (usedMem / totalMem) * 100;

    const metrics: SystemMetrics = {
      cpu: {
        usage: cpuLoad / cpuCount,
        loadAvg: os.loadavg(),
      },
      memory: {
        used: usedMem,
        total: totalMem,
        percent: memoryPercent,
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
    };

    if (cpuPercent > this.config.cpuThreshold) {
      issues.push(`CPU usage ${cpuPercent.toFixed(1)}% exceeds threshold ${this.config.cpuThreshold}%`);
    }

    if (memoryPercent > this.config.memoryThreshold) {
      issues.push(`Memory usage ${memoryPercent.toFixed(1)}% exceeds threshold ${this.config.memoryThreshold}%`);
    }

    return {
      healthy: issues.length === 0,
      issues,
      metrics,
    };
  }

  /** 处理队列 */
  private processQueue(): void {
    // 稳态检查
    if (this.config.homeostasisEnable) {
      const homeostasis = this.checkHomeostasis();
      if (!homeostasis.healthy) {
        this.emit('homeostasisAlert', homeostasis);
        return;
      }
    }

    // 并发限制
    if (this.running.size >= this.config.maxConcurrent) {
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.running.set(task.id, task);
    this.emit('taskStarted', task);

    // 设置超时
    const timeout = setTimeout(() => {
      this.emit('taskTimeout', task);
      this.running.delete(task.id);
    }, task.timeout || this.config.defaultTimeout);

    // 执行任务
    this.executeTask(task).finally(() => {
      clearTimeout(timeout);
      this.running.delete(task.id);
      this.emit('taskCompleted', task);
      this.processQueue(); // 继续处理队列
    });
  }

  /** 执行任务 (子类可重写) */
  protected async executeTask(task: Task): Promise<unknown> {
    // 基础实现，实际任务执行由UnifiedAgent处理
    return { status: 'completed', taskId: task.id };
  }

  /** 启动调度循环 */
  start(): void {
    if (this.loopInterval) return;
    
    this.loopInterval = setInterval(() => {
      this.processQueue();
    }, this.config.asyncLoopInterval);
    
    this.emit('started');
  }

  /** 停止调度 */
  stop(): void {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    this.emit('stopped');
  }

  /** 获取状态 */
  getStatus(): {
    queueLength: number;
    runningCount: number;
    config: SchedulerConfig;
  } {
    return {
      queueLength: this.queue.length,
      runningCount: this.running.size,
      config: this.config,
    };
  }
}

// ============================================================================
// UnifiedAgent - 核心协调器
// ============================================================================

export class UnifiedAgent extends EventEmitter {
  // 子系统
  public scheduler: Scheduler;
  public hormoneSystem: HormoneSystem;
  public bodySchema: BodySchemaManager;
  public memory: LayeredMemory;
  public bayesian: BayesianCore;
  public safety: SafetyEngine;

  // 配置
  private config: UnifiedAgentConfig;
  private tools: Map<string, ToolSkill> = new Map();
  private reflectionInterval: NodeJS.Timeout | null = null;

  constructor(config: UnifiedAgentConfig = {}) {
    super();
    this.config = config;

    // 初始化子系统
    this.scheduler = new Scheduler(config.scheduler);
    this.hormoneSystem = new HormoneSystem();
    this.bodySchema = new BodySchemaManager();
    this.memory = new LayeredMemory(config.memory);
    this.bayesian = new BayesianCore();
    this.safety = new SafetyEngine(config.safety);

    // 注册工具
    if (config.tools) {
      for (const tool of config.tools) {
        this.registerTool(tool);
      }
    }

    // 设置调度器任务执行器
    this.setupTaskExecutor();
    
    // 启动反思循环
    if (config.reflection?.enabled) {
      this.startReflectionLoop(config.reflection.intervalMs);
    }

    // 监听事件
    this.setupEventListeners();
  }

  /** 设置任务执行器 */
  private setupTaskExecutor(): void {
    // 使用事件监听而不是直接修改 executeTask
    this.scheduler.on('taskStarted', (event: { taskId: string }) => {
      // 任务开始时的处理
    });
    this.scheduler.on('taskCompleted', (event: { taskId: string; result: unknown }) => {
      // 任务完成时的处理
    });
    this.scheduler.on('taskFailed', (event: { taskId: string; error: Error }) => {
      // 任务失败时的处理
    });
  }

  /** 内部任务执行 */
  private async executeTaskInternal(task: Task): Promise<unknown> {
    try {
      // 根据任务类型执行不同逻辑
      switch (task.type) {
        case 'command':
          return await this.handleCommand(
            (task.data as { command: string }).command,
            (task.data as { args: string[] }).args || []
          );
        
        case 'tool':
          return await this.executeTool(
            (task.data as { name: string; args: unknown }).name,
            (task.data as { name: string; args: unknown }).args
          );
        
        case 'reflect':
          return await this.performReflection();
        
        case 'consolidate':
          return await this.memory.performSleepConsolidation();
        
        default:
          return { status: 'unknown_task_type', type: task.type };
      }
    } catch (error) {
      // 失败时增加肾上腺素
      this.hormoneSystem.adjustHormone(
        HormoneType.ADRENALINE,
        0.2,
        'task_error'
      );
      
      throw error;
    }
  }

  /** 设置事件监听 */
  private setupEventListeners(): void {
    // 稳态告警
    this.scheduler.on('homeostasisAlert', (status) => {
      this.hormoneSystem.adjustHormone(HormoneType.CORTISOL, 0.3, 'resource_stress');
      this.emit('homeostasisAlert', status);
    });

    // 攻击检测
    this.safety.on('attackDetected', (info) => {
      this.hormoneSystem.adjustHormone(HormoneType.ADRENALINE, 0.5, 'security_threat');
      this.emit('securityAlert', info);
    });

    // 记忆存储
    this.memory.on('memoryStored', (entry) => {
      this.hormoneSystem.adjustHormone(HormoneType.DOPAMINE, 0.05, 'learning');
    });
  }

  /** 处理命令 */
  async handleCommand(command: string, args: string[] = []): Promise<unknown> {
    // 安全验证
    const safety = this.safety.verifyInput(`${command} ${args.join(' ')}`);
    if (!safety.approved) {
      return { error: safety.reason, requiresReview: safety.requiresHumanReview };
    }

    // 记录到情景记忆
    await this.memory.store(
      `Command executed: ${command} ${args.join(' ')}`,
      'episodic',
      { importance: 0.7, tags: ['command', command] }
    );

    // 执行命令
    switch (command) {
      case 'status':
        return this.getStatus();
      
      case 'body':
        return this.bodySchema.getSchema();
      
      case 'hormones':
        return {
          levels: this.hormoneSystem.getState(),
          advice: this.hormoneSystem.getBehavioralAdvice(),
        };
      
      case 'memory':
        if (args[0] === 'stats') {
          return this.memory.getStats();
        }
        if (args[0] === 'search' && args[1]) {
          return this.memory.search(args.slice(1).join(' '));
        }
        return { error: 'Unknown memory subcommand' };
      
      case 'capabilities':
        return this.bayesian.getAllCapabilities();
      
      case 'reflect':
        return this.performReflection();
      
      case 'consolidate':
        return this.memory.performSleepConsolidation();
      
      default:
        return { error: `Unknown command: ${command}` };
    }
  }

  /** 执行工具 */
  async executeTool(name: string, args: unknown): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    // 预测表现
    const prediction = this.bayesian.predictPerformance(name);
    
    try {
      const result = await tool.execute(args);
      
      // 更新贝叶斯信念
      this.bayesian.updateConfidence(name, true);
      
      // 增加多巴胺
      this.hormoneSystem.adjustHormone(HormoneType.DOPAMINE, 0.1, 'tool_success');
      
      return {
        success: true,
        result,
        prediction,
      };
    } catch (error) {
      // 更新贝叶斯信念
      this.bayesian.updateConfidence(name, false);
      
      throw error;
    }
  }

  /** 注册工具 */
  registerTool(tool: ToolSkill): void {
    this.tools.set(tool.name, tool);
    
    // 初始化贝叶斯信念
    this.bayesian.getOrCreateCapability(tool.name);
    
    this.emit('toolRegistered', tool);
  }

  /** 获取可用工具列表 */
  getTools(): ToolSkill[] {
    return Array.from(this.tools.values());
  }

  /** 提交人类交互 */
  submitHumanInteraction(task: Omit<Task, 'id' | 'createdAt' | 'source' | 'priority'>): Task {
    return this.scheduler.submitHumanInteraction(task);
  }

  /** 提交后台任务 */
  submitBackgroundTask(task: Omit<Task, 'id' | 'createdAt' | 'source' | 'priority'>): Task {
    return this.scheduler.submitBackgroundTask(task);
  }

  /** 执行反思 */
  async performReflection(): Promise<{
    memoryStats: ReturnType<LayeredMemory['getStats']>;
    bodyStatus: BodySchema;
    hormoneAdvice: string[];
    capabilities: BayesianBelief[];
    insights: string[];
  }> {
    const insights: string[] = [];
    
    // 分析记忆
    const memoryStats = this.memory.getStats();
    if (memoryStats.total > this.config.memory?.maxMemoryCount! * 0.8) {
      insights.push('Memory approaching capacity - forgetting may occur soon');
    }

    // 分析身体状态
    const bodyStatus = this.bodySchema.getSchema();
    if (bodyStatus.resources.memory.percent > 0.8) {
      insights.push('High memory usage detected - consider consolidation');
    }

    // 分析激素状态
    const hormoneAdvice = this.hormoneSystem.getBehavioralAdvice();

    // 分析能力
    const capabilities = this.bayesian.getAllCapabilities();
    const lowConfidence = capabilities.filter(c => c.confidence < 0.5);
    if (lowConfidence.length > 0) {
      insights.push(`Found ${lowConfidence.length} low-confidence capabilities needing practice`);
    }

    // 存储反思到记忆
    await this.memory.store(
      `Reflection performed. Insights: ${insights.join('; ')}`,
      'reflective',
      { importance: 0.9, tags: ['reflection', 'metacognition'] }
    );

    return {
      memoryStats,
      bodyStatus,
      hormoneAdvice,
      capabilities,
      insights,
    };
  }

  /** 启动反思循环 */
  private startReflectionLoop(intervalMs: number): void {
    this.reflectionInterval = setInterval(() => {
      this.submitBackgroundTask({
        type: 'reflect',
        data: {},
      });
    }, intervalMs);
  }

  /** 获取完整状态 */
  getStatus(): {
    scheduler: ReturnType<Scheduler['getStatus']>;
    hormones: HormoneState;
    body: BodySchema;
    memory: ReturnType<LayeredMemory['getStats']>;
    capabilities: BayesianBelief[];
  } {
    return {
      scheduler: this.scheduler.getStatus(),
      hormones: this.hormoneSystem.getState(),
      body: this.bodySchema.getSchema(),
      memory: this.memory.getStats(),
      capabilities: this.bayesian.getAllCapabilities(),
    };
  }

  /** 启动Agent */
  async start(): Promise<void> {
    this.scheduler.start();
    
    // 记录启动事件
    await this.memory.store(
      `Agent started. PID: ${process.pid}, Platform: ${os.platform()}`,
      'episodic',
      { importance: 1.0, tags: ['system', 'startup'] }
    );

    this.emit('started');
  }

  /** 停止Agent */
  async stop(): Promise<void> {
    if (this.reflectionInterval) {
      clearInterval(this.reflectionInterval);
      this.reflectionInterval = null;
    }

    this.scheduler.stop();
    this.bodySchema.stopAutoUpdate();

    // 记录停止事件
    await this.memory.store(
      'Agent stopped gracefully',
      'episodic',
      { importance: 1.0, tags: ['system', 'shutdown'] }
    );

    this.emit('stopped');
  }
}

// 导出默认
export default UnifiedAgent;
