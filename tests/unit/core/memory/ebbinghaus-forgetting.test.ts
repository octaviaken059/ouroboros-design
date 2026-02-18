/**
 * @file tests/unit/core/memory/ebbinghaus-forgetting.test.ts
 * @description 艾宾浩斯遗忘曲线单元测试
 * @author Ouroboros
 * @date 2026-02-18
 */

import {
  calculateRetentionRate,
  calculateSalience,
  shouldForget,
  calculateNextReviewInterval,
  shouldConsolidate,
  getForgettingCurveDebug,
  evaluateMemoriesSalience,
  EbbinghausForgettingCurve,
} from '@/core/memory/ebbinghaus-forgetting';

describe('艾宾浩斯遗忘曲线', () => {
  describe('记忆保留率计算', () => {
    it('新记忆的保留率应接近1', () => {
      const rate = calculateRetentionRate(0, 0);
      expect(rate).toBeCloseTo(1, 1);
    });

    it('1小时后保留率应符合艾宾浩斯曲线', () => {
      const rate = calculateRetentionRate(1, 0);
      // 艾宾浩斯曲线: 1小时后约44%遗忘，即56%保留
      expect(rate).toBeGreaterThan(0.4);
      expect(rate).toBeLessThan(0.7);
    });

    it('24小时后保留率应更低', () => {
      const rate24h = calculateRetentionRate(24, 0);
      const rate1h = calculateRetentionRate(1, 0);
      expect(rate24h).toBeLessThan(rate1h);
    });

    it('复习应提高保留率', () => {
      const noReview = calculateRetentionRate(1, 0); // 1小时后
      const withReview = calculateRetentionRate(1, 3); // 3次复习
      expect(withReview).toBeGreaterThan(noReview);
    });
  });

  describe('显著性计算', () => {
    it('高重要性记忆应有高显著性', () => {
      const salience = calculateSalience(0.9, 1, 0, 0);
      expect(salience).toBeGreaterThan(0.5);
    });

    it('频繁访问应提高显著性', () => {
      const lowAccess = calculateSalience(0.5, 24, 1, 0);
      const highAccess = calculateSalience(0.5, 24, 10, 0);
      expect(highAccess).toBeGreaterThan(lowAccess);
    });

    it('时间衰减应降低显著性', () => {
      const recent = calculateSalience(0.5, 1, 0, 0);
      const old = calculateSalience(0.5, 168, 0, 0); // 1周
      expect(old).toBeLessThan(recent);
    });
  });

  describe('遗忘判断', () => {
    it('显著性低于阈值应被遗忘', () => {
      expect(shouldForget(0.05, 0.1)).toBe(true);
    });

    it('显著性高于阈值不应被遗忘', () => {
      expect(shouldForget(0.5, 0.1)).toBe(false);
    });

    it('边界值测试', () => {
      expect(shouldForget(0.1, 0.1)).toBe(false);
    });
  });

  describe('复习间隔计算', () => {
    it('第一次复习应在1小时后', () => {
      expect(calculateNextReviewInterval(0)).toBe(1);
    });

    it('第二次复习应在1天后', () => {
      expect(calculateNextReviewInterval(1)).toBe(24);
    });

    it('复习间隔应逐渐增加', () => {
      const intervals = [0, 1, 2, 3, 4, 5].map(calculateNextReviewInterval);
      for (let i = 1; i < intervals.length; i++) {
        expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1]);
      }
    });
  });

  describe('记忆巩固', () => {
    it('新记忆不应巩固', () => {
      const now = new Date().toISOString();
      expect(shouldConsolidate(now, 5, now)).toBe(false);
    });

    it('访问不足不应巩固', () => {
      const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      expect(shouldConsolidate(old, 2, old)).toBe(false);
    });

    it('满足条件应巩固', () => {
      const created = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const accessed = new Date().toISOString();
      expect(shouldConsolidate(created, 5, accessed)).toBe(true);
    });

    it('长期未访问不应巩固', () => {
      const created = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const accessed = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      expect(shouldConsolidate(created, 5, accessed)).toBe(false);
    });
  });

  describe('调试信息', () => {
    it('应返回完整的调试信息', () => {
      const debug = getForgettingCurveDebug(24, 0);
      expect(debug).toHaveProperty('retentionRate');
      expect(debug).toHaveProperty('forgottenRate');
      expect(debug).toHaveProperty('nextReviewIn');
      expect(debug.retentionRate + debug.forgottenRate).toBeCloseTo(1, 1);
    });
  });

  describe('批量评估', () => {
    it('应评估多个记忆', () => {
      const memories = [
        { id: '1', importance: 0.9, createdAt: new Date().toISOString(), lastAccessedAt: new Date().toISOString(), accessCount: 10 },
        { id: '2', importance: 0.3, createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), lastAccessedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), accessCount: 1 },
      ];
      
      const results = evaluateMemoriesSalience(memories);
      expect(results).toHaveLength(2);
      expect(results[0].salience).toBeGreaterThan(results[1].salience);
    });

    it('应识别应遗忘的记忆', () => {
      const memories = [
        { id: '1', importance: 0.1, createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), lastAccessedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), accessCount: 0 },
      ];
      
      const results = evaluateMemoriesSalience(memories);
      expect(results[0].shouldForget).toBe(true);
    });
  });

  describe('EbbinghausForgettingCurve类', () => {
    it('应应用遗忘曲线', () => {
      const memory = {
        importance: 0.8,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        lastAccessedAt: new Date().toISOString(),
        accessCount: 5,
      };
      
      const salience = EbbinghausForgettingCurve.applyForgetting(memory);
      expect(salience).toBeGreaterThan(0);
      expect(salience).toBeLessThanOrEqual(1);
    });

    it('应判断巩固条件', () => {
      const shouldConsolidate = EbbinghausForgettingCurve.shouldConsolidate({
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        accessCount: 5,
        lastAccessedAt: new Date().toISOString(),
      });
      expect(shouldConsolidate).toBe(true);
    });
  });
});
