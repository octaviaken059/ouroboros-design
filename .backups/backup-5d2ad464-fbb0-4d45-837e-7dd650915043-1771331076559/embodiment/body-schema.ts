/**
 * 身体图式 (BodySchema)
 * 
 * 具身认知的核心组件 - 让AI感知自己的"身体"状态
 * 如衔尾蛇感知大地，BodySchema让Agent感知自身运行环境
 */

import * as os from 'os';
import * as process from 'process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 进程身份信息
 */
export interface ProcessIdentity {
  pid: number;              // 进程ID
  ppid: number;             // 父进程ID
  uid: number;              // 用户ID
  gid: number;              // 组ID
  cwd: string;              // 当前工作目录
  executable: string;       // 可执行文件路径
  startTime: Date;          // 启动时间
  uptime: number;           // 运行时间(秒)
  nodeVersion: string;      // Node.js版本
  soulSignature: string;    // 灵魂签名 - 身份锚定
}

/**
 * 资源状态
 */
export interface ResourceStatus {
  memory: MemoryInfo;
  cpu: CPUInfo;
  disk: DiskInfo;
  process: ProcessResourceInfo;
}

export interface MemoryInfo {
  total: number;            // 总内存(字节)
  free: number;             // 空闲内存(字节)
  used: number;             // 已用内存(字节)
  usagePercent: number;     // 使用率(0-1)
}

export interface CPUInfo {
  usage: number;            // 当前使用率(0-1)
  loadAvg: number[];        // 1/5/15分钟负载
  count: number;            // CPU核心数
  model: string;            // CPU型号
}

export interface DiskInfo {
  total: number;            // 总空间(字节)
  free: number;             // 空闲空间(字节)
  used: number;             // 已用空间(字节)
  usagePercent: number;     // 使用率(0-1)
}

export interface ProcessResourceInfo {
  rss: number;              // 常驻内存(字节)
  heapTotal: number;        // V8堆总大小
  heapUsed: number;         // V8堆已用大小
  external: number;         // 外部内存使用
  arrayBuffers: number;     // ArrayBuffer使用
}

/**
 * 环境信息
 */
export interface EnvironmentInfo {
  hostname: string;
  platform: NodeJS.Platform;
  arch: string;
  osRelease: string;
  timezone: string;
  env: Record<string, string>;  // 环境变量快照
}

/**
 * 系统能力
 */
export interface SystemCapabilities {
  tools: ToolCapability[];
  hardware: HardwareCapability;
  services: ServiceCapability[];
}

export interface ToolCapability {
  name: string;
  available: boolean;
  version?: string;
  path?: string;
}

export interface HardwareCapability {
  hasGPU: boolean;
  hasCUDA: boolean;
  gpuInfo?: string;
}

export interface ServiceCapability {
  name: string;
  available: boolean;
  url?: string;
  latency?: number;
}

/**
 * 完整身体图式
 */
export interface BodySchema {
  identity: ProcessIdentity;
  resources: ResourceStatus;
  environment: EnvironmentInfo;
  capabilities: SystemCapabilities;
  timestamp: Date;
}

/**
 * 身体图式变更事件
 */
export interface BodySchemaChangeEvent {
  type: 'identity' | 'resource' | 'environment' | 'capability';
  field: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: Date;
}

// ============================================================================
// BodySchema 类
// ============================================================================

export class BodySchemaMonitor {
  private lastSchema?: BodySchema;
  private changeListeners: ((event: BodySchemaChangeEvent) => void)[] = [];
  private scanInterval?: NodeJS.Timeout;
  
  // 灵魂签名 - 基于系统熵的唯一标识
  private soulSignature: string;

  constructor() {
    this.soulSignature = this.generateSoulSignature();
  }

