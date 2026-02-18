/**
 * @file config/loader.ts
 * @description 配置加载器 - 支持文件和数据库，热重载
 * @author Ouroboros
 * @date 2026-02-18
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, watch, FSWatcher } from 'fs';
import { dirname, join } from 'path';
import type { OuroborosConfig } from './types';
import { DEFAULT_CONFIG } from './defaults';
import { createContextLogger } from '@/utils/logger';
import { ConfigError } from '@/utils/error';
import { loadConfigFromDb, saveConfigToDb } from '@/db/persistence';

const logger = createContextLogger('ConfigLoader');

/** 单例配置实例 */
let configInstance: OuroborosConfig | null = null;

/** 文件监听器 */
let configWatcher: FSWatcher | null = null;

/** 热重载回调列表 */
const reloadCallbacks: Array<(config: OuroborosConfig) => void> = [];

/**
 * 深度合并配置对象
 */
function mergeConfig(
  target: OuroborosConfig,
  source: Partial<OuroborosConfig>
): OuroborosConfig {
  return {
    version: source.version ?? target.version,
    core: { ...target.core, ...source.core },
    hormone: {
      baselineLevels: { ...target.hormone.baselineLevels, ...source.hormone?.baselineLevels },
      decayRates: { ...target.hormone.decayRates, ...source.hormone?.decayRates },
      maxLevels: { ...target.hormone.maxLevels, ...source.hormone?.maxLevels },
      minLevels: { ...target.hormone.minLevels, ...source.hormone?.minLevels },
      updateIntervalMs: source.hormone?.updateIntervalMs ?? target.hormone.updateIntervalMs,
      triggerCheckIntervalMs: source.hormone?.triggerCheckIntervalMs ?? target.hormone.triggerCheckIntervalMs,
    },
    model: {
      defaultModel: { ...target.model.defaultModel, ...source.model?.defaultModel },
      fallbackModel: source.model?.fallbackModel
        ? { ...target.model.fallbackModel, ...source.model.fallbackModel }
        : target.model.fallbackModel,
      tokenBudget: { ...target.model.tokenBudget, ...source.model?.tokenBudget },
      totalTokenBudget: source.model?.totalTokenBudget ?? target.model.totalTokenBudget,
      maxRetries: source.model?.maxRetries ?? target.model.maxRetries,
      retryDelayMs: source.model?.retryDelayMs ?? target.model.retryDelayMs,
      performanceMonitorMaxRecords: source.model?.performanceMonitorMaxRecords ?? target.model.performanceMonitorMaxRecords,
    },
    memory: {
      shortTermCapacity: source.memory?.shortTermCapacity ?? target.memory.shortTermCapacity,
      longTermStorageDir: source.memory?.longTermStorageDir ?? target.memory.longTermStorageDir,
      consolidationThreshold: source.memory?.consolidationThreshold ?? target.memory.consolidationThreshold,
      forgettingRate: source.memory?.forgettingRate ?? target.memory.forgettingRate,
      maxMemories: source.memory?.maxMemories ?? target.memory.maxMemories,
      autoArchiveDays: source.memory?.autoArchiveDays ?? target.memory.autoArchiveDays,
      vectorStore: { ...target.memory.vectorStore, ...source.memory?.vectorStore },
      retrieval: { ...target.memory.retrieval, ...source.memory?.retrieval },
    },
    tool: { ...target.tool, ...source.tool },
    safety: { ...target.safety, ...source.safety },
    evolution: { ...target.evolution, ...source.evolution },
    log: { ...target.log, ...source.log },
    adapter: {
      web: { ...target.adapter.web, ...source.adapter?.web },
      mcp: { ...target.adapter.mcp, ...source.adapter?.mcp },
      websocket: { ...target.adapter.websocket, ...source.adapter?.websocket },
    },
  };
}

/**
 * 验证配置
 */
function validateConfig(config: OuroborosConfig): void {
  if (config.core.cognitiveDecayRate < 0 || config.core.cognitiveDecayRate > 1) {
    throw new ConfigError('cognitiveDecayRate 必须在 0-1 之间', 'ConfigLoader.validateConfig');
  }

  if (config.model.totalTokenBudget <= 0) {
    throw new ConfigError('totalTokenBudget 必须大于 0', 'ConfigLoader.validateConfig');
  }

  const budgetSum = Object.values(config.model.tokenBudget).reduce((a, b) => a + b, 0);
  if (Math.abs(budgetSum - 1) > 0.001) {
    throw new ConfigError(
      `Token 预算比例总和必须为 1，当前为 ${budgetSum}`,
      'ConfigLoader.validateConfig'
    );
  }

  logger.debug('配置验证通过');
}

