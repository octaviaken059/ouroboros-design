/**
 * @file core/cognition/thinking/classifier.ts
 * @description 问题分类器 - 自动识别问题类型
 */

import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger('ProblemClassifier');

/**
 * 问题类型定义
 */
export type ProblemType =
  | 'analytical'      // 分析类：拆解、对比、归纳
  | 'creative'        // 创造类：头脑风暴、联想、组合
  | 'decision'        // 决策类：评估选项、权衡、选择
  | 'debugging'       // 调试类：定位、假设、验证
  | 'planning'        // 规划类：目标分解、路径、资源
  | 'explanation'     // 解释类：概念澄清、举例、连接
  | 'prediction'      // 预测类：趋势分析、模式识别、推断
  | 'verification'    // 验证类：证据检查、逻辑检验、证伪
  | 'comparison'      // 比较类：对比异同、优劣分析
  | 'optimization';   // 优化类：寻找最优解、效率提升

/**
 * 分类特征规则
 */
interface ClassificationRule {
  type: ProblemType;
  keywords: string[];
  patterns: RegExp[];
  weight: number;
}

/**
 * 问题分类结果
 */
export interface ClassificationResult {
  primary: ProblemType;
  secondary?: ProblemType;
  confidence: number;
  reason: string;
}

/**
 * 问题分类器
 */
export class ProblemClassifier {
  private rules: ClassificationRule[] = [
    {
      type: 'analytical',
      keywords: ['分析', '为什么', '原因', '因素', '拆解', '剖析', '解读', '研究', '探索'],
      patterns: [
        /^(分析|剖析|解读|研究|探索)/,
        /(原因|因素|原理|机制|逻辑|结构|组成)/,
        /(如何理解|怎么解释|什么导致)/,
      ],
      weight: 1.0,
    },
    {
      type: 'creative',
      keywords: ['创意', '想法', '方案', '设计', '创新', '头脑风暴', '构思', '设想'],
      patterns: [
        /^(创意|想法|方案|设计|构思)/,
        /(如何创新|怎么改进|有没有更好的)/,
        /(头脑风暴|发散思维|联想)/,
      ],
      weight: 1.0,
    },
    {
      type: 'decision',
      keywords: ['选择', '决定', '应该', '建议', '推荐', '权衡', '取舍', '决策'],
      patterns: [
        /^(选择|决定|建议|推荐)/,
        /(应该|不应该|要不要|选哪个)/,
        /(A还是B|哪个更好|优缺点)/,
        /(权衡|取舍|取舍)/,
      ],
      weight: 1.0,
    },
    {
      type: 'debugging',
      keywords: ['错误', 'bug', '问题', '修复', '调试', '报错', '异常', '失败', '不工作'],
      patterns: [
        /^(错误|bug|问题|异常|失败)/i,
        /(报错|出错|崩溃|挂掉|不工作)/,
        /(怎么修复|如何解决|排查|调试)/,
        /(为什么.*失败|为什么.*报错)/,
      ],
      weight: 1.0,
    },
    {
      type: 'planning',
      keywords: ['计划', '步骤', '流程', '怎么做', '实现', '完成', '达成', '路径'],
      patterns: [
        /^(计划|方案|步骤|流程|路径)/,
        /(怎么做|如何实现|怎样完成)/,
        /( roadmap| roadmap|roadmap)/,
        /(分几步|分阶段|时间安排)/,
      ],
      weight: 1.0,
    },
    {
      type: 'explanation',
      keywords: ['解释', '说明', '介绍', '什么是', '概念', '定义', '原理', '举例'],
      patterns: [
        /^(解释|说明|介绍|什么是)/,
        /(概念|定义|原理|机制|本质)/,
        /(举例说明|举个例子|比如)/,
        /(通俗易懂|大白话|简单解释)/,
      ],
      weight: 1.0,
    },
    {
      type: 'prediction',
      keywords: ['预测', '未来', '趋势', '会怎样', '可能', '估计', '判断', '展望'],
      patterns: [
        /^(预测|判断|估计|展望)/,
        /(未来|趋势|走向|发展)/,
        /(会怎样|会发生什么|可能.*吗)/,
        /(如果.*会|假设.*那么)/,
      ],
      weight: 1.0,
    },
    {
      type: 'verification',
      keywords: ['验证', '确认', '检查', '测试', '证明', '证伪', '正确性', '可靠性'],
      patterns: [
        /^(验证|确认|检查|测试)/,
        /(是否正确|是否可行|靠不靠谱)/,
        /(证明|证伪|反驳|质疑)/,
        /(怎么验证|如何确认|检验)/,
      ],
      weight: 1.0,
    },
    {
      type: 'comparison',
      keywords: ['比较', '对比', '区别', '差异', '优劣', '异同', 'vs', 'versus'],
      patterns: [
        /^(比较|对比|vs|versus)/i,
        /(和.*相比|与.*对比|区别)/,
        /(哪个更好|优劣|优缺点)/,
        /(有什么不同|差异|异同)/,
      ],
      weight: 1.0,
    },
    {
      type: 'optimization',
      keywords: ['优化', '提升', '改进', '效率', '性能', '加速', '降低', '最佳'],
      patterns: [
        /^(优化|改进|提升|加速)/,
        /(效率|性能|速度|资源)/,
        /(如何更快|怎样更好|最小化|最大化)/,
        /(最佳|最优|最理想)/,
      ],
      weight: 1.0,
    },
  ];

  /**
   * 分类问题
   */
  classify(question: string): ClassificationResult {
    const scores: Map<ProblemType, number> = new Map();

    for (const rule of this.rules) {
      let score = 0;

      // 关键词匹配
      for (const keyword of rule.keywords) {
        if (question.includes(keyword)) {
          score += rule.weight;
        }
      }

      // 正则模式匹配
      for (const pattern of rule.patterns) {
        if (pattern.test(question)) {
          score += rule.weight * 1.5; // 模式匹配权重更高
        }
      }

      if (score > 0) {
        scores.set(rule.type, (scores.get(rule.type) || 0) + score);
      }
    }

    // 如果没有匹配到，默认是分析类
    if (scores.size === 0) {
      return {
        primary: 'analytical',
        confidence: 0.5,
        reason: '未识别到明确类型，默认使用分析模式',
      };
    }

    // 排序获取主要和次要类型
    const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
    const [primary, primaryScore] = sorted[0];
    const secondary = sorted[1]?.[0];

    // 计算置信度
    const totalScore = Array.from(scores.values()).reduce((a, b) => a + b, 0);
    const confidence = primaryScore / totalScore;

    const result: ClassificationResult = {
      primary,
      confidence,
      reason: this.generateReason(primary, scores),
    };

    if (secondary && sorted[1][1] / totalScore > 0.3) {
      result.secondary = secondary;
    }

    logger.debug('问题分类结果', { question: question.slice(0, 50), result });

    return result;
  }

  /**
   * 批量分类
   */
  classifyBatch(questions: string[]): ClassificationResult[] {
    return questions.map(q => this.classify(q));
  }

  /**
   * 生成分类原因
   */
  private generateReason(
    type: ProblemType,
    _scores: Map<ProblemType, number>
  ): string {
    const reasons: Record<ProblemType, string> = {
      analytical: '问题需要深入分析和拆解',
      creative: '问题需要创造性思维和方案',
      decision: '问题需要做出选择或决策',
      debugging: '问题涉及错误排查和修复',
      planning: '问题需要制定计划或路径',
      explanation: '问题需要解释概念或原理',
      prediction: '问题需要预测未来或趋势',
      verification: '问题需要验证或检验',
      comparison: '问题需要比较不同选项',
      optimization: '问题需要寻找最优解',
    };

    return reasons[type] || '基于关键词和模式匹配';
  }

  /**
   * 获取所有支持的问题类型
   */
  getSupportedTypes(): ProblemType[] {
    return this.rules.map(r => r.type);
  }

  /**
   * 添加自定义规则
   */
  addRule(rule: ClassificationRule): void {
    this.rules.push(rule);
    logger.info('添加分类规则', { type: rule.type });
  }
}

// 导出单例
export const problemClassifier = new ProblemClassifier();
