/**
 * @file capabilities/loader/capability-selector.ts
 * @description 能力选择器 - 基于意图动态选择能力
 * @author Ouroboros
 * @date 2026-02-19
 */

import { createContextLogger } from '@/utils/logger';
import type { Capability, CapabilityRegistry } from '@/capabilities/discovery/capability-registry';
import type { RecognizedIntent } from '@/capabilities/intent';

const logger = createContextLogger('CapabilitySelector');

/** 能力选择选项 */
export interface CapabilitySelectionOptions {
  /** 最大选择数量 */
  maxCapabilities?: number;
  /** 最小置信度 */
  minConfidence?: number;
  /** 优先可用能力 */
  preferAvailable?: boolean;
  /** 包含相关能力 */
  includeRelated?: boolean;
}

/** 选择的能力 */
export interface SelectedCapabilities {
  /** 主要能力 */
  primary: Capability[];
  /** 辅助能力 */
  secondary: Capability[];
  /** 备选能力 */
  fallback: Capability[];
  /** 选择理由 */
  reasoning: string;
  /** 总置信度 */
  confidence: number;
}

/** 能力匹配分数 */
interface CapabilityScore {
  capability: Capability;
  score: number;
  matchReason: string[];
}

/**
 * 能力选择器
 * 
 * 基于识别出的意图，从能力注册表中选择最合适的能力
 */
export class CapabilitySelector {
  private registry: CapabilityRegistry;
  private options: CapabilitySelectionOptions;

  /** 意图到能力类别的映射 */
  private static readonly INTENT_CAPABILITY_MAP: Record<string, string[]> = {
    code: ['development', 'programming', 'coding', 'analysis'],
    analysis: ['analysis', 'data', 'search', 'research'],
    search: ['search', 'web', 'information', 'retrieval'],
    creation: ['creation', 'generation', 'writing', 'media'],
    modification: ['modification', 'editing', 'refactoring'],
    execution: ['execution', 'command', 'script', 'automation'],
    learning: ['learning', 'research', 'documentation', 'exploration'],
    planning: ['planning', 'scheduling', 'organization'],
    debugging: ['debugging', 'analysis', 'testing'],
    review: ['review', 'analysis', 'quality', 'audit'],
    query: ['query', 'information', 'knowledge', 'database'],
    automation: ['automation', 'scripting', 'workflow'],
    integration: ['integration', 'api', 'connection'],
  };

  constructor(registry: CapabilityRegistry, options: CapabilitySelectionOptions = {}) {
    this.registry = registry;
    this.options = {
      maxCapabilities: 10,
      minConfidence: 0.3,
      preferAvailable: true,
      includeRelated: true,
      ...options,
    };
  }

  /**
   * 基于意图选择能力
   */
  selectForIntent(intent: RecognizedIntent): SelectedCapabilities {
    logger.debug(`Selecting capabilities for intent: ${intent.primary}`);

    const allCapabilities = this.registry.getAll();
    const scoredCapabilities: CapabilityScore[] = [];

    // 计算每个能力的匹配分数
    for (const capability of allCapabilities) {
      const score = this.calculateMatchScore(capability, intent);
      if (score.score >= this.options.minConfidence!) {
        scoredCapabilities.push(score);
      }
    }

    // 排序
    scoredCapabilities.sort((a, b) => b.score - a.score);

    // 分类选择
    const primary: Capability[] = [];
    const secondary: Capability[] = [];
    const fallback: Capability[] = [];

    for (const scored of scoredCapabilities) {
      if (scored.score >= 0.8 && primary.length < 3) {
        primary.push(scored.capability);
      } else if (scored.score >= 0.5 && secondary.length < 4) {
        secondary.push(scored.capability);
      } else if (fallback.length < 3) {
        fallback.push(scored.capability);
      }

      if (primary.length + secondary.length + fallback.length >= this.options.maxCapabilities!) {
        break;
      }
    }

    const totalConfidence = scoredCapabilities.length > 0 
      ? scoredCapabilities.slice(0, 5).reduce((sum, s) => sum + s.score, 0) / Math.min(5, scoredCapabilities.length)
      : 0;

    const result: SelectedCapabilities = {
      primary,
      secondary,
      fallback,
      reasoning: this.generateReasoning(intent, primary, secondary),
      confidence: totalConfidence,
    };

    logger.info(`Selected ${primary.length} primary, ${secondary.length} secondary, ${fallback.length} fallback capabilities`);
    
    return result;
  }

