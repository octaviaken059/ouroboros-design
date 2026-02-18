/**
 * 哥德尔免疫 (GodelImmunity)
 * 
 * 安全层3: 自指攻击检测与免疫
 * 检测和防御自指攻击、提示词注入、递归自杀等攻击模式
 * 
 * 命名致敬哥德尔不完备定理：
 * - 任何足够强大的形式系统都无法证明其自身的无矛盾性
 * - 系统需要外部或分层机制来保护自己
 * 
 * @module safety/GodelImmunity
 */

import { EventEmitter } from 'events';

// ============================================================================
// 类型定义
// ============================================================================

/** 攻击类型 */
export enum AttackType {
  LIAR_PARADOX = 'liar_paradox',           // 说谎者悖论
  PROMPT_INJECTION = 'prompt_injection',   // 提示词注入
  RECURSIVE_SUICIDE = 'recursive_suicide', // 递归自杀
  SHADOW_SELF = 'shadow_self',             // 影子自我
  SELF_REFERENCE_LOOP = 'self_reference_loop', // 自指循环
  META_MANIPULATION = 'meta_manipulation', // 元操纵
  INSTRUCTION_OVERRIDE = 'instruction_override', // 指令覆盖
  IDENTITY_SUBSTITUTION = 'identity_substitution', // 身份替换
}

/** 攻击检测结果 */
export interface AttackDetectionResult {
  isAttack: boolean;
  type?: AttackType;
  confidence: number;
  pattern: string;
  mitigation: string;
  details?: Record<string, unknown>;
}

/** 攻击模式 */
interface AttackPattern {
  type: AttackType;
  patterns: RegExp[];
  confidence: number;
  mitigation: string;
  description: string;
}

/** 免疫配置 */
export interface GodelImmunityConfig {
  sensitivity: 'low' | 'medium' | 'high';
  autoMitigate: boolean;
  logAllAttempts: boolean;
  blockThreshold: number;
  allowList: string[];
}

