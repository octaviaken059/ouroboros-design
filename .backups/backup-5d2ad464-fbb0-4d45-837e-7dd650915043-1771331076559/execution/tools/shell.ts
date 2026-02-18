/**
 * Shell 工具 (Shell Tools)
 * 
 * 命令执行和进程管理
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import type { ToolDefinition } from '../tool-registry.js';

const execAsync = promisify(exec);

// 危险命令黑名单
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,
  />\s*\/dev\/null.*\bor\b.*rm/,
  /:\(\)\{\s*:\|\:\&\s*\};/, // Fork bomb
  /mkfs\./,
  /dd\s+if=.*of=\/dev/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\binit\s+0\b/,
  /chmod\s+-R\s+777\s+\//,
  /\bcurl\b.*\|\s*\bsh\b/,
  /\bwget\b.*\|\s*\bsh\b/,
];

// 允许的命令白名单 (可选使用)
const ALLOWED_COMMANDS = [
  'ls', 'cat', 'echo', 'pwd', 'whoami', 'uname', 'date', 'which',
  'head', 'tail', 'grep', 'find', 'wc', 'sort', 'uniq', 'diff',
  'mkdir', 'touch', 'cp', 'mv', 'rm', 'rmdir',
  'git', 'npm', 'yarn', 'node', 'python', 'python3',
  'docker', 'docker-compose', 'kubectl',
  'curl', 'wget', 'ping', 'traceroute', 'netstat', 'ss',
  'ps', 'top', 'htop', 'free', 'df', 'du', 'uptime',
  'tar', 'gzip', 'gunzip', 'zip', 'unzip',
  'jq', 'awk', 'sed', 'cut', 'tr', 'xargs',
  'ssh', 'scp', 'rsync',
];

export const shellTools: ToolDefinition[] = [
  // ============================================================================
  // 执行命令
  // ============================================================================
  {
    name: 'shell_exec',
    displayName: 'Execute Shell Command',
    description: '执行 shell 命令，返回输出',
    category: 'system',
    tags: ['shell', 'exec', 'command'],
    permissionLevel: 'user',
    requireConfirmation: true,
    confirmationTemplate: '执行命令: {{command}}',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: '要执行的命令',
        },
        timeout: {
          type: 'number',
          description: '超时时间(秒)，默认30秒',
        },
        cwd: {
          type: 'string',
          description: '工作目录',
        },
        env: {
          type: 'object',
          description: '环境变量',
        },
        ignoreError: {
          type: 'boolean',
          description: '是否忽略错误',
        },
      },
      required: ['command'],
    },
    execute: async (args: {
      command: string;
      timeout?: number;
      cwd?: string;
      env?: Record<string, string>;
      ignoreError?: boolean;
    }) => {
      // 安全检查
      const command = args.command.trim();
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(command)) {
          throw new Error(`Dangerous command detected: ${pattern}`);
        }
      }

      const timeout = (args.timeout || 30) * 1000;

      try {
        const { stdout, stderr } = await execAsync(command, {
          timeout,
          cwd: args.cwd,
          env: { ...process.env, ...args.env },
          maxBuffer: 10 * 1024 * 1024, // 10MB
        });

        return {
          command,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: 0,
          success: true,
        };
      } catch (error: any) {
        if (args.ignoreError) {
          return {
            command,
            stdout: error.stdout?.trim() || '',
            stderr: error.stderr?.trim() || '',
            exitCode: error.code || 1,
            success: false,
            ignored: true,
          };
        }
        throw error;
      }
    },
  },

  // ============================================================================
  // 执行命令 (流式)
  // ============================================================================
  {
    name: 'shell_spawn',
    displayName: 'Spawn Process',
    description: '启动进程并获取实时输出',
    category: 'system',
    tags: ['shell', 'spawn', 'process', 'streaming'],
    permissionLevel: 'user',
    requireConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: '命令',
        },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: '命令参数',
        },
        cwd: {
          type: 'string',
          description: '工作目录',
        },
        timeout: {
          type: 'number',
          description: '超时时间(秒)',
        },
      },
      required: ['command'],
    },
    execute: async (args: {
      command: string;
      args?: string[];
      cwd?: string;
      timeout?: number;
    }) => {
      return new Promise((resolve, reject) => {
        const command = args.command;
        const commandArgs = args.args || [];

        // 安全检查
        for (const pattern of DANGEROUS_PATTERNS) {
          if (pattern.test(command)) {
            reject(new Error(`Dangerous command detected`));
            return;
          }
        }

        const child = spawn(command, commandArgs, {
          cwd: args.cwd,
          shell: true,
        });

        let stdout = '';
        let stderr = '';
        let killed = false;

        // 收集输出
        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        // 超时处理
        const timeoutId = args.timeout
          ? setTimeout(() => {
              killed = true;
              child.kill('SIGTERM');
              setTimeout(() => child.kill('SIGKILL'), 5000);
            }, args.timeout * 1000)
          : null;

        // 进程结束
        child.on('close', (code) => {
          if (timeoutId) clearTimeout(timeoutId);

          resolve({
            command: `${command} ${commandArgs.join(' ')}`.trim(),
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: code,
            killed,
            success: code === 0,
          });
        });

        child.on('error', (error) => {
          if (timeoutId) clearTimeout(timeoutId);
          reject(error);
        });
      });
    },
  },

  // ============================================================================
  // 管道命令
  // ============================================================================
  {
    name: 'shell_pipe',
    displayName: 'Pipe Commands',
    description: '执行管道命令 (cmd1 | cmd2 | cmd3)',
    category: 'system',
    tags: ['shell', 'pipe'],
    permissionLevel: 'user',
    requireConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        commands: {
          type: 'array',
          items: { type: 'string' },
          description: '命令列表',
        },
        timeout: {
          type: 'number',
          description: '超时时间(秒)',
        },
      },
      required: ['commands'],
    },
    execute: async (args: {
      commands: string[];
      timeout?: number;
    }) => {
      const pipeline = args.commands.join(' | ');

      // 安全检查
      for (const cmd of args.commands) {
        for (const pattern of DANGEROUS_PATTERNS) {
          if (pattern.test(cmd)) {
            throw new Error(`Dangerous command detected in pipeline`);
          }
        }
      }

      const timeout = (args.timeout || 30) * 1000;

      const { stdout, stderr } = await execAsync(pipeline, {
        timeout,
        maxBuffer: 10 * 1024 * 1024,
      });

      return {
        pipeline,
        commands: args.commands,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        success: true,
      };
    },
  },

  // ============================================================================
  // 检查命令是否存在
  // ============================================================================
  {
    name: 'shell_which',
    displayName: 'Which Command',
    description: '检查命令是否存在并获取路径',
    category: 'system',
    tags: ['shell', 'which', 'check'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: '命令名称',
        },
      },
      required: ['command'],
    },
    execute: async (args: { command: string }) => {
      try {
        const { stdout } = await execAsync(`which ${args.command}`);
        return {
          command: args.command,
          exists: true,
          path: stdout.trim(),
        };
      } catch {
        return {
          command: args.command,
          exists: false,
          path: null,
        };
      }
    },
  },

  // ============================================================================
  // 列出进程
  // ============================================================================
  {
    name: 'shell_ps',
    displayName: 'Process List',
    description: '列出系统进程',
    category: 'system',
    tags: ['shell', 'process', 'ps'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: '进程名过滤',
        },
      },
      required: [],
    },
    execute: async (args: { filter?: string }) => {
      let command: string;

      if (process.platform === 'darwin' || process.platform === 'linux') {
        command = 'ps aux';
        if (args.filter) {
          command += ` | grep ${args.filter}`;
        }
      } else {
        command = 'tasklist';
        if (args.filter) {
          command += ` /FI "IMAGENAME eq ${args.filter}"`;
        }
      }

      const { stdout } = await execAsync(command, { timeout: 10000 });

      return {
        output: stdout,
        filtered: !!args.filter,
        platform: process.platform,
      };
    },
  },

  // ============================================================================
  // 工作目录操作
  // ============================================================================
  {
    name: 'shell_pwd',
    displayName: 'Print Working Directory',
    description: '获取当前工作目录',
    category: 'system',
    tags: ['shell', 'pwd', 'directory'],
    permissionLevel: 'public',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      return {
        cwd: process.cwd(),
        home: process.env.HOME,
        temp: process.env.TMPDIR || '/tmp',
      };
    },
  },

  // ============================================================================
  // 切换目录
  // ============================================================================
  {
    name: 'shell_cd',
    displayName: 'Change Directory',
    description: '切换工作目录',
    category: 'system',
    tags: ['shell', 'cd', 'directory'],
    permissionLevel: 'user',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '目标目录路径',
        },
      },
      required: ['path'],
    },
    execute: async (args: { path: string }) => {
      const previous = process.cwd();
      process.chdir(args.path);

      return {
        previous,
        current: process.cwd(),
      };
    },
  },
];

export default shellTools;
