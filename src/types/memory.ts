/**
 * @file types/memory.ts
 * @description 记忆系统类型定义
 * @author Ouroboros
 * @date 2026-02-18
 */

/**
 * 记忆类型
 */
export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'reflective';

/**
 * 记忆重要性等级
 */
export type ImportanceLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * 记忆基础接口
 */
export interface Memory {
  /** 唯一标识符 */
  id: string;
  /** 记忆类型 */
  type: MemoryType;
  /** 内容 */
  content: string;
  /** 创建时间 */
  createdAt: string;
  /** 最后访问时间 */
  lastAccessedAt: string;
  /** 访问次数 */
  accessCount: number;
  /** 重要性 (0-1) */
  importance: number;
  /** 情感强度 (-1 到 1) */
  emotionalIntensity: number;
  /** 置信度 (0-1) */
  confidence: number;
  /** 关联记忆ID列表 */
  relatedMemoryIds: string[];
  /** 标签 */
  tags: string[];
}

/**
 * 情景记忆 - 具体事件和经历
 */
export interface EpisodicMemory extends Memory {
  type: 'episodic';
  /** 事件标题 */
  title: string;
  /** 事件描述 */
  description: string;
  /** 参与角色 */
  participants: string[];
  /** 地点 */
  location?: string;
  /** 时间戳 */
  timestamp: string;
  /** 事件结果 */
  outcome?: string;
  /** 对话内容 */
  conversation?: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }[];
}

/**
 * 语义记忆 - 事实和知识
 */
export interface SemanticMemory extends Memory {
  type: 'semantic';
  /** 事实陈述 */
  fact: string;
  /** 类别 */
  category: string;
  /** 来源 */
  source?: string;
  /** 验证状态 */
  verified: boolean;
  /** 冲突记忆ID列表 */
  conflictingMemoryIds: string[];
}

/**
 * 程序记忆 - 技能和程序
 */
export interface ProceduralMemory extends Memory {
  type: 'procedural';
  /** 技能名称 */
  skillName: string;
  /** 技能描述 */
  description: string;
  /** 执行步骤 */
  steps: string[];
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failureCount: number;
  /** 成功率 */
  successRate: number;
  /** 最后执行时间 */
  lastExecutedAt?: string;
}

/**
 * 反思记忆 - 洞察和总结
 */
export interface ReflectiveMemory extends Memory {
  type: 'reflective';
  /** 洞察标题 */
  insight: string;
  /** 详细内容 */
  detail: string;
  /** 触发事件 */
  triggerEvent?: string;
  /** 改进建议 */
  improvement?: string;
}

/**
 * 记忆联合类型
 */
export type AnyMemory = EpisodicMemory | SemanticMemory | ProceduralMemory | ReflectiveMemory;

/**
 * 记忆查询选项
 */
export interface MemoryQueryOptions {
  /** 记忆类型筛选 */
  type?: MemoryType;
  /** 标签筛选 */
  tags?: string[];
  /** 时间范围开始 */
  startTime?: string;
  /** 时间范围结束 */
  endTime?: string;
  /** 最小重要性 */
  minImportance?: number;
  /** 最大返回数量 */
  limit?: number;
  /** 排序方式 */
  orderBy?: 'createdAt' | 'lastAccessedAt' | 'importance' | 'accessCount';
  /** 是否降序 */
  descending?: boolean;
}

/**
 * 记忆检索结果
 */
export interface MemoryRetrievalResult {
  /** 记忆 */
  memory: AnyMemory;
  /** 相关性分数 (0-1) */
  relevance: number;
  /** 检索方式 */
  retrievalMethod: 'exact' | 'semantic' | 'temporal' | 'associative';
}

/**
 * 记忆系统配置
 */
export interface MemorySystemConfig {
  /** 短期记忆容量 */
  shortTermCapacity: number;
  /** 长期记忆存储目录 */
  longTermStorageDir: string;
  /** 记忆巩固阈值 */
  consolidationThreshold: number;
  /** 遗忘系数 (0-1) */
  forgettingRate: number;
  /** 最大记忆数量 */
  maxMemories: number;
  /** 自动归档天数 */
  autoArchiveDays: number;
  /** 向量存储配置 */
  vectorStore: {
    enabled: boolean;
    dimension: number;
    similarityThreshold: number;
  };
  /** 检索配置 */
  retrieval: {
    /** 默认返回记忆数量 */
    defaultLimit: number;
    /** 最大返回记忆数量 */
    maxLimit: number;
    /** 语义检索权重 */
    semanticWeight: number;
    /** 时间衰减权重 */
    temporalWeight: number;
    /** 重要性权重 */
    importanceWeight: number;
  };
}

/**
 * 记忆统计
 */
export interface MemoryStats {
  /** 总记忆数 */
  totalCount: number;
  /** 各类型记忆数量 */
  typeCounts: Record<MemoryType, number>;
  /** 今日新增 */
  todayAdded: number;
  /** 今日访问 */
  todayAccessed: number;
  /** 平均重要性 */
  avgImportance: number;
  /** 存储大小 (字节) */
  storageSize: number;
}

/**
 * 记忆提示词上下文
 */
export interface MemoryContext {
  /** 相关记忆列表 */
  relevantMemories: AnyMemory[];
  /** 最近对话历史 */
  recentConversation: {
    role: 'user' | 'assistant';
    content: string;
  }[];
  /** 关键事实 */
  keyFacts: string[];
  /** 用户偏好 */
  userPreferences: Record<string, string>;
  /** 上下文文本 (用于提示词) */
  contextText: string;
}
