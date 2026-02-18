/**
 * @file core/index.ts
 * @description 核心模块入口
 * @author Ouroboros
 * @date 2026-02-18
 */

// 导出自我描述模块
export * from './self-description';

// 导出记忆系统
export * from './memory';

// 导出 Agent 主类
export { OuroborosAgent, type AgentOptions, type AgentStatus } from './agent';
