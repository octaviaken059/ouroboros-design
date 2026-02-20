/**
 * @file core/metacognition/self-referential-memory.ts
 * @description 自指编码记忆分层 - 使用自身判断记忆存储位置
 * @author Ouroboros
 * @date 2026-02-20
 *
 * 核心能力：
 * 1. 自指编码 - 使用模型判断"这段记忆该存哪一层"
 * 2. 自动关联 - 新记忆存储时自动寻找相似记忆建立链接
 * 3. 增强遗忘 - 基于重要性、检索频率、自我评估自动清理
 */

import type { AnyMemory, MemoryType } from '@/types/memory';
import type { MemorySystem } from '@/core/memory/memory-system';
import { createContextLogger } from '@/utils/logger';
import { randomUUID } from 'crypto';

const logger = createContextLogger('SelfReferentialMemory');

/** 记忆分层类型 */
export type MemoryLayer = 
  | 'working'      // 工作记忆 - 当前对话上下文
  | 'episodic'     // 情景记忆 - 具体事件
  | 'semantic'     // 语义记忆 - 事实知识
  | 'procedural'   // 程序记忆 - 技能和流程
  | 'reflective'   // 反思记忆 - 自我洞察
  | 'consolidated'; // 巩固记忆 - 长期稳定知识

/** 记忆编码决策 */
export interface MemoryEncodingDecision {
  /** 目标层级 */
  targetLayer: MemoryLayer;
  /** 初始重要性 */
  importance: number;
  /** 建议的关联记忆 */
  suggestedAssociations: string[];
  /** 编码理由 */
  reasoning: string;
  /** 预期遗忘时间 */
  estimatedForgetTime?: string;
  /** 是否需要巩固 */
  needsConsolidation: boolean;
}

/** 记忆关联 */
export interface MemoryAssociation {
  /** 关联ID */
  id: string;
  /** 源记忆ID */
  sourceId: string;
  /** 目标记忆ID */
  targetId: string;
  /** 关联类型 */
  type: 'similar' | 'causal' | 'temporal' | 'hierarchical' | 'thematic';
  /** 关联强度 (0-1) */
  strength: number;
  /** 创建时间 */
  createdAt: string;
  /** 最后激活时间 */
  lastActivatedAt: string;
  /** 激活次数 */
  activationCount: number;
}

/** 记忆元数据（用于自指评估） */
export interface MemorySelfMetadata {
  /** 记忆ID */
  memoryId: string;
  /** 自我评估的重要性 */
  selfAssessedImportance: number;
  /** 情感标记强度 */
  emotionalMarker: number;
  /** 与自我概念的关联度 */
  selfRelevance: number;
  /** 预期使用频率 */
  expectedFrequency: 'high' | 'medium' | 'low';
  /** 独特性评分 */
  uniqueness: number;
  /** 可迁移性 */
  transferability: number;
}

/** 遗忘候选 */
export interface ForgettingCandidate {
  /** 记忆ID */
  memoryId: string;
  /** 遗忘分数 (越高越应该遗忘) */
  forgetScore: number;
  /** 理由 */
  reasons: string[];
  /** 建议操作 */
  suggestedAction: 'delete' | 'weaken' | 'consolidate' | 'keep';
}

/**
 * 自指编码记忆分层器
 */
export class SelfReferentialMemory {
  private memorySystem: MemorySystem;
  
  /** 记忆关联图谱 */
  private associations = new Map<string, MemoryAssociation>();
  
  /** 记忆的自我元数据 */
  private selfMetadata = new Map<string, MemorySelfMetadata>();
  
  /** 最近激活的记忆（工作记忆模拟） */
  private workingMemory = new Set<string>();
  
  /** 工作记忆容量 */
  private readonly workingMemoryCapacity = 7;
  
  /** 遗忘阈值 */
  private readonly forgetThreshold = 0.3;

  constructor(memorySystem: MemorySystem) {
    this.memorySystem = memorySystem;
    logger.info('自指编码记忆分层器初始化完成');
  }

