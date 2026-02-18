/**
 * 工具注册中心 (Tool Registry)
 * 
 * 管理所有可用工具的统一注册表
 * 位置: 执行层 (Execution Layer)
 */

import { EventEmitter } from 'events';

export type Tool = ToolDefinition;
export type ExecutionContext = ToolContext;

export interface ParameterSchema {
  type: 'object';
  properties: Record<string, ParameterProperty>;
  required?: string[];
}

export interface ParameterProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: (string | number)[];
  items?: {
    type: string;
    description?: string;
  };
  properties?: Record<string, ParameterProperty>;
}

/** 数组参数格式（用于简单工具定义） */
export interface ArrayParameterSchema {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
}

/** 参数Schema类型（对象格式或数组格式） */
export type ParameterSchemaType = ParameterSchema | ArrayParameterSchema[];

export interface ToolContext {
  /** 调用ID */
  callId: string;
  /** 会话ID */
  sessionId?: string;
  /** 用户ID */
  userId?: string;
  /** 调用时间 */
  timestamp: Date;
  /** 调用来源 */
  source: 'user' | 'agent' | 'system';
  /** 取消信号 */
  cancelSignal?: AbortSignal;
  /** 额外上下文 */
  metadata?: Record<string, unknown>;
}

export interface ToolResult {
  /** 执行成功 */
  success: boolean;
  /** 结果数据 */
  data?: unknown;
  /** 错误信息 */
  error?: string;
  /** 执行耗时(ms) */
  durationMs: number;
  /** 额外元数据 */
  metadata?: Record<string, unknown>;
}

export interface ToolExecutionOptions {
  /** 超时时间(ms) */
  timeoutMs?: number;
  /** 是否重试 */
  retry?: boolean;
  /** 重试次数 */
  maxRetries?: number;
  /** 上下文 */
  context?: Partial<ToolContext>;
}

export type ToolExecuteFn = (
  args: Record<string, unknown>,
  context: ToolContext
) => Promise<unknown>;

export interface ToolDefinition {
  /** 工具唯一标识 */
  name: string;
  /** 工具显示名称 */
  displayName?: string;
  /** 工具描述 */
  description: string;
  /** 参数定义 */
  parameters: ParameterSchema;
  /** 执行函数 */
  execute: ToolExecuteFn;
  /** 工具分类 */
  category?: string;
  /** 标签 */
  tags?: string[];
  /** 是否启用 */
  enabled?: boolean;
  /** 是否需要确认 */
  requireConfirmation?: boolean;
  /** 确认提示模板 */
  confirmationTemplate?: string;
  /** 权限级别 */
  permissionLevel?: 'public' | 'user' | 'admin' | 'system';
  /** 创建时间 */
  createdAt?: Date;
  /** 更新时间 */
  updatedAt?: Date;
  /** 版本 */
  version?: string;
  /** 作者 */
  author?: string;
  /** 验证函数 */
  validate?: (args: Record<string, unknown>) => { valid: boolean; errors?: string[] };
}

export interface ToolCategory {
  /** 分类ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 图标 */
  icon?: string;
  /** 排序权重 */
  weight?: number;
}

export interface ToolSearchOptions {
  /** 搜索关键词 */
  query?: string;
  /** 分类过滤 */
  category?: string;
  /** 标签过滤 */
  tags?: string[];
  /** 是否只返回启用 */
  enabledOnly?: boolean;
  /** 权限级别过滤 */
  permissionLevel?: string;
}

export interface ToolStats {
  /** 总调用次数 */
  totalCalls: number;
  /** 成功次数 */
  successCalls: number;
  /** 失败次数 */
  failedCalls: number;
  /** 平均执行时间(ms) */
  avgDurationMs: number;
  /** 最后调用时间 */
  lastCalledAt?: Date;
  /** 最后错误 */
  lastError?: string;
}

// ============================================================================
// 工具注册中心
// ============================================================================

