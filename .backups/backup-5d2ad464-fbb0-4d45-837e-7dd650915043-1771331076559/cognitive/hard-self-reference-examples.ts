/**
 * 硬自指系统 - 使用示例
 */

import {
  HardSelfReferenceEngine,
  ModificationType,
  ModificationStatus,
  CodeSafetyAnalyzer,
  SandboxEnvironment,
  DeploymentManager,
} from './hard-self-reference.js';

import * as path from 'path';

// ============================================================================
// 示例1: 基础初始化和安全分析
// ============================================================================

async function example1_safetyAnalysis() {
  console.log('=== 示例1: 代码安全分析 ===\n');

  const analyzer = new CodeSafetyAnalyzer();

  // 测试安全代码
  const safeCode = `
function add(a: number, b: number): number {
  return a + b;
}
`;

  const safeResult = analyzer.analyze(safeCode, 'src/math.ts');
  console.log('安全代码分析结果:');
  console.log(`- 安全: ${safeResult.safe}`);
  console.log(`- 评分: ${(safeResult.score * 100).toFixed(0)}%`);
  console.log(`- 问题数: ${safeResult.issues.length}\n`);

  // 测试危险代码
  const dangerousCode = `
function process(input: string) {
  return eval(input);
}

const result = new Function(userCode)();
`;

  const dangerResult = analyzer.analyze(dangerousCode, 'src/process.ts');
  console.log('危险代码分析结果:');
  console.log(`- 安全: ${dangerResult.safe}`);
  console.log(`- 评分: ${(dangerResult.score * 100).toFixed(0)}%`);
  console.log('- 问题:');
  for (const issue of dangerResult.issues) {
    console.log(`  * [${issue.severity}] 第${issue.line}行: ${issue.description}`);
  }
  console.log('');
}

// ============================================================================
// 示例2: 硬自指引擎 - 提议修改
// ============================================================================

async function example2_proposeModification() {
  console.log('=== 示例2: 提议代码修改 ===\n');

  const engine = new HardSelfReferenceEngine(
    './src',
    {
      workDir: './data/hard-self-ref',
      sandboxTimeout: 60000,
      deployment: {
        strategy: 'full_restart',
        healthCheckTimeout: 5000,
        autoRollbackOnFailure: true,
        requireHumanApproval: true, // 需要人工批准
      },
    }
  );

  // 监听事件
  engine.on('validating', ({ modificationId }) => {
    console.log(`📝 修改 ${modificationId.slice(0, 8)}... 正在验证`);
  });

  engine.on('sandboxTesting', ({ modificationId }) => {
    console.log(`🧪 修改 ${modificationId.slice(0, 8)}... 正在进行沙箱测试`);
  });

  engine.on('awaitingReview', ({ modificationId }) => {
    console.log(`⏳ 修改 ${modificationId.slice(0, 8)}... 等待人工审查`);
  });

  // 提议添加新工具
  const modification = await engine.proposeModification(
    ModificationType.ADD_TOOL,
    '添加数据分析工具',
    '基于反思：Agent经常需要处理数据分析任务，应添加专用工具',
    [
      {
        filePath: 'src/execution/tools/data-analysis.ts',
        proposedContent: `export const dataAnalysisTool = {
  name: 'data_analysis',
  description: 'Analyze numerical data and return statistics',
  parameters: {
    type: 'object',
    properties: {
      data: { type: 'array', items: { type: 'number' } },
    },
    required: ['data'],
  },
  execute: async (args: unknown) => {
    const { data } = args as { data: number[] };
    const sum = data.reduce((a, b) => a + b, 0);
    const avg = sum / data.length;
    return { sum, average: avg, count: data.length };
  },
};`,
      },
    ]
  );

  console.log(`\n✅ 修改提议已创建: ${modification.id}`);
  console.log(`- 类型: ${modification.type}`);
  console.log(`- 描述: ${modification.description}`);
  console.log(`- 状态: ${modification.status}`);
  console.log(`- 文件数: ${modification.targetFiles.length}`);
  console.log(`- 安全检查:`, modification.safetyChecks);
  console.log('');

  return { engine, modification };
}

// ============================================================================
// 示例3: 基于反思自动生成修改
// ============================================================================

async function example3_generateFromReflection() {
  console.log('=== 示例3: 基于反思生成修改 ===\n');

  const engine = new HardSelfReferenceEngine('./src', {
    workDir: './data/hard-self-ref',
    sandboxTimeout: 60000,
    deployment: {
      strategy: 'full_restart',
      healthCheckTimeout: 5000,
      autoRollbackOnFailure: true,
      requireHumanApproval: true,
    },
  });

  // 模拟反思结果
  const reflectionResult = {
    insights: [
      {
        category: 'limitation' as const,
        insight: 'Agent lacks ability to analyze image content',
        actionItems: ['Add image analysis tool', 'Integrate vision model'],
      },
      {
        category: 'limitation' as const,
        insight: 'Cannot generate data visualizations',
        actionItems: ['Add chart generation capability'],
      },
      {
        category: 'error' as const,
        insight: 'Frequent timeout on large file processing',
        actionItems: ['Implement streaming processing'],
      },
    ],
    learningDirections: [
      'Improve multi-modal capabilities',
      'Optimize performance for large files',
    ],
  };

  const suggestions = await engine.generateModificationFromReflection(reflectionResult);

  console.log(`基于反思生成了 ${suggestions.length} 个修改建议:\n`);

  for (let i = 0; i < suggestions.length; i++) {
    const suggestion = suggestions[i];
    console.log(`${i + 1}. ${suggestion.type}`);
    console.log(`   描述: ${suggestion.description}`);
    console.log(`   原因: ${suggestion.reasoning.slice(0, 100)}...`);
    console.log(`   目标文件: ${suggestion.targetFiles.map(f => f.path).join(', ')}`);
    console.log('');
  }
}

// ============================================================================
// 示例4: 查看修改历史和状态
// ============================================================================

async function example4_modificationHistory() {
  console.log('=== 示例4: 修改历史管理 ===\n');

  const engine = new HardSelfReferenceEngine('./src', {
    workDir: './data/hard-self-ref',
    sandboxTimeout: 60000,
    deployment: {
      strategy: 'full_restart',
      healthCheckTimeout: 5000,
      autoRollbackOnFailure: true,
      requireHumanApproval: false, // 自动部署
    },
  });

  // 创建几个修改记录（模拟历史）
  const modifications = [];

  // 修改1: 已部署
  const mod1 = await engine.proposeModification(
    ModificationType.ADD_TOOL,
    '添加系统信息工具',
    '需要获取系统状态',
    [{
      filePath: 'src/tools/system.ts',
      proposedContent: 'export const systemTool = {};',
    }]
  );
  modifications.push(mod1);

  console.log('修改历史:');
  console.table(engine.getModifications().map(m => ({
    id: m.id.slice(0, 8),
    type: m.type,
    status: m.status,
    description: m.description.slice(0, 30),
  })));

  console.log(`\n总计: ${engine.getModifications().length} 个修改提议`);
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log('🐍 Ouroboros 硬自指系统 - 使用示例\n');
  console.log('=' .repeat(60) + '\n');

  try {
    // 示例1: 安全分析
    await example1_safetyAnalysis();

    // 示例2: 提议修改
    const { engine, modification } = await example2_proposeModification();

    // 示例3: 基于反思生成
    await example3_generateFromReflection();

    // 示例4: 历史管理
    await example4_modificationHistory();

    console.log('=' .repeat(60));
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
