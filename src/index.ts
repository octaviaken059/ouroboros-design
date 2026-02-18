/**
 * @file index.ts
 * @description Ouroboros Agent 主入口
 * @author Ouroboros
 * @date 2026-02-18
 *
 * 当前为 Phase 0 基础架构，仅导出类型和工具
 * 具体功能实现在后续 Phase 中完成
 */

// 导出类型（排除与 utils 重复的错误类型）
export type * from './types/index.js';

// 导出工具（包含具体的错误类实现）
export * from './utils/index.js';

// 版本信息
export const VERSION = '2.0.0';

/**
 * 初始化 Agent
 * Phase 0 仅创建函数签名，具体实现在后续 Phase 完成
 */
export function initialize(): void {
  // TODO: Phase 1 实现
  // eslint-disable-next-line no-console
  console.log('Ouroboros Agent v2.0.0 - Phase 0 基础架构');
}