export class ToolRegistry extends EventEmitter {
  private tools: Map<string, ToolDefinition> = new Map();
  private categories: Map<string, ToolCategory> = new Map();
  private stats: Map<string, ToolStats> = new Map();
  private defaultTimeoutMs = 30000;

  constructor() {
    super();
    this.initializeDefaultCategories();
  }

  /**
   * 初始化默认分类
   */
  private initializeDefaultCategories(): void {
    const defaults: ToolCategory[] = [
      { id: 'system', name: '系统工具', description: '系统级操作工具', weight: 0 },
      { id: 'file', name: '文件工具', description: '文件读写操作', weight: 10 },
      { id: 'network', name: '网络工具', description: '网络请求和通信', weight: 20 },
      { id: 'data', name: '数据处理', description: '数据处理和分析', weight: 30 },
      { id: 'utility', name: '实用工具', description: '通用实用工具', weight: 40 },
      { id: 'external', name: '外部服务', description: '第三方服务集成', weight: 50 },
    ];

    for (const cat of defaults) {
      this.categories.set(cat.id, cat);
    }
  }

  // ============================================================================
  // 工具注册
  // ============================================================================

  /**
   * 注册单个工具
   */
  register(tool: ToolDefinition): void {
    const name = tool.name;

    // 验证必需字段
    if (!name || typeof name !== 'string') {
      throw new ToolRegistryError('Tool name is required', 'VALIDATION_ERROR');
    }

    if (!tool.description) {
      throw new ToolRegistryError(
        `Tool "${name}" description is required`,
        'VALIDATION_ERROR'
      );
    }

    if (!tool.parameters || tool.parameters.type !== 'object') {
      throw new ToolRegistryError(
        `Tool "${name}" must have parameters schema`,
        'VALIDATION_ERROR'
      );
    }

    if (typeof tool.execute !== 'function') {
      throw new ToolRegistryError(
        `Tool "${name}" execute must be a function`,
        'VALIDATION_ERROR'
      );
    }

    // 检查名称冲突
    if (this.tools.has(name)) {
      this.emit('toolOverwritten', { name, previous: this.tools.get(name) });
    }

    // 设置默认值
    const fullTool: ToolDefinition = {
      enabled: true,
      requireConfirmation: false,
      permissionLevel: 'user',
      category: 'utility',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...tool,
      name, // 确保名称一致
    };

    this.tools.set(name, fullTool);
    this.initStats(name);

    this.emit('toolRegistered', { name, tool: fullTool });
  }

