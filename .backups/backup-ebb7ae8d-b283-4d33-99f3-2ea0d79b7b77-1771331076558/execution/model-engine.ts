/**
 * 模型引擎 (Model Engine)
 * 
 * 统一封装 OpenAI / Ollama API，支持流式响应
 * 位置: 执行层 (Execution Layer)
 */

import { EventEmitter } from 'events';

// ============================================================================
// 类型定义
// ============================================================================

export interface ModelConfig {
  provider: 'openai' | 'ollama';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface StreamChunk {
  content?: string;
  toolCalls?: ToolCall[];
  finishReason?: 'stop' | 'length' | 'tool_calls' | null;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface CompletionResult {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

// OpenAI API Response Types
interface OpenAICompletionResponse {
  choices: Array<{
    message?: {
      content?: string;
      tool_calls?: ToolCall[];
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface OpenAIEmbeddingResponse {
  data?: Array<{
    embedding?: number[];
  }>;
  usage?: {
    prompt_tokens?: number;
    total_tokens?: number;
  };
}

// Ollama API Response Types
interface OllamaCompletionResponse {
  message?: {
    content?: string;
    tool_calls?: ToolCall[];
  };
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaEmbeddingResponse {
  embedding?: number[];
}

// ============================================================================
// 模型引擎主类
// ============================================================================

export class ModelEngine extends EventEmitter {
  private config: ModelConfig;
  private abortController: AbortController | null = null;

  constructor(config: ModelConfig) {
    super();
    this.config = {
      temperature: 0.7,
      maxTokens: 4096,
      timeoutMs: 60000,
      ...config,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ModelConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): ModelConfig {
    return { ...this.config };
  }

  /**
   * 非流式完成请求
   */
  async complete(
    messages: Message[],
    tools?: ToolDefinition[]
  ): Promise<CompletionResult> {
    const startTime = Date.now();

    try {
      if (this.config.provider === 'openai') {
        return await this.callOpenAI(messages, tools, false) as CompletionResult;
      } else {
        return await this.callOllama(messages, tools, false) as CompletionResult;
      }
    } finally {
      this.emit('requestComplete', { latencyMs: Date.now() - startTime });
    }
  }

  /**
   * 流式完成请求
   */
  async *stream(
    messages: Message[],
    tools?: ToolDefinition[]
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const startTime = Date.now();
    this.abortController = new AbortController();

    try {
      if (this.config.provider === 'openai') {
        const result = await this.callOpenAI(messages, tools, true);
        yield* result as AsyncGenerator<StreamChunk>;
      } else {
        const result = await this.callOllama(messages, tools, true);
        yield* result as AsyncGenerator<StreamChunk>;
      }
    } finally {
      this.emit('requestComplete', { latencyMs: Date.now() - startTime });
      this.abortController = null;
    }
  }

  /**
   * 生成嵌入向量
   */
  async embed(text: string): Promise<EmbeddingResult> {
    const startTime = Date.now();

    try {
      if (this.config.provider === 'openai') {
        return await this.embedOpenAI(text);
      } else {
        return await this.embedOllama(text);
      }
    } finally {
      this.emit('embeddingComplete', { latencyMs: Date.now() - startTime });
    }
  }

  /**
   * 中断当前请求
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.emit('aborted');
    }
  }

  // ============================================================================
  // OpenAI API 调用
  // ============================================================================

  private async callOpenAI(
    messages: Message[],
    tools: ToolDefinition[] | undefined,
    stream: boolean
  ): Promise<CompletionResult | AsyncGenerator<StreamChunk>> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new ModelEngineError('OpenAI API key is required', 'CONFIG_ERROR');
    }

    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    const url = `${baseUrl}/chat/completions`;

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.tool_calls && { tool_calls: m.tool_calls }),
        ...(m.tool_call_id && { tool_call_id: m.tool_call_id }),
      })),
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    if (stream) {
      return this.streamOpenAI(url, apiKey, body);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ModelEngineError(
        `OpenAI API error: ${response.status} - ${error}`,
        'API_ERROR',
        { status: response.status }
      );
    }

    const data = await response.json() as OpenAICompletionResponse;
    const choice = data.choices[0];

    return {
      content: choice.message?.content || '',
      toolCalls: choice.message?.tool_calls,
      finishReason: choice.finish_reason || 'stop',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      latencyMs: 0, // 由外层计算
    };
  }

  private async *streamOpenAI(
    url: string,
    apiKey: string,
    body: Record<string, unknown>
  ): AsyncGenerator<StreamChunk> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ModelEngineError(
        `OpenAI API error: ${response.status} - ${error}`,
        'API_ERROR',
        { status: response.status }
      );
    }

    if (!response.body) {
      throw new ModelEngineError('Response body is null', 'STREAM_ERROR');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            const finishReason = parsed.choices?.[0]?.finish_reason;

            const chunk: StreamChunk = {};

            if (delta?.content) {
              chunk.content = delta.content;
            }

            if (delta?.tool_calls) {
              chunk.toolCalls = delta.tool_calls;
            }

            if (finishReason) {
              chunk.finishReason = finishReason;
            }

            if (Object.keys(chunk).length > 0) {
              yield chunk;
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async embedOpenAI(text: string): Promise<EmbeddingResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new ModelEngineError('OpenAI API key is required', 'CONFIG_ERROR');
    }

    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    const url = `${baseUrl}/embeddings`;

    // 使用专门的嵌入模型
    const embeddingModel = this.config.model.includes('embed')
      ? this.config.model
      : 'text-embedding-3-small';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: embeddingModel,
        input: text,
      }),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ModelEngineError(
        `OpenAI API error: ${response.status} - ${error}`,
        'API_ERROR',
        { status: response.status }
      );
    }

    const data = await response.json() as OpenAIEmbeddingResponse;

    return {
      embedding: data.data?.[0]?.embedding || [],
      model: embeddingModel,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }

  // ============================================================================
  // Ollama API 调用
  // ============================================================================

  private async callOllama(
    messages: Message[],
    tools: ToolDefinition[] | undefined,
    stream: boolean
  ): Promise<CompletionResult | AsyncGenerator<StreamChunk>> {
    const baseUrl = this.config.baseUrl || 'http://localhost:11434';
    const url = `${baseUrl}/api/chat`;

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      stream,
      options: {
        temperature: this.config.temperature,
        num_predict: this.config.maxTokens,
      },
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map(t => ({
        type: 'function',
        function: t.function,
      }));
    }

    if (stream) {
      return this.streamOllama(url, body);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ModelEngineError(
        `Ollama API error: ${response.status} - ${error}`,
        'API_ERROR',
        { status: response.status }
      );
    }

    const data = await response.json() as OllamaCompletionResponse;

    return {
      content: data.message?.content || '',
      toolCalls: data.message?.tool_calls,
      finishReason: data.done ? 'stop' : null,
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
      latencyMs: 0,
    };
  }

  private async *streamOllama(
    url: string,
    body: Record<string, unknown>
  ): AsyncGenerator<StreamChunk> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ModelEngineError(
        `Ollama API error: ${response.status} - ${error}`,
        'API_ERROR',
        { status: response.status }
      );
    }

    if (!response.body) {
      throw new ModelEngineError('Response body is null', 'STREAM_ERROR');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const result: StreamChunk = {};

            if (parsed.message?.content) {
              result.content = parsed.message.content;
            }

            if (parsed.message?.tool_calls) {
              result.toolCalls = parsed.message.tool_calls;
            }

            if (parsed.done) {
              result.finishReason = 'stop';
              result.usage = {
                promptTokens: parsed.prompt_eval_count || 0,
                completionTokens: parsed.eval_count || 0,
                totalTokens: (parsed.prompt_eval_count || 0) + (parsed.eval_count || 0),
              };
            }

            if (Object.keys(result).length > 0) {
              yield result;
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async embedOllama(text: string): Promise<EmbeddingResult> {
    const baseUrl = this.config.baseUrl || 'http://localhost:11434';
    const url = `${baseUrl}/api/embeddings`;

    // 使用专门的嵌入模型
    const embeddingModel = this.config.model.includes('embed')
      ? this.config.model
      : 'nomic-embed-text';

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: embeddingModel,
        prompt: text,
      }),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ModelEngineError(
        `Ollama API error: ${response.status} - ${error}`,
        'API_ERROR',
        { status: response.status }
      );
    }

    const data = await response.json() as OllamaEmbeddingResponse;

    return {
      embedding: data.embedding || [],
      model: embeddingModel,
      usage: {
        promptTokens: 0, // Ollama 不提供 token 计数
        totalTokens: 0,
      },
    };
  }

  // ============================================================================
  // 便捷方法
  // ============================================================================

  /**
   * 简单对话 (非流式)
   */
  async chat(systemPrompt: string, userMessage: string): Promise<string> {
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const result = await this.complete(messages);
    return result.content;
  }

  /**
   * 带工具调用的对话
   */
  async chatWithTools(
    messages: Message[],
    tools: ToolDefinition[]
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    const result = await this.complete(messages, tools);
    return {
      content: result.content,
      toolCalls: result.toolCalls,
    };
  }
}

// ============================================================================
// 错误类
// ============================================================================

export class ModelEngineError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ModelEngineError';
    this.code = code;
    this.details = details;
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createOpenAIEngine(
  apiKey: string,
  model: string = 'gpt-4',
  options?: Partial<Omit<ModelConfig, 'provider' | 'apiKey' | 'model'>>
): ModelEngine {
  return new ModelEngine({
    provider: 'openai',
    apiKey,
    model,
    ...options,
  });
}

export function createOllamaEngine(
  model: string = 'llama3.2',
  baseUrl: string = 'http://localhost:11434',
  options?: Partial<Omit<ModelConfig, 'provider' | 'model' | 'baseUrl'>>
): ModelEngine {
  return new ModelEngine({
    provider: 'ollama',
    model,
    baseUrl,
    ...options,
  });
}

export default ModelEngine;
