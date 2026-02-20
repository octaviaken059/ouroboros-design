/**
 * @file capabilities/loader/capability-loader.ts
 * @description 能力加载器 - 管理能力的加载和生命周期
 * @author Ouroboros
 * @date 2026-02-19
 */

import { createContextLogger } from '@/utils/logger';
import type { Capability, CapabilityRegistry } from '@/capabilities/discovery/capability-registry';
import type { Tool } from '@/types/index';

const logger = createContextLogger('CapabilityLoader');

/** 扩展的工具类型，包含执行相关属性 */
interface ExecutableTool extends Tool {
  parameters?: Record<string, { type: string; required: boolean; description: string; default?: unknown }>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
  cleanup?: () => Promise<void>;
}

/** 加载的能力 */
export interface LoadedCapability {
  /** 能力定义 */
  capability: Capability;
  /** 加载的工具 */
  tool: ExecutableTool | undefined;
  /** 加载状态 */
  status: 'loading' | 'loaded' | 'error' | 'unloaded';
  /** 加载时间 */
  loadedAt: string | undefined;
  /** 错误信息 */
  error: string | undefined;
  /** 内存占用估算 (字节) */
  memoryEstimate: number | undefined;
}

/** 加载选项 */
export interface CapabilityLoadOptions {
  /** 延迟加载 */
  lazy?: boolean;
  /** 预加载依赖 */
  preloadDependencies?: boolean;
  /** 超时时间 (毫秒) */
  timeout?: number;
}

/** 加载结果 */
export interface CapabilityLoadResult {
  /** 成功加载 */
  success: LoadedCapability[];
  /** 加载失败 */
  failed: LoadedCapability[];
  /** 跳过的 */
  skipped: Capability[];
  /** 总耗时 (毫秒) */
  duration: number;
}

/**
 * 能力加载器
 * 
 * 管理能力的加载、缓存和生命周期
 */
export class CapabilityLoader {
  private registry: CapabilityRegistry;
  private loadedCapabilities = new Map<string, LoadedCapability>();

  constructor(registry: CapabilityRegistry) {
    this.registry = registry;
  }

