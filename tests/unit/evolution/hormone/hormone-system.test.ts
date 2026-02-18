/**
 * @file tests/unit/evolution/hormone/hormone-system.test.ts
 * @description HormoneSystem 单元测试
 * @author Ouroboros
 * @date 2026-02-18
 */

import { HormoneSystem } from '@/evolution/hormone/hormone-system';

describe('HormoneSystem', () => {
  describe('构造函数', () => {
    it('应该初始化所有激素', () => {
      const system = new HormoneSystem();
      const levels = system.getAllHormoneLevels();

      expect(levels.dopamine).toBeDefined();
      expect(levels.serotonin).toBeDefined();
      expect(levels.cortisol).toBeDefined();
      expect(levels.oxytocin).toBeDefined();
      expect(levels.norepinephrine).toBeDefined();
    });

    it('应该使用默认配置', () => {
      const system = new HormoneSystem();
      const levels = system.getAllHormoneLevels();

      // 检查基线值
      expect(levels.dopamine).toBe(0.5);
      expect(levels.serotonin).toBe(0.6);
    });

    it('应该接受自定义配置', () => {
      const system = new HormoneSystem({
        dopamine: {
          baseline: 0.7,
          decayRate: 0.01,
          halfLife: 300,
          maxValue: 1,
          minValue: 0,
        },
      });

      const levels = system.getAllHormoneLevels();
      expect(levels.dopamine).toBe(0.7);
    });
  });

  describe('start/stop', () => {
    it('应该启动系统', () => {
      const system = new HormoneSystem();
      system.start();

      expect(system.getIsRunning()).toBe(true);

      system.stop();
    });

    it('应该停止系统', () => {
      const system = new HormoneSystem();
      system.start();
      system.stop();

      expect(system.getIsRunning()).toBe(false);
    });
  });

  describe('getHormoneValue', () => {
    it('应该获取指定激素值', () => {
      const system = new HormoneSystem();
      const value = system.getHormoneValue('dopamine');

      expect(value).toBe(0.5);
    });

    it('应该抛出错误当激素类型无效', () => {
      const system = new HormoneSystem();

      expect(() => system.getHormoneValue('invalid' as any)).toThrow();
    });
  });

  describe('increaseHormone', () => {
    it('应该增加激素水平', () => {
      const system = new HormoneSystem();
      const newValue = system.increaseHormone('dopamine', 0.2);

      expect(newValue).toBe(0.7);
    });

    it('应该记录原因', () => {
      const system = new HormoneSystem();
      const newValue = system.increaseHormone('dopamine', 0.2, '完成任务');

      expect(newValue).toBe(0.7);
    });
  });

  describe('decreaseHormone', () => {
    it('应该减少激素水平', () => {
      const system = new HormoneSystem();
      const newValue = system.decreaseHormone('cortisol', 0.1);

      expect(newValue).toBe(0.1); // 基线0.2 - 0.1
    });
  });

  describe('setHormoneValue', () => {
    it('应该设置激素值', () => {
      const system = new HormoneSystem();
      const newValue = system.setHormoneValue('dopamine', 0.8);

      expect(newValue).toBe(0.8);
      expect(system.getHormoneValue('dopamine')).toBe(0.8);
    });
  });

  describe('fireTrigger', () => {
    it('应该触发并应用激素变化', () => {
      const system = new HormoneSystem();
      const initialDopamine = system.getHormoneValue('dopamine');

      // 触发任务成功
      const results = system.fireTrigger('task_success');

      // 验证触发器执行
      expect(results.length).toBeGreaterThan(0);
      const fired = results.filter((r) => r.fired);
      expect(fired.length).toBeGreaterThan(0);

      // 验证多巴胺增加
      const currentDopamine = system.getHormoneValue('dopamine');
      expect(currentDopamine).toBeGreaterThan(initialDopamine);
    });

    it('应该支持上下文', () => {
      const system = new HormoneSystem();

      const results = system.fireTrigger('task_success', {
        eventName: 'task_completed',
        data: { taskId: '123' },
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('应该触发多个效果', () => {
      const system = new HormoneSystem();
      const initialDopamine = system.getHormoneValue('dopamine');
      const initialSerotonin = system.getHormoneValue('serotonin');

      // 触发目标达成（有多种效果）
      system.fireTrigger('goal_achieved');

      expect(system.getHormoneValue('dopamine')).toBeGreaterThan(initialDopamine);
      expect(system.getHormoneValue('serotonin')).toBeGreaterThan(initialSerotonin);
    });
  });

  describe('getSnapshot', () => {
    it('应该返回激素快照', () => {
      const system = new HormoneSystem();
      const snapshot = system.getSnapshot();

      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.levels).toBeDefined();
      expect(snapshot.dominantHormone).toBeDefined();
      expect(snapshot.averageArousal).toBeDefined();
    });

    it('应该正确识别主导激素', () => {
      const system = new HormoneSystem();
      system.setHormoneValue('cortisol', 0.9);

      const snapshot = system.getSnapshot();

      expect(snapshot.dominantHormone).toBe('cortisol');
    });
  });

  describe('getEmotionalState', () => {
    it('应该返回情绪状态', () => {
      const system = new HormoneSystem();
      const state = system.getEmotionalState();

      expect(state.dominantEmotion).toBeDefined();
      expect(state.intensity).toBeGreaterThanOrEqual(0);
      expect(state.description).toBeDefined();
    });
  });

  describe('getEmotionLabel', () => {
    it('应该返回情绪标签', () => {
      const system = new HormoneSystem();
      const label = system.getEmotionLabel();

      expect(label).toBeDefined();
      expect(typeof label).toBe('string');
    });
  });

  describe('resetAllToBaseline', () => {
    it('应该重置所有激素', () => {
      const system = new HormoneSystem();
      system.setHormoneValue('dopamine', 0.9);
      system.setHormoneValue('cortisol', 0.8);

      system.resetAllToBaseline();

      expect(system.getHormoneValue('dopamine')).toBe(0.5);
      expect(system.getHormoneValue('cortisol')).toBe(0.2);
    });
  });

  describe('getTriggerEngine', () => {
    it('应该返回触发器引擎', () => {
      const system = new HormoneSystem();
      const engine = system.getTriggerEngine();

      expect(engine).toBeDefined();
      expect(engine.getAllTriggers().length).toBeGreaterThan(0);
    });
  });

  describe('序列化', () => {
    it('应该正确序列化和反序列化', () => {
      const system = new HormoneSystem();
      system.setHormoneValue('dopamine', 0.8);

      const json = system.toJSON();
      const restored = HormoneSystem.fromJSON(json as Parameters<typeof HormoneSystem.fromJSON>[0]);

      // 允许小范围浮点误差
      const value = restored.getHormoneValue('dopamine');
      expect(value).toBeGreaterThan(0.78);
      expect(value).toBeLessThanOrEqual(0.81);
    });
  });
});
