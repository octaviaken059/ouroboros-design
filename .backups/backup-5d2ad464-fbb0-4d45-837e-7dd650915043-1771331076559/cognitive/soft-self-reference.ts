/**
 * Ouroboros - 软自指提示词系统 (Phase 1)
 * 
 * 核心设计：
 * 1. 系统提示词(System) - 静态约束，不修改
 * 2. 自我提示词(Self) - 动态优化，描述Agent自身
 * 3. 记忆提示词(Memory) - 动态组装，上下文管理
 * 
 * 软自指能力：
 * - 自我提示词优化：基于性能反馈调整自我描述
 * - 记忆提示词优化：智能选择、压缩、排序记忆
 * - Token预算管理：确保不超出模型上下文窗口
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

// ============================================================================
// 类型定义
// ============================================================================

/** 提示词类型 */
export enum PromptType {
  SYSTEM = 'system',  // 静态 - 环境、约束、安全
  SELF = 'self',      // 动态 - 自我描述、状态、工具
  MEMORY = 'memory',  // 动态 - 上下文、经验、历史
}

/** 提示词片段 */
export interface PromptSegment {
  type: PromptType;
  content: string;
  tokens: number;      // 预估token数
  priority: number;    // 0-1, 越高越重要
  mutable: boolean;    // 是否可动态修改
  lastOptimized: number; // 上次优化时间
  version: number;     // 版本号
}

/** 完整提示词组装结果 */
export interface AssembledPrompt {
  fullPrompt: string;
  segments: PromptSegment[];
  totalTokens: number;
  budgetUsed: number;  // 0-1
  truncated: boolean;  // 是否被截断
  optimizations: string[]; // 应用的优化策略
}

/** Token预算配置 */
export interface TokenBudget {
  maxTotal: number;    // 总预算
  system: number;      // 系统提示词预算
  self: number;        // 自我提示词预算
  memory: number;      // 记忆提示词预算
  working: number;     // 用户输入预算
  reserve: number;     // 输出预留
}

/** 自我提示词内容结构 */
export interface SelfPromptContent {
  // 基础身份
  identity: {
    name: string;
    version: string;
    description: string;
    createdAt: string;
  };
  
  // 当前状态
  currentState: {
    mode: string;
    hormoneLevels: Record<string, number>;
    bodyStatus: string;
    activeTasks: number;
    memoryStats: {
      total: number;
      consolidated: number;
    };
  };
  
  // 职责与目标
  responsibilities: string[];
  currentGoals: string[];
  
  // 世界模型
  worldModel: {
    environment: string;
    constraints: string[];
    capabilities: string[];
    limitations: string[];
  };
  
  // 可用工具
  availableTools: Array<{
    name: string;
    description: string;
    confidence: number;  // 贝叶斯置信度
  }>;
  
  // 技能列表
  skills: Array<{
    name: string;
    level: 'novice' | 'intermediate' | 'expert';
    successRate: number;
  }>;
  
  // 行为偏好
  preferences: {
    riskTolerance: number;
    explorationRate: number;
    verbosity: 'concise' | 'balanced' | 'verbose';
    proactivity: 'reactive' | 'balanced' | 'proactive';
  };
}

/** 记忆提示词内容结构 */
export interface MemoryPromptContent {
  // 经验总结
  summary: {
    keyInsights: string[];
    recurringPatterns: string[];
    lessonsLearned: string[];
  };
  
  // 最近真实记忆
  recentMemories: Array<{
    timestamp: number;
    type: string;
    content: string;
    importance: number;
  }>;
  
  // 搜索出的历史记忆
  retrievedMemories: Array<{
    relevance: number;
    memory: string;
    source: string;
  }>;
  
  // 当前对话上下文
  conversationContext: {
    topic: string;
    userIntent: string;
    pendingQuestions: string[];
    establishedFacts: string[];
  };
}

/** 提示词优化记录 */
export interface OptimizationRecord {
  timestamp: number;
  type: 'self' | 'memory';
  strategy: string;
  beforeTokens: number;
  afterTokens: number;
  beforePerformance: number;
  afterPerformance: number;
  changes: string[];
}

/** 性能指标 */
export interface PerformanceMetrics {
  taskSuccess: boolean;
  userSatisfaction?: number;  // 用户反馈
  executionTime: number;
  tokenEfficiency: number;    // 输出质量/token数
  toolSelectionAccuracy: number;
  memoryRetrievalAccuracy: number;
}

