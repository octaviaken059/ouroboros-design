/**
 * Ouroboros - Layered Memory System
 * 5层记忆架构 + 混合搜索 + 容错降级
 * 
 * 层级设计:
 * - Working: 工作记忆 (7±2 chunks, 秒级)
 * - Episodic: 情景记忆 (事件记录, 天级)
 * - Semantic: 语义记忆 (知识抽象, 永久)
 * - Procedural: 程序记忆 (技能掌握, 永久)
 * - Reflective: 反思记忆 (元认知洞察, 永久)
 */

export interface MemoryChunk {
  id: string;
  content: string;
  timestamp: number;
  accessCount: number;
  importance: number;
  emotionalWeight: number;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface EpisodicMemoryEntry extends MemoryChunk {
  type: 'episodic';
  context: string;
  outcome?: string;
  relatedMemories?: string[];
}

export interface SemanticMemoryEntry extends MemoryChunk {
  type: 'semantic';
  category: string;
  confidence: number;
  sources: string[];
}

export interface ProceduralMemoryEntry extends MemoryChunk {
  type: 'procedural';
  skillName: string;
  successRate: number;
  executionCount: number;
  parameters?: Record<string, unknown>;
}

export interface ReflectiveMemoryEntry extends MemoryChunk {
  type: 'reflective';
  insight: string;
  biasDetected?: string[];
  learningDirection?: string;
  impact: number;
}

export type MemoryEntry = 
  | EpisodicMemoryEntry 
  | SemanticMemoryEntry 
  | ProceduralMemoryEntry 
  | ReflectiveMemoryEntry;

export interface SearchResult {
  entry: MemoryEntry;
  score: number;
  matchType: 'vector' | 'keyword' | 'hybrid';
}

export interface HybridSearchOptions {
  vectorWeight?: number;
  keywordWeight?: number;
  limit?: number;
  threshold?: number;
  memoryTypes?: Array<MemoryEntry['type']>;
  tags?: string[];
  timeRange?: { start?: number; end?: number };
}

export interface MemoryConfig {
  workingCapacity: number;
  maxMemoryCount: number;
  similarityThreshold: number;
  enableVectorization: boolean;
  enableHybridSearch: boolean;
  embeddingProvider?: 'ollama' | 'openai' | 'none';
  persistPath?: string;
}

const DEFAULT_CONFIG: MemoryConfig = {
  workingCapacity: 7,
  maxMemoryCount: 10000,
  similarityThreshold: 0.7,
  enableVectorization: true,
  enableHybridSearch: true,
  embeddingProvider: 'ollama',
};

/**
 * 记忆存储接口
 */
interface IVectorStore {
  add(id: string, vector: number[], entry: MemoryEntry): Promise<void>;
  search(vector: number[], limit: number, threshold: number): Promise<Array<{ id: string; score: number; entry: MemoryEntry }>>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * 向量服务接口
 */
interface IEmbeddingService {
  initialize?(): Promise<boolean>;
  embed(text: string): Promise<number[]>;
  isAvailable(): Promise<boolean>;
}

/**
 * 简单内存向量存储 (生产环境可使用SQLite/PGVector)
 */
class InMemoryVectorStore implements IVectorStore {
  private store: Map<string, { vector: number[]; entry: MemoryEntry }> = new Map();

  async add(id: string, vector: number[], entry: MemoryEntry): Promise<void> {
    this.store.set(id, { vector, entry });
  }

