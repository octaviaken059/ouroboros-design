/**
 * @file tests/unit/evolution/hormone/trigger-engine-advanced.test.ts
 * @description TriggerEngine 高级测试 - 覆盖阈值/时间条件
 * @author Ouroboros
 * @date 2026-02-18
 */

import { TriggerEngine } from '@/evolution/hormone/trigger-engine';

describe('TriggerEngine 高级条件测试', () => {
  describe('阈值条件', () => {
    it('应该触发满足最小阈值的触发器', () => {
      const engine = new TriggerEngine();
      // 禁用默认触发器
      for (const t of engine.getAllTriggers()) {
        engine.disableTrigger(t.id);
      }

      const id = engine.registerTrigger({
        type: 'task_success',
        name: '高多巴胺触发器',
        condition: {
          type: 'threshold',
          hormone: 'dopamine',
          min: 0.7,
        },
        effects: [{ hormone: 'serotonin', delta: 0.1 }],
        cooldownMs: 0,
        enabled: true,
      });

      // 满足阈值条件
      const results = engine.fire('task_success', {
        hormoneLevels: {
          dopamine: 0.8,
          serotonin: 0.5,
          cortisol: 0.2,
          oxytocin: 0.4,
          norepinephrine: 0.3,
        },
      });

      const result = results.find((r) => r.triggerId === id);
      expect(result?.fired).toBe(true);
    });

    it('不应该触发不满足最小阈值的触发器', () => {
      const engine = new TriggerEngine();
      for (const t of engine.getAllTriggers()) {
        engine.disableTrigger(t.id);
      }

      const id = engine.registerTrigger({
        type: 'task_success',
        name: '高多巴胺触发器',
        condition: {
          type: 'threshold',
          hormone: 'dopamine',
          min: 0.7,
        },
        effects: [{ hormone: 'serotonin', delta: 0.1 }],
        cooldownMs: 0,
        enabled: true,
      });

      // 不满足阈值条件
      const results = engine.fire('task_success', {
        hormoneLevels: {
          dopamine: 0.5,
          serotonin: 0.5,
          cortisol: 0.2,
          oxytocin: 0.4,
          norepinephrine: 0.3,
        },
      });

      const result = results.find((r) => r.triggerId === id);
      expect(result?.fired).toBe(false);
      expect(result?.reason).toBe('条件不满足');
    });

    it('应该触发满足最大阈值的触发器', () => {
      const engine = new TriggerEngine();
      for (const t of engine.getAllTriggers()) {
        engine.disableTrigger(t.id);
      }

      const id = engine.registerTrigger({
        type: 'task_failure',
        name: '低血清素触发器',
        condition: {
          type: 'threshold',
          hormone: 'serotonin',
          max: 0.3,
        },
        effects: [{ hormone: 'cortisol', delta: 0.1 }],
        cooldownMs: 0,
        enabled: true,
      });

      const results = engine.fire('task_failure', {
        hormoneLevels: {
          dopamine: 0.5,
          serotonin: 0.2,
          cortisol: 0.2,
          oxytocin: 0.4,
          norepinephrine: 0.3,
        },
      });

      const result = results.find((r) => r.triggerId === id);
      expect(result?.fired).toBe(true);
    });

    it('不应该触发超过最大阈值的触发器', () => {
      const engine = new TriggerEngine();
      for (const t of engine.getAllTriggers()) {
        engine.disableTrigger(t.id);
      }

      const id = engine.registerTrigger({
        type: 'task_failure',
        name: '低血清素触发器',
        condition: {
          type: 'threshold',
          hormone: 'serotonin',
          max: 0.3,
        },
        effects: [{ hormone: 'cortisol', delta: 0.1 }],
        cooldownMs: 0,
        enabled: true,
      });

      const results = engine.fire('task_failure', {
        hormoneLevels: {
          dopamine: 0.5,
          serotonin: 0.5,
          cortisol: 0.2,
          oxytocin: 0.4,
          norepinephrine: 0.3,
        },
      });

      const result = results.find((r) => r.triggerId === id);
      expect(result?.fired).toBe(false);
    });

    it('应该处理min和max都定义的阈值范围', () => {
      const engine = new TriggerEngine();
      for (const t of engine.getAllTriggers()) {
        engine.disableTrigger(t.id);
      }

      const id = engine.registerTrigger({
        type: 'novelty',
        name: '中等皮质醇触发器',
        condition: {
          type: 'threshold',
          hormone: 'cortisol',
          min: 0.3,
          max: 0.7,
        },
        effects: [{ hormone: 'norepinephrine', delta: 0.1 }],
        cooldownMs: 0,
        enabled: true,
      });

      // 在范围内
      const results = engine.fire('novelty', {
        hormoneLevels: {
          dopamine: 0.5,
          serotonin: 0.5,
          cortisol: 0.5,
          oxytocin: 0.4,
          norepinephrine: 0.3,
        },
      });

      const result = results.find((r) => r.triggerId === id);
      expect(result?.fired).toBe(true);
    });

    it('当激素水平未提供时应该不触发', () => {
      const engine = new TriggerEngine();
      for (const t of engine.getAllTriggers()) {
        engine.disableTrigger(t.id);
      }

      const id = engine.registerTrigger({
        type: 'task_success',
        name: '阈值触发器',
        condition: {
          type: 'threshold',
          hormone: 'dopamine',
          min: 0.5,
        },
        effects: [{ hormone: 'serotonin', delta: 0.1 }],
        cooldownMs: 0,
        enabled: true,
      });

      const results = engine.fire('task_success', {});

      const result = results.find((r) => r.triggerId === id);
      expect(result?.fired).toBe(false);
    });
  });

  describe('事件条件', () => {
    it('应该触发匹配事件名称的触发器', () => {
      const engine = new TriggerEngine();
      for (const t of engine.getAllTriggers()) {
        engine.disableTrigger(t.id);
      }

      const id = engine.registerTrigger({
        type: 'social_interaction',
        name: '特定事件触发器',
        condition: {
          type: 'event',
          eventName: 'user_mentioned',
        },
        effects: [{ hormone: 'oxytocin', delta: 0.2 }],
        cooldownMs: 0,
        enabled: true,
      });

      const results = engine.fire('social_interaction', {
        eventName: 'user_mentioned',
      });

      const result = results.find((r) => r.triggerId === id);
      expect(result?.fired).toBe(true);
    });

    it('不应该触发不匹配事件名称的触发器', () => {
      const engine = new TriggerEngine();
      for (const t of engine.getAllTriggers()) {
        engine.disableTrigger(t.id);
      }

      const id = engine.registerTrigger({
        type: 'social_interaction',
        name: '特定事件触发器',
        condition: {
          type: 'event',
          eventName: 'user_mentioned',
        },
        effects: [{ hormone: 'oxytocin', delta: 0.2 }],
        cooldownMs: 0,
        enabled: true,
      });

      const results = engine.fire('social_interaction', {
        eventName: 'other_event',
      });

      const result = results.find((r) => r.triggerId === id);
      expect(result?.fired).toBe(false);
    });
  });

  describe('时间条件', () => {
    it('时间条件应该总是返回true', () => {
      const engine = new TriggerEngine();
      for (const t of engine.getAllTriggers()) {
        engine.disableTrigger(t.id);
      }

      const id = engine.registerTrigger({
        type: 'routine',
        name: '时间触发器',
        condition: {
          type: 'time',
          intervalMs: 60000,
        },
        effects: [{ hormone: 'dopamine', delta: 0.1 }],
        cooldownMs: 0,
        enabled: true,
      });

      const results = engine.fire('routine');

      const result = results.find((r) => r.triggerId === id);
      expect(result?.fired).toBe(true);
    });
  });

  describe('触发器恢复', () => {
    it('应该从JSON恢复触发器引擎', () => {
      const engine = new TriggerEngine();
      const id = engine.registerTrigger({
        type: 'task_success',
        name: '恢复测试触发器',
        condition: { type: 'immediate' },
        effects: [{ hormone: 'dopamine', delta: 0.2 }],
        cooldownMs: 5000,
        enabled: true,
      });

      const json = engine.toJSON();
      const restored = TriggerEngine.fromJSON(json as Parameters<typeof TriggerEngine.fromJSON>[0]);

      const trigger = restored.getTrigger(id);
      expect(trigger).toBeDefined();
      expect(trigger?.name).toBe('恢复测试触发器');
    });
  });
});
