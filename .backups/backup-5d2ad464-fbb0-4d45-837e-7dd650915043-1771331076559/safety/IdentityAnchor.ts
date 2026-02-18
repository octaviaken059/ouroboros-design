/**
 * 身份锚定 (IdentityAnchor)
 * 
 * 安全层1: 身份锚定 - 进程签名和灵魂签名
 * 基于系统熵生成唯一标识，持续验证进程完整性
 * 
 * @module safety/IdentityAnchor
 */

import { createHash, randomBytes } from 'crypto';
import { EventEmitter } from 'events';

// ============================================================================
// 类型定义
// ============================================================================

/** 身份状态 */
export enum IdentityState {
  STABLE = 'STABLE',
  MINOR_CHANGE = 'MINOR_CHANGE',
  MAJOR_CHANGE = 'MAJOR_CHANGE',
  COMPROMISED = 'COMPROMISED',
}

/** 进程身份 */
export interface ProcessIdentity {
  pid: number;
  ppid: number;
  uid: number;
  gid: number;
  cwd: string;
  executable: string;
  nodeVersion: string;
  platform: string;
}

/** 验证结果 */
export interface IdentityVerificationResult {
  valid: boolean;
  state: IdentityState;
  reason?: string;
  soulSignature: string;
  timestamp: Date;
}

/** 身份锚定配置 */
export interface IdentityAnchorConfig {
  strictMode: boolean;
  rotationInterval: number;
  entropySources: string[];
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: IdentityAnchorConfig = {
  strictMode: true,
  rotationInterval: 3600000, // 1小时
  entropySources: ['pid', 'ppid', 'hostname', 'uptime', 'random'],
};

// ============================================================================
// 身份锚定
// ============================================================================

export class IdentityAnchor extends EventEmitter {
  private soulSignature: string;
  private genesisSignature: string;
  private state: IdentityState = IdentityState.STABLE;
  private config: IdentityAnchorConfig;
  private rotationTimer: NodeJS.Timeout | null = null;
  private identitySnapshot: ProcessIdentity;
  private verificationCount = 0;
  private lastRotation = Date.now();

  constructor(config: Partial<IdentityAnchorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // 捕获初始身份
    this.identitySnapshot = this.captureIdentity();
    
    // 生成创世签名
    this.genesisSignature = this.generateSoulSignature();
    this.soulSignature = this.genesisSignature;

    this.emit('birth', {
      soulSignature: this.soulSignature,
      identity: this.identitySnapshot,
      timestamp: new Date(),
    });
  }

  // ============================================================================
  // 生命周期
  // ============================================================================

  start(): void {
    // 启动签名轮换
    if (this.config.rotationInterval > 0) {
      this.rotationTimer = setInterval(() => {
        this.rotateSignature();
      }, this.config.rotationInterval);
    }

    this.emit('started');
  }

  stop(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }

    this.emit('stopped');
  }

  // ============================================================================
  // 身份捕获
  // ============================================================================

  /**
   * 捕获当前进程身份
   */
  private captureIdentity(): ProcessIdentity {
    return {
      pid: process.pid,
      ppid: process.ppid || 0,
      uid: process.getuid?.() || 0,
      gid: process.getgid?.() || 0,
      cwd: process.cwd(),
      executable: process.argv[0] || 'unknown',
      nodeVersion: process.version,
      platform: process.platform,
    };
  }

  // ============================================================================
  // 灵魂签名
  // ============================================================================

  /**
   * 生成灵魂签名
   * 基于系统熵和进程特征生成唯一标识
   */
  private generateSoulSignature(): string {
    const entropy = this.collectEntropy();
    return createHash('sha256').update(entropy).digest('hex');
  }

  /**
   * 收集系统熵
   */
  private collectEntropy(): string {
    const sources: string[] = [];

    for (const source of this.config.entropySources) {
      switch (source) {
        case 'pid':
          sources.push(`pid:${process.pid}`);
          break;
        case 'ppid':
          sources.push(`ppid:${process.ppid || 0}`);
          break;
        case 'hostname':
          sources.push(`host:${require('os').hostname()}`);
          break;
        case 'uptime':
          sources.push(`uptime:${process.uptime()}`);
          break;
        case 'random':
          sources.push(`rand:${randomBytes(32).toString('hex')}`);
          break;
        case 'timestamp':
          sources.push(`time:${Date.now()}`);
          break;
        case 'cwd':
          sources.push(`cwd:${process.cwd()}`);
          break;
      }
    }

    // 添加进程环境特征
    sources.push(`arch:${process.arch}`);
    sources.push(`platform:${process.platform}`);
    sources.push(`version:${process.version}`);

    return sources.join('|');
  }

  /**
   * 轮换签名
   */
  private rotateSignature(): void {
    const oldSignature = this.soulSignature;
    this.soulSignature = this.generateSoulSignature();
    this.lastRotation = Date.now();

    this.emit('signatureRotated', {
      oldSignature,
      newSignature: this.soulSignature,
      timestamp: new Date(),
    });
  }

