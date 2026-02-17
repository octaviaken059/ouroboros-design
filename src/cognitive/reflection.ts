/**
 * Ouroboros - Reflection Engine
 * 反射引擎 - 元认知能力实现
 * 
 * 核心功能:
 * - 认知偏差检测
 * - 置信度校准
 * - 洞察生成
 * - 学习方向识别
 */

import { CapabilityBelief } from './bayesian.js';

export type BiasType = 
  | 'overconfidence'
  | 'underconfidence' 
  | 'recency'
  | 'confirmation'
  | 'availability'
  | 'anchoring'
  | 'survivorship'
  | 'hindsight'
  | 'sunk_cost'
  | 'framing'
  | 'clustering'
  | 'neglect_of_probability';

export interface BiasDetection {
  type: BiasType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  evidence: string[];
  mitigation: string[];
}

export interface CalibrationAssessment {
  wellCalibrated: boolean;
  calibrationScore: number;  // 0-1, 1 = perfect calibration
  overconfident: boolean;
  underconfident: boolean;
  recommendedAdjustment: number;
  analysis: string;
}

export interface Insight {
  id: string;
  timestamp: number;
  category: 'pattern' | 'error' | 'opportunity' | 'limitation' | 'strength';
  insight: string;
  supportingEvidence: string[];
  actionItems: string[];
  impact: number;  // 0-1
  relatedCapabilities: string[];
}

export interface ReflectionContext {
  recentDecisions: Array<{
    timestamp: number;
    decision: string;
    predictedOutcome: string;
    actualOutcome?: string;
    confidence: number;
    capabilitiesUsed: string[];
  }>;
  beliefs: Map<string, CapabilityBelief>;
  recentErrors: Array<{
    timestamp: number;
    error: string;
    context: string;
    recovered: boolean;
  }>;
  performanceMetrics: Record<string, number>;
}

export interface ReflectionResult {
  timestamp: number;
  biasesDetected: BiasDetection[];
  calibration: CalibrationAssessment;
  insights: Insight[];
  learningDirections: string[];
  overallScore: number;  // 0-1, meta-cognitive health
  recommendations: string[];
}

export interface ReflectionConfig {
  minDecisionsForReflection: number;
  confidenceCalibrationWindow: number;
  recencyBiasThreshold: number;
  overconfidenceThreshold: number;
  minEvidenceForBias: number;
}

const DEFAULT_CONFIG: ReflectionConfig = {
  minDecisionsForReflection: 3,
  confidenceCalibrationWindow: 10,
  recencyBiasThreshold: 0.7,
  overconfidenceThreshold: 0.8,
  minEvidenceForBias: 2,
};

/**
 * 反射引擎
 * 实现元认知能力 - "思考自己的思考"
 */
export class ReflectionEngine {
  private config: ReflectionConfig;
  private insightHistory: Insight[] = [];
  private decisionHistory: ReflectionContext['recentDecisions'] = [];

