/**
 * @file capabilities/model-engine/model-client.ts
 * @description 模型客户端 - 支持 Ollama 和 OpenAI API，带备用模型
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
 * 封装对 Ollama 和 OpenAI API 的调用，支持备用模型
 */
export class ModelClient {
  /** 主配置 */
  private primaryConfig: ModelConfig;
  /** 备用配置 */
  private fallbackConfig: ModelConfig | undefined;
  /** 当前使用的配置 */
  private currentConfig: ModelConfig;
  /** 是否在使用备用模型 */
  private usingFallback = false;
  /** 重试次数 */
  private maxRetries: number;
  /** 重试延迟(毫秒) */
  private retryDelayMs: number;
  /** 失败次数 */
  private failureCount = 0;
  /** 切换到备用模型的阈值 */
  private fallbackThreshold: number;

  /**
   * 创建模型客户端
   * @param customConfig 自定义模型配置（可选）
   * @param fallbackConfig 备用模型配置（可选）
   */
  constructor(
    customConfig?: Partial<ModelConfig>,
    fallbackConfig?: Partial<ModelConfig>
  ) {
    const globalConfig = getConfig();

    this.primaryConfig = customConfig
      ? { ...globalConfig.model.defaultModel, ...customConfig }
      : globalConfig.model.defaultModel;

    this.fallbackConfig = fallbackConfig
      ? ({ ...globalConfig.model.fallbackModel, ...fallbackConfig } as ModelConfig)
      : (globalConfig.model.fallbackModel as ModelConfig | undefined);

    this.currentConfig = this.primaryConfig;
    this.maxRetries = globalConfig.model.maxRetries;
    this.retryDelayMs = globalConfig.model.retryDelayMs;
    this.fallbackThreshold = Math.max(1, Math.floor(this.maxRetries / 2));

    logger.info('模型客户端初始化完成', {
      primary: this.primaryConfig.model,
      fallback: this.fallbackConfig?.model ?? 'none',
      maxRetries: this.maxRetries,
    });
  }

