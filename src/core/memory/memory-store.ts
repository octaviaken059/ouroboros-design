/**
 * @file core/memory/memory-store.ts
 * @description 记忆存储 - 管理记忆的增删改查和持久化
 * @author Ouroboros
 * @date 2026-02-18
 */

import type {
  AnyMemory,
  MemoryType,
  MemoryQueryOptions,
  MemoryRetrievalResult,
} from '@/types/memory';
import { createContextLogger } from '@/utils/logger';
import { query, run } from '@/db/connection';
import { randomUUID } from 'crypto';
import { EmbeddingService } from './embedding-service';

const logger = createContextLogger('MemoryStore');

/**
 * 记忆存储类
 * 管理所有记忆的存储、检索和持久化
 */
export class MemoryStore {
  /** 内存中的记忆缓存 */
  private memories: Map<string, AnyMemory> = new Map();
  /** 短期记忆ID列表 (按时间排序) */
  private shortTermIds: string[] = [];
  /** 最大短期记忆数量 */
  private shortTermCapacity: number;
  /** 嵌入向量服务 */
  private embeddingService: EmbeddingService;
  /** 向量存储是否启用 */
  private vectorStoreEnabled: boolean;

  /**
   * 创建记忆存储实例
   * @param shortTermCapacity 短期记忆容量
   */
  constructor(shortTermCapacity = 50, vectorStoreEnabled = true) {
    this.shortTermCapacity = shortTermCapacity;
    this.vectorStoreEnabled = vectorStoreEnabled;
    this.embeddingService = new EmbeddingService();
    this.initDatabase();
    this.loadFromDatabase();
    logger.info('记忆存储初始化完成', { 
      shortTermCapacity,
      vectorStoreEnabled: this.vectorStoreEnabled && this.embeddingService.isEnabled(),
    });
  }

