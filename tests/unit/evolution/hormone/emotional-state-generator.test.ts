/**
 * @file tests/unit/evolution/hormone/emotional-state-generator.test.ts
 * @description EmotionalStateGenerator 单元测试
 * @author Ouroboros
 * @date 2026-02-18
 */

import { EmotionalStateGenerator } from '@/evolution/hormone/emotional-state-generator';
import type { HormoneSnapshot } from '@/types/hormone';

describe('EmotionalStateGenerator', () => {
  let generator: EmotionalStateGenerator;

  beforeEach(() => {
    generator = new EmotionalStateGenerator();
  });

  describe('generateEmotionalState', () => {
    it('应该生成情绪状态', () => {
      const snapshot: HormoneSnapshot = {
        timestamp: Date.now(),
        levels: {
          dopamine: 0.8,
          serotonin: 0.6,
          cortisol: 0.2,
          oxytocin: 0.5,
          norepinephrine: 0.4,
        },
        dominantHormone: 'dopamine',
        averageArousal: 0.5,
      };

      const state = generator.generateEmotionalState(snapshot);

      expect(state.dominantEmotion).toBeDefined();
      expect(state.intensity).toBeGreaterThanOrEqual(0);
      expect(state.intensity).toBeLessThanOrEqual(1);
      expect(state.description).toContain('多巴胺');
    });

    it('应该识别高多巴胺状态', () => {
      const snapshot: HormoneSnapshot = {
        timestamp: Date.now(),
        levels: {
          dopamine: 0.8,
          serotonin: 0.5,
          cortisol: 0.3,
          oxytocin: 0.4,
          norepinephrine: 0.4,
        },
        dominantHormone: 'dopamine',
        averageArousal: 0.48,
      };

      const state = generator.generateEmotionalState(snapshot);

      expect(state.dominantEmotion).toContain('兴奋');
      expect(state.description).toContain('多巴胺偏高');
    });

    it('应该识别高皮质醇状态', () => {
      const snapshot: HormoneSnapshot = {
        timestamp: Date.now(),
        levels: {
          dopamine: 0.4,
          serotonin: 0.4,
          cortisol: 0.8,
          oxytocin: 0.3,
          norepinephrine: 0.6,
        },
        dominantHormone: 'cortisol',
        averageArousal: 0.5,
      };

      const state = generator.generateEmotionalState(snapshot);

      expect(state.dominantEmotion).toContain('压力');
    });

    it('应该提供建议行为', () => {
      const snapshot: HormoneSnapshot = {
        timestamp: Date.now(),
        levels: {
          dopamine: 0.3,
          serotonin: 0.5,
          cortisol: 0.2,
          oxytocin: 0.4,
          norepinephrine: 0.3,
        },
        dominantHormone: 'dopamine',
        averageArousal: 0.34,
      };

      const state = generator.generateEmotionalState(snapshot);

      expect(state.suggestedAction).toBeDefined();
      expect(state.suggestedAction?.length).toBeGreaterThan(0);
    });
  });

  describe('generateEmotionLabel', () => {
    it('应该为高皮质醇生成压力标签', () => {
      const snapshot: HormoneSnapshot = {
        timestamp: Date.now(),
        levels: {
          dopamine: 0.4,
          serotonin: 0.4,
          cortisol: 0.85,
          oxytocin: 0.3,
          norepinephrine: 0.5,
        },
        dominantHormone: 'cortisol',
        averageArousal: 0.49,
      };

      const label = generator.generateEmotionLabel(snapshot);

      expect(label).toContain('压力');
    });

    it('应该为高多巴胺生成动力标签', () => {
      const snapshot: HormoneSnapshot = {
        timestamp: Date.now(),
        levels: {
          dopamine: 0.85,
          serotonin: 0.6,
          cortisol: 0.2,
          oxytocin: 0.4,
          norepinephrine: 0.4,
        },
        dominantHormone: 'dopamine',
        averageArousal: 0.49,
      };

      const label = generator.generateEmotionLabel(snapshot);

      expect(label).toContain('动力');
    });

    it('应该为高去甲肾上腺素生成专注标签', () => {
      const snapshot: HormoneSnapshot = {
        timestamp: Date.now(),
        levels: {
          dopamine: 0.5,
          serotonin: 0.5,
          cortisol: 0.3,
          oxytocin: 0.4,
          norepinephrine: 0.75,
        },
        dominantHormone: 'norepinephrine',
        averageArousal: 0.49,
      };

      const label = generator.generateEmotionLabel(snapshot);

      expect(label).toContain('专注');
    });

    it('应该为平静状态生成中性标签', () => {
      const snapshot: HormoneSnapshot = {
        timestamp: Date.now(),
        levels: {
          dopamine: 0.5,
          serotonin: 0.6,
          cortisol: 0.2,
          oxytocin: 0.5,
          norepinephrine: 0.4,
        },
        dominantHormone: 'serotonin',
        averageArousal: 0.44,
      };

      const label = generator.generateEmotionLabel(snapshot);

      // 可能是"放松自在"或"平静满足"
      expect(label).toMatch(/放松|平静/);
    });
  });
});