/**
 * 从文件加载配置
 */
function loadFromFile(configPath: string): OuroborosConfig | null {
  if (!existsSync(configPath)) {
    return null;
  }

  const content = readFileSync(configPath, 'utf-8');
  const userConfig = JSON.parse(content) as Partial<OuroborosConfig>;
  return mergeConfig(DEFAULT_CONFIG, userConfig);
}

/**
 * 加载配置（优先从数据库，其次文件）
 * @param configPath 配置文件路径
 * @param useDb 是否使用数据库
 * @returns 配置对象
 */
export function loadConfig(
  configPath?: string,
  useDb = true
): OuroborosConfig {
  const path = configPath ?? join(process.cwd(), 'config.json');

  // 1. 尝试从数据库加载
  if (useDb) {
    const dbConfig = loadConfigFromDb();
    if (dbConfig) {
      validateConfig(dbConfig);
      configInstance = dbConfig;
      logger.info('配置已从数据库加载');
      return dbConfig;
    }
  }

  // 2. 从文件加载
  const fileConfig = loadFromFile(path);
  if (fileConfig) {
    validateConfig(fileConfig);
    configInstance = fileConfig;

    // 保存到数据库
    if (useDb) {
      saveConfigToDb(fileConfig);
    }

    logger.info('配置已从文件加载', { path });
    return fileConfig;
  }

  // 3. 使用默认配置并创建文件
  logger.info('配置文件不存在，创建默认配置', { path });
  const config = DEFAULT_CONFIG;
  saveConfig(config, path, useDb);
  configInstance = config;
  return config;
}

/**
 * 保存配置到文件和数据库
 */
export function saveConfig(
  config: OuroborosConfig,
  configPath?: string,
  saveToDb = true
): void {
  const path = configPath ?? join(process.cwd(), 'config.json');

  // 保存到文件
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(config, null, 2), 'utf-8');

  // 保存到数据库
  if (saveToDb) {
    saveConfigToDb(config);
  }

  logger.info('配置已保存', { path });
}

/**
 * 启用配置热重载
 * @param configPath 配置文件路径
 * @param onReload 重载回调
 */
export function enableHotReload(
  configPath?: string,
  onReload?: (config: OuroborosConfig) => void
): void {
  const path = configPath ?? join(process.cwd(), 'config.json');

  if (configWatcher) {
    configWatcher.close();
  }

  configWatcher = watch(path, (eventType) => {
    if (eventType === 'change') {
      try {
        logger.info('检测到配置文件变化，正在重载...');
        const newConfig = loadConfig(path, true);

        // 调用所有回调
        reloadCallbacks.forEach((cb) => cb(newConfig));
        onReload?.(newConfig);

        logger.info('配置热重载完成');
      } catch (error) {
        logger.error('配置热重载失败', { error });
      }
    }
  });

  logger.info('配置热重载已启用', { path });
}

/**
 * 禁用配置热重载
 */
export function disableHotReload(): void {
  if (configWatcher) {
    configWatcher.close();
    configWatcher = null;
    logger.info('配置热重载已禁用');
  }
}

/**
 * 注册热重载回调
 */
export function onConfigReload(callback: (config: OuroborosConfig) => void): void {
  reloadCallbacks.push(callback);
}

/**
 * 获取配置单例
 */
export function getConfig(): OuroborosConfig {
  if (!configInstance) {
    throw new ConfigError('配置未加载', 'ConfigLoader.getConfig');
  }
  return configInstance;
}

/**
 * 重新加载配置
 */
export function reloadConfig(configPath?: string): OuroborosConfig {
  const config = loadConfig(configPath, true);
  configInstance = config;
  return config;
}

/**
 * 更新配置
 */
export function updateConfig(updates: Partial<OuroborosConfig>): void {
  const current = getConfig();
  const newConfig = mergeConfig(current, updates);
  configInstance = newConfig;
  saveConfigToDb(newConfig);
  logger.info('配置已更新');
}

/**
 * 重置为默认配置
 */
export function resetToDefault(): void {
  const defaultConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as OuroborosConfig;
  configInstance = defaultConfig;
  saveConfigToDb(defaultConfig);
  logger.info('配置已重置为默认值');
}
