/**
 * @fileoverview 激素系统单元测试
 * @module tests/unit/embodiment/hormone-system.test
 */

import {
  HormoneSystem,
  HormoneType,
  HormoneState,
  HormoneConfig,
  HormonalEffects,
  BehavioralAdvice,
  HORMONE_CONFIGS,
  hormoneSystem,
} from '../../../src/embodiment/hormone-system';

describe('HormoneSystem', () => {
  let system: HormoneSystem;

  beforeEach(() => {
    system = new HormoneSystem();
  });

  afterEach(() => {
    system.stopAutoDecay();
  });

  // ==================== 构造与初始化测试 ====================
  describe('Constructor & Initialization', () => {
    it('应使用默认状态创建实例', () => {
      const state = system.getState();
      expect(state.adrenaline).toBe(0.1);
      expect(state.cortisol).toBe(0.1);
      expect(state.dopamine).toBe(0.5);
      expect(state.serotonin).toBe(0.5);
      expect(state.curiosity).toBe(0.5);
    });

    it('应支持自定义初始状态', () => {
      const customSystem = new HormoneSystem({
        adrenaline: 0.5,
        dopamine: 0.8,
      });
      
      const state = customSystem.getState();
      expect(state.adrenaline).toBe(0.5);
      expect(state.dopamine).toBe(0.8);
      // 未指定的应使用默认值
      expect(state.cortisol).toBe(0.1);
    });

    it('应使用默认配置', () => {
      const defaultSystem = new HormoneSystem();
      expect(defaultSystem).toBeInstanceOf(HormoneSystem);
    });

    it('单例应返回HormoneSystem实例', () => {
      expect(hormoneSystem).toBeInstanceOf(HormoneSystem);
    });
  });

  // ==================== 状态获取测试 ====================
  describe('State Retrieval', () => {
    it('应返回当前激素状态', () => {
      const state = system.getState();
      
      expect(state).toHaveProperty('adrenaline');
      expect(state).toHaveProperty('cortisol');
      expect(state).toHaveProperty('dopamine');
      expect(state).toHaveProperty('serotonin');
      expect(state).toHaveProperty('curiosity');
    });

    it('应返回状态副本', () => {
      const state1 = system.getState();
      const state2 = system.getState();
      
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // 不同对象
    });

    it('应获取特定激素水平', () => {
      expect(system.getLevel(HormoneType.ADRENALINE)).toBe(0.1);
      expect(system.getLevel(HormoneType.DOPAMINE)).toBe(0.5);
    });
  });

  // ==================== 激素调整测试 ====================
  describe('Hormone Adjustment', () => {
    it('应增加激素水平', () => {
      const initialLevel = system.getLevel(HormoneType.ADRENALINE);
      system.adjust(HormoneType.ADRENALINE, 0.3, 'test');
      
      expect(system.getLevel(HormoneType.ADRENALINE)).toBe(initialLevel + 0.3);
    });

    it('应减少激素水平', () => {
      system.setLevel(HormoneType.DOPAMINE, 0.8, 'test');
      system.adjust(HormoneType.DOPAMINE, -0.2, 'test');
      
      expect(system.getLevel(HormoneType.DOPAMINE)).toBeCloseTo(0.6, 10);
    });

    it('应将激素水平限制在最大值', () => {
      system.adjust(HormoneType.ADRENALINE, 2.0, 'test');
      
      expect(system.getLevel(HormoneType.ADRENALINE)).toBe(1.0);
    });

    it('应将激素水平限制在最小值', () => {
      system.adjust(HormoneType.ADRENALINE, -0.5, 'test');
      
      expect(system.getLevel(HormoneType.ADRENALINE)).toBe(0.0);
    });

    it('应保留最小好奇心水平', () => {
      system.adjust(HormoneType.CURIOSITY, -1.0, 'test');
      
      expect(system.getLevel(HormoneType.CURIOSITY)).toBe(0.1);
    });

    it('应记录调整历史', () => {
      system.adjust(HormoneType.ADRENALINE, 0.3, 'stressful event');
      
      const history = system.getHistory(HormoneType.ADRENALINE, 10);
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].reason).toBe('stressful event');
    });
  });

  // ==================== 直接设置测试 ====================
  describe('Direct Level Setting', () => {
    it('应直接设置激素水平', () => {
      system.setLevel(HormoneType.SEROTONIN, 0.8, 'test');
      
      expect(system.getLevel(HormoneType.SEROTONIN)).toBe(0.8);
    });

    it('设置时应限制在有效范围', () => {
      system.setLevel(HormoneType.CORTISOL, 1.5, 'test');
      expect(system.getLevel(HormoneType.CORTISOL)).toBe(1.0);
      
      system.setLevel(HormoneType.CORTISOL, -0.5, 'test');
      expect(system.getLevel(HormoneType.CORTISOL)).toBe(0.0);
    });

    it('应记录设置历史', () => {
      system.setLevel(HormoneType.DOPAMINE, 0.9, 'reward');
      
      const history = system.getHistory(HormoneType.DOPAMINE, 10);
      const lastEntry = history[history.length - 1];
      expect(lastEntry.reason).toContain('reward');
    });
  });

  // ==================== 触发器测试 ====================
  describe('Hormone Triggers', () => {
    it('应触发肾上腺素', () => {
      system.triggerAdrenaline('emergency', 0.4);
      
      expect(system.getLevel(HormoneType.ADRENALINE)).toBe(0.5); // 0.1 + 0.4
    });

    it('肾上腺素应抑制皮质醇', () => {
      system.setLevel(HormoneType.CORTISOL, 0.5, 'test');
      system.triggerAdrenaline('emergency', 0.3);
      
      expect(system.getLevel(HormoneType.CORTISOL)).toBe(0.4); // 0.5 - 0.1
    });

    it('应触发皮质醇', () => {
      system.triggerCortisol('resource shortage', 0.3);
      
      expect(system.getLevel(HormoneType.CORTISOL)).toBe(0.4); // 0.1 + 0.3
    });

    it('皮质醇应降低多巴胺和好奇心', () => {
      system.setLevel(HormoneType.DOPAMINE, 0.5, 'test');
      system.setLevel(HormoneType.CURIOSITY, 0.5, 'test');
      
      system.triggerCortisol('stress', 0.3);
      
      expect(system.getLevel(HormoneType.DOPAMINE)).toBe(0.45); // 0.5 - 0.05
      expect(system.getLevel(HormoneType.CURIOSITY)).toBe(0.4); // 0.5 - 0.1
    });

    it('应触发多巴胺', () => {
      system.triggerDopamine('success', 0.3);
      
      expect(system.getLevel(HormoneType.DOPAMINE)).toBe(0.8); // 0.5 + 0.3
    });

    it('多巴胺应提升血清素', () => {
      system.setLevel(HormoneType.SEROTONIN, 0.5, 'test');
      system.triggerDopamine('success', 0.2);
      
      expect(system.getLevel(HormoneType.SEROTONIN)).toBe(0.55); // 0.5 + 0.05
    });

    it('应触发血清素', () => {
      system.triggerSerotonin('stable running', 0.2);
      
      expect(system.getLevel(HormoneType.SEROTONIN)).toBe(0.7); // 0.5 + 0.2
    });

    it('血清素应降低压力激素', () => {
      system.setLevel(HormoneType.ADRENALINE, 0.5, 'test');
      system.setLevel(HormoneType.CORTISOL, 0.5, 'test');
      
      system.triggerSerotonin('calm', 0.2);
      
      expect(system.getLevel(HormoneType.ADRENALINE)).toBe(0.45); // 0.5 - 0.05
      expect(system.getLevel(HormoneType.CORTISOL)).toBe(0.45); // 0.5 - 0.05
    });

    it('应触发好奇心', () => {
      system.triggerCuriosity('new discovery', 0.2);
      
      expect(system.getLevel(HormoneType.CURIOSITY)).toBe(0.7); // 0.5 + 0.2
    });

    it('好奇心应提升多巴胺', () => {
      system.setLevel(HormoneType.DOPAMINE, 0.5, 'test');
      system.triggerCuriosity('interesting', 0.2);
      
      expect(system.getLevel(HormoneType.DOPAMINE)).toBe(0.55); // 0.5 + 0.05
    });

    it('应使用默认强度触发', () => {
      system.triggerAdrenaline('default test');
      expect(system.getLevel(HormoneType.ADRENALINE)).toBeGreaterThan(0.1);
    });
  });

  // ==================== 衰减测试 ====================
  describe('Decay Mechanism', () => {
    it('应应用自然衰减', () => {
      system.setLevel(HormoneType.ADRENALINE, 0.8, 'test');
      system.applyDecay();
      
      // 肾上腺素应衰减向基准值
      expect(system.getLevel(HormoneType.ADRENALINE)).toBeLessThan(0.8);
    });

    it('衰减应趋向基准值', () => {
      // 高于基准值应下降
      system.setLevel(HormoneType.ADRENALINE, 0.8, 'test');
      system.applyDecay();
      expect(system.getLevel(HormoneType.ADRENALINE)).toBeLessThan(0.8);
      
      // 低于基准值应上升
      system.setLevel(HormoneType.ADRENALINE, 0.05, 'test');
      system.applyDecay();
      expect(system.getLevel(HormoneType.ADRENALINE)).toBeGreaterThan(0.05);
    });

    it('不同激素应有不同衰减率', () => {
      // 肾上腺素衰减快
      expect(HORMONE_CONFIGS.adrenaline.decayRate).toBeGreaterThan(
        HORMONE_CONFIGS.serotonin.decayRate
      );
    });
  });

  // ==================== 自动衰减测试 ====================
  describe('Auto Decay', () => {
    it('应启动自动衰减', () => {
      system.startAutoDecay(100);
      expect(system).toBeDefined();
    });

    it('应停止自动衰减', () => {
      system.startAutoDecay(100);
      system.stopAutoDecay();
      expect(system).toBeDefined();
    });
  });

  // ==================== 效果计算测试 ====================
  describe('Effect Calculations', () => {
    it('应计算激素影响效果', () => {
      const effects = system.getEffects();
      
      expect(typeof effects.focusBoost).toBe('number');
      expect(typeof effects.energySaving).toBe('number');
      expect(typeof effects.explorationDrive).toBe('number');
      expect(typeof effects.emotionalStability).toBe('number');
      expect(typeof effects.learningRate).toBe('number');
    });

    it('高肾上腺素应提升专注度', () => {
      system.setLevel(HormoneType.ADRENALINE, 0.8, 'test');
      
      const effects = system.getEffects();
      expect(effects.focusBoost).toBeGreaterThan(0.5);
    });

    it('高皮质醇应增加节能模式', () => {
      system.setLevel(HormoneType.CORTISOL, 0.9, 'test');
      
      const effects = system.getEffects();
      expect(effects.energySaving).toBeGreaterThan(0.8);
    });

    it('高好奇心和多巴胺应提升探索驱动力', () => {
      system.setLevel(HormoneType.CURIOSITY, 0.8, 'test');
      system.setLevel(HormoneType.DOPAMINE, 0.8, 'test');
      
      const effects = system.getEffects();
      expect(effects.explorationDrive).toBeGreaterThan(0.5);
    });

    it('效果值应在0-1范围', () => {
      const effects = system.getEffects();
      
      for (const [key, value] of Object.entries(effects)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    });
  });

  // ==================== 行为建议测试 ====================
  describe('Behavioral Advice', () => {
    it('应生成行为建议', () => {
      const advice = system.getBehavioralAdvice();
      expect(Array.isArray(advice)).toBe(true);
    });

    it('高肾上腺素应生成紧急响应建议', () => {
      system.setLevel(HormoneType.ADRENALINE, 0.8, 'test');
      
      const advice = system.getBehavioralAdvice();
      const criticalAdvice = advice.find(a => 
        a.hormone === HormoneType.ADRENALINE && a.priority === 'critical'
      );
      expect(criticalAdvice).toBeDefined();
    });

    it('高皮质醇应生成节能建议', () => {
      system.setLevel(HormoneType.CORTISOL, 0.8, 'test');
      
      const advice = system.getBehavioralAdvice();
      const highAdvice = advice.find(a => 
        a.hormone === HormoneType.CORTISOL && a.priority === 'high'
      );
      expect(highAdvice).toBeDefined();
    });

    it('低多巴胺应生成动力建议', () => {
      system.setLevel(HormoneType.DOPAMINE, 0.1, 'test');
      
      const advice = system.getBehavioralAdvice();
      const dopamineAdvice = advice.find(a => a.hormone === HormoneType.DOPAMINE
      );
      expect(dopamineAdvice).toBeDefined();
      expect(dopamineAdvice!.message).toContain('动力');
    });

    it('应按优先级排序建议', () => {
      system.setLevel(HormoneType.ADRENALINE, 0.8, 'test');
      system.setLevel(HormoneType.CORTISOL, 0.8, 'test');
      
      const advice = system.getBehavioralAdvice();
      
      // 关键优先级应在前
      const priorities = advice.map(a => a.priority);
      const criticalIndex = priorities.indexOf('critical');
      const lowIndex = priorities.indexOf('low');
      
      if (criticalIndex !== -1 && lowIndex !== -1) {
        expect(criticalIndex).toBeLessThan(lowIndex);
      }
    });
  });

  // ==================== 任务建议测试 ====================
  describe('Task Recommendations', () => {
    it('应生成任务建议', () => {
      const recommendation = system.getTaskRecommendation();
      
      expect(typeof recommendation.shouldAcceptTask).toBe('boolean');
      expect(Array.isArray(recommendation.preferredTaskTypes)).toBe(true);
      expect(Array.isArray(recommendation.avoidTaskTypes)).toBe(true);
    });

    it('高皮质醇时不应接受新任务', () => {
      system.setLevel(HormoneType.CORTISOL, 0.9, 'test');
      
      const recommendation = system.getTaskRecommendation();
      expect(recommendation.shouldAcceptTask).toBe(false);
      expect(recommendation.avoidTaskTypes).toContain('complex');
    });

    it('高肾上腺素时应推荐关键任务', () => {
      system.setLevel(HormoneType.ADRENALINE, 0.8, 'test');
      
      const recommendation = system.getTaskRecommendation();
      expect(recommendation.preferredTaskTypes).toContain('critical');
    });

    it('高好奇心时应推荐探索任务', () => {
      system.setLevel(HormoneType.CURIOSITY, 0.8, 'test');
      
      const recommendation = system.getTaskRecommendation();
      expect(recommendation.preferredTaskTypes).toContain('exploration');
    });
  });

  // ==================== 历史记录测试 ====================
  describe('History Tracking', () => {
    it('应记录激素历史', () => {
      system.adjust(HormoneType.ADRENALINE, 0.2, 'event 1');
      system.adjust(HormoneType.ADRENALINE, 0.1, 'event 2');
      
      const history = system.getHistory(HormoneType.ADRENALINE, 10);
      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    it('应按类型过滤历史', () => {
      system.adjust(HormoneType.ADRENALINE, 0.2, 'adrenaline event');
      system.adjust(HormoneType.DOPAMINE, 0.2, 'dopamine event');
      
      const adrenalineHistory = system.getHistory(HormoneType.ADRENALINE, 10);
      expect(adrenalineHistory.every(h => h.type === HormoneType.ADRENALINE)).toBe(true);
    });

    it('应限制历史记录数量', () => {
      for (let i = 0; i < 20; i++) {
        system.adjust(HormoneType.ADRENALINE, 0.01, `event ${i}`);
      }
      
      const history = system.getHistory(HormoneType.ADRENALINE, 5);
      expect(history.length).toBeLessThanOrEqual(5);
    });
  });

  // ==================== 趋势分析测试 ====================
  describe('Trend Analysis', () => {
    it('应分析激素趋势', () => {
      const trend = system.getTrend(HormoneType.ADRENALINE, 10);
      expect(['rising', 'falling', 'stable']).toContain(trend);
    });

    it('历史不足时应返回稳定', () => {
      const newSystem = new HormoneSystem();
      const trend = newSystem.getTrend(HormoneType.ADRENALINE, 10);
      expect(trend).toBe('stable');
    });
  });

  // ==================== 重置功能测试 ====================
  describe('Reset Functionality', () => {
    it('应重置所有激素到默认值', () => {
      system.setLevel(HormoneType.ADRENALINE, 0.9, 'test');
      system.setLevel(HormoneType.DOPAMINE, 0.9, 'test');
      
      system.reset('test reset');
      
      expect(system.getLevel(HormoneType.ADRENALINE)).toBe(0.1);
      expect(system.getLevel(HormoneType.DOPAMINE)).toBe(0.5);
      expect(system.getLevel(HormoneType.CURIOSITY)).toBe(0.3);
    });
  });

  // ==================== 序列化测试 ====================
  describe('Serialization', () => {
    it('应序列化状态', () => {
      const serialized = system.serialize();
      
      expect(serialized).toHaveProperty('state');
      expect(serialized).toHaveProperty('timestamp');
      expect(serialized.state).toHaveProperty('adrenaline');
    });

    it('应反序列化状态', () => {
      system.setLevel(HormoneType.DOPAMINE, 0.9, 'test');
      const serialized = system.serialize();
      
      const newSystem = new HormoneSystem();
      newSystem.deserialize(serialized as any);
      
      expect(newSystem.getLevel(HormoneType.DOPAMINE)).toBe(0.9);
    });
  });

  // ==================== 状态报告测试 ====================
  describe('Status Report', () => {
    it('应生成状态报告', () => {
      const report = system.getStatusReport();
      
      expect(typeof report).toBe('string');
      expect(report).toContain('Hormone System Status');
      expect(report).toContain('Adrenaline');
      expect(report).toContain('Dopamine');
    });
  });

  // ==================== 边界情况测试 ====================
  describe('Edge Cases', () => {
    it('应处理极端激素水平', () => {
      system.setLevel(HormoneType.ADRENALINE, 100, 'test');
      expect(system.getLevel(HormoneType.ADRENALINE)).toBe(1.0);
      
      system.setLevel(HormoneType.ADRENALINE, -100, 'test');
      expect(system.getLevel(HormoneType.ADRENALINE)).toBe(0.0);
    });

    it('应处理零调整', () => {
      const initialLevel = system.getLevel(HormoneType.ADRENALINE);
      system.adjust(HormoneType.ADRENALINE, 0, 'no change');
      
      expect(system.getLevel(HormoneType.ADRENALINE)).toBe(initialLevel);
    });

    it('应处理极小的调整值', () => {
      system.setLevel(HormoneType.ADRENALINE, 0.5, 'test');
      system.adjust(HormoneType.ADRENALINE, 0.0001, 'tiny');
      
      expect(system.getLevel(HormoneType.ADRENALINE)).toBeCloseTo(0.5001, 3);
    });

    it('重复重置不应出错', () => {
      system.reset('reset 1');
      system.reset('reset 2');
      
      expect(system.getLevel(HormoneType.ADRENALINE)).toBe(0.1);
    });
  });
});
