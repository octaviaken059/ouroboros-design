/**
 * @file capabilities/discovery/discovery-manager.ts
 * @description 统一发现管理器 - 整合所有发现功能
 * @author Ouroboros
 * @date 2026-02-19
 */

import { EventEmitter } from 'events';
import { SystemScanner } from './system-scanner';
import { HardwareDetector } from './hardware-detector';
import { CapabilityRegistry } from './capability-registry';
import type { MCPToolManager } from '@/adapters/mcp';
import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger('DiscoveryManager');

/** 发现选项 */
export interface DiscoveryOptions {
  /** 启用系统工具扫描 */
  scanSystemTools?: boolean;
  /** 启用硬件检测 */
  detectHardware?: boolean;
  /** 启用 MCP 发现 */
  discoverMCP?: boolean;
  /** 启用硬件变化监听 */
  monitorHardwareChanges?: boolean;
  /** 自动注册发现的能力 */
  autoRegister?: boolean;
  /** 扫描间隔 (毫秒) */
  scanInterval?: number;
}

/** 发现报告 */
export interface DiscoveryReport {
  /** 扫描时间 */
  scanTime: string;
  /** 系统工具发现 */
  systemTools: {
    total: number;
    available: number;
    tools: Array<{
      name: string;
      version?: string | undefined;
      category: string;
    }>;
  };
  /** 硬件信息 */
  hardware: {
    cpu: { model: string; cores: number };
    memory: { totalGB: number; availableGB: number };
    storage: { devices: number; totalGB: number };
    gpu?: { count: number; models: string[] };
  };
  /** MCP 服务器 */
  mcpServers: {
    connected: number;
    totalTools: number;
  };
  /** 新注册的能力 */
  newCapabilities: number;
}

/**
 * 统一发现管理器
 * 
 * 整合所有发现功能：
 * - 系统工具扫描
 * - 硬件检测
 * - MCP 服务器发现
 * - 能力自动注册
 */
export class DiscoveryManager extends EventEmitter {
  private options: DiscoveryOptions;
  private systemScanner: SystemScanner;
  private hardwareDetector: HardwareDetector;
  private capabilityRegistry: CapabilityRegistry;
  private mcpManager?: MCPToolManager | undefined;
  private scanTimer?: NodeJS.Timeout | undefined;
  private isScanning = false;

  constructor(
    capabilityRegistry: CapabilityRegistry,
    options: DiscoveryOptions = {},
    mcpManager?: MCPToolManager
  ) {
    super();
    
    this.capabilityRegistry = capabilityRegistry;
    this.mcpManager = mcpManager;
    this.options = {
      scanSystemTools: true,
      detectHardware: true,
      discoverMCP: true,
      monitorHardwareChanges: true,
      autoRegister: true,
      scanInterval: 300000, // 5 分钟
      ...options,
    };

    this.systemScanner = new SystemScanner();
    this.hardwareDetector = new HardwareDetector();

    // 监听硬件变化
    if (this.options.monitorHardwareChanges) {
      this.hardwareDetector.on('change', (change) => {
        logger.info('Hardware change detected:', change);
        this.emit('hardware-change', change);
      });
    }
  }

  /**
   * 初始化发现管理器
   */
  async initialize(): Promise<void> {
    logger.info('Initializing Discovery Manager');

    // 执行初始发现
    await this.discoverAll();

    // 启动硬件监控
    if (this.options.monitorHardwareChanges) {
      this.hardwareDetector.startMonitoring(30000);
    }

    // 启动定期扫描
    if (this.options.scanInterval && this.options.scanInterval > 0) {
      this.startPeriodicScan();
    }

    logger.info('Discovery Manager initialized');
    this.emit('initialized');
  }

