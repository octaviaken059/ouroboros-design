/**
 * @file db/index.ts
 * @description 数据库模块入口
 * @author Ouroboros
 * @date 2026-02-18
 */

export { getConnection, initDatabase, closeConnection, query, run } from './connection';
export {
  saveConfigToDb,
  loadConfigFromDb,
  saveAgentState,
  loadAgentState,
  recordPerformanceLog,
  getPerformanceStats,
} from './persistence';
