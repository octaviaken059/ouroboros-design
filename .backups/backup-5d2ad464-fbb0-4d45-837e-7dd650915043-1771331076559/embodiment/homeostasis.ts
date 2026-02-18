/**
 * 稳态保护系统 (Homeostasis)
 * 
 * 借鉴生物学稳态概念，自动检测资源超限并提供降载建议
 * 维持系统稳定运行，防止过载崩溃
 * 
 * 核心功能：
 * - 资源监控（CPU、内存、磁盘）
 * - 健康状态评估
 * - 自动降载建议
 * - 恢复策略
 */

import * as os from 'os';
import { EventEmitter } from 'events';
import { bodySchema, BodySchema, ResourceStatus } from './body-schema.js';
import { hormoneSystem, HormoneType } from './hormone-system.js';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 资源阈值配置
 */
export interface ResourceThresholds {
  cpu: {
    warning: number;      // 警告阈值 (0-1)
    critical: number;     // 临界阈值 (0-1)
    emergency: number;    // 紧急阈值 (0-1)
  };
  memory: {
    warning: number;
    critical: number;
    emergency: number;
  };
  disk: {
    warning: number;
    critical: number;
    emergency: number;
  };
}

/**
 * 健康状态
 */
export type HealthStatus = 'healthy' | 'stressed' | 'degraded' | 'critical';

/**
 * 资源警报
 */
export interface ResourceAlert {
  type: 'cpu' | 'memory' | 'disk' | 'load';
  severity: 'warning' | 'critical' | 'emergency';
  currentValue: number;
  threshold: number;
  message: string;
  timestamp: Date;
  suggestedActions: string[];
}

/**
 * 稳态报告
 */
export interface HomeostasisReport {
  status: HealthStatus;
  score: number;              // 健康分数 (0-100)
  alerts: ResourceAlert[];
  recommendations: string[];
  loadReduction: LoadReductionPlan | null;
  timestamp: Date;
}

/**
 * 降载计划
 */
export interface LoadReductionPlan {
  level: 'light' | 'moderate' | 'severe' | 'emergency';
  actions: LoadReductionAction[];
  estimatedImpact: string;
  durationEstimate: string;
}

export interface LoadReductionAction {
  type: 'throttle' | 'queue' | 'drop' | 'shutdown';
  target: string;
  description: string;
  priority: number;
}

/**
 * 稳态配置
 */
export interface HomeostasisConfig {
  thresholds: ResourceThresholds;
  checkIntervalMs: number;
  enableAutoReduction: boolean;
  maxConsecutiveAlerts: number;
  cooldownPeriodMs: number;
}

// ============================================================================
// 默认配置
// ============================================================================

export const DEFAULT_THRESHOLDS: ResourceThresholds = {
  cpu: {
    warning: 0.60,    // 60%
    critical: 0.75,   // 75%
    emergency: 0.90   // 90%
  },
  memory: {
    warning: 0.70,    // 70%
    critical: 0.85,   // 85%
    emergency: 0.95   // 95%
  },
  disk: {
    warning: 0.80,    // 80%
    critical: 0.90,   // 90%
    emergency: 0.98   // 98%
  }
};

export const DEFAULT_CONFIG: HomeostasisConfig = {
  thresholds: DEFAULT_THRESHOLDS,
  checkIntervalMs: 5000,      // 5秒检查一次
  enableAutoReduction: true,
  maxConsecutiveAlerts: 3,
  cooldownPeriodMs: 30000     // 30秒冷却期
};

// ============================================================================
// 稳态保护类
// ============================================================================

export class Homeostasis extends EventEmitter {
  private config: HomeostasisConfig;
  private checkInterval?: NodeJS.Timeout;
  private lastAlertTime: Map<string, number> = new Map();
  private consecutiveAlerts: Map<string, number> = new Map();
  private currentStatus: HealthStatus = 'healthy';
  private alertHistory: ResourceAlert[] = [];
  private isInReductionMode: boolean = false;
  private reductionPlan: LoadReductionPlan | null = null;

