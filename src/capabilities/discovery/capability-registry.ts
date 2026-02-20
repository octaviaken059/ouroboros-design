/**
 * @file capabilities/discovery/capability-registry.ts
 * @description 能力注册器 - 统一管理和注册所有发现的能力
 * @author Ouroboros
 * @date 2026-02-19
 */

import { EventEmitter } from 'events';
import { createContextLogger } from '@/utils/logger';
import type { UUID, Timestamp } from '@/types/index';
import { randomUUID } from 'crypto';

const logger = createContextLogger('CapabilityRegistry');

/** 能力类型 */
export type CapabilityType = 
  | 'system-tool'      // 系统命令行工具
  | 'mcp-tool'         // MCP 工具
  | 'skill'            // 内部技能
  | 'api-service'      // API 服务
  | 'hardware'         // 硬件能力
  | 'data-source'      // 数据源
  | 'model';           // AI 模型

/** 能力定义 */
export interface Capability {
  /** 唯一 ID */
  id: UUID;
  /** 能力名称 */
  name: string;
  /** 显示名称 */
  displayName: string;
  /** 能力类型 */
  type: CapabilityType;
  /** 能力描述 */
  description: string;
  /** 能力版本 */
  version?: string | undefined;
  /** 来源 */
  source: {
    /** 来源类型 */
    type: 'system' | 'mcp' | 'internal' | 'discovered' | 'configured';
    /** 来源 ID */
    id: string;
    /** 来源名称 */
    name: string;
  };
  /** 参数定义 */
  parameters?: Record<string, {
    type: string;
    required: boolean;
    description: string;
    default?: unknown;
  }>;
  /** 能力标签 */
  tags: string[];
  /** 能力类别 */
  category: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 是否可用 */
  available: boolean;
  /** 使用统计 */
  stats: {
    callCount: number;
    successCount: number;
    failureCount: number;
    lastUsedAt?: Timestamp;
    averageResponseTime: number;
  };
  /** 依赖项 */
  dependencies?: string[];
  /** 元数据 */
  metadata: Record<string, unknown>;
  /** 注册时间 */
  registeredAt: Timestamp;
  /** 最后更新时间 */
  updatedAt: Timestamp;
}

/** 能力注册选项 */
export interface CapabilityRegistryOptions {
  /** 自动发现 */
  autoDiscover?: boolean;
  /** 置信度阈值 */
  confidenceThreshold?: number;
  /** 最大能力数 */
  maxCapabilities?: number;
}

/**
 * 能力注册器
 * 
 * 统一管理系统中所有发现的能力（工具、技能、服务等）
 */
export class CapabilityRegistry extends EventEmitter {
  private capabilities = new Map<UUID, Capability>();
  private nameIndex = new Map<string, UUID>(); // 名称到 ID 的映射
  private typeIndex = new Map<CapabilityType, Set<UUID>>(); // 类型索引
  private tagIndex = new Map<string, Set<UUID>>(); // 标签索引
  private options: CapabilityRegistryOptions;

  constructor(options: CapabilityRegistryOptions = {}) {
    super();
    this.options = {
      autoDiscover: true,
      confidenceThreshold: 0.3,
      maxCapabilities: 1000,
      ...options,
    };
  }

  /**
   * 注册能力
   */
  register(
    capability: Omit<Capability, 'id' | 'registeredAt' | 'updatedAt' | 'stats' | 'version'> &
              { id?: UUID; version?: string | undefined }
  ): Capability {
    // 检查是否已达到最大能力数
    if (this.capabilities.size >= this.options.maxCapabilities!) {
      throw new Error(`Maximum capability limit (${this.options.maxCapabilities}) reached`);
    }

    // 检查名称是否已存在
    const existingId = this.nameIndex.get(capability.name);
    if (existingId) {
      // 更新现有能力
      return this.update(existingId, capability);
    }

    const now = new Date().toISOString();
    const newCapability: Capability = {
      ...capability,
      version: capability.version ?? undefined,
      id: capability.id || randomUUID(),
      stats: {
        callCount: 0,
        successCount: 0,
        failureCount: 0,
        averageResponseTime: 0,
      },
      registeredAt: now,
      updatedAt: now,
    };

    // 存储能力
    this.capabilities.set(newCapability.id, newCapability);
    this.nameIndex.set(newCapability.name, newCapability.id);

    // 更新索引
    this.addToTypeIndex(newCapability);
    this.addToTagIndex(newCapability);

    logger.info(`Capability registered: ${newCapability.name} (${newCapability.type})`);
    this.emit('registered', newCapability);

    return newCapability;
  }

  /**
   * 更新能力
   */
  update(
    id: UUID,
    updates: Partial<Omit<Capability, 'id' | 'registeredAt' | 'stats'>>
  ): Capability {
    const existing = this.capabilities.get(id);
    if (!existing) {
      throw new Error(`Capability with id '${id}' not found`);
    }

    // 如果名称变更，更新名称索引
    if (updates.name && updates.name !== existing.name) {
      this.nameIndex.delete(existing.name);
      this.nameIndex.set(updates.name, id);
    }

    // 更新类型索引
    if (updates.type && updates.type !== existing.type) {
      this.removeFromTypeIndex(existing);
    }

    // 更新标签索引
    if (updates.tags) {
      this.removeFromTagIndex(existing);
    }

    // 执行更新
    const updated: Capability = {
      ...existing,
      ...updates,
      id: existing.id,
      stats: existing.stats,
      registeredAt: existing.registeredAt,
      updatedAt: new Date().toISOString(),
    };

    this.capabilities.set(id, updated);

    // 重新添加到索引
    if (updates.type) {
      this.addToTypeIndex(updated);
    }
    if (updates.tags) {
      this.addToTagIndex(updated);
    }

    logger.debug(`Capability updated: ${updated.name}`);
    this.emit('updated', updated);

    return updated;
  }

