/**
 * @file capabilities/intent/index.ts
 * @description 意图识别模块 - 分析用户输入并识别意图
 * @author Ouroboros
 * @date 2026-02-19
 */

import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger('IntentRecognition');

/** 意图类型 */
export type IntentType =
  | 'chat'           // 普通对话
  | 'code'           // 编程任务
  | 'analysis'       // 分析任务
  | 'search'         // 搜索查询
  | 'creation'       // 创建内容
  | 'modification'   // 修改内容
  | 'execution'      // 执行命令
  | 'learning'       // 学习/研究
  | 'planning'       // 计划/规划
  | 'debugging'      // 调试
  | 'review'         // 审查/检查
  | 'query'          // 信息查询
  | 'automation'     // 自动化任务
  | 'integration'    // 集成任务
  | 'unknown';       // 未知意图

/** 意图实体 */
export interface IntentEntity {
  /** 实体类型 */
  type: string;
  /** 实体值 */
  value: string;
  /** 在文本中的位置 */
  position?: { start: number; end: number };
  /** 置信度 */
  confidence: number;
}

/** 识别的意图 */
export interface RecognizedIntent {
  /** 主要意图 */
  primary: IntentType;
  /** 次要意图 */
  secondary?: IntentType | undefined;
  /** 置信度 */
  confidence: number;
  /** 相关实体 */
  entities: IntentEntity[];
  /** 关键词 */
  keywords: string[];
  /** 所需能力类别 */
  requiredCapabilities: string[];
  /** 原始输入 */
  rawInput: string;
}

/** 意图识别选项 */
export interface IntentRecognitionOptions {
  /** 最小置信度阈值 */
  minConfidence?: number;
  /** 启用实体提取 */
  extractEntities?: boolean;
  /** 提取关键词 */
  extractKeywords?: boolean;
}

/**
 * 意图识别器
 * 
 * 分析用户输入，识别意图和提取相关信息
 */
export class IntentRecognizer {
  private options: IntentRecognitionOptions;

  // 意图关键词映射
  private static readonly INTENT_KEYWORDS: Record<IntentType, string[]> = {
    chat: ['聊聊', '谈谈', '说说', '聊', '对话', 'hi', 'hello', '你好'],
    code: ['写代码', '编程', '实现', '函数', '类', '代码', 'program', 'code', 'implement', 'function'],
    analysis: ['分析', '评估', '检查', 'analyze', 'evaluate', 'assess', 'check'],
    search: ['搜索', '查找', '查询', 'search', 'find', 'lookup', 'query'],
    creation: ['创建', '新建', '生成', '制作', 'create', 'generate', 'make', 'build'],
    modification: ['修改', '更新', '编辑', '改变', 'modify', 'update', 'edit', 'change'],
    execution: ['运行', '执行', '启动', 'run', 'execute', 'start'],
    learning: ['学习', '研究', '了解', 'learn', 'research', 'study', 'explore'],
    planning: ['计划', '规划', '设计', 'plan', 'design', 'schedule'],
    debugging: ['调试', '修复', '排查', 'debug', 'fix', 'troubleshoot'],
    review: ['审查', '检查', 'review', 'audit', 'inspect'],
    query: ['查询', '询问', 'question', 'ask', 'inquire'],
    automation: ['自动化', '自动', 'automate', 'auto', 'script'],
    integration: ['集成', '连接', '整合', 'integrate', 'connect'],
    unknown: [],
  };

  // 实体类型正则表达式
  private static readonly ENTITY_PATTERNS: Array<{
    type: string;
    pattern: RegExp;
  }> = [
    { type: 'file_path', pattern: /[\w\/\\.-]+\.(js|ts|py|json|md|txt|html|css|yml|yaml|sql)/gi },
    { type: 'url', pattern: /https?:\/\/[^\s]+/gi },
    { type: 'email', pattern: /[\w.-]+@[\w.-]+\.\w+/gi },
    { type: 'command', pattern: /`(.*?)`/g },
    { type: 'code_block', pattern: /```[\s\S]*?```/g },
  ];

  constructor(options: IntentRecognitionOptions = {}) {
    this.options = {
      minConfidence: 0.5,
      extractEntities: true,
      extractKeywords: true,
      ...options,
    };
  }

  /**
   * 识别意图
   */
  recognize(input: string): RecognizedIntent {
    const normalizedInput = input.toLowerCase().trim();
    
    // 计算各意图类型的匹配分数
    const scores = this.calculateIntentScores(normalizedInput);
    
    // 排序获取主要和次要意图
    const sortedIntents = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .filter(([, score]) => score >= this.options.minConfidence!);

    const primary = (sortedIntents[0]?.[0] as IntentType) || 'unknown';
    const secondary = sortedIntents[1]?.[1] > 0.3 
      ? (sortedIntents[1][0] as IntentType) 
      : undefined;
    const confidence = sortedIntents[0]?.[1] || 0;

    // 提取实体
    const entities = this.options.extractEntities 
      ? this.extractEntities(input) 
      : [];

    // 提取关键词
    const keywords = this.options.extractKeywords 
      ? this.extractKeywords(normalizedInput) 
      : [];

    // 推断所需能力
    const requiredCapabilities = this.inferRequiredCapabilities(primary, entities, keywords);

    const intent: RecognizedIntent = {
      primary,
      secondary: secondary || undefined,
      confidence,
      entities,
      keywords,
      requiredCapabilities,
      rawInput: input,
    };

    logger.debug(`Intent recognized: ${primary} (${confidence.toFixed(2)})`);
    return intent;
  }

  /**
   * 计算意图分数
   */
  private calculateIntentScores(input: string): Record<IntentType, number> {
    const scores: Record<IntentType, number> = {
      chat: 0, code: 0, analysis: 0, search: 0, creation: 0,
      modification: 0, execution: 0, learning: 0, planning: 0,
      debugging: 0, review: 0, query: 0, automation: 0, integration: 0,
      unknown: 0.1, // 基础分数
    };

    for (const [intent, keywords] of Object.entries(IntentRecognizer.INTENT_KEYWORDS)) {
      if (intent === 'unknown') continue;

      let score = 0;
      for (const keyword of keywords) {
        if (input.includes(keyword.toLowerCase())) {
          // 根据关键词位置和匹配长度调整分数
          const count = (input.match(new RegExp(keyword, 'gi')) || []).length;
          score += 0.2 * count;
          
          // 如果关键词在开头，增加权重
          if (input.startsWith(keyword.toLowerCase())) {
            score += 0.3;
          }
        }
      }
      scores[intent as IntentType] = Math.min(1, score);
    }

    return scores;
  }

  /**
   * 提取实体
   */
  private extractEntities(input: string): IntentEntity[] {
    const entities: IntentEntity[] = [];

    for (const { type, pattern } of IntentRecognizer.ENTITY_PATTERNS) {
      const matches = input.matchAll(pattern);
      
      for (const match of matches) {
        if (match.index !== undefined) {
          entities.push({
            type,
            value: match[1] || match[0],
            position: {
              start: match.index,
              end: match.index + match[0].length,
            },
            confidence: 0.9,
          });
        }
      }
    }

    return entities;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(input: string): string[] {
    // 简单的关键词提取：去除停用词后的重要词汇
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'i', 'you', 'he', 'she', 'it', 'we', 'they',
      '的', '了', '在', '是', '我', '你', '他', '她', '它', '们',
      '请', '帮我', '给我', '需要', '想要',
    ]);

    const words = input
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !stopWords.has(w));

    // 去重并返回
    return [...new Set(words)].slice(0, 10);
  }

  /**
   * 推断所需能力
   */
  private inferRequiredCapabilities(
    intent: IntentType,
    entities: IntentEntity[],
    keywords: string[]
  ): string[] {
    const capabilities: string[] = [];

    // 基于意图类型推断
    const intentCapabilityMap: Record<IntentType, string[]> = {
      chat: [],
      code: ['code-generation', 'syntax-analysis'],
      analysis: ['data-analysis', 'pattern-recognition'],
      search: ['web-search', 'knowledge-retrieval'],
      creation: ['content-generation', 'file-creation'],
      modification: ['file-modification', 'code-refactoring'],
      execution: ['command-execution', 'script-running'],
      learning: ['research', 'documentation', 'exploration'],
      planning: ['task-planning', 'scheduling'],
      debugging: ['error-analysis', 'code-debugging'],
      review: ['code-review', 'quality-check'],
      query: ['information-retrieval', 'knowledge-base'],
      automation: ['workflow-automation', 'scripting'],
      integration: ['api-integration', 'system-integration'],
      unknown: [],
    };

    capabilities.push(...(intentCapabilityMap[intent] || []));

    // 基于实体推断
    for (const entity of entities) {
      switch (entity.type) {
        case 'file_path':
          if (entity.value.endsWith('.js') || entity.value.endsWith('.ts')) {
            capabilities.push('javascript', 'typescript');
          } else if (entity.value.endsWith('.py')) {
            capabilities.push('python');
          } else if (entity.value.endsWith('.json')) {
            capabilities.push('json-processing');
          }
          break;
        case 'url':
          capabilities.push('web-fetch', 'http-client');
          break;
      }
    }

    // 基于关键词推断
    for (const keyword of keywords) {
      if (['docker', 'container'].includes(keyword)) {
        capabilities.push('docker', 'containerization');
      } else if (['git', 'commit', 'branch'].includes(keyword)) {
        capabilities.push('git', 'version-control');
      } else if (['api', 'endpoint'].includes(keyword)) {
        capabilities.push('api-client', 'http');
      } else if (['database', 'sql', 'query'].includes(keyword)) {
        capabilities.push('database', 'sql');
      } else if (['test', 'testing'].includes(keyword)) {
        capabilities.push('testing', 'test-framework');
      }
    }

    // 去重
    return [...new Set(capabilities)];
  }

  /**
   * 批量识别意图
   */
  recognizeBatch(inputs: string[]): RecognizedIntent[] {
    return inputs.map(input => this.recognize(input));
  }
}

/**
 * 便捷函数：识别意图
 */
export function recognizeIntent(input: string, options?: IntentRecognitionOptions): RecognizedIntent {
  const recognizer = new IntentRecognizer(options);
  return recognizer.recognize(input);
}

// 类型已通过 interface 导出
