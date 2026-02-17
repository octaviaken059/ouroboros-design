/**
 * src/db/migrations.ts
 * 数据库迁移系统
 * 
 * 功能：
 * - 版本化管理数据库结构
 * - 支持向前/向后迁移
 * - 事务安全 (失败自动回滚)
 * - 校验和验证
 */

import * as crypto from 'crypto';
import { SQLiteConnectionPool, QueryResult } from './connection.js';

export interface Migration {
  version: number;
  name: string;
  up: string;
  down: string;
}

export interface MigrationResult {
  success: boolean;
  version: number;
  name: string;
  direction: 'up' | 'down';
  executionTimeMs: number;
  error?: string;
}

export interface MigrationStatus {
  currentVersion: number;
  targetVersion: number;
  pending: Migration[];
  applied: { version: number; name: string; appliedAt: Date }[];
}

/**
 * 迁移管理器
 * 管理数据库结构的版本演进
 */
export class MigrationManager {
  private pool: SQLiteConnectionPool;
  private migrations: Migration[] = [];

  constructor(pool: SQLiteConnectionPool) {
    this.pool = pool;
  }

  /**
   * 注册迁移
   */
  register(migration: Migration): void {
    // 检查版本冲突
    const existing = this.migrations.find(m => m.version === migration.version);
    if (existing) {
      throw new Error(`Migration version ${migration.version} already registered (${existing.name})`);
    }

    this.migrations.push(migration);
    this.migrations.sort((a, b) => a.version - b.version);
  }

  /**
   * 批量注册迁移
   */
  registerMany(migrations: Migration[]): void {
    for (const migration of migrations) {
      this.register(migration);
    }
  }

  /**
   * 获取迁移状态
   */
  async getStatus(): Promise<MigrationStatus> {
    await this.ensureMigrationTable();

    const currentVersion = await this.getCurrentVersion();
    const appliedRows = await this.pool.query<{ version: number; name: string; applied_at: string }>(
      'SELECT version, name, applied_at FROM schema_migrations ORDER BY version'
    );

    const pending = this.migrations.filter(m => m.version > currentVersion);
    const applied = appliedRows.rows.map(row => ({
      version: row.version,
      name: row.name,
      appliedAt: new Date(row.applied_at),
    }));

    return {
      currentVersion,
      targetVersion: this.migrations[this.migrations.length - 1]?.version || currentVersion,
      pending,
      applied,
    };
  }

  /**
   * 迁移到指定版本
   */
  async migrateTo(targetVersion?: number): Promise<MigrationResult[]> {
    await this.ensureMigrationTable();

    const currentVersion = await this.getCurrentVersion();
    const target = targetVersion ?? this.migrations[this.migrations.length - 1]?.version ?? 0;

    if (target === currentVersion) {
      return [];
    }

    const results: MigrationResult[] = [];

    if (target > currentVersion) {
      // 向前迁移
      const pending = this.migrations.filter(m => m.version > currentVersion && m.version <= target);
      for (const migration of pending) {
        const result = await this.applyMigration(migration, 'up');
        results.push(result);
        if (!result.success) break;
      }
    } else {
      // 向后回滚
      const toRollback = this.migrations
        .filter(m => m.version <= currentVersion && m.version > target)
        .sort((a, b) => b.version - a.version);
      for (const migration of toRollback) {
        const result = await this.applyMigration(migration, 'down');
        results.push(result);
        if (!result.success) break;
      }
    }

    return results;
  }

  /**
   * 执行最新迁移
   */
  async migrate(): Promise<MigrationResult[]> {
    return this.migrateTo();
  }

  /**
   * 回滚指定数量的迁移
   */
  async rollback(steps: number = 1): Promise<MigrationResult[]> {
    const status = await this.getStatus();
    const targetIndex = Math.max(0, status.applied.length - steps);
    const targetVersion = status.applied[targetIndex - 1]?.version || 0;
    return this.migrateTo(targetVersion);
  }

