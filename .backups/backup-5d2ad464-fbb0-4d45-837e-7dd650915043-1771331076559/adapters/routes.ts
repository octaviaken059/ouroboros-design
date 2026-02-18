import { Application, Request, Response } from 'express';
import { ConfigManager } from '../config/index.js';
import { getLogger, OuroborosLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * 路由配置接口
 */
interface RouteConfig {
  prefix: string;
  version: string;
}

/**
 * API响应包装
 */
function createResponse<T>(data: T, meta?: Record<string, unknown>) {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

function createErrorResponse(error: string, code?: string, details?: unknown) {
  return {
    success: false,
    error,
    code,
    details,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * 设置API路由
 * 定义所有REST API端点
 */
export function setupRoutes(app: Application, config: ConfigManager): void {
  const logger = new OuroborosLogger().child({ context: 'Routes' });
  const routeConfig: RouteConfig = {
    prefix: '/api',
    version: '/v1',
  };

  const apiPath = `${routeConfig.prefix}${routeConfig.version}`;

  logger.info('Setting up API routes...', { basePath: apiPath });

  // ═══════════════════════════════════════════════════════════════
  // 系统状态路由
  // ═══════════════════════════════════════════════════════════════

  /**
   * 获取系统健康状态
   * GET /api/v1/health
   */
  app.get(`${apiPath}/health`, (req: Request, res: Response) => {
    res.json(createResponse({
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      platform: process.platform,
    }));
  });

  /**
   * 获取系统配置
   * GET /api/v1/config
   */
  app.get(`${apiPath}/config`, (req: Request, res: Response) => {
    const safeConfig = {
      web: {
        port: config.get('web.port'),
        host: config.get('web.host'),
      },
      features: config.get('features'),
    };
    res.json(createResponse(safeConfig));
  });

  /**
   * 获取系统统计信息
   * GET /api/v1/stats
   */
  app.get(`${apiPath}/stats`, (req: Request, res: Response) => {
    res.json(createResponse({
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
      timestamp: new Date().toISOString(),
    }));
  });

  // ═══════════════════════════════════════════════════════════════
  // Agent管理路由
  // ═══════════════════════════════════════════════════════════════

  /**
   * 获取所有Agent
   * GET /api/v1/agents
   */
  app.get(`${apiPath}/agents`, (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    // 模拟数据 - 实际应从Agent管理器获取
    const agents = [
      { id: 'agent-1', name: 'Coordinator', status: 'running', type: 'coordinator' },
      { id: 'agent-2', name: 'Worker-A', status: 'idle', type: 'worker' },
      { id: 'agent-3', name: 'Worker-B', status: 'busy', type: 'worker' },
    ];

    res.json(createResponse(agents, { page, limit, total: agents.length }));
  });

  /**
   * 获取单个Agent
   * GET /api/v1/agents/:id
   */
  app.get(`${apiPath}/agents/:id`, (req: Request, res: Response) => {
    const { id } = req.params;
    
    // 模拟数据
    const agent = {
      id,
      name: `Agent-${id}`,
      status: 'running',
      type: 'worker',
      createdAt: new Date().toISOString(),
      stats: {
        tasksCompleted: 42,
        tasksFailed: 2,
        uptime: 3600,
      },
    };

    res.json(createResponse(agent));
  });

  /**
   * 创建Agent
   * POST /api/v1/agents
   */
  app.post(`${apiPath}/agents`, (req: Request, res: Response) => {
    const { name, type, config: agentConfig } = req.body;

    if (!name || !type) {
      res.status(400).json(createErrorResponse(
        'Missing required fields: name, type',
        'VALIDATION_ERROR'
      ));
      return;
    }

    const newAgent = {
      id: `agent-${Date.now()}`,
      name,
      type,
      status: 'initializing',
      config: agentConfig || {},
      createdAt: new Date().toISOString(),
    };

    res.status(201).json(createResponse(newAgent));
  });

  /**
   * 更新Agent
   * PUT /api/v1/agents/:id
   */
  app.put(`${apiPath}/agents/:id`, (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;

    const updatedAgent = {
      id,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    res.json(createResponse(updatedAgent));
  });

  /**
   * 删除Agent
   * DELETE /api/v1/agents/:id
   */
  app.delete(`${apiPath}/agents/:id`, (req: Request, res: Response) => {
    const { id } = req.params;
    res.json(createResponse({ id, deleted: true }));
  });

  /**
   * 向Agent发送命令
   * POST /api/v1/agents/:id/command
   */
  app.post(`${apiPath}/agents/:id/command`, (req: Request, res: Response) => {
    const { id } = req.params;
    const { command, params } = req.body;

    if (!command) {
      res.status(400).json(createErrorResponse(
        'Missing required field: command',
        'VALIDATION_ERROR'
      ));
      return;
    }

    res.json(createResponse({
      agentId: id,
      command,
      params,
      status: 'accepted',
      executedAt: new Date().toISOString(),
    }));
  });

  // ═══════════════════════════════════════════════════════════════
  // 任务管理路由
  // ═══════════════════════════════════════════════════════════════

  /**
   * 获取所有任务
   * GET /api/v1/tasks
   */
  app.get(`${apiPath}/tasks`, (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;

    // 模拟数据
    let tasks = [
      { id: 'task-1', name: 'Process Data', status: 'completed', progress: 100 },
      { id: 'task-2', name: 'Analyze File', status: 'running', progress: 45 },
      { id: 'task-3', name: 'Generate Report', status: 'pending', progress: 0 },
    ];

    if (status) {
      tasks = tasks.filter(t => t.status === status);
    }

    res.json(createResponse(tasks, { page, limit, total: tasks.length }));
  });

  /**
   * 获取单个任务
   * GET /api/v1/tasks/:id
   */
  app.get(`${apiPath}/tasks/:id`, (req: Request, res: Response) => {
    const { id } = req.params;

    const task = {
      id,
      name: `Task-${id}`,
      status: 'running',
      progress: 50,
      createdAt: new Date().toISOString(),
      logs: ['Task started', 'Processing...'],
    };

    res.json(createResponse(task));
  });

  /**
   * 创建任务
   * POST /api/v1/tasks
   */
  app.post(`${apiPath}/tasks`, (req: Request, res: Response) => {
    const { name, type, priority, data } = req.body;

    if (!name || !type) {
      res.status(400).json(createErrorResponse(
        'Missing required fields: name, type',
        'VALIDATION_ERROR'
      ));
      return;
    }

    const newTask = {
      id: `task-${Date.now()}`,
      name,
      type,
      priority: priority || 'normal',
      status: 'pending',
      data: data || {},
      createdAt: new Date().toISOString(),
    };

    res.status(201).json(createResponse(newTask));
  });

  /**
   * 取消任务
   * POST /api/v1/tasks/:id/cancel
   */
  app.post(`${apiPath}/tasks/:id/cancel`, (req: Request, res: Response) => {
    const { id } = req.params;
    res.json(createResponse({
      id,
      status: 'cancelling',
      cancelledAt: new Date().toISOString(),
    }));
  });

  // ═══════════════════════════════════════════════════════════════
  // 会话管理路由
  // ═══════════════════════════════════════════════════════════════

  /**
   * 创建会话
   * POST /api/v1/sessions
   */
  app.post(`${apiPath}/sessions`, (req: Request, res: Response) => {
    const { agentId, context } = req.body;

    const session = {
      id: `session-${Date.now()}`,
      agentId,
      status: 'active',
      context: context || {},
      createdAt: new Date().toISOString(),
    };

    res.status(201).json(createResponse(session));
  });

  /**
   * 获取会话
   * GET /api/v1/sessions/:id
   */
  app.get(`${apiPath}/sessions/:id`, (req: Request, res: Response) => {
    const { id } = req.params;

    const session = {
      id,
      agentId: 'agent-1',
      status: 'active',
      messages: [],
      createdAt: new Date().toISOString(),
    };

    res.json(createResponse(session));
  });

  /**
   * 发送消息到会话
   * POST /api/v1/sessions/:id/messages
   */
  app.post(`${apiPath}/sessions/:id/messages`, (req: Request, res: Response) => {
    const { id } = req.params;
    const { content, type = 'text' } = req.body;

    if (!content) {
      res.status(400).json(createErrorResponse(
        'Missing required field: content',
        'VALIDATION_ERROR'
      ));
      return;
    }

    const message = {
      id: `msg-${Date.now()}`,
      sessionId: id,
      content,
      type,
      role: 'user',
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(createResponse(message));
  });

  /**
   * 结束会话
   * DELETE /api/v1/sessions/:id
   */
  app.delete(`${apiPath}/sessions/:id`, (req: Request, res: Response) => {
    const { id } = req.params;
    res.json(createResponse({
      id,
      status: 'ended',
      endedAt: new Date().toISOString(),
    }));
  });

  // ═══════════════════════════════════════════════════════════════
  // 工具路由
  // ═══════════════════════════════════════════════════════════════

  /**
   * 执行工具
   * POST /api/v1/tools/execute
   */
  app.post(`${apiPath}/tools/execute`, (req: Request, res: Response) => {
    const { tool, params } = req.body;

    if (!tool) {
      res.status(400).json(createErrorResponse(
        'Missing required field: tool',
        'VALIDATION_ERROR'
      ));
      return;
    }

    res.json(createResponse({
      tool,
      params,
      status: 'executing',
      executionId: `exec-${Date.now()}`,
    }));
  });

  /**
   * 获取可用工具列表
   * GET /api/v1/tools
   */
  app.get(`${apiPath}/tools`, (req: Request, res: Response) => {
    const tools = [
      { name: 'web_search', description: 'Search the web', category: 'web' },
      { name: 'file_read', description: 'Read file content', category: 'file' },
      { name: 'file_write', description: 'Write to file', category: 'file' },
      { name: 'exec', description: 'Execute command', category: 'system' },
    ];

    res.json(createResponse(tools));
  });

  // ═══════════════════════════════════════════════════════════════
  // 日志路由
  // ═══════════════════════════════════════════════════════════════

  /**
   * 获取系统日志
   * GET /api/v1/logs
   */
  app.get(`${apiPath}/logs`, (req: Request, res: Response) => {
    const lines = parseInt(req.query.lines as string) || 100;
    const level = req.query.level as string;

    // 模拟日志数据
    const logs = [
      { timestamp: new Date().toISOString(), level: 'info', message: 'System started' },
      { timestamp: new Date().toISOString(), level: 'debug', message: 'Agent initialized' },
    ];

    res.json(createResponse(logs.slice(0, lines)));
  });

  /**
   * 获取Agent日志
   * GET /api/v1/agents/:id/logs
   */
  app.get(`${apiPath}/agents/:id/logs`, (req: Request, res: Response) => {
    const { id } = req.params;
    const lines = parseInt(req.query.lines as string) || 50;

    const logs = [
      { timestamp: new Date().toISOString(), level: 'info', message: `Agent ${id} log entry` },
    ];

    res.json(createResponse(logs.slice(0, lines)));
  });

  // ═══════════════════════════════════════════════════════════════
  // WebSocket信息路由
  // ═══════════════════════════════════════════════════════════════

  /**
   * 获取WebSocket连接信息
   * GET /api/v1/ws/info
   */
  app.get(`${apiPath}/ws/info`, (req: Request, res: Response) => {
    res.json(createResponse({
      endpoint: '/ws',
      protocol: 'websocket',
      supportedFormats: ['json'],
      authentication: 'none',
    }));
  });

  // ═══════════════════════════════════════════════════════════════
  // API文档路由
  // ═══════════════════════════════════════════════════════════════

  /**
   * 获取API文档
   * GET /api/v1/docs
   */
  app.get(`${apiPath}/docs`, (req: Request, res: Response) => {
    const docs = {
      name: 'Ouroboros API',
      version: '1.0.0',
      baseUrl: apiPath,
      endpoints: [
        { method: 'GET', path: '/health', description: 'Health check' },
        { method: 'GET', path: '/agents', description: 'List all agents' },
        { method: 'POST', path: '/agents', description: 'Create new agent' },
        { method: 'GET', path: '/agents/:id', description: 'Get agent details' },
        { method: 'PUT', path: '/agents/:id', description: 'Update agent' },
        { method: 'DELETE', path: '/agents/:id', description: 'Delete agent' },
        { method: 'POST', path: '/agents/:id/command', description: 'Send command to agent' },
        { method: 'GET', path: '/tasks', description: 'List all tasks' },
        { method: 'POST', path: '/tasks', description: 'Create new task' },
        { method: 'GET', path: '/tasks/:id', description: 'Get task details' },
        { method: 'POST', path: '/tasks/:id/cancel', description: 'Cancel task' },
        { method: 'POST', path: '/sessions', description: 'Create session' },
        { method: 'GET', path: '/sessions/:id', description: 'Get session' },
        { method: 'POST', path: '/sessions/:id/messages', description: 'Send message' },
        { method: 'DELETE', path: '/sessions/:id', description: 'End session' },
        { method: 'GET', path: '/tools', description: 'List available tools' },
        { method: 'POST', path: '/tools/execute', description: 'Execute tool' },
        { method: 'GET', path: '/logs', description: 'Get system logs' },
        { method: 'GET', path: '/ws/info', description: 'WebSocket info' },
      ],
    };

    res.json(createResponse(docs));
  });

  logger.info('API routes setup complete');
}

export default setupRoutes;
