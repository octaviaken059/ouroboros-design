/**
 * Ouroboros - 主入口文件
 * 
 * 支持多种运行模式：
 * - web: HTTP REST API 模式
 * - tui: 终端交互界面模式  
 * - telegram: Telegram Bot 模式
 * - cli: 命令行模式
 * 
 * 🐍⭕ "The Eternal Serpent Devours Itself to Be Reborn"
 */

import { UnifiedAgent, UnifiedAgentConfig, ToolSkill } from './unified-agent.js';
import * as http from 'http';
import * as readline from 'readline';
import { promises as fs } from 'fs';
import * as path from 'path';

// ============================================================================
// 版本信息
// ============================================================================

const VERSION = '1.0.0';
const NAME = 'Ouroboros';
const TAGLINE = '🐍⭕ The Eternal Serpent Devours Itself to Be Reborn';

// ============================================================================
// 配置加载
// ============================================================================

interface AppConfig {
  mode: 'web' | 'tui' | 'telegram' | 'cli';
  port: number;
  host: string;
  dataDir: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  openaiApiKey?: string;
  telegramToken?: string;
  memory: {
    maxMemoryCount: number;
    enableVectorization: boolean;
  };
  scheduler: {
    homeostasisEnable: boolean;
    cpuThreshold: number;
    memoryThreshold: number;
  };
  reflection: {
    enabled: boolean;
    intervalMinutes: number;
  };
}

function loadConfig(): AppConfig {
  return {
    mode: (process.env.OURO_MODE as AppConfig['mode']) || 'cli',
    port: parseInt(process.env.OURO_PORT || '8080', 10),
    host: process.env.OURO_HOST || '0.0.0.0',
    dataDir: process.env.OURO_DATA_DIR || './data',
    logLevel: (process.env.OURO_LOG_LEVEL as AppConfig['logLevel']) || 'info',
    openaiApiKey: process.env.OPENAI_API_KEY,
    telegramToken: process.env.TELEGRAM_BOT_TOKEN,
    memory: {
      maxMemoryCount: parseInt(process.env.OURO_MAX_MEMORY || '10000', 10),
      enableVectorization: process.env.OURO_ENABLE_VECTORIZATION === 'true',
    },
    scheduler: {
      homeostasisEnable: process.env.OURO_HOMEOSTASIS !== 'false',
      cpuThreshold: parseInt(process.env.OURO_CPU_THRESHOLD || '80', 10),
      memoryThreshold: parseInt(process.env.OURO_MEMORY_THRESHOLD || '85', 10),
    },
    reflection: {
      enabled: process.env.OURO_REFLECTION !== 'false',
      intervalMinutes: parseInt(process.env.OURO_REFLECTION_INTERVAL || '30', 10),
    },
  };
}

// ============================================================================
// 日志工具
// ============================================================================

class Logger {
  private level: AppConfig['logLevel'];

  constructor(level: AppConfig['logLevel']) {
    this.level = level;
  }

  private shouldLog(level: AppConfig['logLevel']): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private format(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.format('debug', message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.log(this.format('info', message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.format('warn', message), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.format('error', message), ...args);
    }
  }
}

// ============================================================================
// 内置工具
// ============================================================================

function createBuiltInTools(): ToolSkill[] {
  return [
    {
      name: 'file_read',
      description: 'Read file contents',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
        },
        required: ['path'],
      },
      execute: async (args: unknown) => {
        const { path: filePath } = args as { path: string };
        const content = await fs.readFile(filePath, 'utf-8');
        return { content };
      },
    },
    {
      name: 'file_write',
      description: 'Write content to file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
      execute: async (args: unknown) => {
        const { path: filePath, content } = args as { path: string; content: string };
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');
        return { success: true, path: filePath };
      },
    },
    {
      name: 'system_info',
      description: 'Get system information',
      parameters: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const os = await import('os');
        return {
          platform: os.platform(),
          arch: os.arch(),
          cpus: os.cpus().length,
          totalMemory: os.totalmem(),
          freeMemory: os.freemem(),
          uptime: os.uptime(),
        };
      },
    },
    {
      name: 'web_search',
      description: 'Search the web (placeholder)',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
      execute: async (args: unknown) => {
        const { query } = args as { query: string };
        // 实际实现需要接入搜索引擎API
        return {
          query,
          results: [],
          note: 'Web search requires external API integration',
        };
      },
    },
  ];
}

