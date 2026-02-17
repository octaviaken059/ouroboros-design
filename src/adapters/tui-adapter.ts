/**
 * TUI Adapter - 终端交互界面适配器
 * 
 * 功能：
 * - 终端交互界面
 * - 命令行处理
 * - 实时状态显示
 * - 日志展示
 * - 交互式命令提示
 */

import readline from 'readline';
import { EventEmitter } from 'events';
import os from 'os';

export interface TUIAdapterConfig {
  prompt?: string;
  enableColors?: boolean;
  enableHistory?: boolean;
  historySize?: number;
  showTimestamps?: boolean;
}

export interface TUICommand {
  name: string;
  description: string;
  usage?: string;
  aliases?: string[];
  handler: (args: string[]) => Promise<void> | void;
  hidden?: boolean;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

export interface IUnifiedAgent {
  handleCommand(command: string, args: string[]): Promise<unknown>;
  getSystemStatus(): Record<string, unknown>;
  getHealthStatus(): { status: string; components: Record<string, string> };
}

export class TUIAdapter extends EventEmitter {
  private rl: readline.Interface | null = null;
  private config: Required<TUIAdapterConfig>;
  private agent: IUnifiedAgent;
  private commands: Map<string, TUICommand> = new Map();
  private commandAliases: Map<string, string> = new Map();
  private history: string[] = [];
  private isRunning = false;
  private originalStdout: NodeJS.WriteStream | null = null;

  // ANSI颜色代码
  private readonly colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
  };

  constructor(agent: IUnifiedAgent, config: TUIAdapterConfig = {}) {
    super();
    this.agent = agent;
    this.config = {
      prompt: 'ouro> ',
      enableColors: true,
      enableHistory: true,
      historySize: 1000,
      showTimestamps: false,
      ...config,
    };

    this.setupBuiltInCommands();
  }

  /**
   * 获取带颜色的文本
   */
  private colorize(text: string, color: keyof typeof this.colors): string {
    if (!this.config.enableColors) return text;
    return `${this.colors[color]}${text}${this.colors.reset}`;
  }

  /**
   * 设置内置命令
   */
  private setupBuiltInCommands(): void {
    // 帮助命令
    this.registerCommand({
      name: 'help',
      description: '显示帮助信息',
      aliases: ['h', '?'],
      handler: () => this.showHelp(),
    });

    // 退出命令
    this.registerCommand({
      name: 'exit',
      description: '退出TUI',
      aliases: ['quit', 'q'],
      handler: () => this.stop(),
    });

    // 状态命令
    this.registerCommand({
      name: 'status',
      description: '显示系统状态',
      aliases: ['st'],
      handler: () => this.showStatus(),
    });

    // 健康检查
    this.registerCommand({
      name: 'health',
      description: '显示健康状态',
      aliases: ['he'],
      handler: () => this.showHealth(),
    });

    // 清屏
    this.registerCommand({
      name: 'clear',
      description: '清屏',
      aliases: ['cls'],
      handler: () => {
        console.clear();
        this.showBanner();
      },
    });

    // 内存信息
    this.registerCommand({
      name: 'memory',
      description: '显示内存使用情况',
      aliases: ['mem'],
      handler: () => this.showMemory(),
    });

    // 系统信息
    this.registerCommand({
      name: 'sysinfo',
      description: '显示系统信息',
      aliases: ['sys'],
      handler: () => this.showSysInfo(),
    });

    // 历史命令
    this.registerCommand({
      name: 'history',
      description: '显示命令历史',
      aliases: ['hist'],
      handler: (args) => this.showHistory(args),
    });

    // 回声命令（测试用）
    this.registerCommand({
      name: 'echo',
      description: '回显输入内容',
      handler: (args) => {
        this.log('info', args.join(' '));
      },
    });
  }

  /**
   * 启动TUI
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // 创建readline接口
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.colorize(this.config.prompt, 'cyan'),
      history: this.config.enableHistory ? this.history : undefined,
      historySize: this.config.historySize,
      completer: this.commandCompleter.bind(this),
    });

    // 设置事件处理
    this.rl.on('line', this.handleInput.bind(this));
    this.rl.on('close', () => {
      this.emit('close');
      this.stop();
    });

    // 处理SIGINT
    process.on('SIGINT', () => {
      this.stop();
    });

    // 显示欢迎信息
    this.showBanner();
    this.rl.prompt();

    console.log(this.colorize('✅ TUI Adapter started', 'green'));
    this.emit('started');
  }

  /**
   * 停止TUI
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    console.log(this.colorize('\n👋 Goodbye!', 'yellow'));

    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }

    this.emit('stopped');
    process.exit(0);
  }

  /**
   * 显示欢迎横幅
   */
  private showBanner(): void {
    const banner = `
${this.colorize('╔══════════════════════════════════════════╗', 'magenta')}
${this.colorize('║', 'magenta')}  🐍⭕ ${this.colorize('Ouroboros', 'bright')} - 具身自指进化AI Agent  ${this.colorize('║', 'magenta')}
${this.colorize('╚══════════════════════════════════════════╝', 'magenta')}

${this.colorize('输入 "help" 查看可用命令', 'gray')}
${this.colorize('输入 "exit" 或按 Ctrl+C 退出', 'gray')}
`;
    console.log(banner);
  }

