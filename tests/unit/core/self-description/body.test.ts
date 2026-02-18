/**
 * @file tests/unit/core/self-description/body.test.ts
 * @description Body 模块单元测试
 */

import { describe, it, expect } from '@jest/globals';
import { BodyManager } from '@/core/self-description/body';

describe('BodyManager', () => {
  describe('构造函数', () => {
    it('应该初始化默认传感器', () => {
      const manager = new BodyManager();
      const sensors = manager.getActiveSensors();

      expect(sensors.length).toBeGreaterThanOrEqual(5);
      expect(manager.getSensor('filesystem')).toBeDefined();
      expect(manager.getSensor('network')).toBeDefined();
    });

    it('应该初始化默认执行器', () => {
      const manager = new BodyManager();
      const status = manager.getResourceStatus();

      expect(status).toBeDefined();
      expect(status.memory.total).toBeGreaterThan(0);
    });
  });

  describe('传感器管理', () => {
    it('应该添加新传感器', () => {
      const manager = new BodyManager();
      manager.addSensor('test_sensor', 'custom', 'active');

      const sensor = manager.getSensor('test_sensor');
      expect(sensor).toBeDefined();
      expect(sensor?.type).toBe('custom');
    });

    it('应该拒绝重复添加传感器', () => {
      const manager = new BodyManager();
      expect(() => {
        manager.addSensor('filesystem', 'filesystem', 'active');
      }).toThrow();
    });

    it('应该移除传感器', () => {
      const manager = new BodyManager();
      manager.addSensor('removable', 'custom', 'active');
      manager.removeSensor('removable');

      expect(manager.getSensor('removable')).toBeUndefined();
    });

    it('应该拒绝移除不存在的传感器', () => {
      const manager = new BodyManager();
      expect(() => {
        manager.removeSensor('nonexistent');
      }).toThrow();
    });

    it('应该更新传感器状态', () => {
      const manager = new BodyManager();
      manager.updateSensorStatus('filesystem', 'inactive');

      const sensor = manager.getSensor('filesystem');
      expect(sensor?.status).toBe('inactive');
    });

    it('应该只返回活跃传感器', () => {
      const manager = new BodyManager();
      const initialCount = manager.getActiveSensors().length;

      manager.updateSensorStatus('filesystem', 'inactive');

      expect(manager.getActiveSensors().length).toBe(initialCount - 1);
    });
  });

  describe('执行器管理', () => {
    it('应该添加新执行器', () => {
      const manager = new BodyManager();
      manager.addActuator('test_actuator', 'custom');

      // 执行器添加后，资源状态应该仍然可用
      const status = manager.getResourceStatus();
      expect(status).toBeDefined();
    });

    it('应该拒绝重复添加执行器', () => {
      const manager = new BodyManager();
      expect(() => {
        manager.addActuator('file_write', 'file_write');
      }).toThrow();
    });
  });

  describe('资源监控', () => {
    it('应该获取资源状态', () => {
      const manager = new BodyManager();
      const status = manager.getResourceStatus();

      expect(status.memory.total).toBeGreaterThan(0);
      expect(status.memory.usage).toBeGreaterThanOrEqual(0);
      expect(status.memory.usage).toBeLessThanOrEqual(1);
    });

    it('应该异步更新资源', async () => {
      const manager = new BodyManager();
      await manager.updateResources();

      const status = manager.getResourceStatus();
      expect(status.uptime).toBeGreaterThan(0);
    });
  });

  describe('生成描述', () => {
    it('应该生成身体图式提示词', () => {
      const manager = new BodyManager();
      const prompt = manager.generateBodyPrompt();

      expect(prompt).toContain('Sensors:');
      expect(prompt).toContain('Actuators:');
      expect(prompt).toContain('Resources:');
    });
  });

  describe('序列化', () => {
    it('应该正确序列化和反序列化', () => {
      const manager = new BodyManager();
      manager.addSensor('test', 'custom', 'active');

      const json = manager.toJSON();
      const restored = BodyManager.fromJSON(json);

      expect(restored.getSensor('test')).toBeDefined();
      expect(restored.getResourceStatus().memory.total).toBeGreaterThan(0);
    });
  });
});