  /**
   * 自指编码 - 判断记忆该存哪一层
   * 
   * 核心方法：使用自我评估确定记忆存储位置
   */
  selfReferentialEncode(
    content: string,
    type: MemoryType,
    context?: {
      emotionalIntensity?: number;
      relatedToSelf?: boolean;
      expectedFutureUse?: boolean;
    }
  ): MemoryEncodingDecision {
    logger.debug('开始自指编码', { type, contentLength: content.length });

    // 基于内容特征进行自我评估
    const selfAssessment = this.assessContent(content, type, context);
    
    // 确定目标层级
    const targetLayer = this.determineLayer(selfAssessment, type);
    
    // 计算重要性
    const importance = this.calculateSelfReferentialImportance(
      selfAssessment,
      context
    );
    
    // 查找相似记忆用于关联
    const similarMemories = this.findSimilarMemories(content, type);
    const suggestedAssociations = similarMemories.slice(0, 3).map(m => m.id);
    
    // 生成编码理由
    const reasoning = this.generateEncodingReasoning(
      targetLayer,
      selfAssessment,
      suggestedAssociations.length
    );

    // 判断是否需要巩固
    const needsConsolidation = 
      importance > 0.8 || 
      selfAssessment.selfRelevance > 0.7 ||
      (type === 'reflective' && importance > 0.6);

    const decision: MemoryEncodingDecision = {
      targetLayer,
      importance,
      suggestedAssociations,
      reasoning,
      needsConsolidation,
    };

    // 估计遗忘时间
    if (targetLayer === 'working') {
      decision.estimatedForgetTime = '几分钟到几小时';
    } else if (importance < 0.3) {
      decision.estimatedForgetTime = '几天到几周';
    } else if (needsConsolidation) {
      decision.estimatedForgetTime = '数月到数年';
    } else {
      decision.estimatedForgetTime = '数周到数月';
    }

    logger.debug('自指编码完成', {
      targetLayer,
      importance: importance.toFixed(2),
      associations: suggestedAssociations.length,
    });

    return decision;
  }

  /**
   * 评估内容特征
   */
  private assessContent(
    content: string,
    type: MemoryType,
    context?: { emotionalIntensity?: number; relatedToSelf?: boolean; expectedFutureUse?: boolean }
  ): {
    emotionalIntensity: number;
    selfRelevance: number;
    uniqueness: number;
    transferability: number;
    complexity: number;
  } {
    // 情感强度分析
    const emotionalIntensity = context?.emotionalIntensity ?? 
      this.detectEmotionalIntensity(content);
    
    // 自我相关度
    const selfRelevance = context?.relatedToSelf !== undefined 
      ? (context.relatedToSelf ? 0.8 : 0.3)
      : this.detectSelfRelevance(content);
    
    // 独特性（基于内容新颖度）
    const uniqueness = this.assessUniqueness(content);
    
    // 可迁移性
    const transferability = type === 'procedural' ? 0.8 :
                           type === 'semantic' ? 0.7 :
                           type === 'reflective' ? 0.6 :
                           0.4;
    
    // 复杂度（基于长度和结构）
    const complexity = Math.min(1, content.length / 500);

    return {
      emotionalIntensity,
      selfRelevance,
      uniqueness,
      transferability,
      complexity,
    };
  }

  /**
   * 检测情感强度
   */
  private detectEmotionalIntensity(content: string): number {
    const emotionalWords = [
      '重要', '关键', '紧急', '危机', '成功', '失败', '惊喜', '失望',
      'important', 'critical', 'urgent', 'crisis', 'success', 'fail', 'surprise',
    ];
    
    const count = emotionalWords.filter(w => 
      content.toLowerCase().includes(w.toLowerCase())
    ).length;
    
    return Math.min(1, count / 3);
  }

  /**
   * 检测自我相关性
   */
  private detectSelfRelevance(content: string): number {
    const selfWords = [
      '我', '我的', '我是', '我能', '我应该',
      'I ', 'my ', 'me ', 'myself', 'I\'m', 'I am',
    ];
    
    const count = selfWords.filter(w => 
      content.toLowerCase().includes(w.toLowerCase())
    ).length;
    
    return Math.min(1, count / 2);
  }

  /**
   * 评估独特性
   */
  private assessUniqueness(content: string): number {
    // 简化的独特性评估
    const words = content.split(/\s+/);
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const ratio = uniqueWords.size / words.length;
    
    return Math.min(1, ratio * 2);
  }

  /**
   * 确定目标层级
   */
  private determineLayer(
    assessment: ReturnType<SelfReferentialMemory['assessContent']>,
    type: MemoryType
  ): MemoryLayer {
    // 高情感、高自我相关 -> 工作记忆或情景记忆
    if (assessment.emotionalIntensity > 0.7 && assessment.selfRelevance > 0.6) {
      return 'working';
    }
    
    // 反思类型 -> 反思记忆
    if (type === 'reflective') {
      return 'reflective';
    }
    
    // 程序类型 -> 程序记忆
    if (type === 'procedural') {
      return 'procedural';
    }
    
    // 高可迁移性、低情感 -> 语义记忆
    if (assessment.transferability > 0.6 && assessment.emotionalIntensity < 0.3) {
      return 'semantic';
    }
    
    // 具体事件 -> 情景记忆
    if (type === 'episodic') {
      return 'episodic';
    }
    
    // 高重要性、高独特性 -> 巩固记忆
    if (assessment.uniqueness > 0.7 && assessment.emotionalIntensity > 0.5) {
      return 'consolidated';
    }
    
    return 'episodic';
  }

