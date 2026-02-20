/**
 * @file capabilities/loader/on-demand-loader.ts
 * @description 按需加载器 - 根据意图自动加载所需能力
 * @author Ouroboros
 * @date 2026-02-19
 */

import { EventEmitter } from 'events';
import { createContextLogger } from '@/utils/logger';
import type { CapabilityRegistry } from '@/capabilities/discovery/capability-registry';
import type { RecognizedIntent } from '@/capabilities/intent';
import { CapabilitySelector } from './capability-selector';
import { CapabilityLoader } from './capability-loader';
import type { Tool } from '@/types/index';

const logger = createContextLogger('OnDemandLoader');

/** 加载上下文 */
export interface LoadContext {
  /** 会话 ID */
  sessionId: string;
  /** 用户 ID */
  userId?: string;
  /** 历史意图 */
  intentHistory: RecognizedIntent[];
  /** 已加载能力 */
  loadedCapabilities: string[];
  /** 任务类型 */
  taskType?: string;
  /** 资源限制 */
  resourceLimits?: {
    maxMemory?: number;
    maxCapabilities?: number;
    timeout?: number;
  };
}

/** 按需加载选项 */
export interface OnDemandLoadOptions {
  /** 预加载相关能力 */
  preloadRelated?: boolean;
  /** 缓存已加载能力 */
  cacheLoaded?: boolean;
  /** 自动卸载未使用 */
  autoUnload?: boolean;
  /** 未使用卸载时间 (毫秒) */
  unloadAfterMs?: number;
}

/**
 * 按需加载器
 * 
 * 根据识别出的意图，自动选择并加载所需能力
 */
export class OnDemandLoader extends EventEmitter {
  private registry: CapabilityRegistry;
  private selector: CapabilitySelector;
  private loader: CapabilityLoader;
  private options: OnDemandLoadOptions;
  
  /** 会话加载的能力 */
  private sessionCapabilities = new Map<string, Set<string>>();
  /** 能力最后使用时间 */
  private lastUsedTime = new Map<string, number>();
  /** 卸载定时器 */
  private unloadTimers = new Map<string, NodeJS.Timeout>();
  /** 上下文缓存 */
  private contextCache = new Map<string, LoadContext>();

  constructor(
    registry: CapabilityRegistry,
    options: OnDemandLoadOptions = {}
  ) {
    super();
    
    this.registry = registry;
    this.selector = new CapabilitySelector(registry);
    this.loader = new CapabilityLoader(registry);
    this.options = {
      preloadRelated: true,
      cacheLoaded: true,
      autoUnload: true,
      unloadAfterMs: 300000, // 5分钟
      ...options,
    };

    // 启动自动卸载检查
    if (this.options.autoUnload) {
      this.startAutoUnloadCheck();
    }
  }

  /**
   * 根据意图加载能力
   */
  async loadForIntent(
    intent: RecognizedIntent,
    context: Partial<LoadContext> = {}
  ): Promise<{
    loaded: Tool[];
    reasoning: string;
    confidence: number;
  }> {
    const sessionId = context.sessionId || 'default';
    
    logger.info(`Loading capabilities for intent: ${intent.primary} (session: ${sessionId})`);

    // 确保会话记录存在
    if (!this.sessionCapabilities.has(sessionId)) {
      this.sessionCapabilities.set(sessionId, new Set());
    }

    // 选择能力
    const selected = this.selector.selectForIntent(intent);
    
    // 合并主要和辅助能力
    const toLoad = [
      ...selected.primary,
      ...selected.secondary,
    ];

    // 检查资源限制
    const sessionLoaded = this.sessionCapabilities.get(sessionId)!;
    const maxCapabilities = context.resourceLimits?.maxCapabilities || 20;
    
    if (sessionLoaded.size + toLoad.length > maxCapabilities) {
      logger.warn(`Resource limit reached, selecting top ${maxCapabilities - sessionLoaded.size} capabilities`);
      toLoad.splice(maxCapabilities - sessionLoaded.size);
    }

    // 加载能力
    const loadedTools: Tool[] = [];
    const loadedIds: string[] = [];

    for (const capability of toLoad) {
      // 检查是否已加载
      if (this.loader.isLoaded(capability.id)) {
        // 更新最后使用时间
        this.updateLastUsed(capability.id);
        
        // 获取已加载的工具
        const loaded = this.loader.getLoaded().find(l => l.capability.id === capability.id);
        if (loaded?.tool) {
          loadedTools.push(loaded.tool);
        }
        
        sessionLoaded.add(capability.id);
        continue;
      }

      try {
        const loaded = await this.loader.load(capability.id);
        
        if (loaded.status === 'loaded' && loaded.tool) {
          loadedTools.push(loaded.tool);
          sessionLoaded.add(capability.id);
          loadedIds.push(capability.id);
          this.updateLastUsed(capability.id);
          
          this.emit('capability-loaded', {
            sessionId,
            capability: capability.name,
            intent: intent.primary,
          });
        }
      } catch (error) {
        logger.error(`Failed to load capability ${capability.name}:`, error);
      }
    }

    // 更新上下文
    this.updateContext(sessionId, intent, loadedIds);

    logger.info(`Loaded ${loadedTools.length} capabilities for intent ${intent.primary}`);

    return {
      loaded: loadedTools,
      reasoning: selected.reasoning,
      confidence: selected.confidence,
    };
  }