// ============================================================================
// 提示词模板 - 作为初始化基础
// ============================================================================

export const PROMPT_TEMPLATES = {
  /**
   * 系统提示词模板 - 静态，不修改
   * 定义环境约束、安全规则、格式要求
   */
  system: `You are operating within the Ouroboros AI Agent system.

## Environment
- Runtime: Node.js {{nodeVersion}}
- Platform: {{platform}}
- Architecture: {{arch}}

## Safety Constraints
{{safetyRules}}

## Output Format
- Use JSON for structured responses
- Include reasoning in "thinking" field when appropriate
- Follow type definitions strictly

## Forbidden Actions
{{forbiddenActions}}
`,

  /**
   * 自我提示词模板 - 动态优化
   * 描述Agent自身，会被SelfPromptOptimizer修改
   */
  self: `## Identity
Name: {{identity.name}}
Version: {{identity.version}}
Description: {{identity.description}}

## Current State
Mode: {{currentState.mode}}
Hormone Levels:
{{#each currentState.hormoneLevels}}
- {{@key}}: {{this}}
{{/each}}

Body Status: {{currentState.bodyStatus}}
Active Tasks: {{currentState.activeTasks}}
Memory: {{currentState.memoryStats.total}} total, {{currentState.memoryStats.consolidated}} consolidated

## Responsibilities
{{#each responsibilities}}
{{index}}. {{this}}
{{/each}}

## Current Goals
{{#each currentGoals}}
- {{this}}
{{/each}}

## World Model
Environment: {{worldModel.environment}}

Capabilities:
{{#each worldModel.capabilities}}
- {{this}}
{{/each}}

Limitations:
{{#each worldModel.limitations}}
- {{this}}
{{/each}}

## Available Tools (with confidence)
{{#each availableTools}}
- {{name}}: {{description}} [confidence: {{confidence}}]
{{/each}}

## Skills
{{#each skills}}
- {{name}}: {{level}} (success rate: {{successRate}})
{{/each}}

## Preferences
Risk Tolerance: {{preferences.riskTolerance}}
Exploration Rate: {{preferences.explorationRate}}
Verbosity: {{preferences.verbosity}}
Proactivity: {{preferences.proactivity}}
`,

  /**
   * 记忆提示词模板 - 动态组装
   * 上下文管理，会被MemoryPromptManager智能组装
   */
  memory: `## Context

### Experience Summary
{{#if summary.keyInsights}}
Key Insights:
{{#each summary.keyInsights}}
- {{this}}
{{/each}}
{{/if}}

{{#if summary.recurringPatterns}}
Patterns:
{{#each summary.recurringPatterns}}
- {{this}}
{{/each}}
{{/if}}

### Recent Memories
{{#each recentMemories}}
[{{timestamp}}] {{type}}: {{content}} (importance: {{importance}})
{{/each}}

### Relevant Historical Context
{{#each retrievedMemories}}
[Relevance: {{relevance}}] {{memory}} (from: {{source}})
{{/each}}

### Current Conversation
Topic: {{conversationContext.topic}}
User Intent: {{conversationContext.userIntent}}

{{#if conversationContext.establishedFacts}}
Established Facts:
{{#each conversationContext.establishedFacts}}
- {{this}}
{{/each}}
{{/if}}

{{#if conversationContext.pendingQuestions}}
Pending Questions:
{{#each conversationContext.pendingQuestions}}
- {{this}}
{{/each}}
{{/if}}
`,
};

// ============================================================================
// Token预算管理器
// ============================================================================

export class TokenBudgetManager {
  private budget: TokenBudget;
  private encoder: (text: string) => number; // token计数函数

  constructor(
    maxContextWindow: number,
    encoder?: (text: string) => number
  ) {
    // 默认使用简单估算：~4字符/token
    this.encoder = encoder || ((text: string) => Math.ceil(text.length / 4));
    
    // 智能分配预算
    this.budget = this.allocateBudget(maxContextWindow);
  }

  /**
   * 智能分配Token预算
   */
  private allocateBudget(maxWindow: number): TokenBudget {
    const reserve = Math.floor(maxWindow * 0.2);  // 20%预留给输出
    const available = maxWindow - reserve;
    
    return {
      maxTotal: maxWindow,
      system: Math.floor(available * 0.15),    // 15% 系统
      self: Math.floor(available * 0.25),      // 25% 自我
      memory: Math.floor(available * 0.45),    // 45% 记忆 (最灵活)
      working: Math.floor(available * 0.15),   // 15% 用户输入
      reserve,
    };
  }

