/**
 * @file db/connection.ts
 * @description SQLite 数据库连接
 * @author Ouroboros
 * @date 2026-02-18
 */

import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { createContextLogger } from '@/utils/logger';
import Database from 'better-sqlite3';

const logger = createContextLogger('Database');

/** 数据库连接实例 */
let dbInstance: unknown | null = null;

/**
 * 获取数据库连接
 */
export function getConnection(dbPath = './data/ouroboros.db'): unknown {
  if (dbInstance) {
    return dbInstance;
  }

  // 确保目录存在
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  dbInstance = new Database(dbPath);
  logger.info('数据库连接成功', { path: dbPath });

  // 启用 WAL 模式和外键
  (dbInstance as { pragma: (s: string) => void }).pragma('journal_mode = WAL');
  (dbInstance as { pragma: (s: string) => void }).pragma('foreign_keys = ON');

  return dbInstance;
}

/**
 * 初始化数据库表
 */
export function initDatabase(): void {
  const db = getConnection();

  // 配置表
  (db as { exec: (s: string) => void }).exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Agent 状态表
  (db as { exec: (s: string) => void }).exec(`
    CREATE TABLE IF NOT EXISTS agent_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      identity TEXT NOT NULL,
      body TEXT NOT NULL,
      world_model TEXT NOT NULL,
      cognitive_state TEXT NOT NULL,
      tool_set TEXT NOT NULL,
      hormones TEXT NOT NULL,
      performance_monitor TEXT NOT NULL,
      message_count INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 性能日志表
  (db as { exec: (s: string) => void }).exec(`
    CREATE TABLE IF NOT EXISTS performance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      response_time_ms INTEGER NOT NULL,
      success INTEGER NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 记忆表
  (db as { exec: (s: string) => void }).exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_accessed_at TEXT NOT NULL,
      access_count INTEGER DEFAULT 0,
      importance REAL DEFAULT 0.5,
      emotional_intensity REAL DEFAULT 0,
      confidence REAL DEFAULT 1.0,
      related_memory_ids TEXT DEFAULT '[]',
      tags TEXT DEFAULT '[]',
      data TEXT NOT NULL
    )
  `);

  // 记忆向量表
  (db as { exec: (s: string) => void }).exec(`
    CREATE TABLE IF NOT EXISTS memory_vectors (
      memory_id TEXT PRIMARY KEY,
      vector BLOB,
      FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
    )
  `);

  logger.info('数据库表初始化完成');
}

/**
 * 关闭数据库连接
 */
export function closeConnection(): void {
  if (dbInstance) {
    (dbInstance as { close: () => void }).close();
    dbInstance = null;
    logger.info('数据库连接已关闭');
  }
}

/**
 * 执行 SQL 查询
 */
export function query<T>(sql: string, params: unknown[] = []): T[] {
  const db = getConnection();
  const stmt = (db as { prepare: (s: string) => { all: (...p: unknown[]) => T[] } }).prepare(sql);
  return stmt.all(...params);
}

/**
 * 执行 SQL 语句
 */
export function run(sql: string, params: unknown[] = []): { lastID: number | bigint; changes: number } {
  const db = getConnection();
  const stmt = (db as { prepare: (s: string) => { run: (...p: unknown[]) => { lastInsertRowid: number | bigint; changes: number } } }).prepare(sql);
  const result = stmt.run(...params);
  return { lastID: result.lastInsertRowid, changes: result.changes };
}