  /**
   * 初始化数据库表
   */
  private initDatabase(): void {
    // 记忆主表
    run(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_accessed_at TEXT NOT NULL,
        access_count INTEGER DEFAULT 0,
        importance REAL DEFAULT 0.5,
        emotional_intensity REAL DEFAULT 0,
        confidence REAL DEFAULT 1.0,
        related_memory_ids TEXT DEFAULT '[]',
        tags TEXT DEFAULT '[]',
        data TEXT NOT NULL
      )
    `);

    // 记忆向量表 (用于语义检索)
    run(`
      CREATE TABLE IF NOT EXISTS memory_vectors (
        memory_id TEXT PRIMARY KEY,
        vector BLOB,
        FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
      )
    `);

    logger.debug('记忆数据库表初始化完成');
  }

  /**
   * 从数据库加载记忆到内存
   */
  private loadFromDatabase(): void {
    const rows = query<{
      id: string;
      type: string;
      data: string;
      created_at: string;
      last_accessed_at: string;
      access_count: number;
      importance: number;
    }>('SELECT * FROM memories ORDER BY last_accessed_at DESC LIMIT ?', [
      this.shortTermCapacity,
    ]);

    for (const row of rows) {
      const memory = JSON.parse(row.data) as AnyMemory;
      this.memories.set(memory.id, memory);
      this.shortTermIds.push(memory.id);
    }

    logger.info('已从数据库加载记忆', { count: this.memories.size });
  }

  /**
   * 保存记忆
   * @param memory 记忆对象
   * @returns 保存后的记忆
   */
  save(memory: Omit<AnyMemory, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>): AnyMemory {
    const now = new Date().toISOString();
    const fullMemory: AnyMemory = {
      ...memory,
      id: randomUUID(),
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
    } as AnyMemory;

    // 保存到内存
    this.memories.set(fullMemory.id, fullMemory);
    this.shortTermIds.unshift(fullMemory.id);

    // 维护短期记忆容量
    this.maintainShortTermCapacity();

    // 保存到数据库
    this.persistToDatabase(fullMemory);

    logger.debug('记忆已保存', { id: fullMemory.id, type: fullMemory.type });
    return fullMemory;
  }

  /**
   * 根据ID获取记忆
   * @param id 记忆ID
   * @returns 记忆或 undefined
   */
  getById(id: string): AnyMemory | undefined {
    const memory = this.memories.get(id);
    if (memory) {
      this.touch(memory);
    }
    return memory;
  }

  /**
   * 更新记忆
   * @param id 记忆ID
   * @param updates 更新内容
   * @returns 更新后的记忆或 undefined
   */
  update(id: string, updates: Partial<AnyMemory>): AnyMemory | undefined {
    const memory = this.memories.get(id);
    if (!memory) {
      // 尝试从数据库加载
      return this.updateInDatabase(id, updates);
    }

    const updated = { ...memory, ...updates, id: memory.id } as AnyMemory;
    this.memories.set(id, updated);
    this.persistToDatabase(updated);

    logger.debug('记忆已更新', { id });
    return updated;
  }

  /**
   * 删除记忆
   * @param id 记忆ID
   * @returns 是否成功删除
   */
  delete(id: string): boolean {
    const existed = this.memories.delete(id);
    this.shortTermIds = this.shortTermIds.filter((mid) => mid !== id);

    // 从数据库删除
    run('DELETE FROM memories WHERE id = ?', [id]);
    run('DELETE FROM memory_vectors WHERE memory_id = ?', [id]);

    if (existed) {
      logger.debug('记忆已删除', { id });
    }
    return existed;
  }

  /**
   * 查询记忆
   * @param options 查询选项
   * @returns 记忆列表
   */
  query(options: MemoryQueryOptions = {}): AnyMemory[] {
    let results = Array.from(this.memories.values());

    // 类型筛选
    if (options.type) {
      results = results.filter((m) => m.type === options.type);
    }

    // 标签筛选
    if (options.tags && options.tags.length > 0) {
      results = results.filter((m) =>
        options.tags!.some((tag) => m.tags.includes(tag))
      );
    }

    // 时间范围筛选
    if (options.startTime) {
      results = results.filter((m) => m.createdAt >= options.startTime!);
    }
    if (options.endTime) {
      results = results.filter((m) => m.createdAt <= options.endTime!);
    }

    // 重要性筛选
    if (options.minImportance !== undefined) {
      results = results.filter((m) => m.importance >= options.minImportance!);
    }

    // 排序
    const orderBy = options.orderBy ?? 'createdAt';
    const descending = options.descending ?? true;
    results.sort((a, b) => {
      const aVal = a[orderBy];
      const bVal = b[orderBy];
      return descending
        ? (bVal > aVal ? 1 : bVal < aVal ? -1 : 0)
        : (aVal > bVal ? 1 : aVal < bVal ? -1 : 0);
    });

    // 限制数量
    const limit = options.limit ?? results.length;
    results = results.slice(0, limit);

    // 更新访问记录
    results.forEach((m) => this.touch(m));

    return results;
  }

  /**
   * 搜索记忆 (关键词匹配)
   * @param keywords 关键词
   * @param limit 最大数量
   * @returns 记忆列表
   */
  search(keywords: string[], limit = 10): MemoryRetrievalResult[] {
    const memories = Array.from(this.memories.values());
    const results: MemoryRetrievalResult[] = [];

    for (const memory of memories) {
      const content = JSON.stringify(memory).toLowerCase();
      const matchCount = keywords.filter((kw) =>
        content.includes(kw.toLowerCase())
      ).length;

      if (matchCount > 0) {
        results.push({
          memory,
          relevance: matchCount / keywords.length,
          retrievalMethod: 'exact',
        });
      }
    }

    // 按相关性排序
    results.sort((a, b) => b.relevance - a.relevance);
    return results.slice(0, limit);
  }

  /**
   * 语义搜索记忆
   * @param queryVector 查询向量
   * @param limit 最大数量
   * @param threshold 相似度阈值
   * @returns 检索结果
   */
  async semanticSearch(
    queryVector: number[],
    limit = 5,
    threshold = 0.7
  ): Promise<MemoryRetrievalResult[]> {
    if (!this.vectorStoreEnabled || !this.embeddingService.isEnabled()) {
      return [];
    }

    const results: MemoryRetrievalResult[] = [];

    // 从数据库获取所有向量
    const rows = query<{ memory_id: string; vector: Buffer }>(
      'SELECT memory_id, vector FROM memory_vectors'
    );

    for (const row of rows) {
      const memory = this.memories.get(row.memory_id);
      if (!memory) continue;

      // 解码向量
      const vector = this.bufferToVector(row.vector);

      // 计算相似度
      const similarity = this.embeddingService.cosineSimilarity(
        queryVector,
        vector
      );

      if (similarity >= threshold) {
        results.push({
          memory,
          relevance: similarity,
          retrievalMethod: 'semantic',
        });
      }
    }

    // 按相似度排序
    results.sort((a, b) => b.relevance - a.relevance);
    return results.slice(0, limit);
  }

  /**
   * 保存记忆并生成向量
   * @param memory 记忆对象
   * @param generateEmbedding 是否生成嵌入向量
   */
  async saveWithEmbedding(
    memory: Omit<AnyMemory, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>,
    generateEmbedding = true
  ): Promise<AnyMemory> {
    const savedMemory = this.save(memory);

    // 如果启用了向量存储，异步生成向量
    if (generateEmbedding && this.vectorStoreEnabled && this.embeddingService.isEnabled()) {
      try {
        const embedding = await this.embeddingService.generateEmbedding(
          savedMemory.content
        );
        this.saveVector(savedMemory.id, embedding);
      } catch (error) {
        logger.error('生成记忆向量失败', { 
          memoryId: savedMemory.id, 
          error 
        });
      }
    }

    return savedMemory;
  }

  /**
   * 保存向量到数据库
   */
  private saveVector(memoryId: string, vector: number[]): void {
    const buffer = Buffer.from(new Float64Array(vector).buffer);
    run(
      'INSERT OR REPLACE INTO memory_vectors (memory_id, vector) VALUES (?, ?)',
      [memoryId, buffer]
    );
  }

  /**
   * Buffer 转向量
   */
  private bufferToVector(buffer: Buffer): number[] {
    const floatArray = new Float64Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength / 8
    );
    return Array.from(floatArray);
  }

  /**
   * 获取最近的记忆
   * @param count 数量
   * @returns 记忆列表
   */
  getRecent(count = 10): AnyMemory[] {
    const ids = this.shortTermIds.slice(0, count);
    return ids
      .map((id) => this.memories.get(id))
      .filter((m): m is AnyMemory => m !== undefined);
  }

  /**
   * 获取所有记忆
   * @returns 记忆列表
   */
  getAll(): AnyMemory[] {
    return Array.from(this.memories.values());
  }

  /**
   * 获取记忆数量
   * @returns 数量
   */
  getCount(): number {
    return this.memories.size;
  }

  /**
   * 清空所有记忆
   */
  clear(): void {
    this.memories.clear();
    this.shortTermIds = [];
    run('DELETE FROM memories');
    run('DELETE FROM memory_vectors');
    logger.info('所有记忆已清空');
  }

  /**
   * 维护短期记忆容量
   */
  private maintainShortTermCapacity(): void {
    while (this.shortTermIds.length > this.shortTermCapacity) {
      const removedId = this.shortTermIds.pop();
      if (removedId) {
        // 从内存移除，但保留在数据库
        this.memories.delete(removedId);
      }
    }
  }

  /**
   * 更新访问记录
   */
  private touch(memory: AnyMemory): void {
    memory.accessCount++;
    memory.lastAccessedAt = new Date().toISOString();

    // 更新短期记忆顺序
    const idx = this.shortTermIds.indexOf(memory.id);
    if (idx > -1) {
      this.shortTermIds.splice(idx, 1);
      this.shortTermIds.unshift(memory.id);
    }

    // 异步更新数据库访问计数
    run('UPDATE memories SET access_count = ?, last_accessed_at = ? WHERE id = ?', [
      memory.accessCount,
      memory.lastAccessedAt,
      memory.id,
    ]);
  }

  /**
   * 持久化到数据库
   */
  private persistToDatabase(memory: AnyMemory): void {
    run(
      `INSERT OR REPLACE INTO memories 
       (id, type, content, created_at, last_accessed_at, access_count, 
        importance, emotional_intensity, confidence, related_memory_ids, tags, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        memory.id,
        memory.type,
        memory.content,
        memory.createdAt,
        memory.lastAccessedAt,
        memory.accessCount,
        memory.importance,
        memory.emotionalIntensity,
        memory.confidence,
        JSON.stringify(memory.relatedMemoryIds),
        JSON.stringify(memory.tags),
        JSON.stringify(memory),
      ]
    );
  }

  /**
   * 在数据库中更新记忆
   */
  private updateInDatabase(
    id: string,
    updates: Partial<AnyMemory>
  ): AnyMemory | undefined {
    const rows = query<{ data: string }>('SELECT data FROM memories WHERE id = ?', [id]);
    if (rows.length === 0) return undefined;

    const memory = JSON.parse(rows[0].data) as AnyMemory;
    const updated = { ...memory, ...updates, id: memory.id } as AnyMemory;
    this.persistToDatabase(updated);

    return updated;
  }

  /**
   * 从数据库获取记忆统计
   */
  getStats(): {
    totalCount: number;
    typeCounts: Record<MemoryType, number>;
  } {
    const total = query<{ count: number }>('SELECT COUNT(*) as count FROM memories')[0].count;

    const typeCounts: Record<MemoryType, number> = {
      episodic: 0,
      semantic: 0,
      procedural: 0,
      reflective: 0,
    };

    const typeRows = query<{ type: MemoryType; count: number }>(
      'SELECT type, COUNT(*) as count FROM memories GROUP BY type'
    );
    for (const row of typeRows) {
      typeCounts[row.type] = row.count;
    }

    return { totalCount: total, typeCounts };
  }
}
