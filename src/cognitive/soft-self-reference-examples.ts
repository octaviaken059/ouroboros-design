/**
 * 软自指提示词系统 - 使用示例
 * 
 * 展示如何初始化和使用软自指系统
 */

import {
  PromptAssembler,
  SelfPromptManager,
  MemoryPromptManager,
  TokenBudgetManager,
  PerformanceMetrics,
  PROMPT_TEMPLATES,
} from './soft-self-reference.js';
import * as os from 'os';

// ============================================================================
// 示例1: 基础初始化
// ============================================================================

async function example1_basicSetup() {
  console.log('=== 示例1: 基础初始化 ===\n');

  // 创建提示词组装器
  const assembler = new PromptAssembler(
    {
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      safetyRules: [
        '- Never execute untrusted code',
        '- Always validate user input',
        '- Log all significant actions',
      ],
      forbiddenActions: [
        '- Delete system files',
        '- Execute shell commands without validation',
        '- Access sensitive user data',
      ],
    },
    './data/self-prompt.json',  // 自我提示词持久化路径
    8192  // 最大上下文窗口 (8k tokens)
  );

  // 组装提示词
  const result = assembler.assemble({
    userMessage: '帮我分析一下当前的系统状态',
    recentMemories: [
      {
        timestamp: Date.now() - 3600000,
        type: 'command',
        content: 'User checked system status',
        importance: 0.6,
      },
      {
        timestamp: Date.now() - 7200000,
        type: 'observation',
        content: 'CPU usage was high at 85%',
        importance: 0.7,
      },
    ],
    retrievedMemories: [
      {
        relevance: 0.9,
        memory: 'System status includes CPU, memory, disk usage',
        source: 'semantic_memory',
      },
      {
        relevance: 0.7,
        memory: 'User prefers concise technical summaries',
        source: 'reflective_memory',
      },
    ],
    summary: {
      keyInsights: [
        'User frequently checks system metrics',
        'Prefers visual representations when available',
      ],
      recurringPatterns: [
        'System checks often followed by optimization requests',
      ],
      lessonsLearned: [
        'Always provide both current values and trends',
      ],
    },
    context: {
      topic: 'system_monitoring',
      userIntent: 'assess_current_status',
      pendingQuestions: [],
      establishedFacts: ['User has admin access'],
    },
  });

  console.log('组装结果:');
  console.log(`- 总Token数: ${result.totalTokens}`);
  console.log(`- 预算使用: ${(result.budgetUsed * 100).toFixed(1)}%`);
  console.log(`- 是否截断: ${result.truncated}`);
  console.log(`- 优化策略: ${result.optimizations.join(', ') || '无'}`);
  console.log('\n完整提示词预览:');
  console.log(result.fullPrompt.slice(0, 500) + '...\n');

  return assembler;
}

// ============================================================================
// 示例2: 自我提示词优化
// ============================================================================

async function example2_selfOptimization(assembler: PromptAssembler) {
  console.log('=== 示例2: 自我提示词优化 ===\n');

  // 模拟一次成功的任务执行
  const successMetrics: PerformanceMetrics = {
    taskSuccess: true,
    userSatisfaction: 0.9,
    executionTime: 1200,
    tokenEfficiency: 0.8,
    toolSelectionAccuracy: 1.0,
    memoryRetrievalAccuracy: 0.9,
  };

  console.log('记录成功性能指标...');
  const optimization1 = await assembler.recordPerformance(successMetrics);
  
  if (optimization1) {
    console.log('优化已触发:');
    console.log(`- 策略: ${optimization1.strategy}`);
    console.log(`- Token变化: ${optimization1.beforeTokens} -> ${optimization1.afterTokens}`);
    console.log(`- 性能变化: ${optimization1.beforePerformance.toFixed(2)} -> ${optimization1.afterPerformance.toFixed(2)}`);
    console.log(`- 变更: ${optimization1.changes.join(', ')}\n`);
  } else {
    console.log('未达到优化阈值\n');
  }

  // 模拟一次失败的任务执行
  const failureMetrics: PerformanceMetrics = {
    taskSuccess: false,
    executionTime: 5000,
    tokenEfficiency: 0.3,
    toolSelectionAccuracy: 0.4,
    memoryRetrievalAccuracy: 0.5,
  };

  console.log('记录失败性能指标...');
  const optimization2 = await assembler.recordPerformance(failureMetrics);
  
  if (optimization2) {
    console.log('优化已触发:');
    console.log(`- 策略: ${optimization2.strategy}`);
    console.log(`- 变更: ${optimization2.changes.join(', ')}\n`);
  }
}

// ============================================================================
// 示例3: 动态更新自我状态
// ============================================================================

