/**
 * @file core/memory/memory-system.ts
 * @description 记忆系统 - 整合存储、检索和提示词生成
 * @author Ouroboros
 * @date 2026-02-18
 */

import type {
  AnyMemory,
  MemoryType,
  MemoryQueryOptions,
  MemoryRetrievalResult,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  ReflectiveMemory,
  MemoryContext,
} from '@/types/memory';
import { MemoryStore } from './memory-store';
import { EmbeddingService } from './embedding-service';
import { createContextLogger } from '@/utils/logger';
import { getConfig } from '@/config';

const logger = createContextLogger('MemorySystem');

/**
 * 记忆系统类
 * 整合记忆存储、检索和提示词生成功能
 */
export class MemorySystem {
  /** 记忆存储 */
  private store: MemoryStore;
  /** 嵌入服务 */
  private embeddingService: EmbeddingService;
  /** 向量搜索是否启用 */
  private vectorSearchEnabled: boolean;
  /** 当前对话历史 */
  private currentConversation: { role: 'user' | 'assistant'; content: string; timestamp: string }[] = [];
  /** 用户偏好缓存 */
  private userPreferences: Map<string, string> = new Map();

  /**
   * 创建记忆系统实例
   */
  constructor() {
    const config = getConfig();
    this.vectorSearchEnabled = config.memory.vectorStore.enabled;
    this.store = new MemoryStore(
      config.memory.shortTermCapacity,
      this.vectorSearchEnabled
    );
    this.embeddingService = new EmbeddingService();
    
    logger.info('记忆系统初始化完成', {
      vectorSearchEnabled: this.vectorSearchEnabled && this.embeddingService.isEnabled(),
    });
  }

  // ============================================================================
  // 记忆记录方法
  // ============================================================================

  /**
   * 记录对话
   * @param userInput 用户输入
   * @param assistantResponse 助手回复
   */
  recordConversation(userInput: string, assistantResponse: string): AnyMemory {
    const timestamp = new Date().toISOString();

    // 添加到当前对话历史
    this.currentConversation.push(
      { role: 'user', content: userInput, timestamp },
      { role: 'assistant', content: assistantResponse, timestamp }
    );

    // 限制对话历史长度
    const maxHistory = 20;
    if (this.currentConversation.length > maxHistory) {
      this.currentConversation = this.currentConversation.slice(-maxHistory);
    }

    // 保存为情景记忆
    const memory = this.store.save({
      type: 'episodic',
      title: `对话: ${userInput.slice(0, 50)}...`,
      description: `用户说: ${userInput}\n助手回复: ${assistantResponse}`,
      participants: ['user', 'assistant'],
      timestamp,
      conversation: [
        { role: 'user', content: userInput, timestamp },
        { role: 'assistant', content: assistantResponse, timestamp },
      ],
      content: `${userInput} \u2192 ${assistantResponse}`,
      emotionalIntensity: 0,
      importance: this.calculateImportance(userInput, assistantResponse),
      confidence: 1,
      relatedMemoryIds: [],
      tags: ['conversation', 'interaction'],
    } as Omit<EpisodicMemory, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>);

    logger.debug('对话已记录到记忆', { memoryId: memory.id });
    return memory;
  }

  /**
   * 记录事实
   * @param fact 事实内容
   * @param category 类别
   * @param importance 重要性
   */
  recordFact(
    fact: string,
    category: string,
    importance = 0.5
  ): AnyMemory {
    const memory = this.store.save({
      type: 'semantic',
      fact,
      category,
      verified: false,
      conflictingMemoryIds: [],
      content: fact,
      emotionalIntensity: 0,
      importance,
      confidence: 0.8,
      relatedMemoryIds: [],
      tags: ['fact', category],
    } as Omit<SemanticMemory, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>);

    logger.debug('事实已记录', { fact: fact.slice(0, 50) });
    return memory;
  }