  async search(vector: number[], limit: number, threshold: number): Promise<Array<{ id: string; score: number; entry: MemoryEntry }>> {
    const results: Array<{ id: string; score: number; entry: MemoryEntry }> = [];
    
    for (const [id, data] of this.store.entries()) {
      const similarity = this.cosineSimilarity(vector, data.vector);
      if (similarity >= threshold) {
        results.push({ id, score: similarity, entry: data.entry });
      }
    }
    
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}

/**
 * Ollama嵌入服务
 */
class OllamaEmbeddingService implements IEmbeddingService {
  constructor(
    private model: string = 'nomic-embed-text',
    private apiUrl: string = 'http://localhost:11434'
  ) {}

  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${this.apiUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt: text }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embedding failed: ${response.statusText}`);
    }

    const data = await response.json() as { embedding?: number[] };
    return data.embedding || [];
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/api/tags`, { timeout: 2000 } as RequestInit);
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * 简单关键词嵌入服务 (降级方案)
 */
class KeywordEmbeddingService implements IEmbeddingService {
  private vocabulary: Map<string, number> = new Map();
  private dimension = 256;

  async embed(text: string): Promise<number[]> {
    const vector = new Array(this.dimension).fill(0);
    const tokens = this.tokenize(text);
    
    for (const token of tokens) {
      const hash = this.hashString(token);
      for (let i = 0; i < this.dimension; i++) {
        vector[i] += Math.sin(hash * (i + 1)) / tokens.length;
      }
    }
    
    // Normalize
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return norm === 0 ? vector : vector.map(v => v / norm);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

/**
 * 5层记忆系统
 */
export class LayeredMemory {
  // 工作记忆 - 容量限制 (7±2 chunks)
  private working: MemoryChunk[] = [];
  
  // 长期记忆存储
  private episodic: EpisodicMemoryEntry[] = [];
  private semantic: SemanticMemoryEntry[] = [];
  private procedural: ProceduralMemoryEntry[] = [];
  private reflective: ReflectiveMemoryEntry[] = [];
  
  // 向量搜索基础设施
  private vectorStore: IVectorStore;
  private embeddingService: IEmbeddingService;
  private config: MemoryConfig;
  
  // 降级状态追踪
  private vectorizationFailed = false;
  private lastFailureTime = 0;

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.vectorStore = new InMemoryVectorStore();
    this.embeddingService = this.config.embeddingProvider === 'ollama' 
      ? new OllamaEmbeddingService()
      : new KeywordEmbeddingService();
  }

  /**
   * 初始化记忆系统
   */
  async initialize(): Promise<void> {
    if (this.config.enableVectorization) {
      const available = await this.embeddingService.isAvailable();
      if (!available) {
        console.warn('⚠️ Vectorization service unavailable, using keyword fallback');
        this.embeddingService = new KeywordEmbeddingService();
        this.vectorizationFailed = true;
      }
    }
  }

  /**
   * 添加到工作记忆
   */
  addToWorking(chunk: MemoryChunk): void {
    this.working.unshift(chunk);
    
    // 保持容量限制
    while (this.working.length > this.config.workingCapacity + 2) {
      const evicted = this.working.pop();
      if (evicted && evicted.importance > 0.7) {
        // 重要记忆转移到情景记忆
        this.addEpisodic({
          ...evicted,
          type: 'episodic',
          context: 'Transferred from working memory',
        });
      }
    }
  }

  /**
   * 添加情景记忆
   */
  async addEpisodic(entry: Omit<EpisodicMemoryEntry, 'id' | 'timestamp' | 'accessCount'>): Promise<void> {
    const fullEntry: EpisodicMemoryEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: Date.now(),
      accessCount: 0,
    };
    
    this.episodic.push(fullEntry);
    await this.indexMemory(fullEntry);
    this.enforceMemoryLimit();
  }

  /**
   * 添加语义记忆
   */
  async addSemantic(entry: Omit<SemanticMemoryEntry, 'id' | 'timestamp' | 'accessCount'>): Promise<void> {
    const fullEntry: SemanticMemoryEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: Date.now(),
      accessCount: 0,
    };
    
    this.semantic.push(fullEntry);
    await this.indexMemory(fullEntry);
    this.enforceMemoryLimit();
  }

  /**
   * 添加程序记忆
   */
  async addProcedural(entry: Omit<ProceduralMemoryEntry, 'id' | 'timestamp' | 'accessCount'>): Promise<void> {
    const fullEntry: ProceduralMemoryEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: Date.now(),
      accessCount: 0,
    };
    