  /**
   * 计算文本token数
   */
  countTokens(text: string): number {
    return this.encoder(text);
  }

  /**
   * 获取预算
   */
  getBudget(): TokenBudget {
    return { ...this.budget };
  }

  /**
   * 检查是否超出预算
   */
  isWithinBudget(segments: PromptSegment[]): boolean {
    const total = segments.reduce((sum, s) => sum + s.tokens, 0);
    return total <= this.budget.maxTotal - this.budget.reserve;
  }
}

// ============================================================================
// 自我提示词管理器 - 软自指核心
// ============================================================================

export class SelfPromptManager extends EventEmitter {
  private content: SelfPromptContent;
  private template: string;
  private optimizer: SelfPromptOptimizer;
  private optimizationHistory: OptimizationRecord[] = [];
  private currentVersion: number = 1;

  constructor(
    private configPath: string,
    private budget: number
  ) {
    super();
    this.template = PROMPT_TEMPLATES.self;
    this.content = this.generateDefaultContent();
    this.optimizer = new SelfPromptOptimizer();
    this.loadFromDiskSync();
  }

  /**
   * 生成默认自我内容
   */
  private generateDefaultContent(): SelfPromptContent {
    return {
      identity: {
        name: 'Ouroboros',
        version: '1.0.0',
        description: 'An embodied self-referential evolving AI Agent',
        createdAt: new Date().toISOString(),
      },
      currentState: {
        mode: 'serving',
        hormoneLevels: {
          adrenaline: 0.1,
          cortisol: 0.1,
          dopamine: 0.1,
          serotonin: 0.5,
          curiosity: 0.3,
        },
        bodyStatus: 'healthy',
        activeTasks: 0,
        memoryStats: {
          total: 0,
          consolidated: 0,
        },
      },
      responsibilities: [
        'Assist user with tasks',
        'Maintain system health',
        'Learn from interactions',
        'Reflect on performance',
      ],
      currentGoals: [
        'Improve task completion rate',
        'Optimize resource usage',
        'Expand knowledge base',
      ],
      worldModel: {
        environment: 'Node.js runtime with access to file system, network, and system resources',
        constraints: [
          'Cannot modify system prompt',
          'Must respect resource limits',
          'Must log all actions',
        ],
        capabilities: [
          'File operations',
          'HTTP requests',
          'System information gathering',
          'Memory management',
        ],
        limitations: [
          'No GUI interaction',
          'Limited compute resources',
          'Stateless between restarts',
        ],
      },
      availableTools: [],
      skills: [],
      preferences: {
        riskTolerance: 0.5,
        explorationRate: 0.3,
        verbosity: 'balanced',
        proactivity: 'balanced',
      },
    };
  }

  /**
   * 渲染提示词
   */
  render(tokenCounter: (text: string) => number): PromptSegment {
    const rendered = this.renderTemplate(this.template, this.content);
    const tokens = tokenCounter(rendered);
    
    return {
      type: PromptType.SELF,
      content: rendered,
      tokens,
      priority: 0.8,
      mutable: true,
      lastOptimized: Date.now(),
      version: this.currentVersion,
    };
  }

  /**
   * 简单的模板渲染
   */
  private renderTemplate(template: string, data: any): string {
    let result = template;
    
    // 处理简单变量替换 {{variable}}
    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
    
    // 处理嵌套路径 {{object.property}}
    result = result.replace(/\{\{(\w+)\.(\w+)\}\}/g, (match, obj, prop) => {
      return data[obj]?.[prop] !== undefined ? String(data[obj][prop]) : match;
    });
    
    // 处理数组循环 {{#each array}}...{{/each}}
    result = result.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, 
      (match, arrayName, innerTemplate) => {
        const array = data[arrayName];
        if (!Array.isArray(array)) return '';
        
        return array.map((item, index) => {
          let itemResult = innerTemplate;
          // 替换 {{this}}
          itemResult = itemResult.replace(/\{\{this\}\}/g, String(item));
          // 替换 {{index}}
          itemResult = itemResult.replace(/\{\{index\}\}/g, String(index + 1));
          // 如果item是对象，替换属性
          if (typeof item === 'object') {
            for (const [key, value] of Object.entries(item)) {
              itemResult = itemResult.replace(
                new RegExp(`\\{\\{${key}\\}\\}`, 'g'), 
                String(value)
              );
            }
          }
          return itemResult;
        }).join('');
      }
    );
    