  /**
   * 计算自指重要性
   */
  private calculateSelfReferentialImportance(
    assessment: ReturnType<SelfReferentialMemory['assessContent']>,
    context?: { expectedFutureUse?: boolean }
  ): number {
    let importance = 0.5;
    
    // 情感权重
    importance += assessment.emotionalIntensity * 0.25;
    
    // 自我相关权重
    importance += assessment.selfRelevance * 0.2;
    
    // 独特性权重
    importance += assessment.uniqueness * 0.15;
    
    // 可迁移性权重
    importance += assessment.transferability * 0.1;
    
    // 预期使用
    if (context?.expectedFutureUse) {
      importance += 0.1;
    }
    
    return Math.min(1, importance);
  }

  /**
   * 查找相似记忆
   */
  private findSimilarMemories(_content: string, type: MemoryType): AnyMemory[] {
    // 使用现有的记忆查询功能
    return this.memorySystem.queryMemories({
      type,
      limit: 5,
    });
  }

  /**
   * 生成编码理由
   */
  private generateEncodingReasoning(
    layer: MemoryLayer,
    assessment: ReturnType<SelfReferentialMemory['assessContent']>,
    associationCount: number
  ): string {
    const reasons: string[] = [];
    
    reasons.push(`存储到${layer}层，因为：`);
    
    if (assessment.emotionalIntensity > 0.5) {
      reasons.push(`- 情感强度高 (${(assessment.emotionalIntensity * 100).toFixed(0)}%)`);
    }
    
    if (assessment.selfRelevance > 0.5) {
      reasons.push(`- 与自我高度相关 (${(assessment.selfRelevance * 100).toFixed(0)}%)`);
    }
    
    if (assessment.uniqueness > 0.5) {
      reasons.push(`- 内容独特性高 (${(assessment.uniqueness * 100).toFixed(0)}%)`);
    }
    
    if (associationCount > 0) {
      reasons.push(`- 发现 ${associationCount} 个潜在关联记忆`);
    }
    
    return reasons.join('\n');
  }

  /**
   * 自动关联 - 建立记忆链接
   * 
   * 核心方法：新记忆存储时自动寻找相似记忆建立链接
   */
  autoAssociate(memoryId: string, similarityThreshold = 0.7): MemoryAssociation[] {
    const memory = this.memorySystem.getMemoryById(memoryId);
    if (!memory) {
      logger.warn('尝试关联不存在的记忆', { memoryId });
      return [];
    }

    logger.debug('开始自动关联', { memoryId });

    const newAssociations: MemoryAssociation[] = [];
    
    // 1. 基于内容相似性
    const similarMemories = this.findSimilarMemories(
      memory.content,
      memory.type
    );
    
    for (const similar of similarMemories) {
      if (similar.id === memoryId) continue;
      
      // 计算关联强度
      const strength = this.calculateAssociationStrength(memory, similar);
      
      if (strength >= similarityThreshold) {
        const association = this.createAssociation(
          memoryId,
          similar.id,
          'similar',
          strength
        );
        newAssociations.push(association);
      }
    }
    
    // 2. 基于时间邻近性
    const temporalNeighbors = this.findTemporalNeighbors(memoryId);
    for (const neighbor of temporalNeighbors) {
      const existingSimilar = newAssociations.find(a => 
        a.targetId === neighbor.id
      );
      
      if (!existingSimilar) {
        const association = this.createAssociation(
          memoryId,
          neighbor.id,
          'temporal',
          0.5
        );
        newAssociations.push(association);
      }
    }
    
    // 3. 基于主题相关性
    const thematicRelations = this.findThematicRelations(memory);
    for (const related of thematicRelations) {
      const existing = newAssociations.find(a => 
        a.targetId === related.id
      );
      
      if (!existing) {
        const association = this.createAssociation(
          memoryId,
          related.id,
          'thematic',
          0.6
        );
        newAssociations.push(association);
      }
    }

    logger.info('自动关联完成', {
      memoryId,
      newAssociations: newAssociations.length,
    });

    return newAssociations;
  }

