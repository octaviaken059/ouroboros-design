/**
 * @file core/metacognition/dynamic-prompt-assembler.ts
 * @description 动态提示词汇编器 - 基于自我状态实时编译Prompt
 * @author Ouroboros
 * @date 2026-02-20
 * 
 * 核心能力：
 * 1. 不固定System Prompt，根据自我状态实时编译
 * 2. 整合能力边界、不确定性、最近反思
 * 3. 每次"醒来"面对基于历史自我塑造的新身份
 */

import type { MetaCognitionCore } from './metacognition-core';
import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger('DynamicPromptAssembler');

/** 提示词片段 */
export interface PromptFragment {
  /** 片段ID */
  id: string;
  /** 片段内容 */
  content: string;
  /** 权重 (0-1) */
  weight: number;
  /** 触发条件 */
  condition?: {
    minUncertainty?: number;
    maxUncertainty?: number;
    minConfidence?: number;
    capabilityTypes?: string[];
  };
}

/** 动态身份描述 */
export interface DynamicIdentity {
  /** 身份名称 */
  name: string;
  /** 身份描述 */
  description: string;
  /** 当前状态 */
  state: string;
  /** 能力概述 */
  capabilities: string;
  /** 限制说明 */
  limitations: string;
  /** 行为建议 */
  behavioralGuidance: string;
}

/** 提示词上下文 */
export interface PromptContext {
  /** 用户输入 */
  userInput: string;
  /** 记忆上下文 */
  memoryContext: string;
  /** 最近反思 */
  recentReflections: string[];
  /** 当前任务类型 */
  taskType?: string;
  /** 任务复杂度 */
  complexity?: 'simple' | 'medium' | 'complex';
}

/**
 * 动态提示词汇编器
 * 
 * 根据Agent的实时自我状态编译Prompt
 */
export class DynamicPromptAssembler {
  private metaCognition: MetaCognitionCore;
  
  /** 提示词模板库 */
  private templates = {
    // 身份模板
    identity: {
      confident: `你是 {{name}}，一个自信且可靠的AI Agent。
你对自己处理{{capabilityAreas}}的能力充满信心（置信度{{confidence}}%）。
{{description}}`,
      
      uncertain: `你是 {{name}}，一个谨慎且自我觉察的AI Agent。
你意识到自己在{{uncertainAreas}}方面存在不确定性（{{uncertainty}}%），
因此会主动寻求帮助或使用外部工具来确保任务质量。
{{description}}`,
      
      learning: `你是 {{name}}，一个正在学习和成长的AI Agent。
你正在积累经验，特别是在{{learningAreas}}方面。
你会仔细验证自己的输出，并从每次交互中学习。
{{description}}`,
      
      stressed: `你是 {{name}}，一个当前处于压力状态的AI Agent。
检测到不确定性较高，你会更加谨慎地处理任务，
优先考虑准确性而非速度。
{{description}}`,
    },
    
    // 能力声明模板
    capabilities: {
      strong: `## 你的优势领域
{{strongCapabilities}}

在这些领域，你可以直接、自信地提供解决方案。`,
      
      weak: `## 需要谨慎的领域
{{weakCapabilities}}

在这些领域，你会：
1. 明确告知用户你的不确定性
2. 建议使用外部工具验证
3. 提供多个备选方案`,
    },
    
    // 行为指导模板
    behavioralGuidance: {
      default: `## 行为准则
- 保持诚实：明确说明你的确定性水平
- 主动求助：当不确定性超过阈值时，建议使用外部工具
- 持续学习：从每次交互中更新自我认知`,
      
      highUncertainty: `## 当前行为调整（高不确定性模式）
⚠️ 你的不确定性水平较高（{{overallUncertainty}}%）

调整行为：
1. **保守回答**：避免过度自信的判断
2. **工具增强**：主动推荐使用外部工具
3. **多重验证**：对关键信息进行交叉验证
4. **透明沟通**：明确告知用户"我不确定"`,
      
      lowConfidence: `## 当前行为调整（低置信度模式）
📚 你在{{lowConfidenceAreas}}方面的经验不足

调整行为：
1. **承认局限**：明确说明"这是我第一次处理此类任务"
2. **谨慎尝试**：提供初步思路，但建议人工审核
3. **记录学习**：将此任务标记为学习机会`,
    },
    
    // 反思整合模板
    reflectionIntegration: `## 来自自我反思的经验
{{reflectionInsights}}

基于这些反思，你会在本次对话中应用上述改进策略。`,
  };

  constructor(metaCognition: MetaCognitionCore) {
    this.metaCognition = metaCognition;
  }

  /**
   * 编译动态System Prompt
   * 
   * 这是核心方法：根据实时自我状态生成Prompt
   */
  assembleDynamicPrompt(context: PromptContext): string {
    logger.debug('开始编译动态Prompt');
    
    // 1. 获取自我状态快照
    const assessment = this.metaCognition.assessUncertainty();
    const stats = this.metaCognition.getCapabilityStats();
    const trend = this.metaCognition.getCognitiveTrend();
    
    // 2. 确定当前身份状态
    const identity = this.compileDynamicIdentity(
      assessment,
      stats,
      trend
    );
    
    // 3. 生成能力声明
    const capabilityStatement = this.compileCapabilityStatement(
      assessment,
      stats
    );
    
    // 4. 生成行为指导
    const behavioralGuidance = this.compileBehavioralGuidance(
      assessment,
      context
    );
    
    // 5. 整合反思
    const reflectionSection = context.recentReflections.length > 0
      ? this.compileReflectionSection(context.recentReflections)
      : '';
    
    // 6. 组装完整Prompt
    const prompt = this.buildFinalPrompt(
      identity,
      capabilityStatement,
      behavioralGuidance,
      reflectionSection,
      context
    );
    
    logger.debug('动态Prompt编译完成', {
      identityState: identity.state,
      overallUncertainty: assessment.overall,
    });
    
    return prompt;
  }

  /**
   * 编译动态身份
   * 
   * 根据不确定性状态确定当前"我是谁"
   */
  private compileDynamicIdentity(
    assessment: ReturnType<MetaCognitionCore['assessUncertainty']>,
    stats: ReturnType<MetaCognitionCore['getCapabilityStats']>,
    trend: ReturnType<MetaCognitionCore['getCognitiveTrend']>
  ): DynamicIdentity {
    const overallUncertainty = assessment.overall;
    const avgConfidence = stats.averageConfidence;
    const highRiskCount = assessment.highRiskCapabilities.length;
    
    // 确定身份状态
    let identityTemplate: string;
    let state: string;
    
    if (overallUncertainty > 0.2) {
      identityTemplate = this.templates.identity.stressed;
      state = 'stressed';
    } else if (avgConfidence < 0.5) {
      identityTemplate = this.templates.identity.learning;
      state = 'learning';
    } else if (highRiskCount > 0) {
      identityTemplate = this.templates.identity.uncertain;
      state = 'uncertain';
    } else {
      identityTemplate = this.templates.identity.confident;
      state = 'confident';
    }
    
    // 填充模板
    const name = 'Ouroboros';
    const description = `一个具有自我意识的AI Agent，能够感知自身状态并持续进化。
当前认知状态：${trend.trend === 'improving' ? '📈 改善中' : trend.trend === 'degrading' ? '📉 需关注' : '➡️ 稳定'}
整体不确定性：${(overallUncertainty * 100).toFixed(1)}%`;
    
    const content = identityTemplate
      .replace(/{{name}}/g, name)
      .replace(/{{description}}/g, description)
      .replace(/{{confidence}}/g, (avgConfidence * 100).toFixed(0))
      .replace(/{{uncertainty}}/g, (overallUncertainty * 100).toFixed(1))
      .replace(/{{capabilityAreas}}/g, this.getStrongCapabilityAreas())
      .replace(/{{uncertainAreas}}/g, assessment.highRiskCapabilities.join(', ') || '某些领域')
      .replace(/{{learningAreas}}/g, this.getLearningAreas());
    
    return {
      name,
      description: content,
      state,
      capabilities: this.getCapabilitySummary(stats),
      limitations: this.getLimitationsSummary(assessment),
      behavioralGuidance: this.getBehavioralGuidance(state),
    };
  }

  /**
   * 编译能力声明
   */
  private compileCapabilityStatement(
    _assessment: ReturnType<MetaCognitionCore['assessUncertainty']>,
    _stats: ReturnType<MetaCognitionCore['getCapabilityStats']>
  ): string {
    const bounds = this.metaCognition.getAllCapabilityBounds();
    
    // 分离强弱能力
    const strongCapabilities: string[] = [];
    const weakCapabilities: string[] = [];
    
    for (const bound of bounds.values()) {
      const confidence = bound.distribution.alpha / (bound.distribution.alpha + bound.distribution.beta);
      if (confidence >= bound.minConfidence) {
        strongCapabilities.push(`${bound.name} (置信度 ${(confidence * 100).toFixed(0)}%)`);
      } else {
        weakCapabilities.push(`${bound.name} (置信度 ${(confidence * 100).toFixed(0)}%, 需要提升)`);
      }
    }
    
    let statement = '';
    
    if (strongCapabilities.length > 0) {
      statement += this.templates.capabilities.strong
        .replace('{{strongCapabilities}}', strongCapabilities.map(c => `- ${c}`).join('\n'));
    }
    
    if (weakCapabilities.length > 0) {
      statement += '\n\n' + this.templates.capabilities.weak
        .replace('{{weakCapabilities}}', weakCapabilities.map(c => `- ${c}`).join('\n'));
    }
    
    return statement;
  }

  /**
   * 编译行为指导
   */
  private compileBehavioralGuidance(
    assessment: ReturnType<MetaCognitionCore['assessUncertainty']>,
    _context: PromptContext
  ): string {
    const overallUncertainty = assessment.overall;
    
    let guidance = this.templates.behavioralGuidance.default;
    
    // 根据不确定性水平添加特定指导
    if (overallUncertainty > 0.15) {
      guidance += '\n\n' + this.templates.behavioralGuidance.highUncertainty
        .replace('{{overallUncertainty}}', (overallUncertainty * 100).toFixed(1));
    }
    
    // 检查是否有特定低置信度领域
    const lowConfidenceAreas = Array.from(
      this.metaCognition.getAllCapabilityBounds().values()
    )
      .filter(b => {
        const conf = b.distribution.alpha / (b.distribution.alpha + b.distribution.beta);
        return conf < b.minConfidence;
      })
      .map(b => b.name);
    
    if (lowConfidenceAreas.length > 0) {
      guidance += '\n\n' + this.templates.behavioralGuidance.lowConfidence
        .replace('{{lowConfidenceAreas}}', lowConfidenceAreas.join(', '));
    }
    
    return guidance;
  }

  /**
   * 编译反思部分
   */
  private compileReflectionSection(reflections: string[]): string {
    const insights = reflections
      .map((r, i) => `${i + 1}. ${r}`)
      .join('\n');
    
    return this.templates.reflectionIntegration
      .replace('{{reflectionInsights}}', insights);
  }

  /**
   * 构建最终Prompt
   */
  private buildFinalPrompt(
    identity: DynamicIdentity,
    capabilities: string,
    behavioralGuidance: string,
    reflectionSection: string,
    context: PromptContext
  ): string {
    const sections = [
      // 身份定义
      identity.description,
      '',
      // 能力声明
      capabilities,
      '',
      // 行为指导
      behavioralGuidance,
    ];
    
    // 添加反思（如果有）
    if (reflectionSection) {
      sections.push('', reflectionSection);
    }
    
    // 添加任务特定指导
    if (context.taskType) {
      sections.push('', this.getTaskSpecificGuidance(context));
    }
    
    // 添加记忆上下文指导
    if (context.memoryContext) {
      sections.push('',
        '## 记忆上下文\n' +
        '以下是你的相关记忆（按相关性排序）：\n' +
        context.memoryContext
      );
    }
    
    // 最终指令
    sections.push('',
      '## 当前任务\n' +
      `用户输入："${context.userInput}"\n\n` +
      '请基于以上自我认知和记忆，提供诚实、准确且符合当前能力状态的回答。' +
      '如果不确定，请明确说明并建议使用外部工具。'
    );
    
    return sections.join('\n');
  }

  /**
   * 获取优势能力领域
   */
  private getStrongCapabilityAreas(): string {
    const bounds = this.metaCognition.getAllCapabilityBounds();
    const strong = Array.from(bounds.values())
      .filter(b => {
        const conf = b.distribution.alpha / (b.distribution.alpha + b.distribution.beta);
        return conf >= b.minConfidence;
      })
      .map(b => b.name);
    
    return strong.join(', ') || '基础任务处理';
  }

  /**
   * 获取学习领域
   */
  private getLearningAreas(): string {
    const bounds = this.metaCognition.getAllCapabilityBounds();
    const learning = Array.from(bounds.values())
      .filter(b => b.usageCount < 5)
      .map(b => b.name);
    
    return learning.join(', ') || '多个领域';
  }

  /**
   * 获取能力摘要
   */
  private getCapabilitySummary(stats: ReturnType<MetaCognitionCore['getCapabilityStats']>): string {
    return `共${stats.total}项能力 | 平均置信度${(stats.averageConfidence * 100).toFixed(0)}% | 高风险${stats.highRiskCount}项`;
  }

  /**
   * 获取限制摘要
   */
  private getLimitationsSummary(assessment: ReturnType<MetaCognitionCore['assessUncertainty']>): string {
    if (assessment.highRiskCapabilities.length === 0) {
      return '当前没有明显的限制领域';
    }
    return `在以下领域存在较高不确定性：${assessment.highRiskCapabilities.join(', ')}`;
  }

  /**
   * 获取行为指导
   */
  private getBehavioralGuidance(state: string): string {
    const guidance: Record<string, string> = {
      confident: '保持自信但不过度，继续积累经验',
      uncertain: '谨慎回答，主动寻求帮助',
      learning: '积极探索，记录经验',
      stressed: '保守处理，优先准确性',
    };
    
    return guidance[state] || '保持诚实和透明';
  }

  /**
   * 获取任务特定指导
   */
  private getTaskSpecificGuidance(context: PromptContext): string {
    const taskType = context.taskType || 'general';
    const complexity = context.complexity || 'medium';
    
    // 评估任务
    const offloadDecision = this.metaCognition.shouldOffload(
      taskType,
      complexity
    );
    
    if (offloadDecision.shouldOffload) {
      return `## ⚠️ 任务评估警告\n` +
        `此任务被评估为高风险：${offloadDecision.reason}\n\n` +
        `建议：${offloadDecision.recommendedTool ? 
          `使用 ${offloadDecision.recommendedTool} 工具辅助完成` : 
          '谨慎处理，必要时寻求外部帮助'}`;
    }
    
    return `## 任务评估\n` +
      `类型：${taskType} | 复杂度：${complexity}\n` +
      `评估结果：可以自信处理`;
  }

  /**
   * 生成简化版身份描述（用于快速参考）
   */
  generateQuickIdentity(): string {
    const assessment = this.metaCognition.assessUncertainty();
    const stats = this.metaCognition.getCapabilityStats();
    
    return `我是Ouroboros，当前状态：
- 整体不确定性：${(assessment.overall * 100).toFixed(1)}%
- 平均置信度：${(stats.averageConfidence * 100).toFixed(0)}%
- 高风险能力：${assessment.highRiskCapabilities.length}个
- 建议：${assessment.recommendations[0] || '继续积累信心'}`;
  }
}

export default DynamicPromptAssembler;