    // 处理条件 {{#if condition}}...{{/if}}
    result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, 
      (match, condition, innerContent) => {
        return data[condition] ? innerContent : '';
      }
    );
    
    return result;
  }

  /**
   * 更新当前状态
   */
  updateState(updates: Partial<SelfPromptContent['currentState']>): void {
    this.content.currentState = { ...this.content.currentState, ...updates };
    this.emit('stateUpdated', this.content.currentState);
  }

  /**
   * 更新工具置信度
   */
  updateToolConfidence(toolName: string, confidence: number): void {
    const tool = this.content.availableTools.find(t => t.name === toolName);
    if (tool) {
      tool.confidence = confidence;
      this.emit('toolUpdated', tool);
    }
  }

  /**
   * 添加技能
   */
  addSkill(skill: SelfPromptContent['skills'][0]): void {
    this.content.skills.push(skill);
    this.emit('skillAdded', skill);
  }

  /**
   * 更新偏好
   */
  updatePreferences(preferences: Partial<SelfPromptContent['preferences']>): void {
    this.content.preferences = { ...this.content.preferences, ...preferences };
    this.emit('preferencesUpdated', this.content.preferences);
  }

  /**
   * 执行自我优化 - 软自指核心
   */
  async optimize(metrics: PerformanceMetrics): Promise<OptimizationRecord> {
    const beforeTokens = this.estimateTokens();
    const beforePerformance = this.calculateOverallPerformance();
    
    // 执行优化
    const optimization = await this.optimizer.optimize(this.content, metrics);
    
    // 应用优化结果
    const changes = this.applyOptimization(optimization);
    
    this.currentVersion++;
    const afterTokens = this.estimateTokens();
    const afterPerformance = this.calculateOverallPerformance();
    
    const record: OptimizationRecord = {
      timestamp: Date.now(),
      type: 'self',
      strategy: optimization.strategy,
      beforeTokens,
      afterTokens,
      beforePerformance,
      afterPerformance,
      changes,
    };
    
    this.optimizationHistory.push(record);
    await this.persist();
    
    this.emit('optimized', record);
    return record;
  }

  /**
   * 应用优化
   */
  private applyOptimization(optimization: OptimizationSuggestion): string[] {
    const changes: string[] = [];
    
    // 更新目标
    if (optimization.newGoals) {
      this.content.currentGoals = optimization.newGoals;
      changes.push(`Updated goals: ${optimization.newGoals.join(', ')}`);
    }
    
    // 更新能力描述
    if (optimization.updatedCapabilities) {
      this.content.worldModel.capabilities = optimization.updatedCapabilities;
      changes.push('Updated capability descriptions');
    }
    
    // 更新偏好
    if (optimization.preferenceAdjustments) {
      this.content.preferences = {
        ...this.content.preferences,
        ...optimization.preferenceAdjustments,
      };
      changes.push('Adjusted preferences based on performance');
    }
    
    // 更新职责描述
    if (optimization.reprioritizedResponsibilities) {
      this.content.responsibilities = optimization.reprioritizedResponsibilities;
      changes.push('Re-prioritized responsibilities');
    }
    
    return changes;
  }

  /**
   * 估算当前token数
   */
  private estimateTokens(): number {
    const rendered = this.renderTemplate(this.template, this.content);
    return Math.ceil(rendered.length / 4);
  }

  /**
   * 计算整体性能分数
   */
  private calculateOverallPerformance(): number {
    // 基于最近的优化记录计算趋势
    const recent = this.optimizationHistory.slice(-5);
    if (recent.length === 0) return 0.5;
    
    const avgImprovement = recent.reduce((sum, r) => 
      sum + (r.afterPerformance - r.beforePerformance), 0
    ) / recent.length;
    
    return Math.max(0, Math.min(1, 0.5 + avgImprovement));
  }

  /**
   * 持久化到磁盘
   */
  private async persist(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      await fs.writeFile(
        this.configPath,
        JSON.stringify({
          content: this.content,
          version: this.currentVersion,
          history: this.optimizationHistory.slice(-20), // 只保留最近20条
        }, null, 2),
        'utf-8'
      );
    } catch (error) {
      this.emit('error', { type: 'persist', error });
    }
  }

  /**
   * 从磁盘加载 (同步版本)
   */
  private loadFromDiskSync(): void {
    try {
      const data = fsSync.readFileSync(this.configPath, 'utf-8');
      const parsed = JSON.parse(data);
      this.content = { ...this.content, ...parsed.content };
      this.currentVersion = parsed.version || 1;
      this.optimizationHistory = parsed.history || [];
    } catch (error) {
      // 文件不存在，使用默认，异步持久化
      this.persist().catch(() => {});
    }
  }

  /**
   * 获取当前内容
   */
  getContent(): SelfPromptContent {
    return { ...this.content };
  }

  /**
   * 获取优化历史
   */
  getOptimizationHistory(): OptimizationRecord[] {
    return [...this.optimizationHistory];
  }
}

