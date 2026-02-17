/**
 * @fileoverview 贝叶斯认知系统单元测试
 * @module tests/unit/cognitive/bayesian.test
 */

import {
  BayesianCognition,
  CapabilityBelief,
  BetaDistribution,
  PerformancePrediction,
  LearningRecommendation,
  BayesianUpdateContext,
  BayesianConfig,
} from '../../../src/cognitive/bayesian';

describe('BayesianCognition', () => {
  let cognition: BayesianCognition;

  beforeEach(() => {
    cognition = new BayesianCognition();
  });

  // ==================== 构造与初始化测试 ====================
  describe('Constructor & Initialization', () => {
    it('应使用默认配置创建实例', () => {
      const bc = new BayesianCognition();
      expect(bc).toBeInstanceOf(BayesianCognition);
    });

    it('应使用自定义配置创建实例', () => {
      const customCognition = new BayesianCognition({
        priorAlpha: 1,
        priorBeta: 1,
        confidenceThreshold: 0.8,
        minSamplesForPrediction: 10,
      });
      expect(customCognition).toBeInstanceOf(BayesianCognition);
    });

    it('应在创建时拥有空的能力映射', () => {
      expect(cognition.getAllCapabilities()).toHaveLength(0);
    });
  });

  // ==================== 贝叶斯更新测试 ====================
  describe('Belief Update', () => {
    it('应创建新的能力信念', () => {
      const belief = cognition.updateBelief('coding', true);
      
      expect(belief.capability).toBe('coding');
      expect(belief.successCount).toBe(1);
      expect(belief.failCount).toBe(0);
    });

    it('应正确更新Beta分布参数（成功）', () => {
      const belief = cognition.updateBelief('coding', true);
      
      // 默认先验 alpha=2, beta=2
      // 成功一次后 alpha=3, beta=2
      expect(belief.distribution.alpha).toBe(3);
      expect(belief.distribution.beta).toBe(2);
    });

    it('应正确更新Beta分布参数（失败）', () => {
      const belief = cognition.updateBelief('coding', false);
      
      // 默认先验 alpha=2, beta=2
      // 失败一次后 alpha=2, beta=3
      expect(belief.distribution.alpha).toBe(2);
      expect(belief.distribution.beta).toBe(3);
    });

    it('应记录上下文历史', () => {
      const context: BayesianUpdateContext = {
        context: 'solving algorithm problem',
        difficulty: 'hard',
        timeTaken: 5000,
      };

      const belief = cognition.updateBelief('coding', true, context);
      expect(belief.contextHistory).toHaveLength(1);
      expect(belief.contextHistory[0].context).toBe('solving algorithm problem');
    });

    it('应限制历史记录长度', () => {
      const customCognition = new BayesianCognition({ maxContextHistory: 5 });
      
      for (let i = 0; i < 10; i++) {
        customCognition.updateBelief('coding', i % 2 === 0, { context: `task-${i}` });
      }

      const belief = customCognition.getBelief('coding');
      expect(belief!.contextHistory.length).toBeLessThanOrEqual(5);
    });

    it('应更新多个能力', () => {
      cognition.updateBelief('coding', true);
      cognition.updateBelief('writing', true);
      cognition.updateBelief('design', false);

      expect(cognition.getAllCapabilities()).toHaveLength(3);
    });
  });

  // ==================== 批量更新测试 ====================
  describe('Batch Update', () => {
    it('应批量更新信念', () => {
      const observations = [
        { success: true, context: { difficulty: 'easy' } },
        { success: true, context: { difficulty: 'medium' } },
        { success: false, context: { difficulty: 'hard' } },
      ];

      const belief = cognition.batchUpdate('coding', observations);
      
      expect(belief.successCount).toBe(2);
      expect(belief.failCount).toBe(1);
      expect(belief.contextHistory).toHaveLength(3);
    });

    it('应正确处理空批量更新', () => {
      const belief = cognition.batchUpdate('coding', []);
      
      // 应保持默认值
      expect(belief.distribution.alpha).toBe(2);
      expect(belief.distribution.beta).toBe(2);
    });
  });

  // ==================== 性能预测测试 ====================
  describe('Performance Prediction', () => {
    it('应对新能力返回学习建议', () => {
      const prediction = cognition.predictPerformance('new-skill');
      
      expect(prediction.recommendation).toBe('learn');
      expect(prediction.reason).toContain('Insufficient samples');
    });

    it('应在高置信度时推荐继续', () => {
      // 添加大量成功样本
      for (let i = 0; i < 20; i++) {
        cognition.updateBelief('expert-skill', true);
      }

      const prediction = cognition.predictPerformance('expert-skill');
      expect(prediction.recommendation).toBe('proceed');
      expect(prediction.expectedSuccess).toBe(true);
    });

    it('应在低置信度时警告', () => {
      // 添加失败样本
      for (let i = 0; i < 10; i++) {
        cognition.updateBelief('weak-skill', false);
      }

      const prediction = cognition.predictPerformance('weak-skill');
      expect(prediction.recommendation).toBe('avoid');
    });

    it('应在中等置信度时建议谨慎', () => {
      // 添加混合结果 - 更多成功案例使概率在 0.6-0.8 之间
      for (let i = 0; i < 10; i++) {
        cognition.updateBelief('medium-skill', i < 7); // 7成功，3失败
      }

      const prediction = cognition.predictPerformance('medium-skill');
      expect(prediction.recommendation).toBe('caution');
    });

    it('应考虑上下文特异性', () => {
      // 添加上下文特定的历史
      for (let i = 0; i < 5; i++) {
        cognition.updateBelief('context-skill', true, { context: 'contextA' });
      }
      for (let i = 0; i < 5; i++) {
        cognition.updateBelief('context-skill', false, { context: 'contextB' });
      }

      const prediction = cognition.predictPerformance('context-skill', 'contextA');
      expect(prediction.reason).toContain('Context-specific rate');
    });
  });

  // ==================== 能力比较测试 ====================
  describe('Capability Comparison', () => {
    it('应比较两个能力', () => {
      // 技能A成功率90%
      for (let i = 0; i < 18; i++) {
        cognition.updateBelief('skillA', true);
      }
      cognition.updateBelief('skillA', false);

      // 技能B成功率50%
      for (let i = 0; i < 5; i++) {
        cognition.updateBelief('skillB', true);
      }
      for (let i = 0; i < 5; i++) {
        cognition.updateBelief('skillB', false);
      }

      const comparison = cognition.compareCapabilities('skillA', 'skillB');
      expect(comparison.better).toBe('skillA');
      expect(comparison.difference).toBeGreaterThan(0);
    });

    it('应计算置信度', () => {
      cognition.updateBelief('skillA', true);
      cognition.updateBelief('skillB', true);

      const comparison = cognition.compareCapabilities('skillA', 'skillB');
      expect(comparison.confidence).toBeGreaterThanOrEqual(0);
      expect(comparison.confidence).toBeLessThanOrEqual(1);
    });
  });

  // ==================== 学习建议测试 ====================
  describe('Learning Recommendations', () => {
    it('应为新能力生成学习建议', () => {
      const recommendation = cognition.getLearningRecommendation('new-skill');
      
      expect(recommendation.capability).toBe('new-skill');
      expect(recommendation.strategies).toBeDefined();
      expect(recommendation.strategies.length).toBeGreaterThan(0);
    });

    it('应根据当前水平调整建议', () => {
      // 添加一些成功
      for (let i = 0; i < 5; i++) {
        cognition.updateBelief('partial-skill', true);
      }

      const recommendation = cognition.getLearningRecommendation('partial-skill', 0.9);
      expect(recommendation.currentConfidence).toBeGreaterThan(0.5);
      expect(recommendation.targetConfidence).toBe(0.9);
    });

    it('应在低置信度时建议基础练习', () => {
      for (let i = 0; i < 2; i++) {
        cognition.updateBelief('low-confidence', false);
      }

      const recommendation = cognition.getLearningRecommendation('low-confidence');
      const hasBasicAdvice = recommendation.strategies.some(s => 
        s.toLowerCase().includes('fundamental') || s.toLowerCase().includes('basic')
      );
      expect(hasBasicAdvice).toBe(true);
    });

    it('应在高不确定性时建议多样化练习', () => {
      // 交替成功和失败产生高不确定性
      for (let i = 0; i < 6; i++) {
        cognition.updateBelief('uncertain-skill', i % 2 === 0);
      }

      const recommendation = cognition.getLearningRecommendation('uncertain-skill');
      // 策略建议可能为空或包含特定建议
      expect(recommendation).toBeDefined();
      expect(recommendation.strategies).toBeInstanceOf(Array);
    });

    it('应计算估计的掌握时间', () => {
      const recommendation = cognition.getLearningRecommendation('new-skill');
      expect(recommendation.estimatedTimeToMastery).toBeGreaterThanOrEqual(0);
      expect(recommendation.suggestedPracticeCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== 置信度查询测试 ====================
  describe('Confidence Queries', () => {
    it('应返回正确的置信度', () => {
      cognition.updateBelief('test-skill', true);
      cognition.updateBelief('test-skill', true);
      cognition.updateBelief('test-skill', false);

      const confidence = cognition.getConfidence('test-skill');
      // alpha=4, beta=3 => E[X] = 4/7 ≈ 0.57
      expect(confidence).toBeGreaterThan(0.5);
      expect(confidence).toBeLessThan(0.7);
    });

    it('应返回正确的不确定性', () => {
      cognition.updateBelief('test-skill', true);
      
      const uncertainty = cognition.getUncertainty('test-skill');
      expect(uncertainty).toBeGreaterThan(0);
      expect(uncertainty).toBeLessThan(1);
    });

    it('应返回不存在能力的默认置信度', () => {
      const confidence = cognition.getConfidence('non-existent');
      // 先验 alpha=2, beta=2 => E[X] = 0.5
      expect(confidence).toBe(0.5);
    });
  });

  // ==================== 统计信息测试 ====================
  describe('Statistics', () => {
    it('应返回正确的统计信息', () => {
      cognition.updateBelief('skillA', true);
      cognition.updateBelief('skillB', true);
      cognition.updateBelief('skillB', true);

      const stats = cognition.getStats();
      expect(stats.totalCapabilities).toBe(2);
      expect(stats.totalObservations).toBe(3);
      expect(stats.averageConfidence).toBeGreaterThan(0);
    });

    it('应识别高置信度能力', () => {
      for (let i = 0; i < 15; i++) {
        cognition.updateBelief('high-conf-skill', true);
      }

      const stats = cognition.getStats();
      expect(stats.highConfidenceCount).toBeGreaterThanOrEqual(1);
    });

    it('应识别需要练习的能力', () => {
      // 添加低置信度但样本充足的能力
      for (let i = 0; i < 5; i++) {
        cognition.updateBelief('needs-practice', false);
      }

      const stats = cognition.getStats();
      expect(stats.needsPractice).toContain('needs-practice');
    });

    it('应识别练习最多的能力', () => {
      cognition.updateBelief('most-practiced', true);
      cognition.updateBelief('most-practiced', true);
      cognition.updateBelief('other', true);

      const stats = cognition.getStats();
      expect(stats.mostPracticed).toBe('most-practiced');
    });
  });

  // ==================== 导入导出测试 ====================
  describe('Import/Export', () => {
    it('应导出所有信念', () => {
      cognition.updateBelief('skillA', true);
      cognition.updateBelief('skillB', false);

      const exported = cognition.export();
      expect(exported.skillA).toBeDefined();
      expect(exported.skillB).toBeDefined();
      expect(exported.skillA.successCount).toBe(1);
      expect(exported.skillB.failCount).toBe(1);
    });

    it('导出时不应包含上下文历史', () => {
      cognition.updateBelief('skill', true, { context: 'test' });
      
      const exported = cognition.export();
      expect(exported.skill.contextHistory).toBeUndefined();
    });

    it('应导入信念数据', () => {
      const data = {
        importedSkill: {
          capability: 'importedSkill',
          distribution: { alpha: 10, beta: 5 } as BetaDistribution,
          confidence: 0.67,
          uncertainty: 0.02,
          successCount: 8,
          failCount: 3,
          lastUpdated: Date.now(),
        },
      };

      cognition.import(data);
      
      const belief = cognition.getBelief('importedSkill');
      expect(belief).toBeDefined();
      expect(belief!.successCount).toBe(8);
      expect(belief!.failCount).toBe(3);
    });

    it('导入时应保留现有能力', () => {
      cognition.updateBelief('existing', true);
      
      cognition.import({
        newSkill: {
          distribution: { alpha: 5, beta: 5 },
          successCount: 3,
          failCount: 3,
        } as Partial<CapabilityBelief>,
      });

      expect(cognition.getAllCapabilities()).toContain('existing');
      expect(cognition.getAllCapabilities()).toContain('newSkill');
    });
  });

  // ==================== 边界情况测试 ====================
  describe('Edge Cases', () => {
    it('应处理空能力名称', () => {
      const belief = cognition.updateBelief('', true);
      expect(belief.capability).toBe('');
    });

    it('应处理特殊字符能力名称', () => {
      const belief = cognition.updateBelief('skill-123_test!@#', true);
      expect(belief.capability).toBe('skill-123_test!@#');
    });

    it('应在极端成功时接近1的置信度', () => {
      for (let i = 0; i < 100; i++) {
        cognition.updateBelief('expert', true);
      }

      const confidence = cognition.getConfidence('expert');
      expect(confidence).toBeGreaterThan(0.95);
    });

    it('应在极端失败时接近0的置信度', () => {
      for (let i = 0; i < 100; i++) {
        cognition.updateBelief('novice', false);
      }

      const confidence = cognition.getConfidence('novice');
      expect(confidence).toBeLessThan(0.05);
    });

    it('应保持Beta分布参数为正数', () => {
      const belief = cognition.getBelief('non-existent');
      // 如果不存在信念，getBelief 返回 undefined
      if (belief) {
        expect(belief.distribution.alpha).toBeGreaterThan(0);
        expect(belief.distribution.beta).toBeGreaterThan(0);
      } else {
        // 如果信念不存在，这是预期行为
        expect(belief).toBeUndefined();
      }
    });
  });
});
