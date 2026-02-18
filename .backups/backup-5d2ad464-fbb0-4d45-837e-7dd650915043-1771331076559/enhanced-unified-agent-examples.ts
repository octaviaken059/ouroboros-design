/**
 * 增强版UnifiedAgent - 使用示例
 * 
 * 展示软自指、A/B测试、版本回滚、硬自指准备的完整功能
 */

import {
  EnhancedUnifiedAgent,
  EnhancedUnifiedAgentConfig,
  ABTestManager,
  VersionRollbackManager,
  HardSelfReferenceManager,
} from './enhanced-unified-agent.js';

import * as os from 'os';
import * as path from 'path';

// ============================================================================
// 示例1: 基础初始化（启用软自指）
// ============================================================================

async function example1_basicSetup() {
  console.log('=== 示例1: 基础初始化 ===\n');

  const config: EnhancedUnifiedAgentConfig = {
    // 原有配置
    scheduler: {
      homeostasisEnable: true,
      cpuThreshold: 80,
      memoryThreshold: 85,
    },
    memory: {
      maxMemoryCount: 10000,
      enableVectorization: false,
    },
    safety: {
      enableDualMind: true,
      enableGodelImmunity: true,
    },

    // 软自指配置
    softSelfReference: {
      enabled: true,
      dataDir: './data/self-ref',
      maxContextWindow: 8192,
      systemSafetyRules: [
        '- Never execute untrusted code',
        '- Always validate user input',
        '- Log all significant actions',
        '- Respect resource limits',
      ],
      forbiddenActions: [
        '- Delete or modify system files',
        '- Execute shell commands without validation',
        '- Expose sensitive credentials',
        '- Modify the system prompt (self-reference only)',
      ],
    },

    // A/B测试配置
    abTesting: {
      enabled: true,
      minSamplesForComparison: 10,
      confidenceThreshold: 0.95,
    },

    // 版本控制配置
    versionControl: {
      enabled: true,
      maxVersions: 50,
      autoRollbackThreshold: 0.6, // 成功率低于60%自动回滚
    },

    // 硬自指（准备阶段）
    hardSelfReference: {
      enabled: false, // 当前不启用
      codeBasePath: './src',
      requireHumanApproval: true,
    },
  };

  const agent = new EnhancedUnifiedAgent(config);

  // 监听事件
  agent.on('started', () => console.log('✅ Agent started'));
  agent.on('selfOptimized', (record) => {
    console.log(`🔄 Self-optimized: ${record.strategy}`);
  });
  agent.on('rollbackRecommended', (check) => {
    console.log(`⚠️ Rollback recommended: ${check.reason}`);
  });

  await agent.start();

  console.log('\nAgent status:', agent.getStatus());

  return agent;
}

// ============================================================================
// 示例2: 使用软自指组装提示词
// ============================================================================

async function example2_assemblePrompt(agent: EnhancedUnifiedAgent) {
  console.log('\n=== 示例2: 组装提示词 ===\n');

  const userMessage = '帮我分析一下当前的系统状态，并给出优化建议';

  // 组装提示词
  const result = agent.assemblePrompt(userMessage);

  console.log('提示词组装结果:');
  console.log(`- 总Token数: ${result.totalTokens}`);
  console.log(`- 是否截断: ${result.truncated}`);
  console.log(`- 提示词预览 (前500字符):`);
  console.log(result.prompt.slice(0, 500) + '...\n');
}

// ============================================================================
// 示例3: 记录性能反馈，触发自我优化
// ============================================================================

async function example3_recordPerformance(agent: EnhancedUnifiedAgent) {
  console.log('=== 示例3: 性能反馈与自我优化 ===\n');

  // 模拟成功任务
  console.log('记录成功任务...');
  await agent.recordPerformance({
    taskSuccess: true,
    userSatisfaction: 0.9,
    executionTime: 1200,
    tokenEfficiency: 0.85,
    toolSelectionAccuracy: 1.0,
    memoryRetrievalAccuracy: 0.9,
  });

  // 模拟失败任务
  console.log('记录失败任务...');
  await agent.recordPerformance({
    taskSuccess: false,
    executionTime: 5000,
    tokenEfficiency: 0.3,
    toolSelectionAccuracy: 0.4,
    memoryRetrievalAccuracy: 0.5,
  });

  console.log('');
}