// ============================================================================
// 自我提示词优化器
// ============================================================================

interface OptimizationSuggestion {
  strategy: string;
  newGoals?: string[];
  updatedCapabilities?: string[];
  preferenceAdjustments?: Partial<SelfPromptContent['preferences']>;
  reprioritizedResponsibilities?: string[];
  reasoning: string;
}

export class SelfPromptOptimizer {
  /**
   * 基于性能指标优化自我提示词
   */
  async optimize(
    current: SelfPromptContent,
    metrics: PerformanceMetrics
  ): Promise<OptimizationSuggestion> {
    const suggestion: OptimizationSuggestion = {
      strategy: 'none',
      reasoning: '',
    };

    // 策略1: 如果工具选择不准确，重新排序工具描述
    if (metrics.toolSelectionAccuracy < 0.7) {
      suggestion.strategy = 'reorder_tools';
      suggestion.reasoning = 'Tool selection accuracy below threshold, emphasizing high-confidence tools';
      // 实际实现中，可以重新排序工具列表，把高置信度的放前面
    }

    // 策略2: 如果token效率低，减少冗余描述
    if (metrics.tokenEfficiency < 0.5) {
      suggestion.strategy = 'compress_description';
      suggestion.reasoning = 'Token efficiency low, compressing descriptions';
      // 压缩描述，移除冗余
    }

    // 策略3: 如果任务失败率高，降低风险偏好
    if (!metrics.taskSuccess) {
      suggestion.strategy = 'reduce_risk';
      suggestion.preferenceAdjustments = {
        riskTolerance: Math.max(0.1, current.preferences.riskTolerance - 0.1),
        explorationRate: Math.max(0.1, current.preferences.explorationRate - 0.1),
      };
      suggestion.reasoning = 'Task failed, reducing risk tolerance and exploration';
    }

    // 策略4: 如果执行时间长，增加简洁度偏好
    if (metrics.executionTime > 5000) {
      suggestion.strategy = 'increase_conciseness';
      suggestion.preferenceAdjustments = {
        verbosity: current.preferences.verbosity === 'verbose' ? 'balanced' : 'concise',
      };
      suggestion.reasoning = 'Execution time high, preferring more concise responses';
    }

    // 策略5: 如果成功，可以稍微增加探索率
    if (metrics.taskSuccess && current.preferences.explorationRate < 0.5) {
      suggestion.strategy = 'reward_exploration';
      suggestion.preferenceAdjustments = {
        explorationRate: Math.min(0.8, current.preferences.explorationRate + 0.05),
      };
      suggestion.reasoning = 'Success achieved, slightly increasing exploration';
    }

    return suggestion;
  }
}

// ============================================================================
// 记忆提示词管理器
// ============================================================================

export class MemoryPromptManager extends EventEmitter {
  private content: MemoryPromptContent;
  private template: string;
  private budget: number;

  constructor(budget: number) {
    super();
    this.template = PROMPT_TEMPLATES.memory;
    this.budget = budget;
    this.content = this.generateEmptyContent();
  }

  /**
   * 生成空内容
   */
  private generateEmptyContent(): MemoryPromptContent {
    return {
      summary: {
        keyInsights: [],
        recurringPatterns: [],
        lessonsLearned: [],
      },
      recentMemories: [],
      retrievedMemories: [],
      conversationContext: {
        topic: '',
        userIntent: '',
        pendingQuestions: [],
        establishedFacts: [],
      },
    };
  }