  /**
   * 记录技能执行
   * @param skillName 技能名称
   * @param description 描述
   * @param success 是否成功
   */
  recordSkillExecution(
    skillName: string,
    description: string,
    success: boolean
  ): AnyMemory {
    // 查找现有技能记忆
    const existing = this.store.query({
      type: 'procedural',
      tags: [skillName],
      limit: 1,
    })[0] as ProceduralMemory | undefined;

    if (existing) {
      // 更新现有技能
      const updates: Partial<ProceduralMemory> = {
        successCount: existing.successCount + (success ? 1 : 0),
        failureCount: existing.failureCount + (success ? 0 : 1),
        lastExecutedAt: new Date().toISOString(),
      };
      updates.successRate =
        updates.successCount! / (updates.successCount! + updates.failureCount!);
      this.store.update(existing.id, updates);
      return { ...existing, ...updates } as ProceduralMemory;
    }

    // 创建新技能记忆
    const memory = this.store.save({
      type: 'procedural',
      skillName,
      description,
      steps: [],
      successCount: success ? 1 : 0,
      failureCount: success ? 0 : 1,
      successRate: success ? 1 : 0,
      content: `技能: ${skillName} - ${description}`,
      emotionalIntensity: 0,
      importance: 0.6,
      confidence: 1,
      relatedMemoryIds: [],
      tags: ['skill', skillName],
    } as Omit<ProceduralMemory, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>);

    return memory;
  }

  /**
   * 记录洞察
   * @param insight 洞察内容
   * @param detail 详细说明
   * @param triggerEvent 触发事件
   */
  recordInsight(
    insight: string,
    detail: string,
    triggerEvent?: string
  ): AnyMemory {
    const memory = this.store.save({
      type: 'reflective',
      insight,
      detail,
      triggerEvent,
      content: `洞察: ${insight}`,
      emotionalIntensity: 0.3,
      importance: 0.8,
      confidence: 0.7,
      relatedMemoryIds: [],
      tags: ['insight', 'reflection'],
    } as Omit<ReflectiveMemory, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>);

    logger.info('洞察已记录', { insight: insight.slice(0, 50) });
    return memory;
  }

  /**
   * 记录用户偏好
   * @param key 偏好键
   * @param value 偏好值
   */
  recordUserPreference(key: string, value: string): void {
    this.userPreferences.set(key, value);
    this.recordFact(
      `用户偏好: ${key} = ${value}`,
      'preference',
      0.7
    );
  }

  // ============================================================================
  // 记忆检索方法
  // ============================================================================

