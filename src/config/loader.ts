/**
 * @file config/loader.ts
 * @description 配置加载器 - 从 JSON 文件加载配置
 * @author Ouroboros
 * @date 2026-02-18
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import type { OuroborosConfig } from './types';
import { DEFAULT_CONFIG } from './defaults';
import { createContextLogger } from '@/utils/logger';
import { ConfigError } from '@/utils/error';

const logger = createContextLogger('ConfigLoader');

/** 单例配置实例 */
let configInstance: OuroborosConfig | null = null;

/**
 * 深度合并配置对象
 * @param target 目标配置
 * @param source 源配置（用户配置）
 * @returns 合并后的配置
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
      vectorStore: { ...target.memory.vectorStore, ...source.memory?.vectorStore },
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
 * @param config 配置对象
 * @throws ConfigError 验证失败时抛出
 */
function validateConfig(config: OuroborosConfig): void {
  // 验证核心配置
  if (config.core.cognitiveDecayRate < 0 || config.core.cognitiveDecayRate > 1) {
    throw new ConfigError('cognitiveDecayRate 必须在 0-1 之间', 'ConfigLoader.validateConfig');
  }

  // 验证激素配置
  for (const hormone of Object.keys(config.hormone.baselineLevels)) {
    const base = config.hormone.baselineLevels[hormone as keyof typeof config.hormone.baselineLevels];
    const max = config.hormone.maxLevels[hormone as keyof typeof config.hormone.maxLevels];
    const min = config.hormone.minLevels[hormone as keyof typeof config.hormone.minLevels];

    if (base < min || base > max) {
      throw new ConfigError(
        `激素 ${hormone} 的基础水平 ${base} 超出范围 [${min}, ${max}]`,
        'ConfigLoader.validateConfig'
      );
    }
  }

  // 验证模型配置
  if (config.model.totalTokenBudget <= 0) {
    throw new ConfigError('totalTokenBudget 必须大于 0', 'ConfigLoader.validateConfig');
  }

  // 验证 Token 预算比例
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
 * 加载配置
 * @param configPath 配置文件路径
 * @returns 配置对象
 */
export function loadConfig(configPath?: string): OuroborosConfig {
  try {
    const path = configPath ?? join(process.cwd(), 'config.json');

    // 如果配置文件不存在，创建默认配置
    if (!existsSync(path)) {
      logger.info('配置文件不存在，创建默认配置', { path });
      saveConfig(DEFAULT_CONFIG, path);
      return DEFAULT_CONFIG;
    }

    // 读取并解析配置
    const content = readFileSync(path, 'utf-8');
    const userConfig = JSON.parse(content) as Partial<OuroborosConfig>;

    // 合并用户配置和默认配置
    const mergedConfig = mergeConfig(DEFAULT_CONFIG, userConfig);

    // 验证配置
    validateConfig(mergedConfig);

    logger.info('配置加载成功', { path });

    return mergedConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigError(`加载配置失败: ${message}`, 'ConfigLoader.loadConfig');
  }
}

/**
 * 保存配置到文件
 * @param config 配置对象
 * @param configPath 配置文件路径
 */
export function saveConfig(config: OuroborosConfig, configPath?: string): void {
  try {
    const path = configPath ?? join(process.cwd(), 'config.json');

    // 确保目录存在
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // 写入配置
    writeFileSync(path, JSON.stringify(config, null, 2), 'utf-8');

    logger.info('配置已保存', { path });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigError(`保存配置失败: ${message}`, 'ConfigLoader.saveConfig');
  }
}

/**
 * 获取配置单例
 * @returns 配置对象
 * @throws ConfigError 如果配置未加载
 */
export function getConfig(): OuroborosConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

/**
 * 重新加载配置
 * @param configPath 配置文件路径
 * @returns 新的配置对象
 */
export function reloadConfig(configPath?: string): OuroborosConfig {
  configInstance = loadConfig(configPath);
  return configInstance;
}

/**
 * 更新配置
 * @param updates 部分配置更新
 */
export function updateConfig(updates: Partial<OuroborosConfig>): void {
  const current = getConfig();
  configInstance = mergeConfig(current, updates);
  logger.info('配置已更新');
}

/**
 * 重置为默认配置
 */
export function resetToDefault(): void {
  configInstance = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  logger.info('配置已重置为默认值');
}
