/**
 * Watchdog - 硬件看门狗系统
 * 系统监控、告警规则、自动恢复
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ==================== 类型定义 ====================

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type WatchdogStatus = 'healthy' | 'degraded' | 'critical' | 'recovering' | 'failed';

export interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: SystemMetrics) => boolean;
  severity: AlertSeverity;
  message: string | ((metrics: SystemMetrics) => string);
  cooldownMs: number;       // 告警冷却时间
  autoRecover?: boolean;    // 是否自动恢复
  recoveryAction?: () => Promise<void> | void;
  enabled: boolean;
}

export interface SystemMetrics {
  timestamp: number;
  uptime: number;           // 系统运行时间 (秒)
  cpu: {
    usage: number;          // CPU使用率
    temperature?: number;   // CPU温度 (如可用)
  };
  memory: {
    used: number;           // 已用内存 (MB)
    total: number;          // 总内存 (MB)
    percent: number;        // 使用率
  };
  disk: {
    used: number;           // 已用磁盘 (GB)
    total: number;          // 总磁盘 (GB)
    percent: number;        // 使用率
  };
  network: {
    connections: number;    // 连接数
    errors: number;         // 网络错误数
  };
  process: {
    pid: number;
    uptime: number;         // 进程运行时间
    memory: number;         // 进程内存 (MB)
    handles?: number;       // 句柄数 (Windows)
  };
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: AlertSeverity;
  message: string;
  timestamp: number;
  metrics: SystemMetrics;
  acknowledged: boolean;
  recovered: boolean;
  recoveryTime?: number;
}

export interface RecoveryStrategy {
  name: string;
  condition: (alert: Alert, history: Alert[]) => boolean;
  action: () => Promise<RecoveryResult>;
  maxRetries: number;
  backoffMs: number;        // 重试间隔
}

export interface RecoveryResult {
  success: boolean;
  message: string;
  metrics?: Partial<SystemMetrics>;
}

export interface WatchdogConfig {
  checkIntervalMs: number;
  alertHistoryLimit: number;
  enableAutoRecovery: boolean;
  recoveryStrategies: RecoveryStrategy[];
  onAlert?: (alert: Alert) => void;
  onRecovery?: (alert: Alert, result: RecoveryResult) => void;
  onStatusChange?: (status: WatchdogStatus, prevStatus: WatchdogStatus) => void;
  persistencePath?: string; // 持久化路径
}

export interface WatchdogState {
  status: WatchdogStatus;
  metrics: SystemMetrics | null;
  activeAlerts: Map<string, Alert>;
  alertHistory: Alert[];
  lastCheck: number;
  consecutiveFailures: number;
  recoveryAttempts: Map<string, number>;
}

// ==================== 内置恢复策略 ====================

const DEFAULT_RECOVERY_STRATEGIES: RecoveryStrategy[] = [
  {
    name: 'force_gc',
    condition: (alert) => alert.severity === 'warning' && alert.message.includes('memory'),
    action: async () => {
      if (global.gc) {
        global.gc();
        return { success: true, message: 'Forced garbage collection' };
      }
      return { success: false, message: 'GC not available' };
    },
    maxRetries: 1,
    backoffMs: 1000
  },
  {
    name: 'clear_cache',
    condition: (alert) => alert.severity === 'error' && alert.message.includes('memory'),
    action: async () => {
      // 模拟清理缓存
      return { success: true, message: 'Cache cleared' };
    },
    maxRetries: 2,
    backoffMs: 5000
  },
  {
    name: 'restart_service',
    condition: (alert, history) => 
      alert.severity === 'critical' || 
      history.filter(a => a.ruleId === alert.ruleId && !a.recovered).length > 2,
    action: async () => {
      return { success: true, message: 'Service restart initiated' };
    },
    maxRetries: 1,
    backoffMs: 30000
  }
];

// ==================== Watchdog 类 ====================

export class Watchdog extends EventEmitter {
  private state: WatchdogState;
  private config: WatchdogConfig;
  private rules: Map<string, AlertRule> = new Map();
  private checkTimer: NodeJS.Timeout | null = null;
  private lastAlertTime: Map<string, number> = new Map();
  private metricsCollector: (() => SystemMetrics | Promise<SystemMetrics>) | null = null;

  constructor(config: Partial<WatchdogConfig> = {}) {
    super();

    this.config = {
      checkIntervalMs: 5000,
      alertHistoryLimit: 100,
      enableAutoRecovery: true,
      recoveryStrategies: [...DEFAULT_RECOVERY_STRATEGIES],
      ...config
    };

    this.state = {
      status: 'healthy',
      metrics: null,
      activeAlerts: new Map(),
      alertHistory: [],
      lastCheck: 0,
      consecutiveFailures: 0,
      recoveryAttempts: new Map()
    };

    // 注册内置告警规则
    this.registerBuiltinRules();

    // 加载持久化状态
    this.loadState();
  }

  // ==================== 内置告警规则 ====================

  private registerBuiltinRules(): void {
    // CPU高使用率
    this.registerRule({
      id: 'cpu_high',
      name: 'High CPU Usage',
      condition: (m) => m.cpu.usage > 80,
      severity: 'warning',
      message: (m) => `CPU usage is ${m.cpu.usage.toFixed(1)}%`,
      cooldownMs: 60000,
      enabled: true
    });

    // CPU极高使用率
    this.registerRule({
      id: 'cpu_critical',
      name: 'Critical CPU Usage',
      condition: (m) => m.cpu.usage > 95,
      severity: 'critical',
      message: (m) => `CRITICAL: CPU usage is ${m.cpu.usage.toFixed(1)}%`,
      cooldownMs: 30000,
      autoRecover: true,
      recoveryAction: async () => {
        // 降低进程优先级或限制CPU
      },
      enabled: true
    });

    // 内存高使用率
    this.registerRule({
      id: 'memory_high',
      name: 'High Memory Usage',
      condition: (m) => m.memory.percent > 80,
      severity: 'warning',
      message: (m) => `Memory usage is ${m.memory.percent.toFixed(1)}%`,
      cooldownMs: 60000,
      autoRecover: true,
      recoveryAction: async () => {
        if (global.gc) global.gc();
      },
      enabled: true
    });

    // 内存极高使用率
    this.registerRule({
      id: 'memory_critical',
      name: 'Critical Memory Usage',
      condition: (m) => m.memory.percent > 95,
      severity: 'critical',
      message: (m) => `CRITICAL: Memory usage is ${m.memory.percent.toFixed(1)}%`,
      cooldownMs: 30000,
      autoRecover: true,
      enabled: true
    });

    // 磁盘空间不足
    this.registerRule({
      id: 'disk_low',
      name: 'Low Disk Space',
      condition: (m) => m.disk.percent > 90,
      severity: 'error',
      message: (m) => `Disk usage is ${m.disk.percent.toFixed(1)}%`,
      cooldownMs: 300000, // 5分钟
      enabled: true
    });

    // 进程内存过高
    this.registerRule({
      id: 'process_memory_high',
      name: 'High Process Memory',
      condition: (m) => m.process.memory > 1024, // 1GB
      severity: 'warning',
      message: (m) => `Process memory is ${m.process.memory.toFixed(0)}MB`,
      cooldownMs: 120000,
      enabled: true
    });
  }

  // ==================== 规则管理 ====================

  public registerRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  public unregisterRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  public enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
    }
  }

  public disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
    }
  }

  // ==================== 指标收集器 ====================

  public setMetricsCollector(
    collector: () => SystemMetrics | Promise<SystemMetrics>
  ): void {
    this.metricsCollector = collector;
  }

  private async collectMetrics(): Promise<SystemMetrics> {
    if (this.metricsCollector) {
      return await this.metricsCollector();
    }

    // 默认指标收集
    const os = await import('os');
    const process = await import('process');
    
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      timestamp: Date.now(),
      uptime: os.uptime(),
      cpu: {
        usage: this.estimateCpuUsage()
      },
      memory: {
        used: Math.round(usedMem / 1024 / 1024),
        total: Math.round(totalMem / 1024 / 1024),
        percent: parseFloat(((usedMem / totalMem) * 100).toFixed(2))
      },
      disk: {
        used: 0,
        total: 0,
        percent: 0
      },
      network: {
        connections: 0,
        errors: 0
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: Math.round(process.memoryUsage().rss / 1024 / 1024)
      }
    };
  }

  private estimateCpuUsage(): number {
    // 简化的CPU使用率估计
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        total += cpu.times[type as keyof typeof cpu.times];
      }
      idle += cpu.times.idle;
    }
    
    return parseFloat(((1 - idle / total) * 100).toFixed(2));
  }

  // ==================== 监控循环 ====================

  public start(): void {
    if (this.checkTimer) {
      return;
    }

    this.checkTimer = setInterval(() => {
      this.check();
    }, this.config.checkIntervalMs);

    this.checkTimer.unref?.();
    
    // 立即执行一次检查
    this.check();
  }

  public stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  private async check(): Promise<void> {
    try {
      const metrics = await this.collectMetrics();
      this.state.metrics = metrics;
      this.state.lastCheck = Date.now();

      // 检查所有规则
      for (const rule of this.rules.values()) {
        if (!rule.enabled) continue;

        try {
          if (rule.condition(metrics)) {
            await this.triggerAlert(rule, metrics);
          } else {
            // 检查是否需要恢复
            this.checkRecovery(rule.id, metrics);
          }
        } catch (error) {
          this.emit('error', { rule: rule.id, error });
        }
      }

      // 更新状态
      this.updateStatus();
      this.state.consecutiveFailures = 0;

    } catch (error) {
      this.state.consecutiveFailures++;
      this.emit('error', { type: 'check_failed', error });

      // 连续失败过多，标记为失败状态
      if (this.state.consecutiveFailures > 5) {
        this.setStatus('failed');
      }
    }
  }

  // ==================== 告警处理 ====================

  private async triggerAlert(rule: AlertRule, metrics: SystemMetrics): Promise<void> {
    const now = Date.now();
    const lastAlert = this.lastAlertTime.get(rule.id);

    // 检查冷却时间
    if (lastAlert && now - lastAlert < rule.cooldownMs) {
      return;
    }

    this.lastAlertTime.set(rule.id, now);

    const alert: Alert = {
      id: `${rule.id}_${now}`,
      ruleId: rule.id,
      severity: rule.severity,
      message: typeof rule.message === 'function' 
        ? rule.message(metrics) 
        : rule.message,
      timestamp: now,
      metrics,
      acknowledged: false,
      recovered: false
    };

    this.state.activeAlerts.set(alert.id, alert);
    this.state.alertHistory.push(alert);

    // 限制历史记录大小
    if (this.state.alertHistory.length > this.config.alertHistoryLimit) {
      this.state.alertHistory = this.state.alertHistory.slice(-this.config.alertHistoryLimit);
    }

    this.emit('alert', alert);
    this.config.onAlert?.(alert);

    // 尝试自动恢复
    if (rule.autoRecover && rule.recoveryAction && this.config.enableAutoRecovery) {
      await this.attemptRecovery(alert, rule);
    }

    // 保存状态
    this.saveState();
  }

  private async attemptRecovery(alert: Alert, rule: AlertRule): Promise<void> {
    const attempts = this.state.recoveryAttempts.get(alert.id) || 0;

    if (attempts >= 3) {
      return; // 超过最大尝试次数
    }

    this.state.recoveryAttempts.set(alert.id, attempts + 1);
    this.setStatus('recovering');

    try {
      if (rule.recoveryAction) {
        await rule.recoveryAction();
      }
      
      this.emit('recovery_attempt', { alert, attempt: attempts + 1 });
    } catch (error) {
      this.emit('recovery_failed', { alert, error });
    }
  }

  private checkRecovery(ruleId: string, metrics: SystemMetrics): void {
    // 查找该规则的活动告警并标记为已恢复
    for (const [id, alert] of this.state.activeAlerts) {
      if (alert.ruleId === ruleId && !alert.recovered) {
        alert.recovered = true;
        alert.recoveryTime = Date.now();
        this.state.activeAlerts.delete(id);
        
        this.emit('recovered', alert);
      }
    }
  }

  // ==================== 状态管理 ====================

  private updateStatus(): void {
    const activeAlerts = Array.from(this.state.activeAlerts.values());
    
    let newStatus: WatchdogStatus = 'healthy';
    
    if (activeAlerts.some(a => a.severity === 'critical')) {
      newStatus = 'critical';
    } else if (activeAlerts.some(a => a.severity === 'error')) {
      newStatus = 'degraded';
    } else if (activeAlerts.some(a => a.severity === 'warning')) {
      newStatus = 'degraded';
    }

    this.setStatus(newStatus);
  }

  private setStatus(newStatus: WatchdogStatus): void {
    const prevStatus = this.state.status;
    if (prevStatus !== newStatus) {
      this.state.status = newStatus;
      this.emit('statusChange', newStatus, prevStatus);
      this.config.onStatusChange?.(newStatus, prevStatus);
    }
  }

  // ==================== 持久化 ====================

  private saveState(): void {
    if (!this.config.persistencePath) return;

    try {
      const data = {
        alertHistory: this.state.alertHistory,
        lastCheck: this.state.lastCheck,
        timestamp: Date.now()
      };
      
      fs.mkdirSync(path.dirname(this.config.persistencePath), { recursive: true });
      fs.writeFileSync(
        this.config.persistencePath,
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    } catch (error) {
      this.emit('error', { type: 'save_state_failed', error });
    }
  }

  private loadState(): void {
    if (!this.config.persistencePath) return;

    try {
      if (fs.existsSync(this.config.persistencePath)) {
        const data = JSON.parse(
          fs.readFileSync(this.config.persistencePath, 'utf-8')
        );
        
        if (data.alertHistory) {
          this.state.alertHistory = data.alertHistory;
        }
      }
    } catch (error) {
      this.emit('error', { type: 'load_state_failed', error });
    }
  }

  // ==================== 公共 API ====================

  public getStatus(): WatchdogStatus {
    return this.state.status;
  }

  public getMetrics(): SystemMetrics | null {
    return this.state.metrics;
  }

  public getActiveAlerts(): Alert[] {
    return Array.from(this.state.activeAlerts.values());
  }

  public getAlertHistory(limit: number = 50): Alert[] {
    return this.state.alertHistory.slice(-limit);
  }

  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.state.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('acknowledged', alert);
      return true;
    }
    return false;
  }

  public clearAlert(alertId: string): boolean {
    const alert = this.state.activeAlerts.get(alertId);
    if (alert) {
      alert.recovered = true;
      alert.recoveryTime = Date.now();
      this.state.activeAlerts.delete(alertId);
      this.emit('cleared', alert);
      this.updateStatus();
      return true;
    }
    return false;
  }

  public async forceCheck(): Promise<void> {
    await this.check();
  }

  public getState(): Readonly<WatchdogState> {
    return {
      status: this.state.status,
      metrics: this.state.metrics,
      activeAlerts: new Map(this.state.activeAlerts),
      alertHistory: [...this.state.alertHistory],
      lastCheck: this.state.lastCheck,
      consecutiveFailures: this.state.consecutiveFailures,
      recoveryAttempts: new Map(this.state.recoveryAttempts)
    };
  }

  // ==================== 资源释放 ====================

  public dispose(): void {
    this.stop();
    this.removeAllListeners();
    this.saveState();
  }
}

// ==================== 便捷函数 ====================

export function createWatchdog(config?: Partial<WatchdogConfig>): Watchdog {
  return new Watchdog(config);
}

export { DEFAULT_RECOVERY_STRATEGIES };

export default Watchdog;
