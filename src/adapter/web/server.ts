/**
 * @file adapter/web/server.ts
 * @description Web 服务器 - 提供聊天界面和监控面板
 * @author Ouroboros
 * @date 2026-02-18
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createContextLogger } from '@/utils/logger';
import type { OuroborosAgent } from '@/core/agent';

const logger = createContextLogger('WebServer');

// 模拟 __dirname in ES module
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Web 服务器配置
 */
interface WebServerConfig {
  port: number;
  host: string;
  agent: OuroborosAgent;
}

/**
 * Web 服务器类
 * 提供聊天界面和监控面板
 */
export class WebServer {
  private server: ReturnType<typeof createServer> | null = null;
  private config: WebServerConfig;
  private agent: OuroborosAgent;

  constructor(config: WebServerConfig) {
    this.config = config;
    this.agent = config.agent;
  }

  /**
   * 启动 Web 服务器
   */
  start(): void {
    if (this.server) {
      logger.warn('Web 服务器已在运行');
      return;
    }

    this.server = createServer((req, res) => this.handleRequest(req, res));
    
    this.server.listen(this.config.port, this.config.host, () => {
      logger.info('Web 服务器已启动', {
        host: this.config.host,
        port: this.config.port,
        url: `http://${this.config.host}:${this.config.port}`,
      });
    });
  }

  /**
   * 停止 Web 服务器
   */
  stop(): void {
    if (!this.server) {
      return;
    }

    this.server.close(() => {
      logger.info('Web 服务器已停止');
    });
    this.server = null;
  }

  /**
   * 处理 HTTP 请求
   */
  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const url = req.url || '/';
    const method = req.method || 'GET';

    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      // API 路由
      if (url.startsWith('/api/')) {
        await this.handleAPIRequest(req, res, url, method);
        return;
      }

      // 静态文件路由
      this.handleStaticFile(req, res, url);
    } catch (error) {
      logger.error('请求处理失败', { url, error });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }

  /**
   * 处理 API 请求
   */
  private async handleAPIRequest(
    req: IncomingMessage,
    res: ServerResponse,
    url: string,
    method: string
  ): Promise<void> {
    res.setHeader('Content-Type', 'application/json');

    // GET /api/status - 获取 Agent 状态
    if (url === '/api/status' && method === 'GET') {
      const status = this.agent.getStatus();
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: status,
      }));
      return;
    }

    // GET /api/self-description - 获取自我描述
    if (url === '/api/self-description' && method === 'GET') {
      const selfDesc = this.agent.getSelfDescription();
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: selfDesc,
      }));
      return;
    }

    // GET /api/memory/stats - 获取记忆统计
    if (url === '/api/memory/stats' && method === 'GET') {
      const memorySystem = this.agent.getMemorySystem();
      const stats = memorySystem.getStats();
      const salienceReport = memorySystem.getSalienceReport();
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: { stats, salienceReport },
      }));
      return;
    }

    // GET /api/bayesian/tools - 获取工具置信度
    if (url === '/api/bayesian/tools' && method === 'GET') {
      const bayesianCore = this.agent.getBayesianCore();
      const tools = bayesianCore.getAllToolConfidences();
      const toolsArray = Array.from(tools.entries()).map(([name, conf]) => ({
        name,
        ...conf,
      }));
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: toolsArray,
      }));
      return;
    }

    // POST /api/chat - 发送消息
    if (url === '/api/chat' && method === 'POST') {
      const body = await this.readBody(req);
      const { message } = JSON.parse(body);
      
      if (!message) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Message is required' }));
        return;
      }

      try {
        const response = await this.agent.processMessage(message);
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: {
            content: response.content,
            model: response.model,
            tokens: response.tokens,
          },
        }));
      } catch (error) {
        logger.error('聊天处理失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
      return;
    }

    // 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'API endpoint not found' }));
  }

  /**
   * 处理静态文件请求
   */
  private handleStaticFile(
    _req: IncomingMessage,
    res: ServerResponse,
    url: string
  ): void {
    // 默认首页
    let filePath = url === '/' ? '/index.html' : url;
    
    // 安全限制：防止目录遍历
    if (filePath.includes('..')) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    // 构建完整路径
    const fullPath = join(__dirname, 'public', filePath);

    // 检查文件是否存在
    if (!existsSync(fullPath)) {
      // 返回首页（单页应用路由）
      const indexPath = join(__dirname, 'public', 'index.html');
      if (existsSync(indexPath)) {
        this.serveFile(res, indexPath, 'text/html');
        return;
      }
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    // 确定 Content-Type
    const ext = filePath.split('.').pop() || '';
    const contentType = this.getContentType(ext);

    this.serveFile(res, fullPath, contentType);
  }

  /**
   * 提供文件
   */
  private serveFile(
    res: ServerResponse,
    filePath: string,
    contentType: string
  ): void {
    try {
      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch (error) {
      logger.error('读取文件失败', { filePath, error });
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  }

  /**
   * 获取 Content-Type
   */
  private getContentType(ext: string): string {
    const types: Record<string, string> = {
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      json: 'application/json',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      ico: 'image/x-icon',
    };
    return types[ext] || 'application/octet-stream';
  }

  /**
   * 读取请求体
   */
  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }
}
