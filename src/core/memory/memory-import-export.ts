/**
 * @file core/memory/memory-import-export.ts
 * @description 记忆导入导出模块 - 支持多种格式
 * @author Ouroboros
 * @date 2026-02-18
 */

import type { AnyMemory, MemoryType } from '@/types/memory';
import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger('MemoryImportExport');

/**
 * 导出格式
 */
export type ExportFormat = 'json' | 'markdown' | 'csv';

/**
 * 导出选项
 */
export interface ExportOptions {
  format: ExportFormat;
  includeEmbeddings?: boolean;
  memoryTypes?: MemoryType[];
  startDate?: string;
  endDate?: string;
  minImportance?: number;
  tags?: string[];
}

/**
 * 导入选项
 */
export interface ImportOptions {
  format: ExportFormat;
  skipDuplicates?: boolean;
  updateExisting?: boolean;
  preserveIds?: boolean;
}

/**
 * 导入结果
 */
export interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  updated: number;
  errors: Array<{ index: number; error: string }>;
}

/**
 * 记忆导入导出类
 */
export class MemoryImportExport {
  /**
   * 导出记忆
   * @param memories 要导出的记忆列表
   * @param options 导出选项
   * @returns 导出的内容
   */
  exportMemories(memories: AnyMemory[], options: ExportOptions): string {
    const { format, includeEmbeddings = false } = options;

    // 过滤记忆
    let filtered = this.filterMemories(memories, options);

    // 清理敏感数据
    if (!includeEmbeddings) {
      filtered = filtered.map((m) => ({
        ...m,
        embedding: undefined,
      }));
    }

    switch (format) {
      case 'json':
        return this.exportAsJSON(filtered);
      case 'markdown':
        return this.exportAsMarkdown(filtered);
      case 'csv':
        return this.exportAsCSV(filtered);
      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }
  }

  /**
   * 导入记忆
   * @param content 导入内容
   * @param options 导入选项
   * @returns 导入的记忆列表和结果
   */
  importMemories(
    content: string,
    options: ImportOptions
  ): { memories: AnyMemory[]; result: ImportResult } {
    const { format } = options;

    let memories: AnyMemory[] = [];

    switch (format) {
      case 'json':
        memories = this.importFromJSON(content);
        break;
      case 'markdown':
        memories = this.importFromMarkdown(content);
        break;
      case 'csv':
        memories = this.importFromCSV(content);
        break;
      default:
        throw new Error(`不支持的导入格式: ${format}`);
    }

    // 验证和清理
    const result = this.validateAndClean(memories, options);

    logger.info('记忆导入完成', {
      total: result.total,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors.length,
    });

    return { memories: result.memories, result };
  }

  /**
   * 导出为 JSON
   */
  private exportAsJSON(memories: AnyMemory[]): string {
    return JSON.stringify(
      {
        version: '2.0.0',
        exportDate: new Date().toISOString(),
        count: memories.length,
        memories,
      },
      null,
      2
    );
  }

  /**
   * 导出为 Markdown
   */
  private exportAsMarkdown(memories: AnyMemory[]): string {
    const lines: string[] = [
      '# Ouroboros 记忆导出',
      '',
      `- 导出时间: ${new Date().toLocaleString('zh-CN')}`,
      `- 记忆数量: ${memories.length}`,
      '',
      '---',
      '',
    ];

    for (const memory of memories) {
      lines.push(`## ${memory.type} - ${memory.createdAt}`);
      lines.push('');
      lines.push(`**ID:** ${memory.id}`);
      lines.push(`**类型:** ${memory.type}`);
      lines.push(`**重要性:** ${(memory.importance * 100).toFixed(0)}%`);
      lines.push(`**访问次数:** ${memory.accessCount}`);
      lines.push(`**标签:** ${memory.tags.join(', ')}`);
      lines.push('');
      lines.push('**内容:**');
      lines.push('```json');
      lines.push(JSON.stringify(memory.content, null, 2));
      lines.push('```');
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 导出为 CSV
   */
  private exportAsCSV(memories: AnyMemory[]): string {
    const headers = [
      'id',
      'type',
      'createdAt',
      'importance',
      'accessCount',
      'tags',
      'content',
    ];

    const rows = memories.map((m) => [
      m.id,
      m.type,
      m.createdAt,
      m.importance.toString(),
      m.accessCount.toString(),
      m.tags.join(';'),
      JSON.stringify(m.content).replace(/"/g, '""'),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * 从 JSON 导入
   */
  private importFromJSON(content: string): AnyMemory[] {
    try {
      const data = JSON.parse(content);
      if (data.memories && Array.isArray(data.memories)) {
        return data.memories;
      }
      if (Array.isArray(data)) {
        return data;
      }
      throw new Error('无效的 JSON 格式');
    } catch (error) {
      throw new Error(`JSON 解析失败: ${error}`);
    }
  }

  /**
   * 从 Markdown 导入
   */
  private importFromMarkdown(content: string): AnyMemory[] {
    // 简化实现：提取代码块中的 JSON
    const memories: AnyMemory[] = [];
    const codeBlockRegex = /```json\n([\s\S]*?)\n```/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        if (data.id && data.type) {
          memories.push(data as AnyMemory);
        }
      } catch {
        // 忽略解析失败的块
      }
    }

    return memories;
  }

  /**
   * 从 CSV 导入
   */
  private importFromCSV(content: string): AnyMemory[] {
    const lines = content.split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',');
    const memories: AnyMemory[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length !== headers.length) continue;

      const record: Record<string, string> = {};
      headers.forEach((h, idx) => {
        record[h] = values[idx];
      });

      try {
        const memory: AnyMemory = {
          id: record.id || crypto.randomUUID(),
          type: record.type as MemoryType,
          createdAt: record.createdAt || new Date().toISOString(),
          lastAccessedAt: record.createdAt || new Date().toISOString(),
          accessCount: parseInt(record.accessCount) || 0,
          importance: parseFloat(record.importance) || 0.5,
          emotionalIntensity: 0,
          confidence: 1,
          relatedMemoryIds: [],
          tags: record.tags ? record.tags.split(';') : [],
          content: JSON.parse(record.content || '{}'),
        } as unknown as AnyMemory;
        memories.push(memory);
      } catch {
        // 忽略解析失败的行
      }
    }

    return memories;
  }

  /**
   * 解析 CSV 行
   */
  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        if (inQuotes && line[values.join('').length + current.length + values.length + 1] === '"') {
          current += '"';
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);

    return values;
  }

  /**
   * 过滤记忆
   */
  private filterMemories(
    memories: AnyMemory[],
    options: ExportOptions
  ): AnyMemory[] {
    return memories.filter((m) => {
      // 类型过滤
      if (options.memoryTypes && !options.memoryTypes.includes(m.type)) {
        return false;
      }

      // 时间过滤
      if (options.startDate && m.createdAt < options.startDate) {
        return false;
      }
      if (options.endDate && m.createdAt > options.endDate) {
        return false;
      }

      // 重要性过滤
      if (options.minImportance !== undefined && m.importance < options.minImportance) {
        return false;
      }

      // 标签过滤
      if (options.tags && !options.tags.some((t) => m.tags.includes(t))) {
        return false;
      }

      return true;
    });
  }

  /**
   * 验证和清理
   */
  private validateAndClean(
    memories: AnyMemory[],
    options: ImportOptions
  ): ImportResult & { memories: AnyMemory[] } {
    const result: ImportResult = {
      total: memories.length,
      imported: 0,
      skipped: 0,
      updated: 0,
      errors: [],
    };

    const validMemories: AnyMemory[] = [];

    for (let i = 0; i < memories.length; i++) {
      const memory = memories[i];

      // 验证必需字段
      if (!memory.id || !memory.type) {
        result.errors.push({ index: i, error: '缺少必需字段 (id 或 type)' });
        continue;
      }

      // 验证类型
      if (!['episodic', 'semantic', 'procedural', 'reflective'].includes(memory.type)) {
        result.errors.push({ index: i, error: `无效的记忆类型: ${memory.type}` });
        continue;
      }

      // 清理数据
      const cleaned: AnyMemory = {
        ...memory,
        createdAt: memory.createdAt || new Date().toISOString(),
        lastAccessedAt: memory.lastAccessedAt || new Date().toISOString(),
        accessCount: memory.accessCount || 0,
        importance: memory.importance || 0.5,
        emotionalIntensity: memory.emotionalIntensity || 0,
        confidence: memory.confidence || 1,
        relatedMemoryIds: memory.relatedMemoryIds || [],
        tags: memory.tags || [],
      };

      // 如果不保留 ID，生成新 ID
      if (!options.preserveIds) {
        cleaned.id = crypto.randomUUID();
      }

      validMemories.push(cleaned);
      result.imported++;
    }

    return { memories: validMemories, ...result };
  }

  /**
   * 获取支持的格式
   */
  getSupportedFormats(): ExportFormat[] {
    return ['json', 'markdown', 'csv'];
  }
}

/**
 * 创建导入导出实例
 */
export function createMemoryImportExport(): MemoryImportExport {
  return new MemoryImportExport();
}
