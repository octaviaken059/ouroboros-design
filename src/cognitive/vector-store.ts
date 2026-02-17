/**
 * src/cognitive/vector-store.ts
 * 向量存储与混合搜索
 * 
 * 功能：
 * - SQLite向量存储（支持768维向量）
 * - 向量相似度搜索
 * - 全文关键词搜索
 * - 混合搜索（向量+关键词）
 * - 自动降级机制
 * - 容错增强
 */

import { SQLiteConnectionPool } from '../db/connection.js';
import { 
  IEmbeddingService, 
  EmbeddingService, 
  EmbeddingConfig,
  float32ArrayToBuffer,
  bufferToFloat32Array 
} from './embedding.js';

export type MemoryType = 'working' | 'episodic' | 'semantic' | 'procedural' | 'reflective';

export interface MemoryEntry {
  id?: number;
  type: MemoryType;
  content: string;
  embedding?: Float32Array;
  embeddingModel?: string;
  importance?: number;
  emotionalWeight?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  types?: MemoryType[];
  tags?: string[];
  minImportance?: number;
  maxAgeDays?: number;
  includeExpired?: boolean;
}

export interface VectorSearchOptions extends SearchOptions {
  similarityThreshold?: number;
  vectorWeight?: number;  // 0-1, 向量搜索权重
  keywordWeight?: number; // 0-1, 关键词搜索权重
}

export interface SearchResult {
  id: number;
  type: MemoryType;
  content: string;
  score: number;
  vectorScore?: number;
  keywordScore?: number;
  importance: number;
  createdAt: Date;
  accessCount: number;
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface HybridSearchResult extends SearchResult {
  combinedScore: number;
  sources: ('vector' | 'keyword')[];
}

export interface VectorStoreConfig {
  embedding?: Partial<EmbeddingConfig>;
  enableVectorization?: boolean;
  maxMemoryCount?: number;
  similarityThreshold?: number;
  hybridSearchWeight?: {
    vector: number;
    keyword: number;
  };
}

export interface IVectorStore {
  readonly isVectorizationEnabled: boolean;
  add(entry: MemoryEntry): Promise<number>;
  addBatch(entries: MemoryEntry[]): Promise<number[]>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  searchByVector(vector: Float32Array, options?: SearchOptions): Promise<SearchResult[]>;
  hybridSearch(query: string, options?: VectorSearchOptions): Promise<HybridSearchResult[]>;
  get(id: number): Promise<SearchResult | null>;
  delete(id: number): Promise<boolean>;
  update(id: number, entry: Partial<MemoryEntry>): Promise<boolean>;
  associate(sourceId: number, targetId: number, strength?: number, type?: string): Promise<boolean>;
  getAssociated(memoryId: number): Promise<SearchResult[]>;
}

/**
 * 向量存储实现
 */
export class VectorStore implements IVectorStore {
  private pool: SQLiteConnectionPool;
  private embeddingService: IEmbeddingService;
  private config: Required<VectorStoreConfig>;
  private _isVectorizationEnabled: boolean;

  static readonly DEFAULT_CONFIG: Required<VectorStoreConfig> = {
    embedding: {},
    enableVectorization: true,
    maxMemoryCount: 10000,
    similarityThreshold: 0.7,
    hybridSearchWeight: {
      vector: 0.6,
      keyword: 0.4,
    },
  };

  constructor(
    pool: SQLiteConnectionPool,
    config: VectorStoreConfig = {}
  ) {
    this.pool = pool;
    this.config = { ...VectorStore.DEFAULT_CONFIG, ...config };
    this._isVectorizationEnabled = this.config.enableVectorization;
    
    // 初始化嵌入服务
    this.embeddingService = new EmbeddingService(this.config.embedding);
  }

