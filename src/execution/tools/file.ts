/**
 * 文件工具 (File Tools)
 * 
 * 文件系统操作
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { ToolDefinition, ToolContext } from '../tool-registry.js';

export const fileTools: ToolDefinition[] = [
  // ============================================================================
  // 读取文件
  // ============================================================================
  {
    name: 'file_read',
    displayName: 'Read File',
    description: '读取文件内容，支持文本和二进制文件',
    category: 'file',
    tags: ['file', 'read', 'io'],
    permissionLevel: 'user',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件路径 (相对或绝对)',
        },
        encoding: {
          type: 'string',
          description: '文件编码',
          enum: ['utf-8', 'utf8', 'ascii', 'base64', 'hex', 'binary'],
        },
        offset: {
          type: 'number',
          description: '起始偏移量',
        },
        length: {
          type: 'number',
          description: '读取长度',
        },
      },
      required: ['path'],
    },
    execute: async (args: {
      path: string;
      encoding?: string;
      offset?: number;
      length?: number;
    }) => {
      const encoding = args.encoding || 'utf-8';
      const resolvedPath = path.resolve(args.path);

      // 安全检查：路径遍历
      const cwd = process.cwd();
      if (!resolvedPath.startsWith(cwd) && !resolvedPath.startsWith('/tmp')) {
        throw new Error('Path traversal detected');
      }

      // 获取文件信息
      const stat = await fs.stat(resolvedPath);
      if (!stat.isFile()) {
        throw new Error('Path is not a file');
      }

      // 大文件检查
      const MAX_SIZE = 10 * 1024 * 1024; // 10MB
      if (stat.size > MAX_SIZE && !args.offset) {
        return {
          warning: 'File is large, use offset/length to read parts',
          size: stat.size,
          sizeMB: (stat.size / 1024 / 1024).toFixed(2),
        };
      }

      // 读取内容
      let content: string | Buffer;
      if (args.offset !== undefined || args.length !== undefined) {
        const fd = await fs.open(resolvedPath, 'r');
        const buffer = Buffer.alloc(args.length || 4096);
        const { bytesRead } = await fd.read(
          buffer,
          0,
          args.length || 4096,
          args.offset || 0
        );
        await fd.close();
        content = encoding === 'binary' || encoding === 'base64' || encoding === 'hex'
          ? buffer.slice(0, bytesRead)
          : buffer.slice(0, bytesRead).toString(encoding as BufferEncoding);
      } else {
        content = await fs.readFile(resolvedPath, encoding as BufferEncoding);
      }

      return {
        path: resolvedPath,
        content: encoding === 'binary' ? (content as Buffer).toString('base64') : content,
        encoding,
        size: stat.size,
        modified: stat.mtime,
        created: stat.birthtime,
      };
    },
  },

  // ============================================================================
  // 写入文件
  // ============================================================================
  {
    name: 'file_write',
    displayName: 'Write File',
    description: '写入文件内容，自动创建目录',
    category: 'file',
    tags: ['file', 'write', 'io'],
    permissionLevel: 'user',
    requireConfirmation: true,
    confirmationTemplate: '确认写入文件 "{{path}}"?',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件路径',
        },
        content: {
          type: 'string',
          description: '文件内容',
        },
        encoding: {
          type: 'string',
          description: '文件编码',
          enum: ['utf-8', 'utf8', 'ascii', 'base64'],
        },
        append: {
          type: 'boolean',
          description: '是否追加模式',
        },
      },
      required: ['path', 'content'],
    },
    execute: async (args: {
      path: string;
      content: string;
      encoding?: string;
      append?: boolean;
    }) => {
      const resolvedPath = path.resolve(args.path);
      const encoding = (args.encoding || 'utf-8') as BufferEncoding;

      // 安全检查
      const cwd = process.cwd();
      if (!resolvedPath.startsWith(cwd) && !resolvedPath.startsWith('/tmp')) {
        throw new Error('Path traversal detected');
      }

      // 确保目录存在
      const dir = path.dirname(resolvedPath);
      await fs.mkdir(dir, { recursive: true });

      // 写入内容
      const content = args.content;
      await fs.writeFile(resolvedPath, content, {
        encoding,
        flag: args.append ? 'a' : 'w',
      });

      const stat = await fs.stat(resolvedPath);

      return {
        path: resolvedPath,
        bytesWritten: Buffer.byteLength(content, encoding),
        totalSize: stat.size,
        mode: args.append ? 'append' : 'write',
      };
    },
  },

  // ============================================================================
  // 文件列表
  // ============================================================================
  {
    name: 'file_list',
    displayName: 'List Files',
    description: '列出目录内容',
    category: 'file',
    tags: ['file', 'list', 'directory'],
    permissionLevel: 'user',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '目录路径',
        },
        recursive: {
          type: 'boolean',
          description: '是否递归',
        },
        pattern: {
          type: 'string',
          description: '文件匹配模式 (如 *.ts)',
        },
      },
      required: ['path'],
    },
    execute: async (args: {
      path: string;
      recursive?: boolean;
      pattern?: string;
    }) => {
      const resolvedPath = path.resolve(args.path);
      const entries: Array<{
        name: string;
        type: 'file' | 'directory' | 'link';
        size: number;
        modified: Date;
        path: string;
      }> = [];

      async function scan(dir: string, isRecursive: boolean) {
        const items = await fs.readdir(dir, { withFileTypes: true });

        for (const item of items) {
          const itemPath = path.join(dir, item.name);
          const relativePath = path.relative(resolvedPath, itemPath);

          // 模式匹配
          if (args.pattern && !item.name.match(new RegExp(args.pattern.replace('*', '.*')))) {
            continue;
          }

          let type: 'file' | 'directory' | 'link' = 'file';
          if (item.isDirectory()) type = 'directory';
          if (item.isSymbolicLink()) type = 'link';

          let size = 0;
          let modified = new Date(0);

          try {
            const stat = await fs.stat(itemPath);
            size = stat.size;
            modified = stat.mtime;
          } catch {
            // 忽略无法访问的文件
          }

          entries.push({
            name: item.name,
            type,
            size,
            modified,
            path: relativePath,
          });

          if (isRecursive && item.isDirectory()) {
            await scan(itemPath, true);
          }
        }
      }

      await scan(resolvedPath, args.recursive || false);

      return {
        path: resolvedPath,
        count: entries.length,
        entries: entries.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
          return a.name.localeCompare(b.name);
        }),
      };
    },
  },

  // ============================================================================
  // 文件信息
  // ============================================================================
  {
    name: 'file_info',
    displayName: 'File Info',
    description: '获取文件元数据',
    category: 'file',
    tags: ['file', 'metadata', 'info'],
    permissionLevel: 'user',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件路径',
        },
      },
      required: ['path'],
    },
    execute: async (args: { path: string }) => {
      const resolvedPath = path.resolve(args.path);
      const stat = await fs.stat(resolvedPath);

      return {
        path: resolvedPath,
        exists: true,
        type: stat.isFile() ? 'file' : stat.isDirectory() ? 'directory' : 'other',
        size: stat.size,
        sizeFormatted: formatBytes(stat.size),
        mode: stat.mode.toString(8),
        modified: stat.mtime,
        accessed: stat.atime,
        created: stat.birthtime,
        isFile: stat.isFile(),
        isDirectory: stat.isDirectory(),
        isSymbolicLink: stat.isSymbolicLink(),
      };
    },
  },

  // ============================================================================
  // 删除文件
  // ============================================================================
  {
    name: 'file_delete',
    displayName: 'Delete File',
    description: '删除文件或目录',
    category: 'file',
    tags: ['file', 'delete', 'dangerous'],
    permissionLevel: 'user',
    requireConfirmation: true,
    confirmationTemplate: '⚠️ 确认删除 "{{path}}"? 此操作不可恢复!',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件或目录路径',
        },
        recursive: {
          type: 'boolean',
          description: '递归删除目录',
        },
      },
      required: ['path'],
    },
    execute: async (args: { path: string; recursive?: boolean }) => {
      const resolvedPath = path.resolve(args.path);

      // 安全检查
      const cwd = process.cwd();
      if (!resolvedPath.startsWith(cwd) && !resolvedPath.startsWith('/tmp')) {
        throw new Error('Path traversal detected');
      }

      const stat = await fs.stat(resolvedPath);

      if (stat.isDirectory()) {
        await fs.rm(resolvedPath, { recursive: args.recursive });
      } else {
        await fs.unlink(resolvedPath);
      }

      return {
        path: resolvedPath,
        deleted: true,
        type: stat.isDirectory() ? 'directory' : 'file',
      };
    },
  },

  // ============================================================================
  // 文件移动/重命名
  // ============================================================================
  {
    name: 'file_move',
    displayName: 'Move File',
    description: '移动或重命名文件',
    category: 'file',
    tags: ['file', 'move', 'rename'],
    permissionLevel: 'user',
    parameters: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: '源路径',
        },
        destination: {
          type: 'string',
          description: '目标路径',
        },
      },
      required: ['source', 'destination'],
    },
    execute: async (args: { source: string; destination: string }) => {
      const sourcePath = path.resolve(args.source);
      const destPath = path.resolve(args.destination);

      await fs.rename(sourcePath, destPath);

      return {
        source: sourcePath,
        destination: destPath,
        moved: true,
      };
    },
  },

  // ============================================================================
  // 文件复制
  // ============================================================================
  {
    name: 'file_copy',
    displayName: 'Copy File',
    description: '复制文件',
    category: 'file',
    tags: ['file', 'copy'],
    permissionLevel: 'user',
    parameters: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: '源路径',
        },
        destination: {
          type: 'string',
          description: '目标路径',
        },
      },
      required: ['source', 'destination'],
    },
    execute: async (args: { source: string; destination: string }) => {
      const sourcePath = path.resolve(args.source);
      const destPath = path.resolve(args.destination);

      await fs.copyFile(sourcePath, destPath);

      return {
        source: sourcePath,
        destination: destPath,
        copied: true,
      };
    },
  },

  // ============================================================================
  // 搜索文件内容
  // ============================================================================
  {
    name: 'file_grep',
    displayName: 'Grep File',
    description: '在文件中搜索内容',
    category: 'file',
    tags: ['file', 'search', 'grep'],
    permissionLevel: 'user',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件路径',
        },
        pattern: {
          type: 'string',
          description: '搜索模式 (支持正则)',
        },
        caseSensitive: {
          type: 'boolean',
          description: '是否区分大小写',
        },
        maxResults: {
          type: 'number',
          description: '最大结果数',
        },
      },
      required: ['path', 'pattern'],
    },
    execute: async (args: {
      path: string;
      pattern: string;
      caseSensitive?: boolean;
      maxResults?: number;
    }) => {
      const resolvedPath = path.resolve(args.path);
      const content = await fs.readFile(resolvedPath, 'utf-8');
      const lines = content.split('\n');

      const regex = new RegExp(args.pattern, args.caseSensitive ? 'g' : 'gi');
      const matches: Array<{ line: number; content: string; match: string }> = [];
      const maxResults = args.maxResults || 100;

      for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
        const line = lines[i];
        const lineMatches = line.match(regex);
        if (lineMatches) {
          matches.push({
            line: i + 1,
            content: line.substring(0, 200),
            match: lineMatches[0],
          });
        }
      }

      return {
        path: resolvedPath,
        pattern: args.pattern,
        matches,
        totalMatches: matches.length,
      };
    },
  },
];

// 辅助函数
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export default fileTools;