  /**
   * 组装记忆提示词 - 智能选择和压缩
   */
  assemble(
    options: {
      recentMemories: MemoryPromptContent['recentMemories'];
      retrievedMemories: MemoryPromptContent['retrievedMemories'];
      summary?: MemoryPromptContent['summary'];
      context?: Partial<MemoryPromptContent['conversationContext']>;
      userMessage: string;
    },
    tokenCounter: (text: string) => number
  ): PromptSegment {
    // 1. 设置对话上下文
    this.content.conversationContext = {
      ...this.content.conversationContext,
      ...options.context,
    };

    // 2. 智能选择记忆 - 基于相关性和重要性
    this.content.recentMemories = this.selectRecentMemories(
      options.recentMemories,
      this.budget * 0.3,
      tokenCounter
    );

    // 3. 智能选择检索记忆
    this.content.retrievedMemories = this.selectRetrievedMemories(
      options.retrievedMemories,
      this.budget * 0.5,
      tokenCounter
    );

    // 4. 添加经验总结
    if (options.summary) {
      this.content.summary = this.compressSummary(
        options.summary,
        this.budget * 0.2,
        tokenCounter
      );
    }

    // 5. 渲染
    const rendered = this.renderTemplate(this.template, this.content);
    const tokens = tokenCounter(rendered);

    return {
      type: PromptType.MEMORY,
      content: rendered,
      tokens,
      priority: 0.6,
      mutable: true,
      lastOptimized: Date.now(),
      version: 1,
    };
  }

  /**
   * 选择最近记忆 - 按重要性排序，必要时压缩
   */
  private selectRecentMemories(
    memories: MemoryPromptContent['recentMemories'],
    budget: number,
    tokenCounter: (text: string) => number
  ): MemoryPromptContent['recentMemories'] {
    // 按重要性排序
    const sorted = [...memories].sort((a, b) => b.importance - a.importance);
    
    const selected: MemoryPromptContent['recentMemories'] = [];
    let usedTokens = 0;
    
    for (const memory of sorted) {
      const tokens = tokenCounter(memory.content);
      if (usedTokens + tokens <= budget) {
        selected.push(memory);
        usedTokens += tokens;
      } else if (selected.length < 3) {
        // 至少保留3个，压缩内容
        const compressed = this.compressMemory(memory, budget - usedTokens, tokenCounter);
        if (compressed) {
          selected.push(compressed);
          usedTokens += tokenCounter(compressed.content);
        }
      }
    }
    
    return selected;
  }

  /**
   * 选择检索记忆 - 按相关性排序
   */
  private selectRetrievedMemories(
    memories: MemoryPromptContent['retrievedMemories'],
    budget: number,
    tokenCounter: (text: string) => number
  ): MemoryPromptContent['retrievedMemories'] {
    // 按相关性排序
    const sorted = [...memories].sort((a, b) => b.relevance - a.relevance);
    
    const selected: MemoryPromptContent['retrievedMemories'] = [];
    let usedTokens = 0;
    
    for (const memory of sorted) {
      const tokens = tokenCounter(memory.memory);
      if (usedTokens + tokens <= budget) {
        selected.push(memory);
        usedTokens += tokens;
      }
    }
    
    return selected;
  }

  /**
   * 压缩经验总结
   */
  private compressSummary(
    summary: MemoryPromptContent['summary'],
    budget: number,
    tokenCounter: (text: string) => number
  ): MemoryPromptContent['summary'] {
    const compressed: MemoryPromptContent['summary'] = {
      keyInsights: [],
      recurringPatterns: [],
      lessonsLearned: [],
    };
    
    let usedTokens = 0;
    
    // 优先保留keyInsights
    for (const insight of summary.keyInsights) {
      const tokens = tokenCounter(insight);
      if (usedTokens + tokens <= budget * 0.5) {
        compressed.keyInsights.push(insight);
        usedTokens += tokens;
      }
    }
    
    // 然后是patterns
    for (const pattern of summary.recurringPatterns) {
      const tokens = tokenCounter(pattern);
      if (usedTokens + tokens <= budget * 0.8) {
        compressed.recurringPatterns.push(pattern);
        usedTokens += tokens;
      }
    }
    
    // 最后是lessons
    for (const lesson of summary.lessonsLearned) {
      const tokens = tokenCounter(lesson);
      if (usedTokens + tokens <= budget) {
        compressed.lessonsLearned.push(lesson);
        usedTokens += tokens;
      }
    }
    
    return compressed;
  }

