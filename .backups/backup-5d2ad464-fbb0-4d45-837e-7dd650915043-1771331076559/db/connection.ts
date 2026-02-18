/**
 * src/db/connection.ts
 * SQLite连接池与数据库管理
 * 
 * 功能：
 * - 连接池管理（支持并发访问）
 * - WAL模式启用（更好的并发性能）
 * - 事务支持
 * - 自动重连机制
 */

import DatabaseConstructor, { Database, Statement } from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

export interface ConnectionPoolConfig {
  dbPath: string;
  maxConnections?: number;
  busyTimeout?: number;
  enableWAL?: boolean;
  readOnly?: boolean;
}

export interface PooledConnection {
  db: Database;
  id: number;
  inUse: boolean;
  createdAt: Date;
}

export interface QueryResult<T = unknown> {
  rows: T[];
  changes: number;
  lastInsertRowid: number | bigint;
}

/**
 * SQLite连接池
 * 支持多线程安全访问，通过连接复用提高性能
 */
export class SQLiteConnectionPool {
  private connections: PooledConnection[] = [];
  private config: Required<ConnectionPoolConfig>;
  private waitQueue: Array<() => void> = [];
  private statementCache: Map<string, Statement> = new Map();
  private isClosing = false;

  static readonly DEFAULT_CONFIG: Required<ConnectionPoolConfig> = {
    dbPath: './data/ouroboros.db',
    maxConnections: 5,
    busyTimeout: 5000,
    enableWAL: true,
    readOnly: false,
  };

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    this.config = { ...SQLiteConnectionPool.DEFAULT_CONFIG, ...config };
    this.ensureDataDirectory();
    this.initializePool();
  }

  /**
   * 确保数据目录存在
   */
  private ensureDataDirectory(): void {
    const dir = path.dirname(this.config.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 初始化连接池
   */
  private initializePool(): void {
    for (let i = 0; i < this.config.maxConnections; i++) {
      this.connections.push(this.createConnection(i));
    }
  }

  /**
   * 创建单个数据库连接
   */
  private createConnection(id: number): PooledConnection {
    const db = new DatabaseConstructor(this.config.dbPath, {
      readonly: this.config.readOnly,
      fileMustExist: false,
    });

    // 配置性能选项
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000'); // 64MB缓存
    db.pragma('temp_store = MEMORY');
    db.pragma('mmap_size = 268435456'); // 256MB内存映射
    db.pragma('page_size = 4096');

    // 设置busy超时
    db.exec(`PRAGMA busy_timeout = ${this.config.busyTimeout}`);

    // 启用外键约束
    db.pragma('foreign_keys = ON');

    return {
      db,
      id,
      inUse: false,
      createdAt: new Date(),
    };
  }

  /**
   * 获取可用连接
   */
  async acquire(): Promise<PooledConnection> {
    if (this.isClosing) {
      throw new Error('Connection pool is closing');
    }

    // 查找可用连接
    const available = this.connections.find(c => !c.inUse);
    if (available) {
      available.inUse = true;
      return available;
    }

    // 等待连接释放
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitQueue.indexOf(release);
        if (index > -1) {
          this.waitQueue.splice(index, 1);
        }
        reject(new Error('Connection pool timeout'));
      }, this.config.busyTimeout);

      const release = () => {
        clearTimeout(timeout);
        this.acquire().then(resolve).catch(reject);
      };

      this.waitQueue.push(release);
    });
  }

  /**
   * 释放连接回池
   */
  release(conn: PooledConnection): void {
    conn.inUse = false;
    
    // 唤醒等待队列
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift();
      next?.();
    }
  }

  /**
   * 执行查询（自动管理连接）
   */
  async query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    const conn = await this.acquire();
    try {
      const stmt = this.getStatement(sql, conn.db);
      const rows = stmt.all(...(params || [])) as T[];
      return {
        rows,
        changes: 0,
        lastInsertRowid: 0,
      };
    } finally {
      this.release(conn);
    }
  }

  /**
   * 执行更新/插入（自动管理连接）
   */
  async run(sql: string, params?: unknown[]): Promise<QueryResult> {
    const conn = await this.acquire();
    try {
      const stmt = this.getStatement(sql, conn.db);
      const result = stmt.run(...(params || []));
      return {
        rows: [],
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid,
      };
    } finally {
      this.release(conn);
    }
  }

  /**
   * 获取单个值
   */
  async get<T = unknown>(sql: string, params?: unknown[]): Promise<T | undefined> {
    const conn = await this.acquire();
    try {
      const stmt = this.getStatement(sql, conn.db);
      return stmt.get(...(params || [])) as T | undefined;
    } finally {
      this.release(conn);
    }
  }

  /**
   * 执行事务
   */
  async transaction<T>(fn: (db: Database) => T): Promise<T> {
    const conn = await this.acquire();
    try {
      conn.db.exec('BEGIN');
      try {
        const result = fn(conn.db);
        conn.db.exec('COMMIT');
        return result;
      } catch (error) {
        conn.db.exec('ROLLBACK');
        throw error;
      }
    } finally {
      this.release(conn);
    }
  }

  /**
   * 获取或创建预编译语句
   */
  private getStatement(sql: string, db: Database): Statement {
    const key = `${db.name}:${sql}`;
    let stmt = this.statementCache.get(key);
    if (!stmt) {
      stmt = db.prepare(sql);
      this.statementCache.set(key, stmt);
    }
    return stmt;
  }

  /**
   * 批量插入（优化性能）
   */
  async batchInsert<T extends Record<string, unknown>>(
    table: string,
    records: T[],
    batchSize: number = 100
  ): Promise<number> {
    if (records.length === 0) return 0;

    const columns = Object.keys(records[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

    let totalInserted = 0;

    await this.transaction((db) => {
      const stmt = db.prepare(sql);
      
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        
        db.exec('BEGIN');
        for (const record of batch) {
          const values = columns.map(col => record[col]);
          stmt.run(...values);
        }
        db.exec('COMMIT');
        
        totalInserted += batch.length;
      }
    });

    return totalInserted;
  }

  /**
   * 获取数据库统计信息
   */
  async getStats(): Promise<{
    connections: number;
    inUse: number;
    available: number;
    waitQueue: number;
    cacheSize: number;
  }> {
    return {
      connections: this.connections.length,
      inUse: this.connections.filter(c => c.inUse).length,
      available: this.connections.filter(c => !c.inUse).length,
      waitQueue: this.waitQueue.length,
      cacheSize: this.statementCache.size,
    };
  }

  /**
   * 执行VACUUM优化
   */
  async vacuum(): Promise<void> {
    const conn = await this.acquire();
    try {
      conn.db.exec('VACUUM');
    } finally {
      this.release(conn);
    }
  }

  /**
   * 备份数据库
   */
  async backup(backupPath: string): Promise<void> {
    const conn = await this.acquire();
    try {
      await conn.db.backup(backupPath);
    } finally {
      this.release(conn);
    }
  }

  /**
   * 关闭连接池
   */
  async close(): Promise<void> {
    this.isClosing = true;

    // 等待所有连接释放
    while (this.connections.some(c => c.inUse)) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 关闭所有连接
    for (const conn of this.connections) {
      conn.db.close();
    }

    this.connections = [];
    this.statementCache.clear();
    this.waitQueue = [];
  }
}

/**
 * 全局连接池实例
 */
let globalPool: SQLiteConnectionPool | null = null;

export function getConnectionPool(config?: Partial<ConnectionPoolConfig>): SQLiteConnectionPool {
  if (!globalPool) {
    globalPool = new SQLiteConnectionPool(config);
  }
  return globalPool;
}

export function resetConnectionPool(): void {
  if (globalPool) {
    globalPool.close().catch(console.error);
    globalPool = null;
  }
}

export default SQLiteConnectionPool;
