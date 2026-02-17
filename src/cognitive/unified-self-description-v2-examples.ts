/**
 * 统一自我描述 v2 - 完整工作流示例
 * 
 * 展示：初始化 → 反思 → 加载能力 → 生成描述 → 工具发现
 */

import { UnifiedSelfDescriptionV2 } from './unified-self-description-v2.js';

// ============================================================================
// 示例1: 完整工作流
// ============================================================================

async function example1_completeWorkflow() {
  console.log('=== 示例1: 完整工作流 ===\n');

  // 1. 初始化系统
  console.log('1. 初始化统一自我描述系统...');
  const self = new UnifiedSelfDescriptionV2('./data/self-v2-demo');
  await self.initialize();
  console.log('✅ 系统初始化完成\n');

  // 2. 查看初始状态
  console.log('2. 初始状态:');
  console.log(self.generateBriefSelfDescription());
  console.log();

  // 3. 模拟不同场景，按需加载能力
  console.log('3. 场景模拟:\n');

  // 场景A: 视频处理请求
  console.log('场景A: 用户请求 "剪辑这个视频"');
  const videoResult = self.loadCapabilities({
    context: '剪辑视频',
    intent: 'video editing',
    topic: 'video',
    maxTools: 3,
    maxSkills: 2,
    includePatterns: true,
  });
  console.log(`加载了 ${videoResult.tools.length} 个工具, ${videoResult.skills.length} 个技能`);
  console.log(`工具: ${videoResult.tools.map(t => t.name).join(', ')}`);
  console.log();

  // 生成针对视频处理的自我描述
  console.log('生成的自我描述 (视频处理):');
  console.log(self.generateSelfDescription().slice(0, 600) + '...\n');

  // 场景B: 数据分析请求
  console.log('场景B: 用户请求 "分析销售数据"');
  self.setCurrentFocus('data analysis');
  const dataResult = self.loadCapabilities({
    context: '分析销售数据',
    intent: 'data analysis',
    topic: 'data',
    maxTools: 3,
    maxSkills: 2,
    includePatterns: true,
  });
  console.log(`加载了 ${dataResult.tools.length} 个工具, ${dataResult.skills.length} 个技能`);
  console.log(`工具: ${dataResult.tools.map(t => t.name).join(', ')}`);
  console.log();

  // 生成针对数据分析的自我描述
  console.log('生成的自我描述 (数据分析):');
  console.log(self.generateSelfDescription().slice(0, 600) + '...\n');
}

// ============================================================================
// 示例2: 反思驱动工具发现
// ============================================================================

async function example2_reflectionDrivenDiscovery() {
  console.log('\n=== 示例2: 反思驱动工具发现 ===\n');

  const self = new UnifiedSelfDescriptionV2('./data/self-v2-demo');
  await self.initialize();

  // 模拟一些记忆
  const memories = [
    { content: 'User asked to convert a video to GIF', type: 'request' },
    { content: 'Tried to process video but no ffmpeg found', type: 'error' },
    { content: 'User mentioned using puppeteer for scraping', type: 'mention' },
  ];

  console.log('执行反思...');
  const reflection = await self.reflect({
    recentMemories: memories,
    performanceMetrics: [
      { success: false, task: 'video_convert' },
      { success: false, task: 'web_scrape' },
    ],
    systemEvents: [],
    trigger: 'performance_drop',
  });

  console.log(`\n反思结果:`);
  console.log(`- 发现新工具: ${reflection.discoveries.newTools.length} 个`);
  console.log(`- 洞察: ${reflection.insights.length} 条`);
  
  for (const insight of reflection.insights) {
    console.log(`  • [${insight.category}] ${insight.description}`);
    console.log(`    建议: ${insight.suggestedAction}`);
  }

  // 查看更新后的能力统计
  const desc = self.getDescription();
  console.log(`\n更新后能力统计:`);
  console.log(`- 工具总数: ${desc.capabilities.tools.total}`);
  console.log(`- 关键工具: ${desc.capabilities.tools.critical}`);
}

// ============================================================================
// 示例3: 工具vs技能在自我描述中的区别
// ============================================================================

