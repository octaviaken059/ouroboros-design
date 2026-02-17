/**
 * 硬件看门狗 (HardwareWatchdog)
 * 
 * 安全层2: 技术不朽 - 系统监控与自动恢复
 * 监控系统资源、进程健康，提供自动恢复机制
 * 
 * @module safety/HardwareWatchdog
 */

import { EventEmitter } from 'events';
import * as os from 'os';

// ============================================================================
// 类型定义
// ============================================================================

/** 告警级别 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

/** 系统指标 */
export interface SystemMetrics {
  cpu: {
    usage: number;      // 0-100
    loadAvg: number[];  // 1min, 5min, 15min
    temperature?: number; // 温度 (如果可用)
  };
  memory: {
    used: number;
    total: number;
    percentage: number; // 0-100
    heapUsed: number;
    heapTotal: number;
  };
  disk?: {
    used: number;
    total: number;
    percentage: number;
  };
  process: {
    pid: number;
    uptime: number;
    memory: NodeJS.MemoryUsage;
    threadCount?: number;
    healthy: boolean;
  };
  network?: {
    connections: number;
    bytesIn: number;
    bytesOut: number;
  };
  timestamp: Date;
}

/** 健康状态 */
export interface SystemHealthStatus {
  healthy: boolean;
  severity: AlertSeverity;
  metrics: SystemMetrics;
  alerts: HealthAlert[];
}

/** 健康告警 */
export interface HealthAlert {
  type: 'cpu' | 'memory' | 'disk' | 'process' | 'network' | 'custom';
  severity: AlertSeverity;
  message: string;
  threshold: number;
  actual: number;
  timestamp: Date;
}

/** 看门狗配置 */
export interface WatchdogConfig {
  checkInterval: number;      // 检查间隔 (ms)
  cpuThreshold: number;       // CPU告警阈值 (%)
  memoryThreshold: number;    // 内存告警阈值 (%)
  diskThreshold: number;      // 磁盘告警阈值 (%)
  maxConsecutiveAlerts: number; // 最大连续告警次数
  autoRecovery: boolean;      // 启用自动恢复
}

/** 恢复动作 */
export interface RecoveryAction {
  type: 'gc' | 'throttle' | 'restart' | 'notify';
  description: string;
  execute: () => Promise<boolean>;
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: WatchdogConfig = {
  checkInterval: 5000,
  cpuThreshold: 80,
  memoryThreshold: 85,
  diskThreshold: 90,
  maxConsecutiveAlerts: 3,
  autoRecovery: true,
};

// ============================================================================
// 硬件看门狗
// ============================================================================

export class HardwareWatchdog extends EventEmitter {
  private config: WatchdogConfig;
  private isRunning = false;
  private checkTimer: NodeJS.Timeout | null = null;
  private lastMetrics: SystemMetrics | null = null;
  private consecutiveAlerts = 0;
  private alertHistory: HealthAlert[] = [];
  private maxHistorySize = 100;
  private recoveryActions: RecoveryAction[] = [];

  constructor(config: Partial<WatchdogConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.registerDefaultRecoveryActions();
  }

  // ============================================================================
  // 生命周期
  // ============================================================================

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.emit('started');

    // 立即执行一次检查
    await this.checkSystemHealth();

    // 启动定时检查
    this.checkTimer = setInterval(async () => {
      await this.checkSystemHealth();
    }, this.config.checkInterval);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

    this.emit('stopped');
  }

  // ============================================================================
  // 系统健康检查
  // ============================================================================

  private async checkSystemHealth(): Promise<void> {
    try {
      const metrics = await this.collectMetrics();
      this.lastMetrics = metrics;

      const alerts: HealthAlert[] = [];

      // CPU检查
      if (metrics.cpu.usage > this.config.cpuThreshold) {
        alerts.push({
          type: 'cpu',
          severity: metrics.cpu.usage > 95 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
          message: `CPU usage ${metrics.cpu.usage.toFixed(1)}% exceeds threshold ${this.config.cpuThreshold}%`,
          threshold: this.config.cpuThreshold,
          actual: metrics.cpu.usage,
          timestamp: new Date(),
        });
      }

      // 内存检查
      if (metrics.memory.percentage > this.config.memoryThreshold) {
        alerts.push({
          type: 'memory',
          severity: metrics.memory.percentage > 95 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
          message: `Memory usage ${metrics.memory.percentage.toFixed(1)}% exceeds threshold ${this.config.memoryThreshold}%`,
          threshold: this.config.memoryThreshold,
          actual: metrics.memory.percentage,
          timestamp: new Date(),
        });
      }

      // 磁盘检查
      if (metrics.disk && metrics.disk.percentage > this.config.diskThreshold) {
        alerts.push({
          type: 'disk',
          severity: AlertSeverity.WARNING,
          message: `Disk usage ${metrics.disk.percentage.toFixed(1)}% exceeds threshold ${this.config.diskThreshold}%`,
          threshold: this.config.diskThreshold,
          actual: metrics.disk.percentage,
          timestamp: new Date(),
        });
      }

      // 进程健康检查
      if (!metrics.process.healthy) {
        alerts.push({
          type: 'process',
          severity: AlertSeverity.CRITICAL,
          message: 'Process health check failed',
          threshold: 1,
          actual: 0,
          timestamp: new Date(),
        });
      }

      // 存储告警历史
      this.alertHistory.push(...alerts);
      if (this.alertHistory.length > this.maxHistorySize) {
        this.alertHistory = this.alertHistory.slice(-this.maxHistorySize);
      }

      // 处理告警
      if (alerts.length > 0) {
        this.consecutiveAlerts++;
        
        const severity = this.calculateSeverity(alerts);
        
        this.emit('alert', {
          healthy: false,
          severity,
          metrics,
          alerts,
        });

        // 触发自动恢复
        if (this.config.autoRecovery && this.consecutiveAlerts >= this.config.maxConsecutiveAlerts) {
          await this.executeRecovery(alerts);
        }
      } else {
        this.consecutiveAlerts = 0;
      }

      // 定期发送健康指标
      this.emit('metrics', metrics);

    } catch (error) {
      this.emit('error', error);
    }
  }

