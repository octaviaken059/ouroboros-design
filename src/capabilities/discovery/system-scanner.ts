/**
 * @file capabilities/discovery/system-scanner.ts
 * @description 系统能力扫描器 - 自动发现系统工具和资源
 * @author Ouroboros
 * @date 2026-02-19
 */

import { execSync } from 'child_process';
import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger('SystemScanner');

/** 扫描选项 */
export interface SystemScannerOptions {
  /** 额外扫描路径 */
  extraPaths?: string[];
  /** 是否扫描全局安装 */
  scanGlobal?: boolean;
  /** 是否扫描项目本地 */
  scanLocal?: boolean;
}

/** 系统工具定义 */
export interface SystemToolDefinition {
  /** 工具名称 */
  name: string;
  /** 检测命令 */
  checkCommand: string;
  /** 版本命令 */
  versionCommand: string;
  /** 工具描述 */
  description: string;
  /** 工具类别 */
  category: 'media' | 'development' | 'system' | 'network' | 'data' | 'ai';
  /** 参数定义 */
  parameters: Record<string, { type: string; required: boolean; description: string }>;
  /** 执行包装器 */
  executeWrapper: (command: string, args: string[]) => Promise<unknown>;
}

/** 扫描结果 */
export interface SystemScanResult {
  /** 扫描时间 */
  scanTime: string;
  /** 发现的工具 */
  discoveredTools: DiscoveredSystemTool[];
  /** 系统信息 */
  systemInfo: {
    platform: string;
    arch: string;
    nodeVersion: string;
    shell: string;
  };
  /** 环境变量 */
  environment: Record<string, string>;
}

/** 发现的系统工具 */
export interface DiscoveredSystemTool {
  /** 工具定义 */
  definition: SystemToolDefinition;
  /** 是否可用 */
  available: boolean;
  /** 版本 */
  version?: string | undefined;
  /** 路径 */
  path?: string | undefined;
  /** 检测时间 */
  detectedAt: string;
}

/**
 * 系统扫描器
 * 
 * 自动扫描系统环境，发现可用工具和资源
 */
export class SystemScanner {
  private options: SystemScannerOptions;
  private discoveredTools = new Map<string, DiscoveredSystemTool>();

  // 预定义的系统工具列表
  private static readonly SYSTEM_TOOLS: SystemToolDefinition[] = [
    // 媒体处理工具
    {
      name: 'ffmpeg',
      checkCommand: 'which ffmpeg || where ffmpeg',
      versionCommand: 'ffmpeg -version',
      description: '音视频处理工具 - 转换、剪辑、提取帧',
      category: 'media',
      parameters: {
        input: { type: 'string', required: true, description: '输入文件路径' },
        output: { type: 'string', required: true, description: '输出文件路径' },
        options: { type: 'string', required: false, description: '额外选项' },
      },
      executeWrapper: async (command, args) => {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        const result = await execFileAsync(command, args);
        return { result: result.stdout, stderr: result.stderr };
      },
    },
    {
      name: 'ffprobe',
      checkCommand: 'which ffprobe || where ffprobe',
      versionCommand: 'ffprobe -version',
      description: '音视频元数据探测工具',
      category: 'media',
      parameters: {
        input: { type: 'string', required: true, description: '输入文件路径' },
        format: { type: 'string', required: false, description: '输出格式 (json/xml)' },
      },
      executeWrapper: async (command, args) => {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        const result = await execFileAsync(command, args);
        return { result: result.stdout };
      },
    },
    // 开发工具
    {
      name: 'node',
      checkCommand: 'node --version',
      versionCommand: 'node --version',
      description: 'Node.js 运行时',
      category: 'development',
      parameters: {
        script: { type: 'string', required: true, description: '脚本路径或代码' },
        args: { type: 'array', required: false, description: '脚本参数' },
      },
      executeWrapper: async (command, args) => {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        const result = await execFileAsync(command, args);
        return { result: result.stdout };
      },
    },
    {
      name: 'python',
      checkCommand: 'python3 --version || python --version',
      versionCommand: 'python3 --version || python --version',
      description: 'Python 运行时',
      category: 'development',
      parameters: {
        script: { type: 'string', required: true, description: 'Python 脚本或代码' },
        args: { type: 'array', required: false, description: '脚本参数' },
      },
      executeWrapper: async (command, args) => {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        const result = await execFileAsync(command, args);
        return { result: result.stdout };
      },
    },
    {
      name: 'git',
      checkCommand: 'git --version',
      versionCommand: 'git --version',
      description: '版本控制工具',
      category: 'development',
      parameters: {
        command: { type: 'string', required: true, description: 'Git 命令' },
        args: { type: 'array', required: false, description: '额外参数' },
      },
      executeWrapper: async (command, args) => {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        const result = await execFileAsync(command, args);
        return { result: result.stdout };
      },
    },
    {
      name: 'docker',
      checkCommand: 'docker --version',
      versionCommand: 'docker --version',
      description: '容器化平台',
      category: 'development',
      parameters: {
        command: { type: 'string', required: true, description: 'Docker 命令' },
        options: { type: 'object', required: false, description: '命令选项' },
      },
      executeWrapper: async (command, args) => {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        const result = await execFileAsync(command, args);
        return { result: result.stdout };
      },
    },
    // 系统工具
    {
      name: 'curl',
      checkCommand: 'curl --version',
      versionCommand: 'curl --version',
      description: 'HTTP 客户端',
      category: 'network',
      parameters: {
        url: { type: 'string', required: true, description: '请求 URL' },
        method: { type: 'string', required: false, description: 'HTTP 方法' },
        headers: { type: 'object', required: false, description: '请求头' },
        data: { type: 'string', required: false, description: '请求体' },
      },
      executeWrapper: async (command, args) => {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        const result = await execFileAsync(command, args);
        return { result: result.stdout };
      },
    },
    {
      name: 'wget',
      checkCommand: 'wget --version',
      versionCommand: 'wget --version',
      description: '文件下载工具',
      category: 'network',
      parameters: {
        url: { type: 'string', required: true, description: '下载 URL' },
        output: { type: 'string', required: false, description: '输出路径' },
      },
      executeWrapper: async (command, args) => {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        const result = await execFileAsync(command, args);
        return { result: result.stdout };
      },
    },
    // 数据处理
    {
      name: 'sqlite3',
      checkCommand: 'sqlite3 --version',
      versionCommand: 'sqlite3 --version',
      description: 'SQLite 数据库 CLI',
      category: 'data',
      parameters: {
        database: { type: 'string', required: true, description: '数据库路径' },
        query: { type: 'string', required: true, description: 'SQL 查询' },
      },
      executeWrapper: async (command, args) => {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        const result = await execFileAsync(command, args);
        return { result: result.stdout };
      },
    },
    // AI 工具
    {
      name: 'ollama',
      checkCommand: 'ollama --version',
      versionCommand: 'ollama --version',
      description: '本地大模型运行环境',
      category: 'ai',
      parameters: {
        model: { type: 'string', required: true, description: '模型名称' },
        prompt: { type: 'string', required: true, description: '提示词' },
      },
      executeWrapper: async (command, args) => {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        const result = await execFileAsync(command, args);
        return { result: result.stdout };
      },
    },
  ];