async function example3_toolVsSkillInDescription() {
  console.log('\n=== 示例3: 工具vs技能在自我描述中的区别 ===\n');

  const self = new UnifiedSelfDescriptionV2('./data/self-v2-demo');
  await self.initialize();

  // 加载相关能力
  self.loadCapabilities({
    context: 'web development and video processing',
    maxTools: 10,
    maxSkills: 10,
    includePatterns: true,
  });

  const description = self.generateSelfDescription();

  console.log('自我描述中的工具部分:');
  console.log('```');
  const toolSection = description.match(/### Tools[\s\S]*?(?=###|$)/);
  if (toolSection) {
    console.log(toolSection[0].slice(0, 500));
  }
  console.log('```\n');

  console.log('自我描述中的技能部分:');
  console.log('```');
  const skillSection = description.match(/### Skills[\s\S]*?(?=###|$)/);
  if (skillSection) {
    console.log(skillSection[0].slice(0, 500));
  }
  console.log('```\n');

  console.log('📊 区别总结:');
  console.log('| 特征 | 工具 (Tools) | 技能 (Skills) |');
  console.log('|------|-------------|---------------|');
  console.log('| 来源 | 外部发现 | 内部学习 |');
  console.log('| 表示 | 名称+置信度 | 名称+等级+掌握度 |');
  console.log('| 使用 | 直接调用 | 应用模式/工作流 |');
  console.log('| 提升 | 升级/替换 | 练习积累经验 |');
}

// ============================================================================
// 示例4: 资源优化对比
// ============================================================================

async function example4_resourceOptimization() {
  console.log('\n=== 示例4: 按需加载的资源优化 ===\n');

  const self = new UnifiedSelfDescriptionV2('./data/self-v2-demo');
  await self.initialize();

  const manager = self.getToolSkillManager();

  // 注册大量工具和技能（模拟真实场景）
  console.log('注册大量能力...');
  
  // 50个工具
  for (let i = 0; i < 50; i++) {
    manager.registerTool({
      name: `tool_${i}`,
      displayName: `Tool ${i}`,
      description: `Description for tool ${i}`,
      type: 'cli' as any,
      category: i < 10 ? 'system' : i < 20 ? 'dev' : i < 30 ? 'ai' : i < 40 ? 'data' : 'content',
      tags: [`tag${i}`],
      source: { type: 'system' },
      capabilities: [],
      inputs: [],
      outputs: [],
      loadPriority: i < 5 ? 'critical' : i < 15 ? 'high' : i < 30 ? 'medium' : 'on_demand',
      autoLoad: i < 5,
    });
  }

  // 30个技能
  for (let i = 0; i < 30; i++) {
    manager.registerSkill({
      name: `skill_${i}`,
      displayName: `Skill ${i}`,
      description: `Description for skill ${i}`,
      type: 'coding' as any,
      category: i < 10 ? 'coding' : i < 20 ? 'data' : 'automation',
      tags: [`tag${i}`],
      level: 'intermediate',
      experience: 3000,
      requires: {},
      implementation: { type: 'pattern' },
      loadPriority: i < 5 ? 'critical' : i < 10 ? 'high' : 'on_demand',
      autoLoad: i < 5,
    });
  }

  console.log(`总注册: ${manager.getAllTools().length} 工具, ${manager.getAllSkills().length} 技能\n`);

  // 对比：全量加载 vs 按需加载
  console.log('对比测试:\n');

  // 全量（理论）
  console.log('A. 全量加载（理论）:');
  console.log(`   工具: ${manager.getAllTools().length} 个`);
  console.log(`   技能: ${manager.getAllSkills().length} 个`);
  console.log(`   估计Token: ~${(manager.getAllTools().length + manager.getAllSkills().length) * 50}`);
  console.log();

  // 按需加载
  console.log('B. 按需加载（实际）:');
  const result = self.loadCapabilities({
    context: 'coding task',
    intent: 'software development',
    topic: 'coding',
    maxTools: 5,
    maxSkills: 5,
    includePatterns: true,
  });
  console.log(`   工具: ${result.tools.length} 个`);
  console.log(`   技能: ${result.skills.length} 个`);
  console.log(`   估计Token: ~${(result.tools.length + result.skills.length) * 50}`);
  console.log(`   节省: ${Math.round((1 - (result.tools.length + result.skills.length) / 80) * 100)}%`);
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log('🐍 Ouroboros 统一自我描述 v2 - 完整工作流示例\n');
  console.log('=' .repeat(60) + '\n');

  try {
    // 示例1: 完整工作流
    await example1_completeWorkflow();

    // 示例2: 反思驱动工具发现
    await example2_reflectionDrivenDiscovery();

    // 示例3: 工具vs技能区别
    await example3_toolVsSkillInDescription();

    // 示例4: 资源优化
    await example4_resourceOptimization();

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
