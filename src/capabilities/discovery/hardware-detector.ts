/**
 * @file capabilities/discovery/hardware-detector.ts
 * @description 硬件检测器 - 检测系统硬件资源和变化
 * @author Ouroboros
 * @date 2026-02-19
 */

import { execSync } from 'child_process';
import { createContextLogger } from '@/utils/logger';
import { EventEmitter } from 'events';

const logger = createContextLogger('HardwareDetector');

/** 硬件信息 */
export interface HardwareInfo {
  /** CPU 信息 */
  cpu: {
    model: string;
    cores: number;
    threads: number;
    architecture: string;
  };
  /** 内存信息 */
  memory: {
    total: number;
    available: number;
    used: number;
  };
  /** 存储信息 */
  storage: StorageDevice[];
  /** GPU 信息 */
  gpu: GPUInfo[] | undefined;
  /** 网络接口 */
  network: NetworkInterface[];
  /** 采集时间 */
  timestamp: string;
}

/** 存储设备 */
export interface StorageDevice {
  name: string;
  type: 'ssd' | 'hdd' | 'nvme' | 'external';
  size: number;
  used: number;
  mountPoint?: string;
}

/** GPU 信息 */
export interface GPUInfo {
  name: string;
  vendor: 'nvidia' | 'amd' | 'intel' | 'apple' | 'other';
  vram?: number | undefined;
  driver?: string | undefined;
}

/** 网络接口 */
export interface NetworkInterface {
  name: string;
  type: 'ethernet' | 'wifi' | 'loopback' | 'other';
  address?: string | undefined;
  mac?: string | undefined;
  status: 'up' | 'down';
}

/** 硬件变化事件 */
export interface HardwareChangeEvent {
  type: 'added' | 'removed' | 'changed';
  category: 'storage' | 'network' | 'gpu' | 'other';
  device: unknown;
  timestamp: string;
}

/**
 * 硬件检测器
 * 
 * 检测系统硬件配置并监听硬件变化
 */
export class HardwareDetector extends EventEmitter {
  private lastHardwareInfo?: HardwareInfo;
  private checkInterval?: NodeJS.Timeout | undefined;
  private isRunning = false;

  /**
   * 获取当前硬件信息
   */
  async getHardwareInfo(): Promise<HardwareInfo> {
    const info: HardwareInfo = {
      cpu: await this.getCPUInfo(),
      memory: await this.getMemoryInfo(),
      storage: await this.getStorageInfo(),
      gpu: await this.getGPUInfo(),
      network: await this.getNetworkInfo(),
      timestamp: new Date().toISOString(),
    };

    this.lastHardwareInfo = info;
    return info;
  }

  /**
   * 获取 CPU 信息
   */
  private async getCPUInfo(): Promise<HardwareInfo['cpu']> {
    const platform = process.platform;
    
    try {
      if (platform === 'linux') {
        const model = execSync('cat /proc/cpuinfo | grep "model name" | head -1', { encoding: 'utf-8' })
          .split(':')[1]?.trim() || 'Unknown';
        const cores = parseInt(execSync('nproc', { encoding: 'utf-8' }).trim());
        
        return {
          model,
          cores,
          threads: cores, // Simplified
          architecture: process.arch,
        };
      } else if (platform === 'darwin') {
        const model = execSync('sysctl -n machdep.cpu.brand_string', { encoding: 'utf-8' }).trim();
        const cores = parseInt(execSync('sysctl -n hw.ncpu', { encoding: 'utf-8' }).trim());
        
        return {
          model,
          cores,
          threads: cores,
          architecture: process.arch,
        };
      } else if (platform === 'win32') {
        // Windows 简化实现
        return {
          model: 'Windows CPU',
          cores: require('os').cpus().length,
          threads: require('os').cpus().length,
          architecture: process.arch,
        };
      }
    } catch (error) {
      logger.error(`Failed to get CPU info: ${error}`);
    }

    return {
      model: 'Unknown',
      cores: require('os').cpus().length,
      threads: require('os').cpus().length,
      architecture: process.arch,
    };
  }

  /**
   * 获取内存信息
   */
  private async getMemoryInfo(): Promise<HardwareInfo['memory']> {
    const os = require('os');
    const total = os.totalmem();
    const free = os.freemem();
    
    return {
      total,
      available: free,
      used: total - free,
    };
  }

