# 软自指提示词系统集成指南

## 概述

本文档介绍如何将软自指提示词系统集成到 Ouroboros UnifiedAgent 中，实现第一阶段的自我进化能力。

## 核心概念

### 三类提示词

1. **系统提示词 (System)** - 静态
   - 环境信息、安全约束、格式要求
   - **不可修改**，由开发者定义

2. **自我提示词 (Self)** - 动态优化
   - Agent身份、当前状态、职责、世界模型
   - 工具列表、技能列表、行为偏好
   - **可被Agent自己修改**，基于性能反馈

3. **记忆提示词 (Memory)** - 动态组装
   - 经验总结、最近记忆、检索记忆
   - 对话上下文
   - **智能选择和压缩**，确保不超出预算

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     PromptAssembler                         │
│                    (提示词组装器)                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   System     │  │     Self     │  │    Memory    │      │
│  │   (静态)      │  │   (动态优化)  │  │   (动态组装)  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         │    ┌────────────┴─────────────────┘               │
│         │    │                                              │
│         ▼    ▼                                              │
│  ┌──────────────────────────────────────┐                  │
│  │      TokenBudgetManager              │                  │
│  │      (预算分配 + 截断管理)            │                  │
│  └──────────────────┬───────────────────┘                  │
│                     │                                       │
│                     ▼                                       │
│  ┌──────────────────────────────────────┐                  │
│  │      AssembledPrompt                 │                  │
│  │      (完整提示词 + 元数据)            │                  │
│  └──────────────────────────────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   LLM Model      │
                    │   (推理执行)      │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Performance      │
                    │ Feedback         │
                    │ (触发自我优化)    │
                    └──────────────────┘
```

## 集成步骤

### 步骤1: 替换现有的提示词生成逻辑

在 `unified-agent.ts` 中，替换现有的 `generatePrompt` 方法：

```typescript
import { PromptAssembler } from './cognitive/soft-self-reference.js';

export class UnifiedAgent extends EventEmitter {
  private promptAssembler: PromptAssembler;
  
  constructor(config: UnifiedAgentConfig) {
    super();
    
    // 初始化软自指提示词系统
    this.promptAssembler = new PromptAssembler(
      {
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        safetyRules: this.generateSafetyRules(),
        forbiddenActions: this.generateForbiddenActions(),
      },
      path.join(config.dataDir || './data', 'self-prompt.json'),
      config.model?.maxContextWindow || 8192
    );
    
    // 订阅自我提示词更新事件
    this.promptAssembler.getSelfManager().on('optimized', (record) => {
      this.emit('selfOptimized', record);
      this.logger.info('Self-prompt optimized', record);
    });
  }
  
  /**
   * 生成系统安全规则
   */
  private generateSafetyRules(): string[] {
    return [
      '- Never execute untrusted code without validation',
      '- Always log actions to audit trail',
      '- Respect resource limits and homeostasis',
      '- Verify user identity for sensitive operations',
    ];
  }
  
  /**
   * 生成禁止行为列表
   */
  private generateForbiddenActions(): string[] {
    return [
      '- Delete or modify system files',
      '- Execute shell commands without dual-mind verification',
      '- Expose sensitive credentials or keys',
      '- Modify the system prompt (self-reference only)',
    ];
  }
}
```

### 步骤2: 在对话循环中组装提示词

```typescript
async function handleConversation(userMessage: string): Promise<string> {
  // 1. 检索相关记忆
  const retrievedMemories = await this.memory.search(userMessage, {
    limit: 10,
    includeVectors: true,
  });
  
  // 2. 获取最近记忆
  const recentMemories = await this.memory.getRecent({
    limit: 20,
    types: ['episodic', 'reflective'],
  });
  
  // 3. 获取经验总结
  const summary = await this.memory.generateSummary();
  
  // 4. 组装提示词
  const assembled = this.promptAssembler.assemble({
    userMessage,
    recentMemories: recentMemories.map(m => ({
      timestamp: m.timestamp,
      type: m.type,
      content: m.content,
      importance: m.importance,
    })),
    retrievedMemories: retrievedMemories.map(m => ({
      relevance: m.similarity,
      memory: m.content,
      source: m.layer,
    })),
    summary: {
      keyInsights: summary.insights,
      recurringPatterns: summary.patterns,
      lessonsLearned: summary.lessons,
    },
    context: {
      topic: this.currentTopic,
      userIntent: this.inferredIntent,
      pendingQuestions: this.pendingQuestions,
      establishedFacts: this.establishedFacts,
    },
  });
  
  // 5. 记录token使用情况
  this.metrics.recordTokenUsage(assembled.totalTokens);
  
  // 6. 调用模型
  const response = await this.modelEngine.generate(assembled.fullPrompt);
  
  // 7. 记录性能反馈（用于自我优化）
  await this.recordPerformanceFeedback({
    taskSuccess: !response.error,
    executionTime: response.latency,
    tokenEfficiency: response.quality / assembled.totalTokens,
    toolSelectionAccuracy: this.evaluateToolSelection(response),
    memoryRetrievalAccuracy: this.evaluateMemoryRelevance(
      retrievedMemories, 
      response
    ),
  });
  
  return response.content;
}
```

### 步骤3: 实现性能反馈循环

```typescript
/**
 * 记录性能反馈，触发自我优化
 */
