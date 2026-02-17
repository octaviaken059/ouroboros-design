/**
 * Web Adapter - Express HTTP API
 * 
 * 提供HTTP REST API接口，包括：
 * - 健康检查端点
 * - 状态查询
 * - 命令执行
 * - 静态文件服务（前端页面）
 * - WebSocket升级支持
 */

import express, { Request, Response, NextFunction, Express } from 'express';
import { createServer, Server } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

export interface WebAdapterConfig {
  port: number;
  host?: string;
  enableCors?: boolean;
  enableCompression?: boolean;
  staticPath?: string;
  apiPrefix?: string;
}

export interface CommandRequest {
  command: string;
  args?: string[];
  context?: Record<string, unknown>;
  requestId?: string;
}

export interface CommandResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  requestId: string;
  timestamp: number;
  duration: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  version: string;
  uptime: number;
  components: {
    memory: 'ok' | 'warning' | 'critical';
    cpu: 'ok' | 'warning' | 'critical';
    scheduler: 'ok' | 'warning' | 'critical';
  };
}

export interface SystemStatus {
  identity: {
    pid: number;
    ppid: number;
    version: string;
    startTime: number;
  };
  resources: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
      loadAvg: number[];
    };
  };
  hormones: Record<string, number>;
  memory: {
    workingCount: number;
    episodicCount: number;
    semanticCount: number;
  };
  tasks: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
}

export interface IUnifiedAgent {
  handleCommand(command: string, args: string[], context?: Record<string, unknown>): Promise<unknown>;
  getHealthStatus(): HealthStatus;
  getSystemStatus(): SystemStatus;
  submitHumanInteraction(task: unknown): Promise<unknown>;
  submitBackgroundTask(task: unknown): Promise<unknown>;
}

export class WebAdapter {
  private app: Express;
  private server: Server | null = null;
  private config: Required<WebAdapterConfig>;
  private agent: IUnifiedAgent;
  private requestCounter = 0;

  private readonly VERSION = '1.0.0';
  private readonly startTime = Date.now();

