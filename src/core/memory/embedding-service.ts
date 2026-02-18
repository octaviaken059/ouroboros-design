/**
 * @file core/memory/embedding-service.ts
 * @description 嵌入向量服务 - 使用 Ollama 生成文本嵌入
 * @author Ouroboros
 * @date 2026-02-18
 */

import { createContextLogger } from '@/utils/logger';
import { getConfig } from '@/config';
import { OuroborosError } from '@/utils/error';

const logger = createContextLogger('EmbeddingService');

/**
 * 嵌入服务配置
 */
interface EmbeddingConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
  dimension: number;
  timeoutMs: number;
}

/**
 * 嵌入向量服务
 * 负责生成和管理文本的向量嵌入
 */
export class EmbeddingService {
  private config: EmbeddingConfig;
  private cache: Map<string, number[]> = new Map();

  /**
   * 创建嵌入服务实例
   */
  constructor() {
    const config = getConfig();
    this.config = {
      enabled: config.memory.vectorStore.enabled,
      baseUrl: config.model.defaultModel.baseUrl || 'http://localhost:11434',
      model: 'nomic-embed-text', // 默认使用 nomic-embed-text
      dimension: config.memory.vectorStore.dimension,
      timeoutMs: 30000,
    };

    if (this.config.enabled) {
      logger.info('嵌入向量服务初始化完成', {
        model: this.config.model,
        dimension: this.config.dimension,
      });
    } else {
      logger.info('嵌入向量服务已禁用');
    }
  }

  /**
   * 检查服务是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 生成文本嵌入向量
   * @param text 输入文本
   * @returns 嵌入向量
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.config.enabled) {
      throw new OuroborosError(
        '嵌入服务未启用',
        'UNKNOWN_ERROR',
        'EmbeddingService.generateEmbedding'
      );
    }

    // 检查缓存
    const cached = this.cache.get(text);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          prompt: text.slice(0, 8192), // 限制输入长度
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json() as { embedding: number[] };
      const embedding = data.embedding;

      // 验证维度
      if (embedding.length !== this.config.dimension) {
        logger.warn('嵌入维度不匹配', {
          expected: this.config.dimension,
          actual: embedding.length,
        });
      }

      // 缓存结果
      this.cache.set(text, embedding);

      // 限制缓存大小
      if (this.cache.size > 1000) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) {
          this.cache.delete(firstKey);
        }
      }

      return embedding;
    } catch (error) {
      logger.error('生成嵌入向量失败', { error });
      throw new OuroborosError(
        '生成嵌入向量失败',
        'MODEL_ERROR',
        'EmbeddingService.generateEmbedding',
        false,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 批量生成嵌入向量
   * @param texts 文本数组
   * @returns 嵌入向量数组
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
      try {
        const embedding = await this.generateEmbedding(text);
        embeddings.push(embedding);
      } catch (error) {
        logger.error('批量嵌入生成失败', { text: text.slice(0, 50), error });
        embeddings.push(new Array(this.config.dimension).fill(0));
      }
    }
    return embeddings;
  }

  /**
   * 计算余弦相似度
   * @param a 向量a
   * @param b 向量b
   * @returns 相似度 (-1 到 1)
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('向量维度不匹配');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('嵌入缓存已清空');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // 简化实现，实际应该追踪命中率
    };
  }
}

// 单例实例
let embeddingServiceInstance: EmbeddingService | null = null;

/**
 * 获取嵌入服务实例
 */
export function getEmbeddingService(): EmbeddingService {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService();
  }
  return embeddingServiceInstance;
}