private async recordPerformanceFeedback(
  metrics: PerformanceMetrics
): Promise<void> {
  // 让提示词组装器评估是否需要优化
  const optimization = await this.promptAssembler.recordPerformance(metrics);
  
  if (optimization) {
    // 优化已触发，记录到反思记忆
    await this.memory.store(
      `Self-prompt optimization performed: ${optimization.strategy}. ` +
      `Changes: ${optimization.changes.join(', ')}. ` +
      `Performance improved from ${optimization.beforePerformance.toFixed(2)} ` +
      `to ${optimization.afterPerformance.toFixed(2)}`,
      'reflective',
      {
        importance: 0.9,
        tags: ['self_optimization', 'meta_learning'],
      }
    );
    
    // 如果性能提升显著，增加多巴胺
    if (optimization.afterPerformance > optimization.beforePerformance) {
      this.hormoneSystem.adjustHormone(
        HormoneType.DOPAMINE,
        0.1,
        'self_optimization_success'
      );
    } else {
      // 否则增加皮质醇（压力）
      this.hormoneSystem.adjustHormone(
        HormoneType.CORTISOL,
        0.05,
        'optimization_ineffective'
      );
    }
  }
}
```

### 步骤4: 同步Agent状态到自我提示词

```typescript
/**
 * 定期同步Agent状态到自我提示词
 */
private startStateSync(): void {
  setInterval(() => {
    const selfManager = this.promptAssembler.getSelfManager();
    
    // 同步激素状态
    selfManager.updateState({
      hormoneLevels: this.hormoneSystem.getState(),
      activeTasks: this.scheduler.getStatus().runningCount,
      bodyStatus: this.getBodyStatus(),
      memoryStats: this.memory.getStats(),
    });
    
    // 同步工具置信度
    for (const [toolName, belief] of this.bayesian.getAllCapabilities()) {
      selfManager.updateToolConfidence(toolName, belief.confidence);
    }
    
  }, 30000); // 每30秒同步一次
}
```

## 提示词模板定制

### 自定义系统提示词

```typescript
const customSystemTemplate = `You are {{identity.name}}, operating in a {{environment.type}} environment.

## Core Principles
{{#each corePrinciples}}
{{index}}. {{this}}
{{/each}}

## Safety Protocols
{{safetyProtocols}}

## Response Format
Always structure your response as:
1. **Thinking**: Your reasoning process
2. **Action**: What you decide to do
3. **Output**: The actual response to the user
`;

// 在初始化时传入
const assembler = new PromptAssembler(
  {
    systemTemplate: customSystemTemplate,
    // ... other config
  },
  // ...
);
```

### 自定义自我提示词

```typescript
const customSelfTemplate = `## About Me
I am {{identity.name}}, version {{identity.version}}.
{{identity.description}}

## My Current State
- Energy Level: {{currentState.energy}}
- Focus Level: {{currentState.focus}}
- Stress Level: {{currentState.stress}}

## My Capabilities (trust level)
{{#each availableTools}}
- {{name}}: {{description}} [{{confidence}}/1.0]
{{/each}}

## My Learning Goals
{{#each currentGoals}}
{{index}}. {{this}}
{{/each}}

## My Behavioral Preferences
- Risk Tolerance: {{preferences.riskTolerance}} (0=cautious, 1=bold)
- Exploration: {{preferences.explorationRate}} (0=exploit, 1=explore)
- Communication: {{preferences.verbosity}}
`;

// 自我提示词管理器会使用此模板
```

## Token预算配置

### 不同模型的推荐配置

```typescript
// GPT-3.5 (4k context)
const gpt35Config = {
  maxContextWindow: 4096,
  budget: {
    system: 400,   // 10%
    self: 800,     // 20%
    memory: 2000,  // 50%
    working: 400,  // 10%
    reserve: 496,  // 12%
  },
};

// GPT-4 (8k context)
const gpt4Config = {
  maxContextWindow: 8192,
  budget: {
    system: 800,   // 10%
    self: 1600,    // 20%
    memory: 4000,  // 50%
    working: 800,  // 10%
    reserve: 992,  // 12%
  },
};