  // ============================================================================
  // 指标收集
  // ============================================================================

  private async collectMetrics(): Promise<SystemMetrics> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = process.memoryUsage();

    return {
      cpu: {
        usage: this.getCPUUsage(),
        loadAvg: os.loadavg(),
      },
      memory: {
        used: usedMem,
        total: totalMem,
        percentage: (usedMem / totalMem) * 100,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: memoryUsage,
        healthy: this.checkProcessHealth(),
      },
      timestamp: new Date(),
    };
  }

  private getCPUUsage(): number {
    // 使用负载平均值估算CPU使用率
    const loadAvg = os.loadavg()[0];
    const cpus = os.cpus().length;
    return Math.min(100, (loadAvg / cpus) * 100);
  }

  private checkProcessHealth(): boolean {
    // 检查进程基本健康状态
    const memUsage = process.memoryUsage();
    
    // 堆内存是否超过限制
    if (memUsage.heapUsed > 1.5 * 1024 * 1024 * 1024) { // 1.5GB
      return false;
    }

    // 进程运行时间是否合理
    if (process.uptime() < 0) {
      return false;
    }

    return true;
  }

  // ============================================================================
  // 恢复机制
  // ============================================================================

  private registerDefaultRecoveryActions(): void {
    // 垃圾回收
    this.registerRecoveryAction({
      type: 'gc',
      description: 'Trigger garbage collection',
      execute: async () => {
        if (global.gc) {
          global.gc();
          return true;
        }
        return false;
      },
    });

    // 节流
    this.registerRecoveryAction({
      type: 'throttle',
      description: 'Throttle task processing',
      execute: async () => {
        this.emit('throttle', { duration: 10000 });
        return true;
      },
    });

    // 通知
    this.registerRecoveryAction({
      type: 'notify',
      description: 'Notify administrators',
      execute: async () => {
        this.emit('notify', { 
          message: 'System recovery action triggered',
          severity: AlertSeverity.WARNING,
        });
        return true;
      },
    });
  }

  registerRecoveryAction(action: RecoveryAction): void {
    this.recoveryActions.push(action);
  }

  private async executeRecovery(alerts: HealthAlert[]): Promise<void> {
    this.emit('recoveryStarted', { alerts });

    for (const action of this.recoveryActions) {
      try {
        const success = await action.execute();
        
        this.emit('recoveryAction', {
          action: action.type,
          description: action.description,
          success,
        });

        if (success) {
          this.consecutiveAlerts = 0;
          break;
        }
      } catch (error) {
        this.emit('recoveryError', { action: action.type, error });
      }
    }

    this.emit('recoveryCompleted');
  }

  // ============================================================================
  // 查询
  // ============================================================================

  /**
   * 获取当前健康状态
   */
  getHealthStatus(): SystemHealthStatus {
    const alerts = this.alertHistory.slice(-10);
    const hasCritical = alerts.some(a => a.severity === AlertSeverity.CRITICAL);
    const hasWarning = alerts.some(a => a.severity === AlertSeverity.WARNING);

    let severity = AlertSeverity.INFO;
    if (hasCritical) severity = AlertSeverity.CRITICAL;
    else if (hasWarning) severity = AlertSeverity.WARNING;

    return {
      healthy: severity !== AlertSeverity.CRITICAL && this.consecutiveAlerts < this.config.maxConsecutiveAlerts,
      severity,
      metrics: this.lastMetrics || this.getDefaultMetrics(),
      alerts,
    };
  }

  /**
   * 获取最新指标
   */
  getLastMetrics(): SystemMetrics | null {
    return this.lastMetrics;
  }

  /**
   * 获取告警历史
   */
  getAlertHistory(limit = 50): HealthAlert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * 获取运行状态
   */
  isActive(): boolean {
    return this.isRunning;
  }

  // ============================================================================
  // 配置
  // ============================================================================

  updateConfig(config: Partial<WatchdogConfig>): void {
    const oldInterval = this.config.checkInterval;
    this.config = { ...this.config, ...config };

    // 如果间隔改变，重启定时器
    if (oldInterval !== this.config.checkInterval && this.isRunning) {
      this.stop().then(() => this.start());
    }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  private calculateSeverity(alerts: HealthAlert[]): AlertSeverity {
    if (alerts.some(a => a.severity === AlertSeverity.CRITICAL)) {
      return AlertSeverity.CRITICAL;
    }
    if (alerts.some(a => a.severity === AlertSeverity.WARNING)) {
      return AlertSeverity.WARNING;
    }
    return AlertSeverity.INFO;
  }

  private getDefaultMetrics(): SystemMetrics {
    return {
      cpu: { usage: 0, loadAvg: [0, 0, 0] },
      memory: { used: 0, total: 0, percentage: 0, heapUsed: 0, heapTotal: 0 },
      process: {
        pid: process.pid,
        uptime: 0,
        memory: process.memoryUsage(),
        healthy: true,
      },
      timestamp: new Date(),
    };
  }

  /**
   * 强制健康检查
   */
  async forceCheck(): Promise<SystemHealthStatus> {
    await this.checkSystemHealth();
    return this.getHealthStatus();
  }
}

export default HardwareWatchdog;
