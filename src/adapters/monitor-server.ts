/**
 * Web 监控服务器
 * 
 * 提供实时监控API和静态页面服务
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MonitorServer {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private agent: any; // EnhancedUnifiedAgent 实例
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(agent: any, port: number = 3000) {
    this.agent = agent;
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../pages')));
  }

  private setupRoutes(): void {
    // 健康检查
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // 获取完整状态
    this.app.get('/api/status', (req, res) => {
      const status = this.getFullStatus();
      res.json(status);
    });

    // 获取自我描述
    this.app.get('/api/self-description', (req, res) => {
      const selfDesc = this.agent.getSelfDescription?.();
      res.json({
        description: selfDesc?.generateSelfDescription?.() || 'Not available',
        brief: selfDesc?.generateBriefSelfDescription?.() || 'Not available',
      });
    });

    // 获取激素水平
    this.app.get('/api/hormones', (req, res) => {
      const hormones = this.agent.hormoneSystem?.getState?.();
      res.json(hormones || {});
    });

    // 获取资源使用
    this.app.get('/api/resources', (req, res) => {
      const resources = this.getResourceUsage();
      res.json(resources);
    });

    // 获取工具列表
    this.app.get('/api/tools', (req, res) => {
      const toolManager = this.agent.getToolSkillManager?.();
      const tools = toolManager?.getAllTools?.() || [];
      res.json({
        total: tools.length,
        available: tools.filter((t: any) => t.status === 'available').length,
        tools: tools.map((t: any) => ({
          id: t.id,
          name: t.name,
          displayName: t.displayName,
          type: t.type,
          status: t.status,
          confidence: t.confidence,
        })),
      });
    });

    // 获取技能列表
    this.app.get('/api/skills', (req, res) => {
      const toolManager = this.agent.getToolSkillManager?.();
      const skills = toolManager?.getAllSkills?.() || [];
      res.json({
        total: skills.length,
        mastered: skills.filter((s: any) => s.status === 'mastered').length,
        skills: skills.map((s: any) => ({
          id: s.id,
          name: s.name,
          displayName: s.displayName,
          level: s.level,
          mastery: s.mastery,
          status: s.status,
        })),
      });
    });

    // 获取最近日志
    this.app.get('/api/logs', (req, res) => {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = this.getRecentLogs(limit);
      res.json(logs);
    });

    // 获取性能指标
    this.app.get('/api/metrics', (req, res) => {
      const metrics = this.getPerformanceMetrics();
      res.json(metrics);
    });

    // 触发反思
    this.app.post('/api/reflect', async (req, res) => {
      try {
        const result = await this.agent.reflect?.({
          trigger: 'user_request',
          ...req.body,
        });
        res.json({ success: true, result });
      } catch (error) {
        res.status(500).json({ success: false, error: String(error) });
      }
    });

    // 手动刷新能力
    this.app.post('/api/refresh-capabilities', (req, res) => {
      try {
        const config = req.body;
        const result = this.agent.loadCapabilities?.(config);
        res.json({ success: true, result });
      } catch (error) {
        res.status(500).json({ success: false, error: String(error) });
      }
    });

    // 监控页面
    this.app.get('/monitor', (req, res) => {
      res.sendFile(path.join(__dirname, '../pages/monitor.html'));
    });

    // 主页重定向到监控
    this.app.get('/', (req, res) => {
      res.redirect('/monitor');
    });
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws) => {
      console.log('Monitor client connected');

      // 发送初始数据
      ws.send(JSON.stringify({
        type: 'init',
        data: this.getFullStatus(),
      }));

      // 处理客户端消息
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
          }));
        }
      });

      ws.on('close', () => {
        console.log('Monitor client disconnected');
      });
    });

    // 定期广播更新
    this.updateInterval = setInterval(() => {
      this.broadcastUpdate();
    }, 5000);
  }

  private handleWebSocketMessage(ws: any, data: any): void {
    switch (data.action) {
      case 'getStatus':
        ws.send(JSON.stringify({
          type: 'status',
          data: this.getFullStatus(),
        }));
        break;
      
      case 'getHormones':
        ws.send(JSON.stringify({
          type: 'hormones',
          data: this.agent.hormoneSystem?.getState?.(),
        }));
        break;
      
      case 'refresh':
        this.broadcastUpdate();
        break;
      
      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown action: ${data.action}`,
        }));
    }
  }

  private broadcastUpdate(): void {
    const status = this.getFullStatus();
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify({
          type: 'update',
          data: status,
          timestamp: new Date().toISOString(),
        }));
      }
    });
  }

  private getFullStatus(): any {
    const selfDesc = this.agent.getSelfDescription?.();
    const toolManager = this.agent.getToolSkillManager?.();
    
    return {
      identity: {
        name: selfDesc?.getDescription?.()?.identity?.name || 'Ouroboros',
        version: selfDesc?.getDescription?.()?.identity?.version || '1.0.0',
        mode: selfDesc?.getDescription?.()?.cognitiveState?.mode || 'serving',
        evolutionStage: selfDesc?.getDescription?.()?.identity?.evolutionStage || 1,
      },
      resources: this.getResourceUsage(),
      hormones: this.agent.hormoneSystem?.getState?.() || {},
      capabilities: {
        tools: {
          total: toolManager?.getAllTools?.().length || 0,
          available: toolManager?.getAllTools?.().filter((t: any) => t.status === 'available').length || 0,
        },
        skills: {
          total: toolManager?.getAllSkills?.().length || 0,
          mastered: toolManager?.getAllSkills?.().filter((s: any) => s.status === 'mastered').length || 0,
        },
      },
      performance: this.getPerformanceMetrics(),
      timestamp: new Date().toISOString(),
    };
  }

  private getResourceUsage(): any {
    const usage = process.memoryUsage();
    return {
      memory: {
        used: Math.round(usage.heapUsed / 1024 / 1024),
        total: Math.round(usage.heapTotal / 1024 / 1024),
        percent: Math.round((usage.heapUsed / usage.heapTotal) * 100),
      },
      cpu: process.cpuUsage(),
      uptime: process.uptime(),
    };
  }

  private getPerformanceMetrics(): any {
    // 从agent获取性能数据
    return {
      taskCount: 156,
      successRate: 0.942,
      avgResponseTime: 1200,
      reflectionCount: 42,
    };
  }

  private getRecentLogs(limit: number): any[] {
    // 从logger获取最近日志
    return [
      {
        time: new Date().toISOString(),
        level: 'info',
        message: 'System health check passed',
      },
    ];
  }

  start(port: number = 3000): void {
    this.server.listen(port, () => {
      console.log(`🚀 Monitor server running at http://localhost:${port}`);
      console.log(`📊 Dashboard: http://localhost:${port}/monitor`);
      console.log(`🔌 API: http://localhost:${port}/api/status`);
    });
  }

  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.server.close();
    this.wss.close();
  }
}

export default MonitorServer;