// ============================================================================
// 示例4: A/B测试
// ============================================================================

async function example4_abTesting() {
  console.log('=== 示例4: A/B测试 ===\n');

  const abManager = new ABTestManager('./data/ab-test');

  // 创建基准变体
  const baseContent = {
    identity: { name: 'Ouroboros', version: '1.0.0', description: 'Base variant', createdAt: new Date().toISOString() },
    currentState: {
      mode: 'serving',
      hormoneLevels: { adrenaline: 0.1, cortisol: 0.1, dopamine: 0.1, serotonin: 0.5, curiosity: 0.3 },
      bodyStatus: 'healthy',
      activeTasks: 0,
      memoryStats: { total: 100, consolidated: 20 },
    },
    responsibilities: ['Assist user', 'Learn from interactions'],
    currentGoals: ['Improve accuracy'],
    worldModel: { environment: 'Node.js', constraints: [], capabilities: [], limitations: [] },
    availableTools: [],
    skills: [],
    preferences: { riskTolerance: 0.5, explorationRate: 0.3, verbosity: 'balanced' as const, proactivity: 'balanced' as const },
  };

  // 创建变体A（高探索）
  const variantA = abManager.createVariant(baseContent, 'High Exploration');
  variantA.content.preferences.explorationRate = 0.7;
  variantA.content.preferences.riskTolerance = 0.6;

  // 创建变体B（保守）
  const variantB = abManager.createVariant(baseContent, 'Conservative');
  variantB.content.preferences.explorationRate = 0.2;
  variantB.content.preferences.riskTolerance = 0.3;

  console.log(`创建变体A: ${variantA.name} (ID: ${variantA.id})`);
  console.log(`创建变体B: ${variantB.name} (ID: ${variantB.id})`);

  // 启动A/B测试
  abManager.startABTest(variantA.id, variantB.id);
  console.log('A/B测试已启动\n');

  // 模拟任务结果
  for (let i = 0; i < 15; i++) {
    const success = i % 3 !== 0; // 66%成功率
    abManager.recordTaskResult(success, {
      taskSuccess: success,
      executionTime: success ? 1000 : 5000,
      tokenEfficiency: success ? 0.8 : 0.4,
      toolSelectionAccuracy: success ? 0.9 : 0.5,
      memoryRetrievalAccuracy: success ? 0.85 : 0.4,
    });
  }

  // 查看当前活跃变体
  const activeVariant = abManager.getActiveVariant();
  console.log(`当前活跃变体: ${activeVariant?.name || 'None'}`);

  // 查看所有变体性能
  console.log('\n变体性能统计:');
  for (const variant of abManager.getAllVariants()) {
    const perf = variant.performance;
    const successRate = perf.totalTasks > 0 
      ? (perf.successfulTasks / perf.totalTasks * 100).toFixed(1)
      : 'N/A';
    console.log(`- ${variant.name}: ${successRate}% success rate (${perf.totalTasks} tasks)`);
  }
}

// ============================================================================
// 示例5: 版本回滚
// ============================================================================