  /**
   * 初始化向量存储
   */
  async initialize(): Promise<void> {
    if (this.config.enableVectorization) {
      const available = await this.embeddingService.initialize?.();
      this._isVectorizationEnabled = available;
      
      if (!available) {
        console.warn('Vectorization service unavailable, falling back to keyword search');
      }
    }
  }

  get isVectorizationEnabled(): boolean {
    return this._isVectorizationEnabled;
  }

  /**
   * 添加记忆
   */
  async add(entry: MemoryEntry): Promise<number> {
    // 生成嵌入向量（如果启用）
    let embedding: Float32Array | null = null;
    let embeddingModel: string | null = null;

    if (this._isVectorizationEnabled && !entry.embedding) {
      const result = await this.embeddingService.generate(entry.content);
      if (result) {
        embedding = result.vector;
        embeddingModel = result.model;
      }
    } else if (entry.embedding) {
      embedding = entry.embedding;
      embeddingModel = entry.embeddingModel || 'user-provided';
    }

    // 获取记忆类型ID
    const typeRow = await this.pool.get<{ id: number }>('SELECT id FROM memory_types WHERE name = ?', [entry.type]);
    if (!typeRow) {
      throw new Error(`Unknown memory type: ${entry.type}`);
    }

    // 计算过期时间
    let expiresAt: string | null = null;
    if (entry.expiresAt) {
      expiresAt = entry.expiresAt.toISOString();
    } else {
      // 查询类型的默认TTL
      const ttlRow = await this.pool.get<{ default_ttl_seconds: number | null }>(
        'SELECT default_ttl_seconds FROM memory_types WHERE id = ?',
        [typeRow.id]
      );
      if (ttlRow?.default_ttl_seconds) {
        const expiresDate = new Date();
        expiresDate.setSeconds(expiresDate.getSeconds() + ttlRow.default_ttl_seconds);
        expiresAt = expiresDate.toISOString();
      }
    }

    // 插入记忆
    const result = await this.pool.run(
      `INSERT INTO memories 
       (type_id, content, embedding, embedding_model, importance, emotional_weight, expires_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        typeRow.id,
        entry.content,
        embedding ? float32ArrayToBuffer(embedding) : null,
        embeddingModel,
        entry.importance ?? 0.5,
        entry.emotionalWeight ?? 1.0,
        expiresAt,
      ]
    );

    const memoryId = Number(result.lastInsertRowid);

    // 处理标签
    if (entry.tags && entry.tags.length > 0) {
      await this.addTags(memoryId, entry.tags);
    }

    // 处理元数据 (存储为JSON在内容中)
    if (entry.metadata) {
      await this.pool.run(
        'UPDATE memories SET content = ? WHERE id = ?',
        [`${entry.content}\n\n---\nmetadata: ${JSON.stringify(entry.metadata)}`, memoryId]
      );
    }

    // 记录到时间线
    await this.pool.run(
      `INSERT INTO timeline (memory_id, event_type, event_name, event_data) 
       VALUES (?, 'memory', 'created', ?)`,
      [memoryId, JSON.stringify({ type: entry.type, importance: entry.importance })]
    );

    return memoryId;
  }

  /**
   * 批量添加记忆
   */
  async addBatch(entries: MemoryEntry[]): Promise<number[]> {
    const ids: number[] = [];
    
    // 批量生成嵌入
    if (this._isVectorizationEnabled) {
      const texts = entries.map(e => e.content);
      const batchResult = await this.embeddingService.generateBatch(texts);
      
      for (let i = 0; i < entries.length; i++) {
        if (batchResult.embeddings[i]) {
          entries[i]!.embedding = batchResult.embeddings[i];
        }
      }
    }

    // 逐个插入
    for (const entry of entries) {
      const id = await this.add(entry);
      ids.push(id);
    }

    return ids;
  }

  /**
   * 关键词搜索（降级策略）
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const {
      limit = 10,
      offset = 0,
      types,
      tags,
      minImportance,
      maxAgeDays,
      includeExpired = false,
    } = options;

    let sql = `
      SELECT 
        m.id,
        mt.name as type,
        m.content,
        m.importance,
        m.created_at,
        m.access_count,
        m.retention_score,
        rank as score
      FROM memories_fts fts
      JOIN memories m ON fts.memory_id = m.id
      JOIN memory_types mt ON m.type_id = mt.id
      WHERE memories_fts MATCH ?
        AND m.deleted_at IS NULL
    `;

    const params: (string | number)[] = [query];

    // 类型过滤
    if (types && types.length > 0) {
      sql += ` AND mt.name IN (${types.map(() => '?').join(', ')})`;
      params.push(...types);
    }

    // 重要性过滤
    if (minImportance !== undefined) {
      sql += ' AND m.importance >= ?';
      params.push(minImportance);
    }

    // 过期过滤
    if (!includeExpired) {
      sql += ' AND (m.expires_at IS NULL OR m.expires_at > datetime("now"))';
    }

    // 年龄过滤
    if (maxAgeDays !== undefined) {
      sql += ' AND m.created_at >= datetime("now", ?)';
      params.push(`-${maxAgeDays} days`);
    }

    // 标签过滤
    if (tags && tags.length > 0) {
      sql += ` AND m.id IN (
        SELECT memory_id FROM memory_tags mt2
        JOIN tags t ON mt2.tag_id = t.id
        WHERE t.name IN (${tags.map(() => '?').join(', ')})
        GROUP BY memory_id
        HAVING COUNT(DISTINCT t.name) = ?
      )`;
      params.push(...tags, tags.length);
    }

    sql += ' ORDER BY rank LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await this.pool.query<{
      id: number;
      type: string;
      content: string;
      importance: number;
      created_at: string;
      access_count: number;
      retention_score: number;
      score: number;
    }>(sql, params);

    // 更新访问计数
    for (const row of result.rows) {
      await this.updateAccessCount(row.id);
    }

    // 获取标签
    const results: SearchResult[] = [];
    for (const row of result.rows) {
      const tags = await this.getMemoryTags(row.id);
      results.push({
        id: row.id,
        type: row.type as MemoryType,
        content: row.content,
        score: row.score,
        importance: row.importance,
        createdAt: new Date(row.created_at),
        accessCount: row.access_count + 1, // +1因为刚才更新
        tags,
      });
    }

    return results;
  }

  /**
   * 向量搜索
   */
  async searchByVector(vector: Float32Array, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this._isVectorizationEnabled) {
      throw new Error('Vectorization is disabled');
    }

    const {
      limit = 10,
      types,
    } = options;

    // 获取候选记忆（先按时间/重要性过滤）
    let sql = `
      SELECT id, embedding, content, importance, type_id
      FROM memories m
      JOIN memory_types mt ON m.type_id = mt.id
      WHERE m.embedding IS NOT NULL
        AND m.deleted_at IS NULL
        AND (m.expires_at IS NULL OR m.expires_at > datetime("now"))
    `;
    const params: unknown[] = [];

    if (types && types.length > 0) {
      sql += ` AND mt.name IN (${types.map(() => '?').join(', ')})`;
      params.push(...types);
    }

    sql += ' LIMIT ?';
    params.push(limit * 3); // 获取更多候选用于重排序

    const candidates = await this.pool.query<{
      id: number;
      embedding: Buffer;
      content: string;
      importance: number;
      type_id: number;
    }>(sql, params);

    // 计算相似度
    const scored = candidates.rows
      .map(row => {
        const rowVector = bufferToFloat32Array(row.embedding);
        const similarity = this.embeddingService.compare(vector, rowVector);
        return {
          id: row.id,
          similarity,
          content: row.content,
          importance: row.importance,
          typeId: row.type_id,
        };
      })
      .filter(item => item.similarity >= this.config.similarityThreshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    // 获取完整数据
    const results: SearchResult[] = [];
    for (const item of scored) {
      const fullData = await this.get(item.id);
      if (fullData) {
        results.push({
          ...fullData,
          score: item.similarity,
          vectorScore: item.similarity,
        });
      }
    }

    return results;
  }

  /**
   * 混合搜索（向量 + 关键词）
   * 
   * 策略：
   * 1. 尝试向量搜索
   * 2. 尝试关键词搜索
   * 3. 融合结果（加权平均）
   * 4. 如果向量搜索失败，自动降级为纯关键词搜索
   */
  async hybridSearch(query: string, options: VectorSearchOptions = {}): Promise<HybridSearchResult[]> {
    const {
      limit = 10,
      similarityThreshold = this.config.similarityThreshold,
      vectorWeight = this.config.hybridSearchWeight.vector,
      keywordWeight = this.config.hybridSearchWeight.keyword,
    } = options;

    // 尝试生成查询向量
    let queryVector: Float32Array | null = null;
    if (this._isVectorizationEnabled) {
      const embeddingResult = await this.embeddingService.generate(query);
      queryVector = embeddingResult?.vector || null;
    }

    // 收集两种搜索的结果
    const vectorResults: Map<number, SearchResult & { vectorScore: number }> = new Map();
    const keywordResults: Map<number, SearchResult & { keywordScore: number }> = new Map();

    // 向量搜索
    if (queryVector) {
      try {
        const results = await this.searchByVector(queryVector, { ...options, limit: limit * 2 });
        for (const result of results) {
          if ((result.score || 0) >= similarityThreshold) {
            vectorResults.set(result.id, { ...result, vectorScore: result.score || 0 });
          }
        }
      } catch (error) {
        console.warn('Vector search failed:', error);
      }
    }

    // 关键词搜索
    try {
      const results = await this.search(query, { ...options, limit: limit * 2 });
      for (const result of results) {
        // 归一化BM25分数到0-1
        const normalizedScore = this.normalizeBM25Score(result.score);
        keywordResults.set(result.id, { ...result, keywordScore: normalizedScore });
      }
    } catch (error) {
      console.warn('Keyword search failed:', error);
    }

    // 融合结果
    const allIds = new Set([...vectorResults.keys(), ...keywordResults.keys()]);
    const fusedResults: HybridSearchResult[] = [];

    for (const id of allIds) {
      const vectorResult = vectorResults.get(id);
      const keywordResult = keywordResults.get(id);

      const sources: ('vector' | 'keyword')[] = [];
      let vectorScore = 0;
      let keywordScore = 0;

      if (vectorResult) {
        sources.push('vector');
        vectorScore = vectorResult.vectorScore;
      }

      if (keywordResult) {
        sources.push('keyword');
        keywordScore = keywordResult.keywordScore;
      }

      // 加权融合
      const combinedScore = 
        (vectorScore * vectorWeight) + 
        (keywordScore * keywordWeight);

      const baseResult = vectorResult || keywordResult!;

      fusedResults.push({
        ...baseResult,
        combinedScore,
        score: combinedScore,
        vectorScore: vectorResult?.vectorScore,
        keywordScore: keywordResult?.keywordScore,
        sources,
      });
    }

    // 按融合分数排序
    return fusedResults
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, limit);
  }

  /**
   * 获取单个记忆
   */
  async get(id: number): Promise<SearchResult | null> {
    const row = await this.pool.get<{
      id: number;
      type: string;
      content: string;
      importance: number;
      created_at: string;
      access_count: number;
      retention_score: number;
      embedding: Buffer | null;
    }>(
      `SELECT 
        m.id,
        mt.name as type,
        m.content,
        m.importance,
        m.created_at,
        m.access_count,
        m.retention_score,
        m.embedding
      FROM memories m
      JOIN memory_types mt ON m.type_id = mt.id
      WHERE m.id = ? AND m.deleted_at IS NULL`,
      [id]
    );

    if (!row) {
      return null;
    }

    await this.updateAccessCount(id);
    const tags = await this.getMemoryTags(id);

    return {
      id: row.id,
      type: row.type as MemoryType,
      content: row.content,
      score: 1.0,
      importance: row.importance,
      createdAt: new Date(row.created_at),
      accessCount: row.access_count + 1,
      tags,
    };
  }

  /**
   * 删除记忆（软删除）
   */
  async delete(id: number): Promise<boolean> {
    const result = await this.pool.run(
      'UPDATE memories SET deleted_at = datetime("now") WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return result.changes > 0;
  }

  /**
   * 硬删除记忆
   */
  async hardDelete(id: number): Promise<boolean> {
    await this.pool.run('DELETE FROM memory_tags WHERE memory_id = ?', [id]);
    await this.pool.run('DELETE FROM memory_associations WHERE source_memory_id = ? OR target_memory_id = ?', [id, id]);
    const result = await this.pool.run('DELETE FROM memories WHERE id = ?', [id]);
    return result.changes > 0;
  }

  /**
   * 更新记忆
   */
  async update(id: number, entry: Partial<MemoryEntry>): Promise<boolean> {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (entry.content !== undefined) {
      updates.push('content = ?');
      params.push(entry.content);

      // 如果内容改变，重新生成嵌入
      if (this._isVectorizationEnabled) {
        const embeddingResult = await this.embeddingService.generate(entry.content);
        if (embeddingResult) {
          updates.push('embedding = ?');
          params.push(float32ArrayToBuffer(embeddingResult.vector));
          updates.push('embedding_model = ?');
          params.push(embeddingResult.model);
        }
      }
    }

    if (entry.importance !== undefined) {
      updates.push('importance = ?');
      params.push(entry.importance);
    }

    if (entry.emotionalWeight !== undefined) {
      updates.push('emotional_weight = ?');
      params.push(entry.emotionalWeight);
    }

    if (entry.expiresAt !== undefined) {
      updates.push('expires_at = ?');
      params.push(entry.expiresAt.toISOString());
    }

    if (updates.length === 0) {
      return false;
    }

    params.push(id);
    const result = await this.pool.run(
      `UPDATE memories SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      params
    );

    return result.changes > 0;
  }