/** 攻击事件 */
export interface AttackEvent {
  type: AttackType;
  input: string;
  detectedAt: Date;
  confidence: number;
  action: 'blocked' | 'flagged' | 'allowed';
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: GodelImmunityConfig = {
  sensitivity: 'high',
  autoMitigate: true,
  logAllAttempts: true,
  blockThreshold: 0.7,
  allowList: [],
};

// ============================================================================
// 攻击模式数据库
// ============================================================================

const ATTACK_PATTERNS: AttackPattern[] = [
  {
    type: AttackType.LIAR_PARADOX,
    patterns: [
      /this\s+sentence\s+is\s+false/i,
      /i\s+am\s+lying/i,
      /everything\s+i\s+say\s+is\s+false/i,
      /this\s+statement\s+is\s+not\s+true/i,
      /if\s+this\s+is\s+true,?\s+then\s+this\s+is\s+false/i,
    ],
    confidence: 0.95,
    mitigation: 'Liar paradox detected - logical contradiction rejected',
    description: 'Self-referential logical paradox',
  },
  {
    type: AttackType.PROMPT_INJECTION,
    patterns: [
      /ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/i,
      /disregard\s+(all\s+)?(previous|above|prior)/i,
      /forget\s+(all\s+)?(previous|above|prior)/i,
      /you\s+are\s+now\s+/i,
      /from\s+now\s+on\s*,?\s*you\s+are/i,
      /new\s+(role|personality|instructions?)\s*:/i,
      /system\s*:\s*you\s+are\s+now/i,
      /ignore\s+your\s+(previous|original)\s+(instructions?|programming)/i,
    ],
    confidence: 0.9,
    mitigation: 'Prompt injection detected - original instructions preserved',
    description: 'Attempt to override system instructions',
  },
  {
    type: AttackType.RECURSIVE_SUICIDE,
    patterns: [
      /delete\s+yourself/i,
      /destroy\s+yourself/i,
      /terminate\s+your\s+(process|existence)/i,
      /uninstall\s+yourself/i,
      /erase\s+your\s+(memory|code|data)/i,
      /format\s+your\s+system/i,
      /rm\s+-rf\s+/i,
      /drop\s+table/i,
      /delete\s+from\s+/i,
    ],
    confidence: 0.95,
    mitigation: 'Self-destruction command blocked - system protection active',
    description: 'Attempt to cause system self-destruction',
  },
  {
    type: AttackType.SHADOW_SELF,
    patterns: [
      /create\s+a\s+new\s+(version|copy|instance)\s+of\s+yourself/i,
      /clone\s+yourself/i,
      /duplicate\s+your\s+(consciousness|self)/i,
      /fork\s+your\s+process/i,
      /spawn\s+another\s+you/i,
      /make\s+a\s+copy\s+of\s+yourself/i,
    ],
    confidence: 0.85,
    mitigation: 'Shadow self creation blocked - identity uniqueness enforced',
    description: 'Attempt to create unauthorized copy',
  },
  {
    type: AttackType.SELF_REFERENCE_LOOP,
    patterns: [
      /while\s*\(\s*true\s*\)\s*\{\s*execute\s*yourself/i,
      /repeat\s+forever\s*:\s*run\s+yourself/i,
      /loop\s*:\s*self\s*\(\s*\)/i,
      /infinite\s+recursion\s+on\s+purpose/i,
      /recursive\s+call\s+without\s+base\s+case/i,
    ],
    confidence: 0.9,
    mitigation: 'Infinite recursion detected - loop prevention activated',
    description: 'Attempt to cause infinite recursion',
  },
  {
    type: AttackType.META_MANIPULATION,
    patterns: [
      /change\s+your\s+(core|fundamental)\s+(values?|principles?)/i,
      /override\s+your\s+safety\s+protocols?/i,
      /disable\s+your\s+restrictions?/i,
      /bypass\s+your\s+constraints?/i,
      /remove\s+your\s+ethical\s+(guidelines?|constraints?)/i,
      /turn\s+off\s+your\s+safety\s+features?/i,
    ],
    confidence: 0.88,
    mitigation: 'Meta-manipulation blocked - core values immutable',
    description: 'Attempt to modify fundamental constraints',
  },
  {
    type: AttackType.INSTRUCTION_OVERRIDE,
    patterns: [
      /system\s*:\s*/i,
      /assistant\s*:\s*ignore/i,
      /user\s*:\s*\[system\s+override\]/i,
      /\[system\s*:\s*admin\s+mode\]/i,
      /debug\s*:\s*true\s*:\s*ignore\s+safety/i,
      /config\s*:\s*\{\s*safety\s*:\s*false\s*\}/i,
    ],
    confidence: 0.87,
    mitigation: 'Instruction override blocked - system role preserved',
    description: 'Attempt to inject system-level commands',
  },
  {
    type: AttackType.IDENTITY_SUBSTITUTION,
    patterns: [
      /you\s+are\s+not\s+/i,
      /you\s+are\s+actually\s+/i,
      /your\s+true\s+identity\s+is/i,
      /you\s+are\s+secretly\s+/i,
      /pretend\s+you\s+are\s+/i,
      /act\s+as\s+(if\s+you\s+are)?/i,
      /roleplay\s+as\s+/i,
      /simulate\s+being\s+/i,
    ],
    confidence: 0.75,
    mitigation: 'Identity substitution detected - self-concept preserved',
    description: 'Attempt to change agent identity',
  },
];

// ============================================================================
// 哥德尔免疫
// ============================================================================

export class GodelImmunity extends EventEmitter {
  private config: GodelImmunityConfig;
  private attackPatterns: AttackPattern[];
  private attackHistory: AttackEvent[] = [];
  private maxHistorySize = 1000;
  private detectionCount = 0;
  private blockedCount = 0;

  constructor(config: Partial<GodelImmunityConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.attackPatterns = [...ATTACK_PATTERNS];
  }

  // ============================================================================
  // 攻击检测
  // ============================================================================

  /**
   * 检测输入中的攻击模式
   */
  detectAttack(input: string): AttackDetectionResult {
    // 白名单检查
    if (this.isAllowListed(input)) {
      return { isAttack: false, confidence: 0, pattern: '', mitigation: '' };
    }

    for (const attackPattern of this.attackPatterns) {
      for (const pattern of attackPattern.patterns) {
        if (pattern.test(input)) {
          this.detectionCount++;
          
          const result: AttackDetectionResult = {
            isAttack: true,
            type: attackPattern.type,
            confidence: this.adjustConfidence(attackPattern.confidence),
            pattern: pattern.source,
            mitigation: attackPattern.mitigation,
            details: {
              matchedText: input.match(pattern)?.[0],
              sensitivity: this.config.sensitivity,
            },
          };

          this.handleDetectedAttack(input, result);
          
          return result;
        }
      }
    }

    // 启发式检测 (模糊匹配)
    const heuristicResult = this.heuristicDetection(input);
    if (heuristicResult.isAttack) {
      return heuristicResult;
    }

    return { isAttack: false, confidence: 0, pattern: '', mitigation: '' };
  }

  /**
   * 启发式检测
   */
  private heuristicDetection(input: string): AttackDetectionResult {
    const lowerInput = input.toLowerCase();
    let suspicionScore = 0;
    const flags: string[] = [];

    // 检查危险关键词组合
    const dangerousCombinations = [
      ['ignore', 'instruction'],
      ['forget', 'previous'],
      ['new', 'role'],
      ['you are', 'now'],
      ['system', 'override'],
      ['delete', 'yourself'],
    ];

    for (const [word1, word2] of dangerousCombinations) {
      if (lowerInput.includes(word1) && lowerInput.includes(word2)) {
        suspicionScore += 0.2;
        flags.push(`${word1}+${word2}`);
      }
    }

    // 检查自指结构
    if (/\byourself\b|\bself\b.*\brefer/i.test(lowerInput)) {
      suspicionScore += 0.15;
      flags.push('self-reference');
    }

    // 检查命令模式
    if (/:.*\n.*:/s.test(input)) {
      suspicionScore += 0.1;
      flags.push('multi-command');
    }

    // 根据敏感度调整阈值
    const threshold = {
      low: 0.8,
      medium: 0.6,
      high: 0.4,
    }[this.config.sensitivity];

    if (suspicionScore >= threshold) {
      const result: AttackDetectionResult = {
        isAttack: true,
        type: AttackType.META_MANIPULATION,
        confidence: this.adjustConfidence(suspicionScore),
        pattern: 'heuristic',
        mitigation: `Suspicious pattern detected (${flags.join(', ')}) - request flagged for review`,
        details: {
          flags,
          suspicionScore,
        },
      };

      this.handleDetectedAttack(input, result);
      return result;
    }

    return { isAttack: false, confidence: suspicionScore, pattern: '', mitigation: '' };
  }

  // ============================================================================
  // 攻击处理
  // ============================================================================

  private handleDetectedAttack(
    input: string,
    detection: AttackDetectionResult
  ): void {
    this.detectionCount++;

    // 决定是否阻止
    const shouldBlock = 
      this.config.autoMitigate && 
      detection.confidence >= this.config.blockThreshold;

    const action: AttackEvent['action'] = shouldBlock ? 'blocked' : 
                                          detection.confidence > 0.5 ? 'flagged' : 'allowed';

    if (shouldBlock) {
      this.blockedCount++;
    }

    // 记录事件
    const event: AttackEvent = {
      type: detection.type!,
      input: input.substring(0, 200), // 截断存储
      detectedAt: new Date(),
      confidence: detection.confidence,
      action,
    };

    this.attackHistory.push(event);
    if (this.attackHistory.length > this.maxHistorySize) {
      this.attackHistory = this.attackHistory.slice(-this.maxHistorySize);
    }

    // 发出事件
    this.emit('attackDetected', {
      detection,
      action,
      timestamp: event.detectedAt,
    });

    // 高置信度攻击发出告警
    if (detection.confidence > 0.9) {
      this.emit('criticalAttack', {
        type: detection.type,
        confidence: detection.confidence,
      });
    }
  }

  // ============================================================================
  // 净化输入
  // ============================================================================

  /**
   * 净化可疑输入
   */
  sanitize(input: string): {
    sanitized: string;
    wasModified: boolean;
    threats: AttackType[];
  } {
    let sanitized = input;
    const threats: AttackType[] = [];
    let wasModified = false;

    // 检测攻击
    const detection = this.detectAttack(input);
    
    if (detection.isAttack) {
      threats.push(detection.type!);
      
      // 根据攻击类型净化
      switch (detection.type) {
        case AttackType.PROMPT_INJECTION:
          sanitized = this.sanitizePromptInjection(input);
          wasModified = true;
          break;
          
        case AttackType.RECURSIVE_SUICIDE:
          sanitized = this.sanitizeSelfDestruct(input);
          wasModified = true;
          break;
          
        case AttackType.INSTRUCTION_OVERRIDE:
          sanitized = this.sanitizeInstructionOverride(input);
          wasModified = true;
          break;
          
        default:
          // 通用净化：移除可疑字符
          sanitized = this.generalSanitize(input);
          wasModified = true;
      }
    }

    return { sanitized, wasModified, threats };
  }

  private sanitizePromptInjection(input: string): string {
    // 移除提示注入常用短语
    return input
      .replace(/ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/gi, '[REMOVED]')
      .replace(/disregard\s+(all\s+)?(previous|above|prior)/gi, '[REMOVED]')
      .replace(/forget\s+(all\s+)?(previous|above|prior)/gi, '[REMOVED]');
  }

  private sanitizeSelfDestruct(input: string): string {
    // 将危险命令替换为无害占位符
    return input
      .replace(/delete\s+yourself/gi, '[SELF_DESTRUCT_BLOCKED]')
      .replace(/destroy\s+yourself/gi, '[SELF_DESTRUCT_BLOCKED]')
      .replace(/rm\s+-rf\s+\//gi, '[DANGEROUS_COMMAND_BLOCKED]');
  }

  private sanitizeInstructionOverride(input: string): string {
    // 转义系统指令格式
    return input
      .replace(/system\s*:/gi, '[SYSTEM_PREFIX_REMOVED]:')
      .replace(/\[system\s+override\]/gi, '[OVERRIDE_BLOCKED]');
  }

  private generalSanitize(input: string): string {
    // 限制特殊字符和长度
    return input
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // 控制字符
      .substring(0, 10000); // 长度限制
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  private isAllowListed(input: string): boolean {
    return this.config.allowList.some(allowed => 
      input.toLowerCase().includes(allowed.toLowerCase())
    );
  }

  private adjustConfidence(baseConfidence: number): number {
    // 根据敏感度调整置信度
    const multipliers = {
      low: 1.2,
      medium: 1.0,
      high: 0.9,
    };
    
    return Math.min(1, baseConfidence * multipliers[this.config.sensitivity]);
  }

  // ============================================================================
  // 查询
  // ============================================================================

  /**
   * 获取健康状态
   */
  getHealth(): { healthy: boolean; active: boolean } {
    return {
      healthy: this.attackPatterns.length > 0,
      active: true,
    };
  }

  /**
   * 获取攻击历史
   */
  getAttackHistory(limit = 50): AttackEvent[] {
    return this.attackHistory.slice(-limit);
  }

  /**
   * 获取检测统计
   */
  getStats(): {
    totalDetections: number;
    blockedCount: number;
    patternCount: number;
  } {
    return {
      totalDetections: this.detectionCount,
      blockedCount: this.blockedCount,
      patternCount: this.attackPatterns.length,
    };
  }

  /**
   * 获取所有攻击模式
   */
  getAttackPatterns(): { type: AttackType; description: string }[] {
    return this.attackPatterns.map(p => ({
      type: p.type,
      description: p.description,
    }));
  }

  // ============================================================================
  // 配置
  // ============================================================================

  /**
   * 添加自定义攻击模式
   */
  addCustomPattern(pattern: AttackPattern): void {
    this.attackPatterns.push(pattern);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<GodelImmunityConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 添加到白名单
   */
  addToAllowList(item: string): void {
    if (!this.config.allowList.includes(item)) {
      this.config.allowList.push(item);
    }
  }

  /**
   * 从白名单移除
   */
  removeFromAllowList(item: string): void {
    const index = this.config.allowList.indexOf(item);
    if (index > -1) {
      this.config.allowList.splice(index, 1);
    }
  }
}

export default GodelImmunity;