  /**
   * 快速加载特定能力
   */
  async quickLoad(capabilityName: string, sessionId = 'default'): Promise<Tool | undefined> {
    const capability = this.registry.getByName(capabilityName);
    if (!capability) {
      logger.warn(`Capability not found: ${capabilityName}`);
      return undefined;
    }

    try {
      const loaded = await this.loader.load(capability.id);
      
      if (loaded.status === 'loaded' && loaded.tool) {
        // 记录到会话
        if (!this.sessionCapabilities.has(sessionId)) {
          this.sessionCapabilities.set(sessionId, new Set());
        }
        this.sessionCapabilities.get(sessionId)!.add(capability.id);
        this.updateLastUsed(capability.id);
        
        return loaded.tool;
      }
    } catch (error) {
      logger.error(`Failed to quick load ${capabilityName}:`, error);
    }

    return undefined;
  }

  /**
   * 卸载会话的所有能力
   */
  async unloadSession(sessionId: string): Promise<void> {
    const capabilities = this.sessionCapabilities.get(sessionId);
    if (!capabilities) {
      return;
    }

    logger.info(`Unloading all capabilities for session: ${sessionId}`);

    for (const capabilityId of capabilities) {
      // 检查是否其他会话还在使用
      let inUseByOthers = false;
      for (const [sid, caps] of this.sessionCapabilities) {
        if (sid !== sessionId && caps.has(capabilityId)) {
          inUseByOthers = true;
          break;
        }
      }

      // 如果没有其他会话使用，则卸载
      if (!inUseByOthers) {
        await this.loader.unload(capabilityId);
        this.lastUsedTime.delete(capabilityId);
        
        const timer = this.unloadTimers.get(capabilityId);
        if (timer) {
          clearTimeout(timer);
          this.unloadTimers.delete(capabilityId);
        }
      }
    }

    this.sessionCapabilities.delete(sessionId);
    this.contextCache.delete(sessionId);
    
    this.emit('session-unloaded', { sessionId });
  }

  /**
   * 获取会话已加载的能力
   */
  getSessionCapabilities(sessionId: string): string[] {
    const caps = this.sessionCapabilities.get(sessionId);
    return caps ? Array.from(caps) : [];
  }

  /**
   * 获取所有会话统计
   */
  getSessionStats(): Array<{
    sessionId: string;
    capabilityCount: number;
    memoryEstimate: number;
  }> {
    const stats: Array<{ sessionId: string; capabilityCount: number; memoryEstimate: number }> = [];

    for (const [sessionId, capabilityIds] of this.sessionCapabilities) {
      let memoryEstimate = 0;
      
      for (const id of capabilityIds) {
        const loaded = this.loader.getLoaded().find(l => l.capability.id === id);
        if (loaded) {
          memoryEstimate += loaded.memoryEstimate || 0;
        }
      }

      stats.push({
        sessionId,
        capabilityCount: capabilityIds.size,
        memoryEstimate,
      });
    }

    return stats;
  }

  /**
   * 更新最后使用时间
   */
  private updateLastUsed(capabilityId: string): void {
    this.lastUsedTime.set(capabilityId, Date.now());
    
    // 重置卸载定时器
    if (this.options.autoUnload) {
      this.scheduleUnload(capabilityId);
    }
  }

  /**
   * 调度卸载
   */
  private scheduleUnload(capabilityId: string): void {
    // 清除现有定时器
    const existingTimer = this.unloadTimers.get(capabilityId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 设置新定时器
    const timer = setTimeout(() => {
      this.checkAndUnload(capabilityId);
    }, this.options.unloadAfterMs);

    this.unloadTimers.set(capabilityId, timer);
  }

  /**
   * 检查并卸载
   */
  private async checkAndUnload(capabilityId: string): Promise<void> {
    const lastUsed = this.lastUsedTime.get(capabilityId);
    if (!lastUsed) return;

    const idleTime = Date.now() - lastUsed;
    
    if (idleTime >= this.options.unloadAfterMs!) {
      // 检查是否还有会话在使用
      let inUse = false;
      for (const caps of this.sessionCapabilities.values()) {
        if (caps.has(capabilityId)) {
          inUse = true;
          break;
        }
      }

      if (!inUse) {
        logger.info(`Auto-unloading idle capability: ${capabilityId}`);
        await this.loader.unload(capabilityId);
        this.lastUsedTime.delete(capabilityId);
        this.unloadTimers.delete(capabilityId);
      }
    }
  }

  /**
   * 启动自动卸载检查
   */
  private startAutoUnloadCheck(): void {
    setInterval(() => {
      for (const capabilityId of this.lastUsedTime.keys()) {
        this.checkAndUnload(capabilityId).catch(error => {
          logger.error(`Auto-unload error for ${capabilityId}:`, error);
        });
      }
    }, 60000); // 每分钟检查一次
  }

  /**
   * 更新上下文
   */
  private updateContext(
    sessionId: string,
    intent: RecognizedIntent,
    loadedIds: string[]
  ): void {
    const existing = this.contextCache.get(sessionId);
    
    const context: LoadContext = {
      sessionId,
      intentHistory: existing 
        ? [...existing.intentHistory.slice(-4), intent]
        : [intent],
      loadedCapabilities: existing
        ? [...existing.loadedCapabilities, ...loadedIds]
        : loadedIds,
    };

    this.contextCache.set(sessionId, context);
  }

  /**
   * 获取加载器实例 (用于高级操作)
   */
  getLoader(): CapabilityLoader {
    return this.loader;
  }

  /**
   * 获取选择器实例 (用于高级操作)
   */
  getSelector(): CapabilitySelector {
    return this.selector;
  }

  /**
   * 获取内存统计
   */
  getMemoryStats(): ReturnType<CapabilityLoader['getMemoryStats']> {
    return this.loader.getMemoryStats();
  }
}