  /**
   * 发送聊天请求(非流式)，支持备用模型切换
   * @param messages 消息列表
   * @returns 模型响应
   */
  async chat(messages: ChatMessage[]): Promise<ModelResponse> {
    const startTime = Date.now();

    return tryCatchAsync(async () => {
      logger.debug('发送聊天请求', {
        messageCount: messages.length,
        model: this.currentConfig.model,
        usingFallback: this.usingFallback,
      });

      let lastError: Error | undefined;

      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          // 检查是否需要切换到备用模型
          if (attempt > this.fallbackThreshold && this.fallbackConfig && !this.usingFallback) {
            logger.warn(`主模型失败 ${attempt - 1} 次，切换到备用模型`, {
              primary: this.primaryConfig.model,
              fallback: this.fallbackConfig.model,
            });
            this.switchToFallback();
          }

          const response = await this.makeRequest(messages);

          const responseTimeMs = Date.now() - startTime;
          this.failureCount = 0; // 重置失败计数

          logger.info('聊天请求成功', {
            model: response.model,
            tokens: response.tokens.total,
            responseTimeMs,
            usingFallback: this.usingFallback,
          });

          return {
            ...response,
            responseTimeMs,
          };
        } catch (error) {
          this.failureCount++;
          lastError = error instanceof Error ? error : new Error(String(error));

          logger.warn(`请求失败 (尝试 ${attempt}/${this.maxRetries})`, {
            error: lastError.message,
            model: this.currentConfig.model,
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
   * 切换到备用模型
   */
  private switchToFallback(): void {
    if (this.fallbackConfig) {
      this.currentConfig = this.fallbackConfig;
      this.usingFallback = true;
      logger.info('已切换到备用模型', { model: this.fallbackConfig.model });
    }
  }

  /**
   * 切换回主模型
   */
  switchToPrimary(): void {
    if (this.usingFallback) {
      this.currentConfig = this.primaryConfig;
      this.usingFallback = false;
      this.failureCount = 0;
      logger.info('已切换回主模型', { model: this.primaryConfig.model });
    }
  }

  /**
   * 检查是否在使用备用模型
   * @returns 是否在使用备用模型
   */
  isUsingFallback(): boolean {
    return this.usingFallback;
  }

  /**
   * 获取当前配置
   * @returns 当前配置副本
   */
  getConfig(): ModelConfig {
    return { ...this.currentConfig };
  }

  /**
   * 更新配置
   * @param config 部分配置
   */
  updateConfig(config: Partial<ModelConfig>): void {
    this.currentConfig = { ...this.currentConfig, ...config };
    logger.info('模型配置已更新', {
      model: this.currentConfig.model,
      temperature: this.currentConfig.temperature,
    });
  }

  /**
   * 实际发起请求
   */
  private async makeRequest(messages: ChatMessage[]): Promise<ModelResponse> {
    if (this.currentConfig.provider === 'ollama') {
      return this.requestOllama(messages);
    } else {
      return this.requestOpenAI(messages);
    }
  }

  /**
   * Ollama 请求
   */
  private async requestOllama(messages: ChatMessage[]): Promise<ModelResponse> {
    const url = `${this.currentConfig.baseUrl}/api/chat`;

    const requestBody: OllamaRequest = {
      model: this.currentConfig.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false,
      options: {
        temperature: this.currentConfig.temperature,
        num_predict: this.currentConfig.maxTokens,
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
    const { content, thinking } = this.parseThinking(data.message.content);

    const result: ModelResponse = {
      content,
      tokens: {
        prompt: data.prompt_eval_count ?? 0,
        completion: data.eval_count ?? 0,
        total: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
      model: this.currentConfig.model,
      responseTimeMs: 0,
    };

    if (thinking) {
      result.thinking = thinking;
    }

    return result;
  }

  /**
   * OpenAI 请求
   */
  private async requestOpenAI(messages: ChatMessage[]): Promise<ModelResponse> {
    if (!this.currentConfig.apiKey) {
      throw new ModelError('OpenAI 需要 API Key', 'ModelClient.requestOpenAI');
    }

    const url = `${this.currentConfig.baseUrl ?? 'https://api.openai.com'}/v1/chat/completions`;

    const requestBody: OpenAIRequest = {
      model: this.currentConfig.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: this.currentConfig.temperature,
      max_tokens: this.currentConfig.maxTokens,
      stream: false,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.currentConfig.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`OpenAI 请求失败: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OpenAIResponse;

    return {
      content: data.choices[0]?.message?.content ?? '',
      tokens: {
        prompt: data.usage?.prompt_tokens ?? 0,
        completion: data.usage?.completion_tokens ?? 0,
        total: data.usage?.total_tokens ?? 0,
      },
      model: this.currentConfig.model,
      responseTimeMs: 0,
    };
  }

  /**
   * 解析思考过程
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
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 检查模型是否可用
   */
  async healthCheck(): Promise<boolean> {
    return tryCatchAsync(async () => {
      if (this.currentConfig.provider === 'ollama') {
        const response = await fetch(`${this.currentConfig.baseUrl}/api/tags`, {
          method: 'GET',
        });
        return response.ok;
      }
      return !!this.currentConfig.apiKey;
    }, 'ModelClient.healthCheck', ModelError)();
  }

  /**
   * 发送流式聊天请求
   */
  async chatStream(
    messages: ChatMessage[],
    callbacks: StreamingCallbacks
  ): Promise<void> {
    return tryCatchAsync(async () => {
      logger.debug('发送流式聊天请求', { messageCount: messages.length });

      if (this.currentConfig.provider === 'ollama') {
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
   * Ollama 流式请求
   */
  private async streamOllama(
    messages: ChatMessage[],
    callbacks: StreamingCallbacks
  ): Promise<void> {
    const url = `${this.currentConfig.baseUrl}/api/chat`;

    const requestBody: OllamaRequest = {
      model: this.currentConfig.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      options: {
        temperature: this.currentConfig.temperature,
        num_predict: this.currentConfig.maxTokens,
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

            if (data.done && callbacks.onComplete) {
              const { content, thinking } = this.parseThinking(fullContent);
              const resp: ModelResponse = {
                content,
                tokens: {
                  prompt: data.prompt_eval_count ?? 0,
                  completion: data.eval_count ?? 0,
                  total: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
                },
                model: this.currentConfig.model,
                responseTimeMs: 0,
              };
              if (thinking) resp.thinking = thinking;
              callbacks.onComplete(resp);
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