  /**
   * 检索相关记忆
   * @param query 查询内容
   * @param limit 最大数量
   * @returns 检索结果
   */
  async retrieveRelevant(query: string, limit = 5): Promise<MemoryRetrievalResult[]> {
    // 1. 关键词搜索（始终使用）
    const keywords = query.toLowerCase().split(/\s+/);
    const keywordResults = this.store.search(keywords, limit);

    // 2. 语义搜索（如果启用）
    let semanticResults: MemoryRetrievalResult[] = [];
    if (this.vectorSearchEnabled && this.embeddingService.isEnabled()) {
      try {
        const queryVector = await this.embeddingService.generateEmbedding(query);
        const threshold = getConfig().memory.vectorStore.similarityThreshold;
        semanticResults = await this.store.semanticSearch(
          queryVector,
          limit,
          threshold
        );
      } catch (error) {
        logger.warn('语义搜索失败，回退到关键词搜索', { error });
      }
    }

    // 3. 合并结果并去重
    const merged = new Map<string, MemoryRetrievalResult>();
    
    // 关键词结果权重 0.4
    for (const result of keywordResults) {
      merged.set(result.memory.id, {
        ...result,
        relevance: result.relevance * 0.4,
      });
    }
    
    // 语义结果权重 0.6
    for (const result of semanticResults) {
      const existing = merged.get(result.memory.id);
      if (existing) {
        // 混合两种相关性
        existing.relevance = existing.relevance + result.relevance * 0.6;
        existing.retrievalMethod = 'semantic';
      } else {
        merged.set(result.memory.id, {
          ...result,
          relevance: result.relevance * 0.6,
        });
      }
    }

    // 4. 排序并返回
    return Array.from(merged.values())
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  /**
   * 获取最近记忆
   * @param count 数量
   * @returns 记忆列表
   */
  getRecentMemories(count = 5): AnyMemory[] {
    return this.store.getRecent(count);
  }

  /**
   * 查询记忆
   * @param options 查询选项
   * @returns 记忆列表
   */
  queryMemories(options: MemoryQueryOptions): AnyMemory[] {
    return this.store.query(options);
  }

  // ============================================================================
  // 提示词生成
  // ============================================================================

  /**
   * 生成记忆上下文
   * @param currentInput 当前输入
   * @returns 记忆上下文
   */
  async generateMemoryContext(currentInput: string): Promise<MemoryContext> {
    // 1. 检索相关记忆
    const relevantResults = await this.retrieveRelevant(currentInput, 5);
    const relevantMemories = relevantResults.map((r) => r.memory);

    // 2. 获取最近对话
    const recentConversation = this.currentConversation.slice(-6);

    // 3. 提取关键事实
    const keyFacts = this.store
      .query({ type: 'semantic', minImportance: 0.7, limit: 5 })
      .map((m) => (m as SemanticMemory).fact);

    // 4. 生成上下文文本
    const contextText = this.formatMemoryForPrompt(
      relevantMemories,
      recentConversation,
      keyFacts
    );

    return {
      relevantMemories,
      recentConversation,
      keyFacts,
      userPreferences: Object.fromEntries(this.userPreferences),
      contextText,
    };
  }

  /**
   * 格式化记忆为提示词文本
   */
  private formatMemoryForPrompt(
    memories: AnyMemory[],
    conversation: { role: 'user' | 'assistant'; content: string }[],
    facts: string[]
  ): string {
    const sections: string[] = [];

    // 最近对话历史
    if (conversation.length > 0) {
      sections.push('### 最近对话');
      for (const msg of conversation) {
        const prefix = msg.role === 'user' ? '用户' : '你';
        sections.push(`${prefix}: ${msg.content}`);
      }
      sections.push('');
    }

    // 关键事实
    if (facts.length > 0) {
      sections.push('### 已知事实');
      facts.forEach((fact, i) => {
        sections.push(`${i + 1}. ${fact}`);
      });
      sections.push('');
    }

    // 相关记忆
    if (memories.length > 0) {
      sections.push('### 相关记忆');
      for (const memory of memories) {
        const desc = this.formatMemoryDescription(memory);
        if (desc) sections.push(`- ${desc}`);
      }
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * 格式化单条记忆描述
   */
  private formatMemoryDescription(memory: AnyMemory): string {
    switch (memory.type) {
      case 'episodic':
        const em = memory as EpisodicMemory;
        return em.description.slice(0, 100) + (em.description.length > 100 ? '...' : '');
      case 'semantic':
        const sm = memory as SemanticMemory;
        return sm.fact.slice(0, 100);
      case 'procedural':
        const pm = memory as ProceduralMemory;
        return `${pm.skillName}: ${pm.description} (成功率: ${(pm.successRate * 100).toFixed(0)}%)`;
      case 'reflective':
        const rm = memory as ReflectiveMemory;
        return `洞察: ${rm.insight}`;
      default:
        return (memory as AnyMemory).content?.slice(0, 100) ?? '';
    }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 计算重要性
   */
  private calculateImportance(userInput: string, assistantResponse: string): number {
    let importance = 0.5;

    // 关键词提升重要性
    const importantKeywords = [
      '重要', '关键', '必须', '记住', '不要忘记',
      'preference', 'like', 'dislike', 'always', 'never',
    ];
    const content = `${userInput} ${assistantResponse}`.toLowerCase();
    for (const kw of importantKeywords) {
      if (content.includes(kw.toLowerCase())) {
        importance += 0.1;
      }
    }

    // 长度因子
    if (userInput.length > 100) importance += 0.1;

    return Math.min(1, importance);
  }

  /**
   * 获取记忆统计
   */
  getStats(): {
    totalCount: number;
    typeCounts: Record<MemoryType, number>;
    conversationHistoryLength: number;
  } {
    const storeStats = this.store.getStats();
    return {
      ...storeStats,
      conversationHistoryLength: this.currentConversation.length,
    };
  }

  /**
   * 清空对话历史
   */
  clearConversation(): void {
    this.currentConversation = [];
    logger.info('对话历史已清空');
  }

  /**
   * 导出所有记忆
   */
  exportMemories(): AnyMemory[] {
    return this.store.getAll();
  }

  /**
   * 获取原始存储实例 (高级操作)
   */
  getStore(): MemoryStore {
    return this.store;
  }
}
