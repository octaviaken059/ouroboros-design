/**
 * @file evolution/hormone/emotional-state-generator.ts
 * @description 情绪状态生成器 - 将激素水平转换为情绪描述
 * @author Ouroboros
 * @date 2026-02-18
 */

import type {
  HormoneType,
  HormoneSnapshot,
  EmotionalState,
} from '@/types/hormone';

/**
 * 情绪状态生成器类
 * 将激素水平映射为自然语言情绪描述
 */
export class EmotionalStateGenerator {
  /**
   * 从激素快照生成情绪状态
   * @param snapshot 激素快照
   * @returns 情绪状态
   */
  generateEmotionalState(snapshot: HormoneSnapshot): EmotionalState {
    const { levels, dominantHormone, averageArousal } = snapshot;

    // 确定主导情绪
    const dominantEmotion = this.mapHormoneToEmotion(
      dominantHormone,
      levels[dominantHormone]
    );

    // 计算情绪强度
    const intensity = this.calculateIntensity(levels, averageArousal);

    // 生成完整描述
    const description = this.generateDescription(
      levels,
      dominantHormone,
      dominantEmotion,
      intensity
    );

    // 生成建议行为
    const suggestedAction = this.suggestAction(levels, dominantHormone);

    return {
      dominantEmotion,
      intensity,
      description,
      suggestedAction,
    };
  }

  /**
   * 将激素映射为情绪
   * @param hormone 激素类型
   * @param level 激素水平
   * @returns 情绪名称
   */
  private mapHormoneToEmotion(hormone: HormoneType, level: number): string {
    const emotionMap: Record<HormoneType, { high: string; low: string; normal: string }> = {
      dopamine: {
        high: '兴奋和动机强烈',
        normal: '动力适中',
        low: '缺乏动力',
      },
      serotonin: {
        high: '平静满足',
        normal: '情绪稳定',
        low: '焦虑不安',
      },
      cortisol: {
        high: '压力和警觉',
        normal: '适度警觉',
        low: '放松自在',
      },
      oxytocin: {
        high: '信任和亲密',
        normal: '社交正常',
        low: '疏离孤立',
      },
      norepinephrine: {
        high: '高度专注',
        normal: '注意力正常',
        low: '精神涣散',
      },
    };

    const mapping = emotionMap[hormone];
    if (level > 0.7) return mapping.high;
    if (level < 0.3) return mapping.low;
    return mapping.normal;
  }

  /**
   * 计算情绪强度
   * @param levels 激素水平
   * @param averageArousal 平均唤醒水平
   * @returns 强度 (0-1)
   */
  private calculateIntensity(
    levels: Record<HormoneType, number>,
    averageArousal: number
  ): number {
    // 计算激素的方差
    const values = Object.values(levels);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;

    // 高方差表示情绪强烈且复杂
    const complexityFactor = Math.min(1, variance * 4);

    // 综合唤醒水平和复杂度
    return Math.min(1, (averageArousal + complexityFactor) / 2);
  }

  /**
   * 生成情绪描述文本
   * @param levels 激素水平
   * @param dominantHormone 主导激素
   * @param dominantEmotion 主导情绪
   * @param intensity 情绪强度
   * @returns 描述文本
   */
  private generateDescription(
    levels: Record<HormoneType, number>,
    dominantHormone: HormoneType,
    dominantEmotion: string,
    intensity: number
  ): string {
    const parts: string[] = [];

    // 添加主导情绪
    parts.push(`当前主要感受是${dominantEmotion}`);

    // 添加强度描述
    if (intensity > 0.8) {
      parts.push('，情绪非常强烈');
    } else if (intensity > 0.5) {
      parts.push('，情绪较为明显');
    } else {
      parts.push('，情绪较为平和');
    }

    // 添加次要情绪
    const secondaryEmotions = this.getSecondaryEmotions(levels, dominantHormone);
    if (secondaryEmotions.length > 0) {
      parts.push(`，同时伴有${secondaryEmotions.join('、')}`);
    }

    // 添加具体激素水平描述
    parts.push('。');
    parts.push(this.generateHormoneDescription(levels));

    return parts.join('');
  }

