/**
 * @file capabilities/model-engine/model-client.ts
 * @description 模型客户端 - 支持 Ollama 和 OpenAI API
 * @author Ouroboros
 * @date 2026-02-18
 */

import type {
  ModelConfig,
  ModelResponse,
  ChatMessage,
  StreamingCallbacks,
  OllamaRequest,
  OllamaResponse,
  OpenAIRequest,
  OpenAIResponse,
} from '@/types/model';
import { createContextLogger } from '@/utils/logger';
import { ModelError, tryCatchAsync } from '@/utils/error';
import { getConfig } from '@/config';

const logger = createContextLogger('ModelClient');

/**
 * 模型客户端类
 * 封装对 Ollama 和 OpenAI API 的调用
 */
export class ModelClient {
  /** 配置 */
  private config: ModelConfig;
  /** 重试次数 */
  private maxRetries: number;
  /** 重试延迟(毫秒) */
  private retryDelayMs: number;

  /**
   * 创建模型客户端
   * @param customConfig 自定义模型配置（可选，不传则使用全局配置）
   */
  constructor(customConfig?: Partial<ModelConfig>) {
    const globalConfig = getConfig();

    this.config = customConfig
      ? { ...globalConfig.model.defaultModel, ...customConfig }
      : globalConfig.model.defaultModel;

    this.maxRetries = globalConfig.model.maxRetries;
    this.retryDelayMs = globalConfig.model.retryDelayMs;

    logger.info('模型客户端初始化完成', {
      provider: this.config.provider,
      model: this.config.model,
      maxRetries: this.maxRetries,
    });
  }

  /**
   * 更新配置
   * @param config 部分配置
   */
  updateConfig(config: Partial<ModelConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('模型配置已更新', {
      model: this.config.model,
      temperature: this.config.temperature,
    });
  }

  /**
   * 获取当前配置
   * @returns 当前配置副本
   */
  getConfig(): ModelConfig {
    return { ...this.config };
  }