  /**
   * 注销能力
   */
  unregister(id: UUID): boolean {
    const capability = this.capabilities.get(id);
    if (!capability) {
      return false;
    }

    // 从所有索引中移除
    this.capabilities.delete(id);
    this.nameIndex.delete(capability.name);
    this.removeFromTypeIndex(capability);
    this.removeFromTagIndex(capability);

    logger.info(`Capability unregistered: ${capability.name}`);
    this.emit('unregistered', capability);

    return true;
  }

  /**
   * 通过 ID 获取能力
   */
  get(id: UUID): Capability | undefined {
    return this.capabilities.get(id);
  }

  /**
   * 通过名称获取能力
   */
  getByName(name: string): Capability | undefined {
    const id = this.nameIndex.get(name);
    return id ? this.capabilities.get(id) : undefined;
  }

  /**
   * 获取所有能力
   */
  getAll(): Capability[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * 按类型获取能力
   */
  getByType(type: CapabilityType): Capability[] {
    const ids = this.typeIndex.get(type);
    if (!ids) return [];
    
    return Array.from(ids)
      .map(id => this.capabilities.get(id))
      .filter((c): c is Capability => c !== undefined);
  }

  /**
   * 按标签获取能力
   */
  getByTag(tag: string): Capability[] {
    const ids = this.tagIndex.get(tag);
    if (!ids) return [];
    
    return Array.from(ids)
      .map(id => this.capabilities.get(id))
      .filter((c): c is Capability => c !== undefined);
  }

  /**
   * 搜索能力
   */
  search(query: string): Capability[] {
    const lowerQuery = query.toLowerCase();
    
    return this.getAll().filter(c =>
      c.name.toLowerCase().includes(lowerQuery) ||
      c.displayName.toLowerCase().includes(lowerQuery) ||
      c.description.toLowerCase().includes(lowerQuery) ||
      c.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * 按置信度排序获取能力
   */
  getByConfidence(minConfidence = 0): Capability[] {
    return this.getAll()
      .filter(c => c.confidence >= minConfidence && c.available)
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 获取可用能力
   */
  getAvailable(): Capability[] {
    return this.getAll().filter(c => c.available);
  }

  /**
   * 记录能力使用
   */
  recordUsage(
    id: UUID,
    success: boolean,
    responseTime: number
  ): void {
    const capability = this.capabilities.get(id);
    if (!capability) return;

    const stats = capability.stats;
    stats.callCount++;
    
    if (success) {
      stats.successCount++;
      // 成功提升置信度
      capability.confidence = Math.min(1, capability.confidence + 0.01);
    } else {
      stats.failureCount++;
      // 失败降低置信度
      capability.confidence = Math.max(0, capability.confidence - 0.05);
    }

    stats.lastUsedAt = new Date().toISOString();
    
    // 更新平均响应时间
    stats.averageResponseTime = 
      (stats.averageResponseTime * (stats.callCount - 1) + responseTime) /
      stats.callCount;

    capability.updatedAt = new Date().toISOString();
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    available: number;
    byType: Record<CapabilityType, number>;
    byCategory: Record<string, number>;
    topUsed: Capability[];
    topConfidence: Capability[];
  } {
    const all = this.getAll();
    const available = all.filter(c => c.available);

    const byType: Record<string, number> = {};
    for (const [type, set] of this.typeIndex) {
      byType[type] = set.size;
    }

    const byCategory: Record<string, number> = {};
    for (const c of all) {
      byCategory[c.category] = (byCategory[c.category] || 0) + 1;
    }

    return {
      total: all.length,
      available: available.length,
      byType: byType as Record<CapabilityType, number>,
      byCategory,
      topUsed: [...all]
        .sort((a, b) => b.stats.callCount - a.stats.callCount)
        .slice(0, 10),
      topConfidence: [...all]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10),
    };
  }

  /**
   * 导出配置
   */
  exportConfig(): unknown {
    return this.getAll().map(c => ({
      name: c.name,
      type: c.type,
      source: c.source,
      parameters: c.parameters,
      tags: c.tags,
      category: c.category,
    }));
  }

  /**
   * 清空所有能力
   */
  clear(): void {
    this.capabilities.clear();
    this.nameIndex.clear();
    this.typeIndex.clear();
    this.tagIndex.clear();
    logger.info('All capabilities cleared');
    this.emit('cleared');
  }

  // ========================================================================
  // 索引管理
  // ========================================================================

  private addToTypeIndex(capability: Capability): void {
    if (!this.typeIndex.has(capability.type)) {
      this.typeIndex.set(capability.type, new Set());
    }
    this.typeIndex.get(capability.type)!.add(capability.id);
  }

  private removeFromTypeIndex(capability: Capability): void {
    const set = this.typeIndex.get(capability.type);
    if (set) {
      set.delete(capability.id);
      if (set.size === 0) {
        this.typeIndex.delete(capability.type);
      }
    }
  }

  private addToTagIndex(capability: Capability): void {
    for (const tag of capability.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(capability.id);
    }
  }

  private removeFromTagIndex(capability: Capability): void {
    for (const tag of capability.tags) {
      const set = this.tagIndex.get(tag);
      if (set) {
        set.delete(capability.id);
        if (set.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }
  }
}