// Claude-3 (200k context)
const claudeConfig = {
  maxContextWindow: 200000,
  budget: {
    system: 10000,  // 5%
    self: 20000,    // 10%
    memory: 150000, // 75%
    working: 10000, // 5%
    reserve: 10000, // 5%
  },
};
```

## 优化策略详解

### 自我提示词优化触发条件

```typescript
// 自动触发优化的条件
interface OptimizationTriggers {
  // 任务失败时立即优化
  onFailure: true;
  
  // 工具选择准确率低于阈值
  toolAccuracyThreshold: 0.7;
  
  // Token效率低于阈值
  tokenEfficiencyThreshold: 0.5;
  
  // 执行时间超过阈值（毫秒）
  executionTimeThreshold: 5000;
  
  // 定期优化间隔（毫秒）
  periodicOptimizationInterval: 3600000; // 1小时
}
```

### 优化策略类型

1. **reorder_tools**: 重新排序工具列表，高置信度优先
2. **compress_description**: 压缩自我描述，减少冗余
3. **reduce_risk**: 降低风险偏好（失败后）
4. **increase_conciseness**: 增加简洁度偏好（慢响应后）
5. **reward_exploration**: 增加探索率（成功后）
6. **update_capabilities**: 更新能力描述（基于实际表现）

## 监控和调试

### 查看优化历史

```typescript
const selfManager = assembler.getSelfManager();
const history = selfManager.getOptimizationHistory();

console.table(history.map(h => ({
  time: new Date(h.timestamp).toISOString(),
  strategy: h.strategy,
  tokens: `${h.beforeTokens} -> ${h.afterTokens}`,
  performance: `${h.beforePerformance.toFixed(2)} -> ${h.afterPerformance.toFixed(2)}`,
  changes: h.changes.length,
})));
```

### 查看当前自我提示词

```typescript
const content = selfManager.getContent();
console.log('Current self-prompt content:');
console.log(JSON.stringify(content, null, 2));
```

### 手动触发优化

```typescript
// 手动触发一次优化
const record = await selfManager.optimize({
  taskSuccess: true,
  userSatisfaction: 0.95,
  executionTime: 1000,
  tokenEfficiency: 0.85,
  toolSelectionAccuracy: 1.0,
  memoryRetrievalAccuracy: 0.9,
});

console.log('Optimization result:', record);
```

## 最佳实践

### 1. 提示词版本控制

```typescript
// 每次优化增加版本号，便于回滚
if (optimization.afterPerformance < 0.5) {
  // 性能下降，回滚到上一版本
  await selfManager.rollback();
}
```

### 2. A/B测试

```typescript
// 保留多个版本的自我提示词
const variants = ['v1', 'v2', 'v3'];
const selected = variants[Math.floor(Math.random() * variants.length)];
await selfManager.loadVersion(selected);
```

### 3. 渐进式优化

```typescript
// 不要一次性做大的修改
// 每次只调整一个参数
const gradualOptimization = {
  maxChangesPerOptimization: 1,
  minTimeBetweenOptimizations: 60000, // 1分钟
  maxAdjustmentMagnitude: 0.1, // 每次最多调整10%
};
```

## 故障排除

### 问题1: 提示词超出预算频繁截断

**解决方案**:
```typescript
// 增加记忆压缩率
memoryManager.setCompressionLevel('aggressive');

// 或者增加上下文窗口
const assembler = new PromptAssembler(config, selfConfigPath, 16384); // 16k
```

### 问题2: 自我优化过于频繁

**解决方案**:
```typescript
// 提高优化阈值
const optimizer = new SelfPromptOptimizer({
  minDecisionsForOptimization: 10, // 至少10次决策后才优化
  minPerformanceDelta: 0.1, // 性能变化至少10%才触发
});
```

### 问题3: 优化后性能下降

**解决方案**:
```typescript
// 启用回滚机制
selfManager.on('optimized', async (record) => {
  // 观察下一次任务的表现
  await new Promise(resolve => setTimeout(resolve, 60000));
  
  const recentPerformance = calculateRecentPerformance();
  if (recentPerformance < record.beforePerformance) {
    console.warn('Optimization decreased performance, rolling back...');
    await selfManager.rollback();
  }
});
```

## 下一步

完成软自指集成后，可以继续实现：

1. **硬自指**: Agent修改自己的源代码
2. **策略进化**: 自动调整激素衰减率、记忆阈值等
3. **工具生成**: 根据需求自动生成新工具

---

*集成指南版本: 1.0*  
*最后更新: 2026-02-17*
