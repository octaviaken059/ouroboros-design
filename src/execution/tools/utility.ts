/**
 * 实用工具 (Utility Tools)
 * 
 * 通用实用工具集
 */

import * as crypto from 'crypto';
import type { ToolDefinition } from '../tool-registry.js';

export const utilityTools: ToolDefinition[] = [
  // ============================================================================
  // UUID 生成
  // ============================================================================
  {
    name: 'util_uuid',
    displayName: 'Generate UUID',
    description: '生成 UUID v4',
    category: 'utility',
    tags: ['utility', 'uuid', 'id'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: '生成数量',
        },
      },
      required: [],
    },
    execute: async (args: { count?: number }) => {
      const count = Math.min(args.count || 1, 100);
      const uuids = [];

      for (let i = 0; i < count; i++) {
        uuids.push(crypto.randomUUID());
      }

      return {
        uuids,
        count: uuids.length,
      };
    },
  },

  // ============================================================================
  // 随机数生成
  // ============================================================================
  {
    name: 'util_random',
    displayName: 'Generate Random',
    description: '生成随机数',
    category: 'utility',
    tags: ['utility', 'random', 'number'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        min: {
          type: 'number',
          description: '最小值',
        },
        max: {
          type: 'number',
          description: '最大值',
        },
        count: {
          type: 'number',
          description: '生成数量',
        },
        type: {
          type: 'string',
          description: '随机类型',
          enum: ['integer', 'float'],
        },
      },
      required: [],
    },
    execute: async (args: {
      min?: number;
      max?: number;
      count?: number;
      type?: string;
    }) => {
      const min = args.min ?? 0;
      const max = args.max ?? 100;
      const count = Math.min(args.count || 1, 1000);
      const isFloat = args.type === 'float';

      const numbers = [];
      for (let i = 0; i < count; i++) {
        if (isFloat) {
          numbers.push(Math.random() * (max - min) + min);
        } else {
          numbers.push(Math.floor(Math.random() * (max - min + 1)) + min);
        }
      }

      return {
        numbers,
        count,
        range: { min, max },
        type: isFloat ? 'float' : 'integer',
      };
    },
  },

  // ============================================================================
  // 随机字符串
  // ============================================================================
  {
    name: 'util_random_string',
    displayName: 'Generate Random String',
    description: '生成随机字符串',
    category: 'utility',
    tags: ['utility', 'random', 'string'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        length: {
          type: 'number',
          description: '字符串长度',
        },
        charset: {
          type: 'string',
          description: '字符集类型',
          enum: ['alphanumeric', 'alpha', 'numeric', 'hex', 'base64', 'custom'],
        },
        custom: {
          type: 'string',
          description: '自定义字符集',
        },
      },
      required: ['length'],
    },
    execute: async (args: {
      length: number;
      charset?: string;
      custom?: string;
    }) => {
      const len = Math.min(args.length, 1000);

      const charsets: Record<string, string> = {
        alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
        alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
        numeric: '0123456789',
        hex: '0123456789abcdef',
        base64: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
      };

      const charset = args.charset === 'custom'
        ? args.custom || charsets.alphanumeric
        : charsets[args.charset || 'alphanumeric'] || charsets.alphanumeric;

      let result = '';
      for (let i = 0; i < len; i++) {
        result += charset.charAt(Math.floor(Math.random() * charset.length));
      }

      return {
        string: result,
        length: result.length,
        charset: args.charset || 'alphanumeric',
      };
    },
  },

  // ============================================================================
  // 文本分割
  // ============================================================================
  {
    name: 'util_split',
    displayName: 'Split Text',
    description: '按分隔符分割文本',
    category: 'utility',
    tags: ['utility', 'text', 'split'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: '要分割的文本',
        },
        delimiter: {
          type: 'string',
          description: '分隔符',
        },
        limit: {
          type: 'number',
          description: '最大分割数',
        },
      },
      required: ['text', 'delimiter'],
    },
    execute: async (args: {
      text: string;
      delimiter: string;
      limit?: number;
    }) => {
      const parts = args.text.split(args.delimiter, args.limit);

      return {
        parts,
        count: parts.length,
        delimiter: args.delimiter,
      };
    },
  },

  // ============================================================================
  // 文本连接
  // ============================================================================
  {
    name: 'util_join',
    displayName: 'Join Text',
    description: '用分隔符连接多个文本',
    category: 'utility',
    tags: ['utility', 'text', 'join'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        parts: {
          type: 'array',
          items: { type: 'string' },
          description: '要连接的文本数组',
        },
        delimiter: {
          type: 'string',
          description: '分隔符',
        },
      },
      required: ['parts'],
    },
    execute: async (args: {
      parts: string[];
      delimiter?: string;
    }) => {
      const result = args.parts.join(args.delimiter || '');

      return {
        result,
        count: args.parts.length,
        delimiter: args.delimiter || '',
      };
    },
  },

  // ============================================================================
  // 文本替换
  // ============================================================================
  {
    name: 'util_replace',
    displayName: 'Replace Text',
    description: '替换文本中的内容',
    category: 'utility',
    tags: ['utility', 'text', 'replace'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: '原文本',
        },
        search: {
          type: 'string',
          description: '要查找的内容',
        },
        replace: {
          type: 'string',
          description: '替换为',
        },
        all: {
          type: 'boolean',
          description: '是否替换所有',
        },
      },
      required: ['text', 'search', 'replace'],
    },
    execute: async (args: {
      text: string;
      search: string;
      replace: string;
      all?: boolean;
    }) => {
      let result: string;
      let count = 0;

      if (args.all) {
        const regex = new RegExp(escapeRegExp(args.search), 'g');
        count = (args.text.match(regex) || []).length;
        result = args.text.replace(regex, args.replace);
      } else {
        const index = args.text.indexOf(args.search);
        count = index !== -1 ? 1 : 0;
        result = args.text.replace(args.search, args.replace);
      }

      return {
        original: args.text,
        result,
        replacements: count,
      };
    },
  },

  // ============================================================================
  // 正则匹配
  // ============================================================================
  {
    name: 'util_regex_match',
    displayName: 'Regex Match',
    description: '使用正则表达式匹配文本',
    category: 'utility',
    tags: ['utility', 'regex', 'match'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: '要匹配的文本',
        },
        pattern: {
          type: 'string',
          description: '正则表达式',
        },
        flags: {
          type: 'string',
          description: '正则标志 (g, i, m 等)',
        },
      },
      required: ['text', 'pattern'],
    },
    execute: async (args: {
      text: string;
      pattern: string;
      flags?: string;
    }) => {
      const regex = new RegExp(args.pattern, args.flags || '');
      const matches = args.text.match(regex);

      if (!matches) {
        return {
          matches: [],
          count: 0,
          hasMatch: false,
        };
      }

      return {
        matches,
        count: matches.length,
        hasMatch: true,
        first: matches[0],
      };
    },
  },

  // ============================================================================
  // 时间格式化
  // ============================================================================
  {
    name: 'util_format_time',
    displayName: 'Format Time',
    description: '格式化时间戳',
    category: 'utility',
    tags: ['utility', 'time', 'format'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        timestamp: {
          type: 'number',
          description: '时间戳 (毫秒)',
        },
        format: {
          type: 'string',
          description: '格式字符串',
          enum: ['iso', 'locale', 'date', 'time', 'datetime'],
        },
        timezone: {
          type: 'string',
          description: '时区',
        },
      },
      required: [],
    },
    execute: async (args: {
      timestamp?: number;
      format?: string;
      timezone?: string;
    }) => {
      const timestamp = args.timestamp || Date.now();
      const date = new Date(timestamp);

      const format = args.format || 'iso';
      const timezone = args.timezone;

      const formats: Record<string, string> = {
        iso: date.toISOString(),
        locale: date.toLocaleString(timezone ? undefined : 'zh-CN', {
          timeZone: timezone,
        }),
        date: date.toLocaleDateString(timezone ? undefined : 'zh-CN', {
          timeZone: timezone,
        }),
        time: date.toLocaleTimeString(timezone ? undefined : 'zh-CN', {
          timeZone: timezone,
        }),
        datetime: date.toLocaleString(timezone ? undefined : 'zh-CN', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };

      return {
        timestamp,
        formatted: formats[format] || formats.iso,
        format,
        timezone: timezone || 'local',
      };
    },
  },

  // ============================================================================
  // 延迟/睡眠
  // ============================================================================
  {
    name: 'util_sleep',
    displayName: 'Sleep',
    description: '延迟指定时间',
    category: 'utility',
    tags: ['utility', 'sleep', 'delay'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        ms: {
          type: 'number',
          description: '延迟毫秒数',
        },
      },
      required: ['ms'],
    },
    execute: async (args: { ms: number }) => {
      const start = Date.now();
      await new Promise(resolve => setTimeout(resolve, Math.min(args.ms, 60000)));
      const actual = Date.now() - start;

      return {
        requested: args.ms,
        actual,
        completed: true,
      };
    },
  },

  // ============================================================================
  // 对象路径获取
  // ============================================================================
  {
    name: 'util_get_path',
    displayName: 'Get Object Path',
    description: '通过路径获取对象属性',
    category: 'utility',
    tags: ['utility', 'object', 'path'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        object: {
          type: 'object',
          description: '目标对象',
        },
        path: {
          type: 'string',
          description: '属性路径 (如 a.b.c)',
        },
        default: {
          type: 'string',
          description: '默认值',
        },
      },
      required: ['object', 'path'],
    },
    execute: async (args: {
      object: Record<string, unknown>;
      path: string;
      default?: unknown;
    }) => {
      const keys = args.path.split('.');
      let value: unknown = args.object;

      for (const key of keys) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[key];
        } else {
          value = undefined;
          break;
        }
      }

      return {
        path: args.path,
        value: value !== undefined ? value : args.default,
        exists: value !== undefined,
      };
    },
  },
];

// 辅助函数
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default utilityTools;