  /**
   * 发送聊天请求(非流式)
   * @param messages 消息列表
   * @returns 模型响应
   */
  async chat(messages: ChatMessage[]): Promise<ModelResponse> {
    const startTime = Date.now();

    return tryCatchAsync(async () => {
      logger.debug('发送聊天请求', { messageCount: messages.length });

      let lastError: Error | undefined;

      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const response = await this.makeRequest(messages);

          const responseTimeMs = Date.now() - startTime;

          logger.info('聊天请求成功', {
            tokens: response.tokens.total,
            responseTimeMs,
          });

          return {
            ...response,
            responseTimeMs,
          };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          logger.warn(`请求失败，尝试 ${attempt}/${this.maxRetries}`, {
            error: lastError.message,
          });

          if (attempt < this.maxRetries) {
            await this.delay(this.retryDelayMs * attempt);
          }
        }
      }

      throw new ModelError(
        `请求失败，已重试 ${this.maxRetries} 次: ${lastError?.message}`,
        'ModelClient.chat'
      );
    }, 'ModelClient.chat', ModelError)();
  }

  /**
   * 发送流式聊天请求
   * @param messages 消息列表
   * @param callbacks 回调函数
   */
  async chatStream(
    messages: ChatMessage[],
    callbacks: StreamingCallbacks
  ): Promise<void> {
    return tryCatchAsync(async () => {
      logger.debug('发送流式聊天请求', { messageCount: messages.length });

      if (this.config.provider === 'ollama') {
        await this.streamOllama(messages, callbacks);
      } else {
        throw new ModelError(
          'OpenAI 流式请求暂未实现',
          'ModelClient.chatStream'
        );
      }
    }, 'ModelClient.chatStream', ModelError)();
  }

  /**
   * 实际发起请求
   * @param messages 消息列表
   * @returns 模型响应
   */
  private async makeRequest(messages: ChatMessage[]): Promise<ModelResponse> {
    if (this.config.provider === 'ollama') {
      return this.requestOllama(messages);
    } else {
      return this.requestOpenAI(messages);
    }
  }

  /**
   * Ollama 请求
   * @param messages 消息列表
   * @returns 模型响应
   */
  private async requestOllama(messages: ChatMessage[]): Promise<ModelResponse> {
    const url = `${this.config.baseUrl}/api/chat`;

    const requestBody: OllamaRequest = {
      model: this.config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false,
      options: {
        temperature: this.config.temperature,
        num_predict: this.config.maxTokens,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Ollama 请求失败: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OllamaResponse;

    // 提取思考过程
    const { content, thinking } = this.parseThinking(data.message.content);

    const result: ModelResponse = {
      content,
      tokens: {
        prompt: data.prompt_eval_count ?? 0,
        completion: data.eval_count ?? 0,
        total: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
      model: this.config.model,
      responseTimeMs: 0, // 由上层填充
    };

    if (thinking) {
      result.thinking = thinking;
    }

    return result;
  }

  /**
   * OpenAI 请求
   * @param messages 消息列表
   * @returns 模型响应
   */
  private async requestOpenAI(messages: ChatMessage[]): Promise<ModelResponse> {
    if (!this.config.apiKey) {
      throw new ModelError('OpenAI 需要 API Key', 'ModelClient.requestOpenAI');
    }

    const url = `${this.config.baseUrl ?? 'https://api.openai.com'}/v1/chat/completions`;

    const requestBody: OpenAIRequest = {
      model: this.config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: false,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`OpenAI 请求失败: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OpenAIResponse;

    const result: ModelResponse = {
      content: data.choices[0]?.message?.content ?? '',
      tokens: {
        prompt: data.usage?.prompt_tokens ?? 0,
        completion: data.usage?.completion_tokens ?? 0,
        total: data.usage?.total_tokens ?? 0,
      },
      model: this.config.model,
      responseTimeMs: 0, // 由上层填充
    };

    return result;
  }

  /**
   * Ollama 流式请求
   * @param messages 消息列表
   * @param callbacks 回调函数
   */
  private async streamOllama(
    messages: ChatMessage[],
    callbacks: StreamingCallbacks
  ): Promise<void> {
    const url = `${this.config.baseUrl}/api/chat`;

    const requestBody: OllamaRequest = {
      model: this.config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      options: {
        temperature: this.config.temperature,
        num_predict: this.config.maxTokens,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Ollama 流式请求失败: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法获取响应流');
    }

    let fullContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line) as OllamaResponse;
            const content = data.message?.content ?? '';

            fullContent += content;
            callbacks.onChunk(content);

            if (data.done) {
              const { content, thinking } = this.parseThinking(fullContent);

              if (thinking && callbacks.onThinking) {
                callbacks.onThinking(thinking);
              }

              if (callbacks.onComplete) {
                const response: ModelResponse = {
                  content,
                  tokens: {
                    prompt: data.prompt_eval_count ?? 0,
                    completion: data.eval_count ?? 0,
                    total: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
                  },
                  model: this.config.model,
                  responseTimeMs: 0,
                };

                if (thinking) {
                  response.thinking = thinking;
                }

                callbacks.onComplete(response);
              }
            }
          } catch (parseError) {
            logger.warn('解析流数据失败', { line });
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 解析思考过程
   * @param content 原始内容
   * @returns 分离后的内容和思考过程
   */
  private parseThinking(content: string): { content: string; thinking?: string } {
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);

    if (thinkMatch) {
      const thinking = thinkMatch[1].trim();
      const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
      return { content: cleanContent, thinking };
    }

    return { content };
  }

  /**
   * 延迟
   * @param ms 毫秒
   * @returns Promise
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 检查模型是否可用
   * @returns 是否可用
   */
  async healthCheck(): Promise<boolean> {
    return tryCatchAsync(async () => {
      if (this.config.provider === 'ollama') {
        const response = await fetch(`${this.config.baseUrl}/api/tags`, {
          method: 'GET',
        });
        return response.ok;
      }
      // OpenAI 健康检查简化处理
      return !!this.config.apiKey;
    }, 'ModelClient.healthCheck', ModelError)();
  }
}
