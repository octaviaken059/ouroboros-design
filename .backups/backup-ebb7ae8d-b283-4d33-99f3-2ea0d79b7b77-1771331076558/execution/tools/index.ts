/**
 * 内置工具集 (Built-in Tools)
 * 
 * Ouroboros 核心工具集合
 * 位置: 执行层/工具层 (Execution Layer / Tool Layer)
 */

import type { ToolDefinition, ToolRegistry } from '../tool-registry.js';

// 导入各分类工具
import { systemTools } from './system.js';
import { fileTools } from './file.js';
import { shellTools } from './shell.js';
import { httpTools } from './http.js';
import { dataTools } from './data.js';
import { utilityTools } from './utility.js';

/**
 * 所有内置工具
 */
export const builtInTools: ToolDefinition[] = [
  ...systemTools,
  ...fileTools,
  ...shellTools,
  ...httpTools,
  ...dataTools,
  ...utilityTools,
];

/**
 * 注册所有内置工具到注册表
 */
export function registerBuiltInTools(registry: ToolRegistry): void {
  registry.registerMany(builtInTools);
}

/**
 * 创建预配置的工具注册表 (包含所有内置工具)
 */
export function createToolRegistryWithBuiltIns(): ToolRegistry {
  const { ToolRegistry } = require('../tool-registry');
  const registry = new ToolRegistry();
  registerBuiltInTools(registry);
  return registry;
}

/**
 * 按分类获取工具
 */
export const toolCategories = {
  system: systemTools,
  file: fileTools,
  shell: shellTools,
  http: httpTools,
  data: dataTools,
  utility: utilityTools,
};

export {
  systemTools,
  fileTools,
  shellTools,
  httpTools,
  dataTools,
  utilityTools,
};

export default builtInTools;