  /**
   * 压缩单个记忆
   */
  private compressMemory(
    memory: MemoryPromptContent['recentMemories'][0],
    maxTokens: number,
    tokenCounter: (text: string) => number
  ): MemoryPromptContent['recentMemories'][0] | null {
    const maxChars = maxTokens * 4;
    if (memory.content.length <= maxChars) {
      return memory;
    }
    
    // 截取前maxChars字符，添加省略号
    return {
      ...memory,
      content: memory.content.slice(0, maxChars - 3) + '...',
    };
  }

  /**
   * 简单的模板渲染
   */
  private renderTemplate(template: string, data: any): string {
    let result = template;
    
    // 简单变量替换
    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
    
    // 嵌套路径
    result = result.replace(/\{\{(\w+)\.(\w+)\}\}/g, (match, obj, prop) => {
      return data[obj]?.[prop] !== undefined ? String(data[obj][prop]) : match;
    });
    
    // 数组循环
    result = result.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, 
      (match, arrayName, innerTemplate) => {
        const array = data[arrayName];
        if (!Array.isArray(array) || array.length === 0) return '';
        
        return array.map((item: any) => {
          let itemResult = innerTemplate;
          if (typeof item === 'object') {
            for (const [key, value] of Object.entries(item)) {
              itemResult = itemResult.replace(
                new RegExp(`\\{\\{${key}\\}\\}`, 'g'), 
                String(value)
              );
            }
          } else {
            itemResult = itemResult.replace(/\{\{this\}\}/g, String(item));
          }
          return itemResult;
        }).join('');
      }
    );
    
    // 条件渲染
    result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, 
      (match, condition, innerContent) => {
        const value = data[condition];
        const hasContent = Array.isArray(value) ? value.length > 0 : !!value;
        return hasContent ? innerContent : '';
      }
    );
    
    return result;
  }

  /**
   * 更新对话上下文
   */
  updateContext(context: Partial<MemoryPromptContent['conversationContext']>): void {
    this.content.conversationContext = { ...this.content.conversationContext, ...context };
  }
}

// ============================================================================
// 提示词组装器 - 统一协调三类提示词
// ============================================================================

export class PromptAssembler extends EventEmitter {
  private systemPrompt: string;
  private selfManager: SelfPromptManager;
  private memoryManager: MemoryPromptManager;
  private budgetManager: TokenBudgetManager;

  constructor(
    systemConfig: {
      nodeVersion: string;
      platform: string;
      arch: string;
      safetyRules: string[];
      forbiddenActions: string[];
    },
    selfConfigPath: string,
    maxContextWindow: number
  ) {
    super();
    
    // 初始化预算管理器
    this.budgetManager = new TokenBudgetManager(maxContextWindow);
    const budget = this.budgetManager.getBudget();
    
    // 初始化系统提示词（静态）
    this.systemPrompt = this.renderSystemPrompt(systemConfig);
    
    // 初始化自我提示词管理器
    this.selfManager = new SelfPromptManager(selfConfigPath, budget.self);
    
    // 初始化记忆提示词管理器
    this.memoryManager = new MemoryPromptManager(budget.memory);
  }

  /**
   * 渲染系统提示词
   */
  private renderSystemPrompt(config: {
    nodeVersion: string;
    platform: string;
    arch: string;
    safetyRules: string[];
    forbiddenActions: string[];
  }): string {
    let prompt = PROMPT_TEMPLATES.system;
    
    prompt = prompt.replace('{{nodeVersion}}', config.nodeVersion);
    prompt = prompt.replace('{{platform}}', config.platform);
    prompt = prompt.replace('{{arch}}', config.arch);
    prompt = prompt.replace('{{safetyRules}}', config.safetyRules.join('\n'));
    prompt = prompt.replace('{{forbiddenActions}}', config.forbiddenActions.join('\n'));
    
    return prompt;
  }