// ============================================================================
// Web 适配器
// ============================================================================

class WebAdapter {
  private agent: UnifiedAgent;
  private server: http.Server | null = null;
  private logger: Logger;

  constructor(agent: UnifiedAgent, logger: Logger) {
    this.agent = agent;
    this.logger = logger;
  }

  async start(port: number, host: string): Promise<void> {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(port, host, () => {
        this.logger.info(`Web server listening on ${host}:${port}`);
        resolve();
      });

      this.server!.on('error', reject);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.logger.info('Web server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    
    try {
      // Health check
      if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', version: VERSION }));
        return;
      }

      // Status endpoint
      if (url.pathname === '/api/status') {
        const status = this.agent.getStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status, null, 2));
        return;
      }

      // Command endpoint
      if (url.pathname === '/api/command' && req.method === 'POST') {
        const body = await this.parseBody(req);
        const { command, args = [] } = JSON.parse(body);
        
        this.logger.info(`API command: ${command}`);
        
        const result = await this.agent.handleCommand(command, args);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
        return;
      }

      // Task endpoint
      if (url.pathname === '/api/task' && req.method === 'POST') {
        const body = await this.parseBody(req);
        const { type, data, priority } = JSON.parse(body);
        
        const task = this.agent.submitHumanInteraction({
          type,
          data,
        });
        
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ taskId: task.id, status: 'accepted' }));
        return;
      }

      // Memory endpoint
      if (url.pathname === '/api/memory') {
        if (req.method === 'GET') {
          const query = url.searchParams.get('q') || '';
          const results = await this.agent.memory.search(query);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(results, null, 2));
          return;
        }
        
        if (req.method === 'POST') {
          const body = await this.parseBody(req);
          const { content, type = 'episodic', importance = 0.5, tags = [] } = JSON.parse(body);
          
          const entry = await this.agent.memory.store(content, type as any, {
            importance,
            tags,
          });
          
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(entry, null, 2));
          return;
        }
      }

      // Not found
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (error) {
      this.logger.error('Request error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  private parseBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk.toString(); });
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }
}

// ============================================================================
// TUI 适配器
// ============================================================================

class TUIAdapter {
  private agent: UnifiedAgent;
  private logger: Logger;
  private rl: readline.Interface | null = null;

  constructor(agent: UnifiedAgent, logger: Logger) {
    this.agent = agent;
    this.logger = logger;
  }

  async start(): Promise<void> {
    console.log(`\n${NAME} v${VERSION}`);
    console.log(TAGLINE);
    console.log('\nType "help" for available commands, "exit" to quit.\n');

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '🐍\u003e ',
    });

    this.rl.prompt();

    this.rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        this.rl!.prompt();
        return;
      }

      if (trimmed === 'exit' || trimmed === 'quit') {
        this.rl!.close();
        return;
      }

      if (trimmed === 'help') {
        this.printHelp();
        this.rl!.prompt();
        return;
      }

      await this.handleInput(trimmed);
      this.rl!.prompt();
    });

    this.rl.on('close', () => {
      console.log('\nGoodbye! 👋');
      process.exit(0);
    });
  }

  async stop(): Promise<void> {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  private async handleInput(input: string): Promise<void> {
    try {
      const parts = input.split(' ');
      const command = parts[0];
      const args = parts.slice(1);

      const result = await this.agent.handleCommand(command, args);
      
      console.log('\n' + JSON.stringify(result, null, 2) + '\n');
    } catch (error) {
      console.error('Error:', error);
    }
  }

  private printHelp(): void {
    console.log(`
Available Commands:
  status        - Show agent status
  body          - Show body schema
  hormones      - Show hormone levels
  memory stats  - Show memory statistics
  memory search <query> - Search memories
  capabilities  - Show Bayesian capabilities
  reflect       - Perform reflection
  consolidate   - Consolidate memories
  help          - Show this help
  exit/quit     - Exit the application
`);
  }
}

