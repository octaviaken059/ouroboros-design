/**
 * @file evolution/skill-learning/skill-extractor.ts
 * @description 技能提取器 - 从执行历史中识别和提取技能模式
 * @author Ouroboros
 * @date 2026-02-19
 */

import { createContextLogger } from '@/utils/logger';
import { randomUUID } from 'crypto';

const logger = createContextLogger('SkillExtractor');

/** 执行记录 */
export interface ExecutionRecord {
  /** 记录 ID */
  id: string;
  /** 任务描述 */
  task: string;
  /** 意图 */
  intent: string;
  /** 使用的工具序列 */
  toolSequence: Array<{
    tool: string;
    args: Record<string, unknown>;
    result: unknown;
    success: boolean;
    duration: number;
  }>;
  /** 最终结果 */
  finalResult: unknown;
  /** 是否成功 */
  success: boolean;
  /** 执行时间 */
  timestamp: string;
  /** 用户反馈 (可选) */
  feedback?: 'positive' | 'negative' | 'neutral';
}

/** 技能模式 */
export interface SkillPattern {
  /** 模式 ID */
  id: string;
  /** 模式名称 */
  name: string;
  /** 模式描述 */
  description: string;
  /** 适用的意图类型 */
  applicableIntents: string[];
  /** 工具序列模板 */
  toolSequence: Array<{
    tool: string;
    requiredArgs: string[];
    optionalArgs: string[];
  }>;
  /** 输入参数映射 */
  inputMapping: Record<string, string>;
  /** 成功次数 */
  successCount: number;
  /** 总执行次数 */
  totalCount: number;
  /** 置信度 */
  confidence: number;
  /** 提取时间 */
  extractedAt: string;
}

/** 提取选项 */
export interface SkillExtractionOptions {
  /** 最小成功次数 */
  minSuccessCount?: number;
  /** 最小成功率 */
  minSuccessRate?: number;
  /** 最大工具序列长度 */
  maxSequenceLength?: number;
  /** 相似度阈值 */
  similarityThreshold?: number;
}

/**
 * 技能提取器
 * 
 * 从成功的执行记录中提取可复用的技能模式
 */
export class SkillExtractor {
  private options: SkillExtractionOptions;
  private patterns = new Map<string, SkillPattern>();

  constructor(options: SkillExtractionOptions = {}) {
    this.options = {
      minSuccessCount: 3,
      minSuccessRate: 0.7,
      maxSequenceLength: 10,
      similarityThreshold: 0.8,
      ...options,
    };
  }

  /**
   * 分析执行历史并提取技能
   */
  extractSkills(records: ExecutionRecord[]): SkillPattern[] {
    logger.info(`Analyzing ${records.length} execution records for skill extraction`);

    // 筛选成功的记录
    const successfulRecords = records.filter(
      r => r.success && (!r.feedback || r.feedback === 'positive')
    );

    logger.info(`Found ${successfulRecords.length} successful records`);

    // 按意图分组
    const byIntent = this.groupByIntent(successfulRecords);
    
    const extractedPatterns: SkillPattern[] = [];

    for (const [intent, intentRecords] of byIntent) {
      // 查找相似的工具序列
      const sequences = this.findSimilarSequences(intentRecords);
      
      for (const sequence of sequences) {
        const pattern = this.createPattern(intent, sequence);
        
        // 验证模式质量
        if (this.validatePattern(pattern)) {
          // 检查是否与现有模式相似
          const existingSimilar = this.findSimilarPattern(pattern);
          
          if (existingSimilar) {
            // 合并到现有模式
            this.mergePatterns(existingSimilar, pattern);
          } else {
            // 添加新模式
            this.patterns.set(pattern.id, pattern);
            extractedPatterns.push(pattern);
          }
        }
      }
    }

    logger.info(`Extracted ${extractedPatterns.length} new skill patterns`);
    return extractedPatterns;
  }

  /**
   * 按意图分组
   */
  private groupByIntent(records: ExecutionRecord[]): Map<string, ExecutionRecord[]> {
    const groups = new Map<string, ExecutionRecord[]>();
    
    for (const record of records) {
      const intent = record.intent || 'unknown';
      if (!groups.has(intent)) {
        groups.set(intent, []);
      }
      groups.get(intent)!.push(record);
    }
    
    return groups;
  }

  /**
   * 查找相似的工具序列
   */
  private findSimilarSequences(records: ExecutionRecord[]): ExecutionRecord[][] {
    const sequences: ExecutionRecord[][] = [];
    const processed = new Set<string>();

    for (let i = 0; i < records.length; i++) {
      if (processed.has(records[i].id)) continue;

      const similar: ExecutionRecord[] = [records[i]];
      
      for (let j = i + 1; j < records.length; j++) {
        if (processed.has(records[j].id)) continue;

        if (this.calculateSequenceSimilarity(records[i], records[j]) >= this.options.similarityThreshold!) {
          similar.push(records[j]);
          processed.add(records[j].id);
        }
      }

      if (similar.length >= this.options.minSuccessCount!) {
        sequences.push(similar);
      }
      
      processed.add(records[i].id);
    }

    return sequences;
  }

  /**
   * 计算两个记录的序列相似度
   */
  private calculateSequenceSimilarity(a: ExecutionRecord, b: ExecutionRecord): number {
    const seqA = a.toolSequence.map(t => t.tool);
    const seqB = b.toolSequence.map(t => t.tool);

    if (seqA.length === 0 || seqB.length === 0) return 0;
    if (seqA.length !== seqB.length) return 0;

    let matches = 0;
    for (let i = 0; i < seqA.length; i++) {
      if (seqA[i] === seqB[i]) {
        matches++;
      }
    }

    return matches / seqA.length;
  }

  /**
   * 创建技能模式
   */
  private createPattern(intent: string, records: ExecutionRecord[]): SkillPattern {
    // 使用第一个记录作为模板
    const template = records[0];
    
    // 分析参数映射
    const inputMapping = this.analyzeInputMapping(records);

    // 统计成功率
    const successCount = records.filter(r => r.success).length;

    const pattern: SkillPattern = {
      id: randomUUID(),
      name: this.generatePatternName(intent, template),
      description: this.generatePatternDescription(template),
      applicableIntents: [intent],
      toolSequence: template.toolSequence.map(t => ({
        tool: t.tool,
        requiredArgs: Object.keys(t.args),
        optionalArgs: [],
      })),
      inputMapping,
      successCount,
      totalCount: records.length,
      confidence: successCount / records.length,
      extractedAt: new Date().toISOString(),
    };

    return pattern;
  }

  /**
   * 生成模式名称
   */
  private generatePatternName(intent: string, template: ExecutionRecord): string {
    const toolNames = template.toolSequence.map(t => t.tool).join('_');
    return `skill_${intent}_${toolNames}`.substring(0, 50);
  }

  /**
   * 生成模式描述
   */
  private generatePatternDescription(template: ExecutionRecord): string {
    const tools = template.toolSequence.map(t => t.tool).join(' → ');
    return `Execute sequence: ${tools} for task: ${template.task}`;
  }

  /**
   * 分析输入参数映射
   */
  private analyzeInputMapping(records: ExecutionRecord[]): Record<string, string> {
    // 简化的映射分析
    const mapping: Record<string, string> = {};
    
    if (records.length === 0) return mapping;

    const firstRecord = records[0];
    for (let i = 0; i < firstRecord.toolSequence.length; i++) {
      const step = firstRecord.toolSequence[i];
      for (const argName of Object.keys(step.args)) {
        mapping[`step${i}_${argName}`] = argName;
      }
    }

    return mapping;
  }

  /**
   * 验证模式质量
   */
  private validatePattern(pattern: SkillPattern): boolean {
    // 检查成功率
    if (pattern.successCount / pattern.totalCount < this.options.minSuccessRate!) {
      return false;
    }

    // 检查序列长度
    if (pattern.toolSequence.length > this.options.maxSequenceLength!) {
      return false;
    }

    // 检查最小执行次数
    if (pattern.totalCount < this.options.minSuccessCount!) {
      return false;
    }

    return true;
  }

  /**
   * 查找相似的模式
   */
  private findSimilarPattern(pattern: SkillPattern): SkillPattern | undefined {
    for (const existing of this.patterns.values()) {
      if (this.calculatePatternSimilarity(existing, pattern) >= this.options.similarityThreshold!) {
        return existing;
      }
    }
    return undefined;
  }

  /**
   * 计算两个模式的相似度
   */
  private calculatePatternSimilarity(a: SkillPattern, b: SkillPattern): number {
    // 比较工具序列
    if (a.toolSequence.length !== b.toolSequence.length) return 0;

    let matches = 0;
    for (let i = 0; i < a.toolSequence.length; i++) {
      if (a.toolSequence[i].tool === b.toolSequence[i].tool) {
        matches++;
      }
    }

    return matches / a.toolSequence.length;
  }

  /**
   * 合并模式
   */
  private mergePatterns(existing: SkillPattern, new_: SkillPattern): void {
    existing.successCount += new_.successCount;
    existing.totalCount += new_.totalCount;
    existing.confidence = existing.successCount / existing.totalCount;
    
    // 合并意图
    for (const intent of new_.applicableIntents) {
      if (!existing.applicableIntents.includes(intent)) {
        existing.applicableIntents.push(intent);
      }
    }
  }

  /**
   * 获取所有提取的模式
   */
  getPatterns(): SkillPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * 按意图获取模式
   */
  getPatternsForIntent(intent: string): SkillPattern[] {
    return this.getPatterns().filter(p => 
      p.applicableIntents.includes(intent)
    );
  }

  /**
   * 获取高置信度模式
   */
  getHighConfidencePatterns(minConfidence = 0.8): SkillPattern[] {
    return this.getPatterns().filter(p => p.confidence >= minConfidence);
  }

  /**
   * 删除模式
   */
  deletePattern(patternId: string): boolean {
    return this.patterns.delete(patternId);
  }

  /**
   * 清空所有模式
   */
  clearPatterns(): void {
    this.patterns.clear();
  }
}
