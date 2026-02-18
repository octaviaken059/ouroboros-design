/**
 * @file core/self-description/index.ts
 * @description UnifiedSelfDescription - 统一自我描述系统
 * @author Ouroboros
 * @date 2026-02-18
 */

import { IdentityManager } from './identity';
import { BodyManager } from './body';
import { WorldModelManager } from './world-model';
import { CognitiveStateManager } from './cognitive-state';
import { ToolSetManager } from './tool-set';
import { createContextLogger } from '@utils/logger';

const logger = createContextLogger('UnifiedSelfDescription');

/**
 * 统一自我描述管理器
 * 整合 Identity、Body、WorldModel、CognitiveState、ToolSet
 */
export class UnifiedSelfDescription {
  identity: IdentityManager;
  body: BodyManager;
  worldModel: WorldModelManager;
  cognitiveState: CognitiveStateManager;
  toolSet: ToolSetManager;

  /**
   * 构造函数
   */
  constructor() {
    this.identity = new IdentityManager();
    this.body = new BodyManager();
    this.worldModel = new WorldModelManager();
    this.cognitiveState = new CognitiveStateManager();
    this.toolSet = new ToolSetManager();

    logger.info('UnifiedSelfDescription 初始化完成');
  }

  /**
   * 初始化
   * 从持久化加载或创建默认
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async initialize(): Promise<void> {
    // TODO: Phase 1 后续实现持久化
    logger.info('UnifiedSelfDescription 已初始化');
  }

  /**
   * 生成完整自我描述
   * @returns 自我描述对象
   */
  generateSelfDescription(): Record<string, unknown> {
    return {
      identity: this.identity.toJSON(),
      body: this.body.toJSON(),
      worldModel: this.worldModel.toJSON(),
      cognitiveState: this.cognitiveState.toJSON(),
      toolSet: this.toolSet.toJSON(),
    };
  }

  /**
   * 生成自我提示词
   * @returns 提示词文本
   */
  generateSelfPrompt(): string {
    const parts = [
      this.identity.generateIdentityPrompt(),
      this.body.generateBodyPrompt(),
      this.worldModel.generateWorldModelPrompt(),
      this.cognitiveState.generateCognitiveStatePrompt(),
      this.toolSet.generateToolPrompt(),
    ];

    return parts.filter(Boolean).join('\n\n');
  }

  /**
   * 序列化为 JSON
   * @returns JSON 对象
   */
  toJSON(): Record<string, unknown> {
    return this.generateSelfDescription();
  }

  /**
   * 从 JSON 恢复
   * @param data JSON 数据
   * @returns UnifiedSelfDescription 实例
   */
  static fromJSON(data: Record<string, unknown>): UnifiedSelfDescription {
    const usd = new UnifiedSelfDescription();

    if (data.identity) {
      usd.identity = IdentityManager.fromJSON(data.identity as Record<string, unknown>);
    }
    if (data.body) {
      usd.body = BodyManager.fromJSON(data.body as Record<string, unknown>);
    }
    if (data.worldModel) {
      usd.worldModel = WorldModelManager.fromJSON(data.worldModel as Record<string, unknown>);
    }
    if (data.cognitiveState) {
      usd.cognitiveState = CognitiveStateManager.fromJSON(
        data.cognitiveState as Record<string, unknown>
      );
    }
    if (data.toolSet) {
      usd.toolSet = ToolSetManager.fromJSON(data.toolSet as Record<string, unknown>);
    }

    return usd;
  }
}

// 导出所有子模块
export * from './identity';
export * from './body';
export * from './world-model';
export * from './cognitive-state';
export * from './tool-set';
