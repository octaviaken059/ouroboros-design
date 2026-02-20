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
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      }
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

    // GET /api/debug/last-prompt - 获取最后提示词
    if (url === '/api/debug/last-prompt' && method === 'GET') {
      try {
        // 检查调试功能是否启用
        const config = this.agent['config'];
        const debugEnabled = config?.adapter?.web?.debug?.enabled ?? false;
        
        if (!debugEnabled) {
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            data: null,
            message: '调试功能已禁用。请在配置中启用 adapter.web.debug.enabled 来查看调试信息。',
            debugEnabled: false,
          }));
          return;
        }
        
        const debugInfo = this.agent.getLastDebugInfo();
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: debugInfo || null,
          debugEnabled: true,
        }));
      } catch (error) {
        logger.error('获取调试信息失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }
    
    // GET /api/debug/config - 获取调试配置 (只读，从 config.json 读取)
    if (url === '/api/debug/config' && method === 'GET') {
      try {
        const config = this.agent['config'];
        const debugConfig = config?.adapter?.web?.debug;
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: {
            enabled: debugConfig?.enabled ?? true,
            recordPrompts: debugConfig?.recordPrompts ?? true,
            maxHistory: debugConfig?.maxHistory ?? 100,
            source: 'config.json', // 表明配置来源
          },
        }));
      } catch (error) {
        logger.error('获取调试配置失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }
    
    // GET /api/chat/config - 获取聊天配置 (think模式, markdown等)
    if (url === '/api/chat/config' && method === 'GET') {
      try {
        const config = this.agent['config'];
        const webConfig = config?.adapter?.web;
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: {
            think: {
              enabled: webConfig?.think?.enabled ?? true,
              separator: webConfig?.think?.separator ?? '</think>',
              displayMode: webConfig?.think?.displayMode ?? 'collapsible',
            },
            chat: {
              markdownEnabled: webConfig?.chat?.markdownEnabled ?? true,
              lightTheme: webConfig?.chat?.lightTheme ?? true,
              codeHighlighting: webConfig?.chat?.codeHighlighting ?? true,
            },
          },
        }));
      } catch (error) {
        logger.error('获取聊天配置失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
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

    // ==================== MetaCognition APIs (新增) ====================
    
    // GET /api/metacognition/status - 获取元认知状态
    if (url === '/api/metacognition/status' && method === 'GET') {
      try {
        const metaCognition = this.agent.getMetaCognition();
        const stats = metaCognition.getCapabilityStats();
        const trend = metaCognition.getCognitiveTrend();
        const assessment = metaCognition.assessUncertainty();
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: {
            stats,
            trend,
            assessment: {
              overall: assessment.overall,
              highRiskCapabilities: assessment.highRiskCapabilities,
              recommendations: assessment.recommendations,
            },
          },
        }));
      } catch (error) {
        logger.error('获取元认知状态失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }
    
    // GET /api/metacognition/capabilities - 获取所有能力边界
    if (url === '/api/metacognition/capabilities' && method === 'GET') {
      try {
        const metaCognition = this.agent.getMetaCognition();
        const bounds = metaCognition.getAllCapabilityBounds();
        const boundsArray = Array.from(bounds.values());
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: boundsArray,
        }));
      } catch (error) {
        logger.error('获取能力边界失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }
    
    // POST /api/metacognition/assess - 评估任务分发
    if (url === '/api/metacognition/assess' && method === 'POST') {
      try {
        const body = await this.readBody(req);
        const { taskType, complexity, context } = JSON.parse(body);
        
        const metaCognition = this.agent.getMetaCognition();
        const decision = metaCognition.shouldOffload(taskType, complexity, context);
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: decision,
        }));
      } catch (error) {
        logger.error('任务分发评估失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }
    
    // GET /api/metacognition/report - 获取元认知报告
    if (url === '/api/metacognition/report' && method === 'GET') {
      try {
        const metaCognition = this.agent.getMetaCognition();
        const report = metaCognition.generateReport();
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: { report },
        }));
      } catch (error) {
        logger.error('生成元认知报告失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // ==================== Deep Reflection APIs (P2) ====================
    
    // GET /api/reasoning/stats - 获取推理统计
    if (url === '/api/reasoning/stats' && method === 'GET') {
      try {
        const reasoningMonitor = this.agent.getReasoningMonitor();
        const stats = reasoningMonitor.getStats();
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: stats,
        }));
      } catch (error) {
        logger.error('获取推理统计失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }
    
    // GET /api/reasoning/chains - 获取推理链历史
    if (url === '/api/reasoning/chains' && method === 'GET') {
      try {
        void this.agent.getReasoningMonitor();
        // 简化返回，实际应该实现分页
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: [],
          message: '推理链历史功能开发中',
        }));
      } catch (error) {
        logger.error('获取推理链失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }
    
    // POST /api/reasoning/critique - 生成推理批评
    if (url === '/api/reasoning/critique' && method === 'POST') {
      try {
        const body = await this.readBody(req);
        const { chainId } = JSON.parse(body);
        
        const reasoningMonitor = this.agent.getReasoningMonitor();
        const critique = reasoningMonitor.generateCritique(chainId);
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: critique,
        }));
      } catch (error) {
        logger.error('生成推理批评失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }
    
    // GET /api/strategies - 获取所有策略
    if (url === '/api/strategies' && method === 'GET') {
      try {
        const strategyEncoder = this.agent.getStrategyEncoder();
        const strategies = strategyEncoder.getAllStrategies();
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: strategies,
        }));
      } catch (error) {
        logger.error('获取策略失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }
    
    // POST /api/strategies/encode - 从教训编码策略
    if (url === '/api/strategies/encode' && method === 'POST') {
      try {
        const body = await this.readBody(req);
        const { lesson, context } = JSON.parse(body);
        
        const strategyEncoder = this.agent.getStrategyEncoder();
        const strategy = strategyEncoder.encodeFromLesson(lesson, context || {});
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: strategy,
        }));
      } catch (error) {
        logger.error('编码策略失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }
    
    // GET /api/strategies/report - 获取策略报告
    if (url === '/api/strategies/report' && method === 'GET') {
      try {
        const strategyEncoder = this.agent.getStrategyEncoder();
        const report = strategyEncoder.generateReport();
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: { report },
        }));
      } catch (error) {
        logger.error('生成策略报告失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // ==================== Self-Referential Memory APIs (P3) ====================
    
    // GET /api/selfreferential/report - 获取自指记忆报告
    if (url === '/api/selfreferential/report' && method === 'GET') {
      try {
        const selfRefMemory = this.agent.getSelfReferentialMemory();
        const report = selfRefMemory.generateReport();
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: { report },
        }));
      } catch (error) {
        logger.error('生成自指记忆报告失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }
    
    // GET /api/selfreferential/forgetting - 获取遗忘评估
    if (url === '/api/selfreferential/forgetting' && method === 'GET') {
      try {
        const selfRefMemory = this.agent.getSelfReferentialMemory();
        const candidates = selfRefMemory.assessForgettingCandidates();
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: candidates.slice(0, 10), // 只返回前10个
        }));
      } catch (error) {
        logger.error('遗忘评估失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }
    
    // POST /api/selfreferential/encode - 自指编码记忆
    if (url === '/api/selfreferential/encode' && method === 'POST') {
      try {
        const body = await this.readBody(req);
        const { content, type, context } = JSON.parse(body);
        
        const selfRefMemory = this.agent.getSelfReferentialMemory();
        const decision = selfRefMemory.selfReferentialEncode(content, type, context);
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: decision,
        }));
      } catch (error) {
        logger.error('自指编码失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // ==================== Strategy Execution APIs (P4) ====================
    
    // POST /api/strategies/compile - 编译策略
    if (url === '/api/strategies/compile' && method === 'POST') {
      try {
        const body = await this.readBody(req);
        const strategy = JSON.parse(body);
        
        const strategyExecutor = this.agent.getStrategyExecutor();
        const executable = strategyExecutor.compileStrategy(strategy);
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: {
            id: executable.id,
            code: executable.code,
            compiledAt: executable.compiledAt,
            version: executable.version,
          },
        }));
      } catch (error) {
        logger.error('编译策略失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }
    
    // POST /api/strategies/execute - 执行策略
    if (url === '/api/strategies/execute' && method === 'POST') {
      try {
        const body = await this.readBody(req);
        const { strategyId, context } = JSON.parse(body);
        
        const strategyExecutor = this.agent.getStrategyExecutor();
        const result = strategyExecutor.executeStrategy(strategyId, context || {});
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: result,
        }));
      } catch (error) {
        logger.error('执行策略失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }
    
    // GET /api/strategies/executable - 获取所有可执行策略
    if (url === '/api/strategies/executable' && method === 'GET') {
      try {
        const strategyExecutor = this.agent.getStrategyExecutor();
        const executables = strategyExecutor.getAllExecutableStrategies();
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: executables.map(e => ({
            id: e.id,
            sourceStrategy: e.sourceStrategy,
            code: e.code,
            compiledAt: e.compiledAt,
            version: e.version,
            executionStats: e.executionStats,
            isActive: e.isActive,
          })),
        }));
      } catch (error) {
        logger.error('获取可执行策略失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }
    
    // GET /api/strategies/execution-stats - 获取执行统计
    if (url === '/api/strategies/execution-stats' && method === 'GET') {
      try {
        const strategyExecutor = this.agent.getStrategyExecutor();
        const stats = strategyExecutor.getExecutionStats();
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: stats,
        }));
      } catch (error) {
        logger.error('获取执行统计失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }
    
    // GET /api/strategies/execution-report - 获取执行报告
    if (url === '/api/strategies/execution-report' && method === 'GET') {
      try {
        const strategyExecutor = this.agent.getStrategyExecutor();
        const report = strategyExecutor.generateReport();
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: { report },
        }));
      } catch (error) {
        logger.error('生成执行报告失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // ==================== Phase 5: Reflection APIs ====================
    
    // GET /api/reflection/status - 获取反思引擎状态
    if (url === '/api/reflection/status' && method === 'GET') {
      try {
        const reflectionEngine = this.agent.getReflectionEngine();
        const state = reflectionEngine?.getState?.();
        const triggerEngine = reflectionEngine?.getTriggerEngine?.();
        const perfStats = triggerEngine?.getPerformanceStats?.();
        
        const data = {
          initialized: !!reflectionEngine,
          running: state?.running ?? false,
          approvalMode: state?.currentMode || 'conservative',
          pendingApprovals: state?.pendingActionsCount || 0,
          reflectionCount: state?.reflectionCount || 0,
          appliedInsightsCount: state?.appliedInsightsCount || 0,
          lastReflectionAt: state?.lastReflectionAt,
          performance: perfStats ? {
            avgResponseTime: Math.round(perfStats.avgResponseTime),
            successRate: Math.round(perfStats.successRate * 1000) / 10,
            sampleCount: perfStats.sampleCount,
            consecutiveFailures: perfStats.consecutiveFailures,
          } : null,
        };
        
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data }));
      } catch (error) {
        logger.error('获取反思状态失败', { error });
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: {
            initialized: false,
            running: false,
            approvalMode: 'conservative',
            pendingApprovals: 0,
            reflectionCount: 0,
            appliedInsightsCount: 0,
          },
        }));
      }
      return;
    }

    // GET /api/reflection/performance - 获取性能指标
    if (url === '/api/reflection/performance' && method === 'GET') {
      try {
        const reflectionEngine = this.agent.getReflectionEngine?.();
        const triggerEngine = reflectionEngine?.getTriggerEngine?.();
        const perfStats = triggerEngine?.getPerformanceStats?.();
        const agentStatus = this.agent.getStatus();
        const memUsage = process.memoryUsage();
        
        // 计算响应时间趋势
        const recentTimes = perfStats?.recentResponseTimes?.slice(-10) || [];
        const olderTimes = perfStats?.recentResponseTimes?.slice(-20, -10) || [];
        const recentAvg = recentTimes.length > 0 
          ? recentTimes.reduce((a: number, b: number) => a + b, 0) / recentTimes.length 
          : 0;
        const olderAvg = olderTimes.length > 0 
          ? olderTimes.reduce((a: number, b: number) => a + b, 0) / olderTimes.length 
          : recentAvg;
        
        let trend: 'improving' | 'stable' | 'degrading' = 'stable';
        if (recentAvg > olderAvg * 1.2) trend = 'degrading';
        else if (recentAvg < olderAvg * 0.8) trend = 'improving';
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: {
            responseTime: {
              average: Math.round(perfStats?.avgResponseTime || 0),
              recent: Math.round(recentAvg),
              trend,
            },
            successRate: {
              current: Math.round((perfStats?.successRate || 1) * 1000) / 10,
              sampleCount: perfStats?.sampleCount || 0,
            },
            consecutiveFailures: perfStats?.consecutiveFailures || 0,
            memoryUsage: {
              heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
              heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
              rss: Math.round(memUsage.rss / 1024 / 1024),
            },
            emotion: agentStatus.emotion,
            messageCount: agentStatus.messageCount,
          },
        }));
      } catch (error) {
        logger.error('获取性能指标失败', { error });
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: {
            responseTime: { average: 0, recent: 0, trend: 'stable' },
            successRate: { current: 100, sampleCount: 0 },
            consecutiveFailures: 0,
            memoryUsage: { heapUsed: 0, heapTotal: 0, rss: 0 },
          },
        }));
      }
      return;
    }

    // GET /api/reflection/token-budget - 获取Token预算
    if (url === '/api/reflection/token-budget' && method === 'GET') {
      try {
        let data = null;
        try {
          const promptAssembler = this.agent.getPromptAssembler?.();
          const budgetManager = promptAssembler?.getTokenBudgetManager?.();
          if (budgetManager) {
            data = {
              budget: budgetManager.getBudget(),
              totalBudget: budgetManager.getTotalBudget(),
              usageReport: budgetManager.getUsageReport(),
            };
          }
        } catch (e) {
          // 忽略错误
        }
        
        if (!res.headersSent) {
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            data: data || {
              budget: { system: 0.2, self: 0.4, memory: 0.3, user: 0.1 },
              totalBudget: 8192,
              usageReport: {
                totalBudget: 8192,
                averageUsage: { prompt: 0, completion: 0, total: 0 },
                utilizationRate: 0,
                historyCount: 0,
              },
            },
          }));
        }
      } catch (error) {
        logger.error('获取Token预算失败', { error });
        if (!res.headersSent) {
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, data: null }));
        }
      }
      return;
    }

    // GET /api/reflection/pending - 获取待审批列表
    if (url === '/api/reflection/pending' && method === 'GET') {
      try {
        let pending: any[] = [];
        try {
          const reflectionEngine = this.agent.getReflectionEngine();
          pending = reflectionEngine?.getPendingActions?.() || [];
        } catch (e) {
          // 忽略错误，返回空数组
        }
        if (!res.headersSent) {
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, data: pending }));
        }
      } catch (error) {
        logger.error('获取待审批列表失败', { error });
        if (!res.headersSent) {
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, data: [] }));
        }
      }
      return;
    }

    // GET /api/reflection/history - 获取反思历史
    if (url === '/api/reflection/history' && method === 'GET') {
      try {
        let history: any[] = [];
        try {
          const reflectionEngine = this.agent.getReflectionEngine();
          history = reflectionEngine?.getChangeHistory?.() || [];
        } catch (e) {
          // 忽略错误，返回空数组
        }
        if (!res.headersSent) {
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, data: history }));
        }
      } catch (error) {
        logger.error('获取反思历史失败', { error });
        if (!res.headersSent) {
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, data: [] }));
        }
      }
      return;
    }

    // POST /api/reflection/trigger - 触发反思
    if (url === '/api/reflection/trigger' && method === 'POST') {
      try {
        const reflectionEngine = this.agent.getReflectionEngine();
        const result = await reflectionEngine?.triggerReflection?.();
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: '反思已触发',
          data: result,
        }));
      } catch (error) {
        logger.error('触发反思失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
      return;
    }

    // PUT /api/reflection/mode - 切换审批模式
    if (url === '/api/reflection/mode' && method === 'PUT') {
      try {
        const body = await this.readBody(req);
        const { mode } = JSON.parse(body);
        const reflectionEngine = this.agent.getReflectionEngine();
        reflectionEngine?.setApprovalMode?.(mode);
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: `模式已切换为 ${mode}`,
        }));
      } catch (error) {
        logger.error('切换模式失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
      return;
    }

    // POST /api/reflection/approve/:id - 审批操作
    if (url.startsWith('/api/reflection/approve/') && method === 'POST') {
      try {
        const id = url.replace('/api/reflection/approve/', '');
        const body = await this.readBody(req);
        const { approved } = JSON.parse(body);
        
        if (approved) {
          const reflectionEngine = this.agent.getReflectionEngine();
          reflectionEngine?.approveAction?.(id);
        }
        
        if (!res.headersSent) {
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            message: approved ? '已批准' : '已拒绝',
          }));
        }
      } catch (error) {
        logger.error('审批操作失败', { error });
        if (!res.headersSent) {
          res.writeHead(500);
          res.end(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }));
        }
      }
      return;
    }

    // ==================== Phase 6: Soft Self-Reference APIs ====================

    // GET /api/evolution/variants - 获取所有提示词变体
    if (url === '/api/evolution/variants' && method === 'GET') {
      try {
        let variants: any[] = [];
        try {
          const reflectionEngine = this.agent.getReflectionEngine();
          const softRefEngine = reflectionEngine?.getSoftSelfReferenceEngine?.();
          variants = softRefEngine?.getAllVariants?.() || [];
        } catch (e) {
          // 忽略错误
        }
        if (!res.headersSent) {
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, data: variants }));
        }
      } catch (error) {
        logger.error('获取变体失败', { error });
        if (!res.headersSent) {
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, data: [] }));
        }
      }
      return;
    }

    // GET /api/evolution/ab-tests - 获取所有A/B测试
    if (url === '/api/evolution/ab-tests' && method === 'GET') {
      try {
        let tests: any[] = [];
        try {
          const reflectionEngine = this.agent.getReflectionEngine();
          const softRefEngine = reflectionEngine?.getSoftSelfReferenceEngine?.();
          tests = softRefEngine?.getABTests?.() || [];
        } catch (e) {
          // 忽略错误
        }
        if (!res.headersSent) {
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, data: tests }));
        }
      } catch (error) {
        logger.error('获取A/B测试失败', { error });
        if (!res.headersSent) {
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, data: [] }));
        }
      }
      return;
    }

    // GET /api/evolution/stats - 获取进化统计
    if (url === '/api/evolution/stats' && method === 'GET') {
      try {
        let stats = null;
        try {
          const reflectionEngine = this.agent.getReflectionEngine();
          stats = reflectionEngine?.getEvolutionStats?.();
        } catch (e) {
          // 忽略错误
        }
        if (!res.headersSent) {
          res.writeHead(200);
          res.end(JSON.stringify({ 
            success: true, 
            data: stats || {
              variantCount: 0,
              activeVariantCount: 0,
              activeTestCount: 0,
              completedTestCount: 0,
            }
          }));
        }
      } catch (error) {
        logger.error('获取进化统计失败', { error });
        if (!res.headersSent) {
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, data: null }));
        }
      }
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

    // DELETE /api/chat/history - 清除对话历史
    if (url === '/api/chat/history' && method === 'DELETE') {
      try {
        this.agent.clearConversationHistory();
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: '对话历史已清除',
        }));
      } catch (error) {
        logger.error('清除对话历史失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
      return;
    }

    // POST /api/chat/think - 带思维链的聊天
    if (url === '/api/chat/think' && method === 'POST') {
      try {
        const body = await this.readBody(req);
        const { message, options } = JSON.parse(body);

        if (!message) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Message is required' }));
          return;
        }

        // 动态导入思维链系统
        const { ThinkingSystemIntegration } = await import('@/core/cognition/thinking');
        const thinkingIntegration = new ThinkingSystemIntegration(this.agent);

        const result = await thinkingIntegration.processWithThinking(message, options);

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: {
            content: result.response,
            thinking: result.thinking,
            chain: result.chain ? {
              id: result.chain.id,
              classification: result.chain.classification,
              template: result.chain.template.name,
              steps: result.chain.steps.map(s => ({
                name: s.name,
                content: s.content.slice(0, 500), // 截断显示
                durationMs: s.durationMs,
              })),
              totalDurationMs: result.chain.totalDurationMs,
            } : null,
          },
        }));
      } catch (error) {
        logger.error('思维链处理失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
      return;
    }

    // POST /api/chat/think-stream - 带思维链的聊天 (SSE 实时流)
    if (url === '/api/chat/think-stream' && method === 'POST') {
      try {
        const body = await this.readBody(req);
        const { message, options } = JSON.parse(body);

        if (!message) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Message is required' }));
          return;
        }

        // 设置 SSE 头
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        // 发送初始事件
        res.write(`event: start\ndata: ${JSON.stringify({ message: '开始思考...' })}\n\n`);

        // 动态导入思维链系统
        const { ChainOfThoughtEngine } = await import('@/core/cognition/thinking');
        const engine = new ChainOfThoughtEngine();

        // 执行思维链，每步回调发送进度
        const startTime = Date.now();
        let stepIndex = 0;

        const chain = await engine.execute(
          message,
          { enableThinkingOutput: true, ...options },
          async (prompt) => {
            // 通知前端开始新步骤
            stepIndex++;
            res.write(`event: step-start\ndata: ${JSON.stringify({ step: stepIndex })}\n\n`);

            // 调用模型生成
            const startStepTime = Date.now();

            // 这里简化处理，实际应该调用 agent 的模型
            // 为了演示，使用模拟延迟
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 模拟模型回复
            const stepName = prompt.match(/=== 当前步骤：(.+?) ===/)?.[1] || `步骤${stepIndex}`;
            const content = `[${stepName}的思考内容] 基于提示词分析和推理...`;

            const durationMs = Date.now() - startStepTime;

            // 发送步骤完成事件
            res.write(`event: step-complete\ndata: ${JSON.stringify({
              step: stepIndex,
              name: stepName,
              content: content,
              durationMs: durationMs,
            })}\n\n`);

            return content;
          }
        );

        // 发送完成事件
        const totalDurationMs = Date.now() - startTime;
        res.write(`event: complete\ndata: ${JSON.stringify({
          content: chain.finalAnswer || '未能生成答案',
          chain: {
            id: chain.id,
            classification: chain.classification,
            template: chain.template.name,
            stepCount: chain.steps.length,
            totalDurationMs: totalDurationMs,
          },
        })}\n\n`);

        res.end();
      } catch (error) {
        logger.error('思维链流处理失败', { error });
        res.write(`event: error\ndata: ${JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        })}\n\n`);
        res.end();
      }
      return;
    }

    // ==================== 系统资源监控 API ====================

    // GET /api/system/resources - 获取系统资源状态
    if (url === '/api/system/resources' && method === 'GET') {
      try {
        const bodyManager = this.agent.getBodyManager?.();
        const resources = bodyManager?.getResourceStatus?.();
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: resources || {
            cpu: { usage: 0, loadAverage: [0, 0, 0] },
            memory: { total: 0, used: 0, usage: 0 },
            disk: { total: 0, used: 0, usage: 0 },
            network: { online: true, interfaces: [] },
            uptime: 0,
          },
        }));
      } catch (error) {
        logger.error('获取系统资源失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // GET /api/system/hormones - 获取激素水平历史
    if (url === '/api/system/hormones' && method === 'GET') {
      try {
        const status = this.agent.getStatus?.();
        const hormoneSystem = (this.agent as any).hormoneSystem;
        const history = hormoneSystem?.getHistory?.() || [];
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: {
            current: status?.hormoneLevels || {},
            history: history.slice(-50), // 最近50个数据点
          },
        }));
      } catch (error) {
        logger.error('获取激素历史失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // GET /api/system/performance - 获取性能指标历史
    if (url === '/api/system/performance' && method === 'GET') {
      try {
        const reflectionEngine = this.agent.getReflectionEngine?.();
        const triggerEngine = reflectionEngine?.getTriggerEngine?.();
        const perfHistory = triggerEngine?.getPerformanceHistory?.() || [];
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: perfHistory.slice(-100), // 最近100个数据点
        }));
      } catch (error) {
        logger.error('获取性能历史失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // GET /api/system/triggers - 获取触发器状态
    if (url === '/api/system/triggers' && method === 'GET') {
      try {
        const reflectionEngine = this.agent.getReflectionEngine?.();
        const triggerEngine = reflectionEngine?.getTriggerEngine?.();
        const triggers = triggerEngine?.getTriggers?.() || [];
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: triggers,
        }));
      } catch (error) {
        logger.error('获取触发器状态失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // ==================== Phase 5: 监控图表 API ====================

    // GET /api/monitor/performance-history - 获取性能历史数据
    if (url === '/api/monitor/performance-history' && method === 'GET') {
      try {
        const reflectionEngine = this.agent.getReflectionEngine?.();
        const triggerEngine = reflectionEngine?.getTriggerEngine?.();
        const perfHistory = triggerEngine?.getPerformanceHistory?.() || [];
        
        // 获取激素历史
        const hormoneSystem = this.agent.getHormoneSystem?.();
        const hormoneHistory = hormoneSystem?.getHistory?.() || [];
        
        // 获取模型调用统计
        const bayesianCore = this.agent.getBayesianCore?.();
        const toolConfidences = bayesianCore?.getAllToolConfidences?.() || new Map();
        
        // 转换工具置信度为数组
        const toolsArray = Array.from(toolConfidences.entries()).map(([name, conf]) => ({
          name,
          ...conf,
        }));
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: {
            performanceHistory: perfHistory.slice(-100),
            hormoneHistory: hormoneHistory.slice(-50),
            toolConfidences: toolsArray,
          },
        }));
      } catch (error) {
        logger.error('获取性能历史失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // GET /api/bayesian/history - 获取贝叶斯学习历史
    if (url === '/api/bayesian/history' && method === 'GET') {
      try {
        const bayesianCore = this.agent.getBayesianCore?.();
        const history = bayesianCore?.getLearningHistory?.() || [];
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: history.slice(-100),
        }));
      } catch (error) {
        logger.error('获取贝叶斯历史失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // GET /api/system/logs - 获取错误日志
    if (url === '/api/system/logs' && method === 'GET') {
      try {
        // 从日志文件读取（简化实现）
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: [],
          message: '日志功能需要集成日志系统',
        }));
      } catch (error) {
        logger.error('获取日志失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // ==================== 身体图式 API ====================

    // GET /api/body/sensors - 获取传感器状态
    if (url === '/api/body/sensors' && method === 'GET') {
      try {
        const bodyManager = this.agent.getBodyManager?.();
        const sensors = bodyManager?.getActiveSensors?.() || [];
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: sensors,
        }));
      } catch (error) {
        logger.error('获取传感器失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // GET /api/body/actuators - 获取执行器状态
    if (url === '/api/body/actuators' && method === 'GET') {
      try {
        const bodyManager = this.agent.getBodyManager?.();
        const actuators = (bodyManager as any)?.body?.actuators || [];
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: actuators,
        }));
      } catch (error) {
        logger.error('获取执行器失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // ==================== 世界模型 API ====================

    // GET /api/world/patterns - 获取模式列表
    if (url === '/api/world/patterns' && method === 'GET') {
      try {
        const worldModel = this.agent.getWorldModel?.();
        const patterns = worldModel?.getPatterns?.() || [];
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: patterns,
        }));
      } catch (error) {
        logger.error('获取模式失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // POST /api/world/patterns - 添加新模式
    if (url === '/api/world/patterns' && method === 'POST') {
      try {
        const body = await this.readBody(req);
        const { description, confidence } = JSON.parse(body);
        const worldModel = this.agent.getWorldModel?.();
        const id = worldModel?.addPattern?.(description, confidence);
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: { id },
        }));
      } catch (error) {
        logger.error('添加模式失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // GET /api/world/risks - 获取风险列表
    if (url === '/api/world/risks' && method === 'GET') {
      try {
        const worldModel = this.agent.getWorldModel?.();
        const risks = worldModel?.getActiveRisks?.() || [];
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: risks,
        }));
      } catch (error) {
        logger.error('获取风险失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // POST /api/world/risks - 添加新风险
    if (url === '/api/world/risks' && method === 'POST') {
      try {
        const body = await this.readBody(req);
        const { description, severity } = JSON.parse(body);
        const worldModel = this.agent.getWorldModel?.();
        const id = worldModel?.addRisk?.(description, severity);
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: { id },
        }));
      } catch (error) {
        logger.error('添加风险失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // PUT /api/world/risks/:id/resolve - 解决风险
    if (url.startsWith('/api/world/risks/') && url.endsWith('/resolve') && method === 'PUT') {
      try {
        const id = url.replace('/api/world/risks/', '').replace('/resolve', '');
        const worldModel = this.agent.getWorldModel?.();
        worldModel?.resolveRisk?.(id);
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: '风险已解决',
        }));
      } catch (error) {
        logger.error('解决风险失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // GET /api/world/opportunities - 获取机会列表
    if (url === '/api/world/opportunities' && method === 'GET') {
      try {
        const worldModel = this.agent.getWorldModel?.();
        const opportunities = worldModel?.getOpportunities?.() || [];
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: opportunities,
        }));
      } catch (error) {
        logger.error('获取机会失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // POST /api/world/opportunities - 添加新机会
    if (url === '/api/world/opportunities' && method === 'POST') {
      try {
        const body = await this.readBody(req);
        const { description, potential } = JSON.parse(body);
        const worldModel = this.agent.getWorldModel?.();
        const id = worldModel?.addOpportunity?.(description, potential);
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: { id },
        }));
      } catch (error) {
        logger.error('添加机会失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // ==================== 记忆管理 API ====================

    // GET /api/memory/list - 获取记忆列表
    if (url.startsWith('/api/memory/list') && method === 'GET') {
      try {
        const urlObj = new URL(url, `http://${req.headers.host}`);
        const type = urlObj.searchParams.get('type') as any;
        const importance = urlObj.searchParams.get('importance');
        const limit = parseInt(urlObj.searchParams.get('limit') || '20');
        const offset = parseInt(urlObj.searchParams.get('offset') || '0');
        
        const memorySystem = this.agent.getMemorySystem?.();
        let memories: any[] = [];
        
        if (type) {
          memories = memorySystem?.getMemoriesByType?.(type) || [];
        } else {
          memories = memorySystem?.getRecentMemories?.(limit + offset) || [];
        }
        
        // 按重要性筛选
        if (importance) {
          const minImportance = parseFloat(importance);
          memories = memories.filter((m: any) => m.importance >= minImportance);
        }
        
        // 按时间排序（最新的在前）
        memories.sort((a: any, b: any) => {
          const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
          const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
          return timeB - timeA;
        });
        
        // 分页
        const total = memories.length;
        memories = memories.slice(offset, offset + limit);
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: {
            memories,
            total,
            offset,
            limit,
          },
        }));
      } catch (error) {
        logger.error('获取记忆列表失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // GET /api/memory/search - 搜索记忆
    if (url.startsWith('/api/memory/search') && method === 'GET') {
      try {
        const urlObj = new URL(url, `http://${req.headers.host}`);
        const query = urlObj.searchParams.get('q') || '';
        const type = urlObj.searchParams.get('type') || 'keyword';
        const importance = urlObj.searchParams.get('importance');
        const limit = parseInt(urlObj.searchParams.get('limit') || '10');
        
        const memorySystem = this.agent.getMemorySystem?.();
        let results: any[] = [];
        
        if (type === 'keyword') {
          const keywords = query.split(/\s+/);
          results = memorySystem?.searchByKeywords?.(keywords, limit) || [];
        } else if (type === 'vector') {
          results = await memorySystem?.searchByVector?.(query, limit) || [];
        } else {
          results = await memorySystem?.retrieveRelevant?.(query, limit) || [];
        }
        
        // 按重要性筛选
        if (importance) {
          const minImportance = parseFloat(importance);
          results = results.filter((m: any) => m.importance >= minImportance);
        }
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: results,
        }));
      } catch (error) {
        logger.error('搜索记忆失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // GET /api/memory/:id - 获取记忆详情
    if (url.startsWith('/api/memory/') && !url.includes('/list') && !url.includes('/search') && method === 'GET') {
      try {
        const id = url.replace('/api/memory/', '');
        const memorySystem = this.agent.getMemorySystem?.();
        const memory = memorySystem?.getMemoryById?.(id);
        
        if (!memory) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'Memory not found' }));
          return;
        }
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: memory,
        }));
      } catch (error) {
        logger.error('获取记忆详情失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // DELETE /api/memory/:id - 删除记忆
    if (url.startsWith('/api/memory/') && method === 'DELETE') {
      try {
        const id = url.replace('/api/memory/', '');
        const memorySystem = this.agent.getMemorySystem?.();
        const deleted = memorySystem?.deleteMemory?.(id);
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: { deleted },
        }));
      } catch (error) {
        logger.error('删除记忆失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // POST /api/memory/export - 导出记忆
    if (url === '/api/memory/export' && method === 'POST') {
      try {
        const body = await this.readBody(req);
        const { format = 'json', ...options } = JSON.parse(body);
        
        const memorySystem = this.agent.getMemorySystem?.();
        const content = memorySystem?.exportMemories?.({ format, ...options });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          data: { content, format },
        }));
      } catch (error) {
        logger.error('导出记忆失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // POST /api/memory/import - 导入记忆
    if (url === '/api/memory/import' && method === 'POST') {
      try {
        const body = await this.readBody(req);
        const { content, format = 'json', ...options } = JSON.parse(body);
        
        const memorySystem = this.agent.getMemorySystem?.();
        const result = memorySystem?.importMemories?.(content, { format, ...options });
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: result,
        }));
      } catch (error) {
        logger.error('导入记忆失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // ==================== 工具与技能 API ====================

    // GET /api/tools - 获取工具列表 (简化端点)
    if (url === '/api/tools' && method === 'GET') {
      try {
        const toolSet = this.agent.getToolSet?.();
        const bayesianCore = this.agent.getBayesianCore?.();
        const tools = toolSet?.getAllTools?.() || [];
        const confidences = bayesianCore?.getAllToolConfidences?.() || new Map();
        
        // 合并工具信息和置信度
        const toolsWithConfidence = tools.map((tool: any) => {
          const confidence = confidences.get(tool.name);
          return {
            ...tool,
            confidence: confidence?.confidence || 0.5,
            uncertainty: confidence?.uncertainty || 0.25,
            successCount: confidence?.successCount || 0,
            failureCount: confidence?.failureCount || 0,
            totalCount: confidence?.totalCount || 0,
          };
        });
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: toolsWithConfidence,
        }));
      } catch (error) {
        logger.error('获取工具列表失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // GET /api/tools/list - 获取工具列表
    if (url.startsWith('/api/tools/list') && method === 'GET') {
      try {
        const toolSet = this.agent.getToolSet?.();
        const bayesianCore = this.agent.getBayesianCore?.();
        const tools = toolSet?.getAllTools?.() || [];
        const confidences = bayesianCore?.getAllToolConfidences?.() || new Map();
        
        // 合并工具信息和置信度
        const toolsWithConfidence = tools.map((tool: any) => {
          const confidence = confidences.get(tool.name);
          return {
            ...tool,
            confidence: confidence?.confidence || 0.5,
            uncertainty: confidence?.uncertainty || 0.25,
            successCount: confidence?.successCount || 0,
            failureCount: confidence?.failureCount || 0,
            totalCount: confidence?.totalCount || 0,
          };
        });
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: toolsWithConfidence,
        }));
      } catch (error) {
        logger.error('获取工具列表失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // POST /api/tools/execute - 执行工具
    if (url === '/api/tools/execute' && method === 'POST') {
      try {
        const body = await this.readBody(req);
        const { name, params = {} } = JSON.parse(body);
        
        const toolSet = this.agent.getToolSet?.();
        const result = await toolSet?.executeTool?.(name, params);
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: result,
        }));
      } catch (error) {
        logger.error('执行工具失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // GET /api/tools/history - 获取工具执行历史
    if (url.startsWith('/api/tools/history') && method === 'GET') {
      try {
        const urlObj = new URL(url, `http://${req.headers.host}`);
        const limit = parseInt(urlObj.searchParams.get('limit') || '20');
        
        const toolSet = this.agent.getToolSet?.();
        const history = toolSet?.getExecutionHistory?.(limit) || [];
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: history,
        }));
      } catch (error) {
        logger.error('获取工具历史失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // POST /api/tools/register - 注册新工具
    if (url === '/api/tools/register' && method === 'POST') {
      try {
        const body = await this.readBody(req);
        const { name, description, parameters: _parameters, handler: _handler } = JSON.parse(body);
        
        const toolSet = this.agent.getToolSet?.();
        toolSet?.registerTool?.({
          name,
          description,
          type: 'cli',
          status: 'available',
          confidence: 0.5,
          category: 'custom',
          capabilities: [],
          priority: 'medium',
        });
        
        // 同时在贝叶斯核心注册
        const bayesianCore = this.agent.getBayesianCore?.();
        bayesianCore?.registerTool?.(name, 0, 0);
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: `工具 ${name} 已注册`,
        }));
      } catch (error) {
        logger.error('注册工具失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // ==================== 技能 API ====================
    
    // GET /api/skills - 获取OpenClaw技能列表
    if (url.startsWith('/api/skills') && method === 'GET') {
      try {
        // OpenClaw技能目录列表
        const skills = [
          {
            id: 'coding-agent',
            name: 'Coding Agent',
            description: '运行 Codex CLI, Claude Code, OpenCode 或 Pi Coding Agent 进行代码审查和开发',
            category: 'development',
            icon: '💻',
            status: 'available',
            version: '1.0.0',
          },
          {
            id: 'github',
            name: 'GitHub',
            description: '使用 gh CLI 管理 issues, PRs, CI 运行和高级查询',
            category: 'development',
            icon: '🐙',
            status: 'available',
            version: '1.0.0',
          },
          {
            id: 'canvas',
            name: 'Canvas',
            description: '在节点上展示HTML游戏和可视化内容',
            category: 'media',
            icon: '🎨',
            status: 'available',
            version: '1.0.0',
          },
          {
            id: 'video-frames',
            name: 'Video Frames',
            description: '使用 ffmpeg 提取视频帧或短片段',
            category: 'media',
            icon: '🎬',
            status: 'available',
            version: '1.0.0',
          },
          {
            id: 'weather',
            name: 'Weather',
            description: '获取当前天气和预报（无需API密钥）',
            category: 'system',
            icon: '🌤️',
            status: 'available',
            version: '1.0.0',
          },
          {
            id: 'healthcheck',
            name: 'Health Check',
            description: '系统安全审计和加固，检查防火墙/SSH/更新等',
            category: 'system',
            icon: '🔒',
            status: 'available',
            version: '1.0.0',
          },
          {
            id: 'tmux',
            name: 'Tmux',
            description: '远程控制 tmux 会话，发送按键和获取输出',
            category: 'system',
            icon: '🖥️',
            status: 'available',
            version: '1.0.0',
          },
          {
            id: 'notion',
            name: 'Notion',
            description: 'Notion API 集成，操作页面和数据库',
            category: 'productivity',
            icon: '📝',
            status: 'available',
            version: '1.0.0',
          },
          {
            id: 'browser',
            name: 'Browser',
            description: '通过 Playwright 控制浏览器自动化',
            category: 'system',
            icon: '🌐',
            status: 'available',
            version: '1.0.0',
          },
          {
            id: 'web_search',
            name: 'Web Search',
            description: '使用 Brave Search API 搜索网络',
            category: 'system',
            icon: '🔍',
            status: 'available',
            version: '1.0.0',
          },
          {
            id: 'tts',
            name: 'Text to Speech',
            description: '文本转语音，支持 ElevenLabs 和系统 TTS',
            category: 'media',
            icon: '🔊',
            status: 'available',
            version: '1.0.0',
          },
          {
            id: 'image',
            name: 'Image Analysis',
            description: '使用视觉模型分析图像',
            category: 'media',
            icon: '🖼️',
            status: 'available',
            version: '1.0.0',
          },
          {
            id: 'discord',
            name: 'Discord',
            description: 'Discord 消息发送和频道管理',
            category: 'communication',
            icon: '💬',
            status: 'available',
            version: '1.0.0',
          },
          {
            id: 'telegram',
            name: 'Telegram',
            description: 'Telegram Bot 消息和群组管理',
            category: 'communication',
            icon: '📱',
            status: 'available',
            version: '1.0.0',
          },
          {
            id: 'skill-creator',
            name: 'Skill Creator',
            description: '创建和打包自定义 Agent 技能',
            category: 'development',
            icon: '🛠️',
            status: 'available',
            version: '1.0.0',
          },
          {
            id: 'cron',
            name: 'Cron Jobs',
            description: '管理定时任务和提醒',
            category: 'system',
            icon: '⏰',
            status: 'available',
            version: '1.0.0',
          },
          {
            id: 'nodes',
            name: 'Nodes',
            description: '发现和控制配对的节点设备',
            category: 'system',
            icon: '📡',
            status: 'available',
            version: '1.0.0',
          },
          {
            id: 'openai-whisper',
            name: 'OpenAI Whisper',
            description: '本地语音转文本，无需API密钥',
            category: 'media',
            icon: '🎤',
            status: 'available',
            version: '1.0.0',
          },
        ];
        
        // 支持按类别筛选
        const category = new URL(req.url || '', `http://${req.headers.host}`).searchParams.get('category');
        let filteredSkills = skills;
        if (category) {
          filteredSkills = skills.filter(s => s.category === category);
        }
        
        // 支持搜索
        const search = new URL(req.url || '', `http://${req.headers.host}`).searchParams.get('search');
        if (search) {
          const searchLower = search.toLowerCase();
          filteredSkills = filteredSkills.filter(s => 
            s.name.toLowerCase().includes(searchLower) ||
            s.description.toLowerCase().includes(searchLower)
          );
        }
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: filteredSkills,
          total: filteredSkills.length,
          categories: ['development', 'media', 'system', 'productivity', 'communication'],
        }));
      } catch (error) {
        logger.error('获取技能列表失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // ==================== 调试 API ====================
    
    // GET /api/debug/tokens - 获取详细Token统计
    if (url === '/api/debug/tokens' && method === 'GET') {
      try {
        const promptAssembler = this.agent.getPromptAssembler?.();
        const budgetManager = promptAssembler?.getTokenBudgetManager?.();
        
        const debugInfo = this.agent.getLastDebugInfo?.();
        
        // 计算Token使用量
        const systemTokens = Math.ceil((debugInfo?.systemPrompt?.length || 0) / 3);
        const memoryTokens = Math.ceil((debugInfo?.memoryContext?.length || 0) / 3);
        const userMessage = (debugInfo?.messages as Array<{role: string; content?: string}> | undefined)?.find(m => m.role === 'user');
        const userTokens = userMessage?.content?.length 
          ? Math.ceil(userMessage.content.length / 3)
          : 0;
        const selfDescTokens = Math.ceil((JSON.stringify(debugInfo?.selfDescription)?.length || 0) / 3);
        
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: {
            breakdown: {
              system: systemTokens,
              memory: memoryTokens,
              user: userTokens,
              selfDescription: selfDescTokens,
              total: systemTokens + memoryTokens + userTokens + selfDescTokens,
            },
            budget: budgetManager?.getBudget?.() || null,
            utilization: budgetManager?.getUsageReport?.() || null,
          },
        }));
      } catch (error) {
        logger.error('获取Token统计失败', { error });
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
      return;
    }

    // 404
    if (!res.headersSent) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'API endpoint not found' }));
    }
  }

  /**
   * 处理静态文件请求
   */
  private handleStaticFile(
    _req: IncomingMessage,
    res: ServerResponse,
    url: string
  ): void {
    try {
      // 默认首页
      let filePath = url === '/' ? '/index.html' : url;
      
      // 安全限制：防止目录遍历
      if (filePath.includes('..')) {
        if (!res.headersSent) {
          res.writeHead(403);
          res.end('Forbidden');
        }
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
        if (!res.headersSent) {
          res.writeHead(404);
          res.end('Not Found');
        }
        return;
      }

      // 确定 Content-Type
      const ext = filePath.split('.').pop() || '';
      const contentType = this.getContentType(ext);

      this.serveFile(res, fullPath, contentType);
    } catch (error) {
      logger.error('处理静态文件失败', { url, error });
      if (!res.headersSent) {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    }
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
      if (!res.headersSent) {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    } catch (error) {
      logger.error('读取文件失败', { filePath, error });
      if (!res.headersSent) {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
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