    this.procedural.push(fullEntry);
    await this.indexMemory(fullEntry);
    this.enforceMemoryLimit();
  }

  /**
   * 添加反思记忆
   */
  async addReflective(entry: Omit<ReflectiveMemoryEntry, 'id' | 'timestamp' | 'accessCount'>): Promise<void> {
    const fullEntry: ReflectiveMemoryEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: Date.now(),
      accessCount: 0,
    };
    
    this.reflective.push(fullEntry);
    await this.indexMemory(fullEntry);
    this.enforceMemoryLimit();
  }

  /**
   * 混合搜索 (向量 + 关键词)
   */
  async search(query: string, options: HybridSearchOptions = {}): Promise<SearchResult[]> {
    const {
      vectorWeight = 0.6,
      keywordWeight = 0.4,
      limit = 10,
      threshold = this.config.similarityThreshold,
      memoryTypes,
      tags,
      timeRange,
    } = options;

    const results: SearchResult[] = [];
    const seenIds = new Set<string>();

    // 尝试向量搜索 (如果启用且未失败)
    if (this.config.enableVectorization && !this.vectorizationFailed) {
      try {
        const queryVector = await this.embeddingService.embed(query);
        const vectorResults = await this.vectorStore.search(queryVector, limit * 2, threshold);
        
        for (const { entry, score } of vectorResults) {
          if (this.matchesFilter(entry, memoryTypes, tags, timeRange)) {
            results.push({ entry, score: score * vectorWeight, matchType: 'vector' });
            seenIds.add(entry.id);
          }
        }
      } catch (error) {
        console.warn('⚠️ Vector search failed, falling back to keyword search:', error);
        this.vectorizationFailed = true;
        this.lastFailureTime = Date.now();
      }
    }

    // 关键词搜索 (总是执行作为备选或补充)
    const keywordResults = this.keywordSearch(query, limit * 2);
    for (const { entry, score } of keywordResults) {
      if (!seenIds.has(entry.id) && this.matchesFilter(entry, memoryTypes, tags, timeRange)) {
        const existingIndex = results.findIndex(r => r.entry.id === entry.id);
        if (existingIndex >= 0) {
          // 混合评分
          results[existingIndex].score += score * keywordWeight;
          results[existingIndex].matchType = 'hybrid';
        } else {
          results.push({ entry, score: score * keywordWeight, matchType: 'keyword' });
        }
      }
    }

    // 排序并限制结果
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, limit);

    // 更新访问计数
    for (const result of topResults) {
      result.entry.accessCount++;
    }

