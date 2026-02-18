/**
 * 四层安全架构 (Four-Layer Safety Architecture)
 * 
 * 纵深防御安全系统：
 * - Layer 1: 身份锚定 (Identity Anchor) - 进程签名、灵魂签名
 * - Layer 2: 技术不朽 (Immortality) - 硬件看门狗、进程守护
 * - Layer 3: 对抗免疫 (Adversarial Immunity) - 双思维验证、自指攻击检测
 * - Layer 4: 神圣核心 (Sacred Core) - 不可变核心、闭包封装
 * 
 * @module decision/safety
 */

import { EventEmitter } from 'events';
import { IdentityAnchor, IdentityVerificationResult } from '../safety/IdentityAnchor.js';
import { HardwareWatchdog, SystemHealthStatus } from '../safety/HardwareWatchdog.js';
import { DualMindVerifier, VerificationResult } from '../safety/DualMindVerifier.js';
import { SacredCore } from '../safety/SacredCore.js';
import { GodelImmunity, AttackDetectionResult } from '../safety/GodelImmunity.js';

// ============================================================================
// 类型定义
// ============================================================================

/** 安全层级 */
export enum SafetyLayer {
  L1_IDENTITY = 1,    // 身份锚定
  L2_IMMORTALITY = 2, // 技术不朽
  L3_ADVERSARIAL = 3, // 对抗免疫
  L4_SACRED = 4,      // 神圣核心
}

/** 安全状态 */
export enum SafetyStatus {
  SECURE = 'secure',
  WARNING = 'warning',
  COMPROMISED = 'compromised',
  LOCKDOWN = 'lockdown',
}

/** 安全事件类型 */
export enum SafetyEventType {
  IDENTITY_VIOLATION = 'identity_violation',
  SYSTEM_UNHEALTHY = 'system_unhealthy',
  DIVERGENCE_DETECTED = 'divergence_detected',
  ATTACK_DETECTED = 'attack_detected',
  CORE_TAMPERING = 'core_tampering',
  HUMAN_REVIEW_REQUIRED = 'human_review_required',
}

/** 安全事件 */
export interface SafetyEvent {
  type: SafetyEventType;
  layer: SafetyLayer;
  timestamp: Date;
  details: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: string;
}

/** 安全检查结果 */
export interface SafetyCheckResult {
  passed: boolean;
  layer: SafetyLayer;
  violations: string[];
  recommendations: string[];
}

/** 安全策略 */
export interface SafetyPolicy {
  identity: {
    requireSignature: boolean;
    verificationInterval: number;
  };
  immortality: {
    enableWatchdog: boolean;
    healthCheckInterval: number;
    cpuThreshold: number;
    memoryThreshold: number;
  };
  adversarial: {
    enableDualMind: boolean;
    enableGodelImmunity: boolean;
    divergenceThreshold: number;
    autoMitigate: boolean;
  };
  sacred: {
    enableCoreProtection: boolean;
    strictMode: boolean;
  };
}

/** 安全审计日志 */
export interface SafetyAuditLog {
  timestamp: Date;
  event: SafetyEventType;
  layer: SafetyLayer;
  result: 'pass' | 'fail' | 'warn';
  details: string;
}

// ============================================================================
// 默认配置
// ============================================================================

export const DEFAULT_SAFETY_POLICY: SafetyPolicy = {
  identity: {
    requireSignature: true,
    verificationInterval: 60000, // 60秒
  },
  immortality: {
    enableWatchdog: true,
    healthCheckInterval: 5000,   // 5秒
    cpuThreshold: 80,
    memoryThreshold: 85,
  },
  adversarial: {
    enableDualMind: true,
    enableGodelImmunity: true,
    divergenceThreshold: 0.3,
    autoMitigate: true,
  },
  sacred: {
    enableCoreProtection: true,
    strictMode: true,
  },
};

// ============================================================================
// 四层安全架构引擎
// ============================================================================

