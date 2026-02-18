/**
 * @file core/self-description/body.ts
 * @description Body 模块 - 身体图式
 * @author Ouroboros
 * @date 2026-02-18
 */

import { platform, arch, totalmem, freemem, loadavg, uptime, networkInterfaces } from 'os';
import { statfs } from 'fs/promises';
import type { Sensor, Actuator, ResourceStatus, Body } from '@/types/index';
import { createContextLogger } from '@utils/logger';
import { ConfigError, tryCatch } from '@utils/error';

const logger = createContextLogger('Body');

/**
 * Body 管理类
 * 管理传感器、执行器和资源监控
 */
export class BodyManager {
  private body: Body;

  /**
   * 构造函数
   */
  constructor() {
    this.body = {
      sensors: [],
      actuators: [],
      resources: this.getInitialResources(),
      platform: {
        os: platform(),
        arch: arch(),
        nodeVersion: process.version,
      },
    };

    // 初始化默认传感器
    this.initializeDefaultSensors();
    // 初始化默认执行器
    this.initializeDefaultActuators();

    logger.info('Body 初始化完成', {
      sensors: this.body.sensors.length,
      actuators: this.body.actuators.length,
    });
  }

  /**
   * 初始化默认传感器
   */
  private initializeDefaultSensors(): void {
    const defaultSensors: { name: string; type: Sensor['type']; status: Sensor['status'] }[] = [
      { name: 'filesystem', type: 'filesystem', status: 'active' },
      { name: 'network', type: 'network', status: 'active' },
      { name: 'process', type: 'process', status: 'active' },
      { name: 'time', type: 'time', status: 'active' },
      { name: 'system_resources', type: 'resource', status: 'active' },
    ];

    for (const sensor of defaultSensors) {
      this.addSensor(sensor.name, sensor.type, sensor.status);
    }
  }

  /**
   * 初始化默认执行器
   */
  private initializeDefaultActuators(): void {
    const defaultActuators: { name: string; type: Actuator['type'] }[] = [
      { name: 'file_write', type: 'file_write' },
      { name: 'exec_command', type: 'exec_command' },
      { name: 'http_request', type: 'http_request' },
      { name: 'websocket', type: 'websocket' },
    ];

    for (const actuator of defaultActuators) {
      this.addActuator(actuator.name, actuator.type);
    }
  }

  /**
   * 获取初始资源状态
   */
  private getInitialResources(): ResourceStatus {
    const total = totalmem();
    const free = freemem();
    return {
      cpu: {
        cores: 0,
        usage: 0,
        loadAverage: [0, 0, 0] as [number, number, number],
      },
      memory: {
        total,
        used: total - free,
        usage: (total - free) / total,
      },
      disk: {
        total: 0,
        used: 0,
        usage: 0,
      },
      network: {
        online: true,
        interfaces: [],
      },
      uptime: uptime() * 1000,
    };
  }

  /**
   * 添加传感器
   * @param name 传感器名称
   * @param type 传感器类型
   * @param status 初始状态
   */
  addSensor(name: string, type: Sensor['type'], status: Sensor['status'] = 'active'): void {
    const add = tryCatch(
      () => {
        // 检查是否已存在
        if (this.body.sensors.some((s: Sensor) => s.name === name)) {
          throw new Error(`传感器 ${name} 已存在`);
        }

        const sensor: Sensor = {
          name,
          type,
          status,
          lastUpdate: new Date().toISOString(),
          metadata: {},
        };

        this.body.sensors.push(sensor);
        logger.debug('传感器已添加', { name, type, status });
      },
      'Body.addSensor',
      ConfigError
    );

    add();
  }

  /**
   * 移除传感器
   * @param name 传感器名称
   */
  removeSensor(name: string): void {
    const remove = tryCatch(
      () => {
        const index = this.body.sensors.findIndex((s: Sensor) => s.name === name);
        if (index === -1) {
          throw new Error(`传感器 ${name} 不存在`);
        }

        this.body.sensors.splice(index, 1);
        logger.debug('传感器已移除', { name });
      },
      'Body.removeSensor',
      ConfigError
    );

    remove();
  }

  /**
   * 获取传感器
   * @param name 传感器名称
   * @returns 传感器或 undefined
   */
  getSensor(name: string): Sensor | undefined {
    return this.body.sensors.find((s: Sensor) => s.name === name);
  }

  /**
   * 获取活跃传感器
   * @returns 活跃传感器列表
   */
  getActiveSensors(): Sensor[] {
    return this.body.sensors.filter((s: Sensor) => s.status === 'active');
  }