  /**
   * 获取存储信息
   */
  private async getStorageInfo(): Promise<StorageDevice[]> {
    const devices: StorageDevice[] = [];
    const platform = process.platform;

    try {
      if (platform === 'linux') {
        // 使用 df 命令获取存储信息
        const output = execSync('df -B1 --output=source,size,used,target', { encoding: 'utf-8' });
        const lines = output.trim().split('\n').slice(1);
        
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 4) {
            const [source, size, used, target] = parts;
            if (source.startsWith('/dev/')) {
              devices.push({
                name: source.replace('/dev/', ''),
                type: this.detectStorageType(source),
                size: parseInt(size),
                used: parseInt(used),
                mountPoint: target,
              });
            }
          }
        }
      } else if (platform === 'darwin') {
        const output = execSync('df -b', { encoding: 'utf-8' });
        const lines = output.trim().split('\n').slice(1);
        
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 6) {
            const [source, size, used, , , target] = parts;
            if (source.startsWith('/dev/')) {
              devices.push({
                name: source.replace('/dev/', ''),
                type: this.detectStorageType(source),
                size: parseInt(size) * 512, // Convert blocks to bytes
                used: parseInt(used) * 512,
                mountPoint: target,
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to get storage info: ${error}`);
    }

    return devices;
  }

  /**
   * 检测存储类型
   */
  private detectStorageType(device: string): StorageDevice['type'] {
    if (device.includes('nvme')) return 'nvme';
    if (device.includes('sd') || device.includes('hd')) {
      // 简化检测，实际应该使用更复杂的方法
      return 'ssd';
    }
    return 'hdd';
  }

  /**
   * 获取 GPU 信息
   */
  private async getGPUInfo(): Promise<GPUInfo[] | undefined> {
    const gpus: GPUInfo[] = [];

    try {
      // 检测 NVIDIA GPU
      try {
        const nvidiaOutput = execSync('nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader', { encoding: 'utf-8' });
        const lines = nvidiaOutput.trim().split('\n');
        
        for (const line of lines) {
          const [name, vram, driver] = line.split(',').map(s => s.trim());
          gpus.push({
            name: name.replace('NVIDIA ', ''),
            vendor: 'nvidia',
            vram: this.parseVRAM(vram),
            driver,
          });
        }
      } catch {
        // 没有 NVIDIA GPU
      }

      // 检测 Apple Silicon
      if (process.platform === 'darwin') {
        try {
          const chipInfo = execSync('sysctl -n machdep.cpu.brand_string', { encoding: 'utf-8' }).trim();
          if (chipInfo.includes('Apple')) {
            gpus.push({
              name: chipInfo,
              vendor: 'apple',
            });
          }
        } catch {
          // 不是 Apple Silicon
        }
      }
    } catch (error) {
      logger.debug(`Failed to get GPU info: ${error}`);
    }

    return gpus.length > 0 ? gpus : undefined;
  }

  /**
   * 解析 VRAM 字符串
   */
  private parseVRAM(vramStr: string): number | undefined {
    const match = vramStr.match(/([\d.]+)\s*(MiB|GiB)/);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2];
      if (unit === 'GiB') return value * 1024 * 1024 * 1024;
      if (unit === 'MiB') return value * 1024 * 1024;
    }
    return undefined;
  }

  /**
   * 获取网络信息
   */
  private async getNetworkInfo(): Promise<NetworkInterface[]> {
    const interfaces: NetworkInterface[] = [];
    const os = require('os');
    const ifaces = os.networkInterfaces();

    for (const [name, addrs] of Object.entries(ifaces)) {
      const addresses = addrs as Array<{ family: string; address: string; mac?: string; internal: boolean }>;
      
      for (const addr of addresses) {
        if (addr.family === 'IPv4' && !addr.internal) {
          const iface: NetworkInterface = {
            name,
            type: this.detectNetworkType(name),
            address: addr.address,
            status: 'up',
          };
          if (addr.mac) {
            iface.mac = addr.mac;
          }
          interfaces.push(iface);
        }
      }
    }

    return interfaces;
  }

  /**
   * 检测网络类型
   */
  private detectNetworkType(name: string): NetworkInterface['type'] {
    if (name.startsWith('en') || name.startsWith('eth')) return 'ethernet';
    if (name.startsWith('wl') || name.startsWith('wi')) return 'wifi';
    if (name.startsWith('lo')) return 'loopback';
    return 'other';
  }

  /**
   * 启动硬件变化监听
   */
  startMonitoring(intervalMs = 30000): void {
    if (this.isRunning) {
      return;
    }

    logger.info(`Starting hardware monitoring (interval: ${intervalMs}ms)`);
    this.isRunning = true;

    // 立即获取一次基准信息
    this.getHardwareInfo().then(baseline => {
      this.lastHardwareInfo = baseline;
    });

    // 设置定期检查
    this.checkInterval = setInterval(async () => {
      await this.checkForChanges();
    }, intervalMs);
  }

  /**
   * 停止硬件变化监听
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    this.isRunning = false;
    logger.info('Stopped hardware monitoring');
  }

  /**
   * 检查硬件变化
   */
  private async checkForChanges(): Promise<void> {
    if (!this.lastHardwareInfo) {
      this.lastHardwareInfo = await this.getHardwareInfo();
      return;
    }

    const currentInfo = await this.getHardwareInfo();
    const changes: HardwareChangeEvent[] = [];

    // 检查存储变化
    const storageChanges = this.compareStorage(
      this.lastHardwareInfo.storage,
      currentInfo.storage
    );
    changes.push(...storageChanges);

    // 检查网络变化
    const networkChanges = this.compareNetwork(
      this.lastHardwareInfo.network,
      currentInfo.network
    );
    changes.push(...networkChanges);

    // 发出变化事件
    for (const change of changes) {
      logger.info(`Hardware change detected: ${change.type} ${change.category}`, { device: change.device });
      this.emit('change', change);
    }

    this.lastHardwareInfo = currentInfo;
  }

  /**
   * 比较存储设备
   */
  private compareStorage(
    oldDevices: StorageDevice[],
    newDevices: StorageDevice[]
  ): HardwareChangeEvent[] {
    const changes: HardwareChangeEvent[] = [];
    const oldMap = new Map(oldDevices.map(d => [d.name, d]));
    const newMap = new Map(newDevices.map(d => [d.name, d]));

    // 检测新增
    for (const [name, device] of newMap) {
      if (!oldMap.has(name)) {
        changes.push({
          type: 'added',
          category: 'storage',
          device,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 检测移除
    for (const [name, device] of oldMap) {
      if (!newMap.has(name)) {
        changes.push({
          type: 'removed',
          category: 'storage',
          device,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return changes;
  }

  /**
   * 比较网络接口
   */
  private compareNetwork(
    oldInterfaces: NetworkInterface[],
    newInterfaces: NetworkInterface[]
  ): HardwareChangeEvent[] {
    const changes: HardwareChangeEvent[] = [];
    const oldMap = new Map(oldInterfaces.map(i => [i.name, i]));
    const newMap = new Map(newInterfaces.map(i => [i.name, i]));

    // 检测新增
    for (const [name, iface] of newMap) {
      if (!oldMap.has(name)) {
        changes.push({
          type: 'added',
          category: 'network',
          device: iface,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 检测移除
    for (const [name, iface] of oldMap) {
      if (!newMap.has(name)) {
        changes.push({
          type: 'removed',
          category: 'network',
          device: iface,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return changes;
  }

  /**
   * 检查是否有 GPU 可用
   */
  hasGPU(): boolean {
    return !!this.lastHardwareInfo?.gpu && this.lastHardwareInfo.gpu.length > 0;
  }

  /**
   * 获取 GPU 列表
   */
  getGPUs(): GPUInfo[] {
    return this.lastHardwareInfo?.gpu || [];
  }

  /**
   * 获取可用存储空间
   */
  getAvailableStorage(): number {
    if (!this.lastHardwareInfo) return 0;
    return this.lastHardwareInfo.storage.reduce(
      (sum, d) => sum + (d.size - d.used),
      0
    );
  }
}

/**
 * 便捷函数：获取硬件信息
 */
export async function detectHardware(): Promise<HardwareInfo> {
  const detector = new HardwareDetector();
  return detector.getHardwareInfo();
}
