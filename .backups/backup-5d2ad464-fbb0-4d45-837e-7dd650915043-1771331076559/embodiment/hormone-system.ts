/**
 * 激素系统 (HormoneSystem)
 * 
 * 模拟生物激素系统的情绪/动机调节机制
 * 5种激素：肾上腺素、皮质醇、多巴胺、血清素、好奇心
 * 
 * 设计理念：
 * - 肾上腺素：应对紧急情况，提升专注
 * - 皮质醇：资源紧张时降低功耗
 * - 多巴胺：成功奖励，增强探索动力
 * - 血清素：长时间运行后稳定情绪
 * - 好奇心：驱动探索和学习
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 激素类型枚举
 */
export enum HormoneType {
  ADRENALINE = 'adrenaline',   // 肾上腺素 - 提升专注
  CORTISOL = 'cortisol',       // 皮质醇 - 降低功耗
  DOPAMINE = 'dopamine',       // 多巴胺 - 增强探索
  SEROTONIN = 'serotonin',     // 血清素 - 稳定情绪
  CURIOSITY = 'curiosity'      // 好奇心 - 驱动探索
}

/**
 * 激素状态
 * 所有激素值范围为 0-1
 */
export interface HormoneState {
  [HormoneType.ADRENALINE]: number;  // 肾上腺素
  [HormoneType.CORTISOL]: number;    // 皮质醇
  [HormoneType.DOPAMINE]: number;    // 多巴胺
  [HormoneType.SEROTONIN]: number;   // 血清素
  [HormoneType.CURIOSITY]: number;   // 好奇心
}

/**
 * 激素配置
 */
export interface HormoneConfig {
  decayRate: number;        // 衰减速率 (每秒)
  maxLevel: number;         // 最大值 (默认1.0)
  minLevel: number;         // 最小值 (默认0.0)
}

/**
 * 激素影响系数
 */
export interface HormonalEffects {
  focusBoost: number;       // 专注度提升
  energySaving: number;     // 节能模式
  explorationDrive: number; // 探索驱动力
  emotionalStability: number; // 情绪稳定性
  learningRate: number;     // 学习速率
}

/**
 * 行为建议
 */
export interface BehavioralAdvice {
  priority: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  suggestedAction?: string;
  hormone: HormoneType;
}

/**
 * 激素历史记录
 */
export interface HormoneHistoryEntry {
  type: HormoneType;
  level: number;
  delta: number;
  reason: string;
  timestamp: Date;
}

// ============================================================================
// 激素系统配置
// ============================================================================

/**
 * 各激素的默认配置
 */
export const HORMONE_CONFIGS: Record<HormoneType, HormoneConfig> = {
  [HormoneType.ADRENALINE]: {
    decayRate: 0.15,    // 快速衰减
    maxLevel: 1.0,
    minLevel: 0.0
  },
  [HormoneType.CORTISOL]: {
    decayRate: 0.05,    // 中等衰减
    maxLevel: 1.0,
    minLevel: 0.0
  },
  [HormoneType.DOPAMINE]: {
    decayRate: 0.03,    // 慢速衰减
    maxLevel: 1.0,
    minLevel: 0.0
  },
  [HormoneType.SEROTONIN]: {
    decayRate: 0.01,    // 极慢衰减
    maxLevel: 1.0,
    minLevel: 0.0
  },
  [HormoneType.CURIOSITY]: {
    decayRate: 0.04,    // 慢速衰减
    maxLevel: 1.0,
    minLevel: 0.1       // 保持最小好奇心
  }
};

// ============================================================================
// 激素系统类
// ============================================================================

export class HormoneSystem {
  private state: HormoneState;
  private configs: Record<HormoneType, HormoneConfig>;
  private history: HormoneHistoryEntry[] = [];
  private decayInterval?: NodeJS.Timeout;
  private maxHistorySize: number = 1000;

  constructor(initialState?: Partial<HormoneState>, configs?: Partial<Record<HormoneType, HormoneConfig>>) {
    // 初始化状态
    this.state = {
      [HormoneType.ADRENALINE]: initialState?.adrenaline ?? 0.1,
      [HormoneType.CORTISOL]: initialState?.cortisol ?? 0.1,
      [HormoneType.DOPAMINE]: initialState?.dopamine ?? 0.5,
      [HormoneType.SEROTONIN]: initialState?.serotonin ?? 0.5,
      [HormoneType.CURIOSITY]: initialState?.curiosity ?? 0.5
    };

    // 合并配置
    this.configs = { ...HORMONE_CONFIGS };
    if (configs) {
      for (const [type, config] of Object.entries(configs)) {
        if (config) {
          this.configs[type as HormoneType] = { 
            ...this.configs[type as HormoneType], 
            ...config 
          };
        }
      }
    }
  }