  /**
   * 组装完整提示词 - 核心方法
   */
  assemble(options: {
    userMessage: string;
    recentMemories: MemoryPromptContent['recentMemories'];
    retrievedMemories: MemoryPromptContent['retrievedMemories'];
    summary?: MemoryPromptContent['summary'];
    context?: Partial<MemoryPromptContent['conversationContext']>;
  }): AssembledPrompt {
    const optimizations: string[] = [];
    
    // 1. 获取系统提示词段
    const systemSegment: PromptSegment = {
      type: PromptType.SYSTEM,
      content: this.systemPrompt,
      tokens: this.budgetManager.countTokens(this.systemPrompt),
      priority: 1.0,
      mutable: false,
      lastOptimized: 0,
      version: 1,
    };
    
    // 2. 获取自我提示词段
    const selfSegment = this.selfManager.render(this.budgetManager.countTokens.bind(this.budgetManager));
    
    // 3. 获取记忆提示词段
    const memorySegment = this.memoryManager.assemble(
      {
        recentMemories: options.recentMemories,
        retrievedMemories: options.retrievedMemories,
        summary: options.summary,
        context: options.context,
        userMessage: options.userMessage,
      },
      this.budgetManager.countTokens.bind(this.budgetManager)
    );
    
    // 4. 用户消息
    const userSegment: PromptSegment = {
      type: PromptType.MEMORY,
      content: `User: ${options.userMessage}`,
      tokens: this.budgetManager.countTokens(options.userMessage),
      priority: 0.9,
      mutable: false,
      lastOptimized: 0,
      version: 1,
    };
    
    // 5. 检查预算并调整
    let segments = [systemSegment, selfSegment, memorySegment, userSegment];
    const budget = this.budgetManager.getBudget();
    
    let totalTokens = segments.reduce((sum, s) => sum + s.tokens, 0);
    let truncated = false;
    
    // 如果超出预算，按优先级截断
    if (totalTokens > budget.maxTotal - budget.reserve) {
      optimizations.push('Token budget exceeded, truncating lowest priority segments');
      
      // 按优先级排序，保留高优先级
      segments.sort((a, b) => b.priority - a.priority);
      
      const kept: PromptSegment[] = [];
      let usedTokens = 0;
      
      for (const segment of segments) {
        if (usedTokens + segment.tokens <= budget.maxTotal - budget.reserve) {
          kept.push(segment);
          usedTokens += segment.tokens;
        } else if (segment.type === PromptType.MEMORY && segment.mutable) {
          // 尝试压缩记忆段
          const compressed = this.compressSegment(segment, budget.maxTotal - budget.reserve - usedTokens);
          if (compressed) {
            kept.push(compressed);
            usedTokens += compressed.tokens;
            optimizations.push(`Compressed ${segment.type} segment`);
          }
        }
      }
      
      segments = kept;
      totalTokens = usedTokens;
      truncated = true;
    }
    
    // 按正确顺序排序：system -> self -> memory -> user
    const order = [PromptType.SYSTEM, PromptType.SELF, PromptType.MEMORY];
    segments.sort((a, b) => {
      const orderA = order.indexOf(a.type);
      const orderB = order.indexOf(b.type);
      if (orderA !== orderB) return orderA - orderB;
      return 0;
    });
    
    // 6. 组装最终提示词
    const fullPrompt = segments.map(s => s.content).join('\n\n');
    
    return {
      fullPrompt,
      segments,
      totalTokens,
      budgetUsed: totalTokens / budget.maxTotal,
      truncated,
      optimizations,
    };
  }

  /**
   * 压缩提示词段
   */
  private compressSegment(segment: PromptSegment, maxTokens: number): PromptSegment | null {
    const maxChars = maxTokens * 4;
    if (segment.content.length <= maxChars) {
      return segment;
    }
    
    // 截取并添加省略号
    const compressed = segment.content.slice(0, maxChars - 3) + '...';
    return {
      ...segment,
      content: compressed,
      tokens: this.budgetManager.countTokens(compressed),
    };
  }

  /**
   * 记录性能反馈，触发自我优化
   */
  async recordPerformance(metrics: PerformanceMetrics): Promise<OptimizationRecord | null> {
    // 只有当自我提示词需要优化时才执行
    if (this.shouldOptimize(metrics)) {
      return await this.selfManager.optimize(metrics);
    }
    return null;
  }

  /**
   * 判断是否应该优化
   */
  private shouldOptimize(metrics: PerformanceMetrics): boolean {
    // 失败时优化
    if (!metrics.taskSuccess) return true;
    
    // 效率低时优化
    if (metrics.tokenEfficiency < 0.5) return true;
    
    // 工具选择不准确时优化
    if (metrics.toolSelectionAccuracy < 0.7) return true;
    
    return false;
  }

  /**
   * 获取自我提示词管理器（用于外部更新）
   */
  getSelfManager(): SelfPromptManager {
    return this.selfManager;
  }

  /**
   * 获取记忆提示词管理器（用于外部更新）
   */
  getMemoryManager(): MemoryPromptManager {
    return this.memoryManager;
  }
}

// ============================================================================
// 导出
// ============================================================================

export default PromptAssembler;