  /**
   * 获取次要情绪
   * @param levels 激素水平
   * @param excludeHormone 排除的激素
   * @returns 次要情绪列表
   */
  private getSecondaryEmotions(
    levels: Record<HormoneType, number>,
    excludeHormone: HormoneType
  ): string[] {
    const emotions: string[] = [];
    const threshold = 0.6;

    for (const [hormone, level] of Object.entries(levels)) {
      if (hormone === excludeHormone) continue;
      if (level < threshold) continue;

      const emotion = this.mapHormoneToEmotion(hormone as HormoneType, level);
      emotions.push(emotion);
    }

    return emotions.slice(0, 2); // 最多返回2个次要情绪
  }

  /**
   * 生成激素水平描述
   * @param levels 激素水平
   * @returns 描述文本
   */
  private generateHormoneDescription(
    levels: Record<HormoneType, number>
  ): string {
    const hormoneNames: Record<HormoneType, string> = {
      dopamine: '多巴胺',
      serotonin: '血清素',
      cortisol: '皮质醇',
      oxytocin: '催产素',
      norepinephrine: '去甲肾上腺素',
    };

    const descriptions: string[] = [];

    for (const [hormone, level] of Object.entries(levels)) {
      const name = hormoneNames[hormone as HormoneType];
      let state: string;

      if (level > 0.7) state = '偏高';
      else if (level < 0.3) state = '偏低';
      else state = '正常';

      descriptions.push(`${name}${state}(${level.toFixed(2)})`);
    }

    return `激素状态：${descriptions.join('，')}`;
  }

  /**
   * 建议行为
   * @param levels 激素水平
   * @param dominantHormone 主导激素
   * @returns 建议文本
   */
  private suggestAction(
    levels: Record<HormoneType, number>,
    dominantHormone: HormoneType
  ): string {
    // 高皮质醇建议放松
    if (levels.cortisol > 0.7) {
      return '建议进行放松活动，降低压力水平';
    }

    // 低多巴胺建议寻找激励
    if (levels.dopamine < 0.3) {
      return '建议设定小目标，获取成就感';
    }

    // 高去甲肾上腺素建议保持专注
    if (levels.norepinephrine > 0.7) {
      return '适合进行需要高度专注的任务';
    }

    // 根据主导激素建议
    const suggestions: Record<HormoneType, string> = {
      dopamine: '保持当前的动力状态，继续推进任务',
      serotonin: '状态良好，适合进行创造性工作',
      cortisol: '注意压力管理，适当休息',
      oxytocin: '适合进行社交互动和协作',
      norepinephrine: '利用高度专注完成复杂任务',
    };

    return suggestions[dominantHormone];
  }

  /**
   * 生成简洁情绪标签
   * @param snapshot 激素快照
   * @returns 情绪标签
   */
  generateEmotionLabel(snapshot: HormoneSnapshot): string {
    const { levels } = snapshot;

    // 定义情绪标签规则
    const rules: {
      condition: (l: Record<HormoneType, number>) => boolean;
      label: string;
      priority: number;
    }[] = [
      {
        condition: (l) => l.cortisol > 0.8,
        label: '😰 高压力',
        priority: 10,
      },
      {
        condition: (l) => l.dopamine > 0.8 && l.serotonin > 0.7,
        label: '😄 兴奋满足',
        priority: 9,
      },
      {
        condition: (l) => l.dopamine > 0.7,
        label: '🤩 动力十足',
        priority: 8,
      },
      {
        condition: (l) => l.oxytocin > 0.7,
        label: '🥰 信任亲密',
        priority: 7,
      },
      {
        condition: (l) => l.norepinephrine > 0.7,
        label: '🎯 高度专注',
        priority: 6,
      },
      {
        condition: (l) => l.serotonin > 0.6,
        label: '😌 平静满足',
        priority: 5,
      },
      {
        condition: (l) => l.dopamine < 0.3,
        label: '😔 缺乏动力',
        priority: 4,
      },
      {
        condition: (l) => l.cortisol < 0.3 && l.serotonin > 0.5,
        label: '😊 放松自在',
        priority: 3,
      },
      {
        condition: () => true,
        label: '😐 中性',
        priority: 0,
      },
    ];

    // 找到最高优先级的匹配
    const matched = rules
      .filter((r) => r.condition(levels))
      .sort((a, b) => b.priority - a.priority)[0];

    return matched?.label || '😐 中性';
  }
}