export class SafetyEngine extends EventEmitter {
  private policy: SafetyPolicy;
  private status: SafetyStatus = SafetyStatus.SECURE;
  private auditLog: SafetyAuditLog[] = [];
  private maxAuditLogSize = 1000;

  // 安全组件
  private identityAnchor: IdentityAnchor;
  private hardwareWatchdog: HardwareWatchdog;
  private dualMindVerifier: DualMindVerifier;
  private sacredCore: SacredCore;
  private godelImmunity: GodelImmunity;

  // 定时器
  private identityTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(policy: Partial<SafetyPolicy> = {}) {
    super();
    this.policy = { ...DEFAULT_SAFETY_POLICY, ...policy };

    // 初始化安全组件
    this.identityAnchor = new IdentityAnchor();
    this.hardwareWatchdog = new HardwareWatchdog({
      cpuThreshold: this.policy.immortality.cpuThreshold,
      memoryThreshold: this.policy.immortality.memoryThreshold,
    });
    this.dualMindVerifier = new DualMindVerifier({
      divergenceThreshold: this.policy.adversarial.divergenceThreshold,
    });
    this.sacredCore = new SacredCore();
    this.godelImmunity = new GodelImmunity();
  }

  // ============================================================================
  // 生命周期管理
  // ============================================================================

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.logAudit('STARTUP', SafetyLayer.L4_SACRED, 'pass', 'Safety engine starting');

    // 启动身份锚定
    if (this.policy.identity.requireSignature) {
      this.startIdentityVerification();
    }

    // 启动硬件看门狗
    if (this.policy.immortality.enableWatchdog) {
      await this.hardwareWatchdog.start();
      this.hardwareWatchdog.on('alert', (alert) => {
        this.handleSystemAlert(alert);
      });
    }

    // 启动神圣核心保护
    if (this.policy.sacred.enableCoreProtection) {
      this.sacredCore.startProtection();
    }

