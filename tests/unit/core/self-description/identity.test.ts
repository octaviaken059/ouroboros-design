/**
 * @file tests/unit/core/self-description/identity.test.ts
 * @description Identity 模块单元测试
 */

import { describe, it, expect } from '@jest/globals';
import { IdentityManager } from '@/core/self-description/identity';

describe('IdentityManager', () => {
  describe('构造函数', () => {
    it('应该使用默认值初始化', () => {
      const manager = new IdentityManager();
      const identity = manager.getIdentity();

      expect(identity.name).toBe('Ouroboros');
      expect(identity.version).toBe('2.0.0');
      expect(identity.evolutionStage).toBe('newborn');
      expect(identity.description).toBe('自我进化型 AI Agent');
    });

    it('应该使用自定义配置初始化', () => {
      const manager = new IdentityManager({
        name: 'TestAgent',
        version: '1.0.0',
        description: '测试代理',
      });
      const identity = manager.getIdentity();

      expect(identity.name).toBe('TestAgent');
      expect(identity.version).toBe('1.0.0');
      expect(identity.description).toBe('测试代理');
    });
  });

  describe('getIdentity', () => {
    it('应该返回身份信息副本', () => {
      const manager = new IdentityManager();
      const identity1 = manager.getIdentity();
      const identity2 = manager.getIdentity();

      expect(identity1).toEqual(identity2);
      expect(identity1).not.toBe(identity2); // 不是同一个引用
    });
  });

  describe('updateVersion', () => {
    it('应该更新版本号', () => {
      const manager = new IdentityManager();
      manager.updateVersion('2.1.0');

      expect(manager.getIdentity().version).toBe('2.1.0');
    });

    it('应该拒绝无效版本号格式', () => {
      const manager = new IdentityManager();
      expect(() => manager.updateVersion('invalid')).toThrow();
    });

    it('应该拒绝空版本号', () => {
      const manager = new IdentityManager();
      expect(() => manager.updateVersion('')).toThrow();
    });
  });

  describe('advanceStage', () => {
    it('应该进化到下一个阶段', () => {
      const manager = new IdentityManager();
      const result = manager.advanceStage();

      expect(result).toBe(true);
      expect(manager.getIdentity().evolutionStage).toBe('learning');
    });

    it('应该能连续进化', () => {
      const manager = new IdentityManager();
      manager.advanceStage(); // newborn -> learning
      manager.advanceStage(); // learning -> practicing
      manager.advanceStage(); // practicing -> mastering

      expect(manager.getIdentity().evolutionStage).toBe('mastering');
    });

    it('在最高阶段应该返回 false', () => {
      const manager = new IdentityManager();
      // 进化到最高阶段
      manager.advanceStage(); // learning
      manager.advanceStage(); // practicing
      manager.advanceStage(); // mastering
      manager.advanceStage(); // transcending

      const result = manager.advanceStage(); // 应该失败

      expect(result).toBe(false);
      expect(manager.getIdentity().evolutionStage).toBe('transcending');
    });
  });

  describe('generateIdentityPrompt', () => {
    it('应该生成包含身份信息的提示词', () => {
      const manager = new IdentityManager();
      const prompt = manager.generateIdentityPrompt();

      expect(prompt).toContain('Ouroboros');
      expect(prompt).toContain('2.0.0');
      expect(prompt).toContain('newborn');
    });
  });

  describe('toJSON / fromJSON', () => {
    it('应该正确序列化和反序列化', () => {
      const manager = new IdentityManager();
      manager.advanceStage();
      manager.updateVersion('2.5.0');

      const json = manager.toJSON();
      const restored = IdentityManager.fromJSON(json);

      expect(restored.getIdentity().name).toBe('Ouroboros');
      expect(restored.getIdentity().version).toBe('2.5.0');
      expect(restored.getIdentity().evolutionStage).toBe('learning');
    });
  });
});