async function example3_dynamicUpdates(assembler: PromptAssembler) {
  console.log('=== 示例3: 动态更新自我状态 ===\n');

  const selfManager = assembler.getSelfManager();

  // 更新当前状态
  console.log('更新激素水平和任务状态...');
  selfManager.updateState({
    hormoneLevels: {
      adrenaline: 0.3,
      cortisol: 0.2,
      dopamine: 0.4,
      serotonin: 0.6,
      curiosity: 0.5,
    },
    activeTasks: 2,
    bodyStatus: 'healthy',
  });

  // 添加新工具
  console.log('添加新工具...');
  selfManager.updateToolConfidence('system_info', 0.95);

  // 添加新技能
  console.log('添加新技能...');
  selfManager.addSkill({
    name: 'system_analysis',
    level: 'expert',
    successRate: 0.92,
  });

  // 更新偏好
  console.log('更新行为偏好...');
  selfManager.updatePreferences({
    riskTolerance: 0.4,
    verbosity: 'concise',
  });

  console.log('自我提示词已更新\n');
}

// ============================================================================
// 示例4: 长对话上下文管理
// ============================================================================

async function example4_longContextManagement(assembler: PromptAssembler) {
  console.log('=== 示例4: 长对话上下文管理 ===\n');

  const memoryManager = assembler.getMemoryManager();

  // 模拟一个长对话
  const conversationHistory: Array<{
    timestamp: number;
    type: string;
    content: string;
    importance: number;
  }> = [];

  // 生成大量历史记录
  for (let i = 0; i < 20; i++) {
    conversationHistory.push({
      timestamp: Date.now() - (20 - i) * 60000,
      type: i % 2 === 0 ? 'user_message' : 'agent_response',
      content: `Message ${i + 1}: ${'x'.repeat(100)}`,
      importance: Math.random() * 0.5 + 0.3,
    });
  }

  // 组装提示词 - 系统会自动选择最重要的记忆
  const result = assembler.assemble({
    userMessage: '基于我们之前的讨论，给我做个总结',
    recentMemories: conversationHistory,
    retrievedMemories: [
      {
        relevance: 0.95,
        memory: 'User prefers executive summaries over detailed reports',
        source: 'preference_memory',
      },
      {
        relevance: 0.88,
        memory: 'Previous summary at 2024-01-15 was well received',
        source: 'episodic_memory',
      },
    ],
    summary: {
      keyInsights: [
        'Discussion covered performance optimization strategies',
        'User emphasized cost-effectiveness',
        'Security considerations were raised multiple times',
      ],
      recurringPatterns: [
        'User frequently asks for summaries after long exchanges',
        'Technical details often followed by simplification requests',
      ],
      lessonsLearned: [
        'Start with key takeaways, then provide details if asked',
        'Include concrete numbers when discussing performance',
      ],
    },
    context: {
      topic: 'conversation_summary',
      userIntent: 'get_executive_summary',
      pendingQuestions: [],
      establishedFacts: ['20 messages exchanged', 'Topics: optimization, cost, security'],
    },
  });

  console.log(`长对话处理结果:`);
  console.log(`- 输入记忆数: ${conversationHistory.length}`);
  console.log(`- 最终Token数: ${result.totalTokens}`);
  console.log(`- 是否截断: ${result.truncated}`);
  console.log(`- 优化: ${result.optimizations.join(', ') || '无'}\n`);
}

// ============================================================================
// 示例5: 不同模型的Token预算
// ============================================================================

async function example5_differentModels() {
  console.log('=== 示例5: 不同模型的Token预算 ===\n');

  const models = [
    { name: 'GPT-3.5', contextWindow: 4096 },
    { name: 'GPT-4', contextWindow: 8192 },
    { name: 'GPT-4-32k', contextWindow: 32768 },
    { name: 'Claude-3', contextWindow: 200000 },
  ];

  for (const model of models) {
    const budgetManager = new TokenBudgetManager(model.contextWindow);
    const budget = budgetManager.getBudget();

    console.log(`${model.name} (${model.contextWindow} tokens):`);
    console.log(`  系统: ${budget.system} tokens (${(budget.system / model.contextWindow * 100).toFixed(1)}%)`);
    console.log(`  自我: ${budget.self} tokens (${(budget.self / model.contextWindow * 100).toFixed(1)}%)`);
    console.log(`  记忆: ${budget.memory} tokens (${(budget.memory / model.contextWindow * 100).toFixed(1)}%)`);
    console.log(`  用户: ${budget.working} tokens (${(budget.working / model.contextWindow * 100).toFixed(1)}%)`);
    console.log(`  预留: ${budget.reserve} tokens (${(budget.reserve / model.contextWindow * 100).toFixed(1)}%)`);
    console.log('');
  }
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log('🐍 Ouroboros 软自指提示词系统 - 使用示例\n');
  console.log('=' .repeat(60) + '\n');

  try {
    // 示例1: 基础初始化
    const assembler = await example1_basicSetup();

    // 示例2: 自我优化
    await example2_selfOptimization(assembler);

    // 示例3: 动态更新
    await example3_dynamicUpdates(assembler);

    // 示例4: 长对话管理
    await example4_longContextManagement(assembler);

    // 示例5: 不同模型
    await example5_differentModels();

    console.log('=' .repeat(60));
    console.log('✅ 所有示例执行完成!');

  } catch (error) {
    console.error('❌ 执行出错:', error);
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };
