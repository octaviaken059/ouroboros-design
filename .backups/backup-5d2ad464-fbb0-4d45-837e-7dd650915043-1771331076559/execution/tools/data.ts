/**
 * 数据处理工具 (Data Tools)
 * 
 * 数据转换、解析和处理
 */

import type { ToolDefinition } from '../tool-registry.js';

export const dataTools: ToolDefinition[] = [
  // ============================================================================
  // JSON 解析
  // ============================================================================
  {
    name: 'data_json_parse',
    displayName: 'Parse JSON',
    description: '解析 JSON 字符串',
    category: 'data',
    tags: ['data', 'json', 'parse'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'JSON 字符串',
        },
      },
      required: ['text'],
    },
    execute: async (args: { text: string }) => {
      const parsed = JSON.parse(args.text);
      return {
        data: parsed,
        type: typeof parsed,
        isArray: Array.isArray(parsed),
        keys: typeof parsed === 'object' && parsed !== null
          ? Object.keys(parsed)
          : null,
      };
    },
  },

  // ============================================================================
  // JSON 序列化
  // ============================================================================
  {
    name: 'data_json_stringify',
    displayName: 'Stringify JSON',
    description: '将数据转换为 JSON 字符串',
    category: 'data',
    tags: ['data', 'json', 'stringify'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          description: '要序列化的数据',
        },
        pretty: {
          type: 'boolean',
          description: '是否格式化',
        },
        indent: {
          type: 'number',
          description: '缩进空格数',
        },
      },
      required: ['data'],
    },
    execute: async (args: {
      data: unknown;
      pretty?: boolean;
      indent?: number;
    }) => {
      const indent = args.pretty ? (args.indent || 2) : undefined;
      const json = JSON.stringify(args.data, null, indent);

      return {
        json,
        length: json.length,
        lines: json.split('\n').length,
      };
    },
  },

  // ============================================================================
  // CSV 解析
  // ============================================================================
  {
    name: 'data_csv_parse',
    displayName: 'Parse CSV',
    description: '解析 CSV 字符串',
    category: 'data',
    tags: ['data', 'csv', 'parse'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'CSV 字符串',
        },
        delimiter: {
          type: 'string',
          description: '分隔符',
        },
        hasHeader: {
          type: 'boolean',
          description: '是否有标题行',
        },
      },
      required: ['text'],
    },
    execute: async (args: {
      text: string;
      delimiter?: string;
      hasHeader?: boolean;
    }) => {
      const delimiter = args.delimiter || ',';
      const lines = args.text.trim().split('\n');

      if (lines.length === 0) {
        return { headers: [], rows: [] };
      }

      let headers: string[] = [];
      let startIndex = 0;

      if (args.hasHeader !== false) {
        headers = lines[0].split(delimiter).map(h => h.trim());
        startIndex = 1;
      }

      const rows = [];
      for (let i = startIndex; i < lines.length; i++) {
        const values = lines[i].split(delimiter).map(v => v.trim());

        if (headers.length > 0) {
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => {
            row[h] = values[idx] || '';
          });
          rows.push(row);
        } else {
          rows.push(values);
        }
      }

      return {
        headers,
        rows,
        rowCount: rows.length,
        columnCount: headers.length || (rows[0] as string[])?.length || 0,
      };
    },
  },

  // ============================================================================
  // Base64 编码
  // ============================================================================
  {
    name: 'data_base64_encode',
    displayName: 'Base64 Encode',
    description: 'Base64 编码',
    category: 'data',
    tags: ['data', 'base64', 'encode'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: '要编码的文本',
        },
      },
      required: ['text'],
    },
    execute: async (args: { text: string }) => {
      const encoded = Buffer.from(args.text).toString('base64');
      return {
        original: args.text,
        encoded,
        length: encoded.length,
      };
    },
  },

  // ============================================================================
  // Base64 解码
  // ============================================================================
  {
    name: 'data_base64_decode',
    displayName: 'Base64 Decode',
    description: 'Base64 解码',
    category: 'data',
    tags: ['data', 'base64', 'decode'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Base64 字符串',
        },
      },
      required: ['text'],
    },
    execute: async (args: { text: string }) => {
      const decoded = Buffer.from(args.text, 'base64').toString('utf-8');
      return {
        original: args.text,
        decoded,
        length: decoded.length,
      };
    },
  },

  // ============================================================================
  // URL 编码
  // ============================================================================
  {
    name: 'data_url_encode',
    displayName: 'URL Encode',
    description: 'URL 编码',
    category: 'data',
    tags: ['data', 'url', 'encode'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: '要编码的文本',
        },
      },
      required: ['text'],
    },
    execute: async (args: { text: string }) => {
      return {
        original: args.text,
        encoded: encodeURIComponent(args.text),
      };
    },
  },

  // ============================================================================
  // URL 解码
  // ============================================================================
  {
    name: 'data_url_decode',
    displayName: 'URL Decode',
    description: 'URL 解码',
    category: 'data',
    tags: ['data', 'url', 'decode'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'URL 编码的文本',
        },
      },
      required: ['text'],
    },
    execute: async (args: { text: string }) => {
      return {
        original: args.text,
        decoded: decodeURIComponent(args.text),
      };
    },
  },

  // ============================================================================
  // 哈希计算
  // ============================================================================
  {
    name: 'data_hash',
    displayName: 'Calculate Hash',
    description: '计算字符串的哈希值',
    category: 'data',
    tags: ['data', 'hash', 'crypto'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: '要哈希的文本',
        },
        algorithm: {
          type: 'string',
          description: '哈希算法',
          enum: ['md5', 'sha1', 'sha256', 'sha512'],
        },
      },
      required: ['text'],
    },
    execute: async (args: {
      text: string;
      algorithm?: string;
    }) => {
      const crypto = await import('crypto');
      const algo = args.algorithm || 'sha256';
      const hash = crypto.createHash(algo).update(args.text).digest('hex');

      return {
        algorithm: algo,
        hash,
        length: hash.length,
      };
    },
  },

  // ============================================================================
  // 数据转换
  // ============================================================================
  {
    name: 'data_transform',
    displayName: 'Transform Data',
    description: '使用表达式转换数据',
    category: 'data',
    tags: ['data', 'transform', 'map'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          description: '要转换的数据数组',
        },
        expression: {
          type: 'string',
          description: '转换表达式 (item 表示当前项)',
        },
      },
      required: ['data', 'expression'],
    },
    execute: async (args: {
      data: unknown[];
      expression: string;
    }) => {
      // 简单的属性访问转换
      // 例如: "item.name" 或 "item.toUpperCase()"
      const expr = args.expression.trim();

      const result = args.data.map((item, index) => {
        try {
          // 创建安全的上下文
          const context = { item, index };

          // 简单的属性访问
          if (expr.startsWith('item.')) {
            const path = expr.slice(5).split('.');
            let value: unknown = item;
            for (const key of path) {
              if (value && typeof value === 'object') {
                value = (value as Record<string, unknown>)[key];
              } else {
                return null;
              }
            }
            return value;
          }

          // 简单的方法调用
          if (expr.includes('(') && expr.includes(')')) {
            const match = expr.match(/item\.(\w+)\(\)/);
            if (match && typeof item === 'string') {
              const method = match[1];
              if (method === 'toUpperCase') return (item as string).toUpperCase();
              if (method === 'toLowerCase') return (item as string).toLowerCase();
              if (method === 'trim') return (item as string).trim();
            }
          }

          return item;
        } catch {
          return null;
        }
      });

      return {
        original: args.data,
        transformed: result,
        count: result.length,
      };
    },
  },

  // ============================================================================
  // 数据过滤
  // ============================================================================
  {
    name: 'data_filter',
    displayName: 'Filter Data',
    description: '过滤数组数据',
    category: 'data',
    tags: ['data', 'filter', 'array'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          description: '要过滤的数据数组',
        },
        key: {
          type: 'string',
          description: '要检查的属性键',
        },
        value: {
          type: 'string',
          description: '要匹配的值',
        },
      },
      required: ['data', 'key', 'value'],
    },
    execute: async (args: {
      data: Array<Record<string, unknown>>;
      key: string;
      value: unknown;
    }) => {
      const filtered = args.data.filter(item => item[args.key] === args.value);

      return {
        original: args.data,
        filtered,
        totalCount: args.data.length,
        filteredCount: filtered.length,
      };
    },
  },

  // ============================================================================
  // 数据统计
  // ============================================================================
  {
    name: 'data_stats',
    displayName: 'Data Statistics',
    description: '计算数值数组的统计信息',
    category: 'data',
    tags: ['data', 'stats', 'math'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        numbers: {
          type: 'array',
          items: { type: 'number' },
          description: '数值数组',
        },
      },
      required: ['numbers'],
    },
    execute: async (args: { numbers: number[] }) => {
      const nums = args.numbers;
      if (nums.length === 0) {
        return { error: 'Empty array' };
      }

      const sum = nums.reduce((a, b) => a + b, 0);
      const avg = sum / nums.length;
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      const sorted = [...nums].sort((a, b) => a - b);
      const median = sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];

      return {
        count: nums.length,
        sum,
        average: avg,
        min,
        max,
        median,
        range: max - min,
      };
    },
  },
];

export default dataTools;