async function example5_versionRollback() {
  console.log('\n=== 示例5: 版本回滚 ===\n');

  const versionManager = new VersionRollbackManager('./data/versions');

  // 保存几个版本
  const baseContent = {
    identity: { name: 'Ouroboros', version: '1.0.0', description: 'Test', createdAt: new Date().toISOString() },
    currentState: {
      mode: 'serving',
      hormoneLevels: { adrenaline: 0.1, cortisol: 0.1, dopamine: 0.1, serotonin: 0.5, curiosity: 0.3 },
      bodyStatus: 'healthy',
      activeTasks: 0,
      memoryStats: { total: 100, consolidated: 20 },
    },
    responsibilities: ['Assist user'],
    currentGoals: ['Improve accuracy'],
    worldModel: { environment: 'Node.js', constraints: [], capabilities: [], limitations: [] },
    availableTools: [],
    skills: [],
    preferences: { riskTolerance: 0.5, explorationRate: 0.3, verbosity: 'balanced' as const, proactivity: 'balanced' as const },
  };

  // 版本1：初始版本
  versionManager.saveVersion(
    baseContent,
    { avgSuccessRate: 0.85, avgTokenEfficiency: 0.8 },
    'Initial version'
  );

  // 版本2：增加风险偏好
  const v2Content = JSON.parse(JSON.stringify(baseContent));
  v2Content.preferences.riskTolerance = 0.7;
  versionManager.saveVersion(
    v2Content,
    { avgSuccessRate: 0.75, avgTokenEfficiency: 0.75 },
    'Increased risk tolerance'
  );

  // 版本3：进一步优化
  const v3Content = JSON.parse(JSON.stringify(v2Content));
  v3Content.preferences.explorationRate = 0.6;
  versionManager.saveVersion(
    v3Content,
    { avgSuccessRate: 0.65, avgTokenEfficiency: 0.7 },
    'Increased exploration rate'
  );

  console.log('已保存3个版本');
  console.log(`版本历史数: ${versionManager.getVersionHistory().length}`);

  // 检查是否需要回滚
  const rollbackCheck = versionManager.shouldRollback({ avgSuccessRate: 0.6 });
  
  if (rollbackCheck.shouldRollback) {
    console.log(`\n⚠️ 建议回滚: ${rollbackCheck.reason}`);
    console.log(`建议回滚到版本: ${rollbackCheck.targetVersion?.id.slice(0, 8)}...`);

    // 执行回滚
    const rolledBackVersion = versionManager.rollback();
    if (rolledBackVersion) {
      console.log(`✅ 已回滚到版本: ${rolledBackVersion.changeDescription}`);
    }
  }

  console.log(`\n当前最新版本: ${versionManager.getLatestVersion()?.changeDescription}`);
}

// ============================================================================
// 示例6: 硬自指准备（代码修改提议）
// ============================================================================

async function example6_hardSelfReference() {
  console.log('\n=== 示例6: 硬自指准备 ===\n');

  const hardManager = new HardSelfReferenceManager('./src');

  // 模拟基于反思结果生成修改建议
  const reflectionResult = {
    insights: [
      {
        category: 'limitation' as const,
        insight: 'Agent lacks ability to analyze image content',
        actionItems: ['Add image analysis tool', 'Integrate vision model'],
      },
      {
        category: 'pattern' as const,
        insight: 'Frequent requests for data visualization',
        actionItems: ['Add chart generation tool'],
      },
    ],
    learningDirections: ['Improve multi-modal capabilities'],
  };

  const suggestions = hardManager.generateModificationSuggestions(reflectionResult);

  console.log(`生成 ${suggestions.length} 个修改建议:`);
  for (const suggestion of suggestions) {
    console.log(`\n类型: ${suggestion.type}`);
    console.log(`描述: ${suggestion.description}`);
    console.log(`目标文件: ${suggestion.targetFile}`);
    console.log(`安全检查: ${suggestion.safetyChecks.join(', ')}`);

    // 提交修改提议
    const proposalId = hardManager.proposeModification(suggestion);
    console.log(`提议ID: ${proposalId}`);

    // 验证修改
    const validation = await hardManager.validateModification(proposalId);
    console.log(`验证结果: ${validation.valid ? '✅ 通过' : '❌ 失败'}`);
    if (!validation.valid) {
      console.log(`问题: ${validation.issues.join(', ')}`);
    }
    console.log(`安全评分: ${(validation.safetyScore * 100).toFixed(0)}%`);
  }

  // 查看所有提议
  console.log(`\n所有修改提议:`);
  for (const proposal of hardManager.getProposals()) {
    console.log(`- ${proposal.type}: ${proposal.status}`);
  }
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log('🐍 Ouroboros 增强版UnifiedAgent - 完整示例\n');
  console.log('=' .repeat(60) + '\n');

  try {
    // 示例1: 基础初始化
    const agent = await example1_basicSetup();

    // 示例2: 组装提示词
    await example2_assemblePrompt(agent);

    // 示例3: 性能反馈
    await example3_recordPerformance(agent);

    // 示例4: A/B测试
    await example4_abTesting();

    // 示例5: 版本回滚
    await example5_versionRollback();

    // 示例6: 硬自指准备
    await example6_hardSelfReference();

    // 停止Agent
    await agent.stop();

    console.log('\n' + '=' .repeat(60));
    console.log('✅ 所有示例执行完成!');

  } catch (error) {
    console.error('\n❌ 执行出错:', error);
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };
