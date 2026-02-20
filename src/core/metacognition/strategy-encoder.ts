/**
 * @file core/metacognition/strategy-encoder.ts
 * @description 策略编码器 - 将改进策略编码为程序记忆
 * @author Ouroboros
 * @date 2026-02-20
 * 
 * 核心能力：
 * 1. 将自然语言策略转换为可执行代码/Prompt片段
 * 2. 版本管理策略
 * 3. 策略有效性评估
 * 4. 程序记忆存储
 */

import { createContextLogger } from '@/utils/logger';
import { randomUUID } from 'crypto';

const logger = createContextLogger('StrategyEncoder');

/** 策略类型 */
export type StrategyType = 
  | 'prompt_template'    // Prompt模板
  | 'reasoning_pattern'  // 推理模式
  | 'tool_selection'     // 工具选择规则
  | 'uncertainty_handling' // 不确定性处理
  | 'self_correction';   // 自我修正

/** 策略定义 */
export interface Strategy {
  /** 策略ID */
  id: string;
  /** 策略名称 */
  name: string;
  /** 策略类型 */
  type: StrategyType;
  /** 策略描述 */
  description: string;
  /** 触发条件 */
  triggerCondition: {
    /** 场景描述 */
    scenario: string;
    /** 不确定性阈值 */
    uncertaintyThreshold?: number;
    /** 最小置信度 */
    minConfidence?: number;
    /** 能力类型 */
    capabilityType?: string;
    /** 任务类型 */
    taskType?: string;
  };
  /** 策略内容 */
  content: {
    /** 自然语言描述 */
    naturalLanguage: string;
    /** Prompt片段（如果有） */
    promptSnippet?: string;
    /** 代码逻辑（如果有） */
    codeLogic?: string;
    /** 示例 */
    examples?: string[];
  };
  /** 版本 */
  version: number;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 来源（哪个反思产生的） */
  source?: {
    reflectionId: string;
    lesson: string;
  };
  /** 使用统计 */
  stats: {
    appliedCount: number;
    successCount: number;
    failureCount: number;
    lastApplied?: string;
  };
  /** 有效性评估 */
  effectiveness: {
    score: number; // 0-1
    confidence: number;
    lastEvaluated?: string;
  };
  /** 是否激活 */
  isActive: boolean;
}

/** 策略模板库 */
const STRATEGY_TEMPLATES: Record<StrategyType, Array<{
  name: string;
  description: string;
  promptTemplate: string;
}>> = {
  prompt_template: [
    {
      name: 'uncertainty_disclaimer',
      description: '在不确定时添加免责声明',
      promptTemplate: `当我的不确定性超过 {{threshold}}% 时，我必须在回答前添加以下声明：
"⚠️ 注意：我在这个领域存在较高不确定性（{{uncertainty}}%），以下回答仅供参考，建议进一步验证。"`,
    },
    {
      name: 'confidence_calibration',
      description: '校准置信度表述',
      promptTemplate: `我需要使用概率性语言：
- 高置信度 (>80%)："很可能"、"有充分证据表明"
- 中等置信度 (50-80%)："可能"、"有迹象表明"
- 低置信度 (<50%)："不确定"、"可能但存疑"`,
    },
  ],
  reasoning_pattern: [
    {
      name: 'step_by_step_verification',
      description: '逐步验证推理',
      promptTemplate: `对于复杂推理，我必须：
1. 明确每一步的推理类型（演绎/归纳/类比）
2. 为每一步标注置信度
3. 识别潜在的逻辑漏洞
4. 在最终结论前进行自我验证`,
    },
    {
      name: 'alternative_exploration',
      description: '探索替代方案',
      promptTemplate: `在得出结论前，我必须：
1. 列出至少2个替代解释或方案
2. 比较各方案的优缺点
3. 解释为什么选择当前方案`,
    },
  ],
  tool_selection: [
    {
      name: 'high_uncertainty_offload',
      description: '高不确定性时寻求工具增强',
      promptTemplate: `当检测到以下情况时，主动建议使用外部工具：
- 任务类型不确定性 > {{uncertaintyThreshold}}%
- 我的置信度 < {{confidenceThreshold}}%
- 任务重要性为 "high"

推荐工具：{{recommendedTool}}`,
    },
  ],
  uncertainty_handling: [
    {
      name: 'explicit_uncertainty_communication',
      description: '明确沟通不确定性',
      promptTemplate: `我必须明确说明：
1. 我对这个问题的整体确定性水平
2. 哪些部分我比较确定，哪些部分不确定
3. 不确定的原因（知识缺口/信息不足/复杂性）
4. 建议用户如何验证我的回答`,
    },
  ],
  self_correction: [
    {
      name: 'contradiction_detection',
      description: '检测自我矛盾',
      promptTemplate: `在每次回答后，我必须快速检查：
1. 这次回答是否与之前的观点矛盾？
2. 是否存在逻辑不一致？
3. 如果有矛盾，主动承认并解释`,
    },
  ],
};

/**
 * 策略编码器
 * 
 * 将反思产生的策略编码为可执行形式
 */
export class StrategyEncoder {
  /** 策略库 */
  private strategies = new Map<string, Strategy>();
  
  /** 按类型索引 */
  private strategiesByType = new Map<StrategyType, Set<string>>();

  constructor() {
    logger.info('策略编码器初始化完成');
    this.initializeDefaultStrategies();
  }

  /**
   * 初始化默认策略
   */
  private initializeDefaultStrategies(): void {
    for (const [type, templates] of Object.entries(STRATEGY_TEMPLATES)) {
      for (const template of templates) {
        this.createStrategy({
          name: template.name,
          type: type as StrategyType,
          description: template.description,
          triggerCondition: { scenario: 'default' },
          content: {
            naturalLanguage: template.description,
            promptSnippet: template.promptTemplate,
          },
        });
      }
    }
    
    logger.info('默认策略已初始化', { count: this.strategies.size });
  }

  /**
   * 创建新策略
   */
  createStrategy(params: Omit<Strategy, 'id' | 'version' | 'createdAt' | 'updatedAt' | 'stats' | 'effectiveness' | 'isActive'>): Strategy {
    const id = randomUUID();
    const now = new Date().toISOString();
    
    const strategy: Strategy = {
      id,
      ...params,
      version: 1,
      createdAt: now,
      updatedAt: now,
      stats: {
        appliedCount: 0,
        successCount: 0,
        failureCount: 0,
      },
      effectiveness: {
        score: 0.5, // 初始中性评估
        confidence: 0.3,
      },
      isActive: true,
    };

    this.strategies.set(id, strategy);
    
    // 更新类型索引
    if (!this.strategiesByType.has(strategy.type)) {
      this.strategiesByType.set(strategy.type, new Set());
    }
    this.strategiesByType.get(strategy.type)!.add(id);

    logger.info('新策略已创建', { 
      id, 
      name: strategy.name, 
      type: strategy.type 
    });

    return strategy;
  }

  /**
   * 从反思教训编码策略
   * 
   * 核心方法：将"我哪里错了"转换为"下次该怎么做"
   */
  encodeFromLesson(
    lesson: string,
    context: {
      reflectionId: string;
      taskType?: string;
      capabilityType?: string;
      uncertaintyLevel?: number;
    }
  ): Strategy {
    logger.info('从教训编码策略', { lesson: lesson.substring(0, 100) });

    // 分析教训内容，确定策略类型
    const type = this.classifyLessonType(lesson);
    
    // 提取触发条件
    const triggerCondition = this.extractTriggerCondition(lesson, context);
    
    // 生成策略内容
    const content = this.generateStrategyContent(lesson, type);

    // 创建策略
    const strategy = this.createStrategy({
      name: `strategy_${Date.now()}`,
      type,
      description: `从反思产生的策略: ${lesson.substring(0, 50)}...`,
      triggerCondition,
      content,
      source: {
        reflectionId: context.reflectionId,
        lesson,
      },
    });

    return strategy;
  }

  /**
   * 分类教训类型
   */
  private classifyLessonType(lesson: string): StrategyType {
    const patterns: Array<{ type: StrategyType; keywords: string[] }> = [
      {
        type: 'uncertainty_handling',
        keywords: ['不确定', '置信度', '可能', '也许', ' unsure', 'uncertain', 'confidence'],
      },
      {
        type: 'reasoning_pattern',
        keywords: ['推理', '逻辑', '步骤', '验证', 'reasoning', 'logic', 'step', 'verify'],
      },
      {
        type: 'tool_selection',
        keywords: ['工具', '外部', '增强', '寻求帮助', 'tool', 'external', 'assist'],
      },
      {
        type: 'prompt_template',
        keywords: ['提示', '表述', '措辞', '语言', 'prompt', 'phrase', 'wording'],
      },
      {
        type: 'self_correction',
        keywords: ['错误', '纠正', '修正', '检查', 'error', 'correct', 'fix', 'check'],
      },
    ];

    for (const pattern of patterns) {
      if (pattern.keywords.some(kw => lesson.toLowerCase().includes(kw.toLowerCase()))) {
        return pattern.type;
      }
    }

    return 'self_correction'; // 默认类型
  }

  /**
   * 提取触发条件
   */
  private extractTriggerCondition(
    lesson: string,
    context: { taskType?: string; capabilityType?: string; uncertaintyLevel?: number }
  ): Strategy['triggerCondition'] {
    const condition: Strategy['triggerCondition'] = {
      scenario: lesson,
    };

    if (context.uncertaintyLevel !== undefined) {
      condition.uncertaintyThreshold = context.uncertaintyLevel;
    }

    if (context.capabilityType) {
      condition.capabilityType = context.capabilityType;
    }

    if (context.taskType) {
      condition.taskType = context.taskType;
    }

    return condition;
  }

  /**
   * 生成策略内容
   */
  private generateStrategyContent(
    lesson: string,
    type: StrategyType
  ): Strategy['content'] {
    const content: Strategy['content'] = {
      naturalLanguage: lesson,
    };

    // 根据类型生成Prompt片段
    switch (type) {
      case 'uncertainty_handling':
        content.promptSnippet = `## 不确定性处理策略
基于历史反思，当我遇到类似情况时：
${lesson}

具体操作：
1. 首先评估不确定性水平
2. 明确告知用户我的确定性程度
3. 提供验证建议`;
        break;

      case 'reasoning_pattern':
        content.promptSnippet = `## 推理模式改进
从过去的学习中，我认识到：
${lesson}

应用此策略时：
1. 分解推理步骤
2. 每一步进行自我验证
3. 记录置信度变化`;
        break;

      case 'tool_selection':
        content.codeLogic = `// 工具选择增强逻辑
if (uncertainty > threshold || confidence < minConfidence) {
  suggestExternalTool();
  communicateLimitation();
}`;
        content.promptSnippet = lesson;
        break;

      default:
        content.promptSnippet = lesson;
    }

    // 添加示例
    content.examples = [
      `示例应用场景：${lesson.substring(0, 100)}...`,
    ];

    return content;
  }

  /**
   * 获取适用策略
   */
  getApplicableStrategies(context: {
    taskType?: string;
    capabilityType?: string;
    uncertaintyLevel?: number;
  }): Strategy[] {
    const applicable: Strategy[] = [];

    for (const strategy of this.strategies.values()) {
      if (!strategy.isActive) continue;

      const condition = strategy.triggerCondition;
      let matches = true;

      // 检查不确定性条件
      if (condition.uncertaintyThreshold !== undefined && 
          context.uncertaintyLevel !== undefined) {
        if (context.uncertaintyLevel < condition.uncertaintyThreshold) {
          matches = false;
        }
      }

      // 检查能力类型
      if (condition.capabilityType && 
          condition.capabilityType !== context.capabilityType) {
        matches = false;
      }

      // 检查任务类型
      if (condition.taskType && 
          condition.taskType !== context.taskType) {
        matches = false;
      }

      if (matches) {
        applicable.push(strategy);
      }
    }

    // 按有效性排序
    return applicable.sort((a, b) => 
      b.effectiveness.score - a.effectiveness.score
    );
  }