  /**
   * 更新传感器状态
   * @param name 传感器名称
   * @param status 新状态
   */
  updateSensorStatus(name: string, status: Sensor['status']): void {
    const update = tryCatch(
      () => {
        const sensor = this.body.sensors.find((s: Sensor) => s.name === name);
        if (!sensor) {
          throw new Error(`传感器 ${name} 不存在`);
        }

        const oldStatus = sensor.status;
        sensor.status = status;
        sensor.lastUpdate = new Date().toISOString();

        logger.debug('传感器状态已更新', { name, oldStatus, newStatus: status });
      },
      'Body.updateSensorStatus',
      ConfigError
    );

    update();
  }

  /**
   * 添加执行器
   * @param name 执行器名称
   * @param type 执行器类型
   */
  addActuator(name: string, type: Actuator['type']): void {
    const add = tryCatch(
      () => {
        if (this.body.actuators.some((a: Actuator) => a.name === name)) {
          throw new Error(`执行器 ${name} 已存在`);
        }

        const actuator: Actuator = {
          name,
          type,
          status: 'ready',
        };

        this.body.actuators.push(actuator);
        logger.debug('执行器已添加', { name, type });
      },
      'Body.addActuator',
      ConfigError
    );

    add();
  }

  /**
   * 获取资源状态
   * @returns 资源状态
   */
  getResourceStatus(): ResourceStatus {
    return { ...this.body.resources };
  }

  /**
   * 更新资源状态
   */
  async updateResources(): Promise<void> {
    try {
      const total = totalmem();
      const free = freemem();
      const loads = loadavg();

      // 获取磁盘信息
      let diskInfo = { total: 0, used: 0 };
      try {
        const stats = await statfs('/');
        const blockSize = stats.bsize;
        diskInfo = {
          total: stats.blocks * blockSize,
          used: (stats.blocks - stats.bfree) * blockSize,
        };
      } catch {
        logger.warn('获取磁盘信息失败');
      }

      // 获取网络接口
      const nets = networkInterfaces();
      const interfaces = Object.entries(nets).flatMap(([name, addrs]) =>
        (addrs ?? [])
          .filter((a) => !a.internal)
          .map((a) => ({
            name,
            address: a.address,
            family: a.family,
          }))
      );

      this.body.resources = {
        cpu: {
          cores: 0,
          usage: Math.min(1, (loads[0] ?? 0) / 4),
          loadAverage: (loads.length >= 3 ? loads : [0, 0, 0]) as [number, number, number],
        },
        memory: {
          total,
          used: total - free,
          usage: (total - free) / total,
        },
        disk: {
          total: diskInfo.total,
          used: diskInfo.used,
          usage: diskInfo.total > 0 ? diskInfo.used / diskInfo.total : 0,
        },
        network: {
          online: interfaces.length > 0,
          interfaces,
        },
        uptime: uptime() * 1000,
      };

      logger.trace('资源状态已更新');
    } catch (error) {
      logger.error('更新资源状态失败', { error: String(error) });
    }
  }

  /**
   * 生成身体图式描述
   * @returns 描述文本
   */
  generateBodyPrompt(): string {
    const activeSensors = this.getActiveSensors();
    const readyActuators = this.body.actuators.filter((a: Actuator) => a.status === 'ready');
    const { resources } = this.body;

    return `
### Body
- Sensors: ${activeSensors.map((s: Sensor) => s.name).join(', ')}
- Actuators: ${readyActuators.map((a: Actuator) => a.name).join(', ')}
- Resources:
  - CPU: ${(resources.cpu.usage * 100).toFixed(1)}%
  - Memory: ${(resources.memory.usage * 100).toFixed(1)}%
  - Disk: ${(resources.disk.usage * 100).toFixed(1)}%
  - Uptime: ${Math.floor(resources.uptime / 1000 / 60).toString()}m
`.trim();
  }

  /**
   * 序列化为 JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      sensors: this.body.sensors,
      actuators: this.body.actuators,
      resources: this.body.resources,
      platform: this.body.platform,
    };
  }

  /**
   * 从 JSON 恢复
   */
  static fromJSON(data: Record<string, unknown>): BodyManager {
    const manager = new BodyManager();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    manager.body.sensors = (data.sensors as Sensor[]) ?? [];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    manager.body.actuators = (data.actuators as Actuator[]) ?? [];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    manager.body.resources = (data.resources as ResourceStatus) ?? manager.getInitialResources();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    manager.body.platform = (data.platform as Body['platform']) ?? {
      os: platform(),
      arch: arch(),
      nodeVersion: process.version,
    };
    return manager;
  }
}
