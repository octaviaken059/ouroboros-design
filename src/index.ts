/**
 * @file index.ts
 * @description Ouroboros Agent 主入口
 * @author Ouroboros
 * @date 2026-02-18
 */

// 导出配置模块（排除与 types 冲突的类型）
export {
  loadConfig,
  saveConfig,
  getConfig,
  reloadConfig,
  updateConfig,
  resetToDefault,
  DEFAULT_CONFIG,
} from './config';
export type {
  OuroborosConfig,
  CoreConfig,
  ModelEngineConfig,
  MemoryConfig,
  ToolConfig,
  EvolutionConfig,
  LogConfig,
  AdapterConfig,
} from './config';

// 导出核心模块
export * from './core';

// 导出类型模块（排除与 config 重复的类型）
export type {
  HormoneType,
  HormoneState,
  HormoneSystemConfig,
  Trigger,
  TriggerType,
  TriggerCondition,
  HormoneChange,
  EmotionalState,
  HormoneSnapshot,
} from './types/hormone';

export type {
  ModelConfig,
  ModelProvider,
  TokenBudget,
  BudgetAllocation,
  ModelResponse,
  ChatMessage,
  MessageRole,
  AssembledPrompt,
  PerformanceMetrics,
  StreamingCallbacks,
} from './types/model';

// 导出工具模块
export * from './utils/index.js';

// 导出模型引擎
export * from './capabilities/model-engine';

// 导出激素模块
export * from './evolution/hormone';

// 版本信息
export const VERSION = '2.0.0';

/**
 * 快速创建并启动 Agent
 * @param configPath 配置文件路径
 * @returns 启动后的 Agent 实例
 * 
 * @example
 * ```typescript
 * import { createAgent } from 'ouroboros';
 * 
 * const agent = await createAgent('./config.json');
 * const response = await agent.processMessage('你好');
 * console.log(response.content);
 * ```
 */
export function createAgent(configPath?: string) {
  const { OuroborosAgent } = require('./core/agent.js');
  const agent = OuroborosAgent.create(configPath ? { configPath } : {});
  agent.start();
  return agent;
}
