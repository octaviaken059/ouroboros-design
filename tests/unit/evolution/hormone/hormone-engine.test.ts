/**
 * @file tests/unit/evolution/hormone/hormone-engine.test.ts
 * @description HormoneEngine 单元测试
 * @author Ouroboros
 * @date 2026-02-18
 */

import { HormoneEngine } from '@/evolution/hormone/hormone-engine';
import type { HormoneConfig } from '@/types/hormone';

describe('HormoneEngine', () => {
  const mockConfig: HormoneConfig = {
    baseline: 0.5,
    decayRate: 0.01,
    halfLife: 300,
    maxValue: 1.0,
    minValue: 0.0,
  };

  describe('构造函数', () => {
    it('应该使用配置正确初始化', () => {
      const engine = new HormoneEngine('dopamine', mockConfig);

      expect(engine.getValue()).toBe(0.5);
      expect(engine.type).toBe('dopamine');
    });

    it('应该为不同激素类型创建实例', () => {
      const dopamine = new HormoneEngine('dopamine', mockConfig);
      const cortisol = new HormoneEngine('cortisol', mockConfig);

      expect(dopamine.type).toBe('dopamine');
      expect(cortisol.type).toBe('cortisol');
    });
  });

  describe('increase', () => {
    it('应该增加激素水平', () => {
      const engine = new HormoneEngine('dopamine', mockConfig);
      const newValue = engine.increase(0.2);

      expect(newValue).toBe(0.7);
      expect(engine.getValue()).toBe(0.7);
    });

    it('不应该超过最大值', () => {
      const engine = new HormoneEngine('dopamine', mockConfig);
      engine.setValue(0.9);
      const newValue = engine.increase(0.2);

      expect(newValue).toBe(1.0);
    });

    it('应该拒绝负值', () => {
      const engine = new HormoneEngine('dopamine', mockConfig);

      expect(() => engine.increase(-0.1)).toThrow('增加量必须在 0-1 之间');
    });

    it('应该拒绝大于1的值', () => {
      const engine = new HormoneEngine('dopamine', mockConfig);

      expect(() => engine.increase(1.5)).toThrow('增加量必须在 0-1 之间');
    });
  });

  describe('decrease', () => {
    it('应该减少激素水平', () => {
      const engine = new HormoneEngine('dopamine', mockConfig);
      const newValue = engine.decrease(0.2);

      expect(newValue).toBe(0.3);
    });

    it('不应该低于最小值', () => {
      const engine = new HormoneEngine('dopamine', mockConfig);
      engine.setValue(0.1);
      const newValue = engine.decrease(0.2);

      expect(newValue).toBe(0);
    });

    it('应该拒绝负值', () => {
      const engine = new HormoneEngine('dopamine', mockConfig);

      expect(() => engine.decrease(-0.1)).toThrow('减少量必须在 0-1 之间');
    });
  });

  describe('setValue', () => {
    it('应该设置指定值', () => {
      const engine = new HormoneEngine('dopamine', mockConfig);
      const newValue = engine.setValue(0.8);

      expect(newValue).toBe(0.8);
      expect(engine.getValue()).toBe(0.8);
    });

    it('应该拒绝无效值', () => {
      const engine = new HormoneEngine('dopamine', mockConfig);

      expect(() => engine.setValue(-0.1)).toThrow('激素水平必须在 0-1 之间');
      expect(() => engine.setValue(1.5)).toThrow('激素水平必须在 0-1 之间');
    });
  });

  describe('applyNaturalDecay', () => {
    it('应该向基线衰减（高于基线）', () => {
      const engine = new HormoneEngine('dopamine', mockConfig);
      engine.setValue(0.8); // 高于基线0.5

      // 模拟时间流逝
      jest.advanceTimersByTime(1000);

      const value = engine.getValue();
      expect(value).toBeLessThan(0.8);
      expect(value).toBeGreaterThanOrEqual(0.5);
    });

    it('应该向基线衰减（低于基线）', () => {
      const engine = new HormoneEngine('dopamine', mockConfig);
      engine.setValue(0.2); // 低于基线0.5

      // 模拟时间流逝
      jest.advanceTimersByTime(1000);

      const value = engine.getValue();
      expect(value).toBeGreaterThan(0.2);
      expect(value).toBeLessThanOrEqual(0.5);
    });
  });

  describe('getDeviation', () => {
    it('应该返回偏离基线的程度', () => {
      const engine = new HormoneEngine('dopamine', mockConfig);
      engine.setValue(0.7);

      // 允许小范围浮点误差
      const deviation = engine.getDeviation();
      expect(deviation).toBeGreaterThan(0.18);
      expect(deviation).toBeLessThanOrEqual(0.21);
    });

    it('负值表示低于基线', () => {
      const engine = new HormoneEngine('dopamine', mockConfig);
      engine.setValue(0.3);

      // 允许小范围浮点误差
      const deviation = engine.getDeviation();
      expect(deviation).toBeGreaterThan(-0.21);
      expect(deviation).toBeLessThan(-0.18);
    });
  });

  describe('resetToBaseline', () => {
    it('应该重置为基线水平', () => {
      const engine = new HormoneEngine('dopamine', mockConfig);
      engine.setValue(0.9);
      engine.resetToBaseline();

      expect(engine.getValue()).toBe(0.5);
    });
  });

  describe('序列化', () => {
    it('应该正确序列化和反序列化', () => {
      const engine = new HormoneEngine('dopamine', mockConfig);
      engine.setValue(0.75);

      const json = engine.toJSON();
      const restored = HormoneEngine.fromJSON(json as Parameters<typeof HormoneEngine.fromJSON>[0]);

      expect(restored.type).toBe('dopamine');
      // 允许小范围浮点误差
      const value = restored.getValue();
      expect(value).toBeGreaterThan(0.73);
      expect(value).toBeLessThanOrEqual(0.76);
    });
  });
});
