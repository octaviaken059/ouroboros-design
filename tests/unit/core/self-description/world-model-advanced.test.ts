/**
 * @file tests/unit/core/self-description/world-model-advanced.test.ts
 * @description WorldModelManager 高级测试 - 提高分支覆盖率
 * @author Ouroboros
 * @date 2026-02-18
 */

import { WorldModelManager } from '@/core/self-description/world-model';

describe('WorldModelManager 高级测试', () => {
  describe('模式管理边界条件', () => {
    it('应该处理空模式列表', () => {
      const manager = new WorldModelManager();
      const patterns = manager.getPatterns(0.5);

      expect(patterns).toEqual([]);
    });

    it('应该处理置信度边界值', () => {
      const manager = new WorldModelManager();

      // 边界值0
      const id1 = manager.addPattern('测试模式1', 0);
      expect(id1).toBeDefined();

      // 边界值1
      const id2 = manager.addPattern('测试模式2', 1);
      expect(id2).toBeDefined();
    });

    it('应该正确更新模式置信度', () => {
      const manager = new WorldModelManager();
      const id = manager.addPattern('测试模式', 0.5);

      manager.updatePatternConfidence(id, 0.2); // delta增量
      const patterns = manager.getPatterns(0.6);

      expect(patterns.find((p) => p.id === id)?.confidence).toBe(0.7); // 0.5 + 0.2 = 0.7
    });

    it('更新不存在的模式应该抛出错误', () => {
      const manager = new WorldModelManager();

      expect(() => {
        manager.updatePatternConfidence('nonexistent-id', 0.8);
      }).toThrow();
    });
  });

  describe('风险管理边界条件', () => {
    it('应该处理空风险列表', () => {
      const manager = new WorldModelManager();
      const risks = manager.getActiveRisks();

      expect(risks).toEqual([]);
    });

    it('应该处理所有严重级别的风险', () => {
      const manager = new WorldModelManager();

      const id1 = manager.addRisk('低风险', 'low');
      const id2 = manager.addRisk('中等风险', 'medium');
      const id3 = manager.addRisk('高风险', 'high');
      const id4 = manager.addRisk('严重风险', 'critical');

      const risks = manager.getActiveRisks();

      expect(risks.length).toBe(4);
      expect(risks.some((r) => r.id === id1)).toBe(true);
      expect(risks.some((r) => r.id === id2)).toBe(true);
      expect(risks.some((r) => r.id === id3)).toBe(true);
      expect(risks.some((r) => r.id === id4)).toBe(true);
    });

    it('解决不存在的风险应该抛出错误', () => {
      const manager = new WorldModelManager();

      expect(() => {
        manager.resolveRisk('nonexistent-id');
      }).toThrow();
    });

    it('重复解决风险不会抛出错误', () => {
      const manager = new WorldModelManager();
      const id = manager.addRisk('临时风险', 'medium');

      manager.resolveRisk(id);
      
      // 重复解决不应该抛出错误
      expect(() => {
        manager.resolveRisk(id);
      }).not.toThrow();
    });
  });

  describe('机会管理边界条件', () => {
    it('应该处理空机会列表', () => {
      const manager = new WorldModelManager();
      const opportunities = manager.getOpportunities();

      expect(opportunities).toEqual([]);
    });

    it('应该按潜在价值正确排序', () => {
      const manager = new WorldModelManager();

      manager.addOpportunity('低价值', 0.2);
      manager.addOpportunity('高价值', 0.9);
      manager.addOpportunity('中等价值', 0.5);

      const opportunities = manager.getOpportunities();

      expect(opportunities[0].potential).toBe(0.9);
      expect(opportunities[1].potential).toBe(0.5);
      expect(opportunities[2].potential).toBe(0.2);
    });

    it('应该处理潜在价值边界值', () => {
      const manager = new WorldModelManager();

      const id1 = manager.addOpportunity('最低价值', 0);
      const id2 = manager.addOpportunity('最高价值', 1);

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
    });
  });

  describe('能力评估', () => {
    it('应该更新能力评估', () => {
      const manager = new WorldModelManager();

      manager.updateCapabilities({
        strengths: ['编程', '调试', '测试'],
        weaknesses: ['设计', '文档'],
        learning: ['架构', '性能优化'],
      });

      // 验证能力评估通过toJSON保存
      const json = manager.toJSON();
      expect(json.capabilities).toBeDefined();
      expect((json.capabilities as { strengths: string[] }).strengths).toContain('编程');
      expect((json.capabilities as { weaknesses: string[] }).weaknesses).toContain('设计');
    });

    it('空能力评估应该生成有效提示词', () => {
      const manager = new WorldModelManager();
      manager.addPattern('测试模式', 0.8);

      // 不更新能力评估
      const prompt = manager.generateWorldModelPrompt();

      expect(prompt).toContain('World Model');
    });
  });

  describe('提示词生成', () => {
    it('应该为多种模式生成提示词', () => {
      const manager = new WorldModelManager();

      manager.addPattern('模式1', 0.9);
      manager.addPattern('模式2', 0.8);
      manager.addPattern('模式3', 0.7);

      const prompt = manager.generateWorldModelPrompt();

      expect(prompt).toContain('Patterns');
    });

    it('应该包含风险信息', () => {
      const manager = new WorldModelManager();
      manager.addPattern('测试', 0.8);
      manager.addRisk('API限制', 'high');

      const prompt = manager.generateWorldModelPrompt();

      expect(prompt).toContain('Active Risks');
    });

    it('应该包含机会信息', () => {
      const manager = new WorldModelManager();
      manager.addPattern('测试', 0.8);
      manager.addOpportunity('优化缓存', 0.8);

      const prompt = manager.generateWorldModelPrompt();

      expect(prompt).toContain('Opportunities');
    });
  });

  describe('序列化边界条件', () => {
    it('应该正确序列化空世界模型', () => {
      const manager = new WorldModelManager();
      const json = manager.toJSON();

      expect(json.patterns).toEqual([]);
      expect(json.risks).toEqual([]);
      expect(json.opportunities).toEqual([]);
    });

    it('应该从JSON恢复完整的世界模型', () => {
      const manager = new WorldModelManager();

      manager.addPattern('测试模式', 0.8);
      manager.addRisk('测试风险', 'medium');
      manager.addOpportunity('测试机会', 0.7);

      manager.updateCapabilities({
        strengths: ['编程'],
        weaknesses: ['设计'],
        learning: ['架构'],
      });

      const json = manager.toJSON();
      const restored = WorldModelManager.fromJSON(json);

      // 验证模式已恢复
      const patterns = restored.getPatterns(0);
      expect(patterns.some((p) => p.description === '测试模式')).toBe(true);

      // 验证风险已恢复
      const risks = restored.getActiveRisks();
      expect(risks.some((r) => r.description === '测试风险')).toBe(true);

      // 验证机会已恢复
      const opportunities = restored.getOpportunities();
      expect(opportunities.some((o) => o.description === '测试机会')).toBe(true);
    });
  });
});