  /**
   * 命令补全
   */
  private commandCompleter(line: string): [string[], string] {
    const commands = Array.from(this.commands.keys());
    const hits = commands.filter((cmd) => cmd.startsWith(line.toLowerCase()));
    return [hits.length ? hits : commands, line];
  }

  /**
   * 处理用户输入
   */
  private async handleInput(input: string): Promise<void> {
    const trimmed = input.trim();
    
    if (!trimmed) {
      this.rl?.prompt();
      return;
    }

    // 保存历史
    if (this.config.enableHistory && !this.history.includes(trimmed)) {
      this.history.push(trimmed);
      if (this.history.length > this.config.historySize) {
        this.history.shift();
      }
    }

    // 解析命令
    const parts = trimmed.split(/\s+/);
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    // 查找命令
    let command = this.commands.get(commandName);
    
    // 检查别名
    if (!command) {
      const aliasedName = this.commandAliases.get(commandName);
      if (aliasedName) {
        command = this.commands.get(aliasedName);
      }
    }

    if (command) {
      try {
        await command.handler(args);
      } catch (error) {
        this.log('error', `Command failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // 尝试通过Agent处理未知命令
      try {
        const result = await this.agent.handleCommand(commandName, args);
        if (result !== undefined) {
          this.log('info', JSON.stringify(result, null, 2));
        }
      } catch (error) {
        this.log('error', `Unknown command: ${commandName}`);
        this.log('info', `Type "help" for available commands`);
      }
    }

    if (this.rl && this.isRunning) {
      this.rl.prompt();
    }
  }

  /**
   * 注册命令
   */
  registerCommand(command: TUICommand): void {
    this.commands.set(command.name, command);

    // 注册别名
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.commandAliases.set(alias, command.name);
      }
    }
  }

  /**
   * 注销命令
   */
  unregisterCommand(name: string): void {
    const command = this.commands.get(name);
    if (command?.aliases) {
      for (const alias of command.aliases) {
        this.commandAliases.delete(alias);
      }
    }
    this.commands.delete(name);
  }

  /**
   * 显示帮助
   */
  private showHelp(): void {
    console.log(`\n${this.colorize('可用命令:', 'bright')}`);
    console.log(this.colorize('─'.repeat(50), 'gray'));

    const sortedCommands = Array.from(this.commands.values())
      .filter((cmd) => !cmd.hidden)
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const cmd of sortedCommands) {
      const aliasStr = cmd.aliases?.length 
        ? ` (${this.colorize(cmd.aliases.join(', '), 'gray')})` 
        : '';
      console.log(`  ${this.colorize(cmd.name, 'green')}${aliasStr}`);
      console.log(`      ${cmd.description}`);
      if (cmd.usage) {
        console.log(`      ${this.colorize('用法:', 'gray')} ${cmd.usage}`);
      }
    }

    console.log(this.colorize('─'.repeat(50), 'gray'));
    console.log();
  }

  /**
   * 显示系统状态
   */
  private async showStatus(): Promise<void> {
    try {
      const status = this.agent.getSystemStatus();
      
      console.log(`\n${this.colorize('系统状态:', 'bright')}`);
      console.log(this.colorize('─'.repeat(40), 'gray'));
      
      for (const [key, value] of Object.entries(status)) {
        const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
        if (typeof value === 'object') {
          console.log(`${this.colorize(formattedKey + ':', 'cyan')}`);
          for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
            console.log(`  ${subKey}: ${this.formatValue(subValue)}`);
          }
        } else {
          console.log(`${this.colorize(formattedKey + ':', 'cyan')} ${this.formatValue(value)}`);
        }
      }
      
      console.log(this.colorize('─'.repeat(40), 'gray'));
      console.log();
    } catch (error) {
      this.log('error', `Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 显示健康状态
   */
  private showHealth(): void {
    try {
      const health = this.agent.getHealthStatus();
      
      console.log(`\n${this.colorize('健康状态:', 'bright')}`);
      console.log(this.colorize('─'.repeat(40), 'gray'));
      
      const statusColor = health.status === 'healthy' ? 'green' : 
                         health.status === 'degraded' ? 'yellow' : 'red';
      
      console.log(`${this.colorize('整体状态:', 'cyan')} ${this.colorize(health.status.toUpperCase(), statusColor)}`);
      console.log(`${this.colorize('组件状态:', 'cyan')}`);
      
      for (const [component, status] of Object.entries(health.components)) {
        const color = status === 'ok' ? 'green' : status === 'warning' ? 'yellow' : 'red';
        console.log(`  ${component}: ${this.colorize(status, color)}`);
      }
      
      console.log(this.colorize('─'.repeat(40), 'gray'));
      console.log();
    } catch (error) {
      this.log('error', `Failed to get health status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 显示内存使用情况
   */
  private showMemory(): void {
    const usage = process.memoryUsage();
    
    console.log(`\n${this.colorize('内存使用情况:', 'bright')}`);
    console.log(this.colorize('─'.repeat(40), 'gray'));
    
    const formatBytes = (bytes: number): string => {
      const mb = bytes / 1024 / 1024;
      return `${mb.toFixed(2)} MB`;
    };
    
    console.log(`${this.colorize('RSS:', 'cyan')}        ${formatBytes(usage.rss)}`);
    console.log(`${this.colorize('堆总大小:', 'cyan')}  ${formatBytes(usage.heapTotal)}`);
    console.log(`${this.colorize('堆已用:', 'cyan')}    ${formatBytes(usage.heapUsed)}`);
    console.log(`${this.colorize('外部:', 'cyan')}      ${formatBytes(usage.external)}`);
    
    if (usage.arrayBuffers) {
      console.log(`${this.colorize('ArrayBuffers:', 'cyan')} ${formatBytes(usage.arrayBuffers)}`);
    }
    
    console.log(this.colorize('─'.repeat(40), 'gray'));
    console.log();
  }

  /**
   * 显示系统信息
   */
  private showSysInfo(): void {
    console.log(`\n${this.colorize('系统信息:', 'bright')}`);
    console.log(this.colorize('─'.repeat(40), 'gray'));
    
    console.log(`${this.colorize('平台:', 'cyan')}      ${os.platform()}`);
    console.log(`${this.colorize('架构:', 'cyan')}      ${os.arch()}`);
    console.log(`${this.colorize('Node版本:', 'cyan')}  ${process.version}`);
    console.log(`${this.colorize('进程PID:', 'cyan')}   ${process.pid}`);
    console.log(`${this.colorize('进程PPID:', 'cyan')}  ${process.ppid}`);
    console.log(`${this.colorize('运行时间:', 'cyan')}  ${Math.floor(process.uptime())}s`);
    console.log(`${this.colorize('CPU核心数:', 'cyan')} ${os.cpus().length}`);
    console.log(`${this.colorize('总内存:', 'cyan')}    ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`${this.colorize('空闲内存:', 'cyan')}  ${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
    
    console.log(this.colorize('─'.repeat(40), 'gray'));
    console.log();
  }

  /**
   * 显示历史记录
   */
  private showHistory(args: string[]): void {
    const limit = args.length > 0 ? parseInt(args[0], 10) : 20;
    const count = isNaN(limit) ? 20 : Math.min(limit, this.history.length);
    
    console.log(`\n${this.colorize(`命令历史 (最近 ${count} 条):`, 'bright')}`);
    console.log(this.colorize('─'.repeat(40), 'gray'));
    
    const start = Math.max(0, this.history.length - count);
    for (let i = start; i < this.history.length; i++) {
      const num = (i + 1).toString().padStart(3, ' ');
      console.log(`  ${this.colorize(num, 'gray')}  ${this.history[i]}`);
    }
    
    console.log(this.colorize('─'.repeat(40), 'gray'));
    console.log();
  }

  /**
   * 格式化值显示
   */
  private formatValue(value: unknown): string {
    if (value === null) return this.colorize('null', 'gray');
    if (value === undefined) return this.colorize('undefined', 'gray');
    if (typeof value === 'boolean') return value ? this.colorize('true', 'green') : this.colorize('false', 'red');
    if (typeof value === 'number') return this.colorize(String(value), 'yellow');
    if (typeof value === 'string') return this.colorize(`"${value}"`, 'green');
    if (Array.isArray(value)) return `[${value.length} items]`;
    if (typeof value === 'object') return '{...}';
    return String(value);
  }

  /**
   * 输出日志
   */
  log(level: LogLevel, message: string): void {
    const timestamp = this.config.showTimestamps 
      ? `${this.colorize(`[${new Date().toISOString()}]`, 'gray')} `
      : '';
    
    const levelColors: Record<LogLevel, keyof typeof this.colors> = {
      debug: 'gray',
      info: 'blue',
      warn: 'yellow',
      error: 'red',
      success: 'green',
    };

    const levelTag = this.colorize(`[${level.toUpperCase()}]`, levelColors[level]);
    
    console.log(`${timestamp}${levelTag} ${message}`);
  }

  /**
   * 输出信息
   */
  info(message: string): void {
    this.log('info', message);
  }

  /**
   * 输出成功
   */
  success(message: string): void {
    this.log('success', message);
  }

  /**
   * 输出警告
   */
  warn(message: string): void {
    this.log('warn', message);
  }

  /**
   * 输出错误
   */
  error(message: string): void {
    this.log('error', message);
  }

  /**
   * 输出表格
   */
  table(data: Record<string, unknown>[] | Record<string, unknown>): void {
    console.table(data);
  }

  /**
   * 输出分隔线
   */
  divider(char = '─', length = 50): void {
    console.log(this.colorize(char.repeat(length), 'gray'));
  }

  /**
   * 输出空行
   */
  newline(count = 1): void {
    for (let i = 0; i < count; i++) {
      console.log();
    }
  }

  /**
   * 获取命令列表
   */
  getCommands(): TUICommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * 检查是否运行中
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

export default TUIAdapter;
