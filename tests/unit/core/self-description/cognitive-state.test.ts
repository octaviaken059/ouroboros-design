/**
 * @file tests/unit/core/self-description/cognitive-state.test.ts
 * @description CognitiveState 模块单元测试
 */

import { describe, it, expect } from '@jest/globals';
import { CognitiveStateManager } from '@/core/self-description/cognitive-state';

describe('CognitiveStateManager', () => {
  describe('激素管理', () => {
    it('应该更新激素水平', () => {
      const manager = new CognitiveStateManager();
      manager.updateHormone('dopamine', 0.8, '测试');

      const levels = manager.getHormoneLevels();
      expect(levels.dopamine).toBe(0.8);
    });

    it('应该拒绝无效激素名称', () => {
      const manager = new CognitiveStateManager();
      expect(() => {
        // @ts-expect-error 测试无效值
        manager.updateHormone('invalid_hormone', 0.5);
      }).toThrow();
    });

    it('应该拒绝超出范围的值', () => {
      const manager = new CognitiveStateManager();
      expect(() => manager.updateHormone('dopamine', 1.5)).toThrow();
      expect(() => manager.updateHormone('dopamine', -0.1)).toThrow();
    });

    it('应该获取主导激素', () => {
      const manager = new CognitiveStateManager();
      manager.updateHormone('dopamine', 0.9);
      manager.updateHormone('cortisol', 0.2);

      const dominant = manager.getDominantHormone();
      expect(dominant.name).toBe('dopamine');
      expect(dominant.value).toBe(0.9);
    });
  });

  describe('模式管理', () => {
    it('应该设置和获取模式', () => {
      const manager = new CognitiveStateManager();
      manager.setMode('evolving');

      expect(manager.getMode()).toBe('evolving');
    });
  });

  describe('目标管理', () => {
    it('应该设置目标', () => {
      const manager = new CognitiveStateManager();
      const id = manager.setGoal('完成单元测试', 'high');

      expect(id).toBeDefined();
    });

    it('应该获取当前目标', () => {
      const manager = new CognitiveStateManager();
      manager.setGoal('高优先级任务', 'high');
      manager.setGoal('低优先级任务', 'low');

      const current = manager.getCurrentGoal();
      expect(current?.description).toBe('高优先级任务');
    });

    it('应该完成目标并增加多巴胺', () => {
      const manager = new CognitiveStateManager();
      const initialDopamine = manager.getHormoneLevels().dopamine;
      const id = manager.setGoal('测试任务', 'medium');

      manager.completeGoal(id);

      const newDopamine = manager.getHormoneLevels().dopamine;
      expect(newDopamine).toBeGreaterThan(initialDopamine);
    });

    it('应该只返回未完成目标', () => {
      const manager = new CognitiveStateManager();
      const id = manager.setGoal('即将完成的任务', 'medium');
      manager.completeGoal(id);

      const current = manager.getCurrentGoal();
      expect(current?.description).not.toBe('即将完成的任务');
    });
  });

  describe('专注度管理', () => {
    it('应该更新专注度', () => {
      const manager = new CognitiveStateManager();
      manager.updateFocus(0.9);

      // 专注度更新后会反映在提示词中
      const prompt = manager.generateCognitiveStatePrompt();
      expect(prompt).toContain('90%');
    });

    it('应该拒绝无效专注度', () => {
      const manager = new CognitiveStateManager();
      expect(() => manager.updateFocus(1.5)).toThrow();
    });
  });

  describe('生成描述', () => {
    it('应该生成认知状态提示词', () => {
      const manager = new CognitiveStateManager();
      const prompt = manager.generateCognitiveStatePrompt();

      expect(prompt).toContain('Mode:');
      expect(prompt).toContain('Focus:');
      expect(prompt).toContain('Hormones:');
    });
  });

  describe('序列化', () => {
    it('应该正确序列化和反序列化', () => {
      const manager = new CognitiveStateManager();
      manager.updateHormone('dopamine', 0.75);
      manager.setMode('reflection');
      const goalId = manager.setGoal('测试目标', 'high');
      expect(goalId).toBeDefined();

      const json = manager.toJSON();
      const restored = CognitiveStateManager.fromJSON(json);

      expect(restored.getHormoneLevels().dopamine).toBe(0.75);
      expect(restored.getMode()).toBe('reflection');
    });
  });
});
