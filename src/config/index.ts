/**
 * @file config/index.ts
 * @description 配置模块入口
 * @author Ouroboros
 * @date 2026-02-18
 */

export * from './types';
export * from './defaults';
export {
  loadConfig,
  saveConfig,
  getConfig,
  reloadConfig,
  updateConfig,
  resetToDefault,
} from './loader';