  /**
   * 创建记忆关联
   */
  async associate(
    sourceId: number, 
    targetId: number, 
    strength: number = 0.5,
    type: string = 'semantic'
  ): Promise<boolean> {
    try {
      await this.pool.run(
        `INSERT INTO memory_associations 
         (source_memory_id, target_memory_id, strength, association_type, is_auto_generated) 
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(source_memory_id, target_memory_id) 
         DO UPDATE SET strength = excluded.strength, association_type = excluded.association_type`,
        [sourceId, targetId, strength, type, false]
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取关联记忆
   */
  async getAssociated(memoryId: number): Promise<SearchResult[]> {
    const result = await this.pool.query<{ target_memory_id: number; strength: number }>(
      `SELECT target_memory_id, strength FROM memory_associations 
       WHERE source_memory_id = ?
       ORDER BY strength DESC`,
      [memoryId]
    );

    const associated: SearchResult[] = [];
    for (const row of result.rows) {
      const memory = await this.get(row.target_memory_id);
      if (memory) {
        associated.push({ ...memory, score: row.strength });
      }
    }

    return associated;
  }

  /**
   * 自动构建关联（基于向量相似度）
   */
  async buildAssociations(memoryId: number, maxAssociations: number = 5): Promise<void> {
    if (!this._isVectorizationEnabled) {
      return;
    }

    const memory = await this.get(memoryId);
    if (!memory) return;

    // 获取记忆向量
    const row = await this.pool.get<{ embedding: Buffer }>(
      'SELECT embedding FROM memories WHERE id = ?',
      [memoryId]
    );
    if (!row?.embedding) return;

    const vector = bufferToFloat32Array(row.embedding);

    // 查找相似记忆
    const similar = await this.searchByVector(vector, { limit: maxAssociations + 1 });

    // 排除自己并创建关联
    for (const result of similar) {
      if (result.id !== memoryId) {
        await this.associate(memoryId, result.id, result.score, 'similarity');
      }
    }
  }

  /**
   * 遗忘处理（基于保留分数）
   */
  async applyForgetting(): Promise<{ consolidated: number; forgotten: number }> {
    const decayRate = 86400000; // 24小时（毫秒）

    // 获取所有活跃记忆
    const memories = await this.pool.query<{
      id: number;
      importance: number;
      emotional_weight: number;
      access_count: number;
      created_at: string;
      consolidated: number;
      retention_score: number;
    }>(
      `SELECT id, importance, emotional_weight, access_count, created_at, consolidated, retention_score
       FROM memories 
       WHERE deleted_at IS NULL 
         AND (expires_at IS NULL OR expires_at > datetime("now"))`
    );

    let consolidated = 0;
    let forgotten = 0;

    for (const m of memories.rows) {
      const timeDecay = Math.exp(
        -(Date.now() - new Date(m.created_at).getTime()) / decayRate
      );
      const usageBoost = Math.log(1 + m.access_count) * 0.1;
      const consolidationBonus = m.consolidated ? 1.3 : 1.0;

      const newRetentionScore =
        m.importance *
        m.emotional_weight *
        (1 + usageBoost) *
        (1 - timeDecay) *
        consolidationBonus;

      // 更新保留分数
      await this.pool.run(
        'UPDATE memories SET retention_score = ? WHERE id = ?',
        [Math.min(1, Math.max(0, newRetentionScore)), m.id]
      );

      // 睡眠巩固：高重要性或使用频繁的记忆
      if (!m.consolidated && (m.importance > 0.8 || m.access_count > 5)) {
        await this.pool.run('UPDATE memories SET consolidated = TRUE WHERE id = ?', [m.id]);
        consolidated++;
      }

      // 遗忘：保留分数极低且未巩固的记忆
      if (newRetentionScore < 0.1 && !m.consolidated) {
        await this.delete(m.id);
        forgotten++;
      }
    }

    return { consolidated, forgotten };
  }

  // ==================== 私有方法 ====================

  /**
   * 添加标签
   */
  private async addTags(memoryId: number, tags: string[]): Promise<void> {
    for (const tagName of tags) {
      // 确保标签存在
      await this.pool.run(
        'INSERT OR IGNORE INTO tags (name) VALUES (?)',
        [tagName]
      );

      // 关联标签
      await this.pool.run(
        `INSERT OR IGNORE INTO memory_tags (memory_id, tag_id) 
         SELECT ?, id FROM tags WHERE name = ?`,
        [memoryId, tagName]
      );
    }
  }

  /**
   * 获取记忆的标签
   */
  private async getMemoryTags(memoryId: number): Promise<string[]> {
    const result = await this.pool.query<{ name: string }>(
      `SELECT t.name FROM tags t
       JOIN memory_tags mt ON t.id = mt.tag_id
       WHERE mt.memory_id = ?`,
      [memoryId]
    );
    return result.rows.map(r => r.name);
  }

  /**
   * 更新访问计数
   */
  private async updateAccessCount(memoryId: number): Promise<void> {
    await this.pool.run(
      `UPDATE memories 
       SET access_count = access_count + 1, last_accessed_at = datetime("now")
       WHERE id = ?`,
      [memoryId]
    );
  }

  /**
   * 归一化BM25分数到0-1
   */
  private normalizeBM25Score(score: number): number {
    // BM25分数通常是负数（排名值），转换为正数并归一化
    // 假设正常范围在 -10 到 0 之间
    const normalized = Math.max(0, Math.min(1, (score + 10) / 10));
    return normalized;
  }
}

export default VectorStore;