  /**
   * 加载单个能力
   */
  async load(
    capabilityId: string,
    options: CapabilityLoadOptions = {}
  ): Promise<LoadedCapability> {
    const startTime = Date.now();
    
    // 检查是否已加载
    if (this.loadedCapabilities.has(capabilityId)) {
      const existing = this.loadedCapabilities.get(capabilityId)!;
      if (existing.status === 'loaded') {
        logger.debug(`Capability ${capabilityId} already loaded`);
        return existing;
      }
    }

    // 获取能力定义
    const capability = this.registry.get(capabilityId) || this.registry.getByName(capabilityId);
    if (!capability) {
      throw new Error(`Capability not found: ${capabilityId}`);
    }

    const loaded: LoadedCapability = {
      capability,
      status: 'loading',
      tool: undefined,
      loadedAt: undefined,
      error: undefined,
      memoryEstimate: undefined,
    };

    this.loadedCapabilities.set(capability.id, loaded);

    try {
      logger.info(`Loading capability: ${capability.name}`);

      // 加载依赖
      if (options.preloadDependencies && capability.dependencies) {
        await this.loadDependencies(capability.dependencies);
      }

      // 根据能力类型执行加载
      switch (capability.type) {
        case 'system-tool':
          loaded.tool = await this.loadSystemTool(capability);
          break;
        case 'mcp-tool':
          loaded.tool = await this.loadMCPTool(capability);
          break;
        case 'skill':
          loaded.tool = await this.loadSkill(capability);
          break;
        default:
          loaded.tool = await this.loadGeneric(capability);
      }

      loaded.status = 'loaded';
      loaded.loadedAt = new Date().toISOString();
      loaded.memoryEstimate = this.estimateMemory(capability);

      const duration = Date.now() - startTime;
      logger.info(`Capability loaded: ${capability.name} (${duration}ms)`);

      return loaded;
    } catch (error) {
      loaded.status = 'error';
      loaded.error = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to load capability ${capability.name}:`, error);
      throw error;
    }
  }

  /**
   * 批量加载能力
   */
  async loadMany(
    capabilityIds: string[],
    options: CapabilityLoadOptions = {}
  ): Promise<CapabilityLoadResult> {
    const startTime = Date.now();
    
    const result: CapabilityLoadResult = {
      success: [],
      failed: [],
      skipped: [],
      duration: 0,
    };

    for (const id of capabilityIds) {
      try {
        const loaded = await this.load(id, options);
        if (loaded.status === 'loaded') {
          result.success.push(loaded);
        } else if (loaded.status === 'error') {
          result.failed.push(loaded);
        }
      } catch (error) {
        // 已在 load 方法中记录
        const capability = this.registry.get(id) || this.registry.getByName(id);
        if (capability) {
          result.failed.push({
            capability,
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
            tool: undefined,
            loadedAt: undefined,
            memoryEstimate: undefined,
          });
        }
      }
    }

    result.duration = Date.now() - startTime;
    
    logger.info(`Batch load complete: ${result.success.length} success, ${result.failed.length} failed`);
    
    return result;
  }

  /**
   * 卸载能力
   */
  async unload(capabilityId: string): Promise<boolean> {
    const loaded = this.loadedCapabilities.get(capabilityId);
    if (!loaded) {
      return false;
    }

    logger.info(`Unloading capability: ${loaded.capability.name}`);

    // 执行卸载清理
    const toolWithCleanup = loaded.tool as { cleanup?: () => Promise<void> } | undefined;
    if (toolWithCleanup?.cleanup) {
      try {
        await toolWithCleanup.cleanup();
      } catch (error) {
        logger.error(`Error during cleanup of ${loaded.capability.name}:`, error);
      }
    }

    loaded.status = 'unloaded';
    loaded.tool = undefined;
    
    this.loadedCapabilities.delete(capabilityId);
    
    return true;
  }

  /**
   * 获取已加载的能力
   */
  getLoaded(): LoadedCapability[] {
    return Array.from(this.loadedCapabilities.values())
      .filter(l => l.status === 'loaded');
  }

  /**
   * 检查是否已加载
   */
  isLoaded(capabilityId: string): boolean {
    const loaded = this.loadedCapabilities.get(capabilityId);
    return loaded?.status === 'loaded';
  }

  /**
   * 加载依赖
   */
  private async loadDependencies(dependencies: string[]): Promise<void> {
    for (const depId of dependencies) {
      if (!this.isLoaded(depId)) {
        await this.load(depId, { preloadDependencies: false });
      }
    }
  }

  /**
   * 加载系统工具
   */
  private async loadSystemTool(capability: Capability): Promise<ExecutableTool> {
    return {
      id: capability.id,
      name: capability.name,
      description: capability.description,
      type: 'cli',
      category: capability.category,
      capabilities: [],
      confidence: capability.confidence,
      status: 'available',
      priority: 'medium',
      parameters: capability.parameters || {},
      execute: async (args: Record<string, unknown>) => {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        
        const result = await execFileAsync(capability.name.replace('system.', ''), 
          Object.values(args).map(String)
        );
        
        return { result: result.stdout };
      },
      successCount: 0,
      failureCount: 0,
    };
  }

  /**
   * 加载 MCP 工具
   */
  private async loadMCPTool(capability: Capability): Promise<ExecutableTool> {
    return {
      id: capability.id,
      name: capability.name,
      description: capability.description,
      type: 'mcp',
      category: capability.category,
      capabilities: [],
      confidence: capability.confidence,
      status: 'available',
      priority: 'medium',
      parameters: capability.parameters || {},
      execute: async (_args) => {
        return { result: 'MCP tool execution delegated to MCP Manager' };
      },
      successCount: 0,
      failureCount: 0,
    };
  }

  /**
   * 加载技能
   */
  private async loadSkill(capability: Capability): Promise<ExecutableTool> {
    return {
      id: capability.id,
      name: capability.name,
      description: capability.description,
      type: 'builtin',
      category: capability.category,
      capabilities: [],
      confidence: capability.confidence,
      status: 'available',
      priority: 'medium',
      parameters: capability.parameters || {},
      execute: async (_args) => {
        return { result: 'Skill execution' };
      },
      successCount: 0,
      failureCount: 0,
    };
  }

  /**
   * 加载通用能力
   */
  private async loadGeneric(capability: Capability): Promise<ExecutableTool> {
    return {
      id: capability.id,
      name: capability.name,
      description: capability.description,
      type: 'builtin',
      category: capability.category,
      capabilities: [],
      confidence: capability.confidence,
      status: 'available',
      priority: 'medium',
      parameters: capability.parameters || {},
      execute: async (_args) => {
        return { result: 'Generic capability execution' };
      },
      successCount: 0,
      failureCount: 0,
    };
  }

  /**
   * 估算内存占用
   */
  private estimateMemory(capability: Capability): number {
    // 简化的内存估算
    const baseSize = 1024 * 1024; // 1MB 基础
    
    switch (capability.type) {
      case 'system-tool':
        return baseSize * 0.5;
      case 'mcp-tool':
        return baseSize * 2;
      case 'skill':
        return baseSize * 5;
      case 'model':
        return baseSize * 100;
      default:
        return baseSize;
    }
  }

  /**
   * 获取内存使用统计
   */
  getMemoryStats(): {
    totalLoaded: number;
    totalMemory: number;
    byType: Record<string, { count: number; memory: number }>;
  } {
    const loaded = this.getLoaded();
    const byType: Record<string, { count: number; memory: number }> = {};

    for (const l of loaded) {
      const type = l.capability.type;
      if (!byType[type]) {
        byType[type] = { count: 0, memory: 0 };
      }
      byType[type].count++;
      byType[type].memory += l.memoryEstimate || 0;
    }

    return {
      totalLoaded: loaded.length,
      totalMemory: loaded.reduce((sum, l) => sum + (l.memoryEstimate || 0), 0),
      byType,
    };
  }

  /**
   * 清空所有已加载的能力
   */
  async unloadAll(): Promise<void> {
    const loadedIds = Array.from(this.loadedCapabilities.keys());
    
    for (const id of loadedIds) {
      await this.unload(id);
    }
    
    logger.info('All capabilities unloaded');
  }
}