  /**
   * 计算关联强度
   */
  private calculateAssociationStrength(m1: AnyMemory, m2: AnyMemory): number {
    let strength = 0;
    
    // 类型相同加分
    if (m1.type === m2.type) {
      strength += 0.2;
    }
    
    // 标签重叠
    const commonTags = m1.tags.filter(t => m2.tags.includes(t));
    strength += commonTags.length * 0.1;
    
    // 重要性相似
    const importanceDiff = Math.abs(m1.importance - m2.importance);
    strength += (1 - importanceDiff) * 0.2;
    
    // 情感相似
    const emotionalDiff = Math.abs(
      (m1.emotionalIntensity || 0) - (m2.emotionalIntensity || 0)
    );
    strength += (1 - emotionalDiff) * 0.1;
    
    return Math.min(1, strength);
  }

  /**
   * 创建关联
   */
  private createAssociation(
    sourceId: string,
    targetId: string,
    type: MemoryAssociation['type'],
    strength: number
  ): MemoryAssociation {
    const id = randomUUID();
    const now = new Date().toISOString();
    
    const association: MemoryAssociation = {
      id,
      sourceId,
      targetId,
      type,
      strength,
      createdAt: now,
      lastActivatedAt: now,
      activationCount: 1,
    };
    
    this.associations.set(id, association);
    
    // 更新记忆的relatedMemoryIds
    const source = this.memorySystem.getMemoryById(sourceId);
    const target = this.memorySystem.getMemoryById(targetId);
    
    if (source && !source.relatedMemoryIds.includes(targetId)) {
      source.relatedMemoryIds.push(targetId);
    }
    if (target && !target.relatedMemoryIds.includes(sourceId)) {
      target.relatedMemoryIds.push(sourceId);
    }
    
    return association;
  }

  /**
   * 查找时间邻近的记忆
   */
  private findTemporalNeighbors(memoryId: string, windowHours = 24): AnyMemory[] {
    const memory = this.memorySystem.getMemoryById(memoryId);
    if (!memory) return [];
    
    const memoryTime = new Date(memory.createdAt).getTime();
    const windowMs = windowHours * 60 * 60 * 1000;
    
    // 这里简化处理，实际应该查询数据库
    return this.memorySystem.queryMemories({
      limit: 10,
    }).filter(m => {
      if (m.id === memoryId) return false;
      const mTime = new Date(m.createdAt).getTime();
      return Math.abs(mTime - memoryTime) < windowMs;
    });
  }

  /**
   * 查找主题相关记忆
   */
  private findThematicRelations(memory: AnyMemory): AnyMemory[] {
    // 基于标签匹配
    return this.memorySystem.queryMemories({
      limit: 5,
    }).filter(m => {
      if (m.id === memory.id) return false;
      return m.tags.some(t => memory.tags.includes(t));
    });
  }

  /**
   * 增强的自我遗忘评估
   * 
   * 综合多个因素决定是否应该遗忘
   */
  assessForgettingCandidates(): ForgettingCandidate[] {
    logger.debug('开始评估遗忘候选');
    
    const candidates: ForgettingCandidate[] = [];
    const allMemories = this.memorySystem.queryMemories({ limit: 1000 });
    
    for (const memory of allMemories) {
      const forgetScore = this.calculateForgetScore(memory);
      
      if (forgetScore > this.forgetThreshold) {
        const candidate = this.createForgettingCandidate(memory, forgetScore);
        candidates.push(candidate);
      }
    }
    
    // 按遗忘分数排序
    candidates.sort((a, b) => b.forgetScore - a.forgetScore);
    
    logger.info('遗忘评估完成', {
      totalCandidates: candidates.length,
      topScore: candidates[0]?.forgetScore.toFixed(2),
    });
    
    return candidates;
  }

  /**
   * 计算遗忘分数
   */
  private calculateForgetScore(memory: AnyMemory): number {
    let score = 0;
    
    // 1. 时间衰减 (艾宾浩斯曲线)
    const age = Date.now() - new Date(memory.createdAt).getTime();
    const days = age / (24 * 60 * 60 * 1000);
    const timeDecay = Math.min(1, days / 30); // 30天后达到最大衰减
    score += timeDecay * 0.3;
    
    // 2. 访问频率
    const accessScore = Math.max(0, 1 - memory.accessCount / 10);
    score += accessScore * 0.25;
    
    // 3. 重要性
    const importanceFactor = (1 - memory.importance) * 0.2;
    score += importanceFactor;
    
    // 4. 自我评估重要性
    const selfMetadata = this.selfMetadata.get(memory.id);
    if (selfMetadata) {
      const selfImportance = (1 - selfMetadata.selfAssessedImportance) * 0.15;
      score += selfImportance;
    } else {
      score += 0.075; // 没有自我元数据，中等惩罚
    }
    
    // 5. 关联数量（关联多的记忆更重要）
    const associationCount = memory.relatedMemoryIds.length;
    const associationFactor = Math.max(0, 1 - associationCount / 5) * 0.1;
    score += associationFactor;
    
    return Math.min(1, score);
  }

