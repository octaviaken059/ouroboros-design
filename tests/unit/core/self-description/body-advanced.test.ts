/**
 * @file tests/unit/core/self-description/body-advanced.test.ts
 * @description BodyManager 高级测试 - 提高分支覆盖率
 * @author Ouroboros
 * @date 2026-02-18
 */

import { BodyManager } from '@/core/self-description/body';

describe('BodyManager 高级测试', () => {
  describe('传感器管理边界条件', () => {
    it('应该更新传感器状态并反映到活跃列表', () => {
      const manager = new BodyManager();
      manager.addSensor('test_sensor', 'custom');

      // 初始状态
      manager.updateSensorStatus('test_sensor', 'active');
      let activeSensors = manager.getActiveSensors();
      expect(activeSensors.some((s) => s.name === 'test_sensor')).toBe(true);

      // 改为inactive
      manager.updateSensorStatus('test_sensor', 'inactive');
      activeSensors = manager.getActiveSensors();
      expect(activeSensors.some((s) => s.name === 'test_sensor')).toBe(false);

      // 改为error
      manager.updateSensorStatus('test_sensor', 'error');
      activeSensors = manager.getActiveSensors();
      expect(activeSensors.some((s) => s.name === 'test_sensor')).toBe(false);
    });

    it('更新不存在的传感器应该抛出错误', () => {
      const manager = new BodyManager();

      expect(() => {
        manager.updateSensorStatus('nonexistent', 'active');
      }).toThrow();
    });
  });

  describe('执行器管理', () => {
    it('应该添加执行器', () => {
      const manager = new BodyManager();
      manager.addActuator('test_actuator', 'custom');

      const actuators = manager.getActuators();
      expect(actuators.some((a) => a.name === 'test_actuator')).toBe(true);
    });

    it('重复添加执行器应该抛出错误', () => {
      const manager = new BodyManager();
      manager.addActuator('unique_actuator', 'custom');

      expect(() => {
        manager.addActuator('unique_actuator', 'custom');
      }).toThrow();
    });
  });

  describe('资源监控', () => {
    it('应该异步更新资源', async () => {
      const manager = new BodyManager();

      const initialStatus = manager.getResourceStatus();
      await manager.updateResources();
      const updatedStatus = manager.getResourceStatus();

      expect(updatedStatus).toBeDefined();
      expect(updatedStatus.cpu).toBeDefined();
      expect(updatedStatus.memory).toBeDefined();
    });
  });

  describe('提示词生成', () => {
    it('应该生成包含所有传感器和执行器的提示词', () => {
      const manager = new BodyManager();

      const prompt = manager.generateBodyPrompt();

      expect(prompt).toContain('Sensors');
      expect(prompt).toContain('Actuators');
    });
  });

  describe('序列化', () => {
    it('应该正确序列化和恢复', () => {
      const manager = new BodyManager();
      manager.addSensor('custom_sensor', 'custom');
      manager.addActuator('custom_actuator', 'custom');

      const json = manager.toJSON();
      const restored = BodyManager.fromJSON(json);

      const sensors = restored.getSensors();
      const actuators = restored.getActuators();

      expect(sensors.some((s) => s.name === 'custom_sensor')).toBe(true);
      expect(actuators.some((a) => a.name === 'custom_actuator')).toBe(true);
    });

    it('应该恢复空状态', () => {
      const manager = new BodyManager();
      const json = manager.toJSON();
      const restored = BodyManager.fromJSON(json);

      expect(restored.getSensor).toBeDefined();
    });
  });
});
