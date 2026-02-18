/**
 * @file core/self-description/identity.ts
 * @description Identity 模块 - 身份认知
 * @author Ouroboros
 * @date 2026-02-18
 */

import { randomUUID } from 'crypto';
import type { Identity, IdentityConfig } from '@/types/index';
import { createContextLogger } from '@utils/logger';
import { ConfigError, tryCatch } from '@utils/error';

const logger = createContextLogger('Identity');

/**
 * 进化阶段列表
 */
const EVOLUTION_STAGES: Identity['evolutionStage'][] = [
  'newborn',
  'learning',
  'practicing',
  'mastering',
  'transcending',
];

/**
 * Identity 管理类
 * 管理 Agent 的身份信息
 */
export class IdentityManager {
  private identity: Identity;

  /**
   * 构造函数
   * @param config 身份配置
   */
  constructor(config?: IdentityConfig) {
    this.identity = {
      id: randomUUID(),
      name: config?.name ?? 'Ouroboros',
      version: config?.version ?? '2.0.0',
      evolutionStage: 'newborn',
      createdAt: new Date().toISOString(),
      description: config?.description ?? '自我进化型 AI Agent',
    };

    logger.info('Identity 初始化完成', {
      id: this.identity.id,
      name: this.identity.name,
      version: this.identity.version,
    });
  }

  /**
   * 获取身份信息
   * @returns 身份信息副本
   */
  getIdentity(): Identity {
    return { ...this.identity };
  }

  /**
   * 更新版本号
   * @param newVersion 新版本号
   * @throws ConfigError 当版本号无效时
   */
  updateVersion(newVersion: string): void {
    const update = tryCatch(
      (version: string) => {
        if (!version || typeof version !== 'string') {
          throw new Error('版本号不能为空');
        }
        if (!/^\d+\.\d+\.\d+/.test(version)) {
          throw new Error('版本号格式必须为 x.y.z');
        }

        const oldVersion = this.identity.version;
        this.identity.version = version;

        logger.info('版本已更新', {
          oldVersion,
          newVersion: version,
        });
      },
      'Identity.updateVersion',
      ConfigError
    );

    update(newVersion);
  }

  /**
   * 进化到下一阶段
   * @returns 是否成功进化
   */
  advanceStage(): boolean {
    const currentIndex = EVOLUTION_STAGES.indexOf(this.identity.evolutionStage);
    const nextIndex = currentIndex + 1;

    if (nextIndex >= EVOLUTION_STAGES.length) {
      logger.warn('已达到最高进化阶段', {
        currentStage: this.identity.evolutionStage,
      });
      return false;
    }

    const oldStage = this.identity.evolutionStage;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.identity.evolutionStage = EVOLUTION_STAGES[nextIndex]!;

    logger.info('进化到新阶段', {
      oldStage,
      newStage: this.identity.evolutionStage,
    });

    return true;
  }

  /**
   * 生成身份提示词
   * @returns 身份描述文本
   */
  generateIdentityPrompt(): string {
    return `
### Identity
- Name: ${this.identity.name}
- Version: ${this.identity.version}
- Evolution Stage: ${this.identity.evolutionStage}
- Created At: ${this.identity.createdAt}
- Description: ${this.identity.description}
`.trim();
  }

  /**
   * 序列化为 JSON
   * @returns JSON 对象
   */
  toJSON(): Record<string, unknown> {
    return { ...this.identity };
  }

  /**
   * 从 JSON 恢复
   * @param data JSON 数据
   * @returns IdentityManager 实例
   */
  static fromJSON(data: Record<string, unknown>): IdentityManager {
    const manager = new IdentityManager();
    manager.identity = {
      id: String(data.id),
      name: String(data.name),
      version: String(data.version),
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      evolutionStage: (data.evolutionStage as Identity['evolutionStage']) ?? 'newborn',
      createdAt: String(data.createdAt),
      description: String(data.description),
    };
    return manager;
  }
}
