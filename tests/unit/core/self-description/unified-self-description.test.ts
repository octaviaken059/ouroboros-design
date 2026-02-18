/**
 * @file tests/unit/core/self-description/index.test.ts
 * @description UnifiedSelfDescription 集成测试
 */

import { describe, it, expect } from '@jest/globals';
import { UnifiedSelfDescription } from '@/core/self-description';

describe('UnifiedSelfDescription', () => {
  describe('初始化', () => {
    it('应该初始化所有组件', () => {
      const usd = new UnifiedSelfDescription();

      expect(usd.identity).toBeDefined();
      expect(usd.body).toBeDefined();
      expect(usd.worldModel).toBeDefined();
      expect(usd.cognitiveState).toBeDefined();
      expect(usd.toolSet).toBeDefined();
    });

    it('应该异步初始化', async () => {
      const usd = new UnifiedSelfDescription();
      await expect(usd.initialize()).resolves.not.toThrow();
    });
  });

  describe('生成自我描述', () => {
    it('应该生成完整的自我描述对象', () => {
      const usd = new UnifiedSelfDescription();
      const description = usd.generateSelfDescription();

      expect(description).toHaveProperty('identity');
      expect(description).toHaveProperty('body');
      expect(description).toHaveProperty('worldModel');
      expect(description).toHaveProperty('cognitiveState');
      expect(description).toHaveProperty('toolSet');
    });

    it('应该生成自我提示词', () => {
      const usd = new UnifiedSelfDescription();
      const prompt = usd.generateSelfPrompt();

      expect(prompt).toContain('Identity');
      expect(prompt).toContain('Body');
      expect(prompt).toContain('Cognitive State');
    });
  });

  describe('组件协同', () => {
    it('应该在身份中反映进化阶段', () => {
      const usd = new UnifiedSelfDescription();
      usd.identity.advanceStage();

      const description = usd.generateSelfDescription();
      const identity = description.identity as { evolutionStage: string };
      expect(identity.evolutionStage).toBe('learning');
    });

    it('应该在认知状态中完成目标', () => {
      const usd = new UnifiedSelfDescription();
      const goalId = usd.cognitiveState.setGoal('测试目标', 'high');
      const initialDopamine = usd.cognitiveState.getHormoneLevels().dopamine;

      usd.cognitiveState.completeGoal(goalId);

      const newDopamine = usd.cognitiveState.getHormoneLevels().dopamine;
      expect(newDopamine).toBeGreaterThan(initialDopamine);
    });

    it('应该在世界模型中添加模式', () => {
      const usd = new UnifiedSelfDescription();
      usd.worldModel.addPattern('用户偏好简洁回答', 0.8);

      const description = usd.generateSelfDescription();
      const worldModel = description.worldModel as { patterns: Array<{ description: string }> };
      expect(worldModel.patterns.length).toBeGreaterThan(0);
    });

    it('应该在工具集中更新置信度', () => {
      const usd = new UnifiedSelfDescription();
      usd.toolSet.registerTool({
        name: 'integration_test_tool',
        type: 'builtin',
        category: 'test',
        description: '集成测试工具',
        capabilities: ['test'],
        confidence: 0.5,
        status: 'available',
        priority: 'medium',
      });

      usd.toolSet.updateConfidence('integration_test_tool', true);

      const tool = usd.toolSet.getTool('integration_test_tool');
      expect(tool?.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('序列化', () => {
    it('应该正确序列化为 JSON', () => {
      const usd = new UnifiedSelfDescription();
      usd.identity.advanceStage();
      usd.cognitiveState.setMode('evolving');

      const json = usd.toJSON();

      expect(json).toHaveProperty('identity');
      expect(json).toHaveProperty('body');
    });

    it('应该从 JSON 恢复', () => {
      const usd = new UnifiedSelfDescription();
      usd.identity.advanceStage();
      usd.cognitiveState.setMode('reflection');

      const json = usd.toJSON();
      const restored = UnifiedSelfDescription.fromJSON(json);

      expect(restored.cognitiveState.getMode()).toBe('reflection');
      expect(restored.identity.getIdentity().evolutionStage).toBe('learning');
    });
  });

  describe('提示词生成完整性', () => {
    it('应该生成包含所有部分的提示词', () => {
      const usd = new UnifiedSelfDescription();

      // 添加一些数据
      usd.worldModel.addPattern('测试模式', 0.8);
      usd.cognitiveState.setGoal('生成提示词', 'high');
      usd.toolSet.registerTool({
        name: 'prompt_tool',
        type: 'builtin',
        category: 'test',
        description: '提示词生成工具',
        capabilities: ['generate'],
        confidence: 0.9,
        status: 'available',
        priority: 'high',
      });

      const prompt = usd.generateSelfPrompt();

      // 验证提示词包含各个部分
      expect(prompt.length).toBeGreaterThan(100); // 应该有内容
      expect(prompt).toContain('Ouroboros'); // 身份信息
      expect(prompt).toContain('Sensors'); // 身体信息
      expect(prompt).toContain('Mode'); // 认知状态
    });
  });
});