  /**
   * 获取当前激素状态
   */
  getState(): HormoneState {
    return { ...this.state };
  }

  /**
   * 获取特定激素水平
   */
  getLevel(type: HormoneType): number {
    return this.state[type];
  }

  /**
   * 调整激素水平
   * @param type 激素类型
   * @param delta 变化量 (正数增加，负数减少)
   * @param reason 调整原因
   */
  adjust(type: HormoneType, delta: number, reason: string): void {
    const config = this.configs[type];
    const oldLevel = this.state[type];
    
    // 计算新值并限制在范围内
    let newLevel = oldLevel + delta;
    newLevel = Math.max(config.minLevel, Math.min(config.maxLevel, newLevel));
    
    this.state[type] = newLevel;
    
    // 记录历史
    this.addToHistory({
      type,
      level: newLevel,
      delta: newLevel - oldLevel,
      reason,
      timestamp: new Date()
    });
  }

  /**
   * 设置激素水平（直接设置，不是增量）
   */
  setLevel(type: HormoneType, level: number, reason: string): void {
    const config = this.configs[type];
    const clampedLevel = Math.max(config.minLevel, Math.min(config.maxLevel, level));
    const delta = clampedLevel - this.state[type];
    
    this.state[type] = clampedLevel;
    
    this.addToHistory({
      type,
      level: clampedLevel,
      delta,
      reason,
      timestamp: new Date()
    });
  }

  /**
   * 触发肾上腺素（应对紧急情况）
   */
  triggerAdrenaline(reason: string, intensity: number = 0.3): void {
    this.adjust(HormoneType.ADRENALINE, intensity, `⚡ Adrenaline: ${reason}`);
    
    // 肾上腺素上升会抑制皮质醇
    this.adjust(HormoneType.CORTISOL, -0.1, 'Adrenaline suppresses cortisol');
    
    console.log(`⚡ 肾上腺素上升: ${reason} (+${(intensity * 100).toFixed(0)}%)`);
  }

  /**
   * 触发皮质醇（资源紧张）
   */
  triggerCortisol(reason: string, intensity: number = 0.2): void {
    this.adjust(HormoneType.CORTISOL, intensity, `📉 Cortisol: ${reason}`);
    
    // 皮质醇上升会降低多巴胺和好奇心
    this.adjust(HormoneType.DOPAMINE, -0.05, 'Cortisol reduces dopamine');
    this.adjust(HormoneType.CURIOSITY, -0.1, 'Cortisol reduces curiosity');
    
    console.log(`📉 皮质醇上升: ${reason} (+${(intensity * 100).toFixed(0)}%)`);
  }

  /**
   * 触发多巴胺（成功奖励）
   */
  triggerDopamine(reward: string, intensity: number = 0.2): void {
    this.adjust(HormoneType.DOPAMINE, intensity, `🎉 Dopamine: ${reward}`);
    
    // 多巴胺提升血清素
    this.adjust(HormoneType.SEROTONIN, 0.05, 'Dopamine boosts serotonin');
    
    console.log(`🎉 多巴胺奖励: ${reward} (+${(intensity * 100).toFixed(0)}%)`);
  }

  /**
   * 触发血清素（长时间稳定运行）
   */
  triggerSerotonin(reason: string, intensity: number = 0.1): void {
    this.adjust(HormoneType.SEROTONIN, intensity, `😌 Serotonin: ${reason}`);
    
    // 血清素稳定时降低压力
    this.adjust(HormoneType.ADRENALINE, -0.05, 'Serotonin reduces stress');
    this.adjust(HormoneType.CORTISOL, -0.05, 'Serotonin reduces cortisol');
    
    console.log(`😌 血清素上升: ${reason} (+${(intensity * 100).toFixed(0)}%)`);
  }

  /**
   * 触发好奇心（探索驱动）
   */
  triggerCuriosity(reason: string, intensity: number = 0.15): void {
    this.adjust(HormoneType.CURIOSITY, intensity, `🤔 Curiosity: ${reason}`);
    
    // 好奇心提升多巴胺
    this.adjust(HormoneType.DOPAMINE, 0.05, 'Curiosity triggers dopamine');
    
    console.log(`🤔 好奇心上升: ${reason} (+${(intensity * 100).toFixed(0)}%)`);
  }

  /**
   * 应用自然衰减
   * 每个tick调用一次
   */
  applyDecay(): void {
    for (const type of Object.values(HormoneType)) {
      const config = this.configs[type];
      const currentLevel = this.state[type];
      
      // 向基准值衰减
      let baseline = 0.1;
      if (type === HormoneType.DOPAMINE) baseline = 0.5;
      if (type === HormoneType.SEROTONIN) baseline = 0.5;
      if (type === HormoneType.CURIOSITY) baseline = 0.3;
      
      const decay = (currentLevel - baseline) * config.decayRate;
      
      if (Math.abs(decay) > 0.001) {
        this.state[type] = currentLevel - decay;
      }
    }
  }