  /**
   * 创建遗忘候选
   */
  private createForgettingCandidate(
    memory: AnyMemory,
    forgetScore: number
  ): ForgettingCandidate {
    const reasons: string[] = [];
    let suggestedAction: ForgettingCandidate['suggestedAction'] = 'weaken';
    
    // 分析理由
    const age = Date.now() - new Date(memory.createdAt).getTime();
    if (age > 30 * 24 * 60 * 60 * 1000) {
      reasons.push('超过30天未访问');
    }
    
    if (memory.accessCount < 2) {
      reasons.push(`访问次数少 (${memory.accessCount}次)`);
    }
    
    if (memory.importance < 0.3) {
      reasons.push(`重要性低 (${(memory.importance * 100).toFixed(0)}%)`);
    }
    
    if (memory.relatedMemoryIds.length === 0) {
      reasons.push('无关联记忆');
    }
    
    // 决定操作
    if (forgetScore > 0.8) {
      suggestedAction = 'delete';
    } else if (forgetScore > 0.6) {
      suggestedAction = memory.importance > 0.5 ? 'consolidate' : 'weaken';
    } else {
      suggestedAction = 'keep';
    }
    
    return {
      memoryId: memory.id,
      forgetScore,
      reasons,
      suggestedAction,
    };
  }

  /**
   * 执行遗忘
   */
  executeForgetting(candidates: ForgettingCandidate[]): {
    deleted: number;
    weakened: number;
    consolidated: number;
  } {
    const result = { deleted: 0, weakened: 0, consolidated: 0 };
    
    for (const candidate of candidates) {
      if (candidate.suggestedAction === 'delete') {
        // 实际删除逻辑
        logger.info('删除记忆', { memoryId: candidate.memoryId });
        result.deleted++;
      } else if (candidate.suggestedAction === 'weaken') {
        // 降低重要性
        logger.info('弱化记忆', { memoryId: candidate.memoryId });
        result.weakened++;
      } else if (candidate.suggestedAction === 'consolidate') {
        // 转为巩固记忆
        logger.info('巩固记忆', { memoryId: candidate.memoryId });
        result.consolidated++;
      }
    }
    
    return result;
  }

  /**
   * 激活记忆到工作记忆
   */
  activateToWorkingMemory(memoryId: string): void {
    this.workingMemory.add(memoryId);
    
    // 限制工作记忆容量
    if (this.workingMemory.size > this.workingMemoryCapacity) {
      const oldest = Array.from(this.workingMemory)[0];
      this.workingMemory.delete(oldest);
    }
    
    // 激活相关关联
    for (const assoc of this.associations.values()) {
      if (assoc.sourceId === memoryId || assoc.targetId === memoryId) {
        assoc.activationCount++;
        assoc.lastActivatedAt = new Date().toISOString();
      }
    }
  }

  /**
   * 生成自指记忆报告
   */
  generateReport(): string {
    const totalAssociations = this.associations.size;
    const workingMemorySize = this.workingMemory.size;
    const selfMetadataCount = this.selfMetadata.size;
    
    const forgettingCandidates = this.assessForgettingCandidates();
    
    return `
## 自指编码记忆报告

### 记忆关联图谱
- **总关联数**: ${totalAssociations}
- **工作记忆**: ${workingMemorySize}/${this.workingMemoryCapacity}
- **自我元数据**: ${selfMetadataCount}

### 遗忘评估
- **遗忘候选**: ${forgettingCandidates.length}
- **建议删除**: ${forgettingCandidates.filter(c => c.suggestedAction === 'delete').length}
- **建议弱化**: ${forgettingCandidates.filter(c => c.suggestedAction === 'weaken').length}
- **建议巩固**: ${forgettingCandidates.filter(c => c.suggestedAction === 'consolidate').length}

### 最高遗忘分数
${forgettingCandidates.slice(0, 3).map(c => 
  `- ${c.memoryId.slice(0, 8)}...: ${(c.forgetScore * 100).toFixed(1)}% - ${c.reasons[0]}`
).join('\n')}
`;
  }
}

export default SelfReferentialMemory;
