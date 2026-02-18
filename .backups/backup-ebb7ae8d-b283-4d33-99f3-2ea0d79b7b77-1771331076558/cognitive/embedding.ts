/**
 * src/cognitive/embedding.ts
 * 嵌入向量生成服务
 * 
 * 功能：
 * - 支持Ollama本地嵌入模型
 * - 支持OpenAI API
 * - 支持禁用向量化（纯文本模式）
 * - 自动故障转移和降级
 * - 批量嵌入优化
 */

import { Database } from 'better-sqlite3';

export type EmbeddingProvider = 'ollama' | 'openai' | 'none';

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  apiUrl?: string;
  apiKey?: string;
  dimensions?: number;
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export interface EmbeddingResult {
  vector: Float32Array;
  model: string;
  provider: EmbeddingProvider;
  dimensions: number;
}

export interface EmbeddingBatchResult {
  embeddings: Float32Array[];
  failedIndices: number[];
  errors: string[];
}

export interface IEmbeddingService {
  readonly isAvailable: boolean;
  readonly config: EmbeddingConfig;
  initialize?(): Promise<boolean>;
  generate(text: string): Promise<EmbeddingResult | null>;
  generateBatch(texts: string[]): Promise<EmbeddingBatchResult>;
  compare(vectorA: Float32Array, vectorB: Float32Array): number;
  cosineSimilarity(vectorA: Float32Array, vectorB: Float32Array): number;
}

/**
 * 默认配置
 */
export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  provider: 'ollama',
  model: 'nomic-embed-text',
  apiUrl: 'http://localhost:11434',
  dimensions: 768,
  timeoutMs: 30000,
  retryAttempts: 3,
  retryDelayMs: 1000,
};

/**
 * 嵌入服务实现
 */
export class EmbeddingService implements IEmbeddingService {
  private _config: EmbeddingConfig;
  private _isAvailable: boolean = false;
  private cache: Map<string, Float32Array> = new Map();

  constructor(config: Partial<EmbeddingConfig> = {}) {
    this._config = { ...DEFAULT_EMBEDDING_CONFIG, ...config };
    
    // 'none' 模式始终可用（用于纯文本搜索）
    if (this._config.provider === 'none') {
      this._isAvailable = true;
    }
  }

  get isAvailable(): boolean {
    return this._isAvailable || this._config.provider === 'none';
  }

  get config(): EmbeddingConfig {
    return { ...this._config };
  }

  /**
   * 初始化服务（检查可用性）
   */
  async initialize(): Promise<boolean> {
    if (this._config.provider === 'none') {
      this._isAvailable = true;
      return true;
    }

    try {
      if (this._config.provider === 'ollama') {
        this._isAvailable = await this.checkOllamaHealth();
      } else if (this._config.provider === 'openai') {
        this._isAvailable = await this.checkOpenAIHealth();
      }
    } catch (error) {
      console.warn(`Embedding service initialization failed: ${error}`);
      this._isAvailable = false;
    }

    return this._isAvailable;
  }