  constructor(options: SystemScannerOptions = {}) {
    this.options = {
      scanGlobal: true,
      scanLocal: true,
      extraPaths: [],
      ...options,
    };
  }

  /**
   * 执行完整扫描
   */
  async scan(): Promise<SystemScanResult> {
    logger.info('Starting system capability scan...');
    logger.debug(`Scan options: global=${this.options.scanGlobal}, local=${this.options.scanLocal}`);

    const result: SystemScanResult = {
      scanTime: new Date().toISOString(),
      discoveredTools: [],
      systemInfo: this.getSystemInfo(),
      environment: this.getEnvironmentVars(),
    };

    // 扫描每个预定义工具
    for (const toolDef of SystemScanner.SYSTEM_TOOLS) {
      const discovered = await this.checkTool(toolDef);
      this.discoveredTools.set(toolDef.name, discovered);
      result.discoveredTools.push(discovered);
    }

    const availableCount = result.discoveredTools.filter(t => t.available).length;
    logger.info(`System scan complete: ${availableCount}/${result.discoveredTools.length} tools available`);

    return result;
  }

  /**
   * 检查单个工具
   */
  private async checkTool(definition: SystemToolDefinition): Promise<DiscoveredSystemTool> {
    const discovered: DiscoveredSystemTool = {
      definition,
      available: false,
      detectedAt: new Date().toISOString(),
    };

    try {
      // 检查工具是否存在
      const checkResult = this.executeCommand(definition.checkCommand);
      
      if (checkResult.success) {
        discovered.available = true;
        discovered.path = checkResult.stdout.trim().split('\n')[0];

        // 获取版本信息
        try {
          const versionResult = this.executeCommand(definition.versionCommand);
          if (versionResult.success) {
            discovered.version = this.extractVersion(versionResult.stdout);
          }
        } catch {
          // 版本获取失败不影响可用性
        }

        logger.debug(`Tool available: ${definition.name} ${discovered.version || ''}`);
      }
    } catch (error) {
      logger.debug(`Tool not available: ${definition.name}`);
    }

    return discovered;
  }

  /**
   * 执行命令
   */
  private executeCommand(command: string): { success: boolean; stdout: string; stderr: string } {
    try {
      const stdout = execSync(command, {
        encoding: 'utf-8',
        timeout: 5000,
        windowsHide: true,
      });
      return { success: true, stdout, stderr: '' };
    } catch (error) {
      if (error instanceof Error && 'stdout' in error) {
        const execError = error as { stdout?: string; stderr?: string };
        return { 
          success: false, 
          stdout: execError.stdout || '', 
          stderr: execError.stderr || '' 
        };
      }
      return { success: false, stdout: '', stderr: String(error) };
    }
  }

