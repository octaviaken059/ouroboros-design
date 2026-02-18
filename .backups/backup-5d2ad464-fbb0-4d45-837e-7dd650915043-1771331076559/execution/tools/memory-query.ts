/**
 * Memory Query Tool
 * 查询Ouroboros记忆系统
 */

import { Tool, ToolDefinition, ToolContext } from '../tool-registry.js';

export interface MemoryQueryInput {
  query: string;
  type?: 'short_term' | 'long_term' | 'all';
  limit?: number;
  threshold?: number;
  timeRange?: {
    start?: string;
    end?: string;
  };
  tags?: string[];
}

export interface MemoryEntry {
  id: string;
  content: string;
  type: 'short_term' | 'long_term';
  timestamp: string;
  relevance: number;
  tags?: string[];
  source?: string;
  metadata?: Record<string, any>;
}

export interface MemoryQueryOutput {
  success: boolean;
  query: string;
  results: MemoryEntry[];
  total: number;
  executionTimeMs: number;
}

const definition: ToolDefinition = {
  name: 'memory_query',
  description: '在Ouroboros记忆系统中搜索和检索相关信息，支持语义搜索、标签过滤和时间范围筛选',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索查询文本，支持自然语言描述'
      },
      type: {
        type: 'string',
        description: '记忆类型过滤器',
        enum: ['short_term', 'long_term', 'all']
      },
      limit: {
        type: 'number',
        description: '返回结果的最大数量'
      },
      threshold: {
        type: 'number',
        description: '相关性阈值 (0-1)，低于此值的结果将被过滤'
      },
      timeRange: {
        type: 'object',
        description: '时间范围过滤器',
        properties: {
          start: {
            type: 'string',
            description: '开始时间 (ISO 8601格式)'
          },
          end: {
            type: 'string',
            description: '结束时间 (ISO 8601格式)'
          }
        }
      },
      tags: {
        type: 'array',
        description: '标签过滤器，只返回包含指定标签的记忆',
        items: {
          type: 'string',
          description: '标签名称'
        }
      }
    },
    required: ['query']
  },
  execute: async () => ({}),
  category: 'memory',
  tags: ['memory', 'search', 'query', 'retrieval'],
  version: '1.0.0'
};

/**
 * 模拟语义搜索（实际实现应该调用向量搜索）
 */
async function performSemanticSearch(
  query: string,
  type: string,
  limit: number,
  threshold: number
): Promise<MemoryEntry[]> {
  // 模拟记忆数据库
  const mockMemories: MemoryEntry[] = [
    {
      id: 'mem-001',
      content: '用户提到喜欢科幻小说，特别是刘慈欣的作品',
      type: 'long_term',
      timestamp: '2024-01-15T10:30:00Z',
      relevance: 0.92,
      tags: ['preference', 'books', 'sci-fi'],
      source: 'conversation'
    },
    {
      id: 'mem-002',
      content: '今天讨论了关于Ouroboros架构的设计方案',
      type: 'short_term',
      timestamp: new Date().toISOString(),
      relevance: 0.88,
      tags: ['work', 'architecture', 'ouroboros'],
      source: 'conversation'
    },
    {
      id: 'mem-003',
      content: '用户希望系统能够记住重要的会议日期',
      type: 'long_term',
      timestamp: '2024-01-10T14:20:00Z',
      relevance: 0.75,
      tags: ['preference', 'calendar', 'reminders'],
      source: 'conversation'
    },
    {
      id: 'mem-004',
      content: '上次讨论了Python异步编程的最佳实践',
      type: 'long_term',
      timestamp: '2024-01-05T09:00:00Z',
      relevance: 0.65,
      tags: ['tech', 'python', 'async'],
      source: 'conversation'
    },
    {
      id: 'mem-005',
      content: '用户不喜欢过于冗长的回复',
      type: 'long_term',
      timestamp: '2024-01-01T16:45:00Z',
      relevance: 0.58,
      tags: ['preference', 'communication'],
      source: 'conversation'
    }
  ];

  // 模拟搜索延迟
  await new Promise(resolve => setTimeout(resolve, 100));

  // 根据类型过滤
  let results = mockMemories;
  if (type !== 'all') {
    results = results.filter(m => m.type === type);
  }

  // 模拟相关性评分（实际应该使用向量相似度）
  results = results.map(m => ({
    ...m,
    relevance: Math.max(0, m.relevance - Math.random() * 0.2)
  }));

  // 应用阈值
  results = results.filter(m => m.relevance >= threshold);

  // 排序并限制数量
  results.sort((a, b) => b.relevance - a.relevance);
  
  return results.slice(0, limit);
}

/**
 * 按时间范围过滤
 */
function filterByTimeRange(
  entries: MemoryEntry[],
  timeRange?: { start?: string; end?: string }
): MemoryEntry[] {
  if (!timeRange) return entries;

  return entries.filter(entry => {
    const entryTime = new Date(entry.timestamp).getTime();
    
    if (timeRange.start) {
      const startTime = new Date(timeRange.start).getTime();
      if (entryTime < startTime) return false;
    }
    
    if (timeRange.end) {
      const endTime = new Date(timeRange.end).getTime();
      if (entryTime > endTime) return false;
    }
    
    return true;
  });
}

/**
 * 按标签过滤
 */
function filterByTags(entries: MemoryEntry[], tags?: string[]): MemoryEntry[] {
  if (!tags || tags.length === 0) return entries;

  return entries.filter(entry => 
    entry.tags?.some(tag => tags.includes(tag))
  );
}

async function execute(
  args: Record<string, unknown>,
  context: ToolContext
): Promise<MemoryQueryOutput> {
  const startTime = Date.now();
  
  const params = args as unknown as MemoryQueryInput;
  const {
    query,
    type = 'all',
    limit = 10,
    threshold = 0.5,
    timeRange,
    tags
  } = params;

  // 检查中止信号
  if (context.cancelSignal?.aborted) {
    throw new Error('Query aborted');
  }

  // 执行语义搜索
  let results = await performSemanticSearch(query, type, limit * 2, threshold);

  // 应用额外过滤器
  results = filterByTimeRange(results, timeRange);
  results = filterByTags(results, tags);

  // 最终限制数量
  results = results.slice(0, limit);

  const executionTimeMs = Date.now() - startTime;

  return {
    success: true,
    query,
    results,
    total: results.length,
    executionTimeMs
  };
}

/**
 * 验证输入参数
 */
function validate(args: Record<string, unknown>): { valid: boolean; errors?: string[] } {
  const params = args as unknown as MemoryQueryInput;
  const errors: string[] = [];

  if (!params.query || params.query.trim().length === 0) {
    errors.push('Query cannot be empty');
  }

  if (params.type && !['short_term', 'long_term', 'all'].includes(params.type)) {
    errors.push("type must be one of: 'short_term', 'long_term', 'all'");
  }

  if (params.limit !== undefined) {
    if (!Number.isInteger(params.limit) || params.limit < 1 || params.limit > 100) {
      errors.push('limit must be an integer between 1 and 100');
    }
  }

  if (params.threshold !== undefined) {
    if (typeof params.threshold !== 'number' || params.threshold < 0 || params.threshold > 1) {
      errors.push('threshold must be a number between 0 and 1');
    }
  }

  if (params.timeRange) {
    if (params.timeRange.start) {
      const startDate = new Date(params.timeRange.start);
      if (isNaN(startDate.getTime())) {
        errors.push('timeRange.start must be a valid ISO 8601 date string');
      }
    }
    if (params.timeRange.end) {
      const endDate = new Date(params.timeRange.end);
      if (isNaN(endDate.getTime())) {
        errors.push('timeRange.end must be a valid ISO 8601 date string');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export const memoryQueryTool: Tool = {
  ...definition,
  execute,
  validate
};

export default memoryQueryTool;
