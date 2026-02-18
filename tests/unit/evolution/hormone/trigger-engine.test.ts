/**
 * @file tests/unit/evolution/hormone/trigger-engine.test.ts
 * @description TriggerEngine 单元测试
 * @author Ouroboros
 * @date 2026-02-18
 */

import { TriggerEngine } from '@/evolution/hormone/trigger-engine';

describe('TriggerEngine', () => {
  describe('构造函数', () => {
    it('应该自动注册默认触发器', () => {
      const engine = new TriggerEngine();
      const triggers = engine.getAllTriggers();

      expect(triggers.length).toBeGreaterThan(0);
    });
  });

  describe('registerTrigger', () => {
    it('应该注册新触发器', () => {
      const engine = new TriggerEngine();
      const id = engine.registerTrigger({
        type: 'task_success',
        name: '测试触发器',
        condition: { type: 'immediate' },
        effects: [{ hormone: 'dopamine', delta: 0.3 }],
        cooldownMs: 5000,
        enabled: true,
      });

      expect(id).toBeDefined();
      expect(engine.getTrigger(id)).toBeDefined();
    });

    it('应该拒绝无效名称', () => {
      const engine = new TriggerEngine();

      expect(() =>
        engine.registerTrigger({
          type: 'task_success',
          name: '',
          condition: { type: 'immediate' },
          effects: [{ hormone: 'dopamine', delta: 0.3 }],
          cooldownMs: 5000,
          enabled: true,
        })
      ).toThrow('触发器名称不能为空');
    });

    it('应该拒绝空效果列表', () => {
      const engine = new TriggerEngine();

      expect(() =>
        engine.registerTrigger({
          type: 'task_success',
          name: '测试',
          condition: { type: 'immediate' },
          effects: [],
          cooldownMs: 5000,
          enabled: true,
        })
      ).toThrow('触发器必须至少有一个效果');
    });

    it('应该拒绝无效激素变化量', () => {
      const engine = new TriggerEngine();

      expect(() =>
        engine.registerTrigger({
          type: 'task_success',
          name: '测试',
          condition: { type: 'immediate' },
          effects: [{ hormone: 'dopamine', delta: 1.5 }],
          cooldownMs: 5000,
          enabled: true,
        })
      ).toThrow('激素变化量必须在 -1 到 1 之间');
    });
  });

  describe('unregisterTrigger', () => {
    it('应该注销触发器', () => {
      const engine = new TriggerEngine();
      const id = engine.registerTrigger({
        type: 'task_success',
        name: '测试',
        condition: { type: 'immediate' },
        effects: [{ hormone: 'dopamine', delta: 0.3 }],
        cooldownMs: 5000,
        enabled: true,
      });

      const result = engine.unregisterTrigger(id);

      expect(result).toBe(true);
      expect(engine.getTrigger(id)).toBeUndefined();
    });

    it('应该返回false当触发器不存在', () => {
      const engine = new TriggerEngine();
      const result = engine.unregisterTrigger('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getTriggersByType', () => {
    it('应该获取指定类型的触发器', () => {
      const engine = new TriggerEngine();
      const triggers = engine.getTriggersByType('task_success');

      expect(triggers.length).toBeGreaterThan(0);
      expect(triggers.every((t) => t.type === 'task_success')).toBe(true);
    });

    it('应该返回空数组当类型不存在', () => {
      const engine = new TriggerEngine();
      // 先清空所有触发器
      const allTriggers = engine.getAllTriggers();
      for (const t of allTriggers) {
        engine.unregisterTrigger(t.id);
      }

      const triggers = engine.getTriggersByType('task_success');
      expect(triggers).toEqual([]);
    });
  });

  describe('enable/disableTrigger', () => {
    it('应该启用触发器', () => {
      const engine = new TriggerEngine();
      const id = engine.registerTrigger({
        type: 'task_success',
        name: '测试',
        condition: { type: 'immediate' },
        effects: [{ hormone: 'dopamine', delta: 0.3 }],
        cooldownMs: 5000,
        enabled: false,
      });

      const result = engine.enableTrigger(id);

      expect(result).toBe(true);
      expect(engine.getTrigger(id)?.enabled).toBe(true);
    });

    it('应该禁用触发器', () => {
      const engine = new TriggerEngine();
      const id = engine.registerTrigger({
        type: 'task_success',
        name: '测试',
        condition: { type: 'immediate' },
        effects: [{ hormone: 'dopamine', delta: 0.3 }],
        cooldownMs: 5000,
        enabled: true,
      });

      const result = engine.disableTrigger(id);

      expect(result).toBe(true);
      expect(engine.getTrigger(id)?.enabled).toBe(false);
    });
  });

  describe('fire', () => {
    it('应该触发触发器并返回结果', () => {
      const engine = new TriggerEngine();

      // 确保有启用的触发器
      engine.registerTrigger({
        type: 'task_success',
        name: '测试触发器',
        condition: { type: 'immediate' },
        effects: [{ hormone: 'dopamine', delta: 0.3 }],
        cooldownMs: 0, // 无冷却
        enabled: true,
      });

      const results = engine.fire('task_success');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.fired)).toBe(true);
    });

    it('应该尊重冷却时间', () => {
      const engine = new TriggerEngine();
      const id = engine.registerTrigger({
        type: 'task_success',
        name: '测试触发器',
        condition: { type: 'immediate' },
        effects: [{ hormone: 'dopamine', delta: 0.3 }],
        cooldownMs: 10000, // 10秒冷却
        enabled: true,
      });

      // 第一次触发
      const results1 = engine.fire('task_success');
      expect(results1.some((r) => r.fired)).toBe(true);

      // 立即再次触发（应该在冷却中）
      const results2 = engine.fire('task_success');
      const notFired = results2.find((r) => r.triggerId === id && !r.fired);
      expect(notFired).toBeDefined();
      expect(notFired?.reason).toContain('冷却中');
    });

    it('不应该触发禁用的触发器', () => {
      const engine = new TriggerEngine();
      // 先禁用所有默认触发器
      for (const t of engine.getAllTriggers()) {
        engine.disableTrigger(t.id);
      }

      const id = engine.registerTrigger({
        type: 'task_success',
        name: '测试触发器',
        condition: { type: 'immediate' },
        effects: [{ hormone: 'dopamine', delta: 0.3 }],
        cooldownMs: 0,
        enabled: false,
      });

      const results = engine.fire('task_success');
      const disabledResult = results.find((r) => r.triggerId === id);

      expect(disabledResult?.fired).toBe(false);
      expect(disabledResult?.reason).toBe('触发器已禁用');
    });
  });

  describe('序列化', () => {
    it('应该正确序列化和反序列化', () => {
      const engine = new TriggerEngine();
      const id = engine.registerTrigger({
        type: 'task_success',
        name: '测试触发器',
        condition: { type: 'immediate' },
        effects: [{ hormone: 'dopamine', delta: 0.3 }],
        cooldownMs: 5000,
        enabled: true,
      });

      const json = engine.toJSON();
      const restored = TriggerEngine.fromJSON(json as Parameters<typeof TriggerEngine.fromJSON>[0]);

      expect(restored.getTrigger(id)).toBeDefined();
      expect(restored.getTrigger(id)?.name).toBe('测试触发器');
    });
  });
});
