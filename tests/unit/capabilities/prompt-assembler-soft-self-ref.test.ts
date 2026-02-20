/**
 * @file tests/unit/capabilities/prompt-assembler-soft-self-ref.test.ts
 * @description 提示词组装器与软自指引擎集成测试
 * @author Ouroboros
 * @date 2026-02-18
 */

import { loadConfig } from '@/config';
import { PromptAssembler } from '@/capabilities/model-engine/prompt-assembler';
import { SoftSelfReferenceEngine } from '@/evolution/self-evolution/soft-self-reference';

// 加载测试配置
beforeAll(() => {
  loadConfig();
});

describe('PromptAssembler 软自指集成', () => {
  describe('软自指引擎连接', () => {
    it('应该能够设置软自指引擎', () => {
      const assembler = new PromptAssembler();
      const softRefEngine = new SoftSelfReferenceEngine();

      expect(() => {
        assembler.setSoftSelfReferenceEngine(softRefEngine);
      }).not.toThrow();
    });

    it('使用软自指优化时应该包含活跃变体', () => {
      const assembler = new PromptAssembler();
      const softRefEngine = new SoftSelfReferenceEngine();

      // 连接软自指引擎
      assembler.setSoftSelfReferenceEngine(softRefEngine);

      // 组装提示词
      const result = assembler.assemble({
        systemPrompt: '系统提示词',
        selfDescription: JSON.stringify({ test: 'data' }),
        memoryContext: '记忆上下文',
        userInput: '用户输入',
      });

      expect(result.system).toBeDefined();
      expect(result.user).toBe('用户输入');
    });

    it('未连接软自指引擎时应该使用默认模板', () => {
      const assembler = new PromptAssembler('自定义系统模板');

      const result = assembler.assemble({
        systemPrompt: '系统提示词',
        selfDescription: JSON.stringify({ test: 'data' }),
        memoryContext: '记忆上下文',
        userInput: '用户输入',
      });

      expect(result.system).toContain('自定义系统模板');
    });
  });

  describe('变体性能记录', () => {
    it('应该能够记录变体性能', () => {
      const softRefEngine = new SoftSelfReferenceEngine();

      // 获取默认活跃变体
      const activeVariant = softRefEngine.getActiveVariant('system');
      expect(activeVariant).toBeDefined();

      // 记录性能
      if (activeVariant) {
        softRefEngine.recordVariantPerformance(activeVariant.id, true, 500);
        softRefEngine.recordVariantPerformance(activeVariant.id, false, 1000);

        // 检查性能数据是否更新
        const updatedVariant = softRefEngine.getAllVariants().find(
          v => v.id === activeVariant.id
        );
        expect(updatedVariant?.performance.usageCount).toBeGreaterThan(0);
      }
    });

    it('应该能够创建和完成A/B测试', () => {
      const softRefEngine = new SoftSelfReferenceEngine();

      const variantA = softRefEngine.getActiveVariant('self');
      expect(variantA).toBeDefined();

      if (variantA) {
        // 创建优化变体
        const variantB = softRefEngine.applyOptimization('REDUCE_RISK', '测试优化');

        // 创建A/B测试
        const test = softRefEngine.createABTest(
          '测试A/B测试',
          '测试假设',
          variantA.id,
          variantB.id,
          10
        );

        expect(test.id).toBeDefined();
        expect(test.status).toBe('running');

        // 记录足够的性能数据以完成测试
        for (let i = 0; i < 15; i++) {
          softRefEngine.recordVariantPerformance(variantA.id, i % 2 === 0, 500);
          softRefEngine.recordVariantPerformance(variantB.id, i % 3 === 0, 500);
        }

        // 检查测试统计
        const stats = softRefEngine.getStats();
        expect(stats.variantCount).toBeGreaterThan(0);
      }
    });
  });

  describe('变体激活', () => {
    it('应该能够激活变体', () => {
      const softRefEngine = new SoftSelfReferenceEngine();

      // 创建新变体
      const newVariant = softRefEngine.applyOptimization('INCREASE_EXPLORATION', '测试');
      
      // 激活变体
      softRefEngine.activateVariant(newVariant.id);

      // 检查活跃变体
      const activeVariant = softRefEngine.getActiveVariant('self');
      expect(activeVariant?.id).toBe(newVariant.id);
    });

    it('激活新变体应该禁用同类型的其他变体', () => {
      const softRefEngine = new SoftSelfReferenceEngine();

      // 创建两个变体
      const variant1 = softRefEngine.applyOptimization('REDUCE_RISK', '测试1');
      const variant2 = softRefEngine.applyOptimization('REDUCE_RISK', '测试2');

      // 激活第一个
      softRefEngine.activateVariant(variant1.id);
      expect(softRefEngine.getActiveVariant('self')?.id).toBe(variant1.id);

      // 激活第二个，第一个应该被禁用
      softRefEngine.activateVariant(variant2.id);
      expect(softRefEngine.getActiveVariant('self')?.id).toBe(variant2.id);

      // 检查第一个变体的状态
      const allVariants = softRefEngine.getAllVariants();
      const v1 = allVariants.find(v => v.id === variant1.id);
      expect(v1?.isActive).toBe(false);
    });
  });
});
