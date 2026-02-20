/**
 * @file core/reflection/analyzer.ts
 * @description 真实数据分析器 - Step 5.2
 * @author Ouroboros
 * @date 2026-02-18
 *
 * 从模拟数据升级为真实数据分析，连接 Phase 6 自我进化
 */

import type { Insight, SuggestedAction } from '@/types/reflection';
import type { PerformanceMetrics } from '@/types/model';
import { createContextLogger } from '@/utils/logger';
import { randomUUID } from 'crypto';

const logger = createContextLogger('ReflectionAnalyzer');

/**
 * 分析结果
 */
export interface AnalysisResult {
  insights: Insight[];
  suggestedActions: SuggestedAction[];
}

/**
 * 真实数据分析器
 */
export class ReflectionAnalyzer {
  /**
   * 分析性能数据和记忆统计
   */
  analyze(
    performanceMetrics: PerformanceMetrics[],
    memoryStats: {
      typeCounts: Record<string, number>;
      salienceReport: {
        highSalience: number;
        mediumSalience: number;
        lowSalience: number;
        shouldForget: number;
      };
    }
  ): AnalysisResult {
    const insights: Insight[] = [];
    const suggestedActions: SuggestedAction[] = [];

    // 1. 性能趋势分析
    const performanceInsight = this.analyzePerformanceTrend(performanceMetrics);
    if (performanceInsight) {
      insights.push(performanceInsight);
      suggestedActions.push(...this.generatePerformanceActions(performanceInsight));
    }

    // 2. 记忆系统分析
    const memoryInsight = this.analyzeMemorySystem(memoryStats);
    if (memoryInsight) {
      insights.push(memoryInsight);
      suggestedActions.push(...this.generateMemoryActions(memoryInsight));
    }

    // 3. 错误模式分析
    const errorInsight = this.analyzeErrorPatterns(performanceMetrics);
    if (errorInsight) {
      insights.push(errorInsight);
      suggestedActions.push(...this.generateErrorActions(errorInsight));
    }

    // 4. Token 效率分析
    const tokenInsight = this.analyzeTokenEfficiency(performanceMetrics);
    if (tokenInsight) {
      insights.push(tokenInsight);
      suggestedActions.push(...this.generateTokenActions(tokenInsight));
    }

    logger.info('分析完成', {
      insightCount: insights.length,
      actionCount: suggestedActions.length,
    });

    return { insights, suggestedActions };
  }

  /**
   * 分析性能趋势
   */
  private analyzePerformanceTrend(metrics: PerformanceMetrics[]): Insight | null {
    if (metrics.length < 10) return null;

    const recent = metrics.slice(-20);
    const older = metrics.slice(-40, -20);

    const recentAvg = recent.reduce((sum, m) => sum + m.responseTimeMs, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.responseTimeMs, 0) / older.length;

    const recentErrorRate = recent.filter(m => !m.success).length / recent.length;

    // 响应时间恶化
    if (recentAvg > olderAvg * 1.5) {
      return {
        id: randomUUID(),
        type: 'problem',
        title: '响应时间恶化',
        description: `响应时间恶化: ${olderAvg.toFixed(0)}ms → ${recentAvg.toFixed(0)}ms`,
        confidence: 0.85,
        relatedMemoryIds: [],
        suggestedActions: [],
        createdAt: new Date().toISOString(),
        applied: false,
      };
    }

    // 错误率上升
    if (recentErrorRate > 0.1) {
      return {
        id: randomUUID(),
        type: 'problem',
        title: '错误率过高',
        description: `错误率过高: ${(recentErrorRate * 100).toFixed(1)}%`,
        confidence: 0.9,
        relatedMemoryIds: [],
        suggestedActions: [],
        createdAt: new Date().toISOString(),
        applied: false,
      };
    }

    // 性能良好
    if (recentAvg < 1000 && recentErrorRate < 0.05) {
      return {
        id: randomUUID(),
        type: 'pattern',
        title: '性能表现良好',
        description: '性能表现良好，响应时间和错误率都在健康范围',
        confidence: 0.8,
        relatedMemoryIds: [],
        suggestedActions: [],
        createdAt: new Date().toISOString(),
        applied: false,
      };
    }

    return null;
  }

  /**
   * 分析记忆系统
   */
  private analyzeMemorySystem(stats: {
    typeCounts: Record<string, number>;
    salienceReport: {
      highSalience: number;
      mediumSalience: number;
      lowSalience: number;
      shouldForget: number;
    };
  }): Insight | null {
    const total = stats.salienceReport.highSalience + 
                  stats.salienceReport.mediumSalience + 
                  stats.salienceReport.lowSalience;

    // 需要清理的记忆过多
    if (stats.salienceReport.shouldForget > 100) {
      return {
        id: randomUUID(),
        type: 'opportunity',
        title: '记忆清理机会',
        description: `${stats.salienceReport.shouldForget} 个低价值记忆可清理，释放资源`,
        confidence: 0.9,
        relatedMemoryIds: [],
        suggestedActions: [],
        createdAt: new Date().toISOString(),
        applied: false,
      };
    }

    // 记忆分布不均
    if (stats.salienceReport.lowSalience > total * 0.7) {
      return {
        id: randomUUID(),
        type: 'problem',
        title: '低价值记忆过多',
        description: '低价值记忆占比过高，记忆质量下降',
        confidence: 0.75,
        relatedMemoryIds: [],
        suggestedActions: [],
        createdAt: new Date().toISOString(),
        applied: false,
      };
    }

    return null;
  }

