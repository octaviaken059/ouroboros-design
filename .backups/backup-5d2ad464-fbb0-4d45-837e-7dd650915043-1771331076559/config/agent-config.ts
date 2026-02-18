/**
 * AgentConfig - 配置管理器
 * 管理Agent的所有配置
 */

import * as fs from 'fs';
import * as path from 'path';

export interface AgentConfig {
  database: {
    path: string;
    poolSize: number;
  };
  models: {
    default: string;
    providers: Record<string, {
      apiKey: string;
      baseUrl?: string;
    }>;
  };
  homeostasis: {
    enabled: boolean;
    checkInterval: number;
    thresholds: {
      cpu: number;
      memory: number;
      disk: number;
    };
  };
  evolution: {
    enabled: boolean;
    idleThreshold: number;
    tasks: string[];
  };
  safety: {
    level: 'strict' | 'moderate' | 'permissive';
    allowedCommands: string[];
    blockedPatterns: string[];
  };
  memory: {
    vectorEnabled: boolean;
    embeddingModel: string;
    maxWorkingMemory: number;
  };
}

const DEFAULT_CONFIG: AgentConfig = {
  database: {
    path: './data/agent.db',
    poolSize: 5
  },
  models: {
    default: 'gpt-4',
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY || ''
      }
    }
  },
  homeostasis: {
    enabled: true,
    checkInterval: 60000,
    thresholds: {
      cpu: 80,
      memory: 85,
      disk: 90
    }
  },
  evolution: {
    enabled: true,
    idleThreshold: 300000, // 5 minutes
    tasks: ['capability_mining', 'reflection', 'learning', 'summarization']
  },
  safety: {
    level: 'strict',
    allowedCommands: [],
    blockedPatterns: [
      'rm -rf /',
      'format',
      'drop database'
    ]
  },
  memory: {
    vectorEnabled: true,
    embeddingModel: 'nomic-embed-text',
    maxWorkingMemory: 7
  }
};

export class ConfigManager {
  private config: AgentConfig;
  private configPath?: string;

  constructor(configPath?: string) {
    this.configPath = configPath;
    this.config = this.loadConfig();
  }

  private loadConfig(): AgentConfig {
    let fileConfig: Partial<AgentConfig> = {};
    
    if (this.configPath && fs.existsSync(this.configPath)) {
      try {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        fileConfig = JSON.parse(content);
      } catch (error) {
        console.warn(`Failed to load config from ${this.configPath}:`, error);
      }
    }
    
    // 合并默认配置、文件配置和环境变量
    return this.mergeConfigs(DEFAULT_CONFIG, fileConfig);
  }

  private mergeConfigs(
    defaultConfig: AgentConfig, 
    fileConfig: Partial<AgentConfig>
  ): AgentConfig {
    return {
      database: { ...defaultConfig.database, ...fileConfig.database },
      models: { 
        ...defaultConfig.models, 
        ...fileConfig.models,
        providers: {
          ...defaultConfig.models.providers,
          ...fileConfig.models?.providers
        }
      },
      homeostasis: { ...defaultConfig.homeostasis, ...fileConfig.homeostasis },
      evolution: { ...defaultConfig.evolution, ...fileConfig.evolution },
      safety: { ...defaultConfig.safety, ...fileConfig.safety },
      memory: { ...defaultConfig.memory, ...fileConfig.memory }
    };
  }

  get<K extends keyof AgentConfig>(key: K): AgentConfig[K];
  get<T>(key: string, defaultValue?: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    const keys = key.split('.');
    let value: unknown = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[k];
      } else {
        return defaultValue;
      }
    }
    
    return (value as T) ?? defaultValue;
  }

  set<K extends keyof AgentConfig>(key: K, value: AgentConfig[K]): void {
    this.config[key] = value;
  }

  getAll(): AgentConfig {
    return { ...this.config };
  }

  save(): void {
    if (this.configPath) {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    }
  }
}

export default ConfigManager;