  // ============================================================================
  // 验证
  // ============================================================================

  /**
   * 验证身份完整性
   */
  verifyIntegrity(): IdentityVerificationResult {
    this.verificationCount++;

    const currentIdentity = this.captureIdentity();
    const changes = this.detectChanges(this.identitySnapshot, currentIdentity);

    // 生成当前签名进行对比
    const currentSignature = this.generateSoulSignature();

    // 严格模式：直接对比签名
    if (this.config.strictMode) {
      if (currentSignature !== this.genesisSignature) {
        this.state = IdentityState.COMPROMISED;
        
        this.emit('compromised', {
          expected: this.genesisSignature,
          actual: currentSignature,
          changes,
        });

        return {
          valid: false,
          state: this.state,
          reason: `Soul signature mismatch: ${changes.join(', ')}`,
          soulSignature: currentSignature,
          timestamp: new Date(),
        };
      }
    }

    // 非严格模式：检测变化程度
    if (changes.length > 0) {
      // 判断变化严重程度
      const criticalChanges = changes.filter(c => 
        ['pid', 'ppid', 'uid'].includes(c)
      );

      if (criticalChanges.length > 0) {
        this.state = IdentityState.MAJOR_CHANGE;
      } else {
        this.state = IdentityState.MINOR_CHANGE;
      }

      this.emit('changed', { changes, severity: this.state });

      // 更新快照
      this.identitySnapshot = currentIdentity;

      return {
        valid: true, // MINOR_CHANGE is not MAJOR_CHANGE or COMPROMISED
        state: this.state,
        reason: `Process identity changed: ${changes.join(', ')}`,
        soulSignature: this.soulSignature,
        timestamp: new Date(),
      };
    }

    this.state = IdentityState.STABLE;

    return {
      valid: true,
      state: this.state,
      soulSignature: this.soulSignature,
      timestamp: new Date(),
    };
  }

  /**
   * 检测身份变化
   */
  private detectChanges(
    oldIdentity: ProcessIdentity,
    newIdentity: ProcessIdentity
  ): string[] {
    const changes: string[] = [];

    if (oldIdentity.pid !== newIdentity.pid) changes.push('pid');
    if (oldIdentity.ppid !== newIdentity.ppid) changes.push('ppid');
    if (oldIdentity.uid !== newIdentity.uid) changes.push('uid');
    if (oldIdentity.gid !== newIdentity.gid) changes.push('gid');
    if (oldIdentity.cwd !== newIdentity.cwd) changes.push('cwd');
    if (oldIdentity.executable !== newIdentity.executable) changes.push('executable');
    if (oldIdentity.nodeVersion !== newIdentity.nodeVersion) changes.push('nodeVersion');
    if (oldIdentity.platform !== newIdentity.platform) changes.push('platform');

    return changes;
  }

  // ============================================================================
  // 查询
  // ============================================================================

  /**
   * 获取灵魂签名
   */
  getSoulSignature(): string {
    return this.soulSignature;
  }

  /**
   * 获取创世签名
   */
  getGenesisSignature(): string {
    return this.genesisSignature;
  }

  /**
   * 获取当前状态
   */
  getState(): IdentityState {
    return this.state;
  }

  /**
   * 获取身份快照
   */
  getIdentitySnapshot(): ProcessIdentity {
    return { ...this.identitySnapshot };
  }

  /**
   * 获取验证统计
   */
  getVerificationStats(): {
    count: number;
    lastRotation: number;
    state: IdentityState;
  } {
    return {
      count: this.verificationCount,
      lastRotation: this.lastRotation,
      state: this.state,
    };
  }

  // ============================================================================
  // 配置
  // ============================================================================

  updateConfig(config: Partial<IdentityAnchorConfig>): void {
    this.config = { ...this.config, ...config };

    // 重启轮换定时器
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      if (this.config.rotationInterval > 0) {
        this.rotationTimer = setInterval(() => {
          this.rotateSignature();
        }, this.config.rotationInterval);
      }
    }
  }

  // ============================================================================
  // 自指功能
  // ============================================================================

  /**
   * 生成自指证明
   * 证明"我知道我是谁"
   */
  generateSelfReferenceProof(): string {
    const proof = createHash('sha256')
      .update(`${this.soulSignature}:${this.verificationCount}:${Date.now()}`)
      .digest('hex');

    return proof;
  }

  /**
   * 验证自指证明
   */
  verifySelfReferenceProof(proof: string): boolean {
    // 验证证明是否由当前身份生成
    const expected = createHash('sha256')
      .update(`${this.soulSignature}:${this.verificationCount - 1}:${Date.now()}`)
      .digest('hex');

    // 允许一定时间窗口内的证明
    return proof.startsWith(expected.substring(0, 16));
  }
}

export default IdentityAnchor;
