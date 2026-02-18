/**
 * @file tests/unit/core/bayesian/bayesian-core.test.ts
 * @description 贝叶斯认知核心单元测试
 * @author Ouroboros
 * @date 2026-02-18
 */

import {
  createUniformPrior,
  createPriorFromHistory,
  bayesianUpdate,
  batchBayesianUpdate,
  calculateConfidence,
  calculateUncertainty,
  shouldUse,
  calculateUCB,
  compareDistributions,
  BayesianCore,
} from '@/core/bayesian/bayesian-core';

describe('贝叶斯核心', () => {
  describe('先验创建', () => {
    it('应该创建均匀先验', () => {
      const prior = createUniformPrior();
      expect(prior.alpha).toBe(1);
      expect(prior.beta).toBe(1);
    });

    it('应该基于历史创建先验', () => {
      const prior = createPriorFromHistory(5, 3);
      expect(prior.alpha).toBe(5);
      expect(prior.beta).toBe(3);
    });

    it('应该对历史先验进行平滑处理', () => {
      const prior = createPriorFromHistory(0, 0);
      expect(prior.alpha).toBe(1);
      expect(prior.beta).toBe(1);
    });
  });

  describe('贝叶斯更新', () => {
    it('成功时应该增加alpha', () => {
      const prior = { alpha: 5, beta: 3 };
      const posterior = bayesianUpdate(prior, true);
      expect(posterior.alpha).toBe(6);
      expect(posterior.beta).toBe(3);
    });

    it('失败时应该增加beta', () => {
      const prior = { alpha: 5, beta: 3 };
      const posterior = bayesianUpdate(prior, false);
      expect(posterior.alpha).toBe(5);
      expect(posterior.beta).toBe(4);
    });

    it('批量更新应该正确', () => {
      const prior = { alpha: 1, beta: 1 };
      const results = [true, true, false, true, false]; // 3成功2失败
      const posterior = batchBayesianUpdate(prior, results);
      expect(posterior.alpha).toBe(4);
      expect(posterior.beta).toBe(3);
    });
  });

  describe('置信度计算', () => {
    it('均匀先验的置信度应为0.5', () => {
      const prior = createUniformPrior();
      expect(calculateConfidence(prior)).toBe(0.5);
    });

    it('高成功率的置信度应高', () => {
      const dist = { alpha: 9, beta: 1 };
      const confidence = calculateConfidence(dist);
      expect(confidence).toBeCloseTo(0.9, 2);
    });

    it('高失败率的置信度应低', () => {
      const dist = { alpha: 1, beta: 9 };
      const confidence = calculateConfidence(dist);
      expect(confidence).toBeCloseTo(0.1, 2);
    });
  });

  describe('不确定性计算', () => {
    it('均匀先验应有最大不确定性', () => {
      const prior = createUniformPrior();
      const uncertainty = calculateUncertainty(prior);
      expect(uncertainty).toBeCloseTo(1 / 12, 3);
    });

    it('更多数据应降低不确定性', () => {
      const dist1 = { alpha: 2, beta: 2 };
      const dist2 = { alpha: 20, beta: 20 };
      expect(calculateUncertainty(dist2)).toBeLessThan(calculateUncertainty(dist1));
    });
  });

  describe('探索-利用平衡', () => {
    it('新工具应被探索', () => {
      const prior = createUniformPrior();
      expect(shouldUse(prior, 0.5, 5)).toBe(true);
    });

    it('高置信度工具应被使用', () => {
      const dist = { alpha: 19, beta: 1 }; // 95%置信度
      expect(shouldUse(dist, 0.8, 5)).toBe(true);
    });

    it('低置信度工具应被拒绝', () => {
      const dist = { alpha: 2, beta: 18 }; // 10%置信度
      expect(shouldUse(dist, 0.5, 5)).toBe(false);
    });

    it('UCB应随不确定性增加', () => {
      const dist1 = { alpha: 10, beta: 10 }; // 更多数据
      const dist2 = { alpha: 2, beta: 2 };   // 较少数据
      expect(calculateUCB(dist2)).toBeGreaterThan(calculateUCB(dist1));
    });
  });

  describe('分布比较', () => {
    it('应正确识别更好的分布', () => {
      const good = { alpha: 18, beta: 2 };  // 90%
      const bad = { alpha: 2, beta: 18 };   // 10%
      expect(compareDistributions(good, bad)).toBe('A');
    });

    it('相似分布应返回不确定', () => {
      const dist1 = { alpha: 5, beta: 5 };
      const dist2 = { alpha: 6, beta: 6 };
      expect(compareDistributions(dist1, dist2)).toBe('uncertain');
    });
  });
});

describe('BayesianCore', () => {
  let core: BayesianCore;

  beforeEach(() => {
    core = new BayesianCore();
  });

  it('应该注册工具', () => {
    core.registerTool('test_tool', 5, 2);
    const confidence = core.getToolConfidence('test_tool');
    expect(confidence).not.toBeNull();
    // alpha/beta包含先验的1,1，所以实际成功/失败次数要减1
    expect(confidence?.successCount).toBe(4); // 5-1
    expect(confidence?.failureCount).toBe(1); // 2-1
  });

  it('应该更新工具置信度', () => {
    core.registerTool('test_tool');
    core.updateToolConfidence('test_tool', true);
    const confidence = core.getToolConfidence('test_tool');
    expect(confidence?.successCount).toBe(1);
  });

  it('未注册的工具应自动注册', () => {
    core.updateToolConfidence('new_tool', true);
    const confidence = core.getToolConfidence('new_tool');
    expect(confidence).not.toBeNull();
  });

  it('应该根据置信度判断使用', () => {
    core.registerTool('good_tool', 19, 1);
    core.registerTool('bad_tool', 1, 19);
    
    expect(core.shouldUseTool('good_tool', 0.8)).toBe(true);
    expect(core.shouldUseTool('bad_tool', 0.5)).toBe(false);
  });

  it('应该选择最佳工具', () => {
    core.registerTool('tool_a', 18, 2);  // 90%
    core.registerTool('tool_b', 10, 10); // 50%
    core.registerTool('tool_c', 2, 18);  // 10%
    
    const best = core.getBestTool(['tool_a', 'tool_b', 'tool_c']);
    expect(best).toBe('tool_a');
  });

  it('未注册的工具应获得探索机会', () => {
    // 注册一个表现很差的工具，使未知工具更有吸引力
    core.registerTool('bad_tool', 1, 9); // 10%成功率
    const best = core.getBestTool(['bad_tool', 'unknown_tool']);
    // 未注册的工具因高不确定性而有高UCB值
    expect(best).toBe('unknown_tool');
  });

  it('应该正确序列化和反序列化', () => {
    core.registerTool('tool1', 10, 2);
    core.registerTool('tool2', 5, 5);
    
    const serialized = core.serialize();
    expect(serialized.tool1.alpha).toBe(10);
    expect(serialized.tool1.beta).toBe(2);
    
    const newCore = new BayesianCore();
    newCore.deserialize(serialized);
    
    const confidence = newCore.getToolConfidence('tool1');
    expect(confidence?.successCount).toBe(9); // 减去先验的1
    expect(confidence?.failureCount).toBe(1);
  });
});
