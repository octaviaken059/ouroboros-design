/**
 * Web 服务器 - 支持 Ollama + Stream + Think
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { ModelEngine, createOllamaEngine } from '../execution/model-engine.js';
import { Logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = new Logger('info');

// 创建 Ollama 引擎
const modelEngine = createOllamaEngine(
  process.env.OPENAI_MODEL || 'deepseek-r1:8b',
  process.env.OLLAMA_BASE_URL || 'http://host.docker.internal:11434'
);

export function createWebServer(port: number = 8080) {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  // 中间件
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../pages')));

  // CORS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  // 健康检查
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      model: modelEngine.getConfig().model,
      provider: modelEngine.getConfig().provider,
    });
  });

  // 模型信息
  app.get('/api/model', (req, res) => {
    res.json({
      model: modelEngine.getConfig().model,
      provider: modelEngine.getConfig().provider,
      supportsThinking: modelEngine.getConfig().model.includes('deepseek'),
      supportsStreaming: true,
    });
  });

  // 非流式聊天
  app.post('/api/chat', async (req, res) => {
    try {
      const { messages, temperature = 0.7, maxTokens = 4096 } = req.body;
      
      modelEngine.updateConfig({ temperature, maxTokens });
      
      const result = await modelEngine.complete(messages);
      
      res.json({
        content: result.content,
        thinking: extractThinking(result.content),
        usage: result.usage,
        latencyMs: result.latencyMs,
      });
    } catch (error) {
      logger.error('Chat error:', error);
      res.status(500).json({ error: String(error) });
    }
  });

  // 流式聊天 (SSE)
  app.post('/api/chat/stream', async (req, res) => {
    try {
      const { messages, temperature = 0.7, maxTokens = 4096 } = req.body;
      
      modelEngine.updateConfig({ temperature, maxTokens });
      
      // 设置 SSE 头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      const stream = modelEngine.stream(messages);
      let fullContent = '';
      let fullThinking = '';
      
      for await (const chunk of stream) {
        const data: any = {};
        
        if (chunk.content) {
          data.content = chunk.content;
          fullContent += chunk.content;
        }
        
        if (chunk.thinking) {
          data.thinking = chunk.thinking;
          fullThinking += chunk.thinking;
        }
        
        if (chunk.finishReason) {
          data.finishReason = chunk.finishReason;
        }
        
        if (chunk.usage) {
          data.usage = chunk.usage;
        }
        
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        
        if (chunk.finishReason) {
          break;
        }
      }
      
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      logger.error('Stream error:', error);
      res.write(`data: ${JSON.stringify({ error: String(error) })}\n\n`);
      res.end();
    }
  });

  // WebSocket 处理
  wss.on('connection', (ws: WebSocket) => {
    logger.info('WebSocket client connected');
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'chat') {
          const { messages, stream = false } = message;
          
          if (stream) {
            // 流式响应
            const streamGen = modelEngine.stream(messages);
            
            for await (const chunk of streamGen) {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'chunk',
                  content: chunk.content,
                  thinking: chunk.thinking,
                  finishReason: chunk.finishReason,
                }));
              }
            }
          } else {
            // 非流式响应
            const result = await modelEngine.complete(messages);
            
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'complete',
                content: result.content,
                thinking: extractThinking(result.content),
                usage: result.usage,
              }));
            }
          }
        }
      } catch (error) {
        logger.error('WebSocket error:', error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'error',
            error: String(error),
          }));
        }
      }
    });
    
    ws.on('close', () => {
      logger.info('WebSocket client disconnected');
    });
  });

  // 启动服务器
  server.listen(port, () => {
    logger.info(`🚀 Ouroboros Web Server running on port ${port}`);
    logger.info(`📊 API: http://localhost:${port}/api/health`);
    logger.info(`💬 Chat: http://localhost:${port}/api/chat`);
    logger.info(`🌊 Stream: http://localhost:${port}/api/chat/stream`);
    logger.info(`🧠 Model: ${modelEngine.getConfig().model}`);
  });

  return { app, server, wss };
}

// 提取 thinking 内容
function extractThinking(content: string): string | undefined {
  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
  return thinkMatch ? thinkMatch[1].trim() : undefined;
}

export default createWebServer;