// ============================================================================
// CLI 模式
// ============================================================================

async function runCLI(agent: UnifiedAgent, logger: Logger, args: string[]): Promise<void> {
  if (args.length === 0) {
    console.log(`
${NAME} v${VERSION}
${TAGLINE}

Usage: ouro <command> [args...]

Commands:
  status              Show agent status
  body                Show body schema
  hormones            Show hormone levels
  memory stats        Show memory statistics
  memory search <q>   Search memories
  capabilities        Show Bayesian capabilities
  reflect             Perform reflection
  consolidate         Consolidate memories
  tool <name> [args]  Execute a tool

Examples:
  ouro status
  ouro memory search "important event"
  ouro tool system_info
`);
    return;
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  try {
    const result = await agent.handleCommand(command, commandArgs);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    logger.error('Command failed:', error);
    process.exit(1);
  }
}

// ============================================================================
// 信号处理
// ============================================================================

function setupSignalHandlers(agent: UnifiedAgent, logger: Logger): void {
  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    try {
      await agent.stop();
      logger.info('Agent stopped gracefully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // 未捕获错误处理
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection:', reason);
  });
}

// ============================================================================
// 主函数
// ============================================================================

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new Logger(config.logLevel);

  // 从命令行参数或环境变量确定模式
  const mode = process.argv[2] as AppConfig['mode'] || config.mode;

  logger.info(`Starting ${NAME} v${VERSION} in ${mode} mode`);
  logger.debug('Configuration:', config);

  // 创建 Agent 配置
  const agentConfig: UnifiedAgentConfig = {
    scheduler: {
      homeostasisEnable: config.scheduler.homeostasisEnable,
      cpuThreshold: config.scheduler.cpuThreshold,
      memoryThreshold: config.scheduler.memoryThreshold,
    },
    memory: {
      maxMemoryCount: config.memory.maxMemoryCount,
      enableVectorization: config.memory.enableVectorization,
      persistPath: path.join(config.dataDir, 'memories.json'),
    },
    reflection: {
      enabled: config.reflection.enabled,
      intervalMs: config.reflection.intervalMinutes * 60 * 1000,
    },
    tools: createBuiltInTools(),
  };

  // 创建并启动 Agent
  const agent = new UnifiedAgent(agentConfig);
  
  // 设置信号处理
  setupSignalHandlers(agent, logger);

  // 监听 Agent 事件
  agent.on('started', () => logger.info('Agent started'));
  agent.on('stopped', () => logger.info('Agent stopped'));
  agent.on('securityAlert', (info) => logger.warn('Security alert:', info));
  agent.on('homeostasisAlert', (status) => {
    logger.warn('Homeostasis alert:', status.issues);
  });

  await agent.start();

  // 根据模式启动对应的适配器
  switch (mode) {
    case 'web': {
      const webAdapter = new WebAdapter(agent, logger);
      await webAdapter.start(config.port, config.host);
      
      // 保持进程运行
      await new Promise(() => {});
      break;
    }

    case 'tui': {
      const tuiAdapter = new TUIAdapter(agent, logger);
      await tuiAdapter.start();
      break;
    }

    case 'telegram': {
      logger.info('Telegram mode - requires additional implementation');
      // Telegram bot 实现需要额外的依赖和配置
      logger.error('Telegram mode not yet implemented. Use web or tui mode.');
      process.exit(1);
      break;
    }

    case 'cli':
    default: {
      const cliArgs = process.argv.slice(3);
      await runCLI(agent, logger, cliArgs);
      await agent.stop();
      break;
    }
  }
}

// 启动应用
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// 导出模块供外部使用
export { UnifiedAgent, AppConfig, Logger, WebAdapter, TUIAdapter };