  /**
   * 执行完整发现
   */
  async discoverAll(): Promise<DiscoveryReport> {
    if (this.isScanning) {
      throw new Error('Discovery already in progress');
    }

    this.isScanning = true;
    logger.info('Starting full capability discovery...');

    const report: DiscoveryReport = {
      scanTime: new Date().toISOString(),
      systemTools: { total: 0, available: 0, tools: [] },
      hardware: {
        cpu: { model: 'Unknown', cores: 0 },
        memory: { totalGB: 0, availableGB: 0 },
        storage: { devices: 0, totalGB: 0 },
      },
      mcpServers: { connected: 0, totalTools: 0 },
      newCapabilities: 0,
    };

    try {
      // 1. 扫描系统工具
      if (this.options.scanSystemTools) {
        const systemResult = await this.systemScanner.scan();
        
        report.systemTools.total = systemResult.discoveredTools.length;
        report.systemTools.available = systemResult.discoveredTools.filter(
          t => t.available
        ).length;
        report.systemTools.tools = systemResult.discoveredTools
          .filter(t => t.available)
          .map(t => ({
            name: t.definition.name,
            version: t.version ?? undefined,
            category: t.definition.category,
          }));

        // 注册系统工具为能力
        if (this.options.autoRegister) {
          const count = this.registerSystemTools(systemResult);
          report.newCapabilities += count;
        }
      }

      // 2. 检测硬件
      if (this.options.detectHardware) {
        const hardwareInfo = await this.hardwareDetector.getHardwareInfo();
        
        report.hardware = {
          cpu: {
            model: hardwareInfo.cpu.model,
            cores: hardwareInfo.cpu.cores,
          },
          memory: {
            totalGB: Math.round(hardwareInfo.memory.total / 1024 / 1024 / 1024),
            availableGB: Math.round(hardwareInfo.memory.available / 1024 / 1024 / 1024),
          },
          storage: {
            devices: hardwareInfo.storage.length,
            totalGB: Math.round(
              hardwareInfo.storage.reduce((sum, d) => sum + d.size, 0) / 1024 / 1024 / 1024
            ),
          },
        };

        if (hardwareInfo.gpu) {
          report.hardware.gpu = {
            count: hardwareInfo.gpu.length,
            models: hardwareInfo.gpu.map(g => g.name),
          };
        }

        // 注册硬件能力
        if (this.options.autoRegister) {
          const count = this.registerHardwareCapabilities(hardwareInfo);
          report.newCapabilities += count;
        }
      }

      // 3. 发现 MCP 工具
      if (this.options.discoverMCP && this.mcpManager) {
        const connectedServers = this.mcpManager.getConnectedServers();
        const allTools = this.mcpManager.getAllTools();
        
        report.mcpServers = {
          connected: connectedServers.length,
          totalTools: allTools.length,
        };

        // 注册 MCP 工具为能力
        if (this.options.autoRegister) {
          const count = this.registerMCPTools();
          report.newCapabilities += count;
        }
      }

      logger.info(`Discovery complete: ${report.newCapabilities} new capabilities`);
      this.emit('discovered', report);

      return report;
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * 注册系统工具为能力
   */
  private registerSystemTools(systemResult: {
    discoveredTools: Array<{
      definition: { name: string; description: string; category: string };
      available: boolean;
      version?: string | undefined;
    }>;
  }): number {
    let count = 0;

    for (const tool of systemResult.discoveredTools) {
      if (!tool.available) continue;

      try {
        this.capabilityRegistry.register({
          name: `system.${tool.definition.name}`,
          displayName: tool.definition.name,
          type: 'system-tool',
          description: tool.definition.description,
          version: tool.version ?? undefined,
          source: {
            type: 'system',
            id: 'system-scanner',
            name: 'System Scanner',
          },
          tags: ['system', tool.definition.category, 'auto-discovered'],
          category: tool.definition.category,
          confidence: 0.8,
          available: true,
          metadata: tool.version ? { version: tool.version } : {},
        });
        count++;
      } catch (error) {
        // 已存在，忽略
      }
    }

    logger.info(`Registered ${count} system tools as capabilities`);
    return count;
  }

  /**
   * 注册硬件能力
   */
  private registerHardwareCapabilities(hardwareInfo: {
    cpu: { model: string; cores: number };
    memory: { total: number };
    gpu?: Array<{ name: string; vendor: string }> | undefined;
  }): number {
    let count = 0;

    // 注册 CPU 能力
    try {
      this.capabilityRegistry.register({
        name: 'hardware.cpu',
        displayName: `CPU: ${hardwareInfo.cpu.model}`,
        type: 'hardware',
        description: `CPU with ${hardwareInfo.cpu.cores} cores`,
        source: {
          type: 'discovered',
          id: 'hardware-detector',
          name: 'Hardware Detector',
        },
        tags: ['hardware', 'cpu', 'compute'],
        category: 'compute',
        confidence: 1.0,
        available: true,
        metadata: {
          cores: hardwareInfo.cpu.cores,
          model: hardwareInfo.cpu.model,
        },
      });
      count++;
    } catch {
      // 已存在
    }

    // 注册内存能力
    try {
      const memoryGB = Math.round(hardwareInfo.memory.total / 1024 / 1024 / 1024);
      this.capabilityRegistry.register({
        name: 'hardware.memory',
        displayName: `Memory: ${memoryGB}GB`,
        type: 'hardware',
        description: `System memory: ${memoryGB}GB`,
        source: {
          type: 'discovered',
          id: 'hardware-detector',
          name: 'Hardware Detector',
        },
        tags: ['hardware', 'memory'],
        category: 'memory',
        confidence: 1.0,
        available: true,
        metadata: {
          totalBytes: hardwareInfo.memory.total,
        },
      });
      count++;
    } catch {
      // 已存在
    }

    // 注册 GPU 能力
    if (hardwareInfo.gpu) {
      for (const gpu of hardwareInfo.gpu) {
        try {
          this.capabilityRegistry.register({
            name: `hardware.gpu.${gpu.name.replace(/\s+/g, '_').toLowerCase()}`,
            displayName: `GPU: ${gpu.name}`,
            type: 'hardware',
            description: `GPU: ${gpu.name} (${gpu.vendor})`,
            source: {
              type: 'discovered',
              id: 'hardware-detector',
              name: 'Hardware Detector',
            },
            tags: ['hardware', 'gpu', 'compute', 'ai'],
            category: 'ai-acceleration',
            confidence: 1.0,
            available: true,
            metadata: {
              vendor: gpu.vendor,
              model: gpu.name,
            },
          });
          count++;
        } catch {
          // 已存在
        }
      }
    }

    logger.info(`Registered ${count} hardware capabilities`);
    return count;
  }

  /**
   * 注册 MCP 工具为能力
   */
  private registerMCPTools(): number {
    if (!this.mcpManager) return 0;

    let count = 0;
    const wrappedTools = this.mcpManager.getAllTools();

    for (const wrappedTool of wrappedTools) {
      try {
        this.capabilityRegistry.register({
          name: `mcp.${wrappedTool.mcpTool.name}`,
          displayName: wrappedTool.mcpTool.name,
          type: 'mcp-tool',
          description: wrappedTool.mcpTool.description,
          source: {
            type: 'mcp',
            id: wrappedTool.serverId,
            name: 'MCP Server',
          },
          parameters: Object.fromEntries(
            Object.entries(wrappedTool.mcpTool.inputSchema.properties).map(
              ([key, prop]) => [
                key,
                {
                  type: (prop as { type?: string }).type || 'string',
                  required: wrappedTool.mcpTool.inputSchema.required?.includes(key) || false,
                  description: (prop as { description?: string }).description || '',
                },
              ]
            )
          ),
          tags: ['mcp', 'external', 'auto-discovered'],
          category: 'external-service',
          confidence: wrappedTool.confidence,
          available: true,
          metadata: {
            serverId: wrappedTool.serverId,
            successRate: wrappedTool.stats.successCount / Math.max(1, wrappedTool.stats.callCount),
          },
        });
        count++;
      } catch {
        // 已存在
      }
    }

    logger.info(`Registered ${count} MCP tools as capabilities`);
    return count;
  }

  /**
   * 启动定期扫描
   */
  private startPeriodicScan(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
    }

    logger.info(`Starting periodic discovery scan (interval: ${this.options.scanInterval}ms)`);
    
    this.scanTimer = setInterval(async () => {
      try {
        await this.discoverAll();
      } catch (error) {
        logger.error('Periodic discovery error:', { error: error instanceof Error ? error.message : String(error) });
      }
    }, this.options.scanInterval);
  }

  /**
   * 停止定期扫描
   */
  stopPeriodicScan(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = undefined;
      logger.info('Stopped periodic discovery scan');
    }
  }

  /**
   * 停止所有发现活动
   */
  async stop(): Promise<void> {
    this.stopPeriodicScan();
    this.hardwareDetector.stopMonitoring();
    logger.info('Discovery Manager stopped');
    this.emit('stopped');
  }

  /**
   * 获取系统扫描器
   */
  getSystemScanner(): SystemScanner {
    return this.systemScanner;
  }

  /**
   * 获取硬件检测器
   */
  getHardwareDetector(): HardwareDetector {
    return this.hardwareDetector;
  }

  /**
   * 获取发现统计
   */
  getStats(): {
    systemTools: number;
    hardwareCapabilities: number;
    mcpTools: number;
    total: number;
  } {
    const allCapabilities = this.capabilityRegistry.getAll();
    
    return {
      systemTools: allCapabilities.filter(c => c.type === 'system-tool').length,
      hardwareCapabilities: allCapabilities.filter(c => c.type === 'hardware').length,
      mcpTools: allCapabilities.filter(c => c.type === 'mcp-tool').length,
      total: allCapabilities.length,
    };
  }
}
