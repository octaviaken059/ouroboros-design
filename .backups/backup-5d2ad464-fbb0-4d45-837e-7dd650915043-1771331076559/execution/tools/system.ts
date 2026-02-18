/**
 * 系统工具 (System Tools)
 * 
 * 系统级操作和信息查询
 */

import * as os from 'os';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';
import type { ToolDefinition, ToolContext } from '../tool-registry.js';

export const systemTools: ToolDefinition[] = [
  // ============================================================================
  // 系统信息
  // ============================================================================
  {
    name: 'sys_info',
    displayName: 'System Info',
    description: '获取系统基本信息，包括平台、架构、主机名等',
    category: 'system',
    tags: ['system', 'info', 'os'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        detail: {
          type: 'string',
          description: '信息详细程度: basic, full',
          enum: ['basic', 'full'],
        },
      },
      required: [],
    },
    execute: async (args: { detail?: string }) => {
      const detail = args.detail || 'basic';

      const basic = {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        release: os.release(),
        type: os.type(),
      };

      if (detail === 'basic') {
        return basic;
      }

      return {
        ...basic,
        uptime: os.uptime(),
        loadavg: os.loadavg(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        cpus: os.cpus().length,
        userInfo: os.userInfo(),
        networkInterfaces: Object.keys(os.networkInterfaces()),
      };
    },
  },

  // ============================================================================
  // 内存状态
  // ============================================================================
  {
    name: 'sys_memory',
    displayName: 'Memory Status',
    description: '获取系统内存使用情况',
    category: 'system',
    tags: ['system', 'memory', 'resources'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      const total = os.totalmem();
      const free = os.freemem();
      const used = total - free;

      return {
        total,
        free,
        used,
        percentage: Math.round((used / total) * 100),
        totalGB: (total / 1024 / 1024 / 1024).toFixed(2),
        freeGB: (free / 1024 / 1024 / 1024).toFixed(2),
        usedGB: (used / 1024 / 1024 / 1024).toFixed(2),
      };
    },
  },

  // ============================================================================
  // CPU 信息
  // ============================================================================
  {
    name: 'sys_cpu',
    displayName: 'CPU Info',
    description: '获取 CPU 信息和负载',
    category: 'system',
    tags: ['system', 'cpu', 'resources'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      const cpus = os.cpus();
      const loadAvg = os.loadavg();

      return {
        count: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        speed: cpus[0]?.speed || 0,
        loadAverage: {
          '1m': loadAvg[0],
          '5m': loadAvg[1],
          '15m': loadAvg[2],
        },
      };
    },
  },

  // ============================================================================
  // 磁盘使用
  // ============================================================================
  {
    name: 'sys_disk',
    displayName: 'Disk Usage',
    description: '获取磁盘使用情况 (df -h 风格)',
    category: 'system',
    tags: ['system', 'disk', 'storage'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '检查路径，默认为当前目录',
        },
      },
      required: [],
    },
    execute: async (args: { path?: string }, context: ToolContext) => {
      const targetPath = args.path || process.cwd();

      try {
        // 使用 df 命令获取磁盘信息
        const output = execSync(`df -h "${targetPath}"`, {
          encoding: 'utf-8',
          timeout: 5000,
        });

        const lines = output.trim().split('\n');
        const dataLine = lines[1] || lines[0];
        const parts = dataLine.split(/\s+/);

        if (parts.length >= 6) {
          return {
            filesystem: parts[0],
            size: parts[1],
            used: parts[2],
            available: parts[3],
            usePercentage: parts[4],
            mountedOn: parts[5],
          };
        }

        return { raw: output };
      } catch (error) {
        return {
          error: 'Failed to get disk info',
          path: targetPath,
        };
      }
    },
  },

  // ============================================================================
  // 进程信息
  // ============================================================================
  {
    name: 'sys_process',
    displayName: 'Process Info',
    description: '获取当前进程信息 (自指特性)',
    category: 'system',
    tags: ['system', 'process', 'self'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        detailed: {
          type: 'boolean',
          description: '是否获取详细信息',
        },
      },
      required: [],
    },
    execute: async (args: { detailed?: boolean }) => {
      const memUsage = process.memoryUsage();

      const basic = {
        pid: process.pid,
        ppid: process.ppid,
        title: process.title,
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
        cwd: process.cwd(),
        execPath: process.execPath,
      };

      if (!args.detailed) {
        return basic;
      }

      return {
        ...basic,
        memory: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external,
          arrayBuffers: memUsage.arrayBuffers,
          rssMB: (memUsage.rss / 1024 / 1024).toFixed(2),
          heapUsedMB: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
        },
        versions: process.versions,
        env: {
          NODE_ENV: process.env.NODE_ENV,
          PATH: process.env.PATH?.split(':').length,
          HOME: process.env.HOME,
          USER: process.env.USER,
        },
      };
    },
  },

  // ============================================================================
  // 环境变量
  // ============================================================================
  {
    name: 'sys_env',
    displayName: 'Environment Variables',
    description: '获取环境变量 (安全的子集)',
    category: 'system',
    tags: ['system', 'env', 'config'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '指定变量名，不提供则返回常用变量',
        },
      },
      required: [],
    },
    execute: async (args: { name?: string }) => {
      if (args.name) {
        return {
          name: args.name,
          value: process.env[args.name] || null,
        };
      }

      // 只返回安全的、非敏感的变量
      const safeKeys = [
        'NODE_ENV',
        'HOME',
        'USER',
        'SHELL',
        'LANG',
        'PWD',
        'TERM',
        'EDITOR',
        'HOSTNAME',
        'PLATFORM',
      ];

      const env: Record<string, string | undefined> = {};
      for (const key of safeKeys) {
        if (process.env[key]) {
          env[key] = process.env[key];
        }
      }

      return env;
    },
  },

  // ============================================================================
  // 时间信息
  // ============================================================================
  {
    name: 'sys_time',
    displayName: 'Time Info',
    description: '获取系统时间和时区信息',
    category: 'system',
    tags: ['system', 'time', 'datetime'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          description: '时间格式: iso, unix, locale',
          enum: ['iso', 'unix', 'locale'],
        },
      },
      required: [],
    },
    execute: async (args: { format?: string }) => {
      const now = new Date();
      const format = args.format || 'iso';

      const formats: Record<string, string | number> = {
        iso: now.toISOString(),
        unix: Math.floor(now.getTime() / 1000),
        locale: now.toLocaleString(),
      };

      return {
        now: formats[format] || now.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        offset: now.getTimezoneOffset(),
        timestamp: now.getTime(),
        utc: now.toUTCString(),
        local: now.toString(),
      };
    },
  },

  // ============================================================================
  // 读取 /proc/self (Linux 自指特性)
  // ============================================================================
  {
    name: 'sys_self',
    displayName: 'Self Reference',
    description: '读取 /proc/self 实现自指监控 (Linux only)',
    category: 'system',
    tags: ['system', 'self', 'ouroboros', 'proc'],
    permissionLevel: 'user',
    parameters: {
      type: 'object',
      properties: {
        info: {
          type: 'string',
          description: '自指信息类型',
          enum: ['status', 'limits', 'stat', 'cmdline', 'environ'],
        },
      },
      required: [],
    },
    execute: async (args: { info?: string }) => {
      const info = args.info || 'status';

      if (process.platform !== 'linux') {
        return {
          error: 'Self-reference via /proc/self is only available on Linux',
          platform: process.platform,
        };
      }

      try {
        const procPath = `/proc/self/${info}`;
        const content = await fs.readFile(procPath, 'utf-8');

        if (info === 'status') {
          // 解析状态文件
          const lines = content.split('\n');
          const parsed: Record<string, string> = {};
          for (const line of lines) {
            const [key, value] = line.split(':');
            if (key && value) {
              parsed[key.trim()] = value.trim();
            }
          }
          return { raw: content, parsed };
        }

        if (info === 'environ') {
          // 解析环境变量
          const vars = content.split('\0').filter(Boolean);
          return { count: vars.length, variables: vars.slice(0, 20) };
        }

        if (info === 'cmdline') {
          // 解析命令行参数
          const args = content.split('\0').filter(Boolean);
          return { arguments: args };
        }

        return { raw: content.substring(0, 10000) };
      } catch (error) {
        return {
          error: 'Failed to read self info',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  },

  // ============================================================================
  // 系统负载检查
  // ============================================================================
  {
    name: 'sys_health',
    displayName: 'System Health',
    description: '检查系统健康状态 (稳态保护)',
    category: 'system',
    tags: ['system', 'health', 'homeostasis', 'monitoring'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        thresholds: {
          type: 'object',
          description: '健康阈值',
          properties: {
            cpuPercent: { type: 'number', description: 'CPU 使用率阈值' },
            memoryPercent: { type: 'number', description: '内存使用率阈值' },
          },
        },
      },
      required: [],
    },
    execute: async (args: { thresholds?: { cpuPercent?: number; memoryPercent?: number } }) => {
      const thresholds = {
        cpuPercent: args.thresholds?.cpuPercent || 80,
        memoryPercent: args.thresholds?.memoryPercent || 85,
      };

      const memTotal = os.totalmem();
      const memFree = os.freemem();
      const memUsed = memTotal - memFree;
      const memPercent = (memUsed / memTotal) * 100;

      const loadAvg = os.loadavg();
      const cpuCount = os.cpus().length;
      const cpuPercent = (loadAvg[0] / cpuCount) * 100;

      const status: 'healthy' | 'warning' | 'critical' =
        memPercent > thresholds.memoryPercent || cpuPercent > thresholds.cpuPercent
          ? 'critical'
          : memPercent > thresholds.memoryPercent * 0.8 || cpuPercent > thresholds.cpuPercent * 0.8
          ? 'warning'
          : 'healthy';

      return {
        status,
        timestamp: new Date().toISOString(),
        metrics: {
          cpu: {
            loadAverage: loadAvg,
            percent: Math.round(cpuPercent),
            count: cpuCount,
          },
          memory: {
            total: memTotal,
            free: memFree,
            used: memUsed,
            percent: Math.round(memPercent),
          },
        },
        thresholds,
        recommendations: status === 'critical'
          ? ['⚠️ 系统资源紧张，建议降低任务负载', '考虑重启或优化内存使用']
          : status === 'warning'
          ? ['⚡ 资源使用较高，建议监控']
          : ['✅ 系统健康'],
      };
    },
  },
];

export default systemTools;