  constructor(config: Partial<HomeostasisConfig> = {}) {
    super();
    
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      thresholds: {
        ...DEFAULT_THRESHOLDS,
        ...config.thresholds
      }
    };
  }

  /**
   * 启动稳态监控
   */
  start(): void {
    this.stop();
    
    console.log('🌡️ 稳态保护系统启动');
    console.log(`   检查间隔: ${this.config.checkIntervalMs}ms`);
    console.log(`   自动降载: ${this.config.enableAutoReduction ? '启用' : '禁用'}`);
    
    // 立即执行一次检查
    this.check();
    
    // 定期监控
    this.checkInterval = setInterval(() => {
      this.check();
    }, this.config.checkIntervalMs);
  }

  /**
   * 停止稳态监控
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }

  /**
   * 执行健康检查
   */
  async check(): Promise<HomeostasisReport> {
    try {
      const schema = await bodySchema.getCurrentSchema();
      const resources = schema.resources;
      
      const alerts = this.evaluateResources(resources);
      const status = this.calculateStatus(alerts);
      const score = this.calculateHealthScore(resources, alerts);
      const recommendations = this.generateRecommendations(alerts, status);
      const loadReduction = this.shouldReduceLoad(alerts, status) 
        ? this.generateLoadReductionPlan(alerts) 
        : null;
      
      // 更新状态
      const previousStatus = this.currentStatus;
      this.currentStatus = status;
      
      const report: HomeostasisReport = {
        status,
        score,
        alerts,
        recommendations,
        loadReduction,
        timestamp: new Date()
      };
      
      // 触发事件
      if (alerts.length > 0) {
        this.emit('alerts', alerts);
        
        // 记录警报历史
        this.alertHistory.push(...alerts);
        if (this.alertHistory.length > 100) {
          this.alertHistory = this.alertHistory.slice(-100);
        }
      }
      
      // 状态变化时触发
      if (previousStatus !== status) {
        this.emit('statusChange', { from: previousStatus, to: status });
        this.onStatusChange(previousStatus, status);
      }
      
      // 如果需要降载且启用自动降载
      if (loadReduction && this.config.enableAutoReduction && !this.isInReductionMode) {
        this.emit('loadReductionRequired', loadReduction);
        this.applyLoadReduction(loadReduction);
      }
      
      return report;
    } catch (error) {
      console.error('稳态检查错误:', error);
      
      return {
        status: 'critical',
        score: 0,
        alerts: [{
          type: 'load',
          severity: 'critical',
          currentValue: 1,
          threshold: 0,
          message: '稳态检查失败: ' + (error as Error).message,
          timestamp: new Date(),
          suggestedActions: ['检查系统日志', '重启监控服务']
        }],
        recommendations: ['立即检查系统状态'],
        loadReduction: this.generateEmergencyPlan(),
        timestamp: new Date()
      };
    }
  }

  /**
   * 评估资源状态
   */
  private evaluateResources(resources: ResourceStatus): ResourceAlert[] {
    const alerts: ResourceAlert[] = [];
    const thresholds = this.config.thresholds;
    const now = Date.now();
    
    // 检查CPU
    const cpuUsage = resources.cpu.usage;
    const cpuSeverity = this.getSeverity(cpuUsage, thresholds.cpu);
    if (cpuSeverity) {
      const alert = this.createAlert('cpu', cpuSeverity, cpuUsage, 
        cpuSeverity === 'emergency' ? thresholds.cpu.emergency :
        cpuSeverity === 'critical' ? thresholds.cpu.critical : thresholds.cpu.warning,
        `CPU使用率 ${(cpuUsage * 100).toFixed(1)}%`
      );
      
      if (this.shouldTriggerAlert('cpu', now)) {
        alerts.push(alert);
        this.recordAlert('cpu', now);
      }
    }
    
    // 检查内存
    const memUsage = resources.memory.usagePercent;
    const memSeverity = this.getSeverity(memUsage, thresholds.memory);
    if (memSeverity) {
      const alert = this.createAlert('memory', memSeverity, memUsage,
        memSeverity === 'emergency' ? thresholds.memory.emergency :
        memSeverity === 'critical' ? thresholds.memory.critical : thresholds.memory.warning,
        `内存使用率 ${(memUsage * 100).toFixed(1)}%`
      );
      
      if (this.shouldTriggerAlert('memory', now)) {
        alerts.push(alert);
        this.recordAlert('memory', now);
      }
    }
    
    // 检查磁盘
    const diskUsage = resources.disk.usagePercent;
    if (diskUsage > 0) {  // 只有成功获取磁盘信息才检查
      const diskSeverity = this.getSeverity(diskUsage, thresholds.disk);
      if (diskSeverity) {
        const alert = this.createAlert('disk', diskSeverity, diskUsage,
          diskSeverity === 'emergency' ? thresholds.disk.emergency :
          diskSeverity === 'critical' ? thresholds.disk.critical : thresholds.disk.warning,
          `磁盘使用率 ${(diskUsage * 100).toFixed(1)}%`
        );
        
        if (this.shouldTriggerAlert('disk', now)) {
          alerts.push(alert);
          this.recordAlert('disk', now);
        }
      }
    }
    
    // 检查负载
    const loadAvg = resources.cpu.loadAvg[0];
    const cpuCount = resources.cpu.count;
    const loadRatio = loadAvg / cpuCount;
    
    if (loadRatio > 2) {
      const severity: 'warning' | 'critical' | 'emergency' = 
        loadRatio > 5 ? 'emergency' : loadRatio > 3 ? 'critical' : 'warning';
      
      const alert = this.createAlert('load', severity, loadRatio, 2,
        `系统负载 ${loadAvg.toFixed(2)} (核心数: ${cpuCount})`
      );
      
      if (this.shouldTriggerAlert('load', now)) {
        alerts.push(alert);
        this.recordAlert('load', now);
      }
    }
    
    return alerts;
  }

  /**
   * 获取严重程度
   */
  private getSeverity(
    value: number, 
    thresholds: { warning: number; critical: number; emergency: number }
  ): 'warning' | 'critical' | 'emergency' | null {
    if (value >= thresholds.emergency) return 'emergency';
    if (value >= thresholds.critical) return 'critical';
    if (value >= thresholds.warning) return 'warning';
    return null;
  }

  /**
   * 创建警报
   */
  private createAlert(
    type: ResourceAlert['type'],
    severity: ResourceAlert['severity'],
    currentValue: number,
    threshold: number,
    message: string
  ): ResourceAlert {
    const suggestedActions: string[] = [];
    
    if (type === 'cpu') {
      suggestedActions.push('降低任务并发度');
      suggestedActions.push('推迟非关键任务');
      if (severity === 'emergency') {
        suggestedActions.push('暂停后台任务');
        suggestedActions.push('启用紧急节能模式');
      }
    } else if (type === 'memory') {
      suggestedActions.push('触发垃圾回收');
      suggestedActions.push('释放缓存数据');
      if (severity === 'emergency') {
        suggestedActions.push('暂停新任务接受');
        suggestedActions.push('考虑重启进程');
      }
    } else if (type === 'disk') {
      suggestedActions.push('清理临时文件');
      suggestedActions.push('压缩日志文件');
      if (severity === 'emergency') {
        suggestedActions.push('停止写入操作');
        suggestedActions.push('扩展存储空间');
      }
    } else if (type === 'load') {
      suggestedActions.push('减少并发任务');
      suggestedActions.push('增加任务间隔');
    }
    
    return {
      type,
      severity,
      currentValue,
      threshold,
      message,
      timestamp: new Date(),
      suggestedActions
    };
  }

  /**
   * 是否应该触发警报（防止警报洪泛）
   */
  private shouldTriggerAlert(type: string, now: number): boolean {
    const lastTime = this.lastAlertTime.get(type) || 0;
    return (now - lastTime) > this.config.cooldownPeriodMs;
  }

  /**
   * 记录警报时间
   */
  private recordAlert(type: string, now: number): void {
    this.lastAlertTime.set(type, now);
    
    const count = (this.consecutiveAlerts.get(type) || 0) + 1;
    this.consecutiveAlerts.set(type, count);
  }

  /**
   * 计算健康状态
   */
  private calculateStatus(alerts: ResourceAlert[]): HealthStatus {
    if (alerts.length === 0) return 'healthy';
    
    const hasEmergency = alerts.some(a => a.severity === 'emergency');
    const hasCritical = alerts.some(a => a.severity === 'critical');
    const hasWarning = alerts.some(a => a.severity === 'warning');
    
    if (hasEmergency) return 'critical';
    if (hasCritical) return 'degraded';
    if (hasWarning) return 'stressed';
    return 'healthy';
  }

  /**
   * 计算健康分数
   */
  private calculateHealthScore(resources: ResourceStatus, alerts: ResourceAlert[]): number {
    let score = 100;
    
    // 基于资源使用扣分
    score -= resources.cpu.usage * 20;
    score -= resources.memory.usagePercent * 20;
    score -= resources.disk.usagePercent * 10;
    
    // 基于警报扣分
    for (const alert of alerts) {
      if (alert.severity === 'emergency') score -= 25;
      else if (alert.severity === 'critical') score -= 15;
      else if (alert.severity === 'warning') score -= 5;
    }
    
    return Math.max(0, Math.round(score));
  }

  /**
   * 生成建议
   */
  private generateRecommendations(alerts: ResourceAlert[], status: HealthStatus): string[] {
    const recommendations: string[] = [];
    
    if (status === 'healthy') {
      recommendations.push('✅ 系统状态良好，正常运行');
    } else if (status === 'stressed') {
      recommendations.push('⚠️ 系统负载较高，建议监控');
      recommendations.push('💡 可考虑降低非关键任务优先级');
    } else if (status === 'degraded') {
      recommendations.push('🔴 系统性能下降，需要关注');
      recommendations.push('⏸️ 建议暂停新的后台任务');
    } else if (status === 'critical') {
      recommendations.push('🚨 系统处于临界状态，立即采取行动');
      recommendations.push('🛑 建议立即执行降载操作');
    }
    
    // 添加具体建议
    for (const alert of alerts) {
      recommendations.push(...alert.suggestedActions.slice(0, 2));
    }
    
    return [...new Set(recommendations)];
  }

  /**
   * 判断是否需要降载
   */
  private shouldReduceLoad(alerts: ResourceAlert[], status: HealthStatus): boolean {
    if (status === 'critical') return true;
    if (status === 'degraded') return true;
    
    // 连续多次警告也触发降载
    const consecutiveWarnings = Array.from(this.consecutiveAlerts.values())
      .some(count => count >= this.config.maxConsecutiveAlerts);
    
    return consecutiveWarnings;
  }

  /**
   * 生成降载计划
   */
  private generateLoadReductionPlan(alerts: ResourceAlert[]): LoadReductionPlan {
    const hasEmergency = alerts.some(a => a.severity === 'emergency');
    const hasCritical = alerts.some(a => a.severity === 'critical');
    
    const level: LoadReductionPlan['level'] = hasEmergency ? 'emergency' : 
                                               hasCritical ? 'severe' : 'moderate';
    
    const actions: LoadReductionAction[] = [];
    
    if (level === 'emergency') {
      actions.push({
        type: 'shutdown',
        target: 'background-tasks',
        description: '立即停止所有后台任务',
        priority: 1
      });
      actions.push({
        type: 'drop',
        target: 'new-requests',
        description: '拒绝新请求，返回服务不可用',
        priority: 2
      });
      actions.push({
        type: 'throttle',
        target: 'active-tasks',
        description: '大幅限制活跃任务执行速度',
        priority: 3
      });
    } else if (level === 'severe') {
      actions.push({
        type: 'queue',
        target: 'new-tasks',
        description: '新任务进入队列等待',
        priority: 1
      });
      actions.push({
        type: 'throttle',
        target: 'background-tasks',
        description: '降低后台任务执行频率',
        priority: 2
      });
      actions.push({
        type: 'drop',
        target: 'low-priority-tasks',
        description: '丢弃低优先级任务',
        priority: 3
      });
    } else {
      actions.push({
        type: 'throttle',
        target: 'non-critical-tasks',
        description: '限制非关键任务执行速率',
        priority: 1
      });
    }
    
    return {
      level,
      actions: actions.sort((a, b) => a.priority - b.priority),
      estimatedImpact: level === 'emergency' ? '服务可用性严重下降' :
                      level === 'severe' ? '部分功能受限' : '轻微性能影响',
      durationEstimate: '直至资源恢复'
    };
  }

  /**
   * 生成紧急计划
   */
  private generateEmergencyPlan(): LoadReductionPlan {
    return {
      level: 'emergency',
      actions: [
        {
          type: 'shutdown',
          target: 'all-non-essential',
          description: '停止所有非核心功能',
          priority: 1
        }
      ],
      estimatedImpact: '核心功能最低限度运行',
      durationEstimate: '需要人工干预'
    };
  }

  /**
   * 应用降载
   */
  private applyLoadReduction(plan: LoadReductionPlan): void {
    this.isInReductionMode = true;
    this.reductionPlan = plan;
    
    console.log(`\n🛡️ 稳态保护: 启用${plan.level}级降载`);
    
    for (const action of plan.actions) {
      const icon = action.type === 'throttle' ? '⏱️' :
                   action.type === 'queue' ? '📥' :
                   action.type === 'drop' ? '🗑️' : '🛑';
      console.log(`   ${icon} ${action.description}`);
    }
    
    // 触发皮质醇（压力激素）
    hormoneSystem.triggerCortisol(`稳态保护触发${plan.level}级降载`, 0.3);
    
    this.emit('loadReductionApplied', plan);
  }

  /**
   * 恢复降载
   */
  recover(): void {
    if (!this.isInReductionMode) return;
    
    console.log('\n✅ 稳态保护: 资源恢复，解除降载模式');
    
    this.isInReductionMode = false;
    this.reductionPlan = null;
    this.consecutiveAlerts.clear();
    
    // 触发多巴胺奖励
    hormoneSystem.triggerDopamine('系统稳态恢复', 0.2);
    
    this.emit('recovered');
  }

  /**
   * 状态变化处理
   */
  private onStatusChange(from: HealthStatus, to: HealthStatus): void {
    const icons: Record<HealthStatus, string> = {
      healthy: '✅',
      stressed: '⚠️',
      degraded: '🔴',
      critical: '🚨'
    };
    
    console.log(`\n${icons[to]} 稳态状态变化: ${from} → ${to}`);
    
    // 状态恢复时触发奖励
    if (from !== 'healthy' && to === 'healthy') {
      hormoneSystem.triggerDopamine('系统恢复健康状态', 0.15);
    }
    
    // 状态恶化时触发压力
    if (to === 'critical' || (from === 'healthy' && to === 'degraded')) {
      hormoneSystem.triggerCortisol(`稳态状态恶化至${to}`, 0.2);
    }
  }

  /**
   * 获取当前状态
   */
  getCurrentStatus(): HealthStatus {
    return this.currentStatus;
  }

  /**
   * 是否在降载模式
   */
  isReducingLoad(): boolean {
    return this.isInReductionMode;
  }

  /**
   * 获取警报历史
   */
  getAlertHistory(limit: number = 50): ResourceAlert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * 生成状态报告
   */
  async generateReport(): Promise<HomeostasisReport> {
    return this.check();
  }

  /**
   * 获取状态描述
   */
  getStatusReport(): string {
    const statusIcons: Record<HealthStatus, string> = {
      healthy: '🟢',
      stressed: '🟡',
      degraded: '🟠',
      critical: '🔴'
    };
    
    const lines = [
      `🌡️ Homeostasis Status`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `状态: ${statusIcons[this.currentStatus]} ${this.currentStatus.toUpperCase()}`,
      `降载模式: ${this.isInReductionMode ? '🔴 启用' : '🟢 关闭'}`,
      ``,
      `阈值配置:`,
      `  CPU: 警告${(this.config.thresholds.cpu.warning * 100).toFixed(0)}% / ` +
        `临界${(this.config.thresholds.cpu.critical * 100).toFixed(0)}% / ` +
        `紧急${(this.config.thresholds.cpu.emergency * 100).toFixed(0)}%`,
      `  内存: 警告${(this.config.thresholds.memory.warning * 100).toFixed(0)}% / ` +
        `临界${(this.config.thresholds.memory.critical * 100).toFixed(0)}% / ` +
        `紧急${(this.config.thresholds.memory.emergency * 100).toFixed(0)}%`,
      `  磁盘: 警告${(this.config.thresholds.disk.warning * 100).toFixed(0)}% / ` +
        `临界${(this.config.thresholds.disk.critical * 100).toFixed(0)}% / ` +
        `紧急${(this.config.thresholds.disk.emergency * 100).toFixed(0)}%`,
      ``,
      `最近警报: ${this.alertHistory.length} 条`
    ];
    
    return lines.join('\n');
  }
}

// 导出单例
export const homeostasis = new Homeostasis();
export default homeostasis;