  /**
   * 提取版本号
   */
  private extractVersion(output: string): string | undefined {
    // 常见版本格式匹配
    const patterns = [
      /version\s+(\d+\.\d+(?:\.\d+)?)/i,
      /(\d+\.\d+(?:\.\d+)?)/,
      /v(\d+\.\d+(?:\.\d+)?)/i,
    ];

    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * 获取系统信息
   */
  private getSystemInfo(): SystemScanResult['systemInfo'] {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      shell: process.env.SHELL || process.env.ComSpec || 'unknown',
    };
  }

  /**
   * 获取相关环境变量
   */
  private getEnvironmentVars(): Record<string, string> {
    const relevantVars = [
      'PATH',
      'HOME',
      'USER',
      'SHELL',
      'NODE_ENV',
      'OLLAMA_HOST',
      'DOCKER_HOST',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
    ];

    const env: Record<string, string> = {};
    for (const key of relevantVars) {
      if (process.env[key]) {
        // 对敏感信息脱敏
        if (key.includes('KEY') || key.includes('TOKEN') || key.includes('SECRET')) {
          env[key] = '***configured***';
        } else {
          env[key] = process.env[key]!;
        }
      }
    }

    return env;
  }

  /**
   * 获取发现的工具
   */
  getDiscoveredTools(): DiscoveredSystemTool[] {
    return Array.from(this.discoveredTools.values());
  }

  /**
   * 获取可用的工具
   */
  getAvailableTools(): DiscoveredSystemTool[] {
    return this.getDiscoveredTools().filter(t => t.available);
  }

  /**
   * 按类别获取工具
   */
  getToolsByCategory(category: SystemToolDefinition['category']): DiscoveredSystemTool[] {
    return this.getDiscoveredTools().filter(
      t => t.definition.category === category && t.available
    );
  }

  /**
   * 转换为内部工具格式
   */
  convertToInternalTools(): Array<{
    id: string;
    name: string;
    description: string;
    type: string;
    parameters: Record<string, { type: string; required: boolean; description: string }>;
    execute: (args: Record<string, unknown>) => Promise<unknown>;
    successCount: number;
    failureCount: number;
  }> {
    return this.getAvailableTools().map(discovered => ({
      id: discovered.definition.name,
      name: discovered.definition.name,
      description: discovered.definition.description,
      type: discovered.definition.category,
      parameters: discovered.definition.parameters,
      execute: async (args: Record<string, unknown>) => {
        const argsArray = this.buildArgsArray(discovered.definition.name, args);
        return discovered.definition.executeWrapper(
          discovered.definition.name,
          argsArray
        );
      },
      successCount: 0,
      failureCount: 0,
    }));
  }

  /**
   * 构建命令参数数组
   */
  private buildArgsArray(
    toolName: string,
    args: Record<string, unknown>
  ): string[] {
    const argsArray: string[] = [];

    switch (toolName) {
      case 'ffmpeg':
        if (args.options) argsArray.push(...String(args.options).split(' '));
        if (args.input) argsArray.push('-i', String(args.input));
        if (args.output) argsArray.push(String(args.output));
        break;
      
      case 'python':
        if (args.script) {
          if (String(args.script).endsWith('.py')) {
            argsArray.push(String(args.script));
          } else {
            argsArray.push('-c', String(args.script));
          }
        }
        if (args.args) {
          argsArray.push(...(args.args as string[]));
        }
        break;
      
      case 'node':
        if (args.script) {
          if (String(args.script).endsWith('.js') || String(args.script).endsWith('.ts')) {
            argsArray.push(String(args.script));
          } else {
            argsArray.push('-e', String(args.script));
          }
        }
        if (args.args) {
          argsArray.push(...(args.args as string[]));
        }
        break;
      
      default:
        // 通用参数传递
        for (const [, value] of Object.entries(args)) {
          if (value !== undefined && value !== null) {
            if (Array.isArray(value)) {
              argsArray.push(...value.map(String));
            } else {
              argsArray.push(String(value));
            }
          }
        }
    }

    return argsArray;
  }

  /**
   * 检查特定工具是否可用
   */
  isToolAvailable(toolName: string): boolean {
    const tool = this.discoveredTools.get(toolName);
    return tool?.available || false;
  }

  /**
   * 获取工具版本
   */
  getToolVersion(toolName: string): string | undefined {
    return this.discoveredTools.get(toolName)?.version;
  }
}

/**
 * 便捷函数：创建扫描器并执行扫描
 */
export async function scanSystemCapabilities(
  options?: SystemScannerOptions
): Promise<SystemScanResult> {
  const scanner = new SystemScanner(options);
  return scanner.scan();
}
