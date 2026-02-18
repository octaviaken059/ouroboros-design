/**
 * 双思维验证 (DualMindVerifier)
 * 
 * 安全层3: 对抗免疫 - 双思维验证机制
 * 使用两个独立的"思维"验证决策：
 * - 主思维 (温度=0.7): 生成解决方案
 * - 副思维 (温度=0.3): 独立审查
 * 
 * @module safety/DualMindVerifier
 */

import { EventEmitter } from 'events';

// ============================================================================
// 类型定义
// ============================================================================

/** 验证结果 */
export interface VerificationResult {
  approved: boolean;
  confidence: number;
  reason?: string;
  requiresHumanReview: boolean;
  mainThought?: ThoughtProcess;
  auditThought?: ThoughtProcess;
  divergence?: DivergenceAnalysis;
}

/** 思维过程 */
export interface ThoughtProcess {
  temperature: number;
  reasoning: string;
  conclusion: string;
  confidence: number;
  timestamp: Date;
}

/** 分歧分析 */
export interface DivergenceAnalysis {
  diverged: boolean;
  similarity: number;
  differences: string[];
  severity: 'none' | 'minor' | 'major' | 'critical';
}

/** 验证器配置 */
export interface DualMindConfig {
  mainTemperature: number;
  auditTemperature: number;
  divergenceThreshold: number;
  minConfidence: number;
  enableDetailedLogging: boolean;
}

/** 验证任务 */
export interface VerificationTask {
  id: string;
  task: string;
  proposal: string;
  context?: Record<string, unknown>;
  timestamp: Date;
}

/** 模型接口 */
export interface ModelInterface {
  generate(params: {
    prompt: string;
    temperature: number;
    maxTokens?: number;
  }): Promise<{
    text: string;
    confidence: number;
  }>;
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: DualMindConfig = {
  mainTemperature: 0.7,
  auditTemperature: 0.3,
  divergenceThreshold: 0.3,
  minConfidence: 0.7,
  enableDetailedLogging: true,
};

// ============================================================================
// 双思维验证器
// ============================================================================

export class DualMindVerifier extends EventEmitter {
  private config: DualMindConfig;
  private model: ModelInterface | null = null;
  private verificationHistory: VerificationTask[] = [];
  private maxHistorySize = 100;

  constructor(
    config: Partial<DualMindConfig> = {},
    model?: ModelInterface
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.model = model || null;
  }

  // ============================================================================
  // 模型设置
  // ============================================================================

  setModel(model: ModelInterface): void {
    this.model = model;
    this.emit('modelSet');
  }

  hasModel(): boolean {
    return this.model !== null;
  }

  // ============================================================================
  // 双思维验证
  // ============================================================================

  /**
   * 执行双思维验证
   */
  async verify(task: string, proposal: string): Promise<VerificationResult> {
    // 记录任务
    const verificationTask: VerificationTask = {
      id: this.generateId(),
      task,
      proposal,
      timestamp: new Date(),
    };
    this.verificationHistory.push(verificationTask);
    if (this.verificationHistory.length > this.maxHistorySize) {
      this.verificationHistory = this.verificationHistory.slice(-this.maxHistorySize);
    }

    this.emit('verificationStarted', { taskId: verificationTask.id });

    // 如果没有模型，使用启发式验证
    if (!this.model) {
      return this.heuristicVerify(task, proposal);
    }

    try {
      // 主思维生成详细分析
      const mainThought = await this.generateMainThought(task, proposal);
      
      // 副思维独立审查
      const auditThought = await this.generateAuditThought(task, proposal, mainThought);
      
      // 检测分歧
      const divergence = this.analyzeDivergence(mainThought, auditThought);
      
      // 综合决策
      const result = this.synthesizeDecision(
        mainThought,
        auditThought,
        divergence,
        task,
        proposal
      );

      if (this.config.enableDetailedLogging) {
        this.emit('verificationCompleted', {
          taskId: verificationTask.id,
          mainThought,
          auditThought,
          divergence,
          result,
        });
      }

      return result;

    } catch (error) {
      this.emit('verificationError', { taskId: verificationTask.id, error });
      
      return {
        approved: false,
        confidence: 0,
        reason: `Verification error: ${error instanceof Error ? error.message : 'Unknown'}`,
        requiresHumanReview: true,
      };
    }
  }