    return topResults;
  }

  /**
   * 快速回忆 (仅工作记忆)
   */
  recallWorking(pattern?: string): MemoryChunk[] {
    if (!pattern) return [...this.working];
    
    const regex = new RegExp(pattern, 'i');
    return this.working.filter(chunk => 
      regex.test(chunk.content) || 
      chunk.tags?.some(tag => regex.test(tag))
    );
  }

  /**
   * 获取记忆统计
   */
  getStats(): {
    working: number;
    episodic: number;
    semantic: number;
    procedural: number;
    reflective: number;
    total: number;
    vectorizationActive: boolean;
  } {
    return {
      working: this.working.length,
      episodic: this.episodic.length,
      semantic: this.semantic.length,
      procedural: this.procedural.length,
      reflective: this.reflective.length,
      total: this.working.length + this.episodic.length + this.semantic.length + 
             this.procedural.length + this.reflective.length,
      vectorizationActive: this.config.enableVectorization && !this.vectorizationFailed,
    };
  }

  /**
   * 清空所有记忆
   */
  async clear(): Promise<void> {
    this.working = [];
    this.episodic = [];
    this.semantic = [];
    this.procedural = [];
    this.reflective = [];
    await this.vectorStore.clear();
  }

  // ============ 私有方法 ============

  private async indexMemory(entry: MemoryEntry): Promise<void> {
    if (!this.config.enableVectorization || this.vectorizationFailed) return;
    
    try {
      const text = `${entry.content} ${entry.tags?.join(' ') || ''}`;
      const vector = await this.embeddingService.embed(text);
      await this.vectorStore.add(entry.id, vector, entry);
    } catch (error) {
      console.warn('⚠️ Failed to index memory:', error);
    }
  }

  private keywordSearch(query: string, limit: number): Array<{ entry: MemoryEntry; score: number }> {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    const results: Array<{ entry: MemoryEntry; score: number }> = [];
    const allMemories: MemoryEntry[] = [
      ...this.episodic,
      ...this.semantic,
      ...this.procedural,
      ...this.reflective,
    ];

    for (const entry of allMemories) {
      const content = entry.content.toLowerCase();
      const tags = entry.tags?.join(' ').toLowerCase() || '';
      
      let score = 0;
      for (const term of terms) {
        if (content.includes(term)) score += 0.5;
        if (tags.includes(term)) score += 0.3;
        if (content.startsWith(term)) score += 0.2;
      }
      
      // 考虑重要性、时效性和访问频率
      score += entry.importance * 0.3;
      score += Math.min(entry.accessCount * 0.05, 0.5);
      
      // 时间衰减
      const age = (Date.now() - entry.timestamp) / (1000 * 60 * 60 * 24); // days
      score *= Math.exp(-age / 30); // 30天半衰期
      
      if (score > 0) {
        results.push({ entry, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  private matchesFilter(
    entry: MemoryEntry,
    types?: Array<MemoryEntry['type']>,
    tags?: string[],
    timeRange?: { start?: number; end?: number }
  ): boolean {
    if (types && !types.includes(entry.type)) return false;
    if (tags && !tags.some(tag => entry.tags?.includes(tag))) return false;
    if (timeRange?.start && entry.timestamp < timeRange.start) return false;
    if (timeRange?.end && entry.timestamp > timeRange.end) return false;
    return true;
  }

  private enforceMemoryLimit(): void {
    const allMemories: { type: string; entries: MemoryEntry[] }[] = [
      { type: 'episodic', entries: this.episodic },
      { type: 'semantic', entries: this.semantic },
      { type: 'procedural', entries: this.procedural },
      { type: 'reflective', entries: this.reflective },
    ];

    let total = allMemories.reduce((sum, m) => sum + m.entries.length, 0);
    
    while (total > this.config.maxMemoryCount) {
      // 找到最低保留分数的记忆
      let lowestScore = Infinity;
      let targetType: string | null = null;
      let targetIndex = -1;

      for (const { type, entries } of allMemories) {
        for (let i = 0; i < entries.length; i++) {
          const score = this.calculateRetentionScore(entries[i]);
          if (score < lowestScore) {
            lowestScore = score;
            targetType = type;
            targetIndex = i;
          }
        }
      }

      if (targetType && targetIndex >= 0) {
        const memory = allMemories.find(m => m.type === targetType);
        if (memory) {
          const entry = memory.entries.splice(targetIndex, 1)[0];
          this.vectorStore.delete(entry.id).catch(() => {});
          total--;
        }
      } else {
        break;
      }
    }
  }

  private calculateRetentionScore(entry: MemoryEntry): number {
    const timeDecay = Math.exp(-(Date.now() - entry.timestamp) / (1000 * 60 * 60 * 24 * 7)); // 7天半衰期
    const usageBoost = Math.log(1 + entry.accessCount) * 0.1;
    const consolidationBonus = entry.importance > 0.8 || entry.accessCount > 5 ? 1.3 : 1.0;
    
    return (
      entry.importance *
      entry.emotionalWeight *
      (1 + usageBoost) *
      (1 - timeDecay) *
      consolidationBonus
    );
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default LayeredMemory;
