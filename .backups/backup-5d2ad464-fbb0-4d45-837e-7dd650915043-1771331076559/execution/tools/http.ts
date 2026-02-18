/**
 * HTTP 工具 (HTTP Tools)
 * 
 * 网络请求和API调用
 */

import type { ToolDefinition } from '../tool-registry.js';

export const httpTools: ToolDefinition[] = [
  // ============================================================================
  // HTTP GET
  // ============================================================================
  {
    name: 'http_get',
    displayName: 'HTTP GET',
    description: '发送 HTTP GET 请求',
    category: 'network',
    tags: ['http', 'get', 'request', 'network'],
    permissionLevel: 'user',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '请求URL',
        },
        headers: {
          type: 'object',
          description: '请求头',
        },
        timeout: {
          type: 'number',
          description: '超时时间(秒)',
        },
        maxRedirects: {
          type: 'number',
          description: '最大重定向次数',
        },
      },
      required: ['url'],
    },
    execute: async (args: {
      url: string;
      headers?: Record<string, string>;
      timeout?: number;
      maxRedirects?: number;
    }) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        (args.timeout || 30) * 1000
      );

      try {
        const response = await fetch(args.url, {
          method: 'GET',
          headers: args.headers,
          signal: controller.signal,
          redirect: args.maxRedirects === 0 ? 'manual' : 'follow',
        });

        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type') || '';
        let data: string | object;

        if (contentType.includes('application/json')) {
          data = await response.json() as object;
        } else {
          data = await response.text();
        }

        return {
          url: args.url,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data,
          size: typeof data === 'string' ? data.length : JSON.stringify(data).length,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    },
  },

  // ============================================================================
  // HTTP POST
  // ============================================================================
  {
    name: 'http_post',
    displayName: 'HTTP POST',
    description: '发送 HTTP POST 请求',
    category: 'network',
    tags: ['http', 'post', 'request', 'network'],
    permissionLevel: 'user',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '请求URL',
        },
        data: {
          type: 'object',
          description: '请求体数据',
        },
        headers: {
          type: 'object',
          description: '请求头',
        },
        timeout: {
          type: 'number',
          description: '超时时间(秒)',
        },
      },
      required: ['url', 'data'],
    },
    execute: async (args: {
      url: string;
      data: Record<string, unknown> | string;
      headers?: Record<string, string>;
      timeout?: number;
    }) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        (args.timeout || 30) * 1000
      );

      const body = typeof args.data === 'string'
        ? args.data
        : JSON.stringify(args.data);

      try {
        const response = await fetch(args.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...args.headers,
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type') || '';
        let responseData: string | object;

        if (contentType.includes('application/json')) {
          responseData = await response.json() as object;
        } else {
          responseData = await response.text();
        }

        return {
          url: args.url,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data: responseData,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    },
  },

  // ============================================================================
  // HTTP 通用请求
  // ============================================================================
  {
    name: 'http_request',
    displayName: 'HTTP Request',
    description: '发送任意 HTTP 请求',
    category: 'network',
    tags: ['http', 'request', 'network', 'api'],
    permissionLevel: 'user',
    parameters: {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          description: 'HTTP 方法',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
        },
        url: {
          type: 'string',
          description: '请求URL',
        },
        headers: {
          type: 'object',
          description: '请求头',
        },
        body: {
          type: 'string',
          description: '请求体 (字符串或JSON)',
        },
        timeout: {
          type: 'number',
          description: '超时时间(秒)',
        },
      },
      required: ['method', 'url'],
    },
    execute: async (args: {
      method: string;
      url: string;
      headers?: Record<string, string>;
      body?: string;
      timeout?: number;
    }) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        (args.timeout || 30) * 1000
      );

      try {
        const response = await fetch(args.url, {
          method: args.method,
          headers: args.headers,
          body: args.body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type') || '';
        let data: string | object;

        try {
          if (contentType.includes('application/json')) {
            data = await response.json() as object;
          } else {
            data = await response.text();
          }
        } catch {
          data = '[Binary or non-text content]';
        }

        return {
          method: args.method,
          url: args.url,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    },
  },

  // ============================================================================
  // 下载文件
  // ============================================================================
  {
    name: 'http_download',
    displayName: 'Download File',
    description: '下载文件到本地',
    category: 'network',
    tags: ['http', 'download', 'file'],
    permissionLevel: 'user',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '文件URL',
        },
        path: {
          type: 'string',
          description: '保存路径',
        },
        timeout: {
          type: 'number',
          description: '超时时间(秒)',
        },
      },
      required: ['url', 'path'],
    },
    execute: async (args: {
      url: string;
      path: string;
      timeout?: number;
    }) => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        (args.timeout || 60) * 1000
      );

      try {
        const response = await fetch(args.url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        const resolvedPath = path.resolve(args.path);

        // 确保目录存在
        const dir = path.dirname(resolvedPath);
        await fs.mkdir(dir, { recursive: true });

        await fs.writeFile(resolvedPath, Buffer.from(buffer));

        clearTimeout(timeoutId);

        return {
          url: args.url,
          path: resolvedPath,
          size: buffer.byteLength,
          sizeFormatted: formatBytes(buffer.byteLength),
        };
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    },
  },

  // ============================================================================
  // URL 解析
  // ============================================================================
  {
    name: 'http_parse_url',
    displayName: 'Parse URL',
    description: '解析 URL 组件',
    category: 'network',
    tags: ['http', 'url', 'parse'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '要解析的URL',
        },
      },
      required: ['url'],
    },
    execute: async (args: { url: string }) => {
      const parsed = new URL(args.url);

      return {
        href: parsed.href,
        protocol: parsed.protocol,
        host: parsed.host,
        hostname: parsed.hostname,
        port: parsed.port,
        pathname: parsed.pathname,
        search: parsed.search,
        searchParams: Object.fromEntries(parsed.searchParams.entries()),
        hash: parsed.hash,
        origin: parsed.origin,
      };
    },
  },

  // ============================================================================
  // URL 构建
  // ============================================================================
  {
    name: 'http_build_url',
    displayName: 'Build URL',
    description: '构建 URL',
    category: 'network',
    tags: ['http', 'url', 'build'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        base: {
          type: 'string',
          description: '基础URL',
        },
        path: {
          type: 'string',
          description: '路径',
        },
        params: {
          type: 'object',
          description: '查询参数',
        },
      },
      required: ['base'],
    },
    execute: async (args: {
      base: string;
      path?: string;
      params?: Record<string, string>;
    }) => {
      const url = new URL(args.base);

      if (args.path) {
        url.pathname = args.path;
      }

      if (args.params) {
        for (const [key, value] of Object.entries(args.params)) {
          url.searchParams.set(key, value);
        }
      }

      return {
        url: url.toString(),
        parts: {
          protocol: url.protocol,
          host: url.host,
          pathname: url.pathname,
          search: url.search,
        },
      };
    },
  },

  // ============================================================================
  // 检查站点状态
  // ============================================================================
  {
    name: 'http_check',
    displayName: 'Check HTTP Status',
    description: '检查网站或API的可用性',
    category: 'network',
    tags: ['http', 'health', 'check', 'monitoring'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '要检查的URL',
        },
        expectedStatus: {
          type: 'number',
          description: '期望的HTTP状态码',
        },
        timeout: {
          type: 'number',
          description: '超时时间(秒)',
        },
      },
      required: ['url'],
    },
    execute: async (args: {
      url: string;
      expectedStatus?: number;
      timeout?: number;
    }) => {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        (args.timeout || 10) * 1000
      );

      try {
        const response = await fetch(args.url, {
          method: 'HEAD',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const latency = Date.now() - startTime;
        const expected = args.expectedStatus || 200;
        const healthy = response.status === expected;

        return {
          url: args.url,
          status: response.status,
          healthy,
          latencyMs: latency,
          expected: expected,
        };
      } catch (error) {
        clearTimeout(timeoutId);

        return {
          url: args.url,
          status: 0,
          healthy: false,
          latencyMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        };
      }
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

export default httpTools;