  /**
   * 重新运行当前版本的迁移
   */
  async redo(): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    const rollbackResult = await this.rollback(1);
    results.push(...rollbackResult);
    if (rollbackResult.every(r => r.success)) {
      const migrateResult = await this.migrate();
      results.push(...migrateResult);
    }
    return results;
  }

  /**
   * 应用单个迁移
   */
  private async applyMigration(
    migration: Migration,
    direction: 'up' | 'down'
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    const sql = direction === 'up' ? migration.up : migration.down;
    const checksum = this.calculateChecksum(sql);

    try {
      // 在事务中执行迁移
      await this.pool.transaction(async (db) => {
        // 执行迁移SQL
        db.exec(sql);

        if (direction === 'up') {
          // 记录迁移历史
          db.prepare(
            `INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) 
             VALUES (?, ?, ?, ?)`
          ).run(
            migration.version,
            migration.name,
            checksum,
            Date.now() - startTime
          );
        } else {
          // 删除迁移历史
          db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(migration.version);
        }
      });

      return {
        success: true,
        version: migration.version,
        name: migration.name,
        direction,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        version: migration.version,
        name: migration.name,
        direction,
        executionTimeMs: Date.now() - startTime,
        error: errorMessage,
      };
    }
  }

  /**
   * 确保迁移表存在
   */
  private async ensureMigrationTable(): Promise<void> {
    await this.pool.run(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER UNIQUE NOT NULL,
        name TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        checksum TEXT,
        execution_time_ms INTEGER
      )
    `);
  }

  /**
   * 获取当前版本号
   */
  private async getCurrentVersion(): Promise<number> {
    const result = await this.pool.get<{ version: number }>(
      'SELECT MAX(version) as version FROM schema_migrations'
    );
    return result?.version || 0;
  }

  /**
   * 计算校验和
   */
  private calculateChecksum(sql: string): string {
    return crypto.createHash('sha256').update(sql).digest('hex').substring(0, 16);
  }

  /**
   * 验证迁移完整性
   */
  async verifyIntegrity(): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    await this.ensureMigrationTable();
    const issues: string[] = [];

    const applied = await this.pool.query<{
      version: number;
      name: string;
      checksum: string;
    }>('SELECT version, name, checksum FROM schema_migrations');

    for (const row of applied.rows) {
      const migration = this.migrations.find(m => m.version === row.version);
      if (!migration) {
        issues.push(`Version ${row.version} (${row.name}) is applied but not registered`);
        continue;
      }

      const expectedChecksum = this.calculateChecksum(migration.up);
      if (row.checksum && row.checksum !== expectedChecksum) {
        issues.push(
          `Version ${row.version} (${row.name}) checksum mismatch: expected ${expectedChecksum}, got ${row.checksum}`
        );
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * 创建新迁移文件模板（辅助方法）
   */
  static createMigrationTemplate(name: string, version: number): Migration {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return {
      version,
      name: `${timestamp}_${name}`,
      up: `-- Migration: ${name}\n-- Version: ${version}\n\n-- Add your UP migration here\n`,
      down: `-- Rollback: ${name}\n-- Version: ${version}\n\n-- Add your DOWN migration here\n`,
    };
  }
}

/**
 * 内置迁移集合
 */
export const BUILT_IN_MIGRATIONS: Migration[] = [
  // Migration 1: 初始表结构
  {
    version: 1,
    name: 'initial_schema',
    up: `
      -- 记忆类型
      CREATE TABLE IF NOT EXISTS memory_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        default_ttl_seconds INTEGER,
        importance_weight REAL DEFAULT 1.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      INSERT OR IGNORE INTO memory_types (id, name, description, default_ttl_seconds, importance_weight) VALUES
        (1, 'working', '工作记忆 - 当前会话上下文', 3600, 1.0),
        (2, 'episodic', '情景记忆 - 具体事件记录', 86400, 1.0),
        (3, 'semantic', '语义记忆 - 知识抽象', NULL, 1.2),
        (4, 'procedural', '程序记忆 - 技能掌握', NULL, 1.1),
        (5, 'reflective', '反思记忆 - 元认知洞察', NULL, 1.3);

      -- 核心记忆表
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type_id INTEGER NOT NULL REFERENCES memory_types(id),
        content TEXT NOT NULL,
        content_hash TEXT,
        embedding BLOB,
        embedding_model TEXT,
        importance REAL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
        emotional_weight REAL DEFAULT 1.0 CHECK (emotional_weight >= 0 AND emotional_weight <= 2),
        retention_score REAL DEFAULT 1.0 CHECK (retention_score >= 0 AND retention_score <= 1),
        access_count INTEGER DEFAULT 0,
        last_accessed_at DATETIME,
        consolidated BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        deleted_at DATETIME
      );

      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type_id);
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_active ON memories(deleted_at) WHERE deleted_at IS NULL;

      -- FTS5全文搜索
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        content,
        memory_id UNINDEXED,
        content='memories',
        content_rowid='id'
      );

      CREATE TRIGGER IF NOT EXISTS memories_fts_insert AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(content, memory_id) VALUES (NEW.content, NEW.id);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_fts_delete AFTER DELETE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, content, memory_id) 
        VALUES ('delete', OLD.id, OLD.content, OLD.id);
      END;

      -- 标签系统
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        color TEXT DEFAULT '#6366f1',
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS memory_tags (
        memory_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        confidence REAL DEFAULT 1.0,
        tagged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (memory_id, tag_id)
      );

      -- 记忆关联
      CREATE TABLE IF NOT EXISTS memory_associations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_memory_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
        target_memory_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
        strength REAL DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
        association_type TEXT DEFAULT 'semantic',
        evidence TEXT,
        similarity_score REAL,
        is_auto_generated BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(source_memory_id, target_memory_id),
        CHECK (source_memory_id != target_memory_id)
      );

      CREATE INDEX IF NOT EXISTS idx_associations_source ON memory_associations(source_memory_id);
      CREATE INDEX IF NOT EXISTS idx_associations_strength ON memory_associations(strength DESC);

      -- 配置表
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      INSERT OR IGNORE INTO config (key, value, description) VALUES
        ('db.version', '1', '数据库版本'),
        ('embedding.enabled', 'true', '是否启用向量化'),
        ('embedding.provider', 'ollama', '嵌入服务提供商'),
        ('embedding.model', 'nomic-embed-text', '嵌入模型'),
        ('memory.max_count', '10000', '最大记忆数'),
        ('memory.similarity_threshold', '0.7', '相似度阈值');
    `,
    down: `
      DROP TABLE IF EXISTS memory_tags;
      DROP TABLE IF EXISTS tags;
      DROP TABLE IF EXISTS memory_associations;
      DROP TABLE IF EXISTS memories_fts;
      DROP TABLE IF EXISTS memories;
      DROP TABLE IF EXISTS memory_types;
      DROP TABLE IF EXISTS config;
    `,
  },

  // Migration 2: 身体图式和稳态监控
  {
    version: 2,
    name: 'embodiment_and_homeostasis',
    up: `
      CREATE TABLE IF NOT EXISTS body_schema_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pid INTEGER NOT NULL,
        ppid INTEGER,
        uid INTEGER,
        gid INTEGER,
        cwd TEXT,
        executable TEXT,
        cpu_percent REAL,
        memory_rss INTEGER,
        memory_heap_total INTEGER,
        memory_heap_used INTEGER,
        memory_external INTEGER,
        hostname TEXT,
        platform TEXT,
        uptime_seconds REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_body_schema_created ON body_schema_snapshots(created_at DESC);

      CREATE TABLE IF NOT EXISTS homeostasis_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_name TEXT NOT NULL,
        metric_value REAL NOT NULL,
        metric_unit TEXT,
        threshold_warning REAL,
        threshold_critical REAL,
        status TEXT DEFAULT 'normal',
        metadata TEXT,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_homeostasis_name ON homeostasis_metrics(metric_name);
      CREATE INDEX IF NOT EXISTS idx_homeostasis_recorded ON homeostasis_metrics(recorded_at DESC);

      CREATE TABLE IF NOT EXISTS hormone_levels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hormone_name TEXT NOT NULL,
        level REAL NOT NULL CHECK (level >= 0 AND level <= 1),
        delta REAL,
        reason TEXT,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_hormone_name ON hormone_levels(hormone_name);
      CREATE INDEX IF NOT EXISTS idx_hormone_recorded ON hormone_levels(recorded_at DESC);

      UPDATE config SET value = '2' WHERE key = 'db.version';
    `,
    down: `
      DROP TABLE IF EXISTS hormone_levels;
      DROP TABLE IF EXISTS homeostasis_metrics;
      DROP TABLE IF EXISTS body_schema_snapshots;
      UPDATE config SET value = '1' WHERE key = 'db.version';
    `,
  },

  // Migration 3: 高级记忆功能
  {
    version: 3,
    name: 'advanced_memory_features',
    up: `
      -- 时间线表
      CREATE TABLE IF NOT EXISTS timeline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_id INTEGER REFERENCES memories(id) ON DELETE SET NULL,
        event_type TEXT NOT NULL,
        event_name TEXT NOT NULL,
        event_data TEXT,
        occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        participant_type TEXT,
        participant_id TEXT,
        session_id TEXT,
        conversation_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_timeline_memory ON timeline(memory_id);
      CREATE INDEX IF NOT EXISTS idx_timeline_occurred ON timeline(occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_timeline_session ON timeline(session_id);

      -- 贝叶斯信念表
      CREATE TABLE IF NOT EXISTS bayesian_beliefs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        capability TEXT UNIQUE NOT NULL,
        alpha REAL DEFAULT 1.0,
        beta REAL DEFAULT 1.0,
        confidence REAL DEFAULT 0.5,
        uncertainty REAL DEFAULT 0.25,
        success_count INTEGER DEFAULT 0,
        fail_count INTEGER DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        context TEXT
      );

      -- 技能表
      CREATE TABLE IF NOT EXISTS skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_id INTEGER REFERENCES memories(id) ON DELETE CASCADE,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        category TEXT,
        proficiency REAL DEFAULT 0.0 CHECK (proficiency >= 0 AND proficiency <= 1),
        usage_count INTEGER DEFAULT 0,
        last_used_at DATETIME,
        avg_success_rate REAL DEFAULT 0.0,
        implementation_type TEXT,
        implementation_path TEXT,
        dependencies TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_skills_proficiency ON skills(proficiency DESC);

      -- 反思表
      CREATE TABLE IF NOT EXISTS reflections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_id INTEGER REFERENCES memories(id) ON DELETE CASCADE,
        trigger_type TEXT,
        trigger_context TEXT,
        insight TEXT NOT NULL,
        biases_detected TEXT,
        recommendations TEXT,
        related_memories TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- 添加触发器： memories_fts_update
      CREATE TRIGGER IF NOT EXISTS memories_fts_update AFTER UPDATE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, content, memory_id) 
        VALUES ('delete', OLD.id, OLD.content, OLD.id);
        INSERT INTO memories_fts(content, memory_id) VALUES (NEW.content, NEW.id);
      END;

      -- 添加缺失的索引
      CREATE INDEX IF NOT EXISTS idx_memories_retention ON memories(retention_score DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_consolidated ON memories(consolidated) WHERE consolidated = TRUE;
      CREATE INDEX IF NOT EXISTS idx_memories_hash ON memories(content_hash) WHERE content_hash IS NOT NULL AND deleted_at IS NULL;

      UPDATE config SET value = '3' WHERE key = 'db.version';
    `,
    down: `
      DROP TABLE IF EXISTS reflections;
      DROP TABLE IF EXISTS skills;
      DROP TABLE IF EXISTS bayesian_beliefs;
      DROP TABLE IF EXISTS timeline;
      DROP TRIGGER IF EXISTS memories_fts_update;
      DROP INDEX IF EXISTS idx_memories_retention;
      DROP INDEX IF EXISTS idx_memories_consolidated;
      DROP INDEX IF EXISTS idx_memories_hash;
      UPDATE config SET value = '2' WHERE key = 'db.version';
    `,
  },
];

export default MigrationManager;