  /**
   * 分析错误模式
   */
  private analyzeErrorPatterns(metrics: PerformanceMetrics[]): Insight | null {
    const errors = metrics.filter(m => !m.success);
    if (errors.length < 5) return null;

    // 检查连续错误
    let maxConsecutive = 0;
    let currentConsecutive = 0;
    for (const m of metrics.slice(-20)) {
      if (!m.success) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }
    }

    if (maxConsecutive >= 3) {
      return {
        id: randomUUID(),
        type: 'problem',
        title: '连续失败检测',
        description: `检测到连续 ${maxConsecutive} 次失败，系统稳定性下降`,
        confidence: 0.9,
        relatedMemoryIds: [],
        suggestedActions: [],
        createdAt: new Date().toISOString(),
        applied: false,
      };
    }

    return null;
  }

  /**
   * 分析 Token 效率
   */
  private analyzeTokenEfficiency(metrics: PerformanceMetrics[]): Insight | null {
    if (metrics.length < 5) return null;

    const recent = metrics.slice(-10);
    const avgTokens = recent.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0) / recent.length;

    if (avgTokens > 4000) {
      return {
        id: randomUUID(),
        type: 'problem',
        title: 'Token 使用过高',
        description: `Token 使用量过高: ${avgTokens.toFixed(0)}/请求，建议优化提示词`,
        confidence: 0.8,
        relatedMemoryIds: [],
        suggestedActions: [],
        createdAt: new Date().toISOString(),
        applied: false,
      };
    }

    return null;
  }

  /**
   * 生成性能改进行动
   */
  private generatePerformanceActions(insight: Insight): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    if (insight.description.includes('响应时间恶化')) {
      actions.push({
        id: randomUUID(),
        type: 'parameterTuning',
        description: '减少工作记忆容量 (7→5)，降低处理复杂度',
        expectedImpact: '减少20%响应时间',
        difficulty: 0.2,
        riskLevel: 'low',
      });

      actions.push({
        id: randomUUID(),
        type: 'workflowChange',
        description: '增加自我维护频率，及时清理过期记忆',
        expectedImpact: '减少15%内存占用',
        difficulty: 0.3,
        riskLevel: 'low',
      });
    }

    if (insight.description.includes('错误率过高')) {
      actions.push({
        id: randomUUID(),
        type: 'promptOptimization',
        description: '切换到保守模式，降低风险操作',
        expectedImpact: '减少30%错误率',
        difficulty: 0.3,
        riskLevel: 'medium',
      });
    }

    return actions;
  }

  /**
   * 生成记忆系统改进行动
   */
  private generateMemoryActions(insight: Insight): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    if (insight.description.includes('可清理')) {
      actions.push({
        id: randomUUID(),
        type: 'parameterTuning',
        description: '执行记忆遗忘，清理低价值记忆',
        expectedImpact: '释放10%存储空间',
        difficulty: 0.2,
        riskLevel: 'low',
      });
    }

    if (insight.description.includes('低价值记忆占比过高')) {
      actions.push({
        id: randomUUID(),
        type: 'parameterTuning',
        description: '提高记忆重要性阈值，减少低质量记忆存储',
        expectedImpact: '提升记忆质量15%',
        difficulty: 0.2,
        riskLevel: 'low',
      });
    }

    return actions;
  }

  /**
   * 生成错误改进行动
   */
  private generateErrorActions(insight: Insight): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    if (insight.description.includes('连续失败')) {
      actions.push({
        id: randomUUID(),
        type: 'workflowChange',
        description: '启用熔断模式，连续失败时暂停非关键任务',
        expectedImpact: '减少40%级联失败',
        difficulty: 0.4,
        riskLevel: 'medium',
      });

      actions.push({
        id: randomUUID(),
        type: 'promptOptimization',
        description: '优化系统提示词，增加错误处理指导（软自指）',
        expectedImpact: '减少25%错误率',
        difficulty: 0.3,
        riskLevel: 'low',
      });
    }

    return actions;
  }

  /**
   * 生成 Token 优化行动
   */
  private generateTokenActions(insight: Insight): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    if (insight.description.includes('Token 使用量过高')) {
      actions.push({
        id: randomUUID(),
        type: 'promptOptimization',
        description: '启用提示词压缩，减少 Token 使用（软自指）',
        expectedImpact: '减少30% Token消耗',
        difficulty: 0.2,
        riskLevel: 'low',
      });
    }

    return actions;
  }
}

export default ReflectionAnalyzer;
