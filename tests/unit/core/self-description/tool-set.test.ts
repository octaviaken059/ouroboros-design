/**
 * @file tests/unit/core/self-description/tool-set.test.ts
 * @description ToolSet 模块单元测试
 */

import { describe, it, expect } from '@jest/globals';
import { ToolSetManager } from '@/core/self-description/tool-set';

describe('ToolSetManager', () => {
  describe('工具注册', () => {
    it('应该注册新工具', () => {
      const manager = new ToolSetManager();
      const id = manager.registerTool({
        name: 'test_tool',
        type: 'builtin',
        category: 'test',
        description: '测试工具',
        capabilities: ['test'],
        confidence: 0.5,
        status: 'available',
        priority: 'medium',
      });

      expect(id).toBeDefined();
      expect(manager.getTool('test_tool')).toBeDefined();
    });

    it('应该拒绝重复注册', () => {
      const manager = new ToolSetManager();
      manager.registerTool({
        name: 'unique_tool',
        type: 'builtin',
        category: 'test',
        description: '测试',
        capabilities: [],
        confidence: 0.5,
        status: 'available',
        priority: 'medium',
      });

      expect(() =>
        manager.registerTool({
          name: 'unique_tool',
          type: 'builtin',
          category: 'test',
          description: '重复',
          capabilities: [],
          confidence: 0.5,
          status: 'available',
          priority: 'medium',
        })
      ).toThrow();
    });

    it('应该注销工具', () => {
      const manager = new ToolSetManager();
      manager.registerTool({
        name: 'removable',
        type: 'builtin',
        category: 'test',
        description: '测试',
        capabilities: [],
        confidence: 0.5,
        status: 'available',
        priority: 'medium',
      });

      manager.unregisterTool('removable');
      expect(manager.getTool('removable')).toBeUndefined();
    });
  });

  describe('工具查询', () => {
    it('应该获取所有工具', () => {
      const manager = new ToolSetManager();
      manager.registerTool({
        name: 'tool1',
        type: 'builtin',
        category: 'test',
        description: '工具1',
        capabilities: [],
        confidence: 0.5,
        status: 'available',
        priority: 'medium',
      });
      manager.registerTool({
        name: 'tool2',
        type: 'builtin',
        category: 'test',
        description: '工具2',
        capabilities: [],
        confidence: 0.5,
        status: 'available',
        priority: 'medium',
      });

      const tools = manager.getAllTools();
      expect(tools.length).toBe(2);
    });

    it('应该按类别筛选工具', () => {
      const manager = new ToolSetManager();
      manager.registerTool({
        name: 'cat1_tool',
        type: 'builtin',
        category: 'category1',
        description: '类别1',
        capabilities: [],
        confidence: 0.5,
        status: 'available',
        priority: 'medium',
      });
      manager.registerTool({
        name: 'cat2_tool',
        type: 'builtin',
        category: 'category2',
        description: '类别2',
        capabilities: [],
        confidence: 0.5,
        status: 'available',
        priority: 'medium',
      });

      const tools = manager.getToolsByCategory('category1');
      expect(tools.length).toBe(1);
      expect(tools[0].name).toBe('cat1_tool');
    });

    it('应该按置信度排序', () => {
      const manager = new ToolSetManager();
      manager.registerTool({
        name: 'low_conf',
        type: 'builtin',
        category: 'test',
        description: '低置信度',
        capabilities: [],
        confidence: 0.3,
        status: 'available',
        priority: 'medium',
      });
      manager.registerTool({
        name: 'high_conf',
        type: 'builtin',
        category: 'test',
        description: '高置信度',
        capabilities: [],
        confidence: 0.9,
        status: 'available',
        priority: 'medium',
      });

      const tools = manager.getToolsByConfidence(0.5);
      expect(tools[0].name).toBe('high_conf');
    });
  });

  describe('置信度更新', () => {
    it('应该更新工具置信度（成功）', () => {
      const manager = new ToolSetManager();
      manager.registerTool({
        name: 'learning_tool',
        type: 'builtin',
        category: 'test',
        description: '学习中的工具',
        capabilities: [],
        confidence: 0.5,
        status: 'available',
        priority: 'medium',
      });

      manager.updateConfidence('learning_tool', true);
      manager.updateConfidence('learning_tool', true);

      const tool = manager.getTool('learning_tool');
      expect(tool?.confidence).toBeGreaterThan(0.5);
      expect(tool?.successCount).toBe(2);
    });

    it('应该更新工具置信度（失败）', () => {
      const manager = new ToolSetManager();
      manager.registerTool({
        name: 'failing_tool',
        type: 'builtin',
        category: 'test',
        description: '失败工具',
        capabilities: [],
        confidence: 0.5,
        status: 'available',
        priority: 'medium',
      });

      manager.updateConfidence('failing_tool', false);

      const tool = manager.getTool('failing_tool');
      expect(tool?.confidence).toBeLessThan(0.5);
      expect(tool?.failureCount).toBe(1);
    });
  });

  describe('生成描述', () => {
    it('应该生成工具提示词', () => {
      const manager = new ToolSetManager();
      manager.registerTool({
        name: 'good_tool',
        type: 'builtin',
        category: 'test',
        description: '好用的工具',
        capabilities: [],
        confidence: 0.8,
        status: 'available',
        priority: 'medium',
      });

      const prompt = manager.generateToolPrompt();
      expect(prompt).toContain('good_tool');
      expect(prompt).toContain('好用的工具');
    });
  });

  describe('序列化', () => {
    it('应该正确序列化和反序列化', () => {
      const manager = new ToolSetManager();
      manager.registerTool({
        name: 'persisted',
        type: 'builtin',
        category: 'test',
        description: '持久化测试',
        capabilities: [],
        confidence: 0.7,
        status: 'available',
        priority: 'medium',
      });

      const json = manager.toJSON();
      const restored = ToolSetManager.fromJSON(json);

      expect(restored.getTool('persisted')).toBeDefined();
    });
  });
});