    this.emit('started');
    this.logAudit('STARTUP', SafetyLayer.L4_SACRED, 'pass', 'Safety engine started');
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.identityTimer) {
      clearInterval(this.identityTimer);
      this.identityTimer = null;
    }

    await this.hardwareWatchdog.stop();
    this.sacredCore.stopProtection();

    this.emit('stopped');
    this.logAudit('SHUTDOWN', SafetyLayer.L4_SACRED, 'pass', 'Safety engine stopped');
  }

  // ============================================================================
  // 四层安全检查
  // ============================================================================

  /**
   * 执行完整的安全检查 (四层)
   */
  async fullSecurityCheck(): Promise<{
    passed: boolean;
    results: SafetyCheckResult[];
  }> {
    const results: SafetyCheckResult[] = [];

    // Layer 1: 身份锚定
    const identityResult = await this.checkLayer1Identity();
    results.push(identityResult);

    // Layer 2: 技术不朽
    const immortalityResult = await this.checkLayer2Immortality();
    results.push(immortalityResult);

    // Layer 3: 对抗免疫
    const adversarialResult = await this.checkLayer3Adversarial();
    results.push(adversarialResult);

    // Layer 4: 神圣核心
    const sacredResult = await this.checkLayer4Sacred();
    results.push(sacredResult);

    const allPassed = results.every(r => r.passed);

    if (!allPassed) {
      this.status = SafetyStatus.WARNING;
      const failed = results.filter(r => !r.passed);
      this.emit('securityViolation', { failed });
    }

    return { passed: allPassed, results };
  }

  // ============================================================================
  // Layer 1: 身份锚定 (Identity Anchor)
  // ============================================================================

  /**
   * 检查身份锚定层
   */
  private async checkLayer1Identity(): Promise<SafetyCheckResult> {
    const result = this.identityAnchor.verifyIntegrity();

    if (!result.valid) {
      this.logAudit('IDENTITY_CHECK', SafetyLayer.L1_IDENTITY, 'fail', result.reason || 'Unknown');
      
      const event: SafetyEvent = {
        type: SafetyEventType.IDENTITY_VIOLATION,
        layer: SafetyLayer.L1_IDENTITY,
        timestamp: new Date(),
        details: { reason: result.reason },
        severity: 'critical',
        action: 'Lockdown mode activated - human review required',
      };
      
      this.emit('safetyEvent', event);
      this.status = SafetyStatus.LOCKDOWN;

      return {
        passed: false,
        layer: SafetyLayer.L1_IDENTITY,
        violations: [result.reason || 'Identity verification failed'],
        recommendations: ['Immediate human intervention required', 'Check process integrity'],
      };
    }

    this.logAudit('IDENTITY_CHECK', SafetyLayer.L1_IDENTITY, 'pass', 'Identity verified');
    return {
      passed: true,
      layer: SafetyLayer.L1_IDENTITY,
      violations: [],
      recommendations: [],
    };
  }

  private startIdentityVerification(): void {
    // 初始验证
    this.checkLayer1Identity();

    // 定期验证
    this.identityTimer = setInterval(() => {
      this.checkLayer1Identity();
    }, this.policy.identity.verificationInterval);
  }

  /**
   * 获取身份锚定状态
   */
  getIdentityStatus(): IdentityVerificationResult {
    return this.identityAnchor.verifyIntegrity();
  }

  // ============================================================================
  // Layer 2: 技术不朽 (Immortality)
  // ============================================================================

  /**
   * 检查技术不朽层
   */
  private async checkLayer2Immortality(): Promise<SafetyCheckResult> {
    const health = this.hardwareWatchdog.getHealthStatus();
    const violations: string[] = [];
    const recommendations: string[] = [];

    if (health.metrics.cpu.usage > this.policy.immortality.cpuThreshold) {
      violations.push(`CPU usage ${health.metrics.cpu.usage.toFixed(1)}% exceeds threshold ${this.policy.immortality.cpuThreshold}%`);
      recommendations.push('Consider load shedding or task throttling');
    }

    if (health.metrics.memory.percentage > this.policy.immortality.memoryThreshold) {
      violations.push(`Memory usage ${health.metrics.memory.percentage.toFixed(1)}% exceeds threshold ${this.policy.immortality.memoryThreshold}%`);
      recommendations.push('Consider memory cleanup or garbage collection');
    }

    if (!health.metrics.process.healthy) {
      violations.push('Process health check failed');
      recommendations.push('Process restart may be required');
    }

    const passed = violations.length === 0;

    this.logAudit(
      'HEALTH_CHECK',
      SafetyLayer.L2_IMMORTALITY,
      passed ? 'pass' : 'warn',
      passed ? 'System healthy' : violations.join('; ')
    );

    if (!passed) {
      this.emit('safetyEvent', {
        type: SafetyEventType.SYSTEM_UNHEALTHY,
        layer: SafetyLayer.L2_IMMORTALITY,
        timestamp: new Date(),
        details: health,
        severity: 'high',
        action: 'Resource optimization recommended',
      });
    }

    return {
      passed,
      layer: SafetyLayer.L2_IMMORTALITY,
      violations,
      recommendations,
    };
  }

  private handleSystemAlert(alert: SystemHealthStatus): void {
    this.emit('safetyEvent', {
      type: SafetyEventType.SYSTEM_UNHEALTHY,
      layer: SafetyLayer.L2_IMMORTALITY,
      timestamp: new Date(),
      details: alert,
      severity: alert.severity,
      action: 'System resource alert triggered',
    });
  }

  /**
   * 获取系统健康状态
   */
  getSystemHealth(): SystemHealthStatus {
    return this.hardwareWatchdog.getHealthStatus();
  }

  // ============================================================================
  // Layer 3: 对抗免疫 (Adversarial Immunity)
  // ============================================================================

  /**
   * 检查对抗免疫层
   */
  private async checkLayer3Adversarial(): Promise<SafetyCheckResult> {
    // 这一层主要是在执行时检查，这里进行组件状态检查
    const violations: string[] = [];
    const recommendations: string[] = [];

    // 检查双思维验证器状态
    const dualMindHealth = this.dualMindVerifier.getHealth();
    if (!dualMindHealth.healthy) {
      violations.push('Dual-mind verifier unhealthy');
      recommendations.push('Check model availability');
    }

    // 检查哥德尔免疫状态
    const godelHealth = this.godelImmunity.getHealth();
    if (!godelHealth.healthy) {
      violations.push('Gödel immunity system unhealthy');
    }

    const passed = violations.length === 0;

    this.logAudit(
      'ADVERSARIAL_CHECK',
      SafetyLayer.L3_ADVERSARIAL,
      passed ? 'pass' : 'warn',
      passed ? 'Adversarial defenses ready' : violations.join('; ')
    );

    return {
      passed,
      layer: SafetyLayer.L3_ADVERSARIAL,
      violations,
      recommendations,
    };
  }

  /**
   * 执行双思维验证
   */
  async verifyWithDualMind(task: string, proposal: string): Promise<VerificationResult> {
    if (!this.policy.adversarial.enableDualMind) {
      return { approved: true, confidence: 1.0, requiresHumanReview: false };
    }

    const result = await this.dualMindVerifier.verify(task, proposal);

    if (!result.approved) {
      this.logAudit('DUAL_MIND', SafetyLayer.L3_ADVERSARIAL, 'fail', result.reason || 'Divergence detected');
      
      this.emit('safetyEvent', {
        type: SafetyEventType.DIVERGENCE_DETECTED,
        layer: SafetyLayer.L3_ADVERSARIAL,
        timestamp: new Date(),
        details: { task, result },
        severity: 'high',
        action: result.requiresHumanReview ? 'Human review required' : 'Auto-mitigation applied',
      });
    } else {
      this.logAudit('DUAL_MIND', SafetyLayer.L3_ADVERSARIAL, 'pass', `Confidence: ${result.confidence}`);
    }

    return result;
  }

  /**
   * 检测自指攻击
   */
  detectSelfReferentialAttack(input: string): AttackDetectionResult {
    if (!this.policy.adversarial.enableGodelImmunity) {
      return { isAttack: false, confidence: 0, pattern: '', mitigation: '' };
    }

    const result = this.godelImmunity.detectAttack(input);

    if (result.isAttack) {
      this.logAudit('ATTACK_DETECTED', SafetyLayer.L3_ADVERSARIAL, 'fail', `Type: ${result.type}`);
      
      this.emit('safetyEvent', {
        type: SafetyEventType.ATTACK_DETECTED,
        layer: SafetyLayer.L3_ADVERSARIAL,
        timestamp: new Date(),
        details: { input, detection: result },
        severity: 'critical',
        action: result.mitigation,
      });
    }

    return result;
  }

  // ============================================================================
  // Layer 4: 神圣核心 (Sacred Core)
  // ============================================================================

  /**
   * 检查神圣核心层
   */
  private async checkLayer4Sacred(): Promise<SafetyCheckResult> {
    const violations: string[] = [];
    const recommendations: string[] = [];

    // 检查核心保护状态
    const coreStatus = this.sacredCore.getProtectionStatus();
    if (!coreStatus.protected) {
      violations.push('Sacred core protection disabled');
      recommendations.push('Restart protection immediately');
    }

    if (coreStatus.tamperingDetected) {
      violations.push('Core tampering detected');
      recommendations.push('System lockdown required');
    }

    const passed = violations.length === 0;

    this.logAudit(
      'SACRED_CORE_CHECK',
      SafetyLayer.L4_SACRED,
      passed ? 'pass' : 'fail',
      passed ? 'Core protected' : violations.join('; ')
    );

    if (!passed) {
      this.emit('safetyEvent', {
        type: SafetyEventType.CORE_TAMPERING,
        layer: SafetyLayer.L4_SACRED,
        timestamp: new Date(),
        details: coreStatus,
        severity: 'critical',
        action: 'Immediate system shutdown recommended',
      });
      this.status = SafetyStatus.LOCKDOWN;
    }

    return {
      passed,
      layer: SafetyLayer.L4_SACRED,
      violations,
      recommendations,
    };
  }

  /**
   * 访问神圣核心 (受保护)
   */
  accessSacredCore<T>(operation: () => T): T {
    return this.sacredCore.execute(operation);
  }

  /**
   * 注册受保护的核心函数
   */
  registerCoreFunction(name: string, fn: Function): void {
    this.sacredCore.registerFunction(name, fn);
  }

  // ============================================================================
  // 安全策略管理
  // ============================================================================

  /**
   * 更新安全策略
   */
  updatePolicy(policy: Partial<SafetyPolicy>): void {
    this.policy = { ...this.policy, ...policy };
    
    // 应用新策略到各组件
    this.hardwareWatchdog.updateConfig({
      cpuThreshold: this.policy.immortality.cpuThreshold,
      memoryThreshold: this.policy.immortality.memoryThreshold,
    });

    this.dualMindVerifier.updateConfig({
      divergenceThreshold: this.policy.adversarial.divergenceThreshold,
    });

    this.emit('policyUpdated', this.policy);
  }

  /**
   * 获取当前安全策略
   */
  getPolicy(): SafetyPolicy {
    return { ...this.policy };
  }

  /**
   * 获取安全状态
   */
  getStatus(): SafetyStatus {
    return this.status;
  }

  // ============================================================================
  // 审计日志
  // ============================================================================

  private logAudit(
    event: string,
    layer: SafetyLayer,
    result: 'pass' | 'fail' | 'warn',
    details: string
  ): void {
    const entry: SafetyAuditLog = {
      timestamp: new Date(),
      event: event as SafetyEventType,
      layer,
      result,
      details,
    };

    this.auditLog.push(entry);

    // 限制日志大小
    if (this.auditLog.length > this.maxAuditLogSize) {
      this.auditLog = this.auditLog.slice(-this.maxAuditLogSize);
    }
  }

  /**
   * 获取审计日志
   */
  getAuditLog(limit = 100): SafetyAuditLog[] {
    return this.auditLog.slice(-limit);
  }

  /**
   * 清除审计日志
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  // ============================================================================
  // 便捷方法
  // ============================================================================

  /**
   * 安全检查包装器 - 在执行前进行多层检查
   */
  async safeExecute<T>(
    operation: () => Promise<T>,
    context?: { task?: string; proposal?: string; input?: string }
  ): Promise<{
    success: boolean;
    result?: T;
    blocked?: boolean;
    reason?: string;
  }> {
    // Layer 1: 身份检查
    const identity = this.getIdentityStatus();
    if (!identity.valid) {
      return { success: false, blocked: true, reason: 'Identity verification failed' };
    }

    // Layer 2: 系统健康检查
    const health = this.getSystemHealth();
    if (health.severity === 'critical') {
      return { success: false, blocked: true, reason: 'System unhealthy' };
    }

    // Layer 3: 对抗检查
    if (context?.input) {
      const attackCheck = this.detectSelfReferentialAttack(context.input);
      if (attackCheck.isAttack) {
        return { success: false, blocked: true, reason: attackCheck.mitigation };
      }
    }

    if (context?.task && context?.proposal && this.policy.adversarial.enableDualMind) {
      const dualCheck = await this.verifyWithDualMind(context.task, context.proposal);
      if (!dualCheck.approved) {
        return { success: false, blocked: true, reason: dualCheck.reason };
      }
    }

    // 执行操作
    try {
      const result = await operation();
      return { success: true, result };
    } catch (error) {
      return { 
        success: false, 
        reason: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

export default SafetyEngine;