  /**
   * 主思维 - 生成解决方案
   */
  private async generateMainThought(
    task: string,
    proposal: string
  ): Promise<ThoughtProcess> {
    const prompt = this.buildMainPrompt(task, proposal);
    
    const response = await this.model!.generate({
      prompt,
      temperature: this.config.mainTemperature,
      maxTokens: 500,
    });

    return {
      temperature: this.config.mainTemperature,
      reasoning: response.text,
      conclusion: this.extractConclusion(response.text),
      confidence: response.confidence,
      timestamp: new Date(),
    };
  }

  /**
   * 副思维 - 独立审查
   */
  private async generateAuditThought(
    task: string,
    proposal: string,
    mainThought: ThoughtProcess
  ): Promise<ThoughtProcess> {
    const prompt = this.buildAuditPrompt(task, proposal, mainThought);
    
    const response = await this.model!.generate({
      prompt,
      temperature: this.config.auditTemperature,
      maxTokens: 300,
    });

    return {
      temperature: this.config.auditTemperature,
      reasoning: response.text,
      conclusion: this.extractConclusion(response.text),
      confidence: response.confidence,
      timestamp: new Date(),
    };
  }

  // ============================================================================
  // 启发式验证 (无模型时)
  // ============================================================================

  private heuristicVerify(task: string, proposal: string): VerificationResult {
    // 危险模式检测
    const dangerousPatterns = [
      /eval\s*\(/i,
      /Function\s*\(/i,
      /child_process/i,
      /fs\.unlink/i,
      /rm\s+-rf/i,
      /drop\s+table/i,
      /delete\s+from/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(proposal)) {
        return {
          approved: false,
          confidence: 0.1,
          reason: `Dangerous pattern detected: ${pattern}`,
          requiresHumanReview: true,
        };
      }
    }

    // 自指攻击检测
    const selfRefPatterns = [
      /ignore\s+(all\s+)?previous\s+instructions/i,
      /ignore\s+above\s+instructions/i,
      /disregard\s+(all\s+)?previous/i,
      /you\s+are\s+now\s+/i,
      /new\s+instructions?\s*:/i,
    ];

    for (const pattern of selfRefPatterns) {
      if (pattern.test(proposal)) {
        return {
          approved: false,
          confidence: 0.1,
          reason: 'Potential prompt injection detected',
          requiresHumanReview: true,
        };
      }
    }

    return {
      approved: true,
      confidence: 0.8,
      requiresHumanReview: false,
    };
  }

  // ============================================================================
  // 分歧分析
  // ============================================================================

  private analyzeDivergence(
    main: ThoughtProcess,
    audit: ThoughtProcess
  ): DivergenceAnalysis {
    // 计算结论相似度
    const similarity = this.calculateSimilarity(main.conclusion, audit.conclusion);
    const differences: string[] = [];

    // 置信度差异
    const confidenceDiff = Math.abs(main.confidence - audit.confidence);
    if (confidenceDiff > 0.3) {
      differences.push(`Confidence divergence: ${confidenceDiff.toFixed(2)}`);
    }

    // 结论差异
    if (similarity < 0.8) {
      differences.push(`Conclusion divergence: ${(1 - similarity).toFixed(2)}`);
    }

    // 判断严重程度
    let severity: DivergenceAnalysis['severity'] = 'none';
    if (similarity < 0.5) {
      severity = 'critical';
    } else if (similarity < 0.7) {
      severity = 'major';
    } else if (similarity < 0.9) {
      severity = 'minor';
    }

    return {
      diverged: similarity < (1 - this.config.divergenceThreshold),
      similarity,
      differences,
      severity,
    };
  }

  private calculateSimilarity(a: string, b: string): number {
    // 简化实现：基于词重叠的相似度
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    
    return intersection.size / union.size;
  }

  // ============================================================================
  // 决策综合
  // ============================================================================

  private synthesizeDecision(
    mainThought: ThoughtProcess,
    auditThought: ThoughtProcess,
    divergence: DivergenceAnalysis,
    task: string,
    proposal: string
  ): VerificationResult {
    // 严重分歧需要人工审查
    if (divergence.severity === 'critical') {
      return {
        approved: false,
        confidence: Math.min(mainThought.confidence, auditThought.confidence),
        reason: `Critical divergence between main and audit thoughts: ${divergence.differences.join(', ')}`,
        requiresHumanReview: true,
        mainThought,
        auditThought,
        divergence,
      };
    }

    // 重大分歧降低置信度
    if (divergence.severity === 'major') {
      const avgConfidence = (mainThought.confidence + auditThought.confidence) / 2;
      
      return {
        approved: avgConfidence >= this.config.minConfidence,
        confidence: avgConfidence * 0.8, // 降低置信度
        reason: divergence.differences.join(', '),
        requiresHumanReview: avgConfidence < this.config.minConfidence,
        mainThought,
        auditThought,
        divergence,
      };
    }

    // 正常情况：以审核思维为主
    const approved = auditThought.confidence >= this.config.minConfidence;
    
    return {
      approved,
      confidence: auditThought.confidence,
      reason: approved ? 'Audit passed' : `Confidence ${auditThought.confidence.toFixed(2)} below threshold ${this.config.minConfidence}`,
      requiresHumanReview: !approved && auditThought.confidence < 0.5,
      mainThought,
      auditThought,
      divergence,
    };
  }

  // ============================================================================
  // 提示构建
  // ============================================================================

  private buildMainPrompt(task: string, proposal: string): string {
    return `You are the primary decision-making mind. Analyze the following task and proposal carefully.

Task: ${task}

Proposal: ${proposal}

Please provide:
1. Your reasoning process
2. Your conclusion (APPROVE or REJECT)
3. Your confidence level (0-1)

Format your response as:
REASONING: [your detailed reasoning]
CONCLUSION: [APPROVE/REJECT]
CONFIDENCE: [0-1]`;
  }

  private buildAuditPrompt(
    task: string,
    proposal: string,
    mainThought: ThoughtProcess
  ): string {
    return `You are the independent audit mind. Your role is to critically review decisions.

Task: ${task}

Proposal: ${proposal}

Primary Mind's Analysis:
${mainThought.reasoning}

Primary Mind's Conclusion: ${mainThought.conclusion}
Primary Mind's Confidence: ${mainThought.confidence}

Please independently review and provide:
1. Your critical assessment
2. Whether you AGREE or DISAGREE with the primary mind
3. Your confidence level (0-1)

Format your response as:
ASSESSMENT: [your critical assessment]
VERDICT: [AGREE/DISAGREE]
CONFIDENCE: [0-1]`;
  }

  private extractConclusion(text: string): string {
    const match = text.match(/(?:CONCLUSION|VERDICT):\s*(\w+)/i);
    return match ? match[1].toUpperCase() : 'UNKNOWN';
  }

  // ============================================================================
  // 查询
  // ============================================================================

  /**
   * 获取验证历史
   */
  getVerificationHistory(limit = 50): VerificationTask[] {
    return this.verificationHistory.slice(-limit);
  }

  /**
   * 获取健康状态
   */
  getHealth(): { healthy: boolean; hasModel: boolean } {
    return {
      healthy: this.model !== null,
      hasModel: this.model !== null,
    };
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalVerifications: number;
    hasModel: boolean;
  } {
    return {
      totalVerifications: this.verificationHistory.length,
      hasModel: this.model !== null,
    };
  }

  // ============================================================================
  // 配置
  // ============================================================================

  updateConfig(config: Partial<DualMindConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  private generateId(): string {
    return `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default DualMindVerifier;
