/**
 * @file core/self-description/cognitive-state.ts
 * @description CognitiveState 模块 - 认知状态
 * @author Ouroboros
 * @date 2026-02-18
 */

import { randomUUID } from 'crypto';
import type {
  CognitiveState,
  HormoneLevels,
  AgentMode,
  Goal,
} from '@/types/index';
import { createContextLogger } from '@utils/logger';
import { ConfigError, tryCatch } from '@utils/error';

const logger = createContextLogger('CognitiveState');

/**
 * 激素名称列表
 */
const HORMONE_NAMES: (keyof HormoneLevels)[] = [
  'adrenaline',
  'cortisol',
  'dopamine',
  'serotonin',
  'curiosity',
];

/**
 * CognitiveState 管理类
 * 管理激素水平、模式、目标和专注度
 */
export class CognitiveStateManager {
  private state: CognitiveState;

  /**
   * 构造函数
   */
  constructor() {
    this.state = {
      hormoneLevels: {
        adrenaline: 0.1,
        cortisol: 0.1,
        dopamine: 0.5,
        serotonin: 0.6,
        curiosity: 0.5,
      },
      mode: 'serving',
      goals: [],
      focus: 0.8,
      lastUpdate: new Date().toISOString(),
    };

    logger.info('CognitiveState 初始化完成');
  }

  /**
   * 更新激素水平
   * @param hormone 激素名称
   * @param value 新值 (0-1)
   * @param reason 更新原因
   */
  updateHormone(
    hormone: keyof HormoneLevels,
    value: number,
    reason?: string
  ): void {
    const update = tryCatch(
      () => {
        if (!HORMONE_NAMES.includes(hormone)) {
          throw new Error(`无效的激素名称: ${hormone}`);
        }
        if (value < 0 || value > 1) {
          throw new Error('激素水平必须在 0-1 之间');
        }

        const oldValue = this.state.hormoneLevels[hormone];
        this.state.hormoneLevels[hormone] = value;
        this.state.lastUpdate = new Date().toISOString();

        logger.debug('激素已更新', {
          hormone,
          oldValue,
          newValue: value,
          reason,
        });
      },
      'CognitiveState.updateHormone',
      ConfigError
    );

    update();
  }

  /**
   * 获取激素水平
   * @returns 激素水平副本
   */
  getHormoneLevels(): HormoneLevels {
    return { ...this.state.hormoneLevels };
  }

  /**
   * 获取主导激素
   * @returns 主导激素名称和值
   */
  getDominantHormone(): { name: keyof HormoneLevels; value: number } {
    const entries = Object.entries(this.state.hormoneLevels) as [
      keyof HormoneLevels,
      number
    ][];
    const [name, value] = entries.reduce((max, current) =>
      current[1] > max[1] ? current : max
    );
    return { name, value };
  }

  /**
   * 设置工作模式
   * @param mode 新模式
   */
  setMode(mode: AgentMode): void {
    const oldMode = this.state.mode;
    this.state.mode = mode;
    this.state.lastUpdate = new Date().toISOString();

    logger.info('模式已切换', { oldMode, newMode: mode });
  }

  /**
   * 获取当前模式
   * @returns 当前模式
   */
  getMode(): AgentMode {
    return this.state.mode;
  }

  /**
   * 设置目标
   * @param description 目标描述
   * @param priority 优先级
   * @returns 目标 ID
   */
  setGoal(description: string, priority: Goal['priority'] = 'medium'): string {
    const add = tryCatch(
      () => {
        const goal: Goal = {
          id: randomUUID(),
          description,
          priority,
          progress: 0,
          createdAt: new Date().toISOString(),
          completed: false,
        };

        this.state.goals.push(goal);
        logger.info('目标已设置', { id: goal.id, description, priority });

        return goal.id;
      },
      'CognitiveState.setGoal',
      ConfigError
    );

    return add();
  }

  /**
   * 获取当前目标（优先级最高且未完成）
   * @returns 当前目标或 undefined
   */
  getCurrentGoal(): Goal | undefined {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return this.state.goals
      .filter((g) => !g.completed)
      .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])[0];
  }

  /**
   * 完成目标
   * @param id 目标 ID
   */
  completeGoal(id: string): void {
    const complete = tryCatch(
      () => {
        const goal = this.state.goals.find((g) => g.id === id);
        if (!goal) {
          throw new Error(`目标 ${id} 不存在`);
        }

        goal.completed = true;
        goal.progress = 1;

        // 增加多巴胺（奖励）
        const currentDopamine = this.state.hormoneLevels.dopamine;
        this.updateHormone('dopamine', Math.min(1, currentDopamine + 0.1), '完成目标');

        logger.info('目标已完成', { id, description: goal.description });
      },
      'CognitiveState.completeGoal',
      ConfigError
    );

    complete();
  }

  /**
   * 更新专注度
   * @param value 新值 (0-1)
   */
  updateFocus(value: number): void {
    const update = tryCatch(
      () => {
        if (value < 0 || value > 1) {
          throw new Error('专注度必须在 0-1 之间');
        }

        this.state.focus = value;
        this.state.lastUpdate = new Date().toISOString();

        logger.debug('专注度已更新', { value });
      },
      'CognitiveState.updateFocus',
      ConfigError
    );

    update();
  }

  /**
   * 生成认知状态描述
   * @returns 描述文本
   */
  generateCognitiveStatePrompt(): string {
    const hormones = this.state.hormoneLevels;
    const dominant = this.getDominantHormone();
    const currentGoal = this.getCurrentGoal();

    return `
### Cognitive State
- Mode: ${this.state.mode}
- Focus: ${(this.state.focus * 100).toFixed(0)}%
- Hormones:
  - Adrenaline: ${(hormones.adrenaline * 100).toFixed(0)}%
  - Cortisol: ${(hormones.cortisol * 100).toFixed(0)}%
  - Dopamine: ${(hormones.dopamine * 100).toFixed(0)}%
  - Serotonin: ${(hormones.serotonin * 100).toFixed(0)}%
  - Curiosity: ${(hormones.curiosity * 100).toFixed(0)}%
- Dominant: ${dominant.name} (${(dominant.value * 100).toFixed(0)}%)
${currentGoal ? `- Current Goal: [${currentGoal.priority.toUpperCase()}] ${currentGoal.description}` : ''}
`.trim();
  }

  /**
   * 序列化为 JSON
   */
  toJSON(): Record<string, unknown> {
    return { ...this.state };
  }

  /**
   * 从 JSON 恢复
   */
  static fromJSON(data: Record<string, unknown>): CognitiveStateManager {
    const manager = new CognitiveStateManager();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    manager.state.hormoneLevels = (data.hormoneLevels as HormoneLevels) ?? manager.state.hormoneLevels;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    manager.state.mode = (data.mode as AgentMode) ?? 'serving';
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    manager.state.goals = (data.goals as Goal[]) ?? [];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    manager.state.focus = (data.focus as number) ?? 0.8;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    manager.state.lastUpdate = (data.lastUpdate as string) ?? new Date().toISOString();
    return manager;
  }
}
