/**
 * @file db/persistence.ts
 * @description 持久化存储 - 同步版
 * @author Ouroboros
 * @date 2026-02-18
 */

import { query, run } from './connection';
import { createContextLogger } from '@/utils/logger';
import type { OuroborosConfig } from '@/config';

const logger = createContextLogger('Persistence');

/**
 * 保存配置到数据库
 */
export function saveConfigToDb(config: OuroborosConfig): void {
  const configJson = JSON.stringify(config);
  run(
    "INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, datetime('now'))",
    ['agent_config', configJson]
  );
  logger.debug('配置已保存到数据库');
}

/**
 * 从数据库加载配置
 */
export function loadConfigFromDb(): OuroborosConfig | null {
  const rows = query<{ value: string }>('SELECT value FROM config WHERE key = ?', [
    'agent_config',
  ]);

  if (rows.length === 0) {
    return null;
  }

  try {
    const config = JSON.parse(rows[0].value) as OuroborosConfig;
    logger.debug('配置已从数据库加载');
    return config;
  } catch (error) {
    logger.error('解析配置失败', { error });
    return null;
  }
}

/**
 * 保存 Agent 状态
 */
export function saveAgentState(state: {
  identity: unknown;
  body: unknown;
  worldModel: unknown;
  cognitiveState: unknown;
  toolSet: unknown;
  hormones: unknown;
  performanceMonitor: unknown;
  messageCount: number;
}): void {
  run(
    `INSERT OR REPLACE INTO agent_state 
     (id, identity, body, world_model, cognitive_state, tool_set, hormones, performance_monitor, message_count, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      JSON.stringify(state.identity),
      JSON.stringify(state.body),
      JSON.stringify(state.worldModel),
      JSON.stringify(state.cognitiveState),
      JSON.stringify(state.toolSet),
      JSON.stringify(state.hormones),
      JSON.stringify(state.performanceMonitor),
      state.messageCount,
    ]
  );
  logger.debug('Agent 状态已保存');
}

/**
 * 加载 Agent 状态
 */
export function loadAgentState(): {
  identity: unknown;
  body: unknown;
  worldModel: unknown;
  cognitiveState: unknown;
  toolSet: unknown;
  hormones: unknown;
  performanceMonitor: unknown;
  messageCount: number;
  updatedAt: string;
} | null {
  const rows = query<{
    identity: string;
    body: string;
    world_model: string;
    cognitive_state: string;
    tool_set: string;
    hormones: string;
    performance_monitor: string;
    message_count: number;
    updated_at: string;
  }>('SELECT * FROM agent_state WHERE id = 1');

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    identity: JSON.parse(row.identity),
    body: JSON.parse(row.body),
    worldModel: JSON.parse(row.world_model),
    cognitiveState: JSON.parse(row.cognitive_state),
    toolSet: JSON.parse(row.tool_set),
    hormones: JSON.parse(row.hormones),
    performanceMonitor: JSON.parse(row.performance_monitor),
    messageCount: row.message_count,
    updatedAt: row.updated_at,
  };
}

/**
 * 记录性能日志
 */
export function recordPerformanceLog(log: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  responseTimeMs: number;
  success: boolean;
}): void {
  run(
    'INSERT INTO performance_logs (model, input_tokens, output_tokens, response_time_ms, success) VALUES (?, ?, ?, ?, ?)',
    [log.model, log.inputTokens, log.outputTokens, log.responseTimeMs, log.success ? 1 : 0]
  );
}

/**
 * 获取性能统计
 */
export function getPerformanceStats(): {
  totalRequests: number;
  successCount: number;
  avgResponseTime: number;
  avgInputTokens: number;
  avgOutputTokens: number;
} {
  const rows = query<{
    total_requests: number;
    success_count: number;
    avg_response_time: number;
    avg_input_tokens: number;
    avg_output_tokens: number;
  }>(`
    SELECT 
      COUNT(*) as total_requests,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
      AVG(response_time_ms) as avg_response_time,
      AVG(input_tokens) as avg_input_tokens,
      AVG(output_tokens) as avg_output_tokens
    FROM performance_logs
  `);

  const row = rows[0];
  return {
    totalRequests: row.total_requests || 0,
    successCount: row.success_count || 0,
    avgResponseTime: Math.round(row.avg_response_time || 0),
    avgInputTokens: Math.round(row.avg_input_tokens || 0),
    avgOutputTokens: Math.round(row.avg_output_tokens || 0),
  };
}
