/**
 * State Manager - 状态管理器
 * 管理Agent的状态切换和持久化
 */

import { SQLiteConnectionPool, QueryResult } from '../db/connection.js';
import { createModuleLogger } from '../utils/logger.js';
import type { Logger as ILogger } from '../types.js';

export type StateType = 'serving' | 'evolving' | 'shutdown' | 'error';

interface StateRecord {
  state: StateType;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export class AgentState {
  private currentState: StateType = 'serving';
  private readonly logger: ILogger;

  constructor(private database: SQLiteConnectionPool) {
    this.logger = createModuleLogger('AgentState');
  }

  async initialize(): Promise<void> {
    // 从数据库恢复状态
    const saved = await this.loadFromDatabase();
    if (saved) {
      this.currentState = saved.state;
      this.logger.info(`State restored: ${saved.state}`);
    }
  }

  async switchTo(state: StateType, metadata?: Record<string, unknown>): Promise<void> {
    const previousState = this.currentState;
    this.currentState = state;
    
    await this.saveToDatabase({
      state,
      timestamp: new Date().toISOString(),
      metadata: { ...metadata, previousState }
    });
    
    this.logger.info(`State switched: ${previousState} -> ${state}`);
  }

  getState(): StateType {
    return this.currentState;
  }

  async saveState(): Promise<void> {
    await this.saveToDatabase({
      state: this.currentState,
      timestamp: new Date().toISOString()
    });
  }

  private async loadFromDatabase(): Promise<StateRecord | null> {
    try {
      const result = await this.database.get<StateRecord>(
        'SELECT * FROM agent_state ORDER BY timestamp DESC LIMIT 1'
      );
      return result || null;
    } catch {
      return null;
    }
  }

  private async saveToDatabase(record: StateRecord): Promise<void> {
    await this.database.run(
      'INSERT INTO agent_state (state, timestamp, metadata) VALUES (?, ?, ?)',
      [record.state, record.timestamp, JSON.stringify(record.metadata || {})]
    );
  }
}

export default AgentState;