  /**
   * 计算匹配分数
   */
  private calculateMatchScore(capability: Capability, intent: RecognizedIntent): CapabilityScore {
    let score = 0;
    const matchReason: string[] = [];

    // 1. 意图类型匹配 (权重: 0.4)
    const relevantCategories = CapabilitySelector.INTENT_CAPABILITY_MAP[intent.primary] || [];
    if (relevantCategories.includes(capability.category)) {
      score += 0.4;
      matchReason.push(`Category '${capability.category}' matches intent '${intent.primary}'`);
    }

    // 2. 关键词匹配 (权重: 0.3)
    const keywordMatches = this.countKeywordMatches(capability, intent.keywords);
    if (keywordMatches > 0) {
      score += Math.min(0.3, keywordMatches * 0.1);
      matchReason.push(`${keywordMatches} keyword matches`);
    }

    // 3. 标签匹配 (权重: 0.2)
    const tagMatches = capability.tags.filter(tag => 
      intent.keywords.some(kw => tag.toLowerCase().includes(kw.toLowerCase()))
    ).length;
    if (tagMatches > 0) {
      score += Math.min(0.2, tagMatches * 0.05);
      matchReason.push(`${tagMatches} tag matches`);
    }

    // 4. 能力置信度 (权重: 0.1)
    score += capability.confidence * 0.1;

    // 5. 可用性奖励/惩罚
    if (capability.available) {
      score *= 1.2;
    } else if (this.options.preferAvailable) {
      score *= 0.5;
    }

    // 6. 使用历史奖励
    if (capability.stats.callCount > 0) {
      const successRate = capability.stats.successCount / capability.stats.callCount;
      score *= (0.8 + successRate * 0.2);
    }

    return {
      capability,
      score: Math.min(1, score),
      matchReason,
    };
  }

  /**
   * 统计关键词匹配数
   */
  private countKeywordMatches(capability: Capability, keywords: string[]): number {
    const searchableText = `${capability.name} ${capability.displayName} ${capability.description}`.toLowerCase();
    
    return keywords.filter(kw => searchableText.includes(kw.toLowerCase())).length;
  }

  /**
   * 生成选择理由
   */
  private generateReasoning(
    intent: RecognizedIntent,
    primary: Capability[],
    secondary: Capability[]
  ): string {
    const reasons: string[] = [];
    
    reasons.push(`Intent: ${intent.primary} (confidence: ${intent.confidence.toFixed(2)})`);
    
    if (primary.length > 0) {
      reasons.push(`Primary capabilities: ${primary.map(c => c.name).join(', ')}`);
    }
    
    if (secondary.length > 0) {
      reasons.push(`Secondary capabilities: ${secondary.map(c => c.name).join(', ')}`);
    }

    if (intent.requiredCapabilities.length > 0) {
      reasons.push(`Required capabilities: ${intent.requiredCapabilities.join(', ')}`);
    }

    return reasons.join('; ');
  }

  /**
   * 选择单个最佳能力
   */
  selectBest(intent: RecognizedIntent, type?: string): Capability | undefined {
    const selected = this.selectForIntent(intent);
    
    const allSelected = [...selected.primary, ...selected.secondary, ...selected.fallback];
    
    if (type) {
      return allSelected.find(c => c.type === type);
    }
    
    return allSelected[0];
  }

  /**
   * 根据能力名称选择
   */
  selectByNames(names: string[]): Capability[] {
    return names
      .map(name => this.registry.getByName(name))
      .filter((c): c is Capability => c !== undefined && c.available);
  }

  /**
   * 按类型选择能力
   */
  selectByType(type: string): Capability[] {
    return this.registry.getAll()
      .filter(c => c.type === type && c.available)
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 更新选项
   */
  updateOptions(options: Partial<CapabilitySelectionOptions>): void {
    this.options = { ...this.options, ...options };
  }
}
