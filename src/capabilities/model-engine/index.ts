/**
 * @file capabilities/model-engine/index.ts
 * @description 模型引擎模块导出
 * @author Ouroboros
 * @date 2026-02-18
 */

export * from '@/types/model';
export { ModelClient } from './model-client';
export { TokenBudgetManager } from './token-budget-manager';
export { PromptAssembler } from './prompt-assembler';
export { PerformanceMonitor } from './performance-monitor';

/**
 * 模型引擎完整示例
 *
 * ```typescript
 * import {
 *   ModelClient,
 *   PromptAssembler,
 *   TokenBudgetManager,
 *   PerformanceMonitor,
 * } from '@/capabilities/model-engine';
 *
 * // 1. 创建组件
 * const modelClient = new ModelClient({
 *   provider: 'ollama',
 *   model: 'deepseek-r1:8b',
 *   baseUrl: 'http://localhost:11434',
 * });
 *
 * const assembler = new PromptAssembler(undefined, 4096);
 * const budgetManager = new TokenBudgetManager(4096);
 * const monitor = new PerformanceMonitor();
 *
 * // 2. 组装提示词
 * const prompt = assembler.assemble({
 *   systemPrompt: '你是AI助手',
 *   selfDescription: '当前状态: 正常',
 *   memoryContext: '用户喜欢简洁回答',
 *   userInput: '你好',
 * });
 *
 * // 3. 发送请求
 * const messages = assembler.createMessages(prompt);
 * const response = await modelClient.chat(messages);
 *
 * // 4. 记录性能
 * monitor.record({
 *   model: 'deepseek-r1:8b',
 *   inputTokens: response.tokens.prompt,
 *   outputTokens: response.tokens.completion,
 *   responseTimeMs: response.responseTimeMs,
 *   success: true,
 *   timestamp: new Date().toISOString(),
 * });
 *
 * // 5. 获取报告
 * console.log(monitor.generateReport());
 * ```
 */
