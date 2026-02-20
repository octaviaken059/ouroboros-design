/**
 * @file tests/unit/core/reflection/reflection-integration.test.ts
 * @description 反思系统集成测试
 * @author Ouroboros
 * @date 2026-02-18
 */

import { ReflectionEngine } from '@/core/reflection/reflection-engine';
import { ReflectionTriggerEngine } from '@/core/reflection/trigger-engine';
import { ReflectionAnalyzer } from '@/core/reflection/analyzer';
import type { PerformanceMetrics } from '@/types/model';

describe('反思系统集成测试', () => {
  describe('数据流连接', () => {
    it('应该能够更新性能指标并触发分析', () => {
      const engine = new ReflectionEngine({
        config: { enabled: false }, // 禁用自动触发
      });

      // 模拟性能数据
      const metrics: PerformanceMetrics[] = [
        {
          model: 'gpt-4',
          inputTokens: 100,
          outputTokens: 50,
          responseTimeMs: 500,
          success: true,
          timestamp: new Date().toISOString(),
        },
        {
          model: 'gpt-4',
          inputTokens: 200,
          outputTokens: 100,
          responseTimeMs: 2000,
          success: false,
          timestamp: new Date().toISOString(),
        },
      ];

      // 更新性能指标
      metrics.forEach(m => engine.updatePerformanceMetric(m));

      // 验证引擎状态
      const state = engine.getState();
      expect(state).toBeDefined();
    });

    it('应该能够更新记忆统计', () => {
      const engine = new ReflectionEngine({
        config: { enabled: false },
      });

      const memoryStats = {
        typeCounts: { episodic: 10, semantic: 5, procedural: 3 },
        salienceReport: {
          highSalience: 5,
          mediumSalience: 8,
          lowSalience: 5,
          shouldForget: 3,
        },
      };

      // 应该不抛出错误
      expect(() => engine.updateMemoryStats(memoryStats)).not.toThrow();
    });
  });

  describe('触发器引擎', () => {
    it('应该能够检测性能下降', () => {
      const triggerEngine = new ReflectionTriggerEngine(1000);
      
      // 模拟正常性能
      for (let i = 0; i < 10; i++) {
        triggerEngine.updatePerformanceData({
          responseTime: 500,
          success: true,
        });
      }

      // 模拟性能下降
      for (let i = 0; i < 5; i++) {
        triggerEngine.updatePerformanceData({
          responseTime: 5000,
          success: false,
        });
      }

      const stats = triggerEngine.getPerformanceStats();
      expect(stats.successRate).toBeLessThan(1);
      expect(stats.consecutiveFailures).toBe(5);
    });

    it('应该能够检测连续失败', () => {
      const triggerEngine = new ReflectionTriggerEngine(1000);
      
      // 模拟连续失败
      for (let i = 0; i < 5; i++) {
        triggerEngine.updatePerformanceData({
          responseTime: 1000,
          success: false,
        });
      }

      const stats = triggerEngine.getPerformanceStats();
      expect(stats.consecutiveFailures).toBe(5);
    });
  });

  describe('分析器', () => {
    it('应该能够分析性能趋势', () => {
      const analyzer = new ReflectionAnalyzer();
      
      // 创建性能数据（响应时间恶化）
      const metrics: PerformanceMetrics[] = [];
      for (let i = 0; i < 50; i++) {
        metrics.push({
          model: 'gpt-4',
          inputTokens: 100,
          outputTokens: 50,
          responseTimeMs: i < 25 ? 500 : 1500, // 后半段响应时间增加
          success: true,
          timestamp: new Date(Date.now() - i * 1000).toISOString(),
        });
      }

      const memoryStats = {
        typeCounts: {},
        salienceReport: {
          highSalience: 0,
          mediumSalience: 0,
          lowSalience: 0,
          shouldForget: 0,
        },
      };

      const result = analyzer.analyze(metrics, memoryStats);
      
      // 应该生成洞察
      expect(result.insights.length).toBeGreaterThan(0);
      expect(result.suggestedActions.length).toBeGreaterThan(0);
    });

    it('应该能够检测错误模式', () => {
      const analyzer = new ReflectionAnalyzer();
      
      // 创建包含失败的性能数据
      const metrics: PerformanceMetrics[] = [];
      for (let i = 0; i < 20; i++) {
        metrics.push({
          model: 'gpt-4',
          inputTokens: 100,
          outputTokens: 50,
          responseTimeMs: 500,
          success: i < 15, // 最后5次失败
          timestamp: new Date(Date.now() - i * 1000).toISOString(),
        });
      }

      const memoryStats = {
        typeCounts: {},
        salienceReport: {
          highSalience: 0,
          mediumSalience: 0,
          lowSalience: 0,
          shouldForget: 0,
        },
      };

      const result = analyzer.analyze(metrics, memoryStats);
      
      // 应该有问题类型的洞察
      const problemInsights = result.insights.filter(i => i.type === 'problem');
      expect(problemInsights.length).toBeGreaterThan(0);
    });
  });

  describe('软自指集成', () => {
    it('应该能够获取软自指引擎', () => {
      const engine = new ReflectionEngine({
        config: { enabled: false },
      });

      const softRefEngine = engine.getSoftSelfReferenceEngine();
      expect(softRefEngine).toBeDefined();
    });

    it('应该能够记录变体性能', () => {
      const engine = new ReflectionEngine({
        config: { enabled: false },
      });

      // 应该不抛出错误
      expect(() => {
        engine.recordVariantPerformance('variant-1', true, 500);
        engine.recordVariantPerformance('variant-1', false, 1000);
      }).not.toThrow();
    });

    it('应该能够获取进化统计', () => {
      const engine = new ReflectionEngine({
        config: { enabled: false },
      });

      const stats = engine.getEvolutionStats();
      expect(stats).toBeDefined();
      expect(typeof stats.variantCount).toBe('number');
      expect(typeof stats.activeVariantCount).toBe('number');
    });
  });

  describe('审批流程', () => {
    it('应该能够设置审批模式', () => {
      const engine = new ReflectionEngine({
        config: { enabled: false, approvalMode: 'conservative' },
      });

      engine.setApprovalMode('auto');
      const state = engine.getState();
      expect(state.currentMode).toBe('auto');
    });

    it('应该能够获取待审批行动', () => {
      const engine = new ReflectionEngine({
        config: { enabled: false },
      });

      const pending = engine.getPendingActions();
      expect(Array.isArray(pending)).toBe(true);
    });

    it('应该能够获取变更历史', () => {
      const engine = new ReflectionEngine({
        config: { enabled: false },
      });

      const history = engine.getChangeHistory();
      expect(Array.isArray(history)).toBe(true);
    });
  });
});