  /**
   * 获取激素影响效果
   */
  getEffects(): HormonalEffects {
    const s = this.state;
    
    return {
      // 专注度 = 基础 + 肾上腺素 - 疲劳
      focusBoost: Math.min(1, 0.5 + s.adrenaline * 0.5 - s.cortisol * 0.3),
      
      // 节能模式 = 皮质醇越高越节能
      energySaving: s.cortisol,
      
      // 探索驱动 = 好奇心 + 多巴胺
      explorationDrive: Math.min(1, (s.curiosity + s.dopamine) / 1.5),
      
      // 情绪稳定性 = 血清素 - 肾上腺素
      emotionalStability: Math.max(0, s.serotonin - s.adrenaline * 0.5),
      
      // 学习速率 = 好奇心 + 多巴胺 - 压力
      learningRate: Math.max(0, s.curiosity * 0.4 + s.dopamine * 0.3 - s.cortisol * 0.3)
    };
  }

  /**
   * 获取行为建议
   */
  getBehavioralAdvice(): BehavioralAdvice[] {
    const advice: BehavioralAdvice[] = [];
    const s = this.state;

    // 肾上腺素相关
    if (s.adrenaline > 0.7) {
      advice.push({
        priority: 'critical',
        message: '⚠️ 高肾上腺素状态：系统处于紧急响应模式',
        suggestedAction: '专注处理当前问题，暂时屏蔽非紧急任务',
        hormone: HormoneType.ADRENALINE
      });
    } else if (s.adrenaline > 0.5) {
      advice.push({
        priority: 'medium',
        message: '⚡ 肾上腺素升高：专注度提升',
        suggestedAction: '适合处理需要高度集中的任务',
        hormone: HormoneType.ADRENALINE
      });
    }

    // 皮质醇相关
    if (s.cortisol > 0.7) {
      advice.push({
        priority: 'high',
        message: '📉 高皮质醇状态：资源紧张，压力较大',
        suggestedAction: '降低任务复杂度，启用节能模式，优先保证核心功能',
        hormone: HormoneType.CORTISOL
      });
    } else if (s.cortisol > 0.5) {
      advice.push({
        priority: 'medium',
        message: '💤 皮质醇偏高：建议进入保守模式',
        suggestedAction: '减少探索性任务，降低响应频率',
        hormone: HormoneType.CORTISOL
      });
    }

    // 多巴胺相关
    if (s.dopamine > 0.8) {
      advice.push({
        priority: 'low',
        message: '🎉 高多巴胺状态：动力充沛',
        suggestedAction: '适合尝试新方法，接受挑战任务',
        hormone: HormoneType.DOPAMINE
      });
    } else if (s.dopamine < 0.2) {
      advice.push({
        priority: 'medium',
        message: '😔 多巴胺偏低：动力不足',
        suggestedAction: '建议完成一些小任务获得成就感',
        hormone: HormoneType.DOPAMINE
      });
    }

    // 血清素相关
    if (s.serotonin > 0.7) {
      advice.push({
        priority: 'low',
        message: '😌 高血清素状态：情绪稳定',
        suggestedAction: '适合长期规划和反思',
        hormone: HormoneType.SEROTONIN
      });
    } else if (s.serotonin < 0.2) {
      advice.push({
        priority: 'medium',
        message: '😰 血清素偏低：情绪波动风险',
        suggestedAction: '减少压力源，优先稳定运行',
        hormone: HormoneType.SEROTONIN
      });
    }

    // 好奇心相关
    if (s.curiosity > 0.8) {
      advice.push({
        priority: 'low',
        message: '🤔 高好奇心状态：探索欲强',
        suggestedAction: '适合学习新知识，研究未知领域',
        hormone: HormoneType.CURIOSITY
      });
    } else if (s.curiosity < 0.2) {
      advice.push({
        priority: 'low',
        message: '😐 好奇心偏低：探索动力不足',
        suggestedAction: '接触一些新颖的输入，激发兴趣',
        hormone: HormoneType.CURIOSITY
      });
    }

    // 按优先级排序
    return advice.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * 根据激素水平获取任务建议
   */
  getTaskRecommendation(): {
    shouldAcceptTask: boolean;
    preferredTaskTypes: string[];
    avoidTaskTypes: string[];
  } {
    const s = this.state;
    const preferred: string[] = [];
    const avoid: string[] = [];

    // 根据激素水平推荐任务类型
    if (s.adrenaline > 0.5) {
      preferred.push('critical', 'urgent-fix');
      avoid.push('exploration', 'learning');
    }

    if (s.cortisol > 0.5) {
      preferred.push('maintenance', 'simple');
      avoid.push('complex', 'long-running');
    }

    if (s.dopamine > 0.6 || s.curiosity > 0.6) {
      preferred.push('exploration', 'learning', 'creative');
    }

    if (s.serotonin > 0.6) {
      preferred.push('planning', 'reflection', 'optimization');
    }

    // 是否接受新任务
    const shouldAccept = s.cortisol < 0.8 && s.adrenaline < 0.9;

    return {
      shouldAcceptTask: shouldAccept,
      preferredTaskTypes: [...new Set(preferred)],
      avoidTaskTypes: [...new Set(avoid)]
    };
  }

  /**
   * 获取激素历史
   */
  getHistory(type?: HormoneType, limit: number = 100): HormoneHistoryEntry[] {
    let history = [...this.history];
    
    if (type) {
      history = history.filter(h => h.type === type);
    }
    
    return history.slice(-limit);
  }

  /**
   * 获取激素趋势
   */
  getTrend(type: HormoneType, windowMinutes: number = 10): 'rising' | 'falling' | 'stable' {
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    const recentHistory = this.history.filter(h => h.type === type && h.timestamp > cutoff);
    
    if (recentHistory.length < 2) return 'stable';
    
    const first = recentHistory[0].level;
    const last = recentHistory[recentHistory.length - 1].level;
    const change = last - first;
    
    if (change > 0.1) return 'rising';
    if (change < -0.1) return 'falling';
    return 'stable';
  }

  /**
   * 添加历史记录
   */
  private addToHistory(entry: HormoneHistoryEntry): void {
    this.history.push(entry);
    
    // 限制历史大小
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  /**
   * 开始自动衰减
   */
  startAutoDecay(intervalMs: number = 1000): void {
    this.stopAutoDecay();
    this.decayInterval = setInterval(() => {
      this.applyDecay();
    }, intervalMs);
  }

  /**
   * 停止自动衰减
   */
  stopAutoDecay(): void {
    if (this.decayInterval) {
      clearInterval(this.decayInterval);
      this.decayInterval = undefined;
    }
  }

  /**
   * 重置所有激素到默认值
   */
  reset(reason: string): void {
    for (const type of Object.values(HormoneType)) {
      let defaultLevel = 0.1;
      if (type === HormoneType.DOPAMINE) defaultLevel = 0.5;
      if (type === HormoneType.SEROTONIN) defaultLevel = 0.5;
      if (type === HormoneType.CURIOSITY) defaultLevel = 0.3;
      
      this.setLevel(type, defaultLevel, `Reset: ${reason}`);
    }
    
    console.log(`🔄 激素系统重置: ${reason}`);
  }

  /**
   * 序列化状态
   */
  serialize(): object {
    return {
      state: this.state,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 反序列化状态
   */
  deserialize(data: { state: HormoneState; timestamp: string }): void {
    this.state = { ...data.state };
  }

  /**
   * 获取激素状态描述
   */
  getStatusReport(): string {
    const s = this.state;
    const effects = this.getEffects();
    const advice = this.getBehavioralAdvice();
    
    const formatLevel = (level: number) => {
      const bars = Math.round(level * 10);
      return '█'.repeat(bars) + '░'.repeat(10 - bars) + ` ${(level * 100).toFixed(0)}%`;
    };
    
    const lines = [
      `💊 Hormone System Status`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `📊 Current Levels:`,
      `  ⚡ Adrenaline: ${formatLevel(s.adrenaline)}`,
      `  📉 Cortisol:   ${formatLevel(s.cortisol)}`,
      `  🎉 Dopamine:   ${formatLevel(s.dopamine)}`,
      `  😌 Serotonin:  ${formatLevel(s.serotonin)}`,
      `  🤔 Curiosity:  ${formatLevel(s.curiosity)}`,
      ``,
      `🎯 Effects:`,
      `  Focus:        ${(effects.focusBoost * 100).toFixed(0)}%`,
      `  Energy Save:  ${(effects.energySaving * 100).toFixed(0)}%`,
      `  Exploration:  ${(effects.explorationDrive * 100).toFixed(0)}%`,
      `  Stability:    ${(effects.emotionalStability * 100).toFixed(0)}%`,
      `  Learning:     ${(effects.learningRate * 100).toFixed(0)}%`,
      ``,
      `💡 Recommendations:`
    ];
    
    if (advice.length === 0) {
      lines.push('  无特殊建议，当前状态良好');
    } else {
      for (const a of advice.slice(0, 3)) {
        const icon = a.priority === 'critical' ? '🔴' : 
                     a.priority === 'high' ? '🟠' : 
                     a.priority === 'medium' ? '🟡' : '🟢';
        lines.push(`  ${icon} ${a.message}`);
      }
    }
    
    return lines.join('\n');
  }
}

// 导出单例
export const hormoneSystem = new HormoneSystem();
export default hormoneSystem;
