/**
 * @file tests/unit/core/self-description/tool-set-advanced.test.ts
 * @description ToolSetManager 高级测试 - 提高分支覆盖率
 * @author Ouroboros
 * @date 2026-02-18
 */

import { ToolSetManager } from '@/core/self-description/tool-set';

describe('ToolSetManager 高级测试', () => {
  describe('工具注销', () => {
    it('应该注销工具', () => {
      const manager = new ToolSetManager();
      manager.registerTool({
        name: 'removable_tool',
        description: '可移除的工具',
        category: 'test',
        type: 'builtin',
        confidence: 0.8,
        capabilities: ['test'],
        status: 'available',
        priority: 'medium',
      });

      const result = manager.unregisterTool('removable_tool');
      expect(result).toBe(true);

      const tools = manager.getTools();
      expect(tools.some((t) => t.name === 'removable_tool')).toBe(false);
    });

    it('注销不存在的工具应该返回false', () => {
      const manager = new ToolSetManager();

      const result = manager.unregisterTool('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('工具查询', () => {
    it('应该按类别筛选工具', () => {
      const manager = new ToolSetManager();
      manager.registerTool({
        name: 'tool_a',
        description: '工具A',
        category: 'category1',
        type: 'builtin',
        confidence: 0.8,
        capabilities: ['cap1'],
        status: 'available',
        priority: 'medium',
      });
      manager.registerTool({
        name: 'tool_b',
        description: '工具B',
        category: 'category2',
        type: 'builtin',
        confidence: 0.8,
        capabilities: ['cap2'],
        status: 'available',
        priority: 'medium',
      });

      const category1Tools = manager.getToolsByCategory('category1');
      expect(category1Tools.length).toBe(1);
      expect(category1Tools[0].name).toBe('tool_a');
    });

    it('应该按置信度排序', () => {
      const manager = new ToolSetManager();
      manager.registerTool({
        name: 'low_conf',
        description: '低置信度',
        category: 'test',
        type: 'builtin',
        confidence: 0.3,
        capabilities: ['test'],
        status: 'available',
        priority: 'medium',
      });
      manager.registerTool({
        name: 'high_conf',
        description: '高置信度',
        category: 'test',
        type: 'builtin',
        confidence: 0.9,
        capabilities: ['test'],
        status: 'available',
        priority: 'medium',
      });

      const tools = manager.getToolsByConfidence(0.0);

      expect(tools[0].name).toBe('high_conf');
      expect(tools[1].name).toBe('low_conf');
    });

    it('应该获取高置信度工具', () => {
      const manager = new ToolSetManager();
      manager.registerTool({
        name: 'high_conf_tool',
        description: '高置信度工具',
        category: 'test',
        type: 'builtin',
        confidence: 0.9,
        capabilities: ['test'],
        status: 'available',
        priority: 'medium',
      });
      manager.registerTool({
        name: 'low_conf_tool',
        description: '低置信度工具',
        category: 'test',
        type: 'builtin',
        confidence: 0.3,
        capabilities: ['test'],
        status: 'available',
        priority: 'medium',
      });

      const highConfTools = manager.getToolsByConfidence(0.8);

      expect(highConfTools.length).toBe(1);
      expect(highConfTools[0].name).toBe('high_conf_tool');
    });
  });

  describe('提示词生成', () => {
    it('应该生成包含工具的提示词', () => {
      const manager = new ToolSetManager();
      manager.registerTool({
        name: 'test_tool',
        description: '测试工具',
        category: 'test',
        type: 'builtin',
        confidence: 0.8,
        capabilities: ['test'],
        status: 'available',
        priority: 'medium',
      });

      const prompt = manager.generateToolPrompt();

      expect(prompt).toContain('Tools');
    });

    it('空工具集应该生成有效提示词', () => {
      const manager = new ToolSetManager();

      const prompt = manager.generateToolPrompt();

      expect(prompt).toBeDefined();
    });
  });

  describe('序列化', () => {
    it('应该正确序列化和恢复', () => {
      const manager = new ToolSetManager();
      manager.registerTool({
        name: 'persisted_tool',
        description: '持久化工具',
        category: 'test',
        type: 'builtin',
        confidence: 0.8,
        capabilities: ['test'],
        status: 'available',
        priority: 'medium',
      });

      const json = manager.toJSON();
      const restored = ToolSetManager.fromJSON(json);

      const tools = restored.getTools();
      expect(tools.some((t) => t.name === 'persisted_tool')).toBe(true);
    });
  });
});