  constructor(config: Partial<ReflectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 执行完整反思周期
   */
  async reflect(context: ReflectionContext): Promise<ReflectionResult> {
    // 1. 检测认知偏差
    const biases = this.detectBiases(context);
    
    // 2. 评估置信度校准
    const calibration = this.assessCalibration(context);
    
    // 3. 生成洞察
    const insights = this.generateInsights(context, biases);
    
    // 4. 识别学习方向
    const learningDirections = this.identifyLearningDirections(context, biases, insights);
    
    // 5. 计算整体元认知健康分数
    const overallScore = this.calculateOverallScore(biases, calibration, insights);

    // 6. 生成建议
    const recommendations = this.generateRecommendations(biases, calibration, insights);

    // 保存决策历史
    this.decisionHistory.push(...context.recentDecisions);
    if (this.decisionHistory.length > 100) {
      this.decisionHistory = this.decisionHistory.slice(-100);
    }

    // 保存洞察
    this.insightHistory.push(...insights);

    return {
      timestamp: Date.now(),
      biasesDetected: biases,
      calibration,
      insights,
      learningDirections,
      overallScore,
      recommendations,
    };
  }

  /**
   * 检测认知偏差
   */
  private detectBiases(context: ReflectionContext): BiasDetection[] {
    const biases: BiasDetection[] = [];

    if (context.recentDecisions.length < this.config.minDecisionsForReflection) {
      return biases;
    }

    // 1. 过度自信偏差
    const overconfidence = this.detectOverconfidence(context);
    if (overconfidence) biases.push(overconfidence);

    // 2. 近因偏差
    const recency = this.detectRecencyBias(context);
    if (recency) biases.push(recency);

    // 3. 确认偏差
    const confirmation = this.detectConfirmationBias(context);
    if (confirmation) biases.push(confirmation);

    // 4. 可得性启发
    const availability = this.detectAvailabilityBias(context);
    if (availability) biases.push(availability);

    // 5. 锚定效应
    const anchoring = this.detectAnchoring(context);
    if (anchoring) biases.push(anchoring);

    // 6. 幸存者偏差
    const survivorship = this.detectSurvivorshipBias(context);
    if (survivorship) biases.push(survivorship);

    return biases;
  }

  /**
   * 检测过度自信
   */
  private detectOverconfidence(context: ReflectionContext): BiasDetection | null {
    const withOutcome = context.recentDecisions.filter(d => d.actualOutcome !== undefined);
    if (withOutcome.length < this.config.minEvidenceForBias) return null;

    const highConfidence = withOutcome.filter(d => d.confidence > this.config.overconfidenceThreshold);
    const incorrectHighConf = highConfidence.filter(d => 
      !this.outcomeMatchesPrediction(d.predictedOutcome, d.actualOutcome!)
    );

    if (highConfidence.length > 0) {
      const errorRate = incorrectHighConf.length / highConfidence.length;
      if (errorRate > 0.3) {
        return {
          type: 'overconfidence',
          severity: errorRate > 0.5 ? 'high' : errorRate > 0.3 ? 'medium' : 'low',
          confidence: errorRate,
          evidence: incorrectHighConf.map(d => 
            `Predicted: "${d.predictedOutcome}", Actual: "${d.actualOutcome}" (confidence: ${(d.confidence * 100).toFixed(0)}%)`
          ),
          mitigation: [
            'Implement pre-mortem analysis before high-confidence decisions',
            'Seek disconfirming evidence deliberately',
            'Reduce confidence estimates by 10-20%',
            'Require second opinion for confidence > 80%',
          ],
        };
      }
    }

    return null;
  }

  /**
   * 检测近因偏差
   */
  private detectRecencyBias(context: ReflectionContext): BiasDetection | null {
    if (context.recentDecisions.length < 5) return null;

    const sorted = [...context.recentDecisions].sort((a, b) => b.timestamp - a.timestamp);
    const recent = sorted.slice(0, 3);
    const older = sorted.slice(3, 8);

    if (older.length === 0) return null;

    const recentAvgConf = recent.reduce((sum, d) => sum + d.confidence, 0) / recent.length;
    const olderAvgConf = older.reduce((sum, d) => sum + d.confidence, 0) / older.length;

    if (recentAvgConf > olderAvgConf * 1.3) {
      return {
        type: 'recency',
        severity: recentAvgConf > olderAvgConf * 1.5 ? 'medium' : 'low',
        confidence: (recentAvgConf - olderAvgConf),
        evidence: [
          `Recent avg confidence: ${(recentAvgConf * 100).toFixed(1)}%`,
          `Older avg confidence: ${(olderAvgConf * 100).toFixed(1)}%`,
          'Recent events may be overweighted in decision making',
        ],
        mitigation: [
          'Review historical data before making decisions',
          'Keep decision log to maintain perspective',
          'Use base rates rather than recent anecdotes',
          'Consider longer time horizons',
        ],
      };
    }

    return null;
  }

  /**
   * 检测确认偏差
   */
  private detectConfirmationBias(context: ReflectionContext): BiasDetection | null {
    // 检查是否所有决策都成功 (不可能)
    const withOutcome = context.recentDecisions.filter(d => d.actualOutcome !== undefined);
    if (withOutcome.length < 5) return null;

    const successes = withOutcome.filter(d => 
      this.outcomeMatchesPrediction(d.predictedOutcome, d.actualOutcome!)
    );

    if (successes.length / withOutcome.length > 0.9) {
      return {
        type: 'confirmation',
        severity: 'medium',
        confidence: 0.6,
        evidence: [
          `Success rate: ${((successes.length / withOutcome.length) * 100).toFixed(0)}% (suspiciously high)`,
          'May be avoiding or ignoring negative feedback',
        ],
        mitigation: [
          'Actively seek counter-evidence',
          'Assign someone to argue against preferred conclusion',
          'Track failed predictions explicitly',
          'Use falsification testing',
        ],
      };
    }

    return null;
  }

  /**
   * 检测可得性偏差
   */
  private detectAvailabilityBias(context: ReflectionContext): BiasDetection | null {
    // 检查是否基于容易回忆的例子做决策
    const recentErrors = context.recentErrors.filter(e => 
      Date.now() - e.timestamp < 24 * 60 * 60 * 1000 // 24h
    );

    if (recentErrors.length >= 2) {
      return {
        type: 'availability',
        severity: recentErrors.length > 3 ? 'medium' : 'low',
        confidence: 0.5,
        evidence: recentErrors.map(e => `Recent error: ${e.error}`),
        mitigation: [
          'Check actual frequency statistics, not just memorable examples',
          'Keep comprehensive error log for analysis',
          'Consider base rates in similar situations',
          'Don\'t overreact to vivid but rare events',
        ],
      };
    }

    return null;
  }

  /**
   * 检测锚定效应
   */
  private detectAnchoring(context: ReflectionContext): BiasDetection | null {
    // 检查是否第一个估计值影响后续估计
    if (context.recentDecisions.length < 4) return null;

    const confidences = context.recentDecisions.map(d => d.confidence);
    const firstConf = confidences[0];
    const others = confidences.slice(1);
    
    const othersCloseToFirst = others.filter(c => Math.abs(c - firstConf) < 0.1).length;
    
    if (othersCloseToFirst / others.length > 0.7) {
      return {
        type: 'anchoring',
        severity: 'low',
        confidence: 0.4,
        evidence: [
          `First confidence: ${(firstConf * 100).toFixed(0)}%`,
          `${othersCloseToFirst}/${others.length} subsequent estimates within 10%`,
        ],
        mitigation: [
          'Start from different reference points',
          'Consider range of possible values',
          'Generate estimate independently before seeing others',
          'Use structured estimation techniques',
        ],
      };
    }

    return null;
  }

  /**
   * 检测幸存者偏差
   */
  private detectSurvivorshipBias(context: ReflectionContext): BiasDetection | null {
    // 检查是否只关注成功案例
    const successfulCaps = new Set<string>();
    const allCaps = new Set<string>();

    for (const decision of context.recentDecisions) {
      decision.capabilitiesUsed.forEach(cap => {
        allCaps.add(cap);
        if (decision.actualOutcome && 
            this.outcomeMatchesPrediction(decision.predictedOutcome, decision.actualOutcome)) {
          successfulCaps.add(cap);
        }
      });
    }

    const failureCaps = Array.from(allCaps).filter(cap => !successfulCaps.has(cap));
    
    if (failureCaps.length > 0 && successfulCaps.size / allCaps.size > 0.8) {
      return {
        type: 'survivorship',
        severity: 'medium',
        confidence: successfulCaps.size / allCaps.size,
        evidence: [
          `Frequently used capabilities: ${Array.from(allCaps).join(', ')}`,
          `Underperforming: ${failureCaps.join(', ')}`,
          'May be overlooking less visible failure cases',
        ],
        mitigation: [
          'Track all attempts, not just successes',
          'Analyze failure cases for patterns',
          'Consider what data is missing',
          'Study survivor AND non-survivor cases',
        ],
      };
    }

    return null;
  }

  /**
   * 评估置信度校准
   */
  private assessCalibration(context: ReflectionContext): CalibrationAssessment {
    const withOutcome = context.recentDecisions.filter(d => d.actualOutcome !== undefined);
    
    if (withOutcome.length < this.config.confidenceCalibrationWindow) {
      return {
        wellCalibrated: true,
        calibrationScore: 0.5,
        overconfident: false,
        underconfident: false,
        recommendedAdjustment: 0,
        analysis: 'Insufficient data for calibration assessment',
      };
    }

    // 将置信度分桶
    const buckets: Record<string, { predicted: number; actual: number }> = {
      '50-60': { predicted: 0, actual: 0 },
      '60-70': { predicted: 0, actual: 0 },
      '70-80': { predicted: 0, actual: 0 },
      '80-90': { predicted: 0, actual: 0 },
      '90-100': { predicted: 0, actual: 0 },
    };

    for (const decision of withOutcome) {
      const bucket = this.getConfidenceBucket(decision.confidence);
      buckets[bucket].predicted++;
      if (this.outcomeMatchesPrediction(decision.predictedOutcome, decision.actualOutcome!)) {
        buckets[bucket].actual++;
      }
    }

    // 计算校准误差
    let totalError = 0;
    let bucketCount = 0;
    
    for (const [range, data] of Object.entries(buckets)) {
      if (data.predicted > 0) {
        const expectedRate = (parseInt(range.split('-')[0]) + parseInt(range.split('-')[1])) / 200;
        const actualRate = data.actual / data.predicted;
        totalError += Math.abs(expectedRate - actualRate);
        bucketCount++;
      }
    }

    const avgError = bucketCount > 0 ? totalError / bucketCount : 0;
    const calibrationScore = Math.max(0, 1 - avgError * 2);

    // 判断过度自信或不足自信
    const highConfDecisions = withOutcome.filter(d => d.confidence > 0.7);
    const highConfSuccessRate = highConfDecisions.length > 0
      ? highConfDecisions.filter(d => 
          this.outcomeMatchesPrediction(d.predictedOutcome, d.actualOutcome!)
        ).length / highConfDecisions.length
      : 0.5;

    const expectedSuccessRate = highConfDecisions.reduce((sum, d) => sum + d.confidence, 0) / 
      (highConfDecisions.length || 1);

    const overconfident = highConfSuccessRate < expectedSuccessRate - 0.15;
    const underconfident = highConfSuccessRate > expectedSuccessRate + 0.15;

    return {
      wellCalibrated: calibrationScore > 0.7 && !overconfident && !underconfident,
      calibrationScore,
      overconfident,
      underconfident,
      recommendedAdjustment: overconfident ? -0.1 : underconfident ? 0.1 : 0,
      analysis: overconfident 
        ? 'Systematically overconfident - reduce confidence estimates'
        : underconfident
        ? 'Systematically underconfident - can be more assertive'
        : 'Reasonably well calibrated',
    };
  }

  /**
   * 生成洞察
   */
  private generateInsights(
    context: ReflectionContext,
    biases: BiasDetection[]
  ): Insight[] {
    const insights: Insight[] = [];

    // 1. 模式识别
    const patterns = this.identifyPatterns(context);
    insights.push(...patterns);

    // 2. 错误分析
    const errorInsights = this.analyzeErrors(context);
    insights.push(...errorInsights);

    // 3. 能力差距
    const capabilityGaps = this.identifyCapabilityGaps(context);
    insights.push(...capabilityGaps);

    // 4. 优势识别
    const strengths = this.identifyStrengths(context);
    insights.push(...strengths);

    return insights;
  }

  /**
   * 识别模式
   */
  private identifyPatterns(context: ReflectionContext): Insight[] {
    const insights: Insight[] = [];

    // 检查时间模式
    const byHour = new Map<number, number>();
    for (const decision of context.recentDecisions) {
      const hour = new Date(decision.timestamp).getHours();
      byHour.set(hour, (byHour.get(hour) || 0) + 1);
    }

    let maxHour = 0;
    let maxCount = 0;
    for (const [hour, count] of byHour.entries()) {
      if (count > maxCount) {
        maxCount = count;
        maxHour = hour;
      }
    }

    if (maxCount > context.recentDecisions.length * 0.3) {
      insights.push({
        id: `pat_${Date.now()}_time`,
        timestamp: Date.now(),
        category: 'pattern',
        insight: `Most decisions made at ${maxHour}:00 - consider if this is optimal timing`,
        supportingEvidence: [`${maxCount} decisions at this hour`],
        actionItems: ['Review decision quality by time of day', 'Consider scheduling important decisions strategically'],
        impact: 0.4,
        relatedCapabilities: [],
      });
    }

    return insights;
  }

  /**
   * 分析错误
   */
  private analyzeErrors(context: ReflectionContext): Insight[] {
    const insights: Insight[] = [];

    if (context.recentErrors.length >= 3) {
      const unrecovered = context.recentErrors.filter(e => !e.recovered);
      
      if (unrecovered.length > 1) {
        insights.push({
          id: `err_${Date.now()}_recovery`,
          timestamp: Date.now(),
          category: 'error',
          insight: `${unrecovered.length} recent errors without recovery - recovery mechanisms need improvement`,
          supportingEvidence: unrecovered.map(e => e.error),
          actionItems: ['Review error recovery procedures', 'Add more graceful degradation'],
          impact: 0.8,
          relatedCapabilities: [],
        });
      }
    }

    return insights;
  }

  /**
   * 识别能力差距
   */
  private identifyCapabilityGaps(context: ReflectionContext): Insight[] {
    const insights: Insight[] = [];
    const lowConfidenceCaps: string[] = [];

    for (const [cap, belief] of context.beliefs.entries()) {
      const totalAttempts = belief.successCount + belief.failCount;
      if (totalAttempts >= 5 && belief.confidence < 0.6) {
        lowConfidenceCaps.push(cap);
      }
    }

    if (lowConfidenceCaps.length > 0) {
      insights.push({
        id: `gap_${Date.now()}_cap`,
        timestamp: Date.now(),
        category: 'limitation',
        insight: `Low confidence in: ${lowConfidenceCaps.join(', ')} - targeted practice recommended`,
        supportingEvidence: lowConfidenceCaps.map(cap => {
          const b = context.beliefs.get(cap)!;
          return `${cap}: ${(b.confidence * 100).toFixed(0)}% confidence`;
        }),
        actionItems: lowConfidenceCaps.map(cap => `Schedule focused practice for ${cap}`),
        impact: 0.7,
        relatedCapabilities: lowConfidenceCaps,
      });
    }

    return insights;
  }

  /**
   * 识别优势
   */
  private identifyStrengths(context: ReflectionContext): Insight[] {
    const insights: Insight[] = [];
    const highConfidenceCaps: string[] = [];

    for (const [cap, belief] of context.beliefs.entries()) {
      const totalAttempts = belief.successCount + belief.failCount;
      if (totalAttempts >= 10 && belief.confidence > 0.85) {
        highConfidenceCaps.push(cap);
      }
    }

    if (highConfidenceCaps.length > 0) {
      insights.push({
        id: `str_${Date.now()}_cap`,
        timestamp: Date.now(),
        category: 'strength',
        insight: `Strong capabilities in: ${highConfidenceCaps.join(', ')} - can rely on these`,
        supportingEvidence: highConfidenceCaps.map(cap => {
          const b = context.beliefs.get(cap)!;
          return `${cap}: ${(b.confidence * 100).toFixed(0)}% confidence over ${b.successCount + b.failCount} attempts`;
        }),
        actionItems: ['Leverage these strengths in complex tasks', 'Mentor others in these areas'],
        impact: 0.6,
        relatedCapabilities: highConfidenceCaps,
      });
    }

    return insights;
  }

  /**
   * 识别学习方向
   */
  private identifyLearningDirections(
    context: ReflectionContext,
    biases: BiasDetection[],
    insights: Insight[]
  ): string[] {
    const directions: string[] = [];

    // 从偏差生成
    for (const bias of biases) {
      directions.push(`Address ${bias.type} bias through: ${bias.mitigation[0]}`);
    }

    // 从洞察生成
    for (const insight of insights) {
      if (insight.category === 'limitation') {
        directions.push(...insight.actionItems);
      }
    }

    // 基于置信度校准
    const withOutcome = context.recentDecisions.filter(d => d.actualOutcome !== undefined);
    if (withOutcome.length >= 10) {
      const accuracy = withOutcome.filter(d => 
        this.outcomeMatchesPrediction(d.predictedOutcome, d.actualOutcome!)
      ).length / withOutcome.length;

      if (accuracy < 0.6) {
        directions.push('Improve outcome prediction through better modeling');
      }
    }

    // 去重并返回
    return [...new Set(directions)];
  }

  /**
   * 计算整体元认知健康分数
   */
  private calculateOverallScore(
    biases: BiasDetection[],
    calibration: CalibrationAssessment,
    insights: Insight[]
  ): number {
    let score = 0.5; // 基础分

    // 校准贡献
    score += calibration.calibrationScore * 0.3;

    // 偏差惩罚
    const biasPenalty = biases.reduce((sum, b) => {
      const weight = { low: 0.02, medium: 0.05, high: 0.1, critical: 0.15 }[b.severity];
      return sum + weight;
    }, 0);
    score -= biasPenalty;

    // 洞察加分
    score += Math.min(insights.length * 0.02, 0.1);

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 生成建议
   */
  private generateRecommendations(
    biases: BiasDetection[],
    calibration: CalibrationAssessment,
    insights: Insight[]
  ): string[] {
    const recommendations: string[] = [];

    if (!calibration.wellCalibrated) {
      recommendations.push(`Confidence calibration needs improvement: ${calibration.analysis}`);
    }

    for (const bias of biases.filter(b => b.severity >= 'medium')) {
      recommendations.push(`Address ${bias.type}: ${bias.mitigation[0]}`);
    }

    for (const insight of insights.filter(i => i.impact >= 0.7)) {
      recommendations.push(...insight.actionItems.slice(0, 1));
    }

    return [...new Set(recommendations)];
  }

  // ============ 工具方法 ============

  private outcomeMatchesPrediction(predicted: string, actual: string): boolean {
    const p = predicted.toLowerCase().trim();
    const a = actual.toLowerCase().trim();
    
    // 简单匹配，实际应用中可使用语义相似度
    return p === a || 
           a.includes(p) || 
           p.includes(a) ||
           (p.includes('success') && a.includes('success')) ||
           (p.includes('fail') && a.includes('fail'));
  }

  private getConfidenceBucket(confidence: number): string {
    if (confidence < 0.6) return '50-60';
    if (confidence < 0.7) return '60-70';
    if (confidence < 0.8) return '70-80';
    if (confidence < 0.9) return '80-90';
    return '90-100';
  }

  /**
   * 获取洞察历史
   */
  getInsightHistory(): Insight[] {
    return [...this.insightHistory];
  }

  /**
   * 获取决策历史
   */
  getDecisionHistory(): ReflectionContext['recentDecisions'] {
    return [...this.decisionHistory];
  }
}

export default ReflectionEngine;