  constructor(agent: IUnifiedAgent, config: WebAdapterConfig) {
    this.agent = agent;
    this.config = {
      host: '0.0.0.0',
      enableCors: true,
      enableCompression: true,
      staticPath: './src/pages',
      apiPrefix: '/api',
      ...config,
    };

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * 配置中间件
   */
  private setupMiddleware(): void {
    // 安全头部
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'", "ws:", "wss:"],
        },
      },
    }));

    // CORS
    if (this.config.enableCors) {
      this.app.use(cors({
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      }));
    }

    // 压缩
    if (this.config.enableCompression) {
      this.app.use(compression());
    }

    // 解析JSON
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // 请求日志
    this.app.use(this.requestLogger.bind(this));
  }

  /**
   * 请求日志中间件
   */
  private requestLogger(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const requestId = ++this.requestCounter;

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] ${requestId} ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });

    next();
  }

  /**
   * 配置路由
   */
  private setupRoutes(): void {
    const api = this.config.apiPrefix;

    // 健康检查
    this.app.get(`${api}/health`, this.handleHealth.bind(this));
    
    // 系统状态
    this.app.get(`${api}/status`, this.handleStatus.bind(this));
    
    // 命令执行
    this.app.post(`${api}/command`, this.handleCommand.bind(this));
    
    // 交互任务
    this.app.post(`${api}/interact`, this.handleInteract.bind(this));
    
    // 后台任务
    this.app.post(`${api}/background`, this.handleBackground.bind(this));
    
    // 指标端点（Prometheus格式）
    this.app.get('/metrics', this.handleMetrics.bind(this));

    // 静态文件服务（前端页面）
    this.app.use(express.static(this.config.staticPath));

    // 单页应用路由回退
    this.app.get('*', (req: Request, res: Response) => {
      if (req.path.startsWith(api) || req.path === '/metrics') {
        res.status(404).json({ error: 'Not found' });
      } else {
        res.sendFile('index.html', { root: this.config.staticPath });
      }
    });
  }

  /**
   * 健康检查处理器
   */
  private async handleHealth(req: Request, res: Response): Promise<void> {
    try {
      const status = this.agent.getHealthStatus();
      const httpStatus = status.status === 'healthy' ? 200 : 
                        status.status === 'degraded' ? 200 : 503;
      res.status(httpStatus).json(status);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: Date.now(),
        version: this.VERSION,
        uptime: Date.now() - this.startTime,
        components: {
          memory: 'critical',
          cpu: 'critical',
          scheduler: 'critical',
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * 系统状态处理器
   */
  private async handleStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = this.agent.getSystemStatus();
      res.json({
        success: true,
        data: status,
        timestamp: Date.now(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 命令执行处理器
   */
  private async handleCommand(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const body = req.body as CommandRequest;
      
      // 验证请求
      if (!body.command || typeof body.command !== 'string') {
        const response: CommandResponse = {
          success: false,
          error: 'Missing or invalid command',
          requestId,
          timestamp: Date.now(),
          duration: Date.now() - startTime,
        };
        res.status(400).json(response);
        return;
      }

      // 执行命令
      const result = await this.agent.handleCommand(
        body.command,
        body.args || [],
        body.context || {}
      );

      const response: CommandResponse = {
        success: true,
        data: result,
        requestId,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
      };

      res.json(response);
    } catch (error) {
      const response: CommandResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Command execution failed',
        requestId,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
      };
      res.status(500).json(response);
    }
  }

  /**
   * 交互任务处理器
   */
  private async handleInteract(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const task = req.body;
      
      if (!task || typeof task !== 'object') {
        res.status(400).json({
          success: false,
          error: 'Invalid task data',
          requestId,
          timestamp: Date.now(),
          duration: Date.now() - startTime,
        });
        return;
      }

      const result = await this.agent.submitHumanInteraction(task);

      res.json({
        success: true,
        data: result,
        requestId,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Interaction failed',
        requestId,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
      });
    }
  }

  /**
   * 后台任务处理器
   */
  private async handleBackground(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = `bg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const task = req.body;
      
      if (!task || typeof task !== 'object') {
        res.status(400).json({
          success: false,
          error: 'Invalid task data',
          requestId,
          timestamp: Date.now(),
          duration: Date.now() - startTime,
        });
        return;
      }

      // 后台任务立即返回任务ID，异步执行
      this.agent.submitBackgroundTask(task).catch(console.error);

      res.status(202).json({
        success: true,
        data: { message: 'Task accepted', requestId },
        requestId,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Background task failed',
        requestId,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
      });
    }
  }

  /**
   * Prometheus指标处理器
   */
  private async handleMetrics(req: Request, res: Response): Promise<void> {
    try {
      const status = this.agent.getSystemStatus();
      const health = this.agent.getHealthStatus();

      const metrics: string[] = [
        '# HELP ouroboros_uptime_seconds System uptime in seconds',
        '# TYPE ouroboros_uptime_seconds gauge',
        `ouroboros_uptime_seconds ${status.identity ? (Date.now() - status.identity.startTime) / 1000 : 0}`,
        '',
        '# HELP ouroboros_memory_usage_bytes Memory usage in bytes',
        '# TYPE ouroboros_memory_usage_bytes gauge',
        `ouroboros_memory_usage_bytes ${status.resources?.memory?.used || 0}`,
        '',
        '# HELP ouroboros_memory_percentage Memory usage percentage',
        '# TYPE ouroboros_memory_percentage gauge',
        `ouroboros_memory_percentage ${status.resources?.memory?.percentage || 0}`,
        '',
        '# HELP ouroboros_cpu_usage_percentage CPU usage percentage',
        '# TYPE ouroboros_cpu_usage_percentage gauge',
        `ouroboros_cpu_usage_percentage ${status.resources?.cpu?.usage || 0}`,
        '',
        '# HELP ouroboros_tasks_pending Number of pending tasks',
        '# TYPE ouroboros_tasks_pending gauge',
        `ouroboros_tasks_pending ${status.tasks?.pending || 0}`,
        '',
        '# HELP ouroboros_tasks_running Number of running tasks',
        '# TYPE ouroboros_tasks_running gauge',
        `ouroboros_tasks_running ${status.tasks?.running || 0}`,
        '',
        '# HELP ouroboros_health_status Health status (1=healthy, 0.5=degraded, 0=unhealthy)',
        '# TYPE ouroboros_health_status gauge',
        `ouroboros_health_status ${health.status === 'healthy' ? 1 : health.status === 'degraded' ? 0.5 : 0}`,
      ];

      // 激素水平指标
      if (status.hormones) {
        for (const [name, value] of Object.entries(status.hormones)) {
          metrics.push(
            '',
            `# HELP ouroboros_hormone_${name} ${name} hormone level`,
            `# TYPE ouroboros_hormone_${name} gauge`,
            `ouroboros_hormone_${name} ${value}`
          );
        }
      }

      res.set('Content-Type', 'text/plain');
      res.send(metrics.join('\n'));
    } catch (error) {
      res.status(500).send(`# Error generating metrics\n# ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 错误处理
   */
  private setupErrorHandling(): void {
    // 404处理
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
        timestamp: Date.now(),
      });
    });

    // 全局错误处理
    this.app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
      console.error('Express error:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: Date.now(),
      });
    });
  }

  /**
   * 启动Web服务器
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer(this.app);

      this.server.listen(this.config.port, this.config.host, () => {
        console.log(`🌐 Web Adapter started on http://${this.config.host}:${this.config.port}`);
        console.log(`   API prefix: ${this.config.apiPrefix}`);
        console.log(`   Static path: ${this.config.staticPath}`);
        resolve();
      });

      this.server.on('error', (error) => {
        console.error('Failed to start Web Adapter:', error);
        reject(error);
      });
    });
  }

  /**
   * 停止Web服务器
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('🌐 Web Adapter stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 获取HTTP服务器实例（用于WebSocket升级）
   */
  getServer(): Server | null {
    return this.server;
  }

  /**
   * 获取Express应用实例
   */
  getApp(): Express {
    return this.app;
  }
}

export default WebAdapter;