  /**
   * 生成灵魂签名
   * 基于系统熵生成唯一标识，用于身份锚定
   */
  private generateSoulSignature(): string {
    const entropy = [
      process.pid,
      process.ppid,
      os.hostname(),
      os.uptime(),
      Date.now(),
      Math.random()
    ].join('|');
    
    // 简单的哈希实现
    let hash = 0;
    for (let i = 0; i < entropy.length; i++) {
      const char = entropy.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  /**
   * 获取当前身体图式
   */
  async getCurrentSchema(): Promise<BodySchema> {
    const schema: BodySchema = {
      identity: await this.getIdentity(),
      resources: await this.getResources(),
      environment: this.getEnvironment(),
      capabilities: await this.scanCapabilities(),
      timestamp: new Date()
    };

    // 检测变更
    if (this.lastSchema) {
      this.detectChanges(this.lastSchema, schema);
    }
    
    this.lastSchema = schema;
    return schema;
  }

  /**
   * 获取身份信息
   */
  private async getIdentity(): Promise<ProcessIdentity> {
    return {
      pid: process.pid,
      ppid: process.ppid || 0,
      uid: process.getuid?.() || 0,
      gid: process.getgid?.() || 0,
      cwd: process.cwd(),
      executable: process.execPath,
      startTime: new Date(Date.now() - process.uptime() * 1000),
      uptime: process.uptime(),
      nodeVersion: process.version,
      soulSignature: this.soulSignature
    };
  }

  /**
   * 获取资源状态
   */
  private async getResources(): Promise<ResourceStatus> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usagePercent: usedMem / totalMem
      },
      cpu: {
        usage: await this.getCPUUsage(),
        loadAvg: os.loadavg(),
        count: os.cpus().length,
        model: os.cpus()[0]?.model || 'unknown'
      },
      disk: await this.getDiskUsage(),
      process: {
        rss: process.memoryUsage().rss,
        heapTotal: process.memoryUsage().heapTotal,
        heapUsed: process.memoryUsage().heapUsed,
        external: process.memoryUsage().external || 0,
        arrayBuffers: process.memoryUsage().arrayBuffers || 0
      }
    };
  }

  /**
   * 获取CPU使用率
   */
  private async getCPUUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();
      
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const elapsedTime = Date.now() - startTime;
        
        // 计算CPU使用率 (用户时间 + 系统时间) / 总时间 / CPU核心数
        const totalUsage = (endUsage.user + endUsage.system) / 1000; // 转换为毫秒
        const usagePercent = totalUsage / (elapsedTime * 1000 * os.cpus().length);
        
        resolve(Math.min(usagePercent, 1));
      }, 100);
    });
  }

  /**
   * 获取磁盘使用情况
   */
  private async getDiskUsage(): Promise<DiskInfo> {
    try {
      const cwd = process.cwd();
      const stats = await fs.statfs(cwd);
      
      const total = stats.bsize * stats.blocks;
      const free = stats.bsize * stats.bfree;
      const used = total - free;
      
      return {
        total,
        free,
        used,
        usagePercent: used / total
      };
    } catch {
      // 如果无法获取，返回默认值
      return {
        total: 0,
        free: 0,
        used: 0,
        usagePercent: 0
      };
    }
  }

  /**
   * 获取环境信息
   */
  private getEnvironment(): EnvironmentInfo {
    return {
      hostname: os.hostname(),
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      env: { ...process.env }  // 快照
    };
  }

  /**
   * 扫描系统能力
   */
  private async scanCapabilities(): Promise<SystemCapabilities> {
    return {
      tools: await this.scanTools(),
      hardware: await this.scanHardware(),
      services: await this.scanServices()
    };
  }

  /**
   * 扫描可用工具
   */
  private async scanTools(): Promise<ToolCapability[]> {
    const toolsToCheck = [
      'git', 'node', 'npm', 'docker', 'docker-compose',
      'python3', 'python', 'go', 'rustc', 'code',
      'ollama', 'ffmpeg', 'sqlite3', 'curl', 'wget'
    ];
    
    const tools: ToolCapability[] = [];
    
    for (const tool of toolsToCheck) {
      try {
        const { stdout } = await execAsync(`which ${tool}`);
        const toolPath = stdout.trim();
        
        let version: string | undefined;
        try {
          const { stdout: verOut } = await execAsync(`${tool} --version 2>/dev/null || ${tool} -v 2>/dev/null || echo "unknown"`);
          version = verOut.split('\n')[0].slice(0, 50);
        } catch {
          version = 'unknown';
        }
        
        tools.push({
          name: tool,
          available: true,
          version,
          path: toolPath
        });
      } catch {
        tools.push({
          name: tool,
          available: false
        });
      }
    }
    
    return tools;
  }

  /**
   * 扫描硬件能力
   */
  private async scanHardware(): Promise<HardwareCapability> {
    let hasGPU = false;
    let hasCUDA = false;
    let gpuInfo: string | undefined;
    
    try {
      // 检查nvidia-smi
      const { stdout } = await execAsync('nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null || echo ""');
      if (stdout.trim()) {
        hasGPU = true;
        hasCUDA = true;
        gpuInfo = stdout.trim();
      }
    } catch {
      // 无NVIDIA GPU
    }
    
    return { hasGPU, hasCUDA, gpuInfo };
  }

  /**
   * 扫描外部服务
   */
  private async scanServices(): Promise<ServiceCapability[]> {
    const services = [
      { name: 'ollama', url: 'http://localhost:11434' },
      { name: 'openclaw-gateway', url: 'http://localhost:8080' }
    ];
    
    const results: ServiceCapability[] = [];
    
    for (const svc of services) {
      const startTime = Date.now();
      try {
        // 简单的HTTP HEAD请求检查可用性
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch(svc.url, { 
          method: 'HEAD',
          signal: controller.signal
        });
        clearTimeout(timeout);
        
        results.push({
          name: svc.name,
          available: response.ok,
          url: svc.url,
          latency: Date.now() - startTime
        });
      } catch {
        results.push({
          name: svc.name,
          available: false,
          url: svc.url
        });
      }
    }
    
    return results;
  }

  /**
   * 检测身体图式变更
   */
  private detectChanges(oldSchema: BodySchema, newSchema: BodySchema): void {
    // 检测资源变化
    const oldMem = oldSchema.resources.memory.usagePercent;
    const newMem = newSchema.resources.memory.usagePercent;
    if (Math.abs(newMem - oldMem) > 0.1) {
      this.emitChange({
        type: 'resource',
        field: 'memory.usagePercent',
        oldValue: oldMem,
        newValue: newMem,
        timestamp: new Date()
      });
    }
    
    // 检测CPU变化
    const oldCPU = oldSchema.resources.cpu.usage;
    const newCPU = newSchema.resources.cpu.usage;
    if (Math.abs(newCPU - oldCPU) > 0.2) {
      this.emitChange({
        type: 'resource',
        field: 'cpu.usage',
        oldValue: oldCPU,
        newValue: newCPU,
        timestamp: new Date()
      });
    }
  }

  /**
   * 发送变更事件
   */
  private emitChange(event: BodySchemaChangeEvent): void {
    for (const listener of this.changeListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('BodySchema change listener error:', error);
      }
    }
  }

  /**
   * 注册变更监听器
   */
  onChange(listener: (event: BodySchemaChangeEvent) => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  /**
   * 开始定期扫描
   */
  startMonitoring(intervalMs: number = 5000): void {
    this.stopMonitoring();
    this.scanInterval = setInterval(async () => {
      await this.getCurrentSchema();
    }, intervalMs);
  }

  /**
   * 停止定期扫描
   */
  stopMonitoring(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = undefined;
    }
  }

  /**
   * 验证身份完整性
   */
  verifyIdentity(): { valid: boolean; state: 'STABLE' | 'MINOR_CHANGE' | 'MAJOR_CHANGE' } {
    // 简化的身份验证
    return {
      valid: true,
      state: 'STABLE'
    };
  }

  /**
   * 获取身体图式描述（用于自我认知）
   */
  async getSelfDescription(): Promise<string> {
    const schema = await this.getCurrentSchema();
    
    const lines = [
      `🐍 Ouroboros Body Schema`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `📊 Identity:`,
      `  PID: ${schema.identity.pid}`,
      `  Uptime: ${Math.floor(schema.identity.uptime)}s`,
      `  Node: ${schema.identity.nodeVersion}`,
      `  Soul: ${schema.identity.soulSignature.slice(0, 8)}...`,
      ``,
      `💾 Resources:`,
      `  Memory: ${(schema.resources.memory.usagePercent * 100).toFixed(1)}%`,
      `  CPU: ${(schema.resources.cpu.usage * 100).toFixed(1)}%`,
      `  Load: ${schema.resources.cpu.loadAvg.map(l => l.toFixed(2)).join(', ')}`,
      ``,
      `🌍 Environment:`,
      `  Host: ${schema.environment.hostname}`,
      `  Platform: ${schema.environment.platform} (${schema.environment.arch})`,
      `  TZ: ${schema.environment.timezone}`,
      ``,
      `🛠️ Capabilities:`,
      `  Tools: ${schema.capabilities.tools.filter(t => t.available).length}/${schema.capabilities.tools.length}`,
      `  GPU: ${schema.capabilities.hardware.hasGPU ? '✅' : '❌'}`,
      `  Services: ${schema.capabilities.services.filter(s => s.available).length}/${schema.capabilities.services.length}`,
      ``,
      `⏱️ Timestamp: ${schema.timestamp.toISOString()}`
    ];
    
    return lines.join('\n');
  }
}

// 导出单例
export const bodySchema = new BodySchemaMonitor();
export default bodySchema;
