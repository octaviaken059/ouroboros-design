/**
 * @file tests/unit/evolution/hormone/hormone-system-advanced.test.ts
 * @description HormoneSystem 高级测试 - 提高分支覆盖率
 * @author Ouroboros
 * @date 2026-02-18
 */

import { HormoneSystem } from '@/evolution/hormone/hormone-system';

describe('HormoneSystem 高级测试', () => {
  describe('边界条件', () => {
    it('应该处理激素水平边界值', () => {
      const system = new HormoneSystem();

      // 测试边界值0
      system.setHormoneValue('dopamine', 0);
      expect(system.getHormoneValue('dopamine')).toBe(0);

      // 测试边界值1
      system.setHormoneValue('dopamine', 1);
      expect(system.getHormoneValue('dopamine')).toBe(1);
    });

    it('应该正确处理applyHormoneChanges', () => {
      const system = new HormoneSystem();
      system.setHormoneValue('dopamine', 0.5);
      system.setHormoneValue('cortisol', 0.5);

      system.applyHormoneChanges([
        { hormone: 'dopamine', delta: 0.2, reason: '奖励' },
        { hormone: 'cortisol', delta: -0.2, reason: '放松' },
        { hormone: 'serotonin', delta: 0, reason: '无变化' },
      ]);

      expect(system.getHormoneValue('dopamine')).toBe(0.7);
      expect(system.getHormoneValue('cortisol')).toBe(0.3);
    });
  });

  describe('序列化与恢复', () => {
    it('应该完整序列化和恢复激素系统', () => {
      const system = new HormoneSystem();
      system.setHormoneValue('dopamine', 0.8);
      system.setHormoneValue('cortisol', 0.3);
      system.setHormoneValue('serotonin', 0.7);

      const json = system.toJSON();
      const restored = HormoneSystem.fromJSON(json as Parameters<typeof HormoneSystem.fromJSON>[0]);

      // 验证激素水平
      expect(restored.getHormoneValue('dopamine')).toBeGreaterThan(0.78);
      expect(restored.getHormoneValue('dopamine')).toBeLessThanOrEqual(0.81);

      // 验证触发器引擎已恢复
      expect(restored.getTriggerEngine().getAllTriggers().length).toBeGreaterThan(0);
    });

    it('应该保持衰减配置', () => {
      const system = new HormoneSystem({
        decayIntervalMs: 2000,
        dopamine: {
          baseline: 0.6,
          decayRate: 0.002,
          halfLife: 400,
          maxValue: 1,
          minValue: 0,
        },
      });

      const json = system.toJSON();
      const restored = HormoneSystem.fromJSON(json as Parameters<typeof HormoneSystem.fromJSON>[0]);

      // 验证基线值已恢复
      restored.resetAllToBaseline();
      expect(restored.getHormoneValue('dopamine')).toBe(0.6);
    });
  });

  describe('运行状态管理', () => {
    it('重复启动不应出错', () => {
      const system = new HormoneSystem();
      system.start();
      system.start(); // 重复启动
      expect(system.getIsRunning()).toBe(true);
      system.stop();
    });

    it('重复停止不应出错', () => {
      const system = new HormoneSystem();
      system.start();
      system.stop();
      system.stop(); // 重复停止
      expect(system.getIsRunning()).toBe(false);
    });
  });

  describe('触发器上下文', () => {
    it('应该传递完整上下文到触发器', () => {
      const system = new HormoneSystem();
      system.setHormoneValue('dopamine', 0.9);

      const results = system.fireTrigger('task_success', {
        eventName: 'task_completed',
        data: { taskId: '123', success: true },
      });

      expect(results.length).toBeGreaterThan(0);
      // 验证触发器成功触发
      expect(results.some((r) => r.fired)).toBe(true);
    });

    it('应该触发后更新激素水平', () => {
      const system = new HormoneSystem();
      const initialDopamine = system.getHormoneValue('dopamine');
      const initialSerotonin = system.getHormoneValue('serotonin');

      // 触发任务成功（默认会增加多巴胺和血清素）
      system.fireTrigger('task_success');

      expect(system.getHormoneValue('dopamine')).toBeGreaterThan(initialDopamine);
      expect(system.getHormoneValue('serotonin')).toBeGreaterThan(initialSerotonin);
    });
  });

  describe('情绪状态生成', () => {
    it('应该为不同激素水平生成不同情绪', () => {
      const system = new HormoneSystem();

      // 高皮质醇状态
      system.setHormoneValue('cortisol', 0.9);
      system.setHormoneValue('dopamine', 0.2);
      const stressedState = system.getEmotionalState();

      expect(stressedState.dominantEmotion).toContain('压力');

      // 高多巴胺状态
      system.setHormoneValue('cortisol', 0.2);
      system.setHormoneValue('dopamine', 0.9);
      const motivatedState = system.getEmotionalState();

      expect(motivatedState.dominantEmotion).toContain('兴奋');
    });

    it('应该生成情绪标签', () => {
      const system = new HormoneSystem();
      system.setHormoneValue('dopamine', 0.9);
      system.setHormoneValue('serotonin', 0.8);

      const label = system.getEmotionLabel();

      expect(label).toBeDefined();
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });
  });

  describe('激素快照', () => {
    it('应该生成完整的激素快照', () => {
      const system = new HormoneSystem();
      system.setHormoneValue('dopamine', 0.8);
      system.setHormoneValue('cortisol', 0.9);

      const snapshot = system.getSnapshot();

      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.levels.dopamine).toBeGreaterThan(0.78);
      expect(snapshot.levels.dopamine).toBeLessThanOrEqual(0.81);
      expect(snapshot.dominantHormone).toBe('cortisol'); // 皮质醇最高
      expect(snapshot.averageArousal).toBeGreaterThan(0);
    });
  });
});