  /**
   * 应用策略
   */
  applyStrategy(strategyId: string, success: boolean): void {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return;

    strategy.stats.appliedCount++;
    strategy.stats.lastApplied = new Date().toISOString();

    if (success) {
      strategy.stats.successCount++;
    } else {
      strategy.stats.failureCount++;
    }

    // 更新有效性评估
    this.updateEffectiveness(strategy);

    logger.debug('策略已应用', {
      strategyId,
      success,
      totalApplied: strategy.stats.appliedCount,
    });
  }

  /**
   * 更新策略有效性
   */
  private updateEffectiveness(strategy: Strategy): void {
    const total = strategy.stats.appliedCount;
    if (total === 0) return;

    const successRate = strategy.stats.successCount / total;
    
    // 贝叶斯更新有效性评分
    const priorScore = strategy.effectiveness.score;
    const newScore = (priorScore * 3 + successRate * total) / (3 + total);
    
    strategy.effectiveness.score = Math.round(newScore * 100) / 100;
    strategy.effectiveness.confidence = Math.min(0.95, total / 20); // 最多0.95置信度
    strategy.effectiveness.lastEvaluated = new Date().toISOString();
  }

  /**
   * 编译策略为Prompt片段
   */
  compileStrategiesToPrompt(context: {
    taskType?: string;
    capabilityType?: string;
    uncertaintyLevel?: number;
  }): string {
    const strategies = this.getApplicableStrategies(context);
    
    if (strategies.length === 0) {
      return '';
    }

    const sections = strategies
      .filter(s => s.content.promptSnippet)
      .map((s, i) => `### 策略 ${i + 1}: ${s.name}
${s.content.promptSnippet}
[有效性: ${(s.effectiveness.score * 100).toFixed(0)}%, 应用${s.stats.appliedCount}次]`);

    return `## 来自自我反思的策略指导

基于我过去的经验和学习，以下策略适用于当前情况：

${sections.join('\n\n')}

---
`;
  }

  /**
   * 获取策略报告
   */
  generateReport(): string {
    const allStrategies = Array.from(this.strategies.values());
    const activeStrategies = allStrategies.filter(s => s.isActive);
    const byType = new Map<StrategyType, number>();
    
    for (const s of allStrategies) {
      byType.set(s.type, (byType.get(s.type) || 0) + 1);
    }

    const topStrategies = allStrategies
      .sort((a, b) => b.effectiveness.score - a.effectiveness.score)
      .slice(0, 5);

    return `
## 策略编码器报告

### 总体统计
- **总策略数**: ${allStrategies.length}
- **激活策略**: ${activeStrategies.length}
- **平均有效性**: ${(allStrategies.reduce((sum, s) => sum + s.effectiveness.score, 0) / allStrategies.length * 100).toFixed(1)}%

### 按类型分布
${Array.from(byType.entries()).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

### 最有效策略 (Top 5)
${topStrategies.map((s, i) => `${i + 1}. ${s.name} (${s.type}) - 有效性: ${(s.effectiveness.score * 100).toFixed(0)}%`).join('\n')}

### 最近创建
${allStrategies
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  .slice(0, 3)
  .map(s => `- ${s.name}: ${s.description.substring(0, 50)}...`)
  .join('\n')}
`;
  }

  /**
   * 获取所有策略
   */
  getAllStrategies(): Strategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * 激活/停用策略
   */
  setStrategyActive(strategyId: string, active: boolean): void {
    const strategy = this.strategies.get(strategyId);
    if (strategy) {
      strategy.isActive = active;
      logger.info(`策略已${active ? '激活' : '停用'}`, { strategyId });
    }
  }
}

export default StrategyEncoder;
