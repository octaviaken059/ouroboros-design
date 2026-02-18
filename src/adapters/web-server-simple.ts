/**
 * 简化版 Web 服务器 - Ollama + Stream + Think
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const PORT = parseInt(process.env.OURO_PORT || '8080', 10);
const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://host.docker.internal:11434';
const MODEL = process.env.OPENAI_MODEL || 'deepseek-r1:8b';

console.log('🔧 Configuration:');
console.log(`  Port: ${PORT}`);
console.log(`  Ollama URL: ${OLLAMA_URL}`);
console.log(`  Model: ${MODEL}`);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, '../pages')));

// 默认路由 - 返回聊天页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../pages/index.html'));
});

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
    model: MODEL,
    provider: 'ollama',
  });
});

// 模型信息
app.get('/api/model', (req, res) => {
  res.json({
    model: MODEL,
    provider: 'ollama',
    supportsThinking: MODEL.includes('deepseek'),
    supportsStreaming: true,
  });
});

// 调用 Ollama API
async function* streamOllama(messages: any[], temperature: number = 0.7) {
  const url = `${OLLAMA_URL}/api/chat`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      options: { temperature },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let thinkingBuffer = '';
  let inThinking = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const result: any = {};

          if (parsed.message?.content) {
            const content = parsed.message.content;
            
            // Parse deepseek-r1 thinking tags
            if (content.includes('<think>')) {
              inThinking = true;
              const thinkStart = content.indexOf('<think>');
              const thinkEnd = content.indexOf('</think>');
              
              if (thinkEnd > -1) {
                thinkingBuffer = content.substring(thinkStart + 7, thinkEnd);
                result.thinking = thinkingBuffer;
                result.content = content.substring(0, thinkStart) + content.substring(thinkEnd + 8);
                inThinking = false;
                thinkingBuffer = '';
              } else {
                thinkingBuffer = content.substring(thinkStart + 7);
              }
            } else if (inThinking) {
              const thinkEnd = content.indexOf('</think>');
              if (thinkEnd > -1) {
                thinkingBuffer += content.substring(0, thinkEnd);
                result.thinking = thinkingBuffer;
                result.content = content.substring(thinkEnd + 8);
                inThinking = false;
                thinkingBuffer = '';
              } else {
                thinkingBuffer += content;
              }
            } else {
              result.content = content;
            }
          }

          if (parsed.done) {
            result.finishReason = 'stop';
            result.usage = {
              promptTokens: parsed.prompt_eval_count || 0,
              completionTokens: parsed.eval_count || 0,
            };
          }

          if (Object.keys(result).length > 0) {
            yield result;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// 流式聊天 (SSE)
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { messages, temperature = 0.7 } = req.body;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const stream = streamOllama(messages, temperature);
    
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      
      if (chunk.finishReason) {
        break;
      }
    }
    
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Stream error:', error);
    res.write(`data: ${JSON.stringify({ error: String(error) })}\n\n`);
    res.end();
  }
});

// 非流式聊天
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, temperature = 0.7 } = req.body;
    
    const url = `${OLLAMA_URL}/api/chat`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: false,
        options: { temperature },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.message?.content || '';
    
    // Extract thinking
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
    const thinking = thinkMatch ? thinkMatch[1].trim() : undefined;
    const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
    
    res.json({
      content: cleanContent,
      thinking,
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// WebSocket 处理
wss.on('connection', (ws: WebSocket) => {
  console.log('WebSocket client connected');
  
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'chat') {
        const { messages, stream = false, temperature = 0.7 } = message;
        
        if (stream) {
          const streamGen = streamOllama(messages, temperature);
          
          for await (const chunk of streamGen) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'chunk',
                ...chunk,
              }));
            }
          }
          
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'done' }));
          }
        } else {
          const url = `${OLLAMA_URL}/api/chat`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: MODEL,
              messages,
              stream: false,
              options: { temperature },
            }),
          });

          const data = await response.json();
          const content = data.message?.content || '';
          const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
          
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'complete',
              content: content.replace(/<think>[\s\S]*?<\/think>/, '').trim(),
              thinking: thinkMatch ? thinkMatch[1].trim() : undefined,
              usage: {
                promptTokens: data.prompt_eval_count || 0,
                completionTokens: data.eval_count || 0,
              },
            }));
          }
        }
      }
    } catch (error) {
      console.error('WebSocket error:', error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', error: String(error) }));
      }
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// 启动服务器
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🚀 Ouroboros + Ollama Web Server');
  console.log('');
  console.log(`📊 Health:  http://localhost:${PORT}/api/health`);
  console.log(`💬 Chat:    http://localhost:${PORT}/api/chat`);
  console.log(`🌊 Stream:  http://localhost:${PORT}/api/chat/stream`);
  console.log(`ℹ️  Model:   http://localhost:${PORT}/api/model`);
  console.log('');
  console.log(`🧠 Model: ${MODEL}`);
  console.log(`🔌 Provider: Ollama`);
  console.log(`💭 Think: ${MODEL.includes('deepseek') ? 'Enabled' : 'Disabled'}`);
  console.log('');
});