  /**
   * 生成单个文本的嵌入向量
   */
  async generate(text: string): Promise<EmbeddingResult | null> {
    // 空文本检查
    if (!text || text.trim().length === 0) {
      return null;
    }

    // 截断文本防止超长
    const truncatedText = this.truncateText(text, 8000);
    
    // 缓存检查
    const cacheKey = this.getCacheKey(truncatedText);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        vector: cached,
        model: this._config.model,
        provider: this._config.provider,
        dimensions: cached.length,
      };
    }

    // 'none' 模式返回 null
    if (this._config.provider === 'none') {
      return null;
    }

    // 服务不可用
    if (!this._isAvailable) {
      return null;
    }

    try {
      const vector = await this.generateWithRetry(truncatedText);
      if (vector) {
        // 存入缓存
        this.cache.set(cacheKey, vector);
        // 限制缓存大小
        this.limitCacheSize(1000);
        
        return {
          vector,
          model: this._config.model,
          provider: this._config.provider,
          dimensions: vector.length,
        };
      }
    } catch (error) {
      console.error('Embedding generation failed:', error);
    }

    return null;
  }

  /**
   * 批量生成嵌入向量
   */
  async generateBatch(texts: string[]): Promise<EmbeddingBatchResult> {
    const embeddings: Float32Array[] = new Array(texts.length);
    const failedIndices: number[] = [];
    const errors: string[] = [];

    if (this._config.provider === 'none' || !this._isAvailable) {
      return { embeddings, failedIndices: texts.map((_, i) => i), errors: ['Service unavailable'] };
    }

    // 分批处理避免过大请求
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await this.generateBatchInternal(batch);

      for (let j = 0; j < batch.length; j++) {
        const globalIndex = i + j;
        if (batchResults[j]) {
          embeddings[globalIndex] = batchResults[j]!;
        } else {
          failedIndices.push(globalIndex);
          errors.push(`Failed to generate embedding for index ${globalIndex}`);
        }
      }
    }

    return { embeddings, failedIndices, errors };
  }

  /**
   * 计算两个向量的余弦相似度
   */
  cosineSimilarity(vectorA: Float32Array, vectorB: Float32Array): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error(`Vector dimension mismatch: ${vectorA.length} vs ${vectorB.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i]! * vectorB[i]!;
      normA += vectorA[i]! * vectorA[i]!;
      normB += vectorB[i]! * vectorB[i]!;
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 别名：比较向量
   */
  compare(vectorA: Float32Array, vectorB: Float32Array): number {
    return this.cosineSimilarity(vectorA, vectorB);
  }

  /**
   * 查找最相似的向量
   */
  findMostSimilar(
    queryVector: Float32Array,
    candidates: Array<{ id: number; vector: Float32Array }>,
    topK: number = 5
  ): Array<{ id: number; score: number }> {
    const scored = candidates.map((candidate) => ({
      id: candidate.id,
      score: this.cosineSimilarity(queryVector, candidate.vector),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * 带重试的生成
   */
  private async generateWithRetry(text: string): Promise<Float32Array | null> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < (this._config.retryAttempts || 3); attempt++) {
      try {
        if (this._config.provider === 'ollama') {
          return await this.generateWithOllama(text);
        } else if (this._config.provider === 'openai') {
          return await this.generateWithOpenAI(text);
        }
      } catch (error) {
        lastError = error as Error;
        if (attempt < (this._config.retryAttempts || 3) - 1) {
          await this.delay(this._config.retryDelayMs || 1000);
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    return null;
  }

  /**
   * 使用Ollama生成嵌入
   */
  private async generateWithOllama(text: string): Promise<Float32Array> {
    const response = await fetch(`${this._config.apiUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this._config.model,
        prompt: text,
      }),
      signal: AbortSignal.timeout(this._config.timeoutMs || 30000),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { embedding: number[] };
    
    if (!Array.isArray(data.embedding)) {
      throw new Error('Invalid embedding response from Ollama');
    }

    return new Float32Array(data.embedding);
  }

  /**
   * 使用OpenAI生成嵌入
   */
  private async generateWithOpenAI(text: string): Promise<Float32Array> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this._config.apiKey}`,
      },
      body: JSON.stringify({
        model: this._config.model,
        input: text,
      }),
      signal: AbortSignal.timeout(this._config.timeoutMs || 30000),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { data: Array<{ embedding: number[] }> };
    
    if (!data.data?.[0]?.embedding) {
      throw new Error('Invalid embedding response from OpenAI');
    }

    return new Float32Array(data.data[0].embedding);
  }

  /**
   * 批量生成内部实现
   */
  private async generateBatchInternal(texts: string[]): Promise<(Float32Array | null)[]> {
    const results: (Float32Array | null)[] = [];

    for (const text of texts) {
      try {
        const result = await this.generate(text);
        results.push(result?.vector || null);
      } catch {
        results.push(null);
      }
    }

    return results;
  }

  /**
   * 检查Ollama健康状态
   */
  private async checkOllamaHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this._config.apiUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 检查OpenAI健康状态
   */
  private async checkOpenAIHealth(): Promise<boolean> {
    if (!this._config.apiKey) {
      return false;
    }
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this._config.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 截断文本
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength);
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(text: string): string {
    // 简单哈希
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `${this._config.model}:${hash}`;
  }

  /**
   * 限制缓存大小
   */
  private limitCacheSize(maxSize: number): void {
    if (this.cache.size > maxSize) {
      const entriesToDelete = this.cache.size - maxSize;
      let deleted = 0;
      for (const key of this.cache.keys()) {
        this.cache.delete(key);
        deleted++;
        if (deleted >= entriesToDelete) break;
      }
    }
  }

  /**
   * 延迟辅助函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // TODO: 实现命中率统计
    };
  }
}

/**
 * 从二进制数据恢复Float32Array
 */
export function bufferToFloat32Array(buffer: Buffer): Float32Array {
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
}

/**
 * 将Float32Array转换为Buffer
 */
export function float32ArrayToBuffer(vector: Float32Array): Buffer {
  return Buffer.from(vector.buffer);
}

/**
 * 创建零向量（用于占位）
 */
export function createZeroVector(dimensions: number = 768): Float32Array {
  return new Float32Array(dimensions);
}

export default EmbeddingService;
