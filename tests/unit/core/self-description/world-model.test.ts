/**
 * @file tests/unit/core/self-description/world-model.test.ts
 * @description WorldModel 模块单元测试
 */

import { describe, it, expect } from '@jest/globals';
import { WorldModelManager } from '@/core/self-description/world-model';

describe('WorldModelManager', () => {
  describe('模式管理', () => {
    it('应该添加新模式', () => {
      const manager = new WorldModelManager();
      const id = manager.addPattern('用户喜欢简洁的回答', 0.8);

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('应该拒绝无效描述', () => {
      const manager = new WorldModelManager();
      expect(() => manager.addPattern('', 0.8)).toThrow();
    });

    it('应该拒绝无效置信度', () => {
      const manager = new WorldModelManager();
      expect(() => manager.addPattern('测试', 1.5)).toThrow();
      expect(() => manager.addPattern('测试', -0.1)).toThrow();
    });

    it('应该获取符合条件的模式', () => {
      const manager = new WorldModelManager();
      manager.addPattern('高置信度模式', 0.9);
      manager.addPattern('低置信度模式', 0.3);

      const patterns = manager.getPatterns(0.5);
      expect(patterns.length).toBe(1);
      expect(patterns[0].description).toBe('高置信度模式');
    });

    it('应该按置信度排序', () => {
      const manager = new WorldModelManager();
      manager.addPattern('中等', 0.6);
      manager.addPattern('最高', 0.9);
      manager.addPattern('较低', 0.4);

      const patterns = manager.getPatterns();
      expect(patterns[0].description).toBe('最高');
    });

    it('应该更新模式置信度', () => {
      const manager = new WorldModelManager();
      const id = manager.addPattern('测试模式', 0.5);

      manager.updatePatternConfidence(id, 0.1);

      const pattern = manager.getPatterns(0)
        .find(p => p.id === id);
      expect(pattern?.confidence).toBeCloseTo(0.6);
    });
  });

  describe('风险管理', () => {
    it('应该添加风险', () => {
      const manager = new WorldModelManager();
      const id = manager.addRisk('API 限制接近', 'high');

      expect(id).toBeDefined();
    });

    it('应该获取活跃风险', () => {
      const manager = new WorldModelManager();
      manager.addRisk('高风险', 'critical');
      manager.addRisk('低风险', 'low');

      const risks = manager.getActiveRisks();
      expect(risks.length).toBe(2);
      expect(risks[0].severity).toBe('critical'); // 按严重程度排序
    });

    it('应该解决风险', () => {
      const manager = new WorldModelManager();
      const id = manager.addRisk('临时风险', 'medium');

      manager.resolveRisk(id);

      const risks = manager.getActiveRisks();
      expect(risks.find(r => r.id === id)).toBeUndefined();
    });
  });

  describe('机会管理', () => {
    it('应该添加机会', () => {
      const manager = new WorldModelManager();
      const id = manager.addOpportunity('优化缓存策略', 0.8);

      expect(id).toBeDefined();
    });

    it('应该按潜在价值排序', () => {
      const manager = new WorldModelManager();
      manager.addOpportunity('低价值', 0.3);
      manager.addOpportunity('高价值', 0.9);

      const opportunities = manager.getOpportunities();
      expect(opportunities[0].description).toBe('高价值');
    });
  });

  describe('能力评估', () => {
    it('应该更新能力评估', () => {
      const manager = new WorldModelManager();
      manager.addPattern('用户偏好简洁回答', 0.8); // 添加模式以生成提示词
      manager.updateCapabilities({
        strengths: ['代码生成', '调试'],
        weaknesses: ['复杂推理'],
        learning: ['新框架'],
      });

      const prompt = manager.generateWorldModelPrompt();
      expect(prompt).toContain('Patterns');
    });
  });

  describe('序列化', () => {
    it('应该正确序列化和反序列化', () => {
      const manager = new WorldModelManager();
      const id = manager.addPattern('测试', 0.8);

      const json = manager.toJSON();
      const restored = WorldModelManager.fromJSON(json);

      const patterns = restored.getPatterns(0);
      expect(patterns.find(p => p.id === id)).toBeDefined();
    });
  });
});