  /**
   * 批量注册工具
   */
  registerMany(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * 取消注册工具
   */
  unregister(name: string): boolean {
    const tool = this.tools.get(name);
    if (!tool) return false;

    this.tools.delete(name);
    this.stats.delete(name);

    this.emit('toolUnregistered', { name, tool });
    return true;
  }

  /**
   * 更新工具
   */
  update(name: string, updates: Partial<Omit<ToolDefinition, 'name'>>): boolean {
    const tool = this.tools.get(name);
    if (!tool) return false;

    const updated: ToolDefinition = {
      ...tool,
      ...updates,
      name,
      updatedAt: new Date(),
    };

    this.tools.set(name, updated);
    this.emit('toolUpdated', { name, previous: tool, current: updated });

    return true;
  }

  // ============================================================================
  // 工具查询
  // ============================================================================

  /**
   * 获取单个工具
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * 获取所有工具
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * 获取工具数量
   */
  count(): number {
    return this.tools.size;
  }

  /**
   * 检查工具是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 搜索工具
   */
  search(options: ToolSearchOptions = {}): ToolDefinition[] {
    let results = this.getAll();

    // 按名称/描述搜索
    if (options.query) {
      const query = options.query.toLowerCase();
      results = results.filter(
        t =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // 分类过滤
    if (options.category) {
      results = results.filter(t => t.category === options.category);
    }

    // 标签过滤
    if (options.tags && options.tags.length > 0) {
      results = results.filter(t =>
        options.tags!.some(tag => t.tags?.includes(tag))
      );
    }

    // 只返回启用的
    if (options.enabledOnly !== false) {
      results = results.filter(t => t.enabled !== false);
    }

    // 权限级别过滤
    if (options.permissionLevel) {
      results = results.filter(
        t => t.permissionLevel === options.permissionLevel
      );
    }

    return results;
  }

  /**
   * 获取指定分类的工具
   */
  getByCategory(categoryId: string): ToolDefinition[] {
    return this.getAll().filter(t => t.category === categoryId);
  }

  /**
   * 获取启用的工具列表
   */
  getEnabled(): ToolDefinition[] {
    return this.getAll().filter(t => t.enabled !== false);
  }

  // ============================================================================
  // 工具执行
  // ============================================================================

  /**
   * 执行工具
   */
  async execute(
    name: string,
    args: Record<string, unknown> = {},
    options: ToolExecutionOptions = {}
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);

    if (!tool) {
      return this.createErrorResult(`Tool "${name}" not found`);
    }

    if (tool.enabled === false) {
      return this.createErrorResult(`Tool "${name}" is disabled`);
    }

    // 参数验证
    const validation = this.validateArgs(args, tool.parameters);
    if (!validation.valid) {
      return this.createErrorResult(
        `Parameter validation failed: ${validation.error}`
      );
    }

    // 构建上下文
    const context: ToolContext = {
      callId: this.generateCallId(),
      timestamp: new Date(),
      source: options.context?.source || 'system',
      ...options.context,
    };

    // 检查是否需要确认
    if (tool.requireConfirmation) {
      this.emit('confirmationRequired', { tool, args, context });
    }

    // 执行
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs;

    try {
      const result = await this.runWithTimeout(
        () => tool.execute(args, context),
        timeoutMs
      );

      const durationMs = Date.now() - startTime;
      this.updateStats(name, true, durationMs);

      const toolResult: ToolResult = {
        success: true,
        data: result,
        durationMs,
      };

      this.emit('toolExecuted', {
        name,
        args,
        context,
        result: toolResult,
      });

      return toolResult;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.updateStats(name, false, durationMs, errorMessage);

      const toolResult: ToolResult = {
        success: false,
        error: errorMessage,
        durationMs,
      };

      this.emit('toolFailed', {
        name,
        args,
        context,
        error: toolResult,
      });

      return toolResult;
    }
  }

  /**
   * 安全执行 (不抛出异常)
   */
  async executeSafe(
    name: string,
    args?: Record<string, unknown>,
    options?: ToolExecutionOptions
  ): Promise<ToolResult> {
    try {
      return await this.execute(name, args, options);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: 0,
      };
    }
  }

  /**
   * 批量执行工具
   */
  async executeMany(
    calls: Array<{ name: string; args?: Record<string, unknown> }>,
    options?: ToolExecutionOptions
  ): Promise<ToolResult[]> {
    return Promise.all(
      calls.map(call => this.execute(call.name, call.args, options))
    );
  }

  /**
   * 串行执行工具 (前一个结果作为后一个输入)
   */
  async executeChain(
    chain: Array<{
      name: string;
      args?: Record<string, unknown>;
      transform?: (result: unknown, prevResults: unknown[]) => Record<string, unknown>;
    }>,
    initialInput?: Record<string, unknown>
  ): Promise<unknown[]> {
    const results: unknown[] = [];
    let currentInput = initialInput || {};

    for (const step of chain) {
      const args = step.transform
        ? step.transform(currentInput, results)
        : { ...currentInput, ...step.args };

      const result = await this.execute(step.name, args);

      if (!result.success) {
        throw new Error(
          `Chain failed at step "${step.name}": ${result.error}`
        );
      }

      results.push(result.data);
      currentInput = result.data as Record<string, unknown>;
    }

    return results;
  }

  // ============================================================================
  // 分类管理
  // ============================================================================

  /**
   * 添加分类
   */
  addCategory(category: ToolCategory): void {
    this.categories.set(category.id, category);
    this.emit('categoryAdded', category);
  }

  /**
   * 获取分类
   */
  getCategory(id: string): ToolCategory | undefined {
    return this.categories.get(id);
  }

  /**
   * 获取所有分类
   */
  getAllCategories(): ToolCategory[] {
    return Array.from(this.categories.values()).sort(
      (a, b) => (a.weight || 0) - (b.weight || 0)
    );
  }

  /**
   * 删除分类
   */
  removeCategory(id: string): boolean {
    const cat = this.categories.get(id);
    if (!cat) return false;

    this.categories.delete(id);
    this.emit('categoryRemoved', cat);
    return true;
  }

  // ============================================================================
  // 统计信息
  // ============================================================================

  /**
   * 获取工具统计
   */
  getStats(name: string): ToolStats | undefined {
    return this.stats.get(name);
  }

  /**
   * 获取所有统计
   */
  getAllStats(): Map<string, ToolStats> {
    return new Map(this.stats);
  }

  /**
   * 重置统计
   */
  resetStats(name?: string): void {
    if (name) {
      this.initStats(name);
    } else {
      for (const toolName of this.tools.keys()) {
        this.initStats(toolName);
      }
    }
  }

  // ============================================================================
  // 工具格式转换
  // ============================================================================

  /**
   * 转换为 OpenAI 工具格式
   */
  toOpenAIFormat(tools?: ToolDefinition[]): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: ParameterSchema;
    };
  }> {
    const targetTools = tools || this.getEnabled();

    return targetTools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  /**
   * 转换为 Ollama 工具格式
   */
  toOllamaFormat(tools?: ToolDefinition[]): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: ParameterSchema;
    };
  }> {
    return this.toOpenAIFormat(tools); // Ollama 兼容 OpenAI 格式
  }

  /**
   * 转换为 JSON Schema
   */
  toJSONSchema(tool: ToolDefinition): Record<string, unknown> {
    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: tool.displayName || tool.name,
      description: tool.description,
      type: 'object',
      properties: tool.parameters.properties,
      required: tool.parameters.required || [],
    };
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  private initStats(name: string): void {
    this.stats.set(name, {
      totalCalls: 0,
      successCalls: 0,
      failedCalls: 0,
      avgDurationMs: 0,
    });
  }

  private updateStats(
    name: string,
    success: boolean,
    durationMs: number,
    lastError?: string
  ): void {
    const stats = this.stats.get(name);
    if (!stats) return;

    stats.totalCalls++;
    if (success) {
      stats.successCalls++;
    } else {
      stats.failedCalls++;
      stats.lastError = lastError;
    }

    // 更新平均耗时
    stats.avgDurationMs =
      (stats.avgDurationMs * (stats.totalCalls - 1) + durationMs) /
      stats.totalCalls;

    stats.lastCalledAt = new Date();
  }

  private validateArgs(
    args: Record<string, unknown>,
    schema: ParameterSchema
  ): { valid: boolean; error?: string } {
    const required = schema.required || [];

    for (const key of required) {
      if (!(key in args)) {
        return { valid: false, error: `Missing required parameter: ${key}` };
      }
    }

    return { valid: true };
  }

  private async runWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Tool execution timeout after ${timeoutMs}ms`)),
          timeoutMs
        );
      }),
    ]);
  }

  private generateCallId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private createErrorResult(error: string): ToolResult {
    return {
      success: false,
      error,
      durationMs: 0,
    };
  }
}

// ============================================================================
// 错误类
// ============================================================================

export class ToolRegistryError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'ToolRegistryError';
    this.code = code;
  }
}

// ============================================================================
// 单例导出
// ============================================================================

let globalRegistry: ToolRegistry | null = null;

export function getGlobalRegistry(): ToolRegistry {
  if (!globalRegistry) {
    globalRegistry = new ToolRegistry();
  }
  return globalRegistry;
}

export function createRegistry(): ToolRegistry {
  return new ToolRegistry();
}

export default ToolRegistry;
