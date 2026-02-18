/**
 * @file config/index.ts
 * @description 配置模块入口
 * @author Ouroboros
 * @date 2026-02-18
 */

export type {
  OuroborosConfig,
  CoreConfig,
  HormoneConfig,
  ModelEngineConfig,
  MemoryConfig,
  ToolConfig,
  SafetyConfig,
  EvolutionConfig,
  LogConfig,
  AdapterConfig,
} from './types';

export { DEFAULT_CONFIG } from './defaults';

export {
  loadConfig,
  saveConfig,
  getConfig,
  reloadConfig,
  updateConfig,
  resetToDefault,
  enableHotReload,
  disableHotReload,
  onConfigReload,
} from './loader';
