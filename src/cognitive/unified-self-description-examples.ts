/**
 * 统一自我描述系统 - 使用示例
 * 
 * 展示如何将身体图式、自我认知、世界模型、工具集统一为自我描述
 * 并通过反思驱动更新
 */

import { UnifiedSelfDescription, ReflectionResult } from './unified-self-description.js';

// ============================================================================
// 示例1: 初始化和基础使用
// ============================================================================

async function example1_basicUsage() {
  console.log('=== 示例1: 基础使用 ===\n');

  const selfDesc = new UnifiedSelfDescription('./data/unified-self');

  // 监听变更事件
  selfDesc.on('bodyUpdated', ({ changes }) => {
    console.log('身体图式更新:', changes);
  });

  selfDesc.on('toolRegistered', (tool) => {
    console.log('新工具注册:', tool.name);
  });

  selfDesc.on('worldModelUpdated', () => {
    console.log('世界模型已更新');
  });

  // 注册内置工具
  selfDesc.registerTool({
    name: 'file_read',
    description: 'Read file content',
    confidence: 0.9,
    successRate: 0.95,
  });

  selfDesc.registerTool({
    name: 'web_search',
    description: 'Search the web',
    confidence: 0.85,
    successRate: 0.88,
  });

  // 添加MCP服务器
  selfDesc.addMCPServer({
    name: 'filesystem',
    enabled: true,
    tools: ['read_file', 'write_file', 'list_directory'],
    status: 'connected',
  });

  // 更新身体图式
  selfDesc.updateBodySchema({
    resources: {
      memory: { total: 16, used: 8, available: 8 },
      storage: { total: 1000, used: 300, available: 700 },
      compute: { cores: 8, load: 0.4 },
    },
  });

  // 添加传感器
  selfDesc.addSensor({
    name: 'file_system',
    type: 'data_source',
    status: 'active',
  });

  // 生成自我提示词
  const prompt = selfDesc.generateSelfPrompt();
  console.log('生成的自我提示词:');
  console.log(prompt.slice(0, 500) + '...\n');
}

// ============================================================================
// 示例2: 反思驱动更新
// ============================================================================

async function example2_reflectionDrivenUpdate() {
  console.log('=== 示例2: 反思驱动更新 ===\n');

  const selfDesc = new UnifiedSelfDescription('./data/unified-self');

  // 初始化一些工具
  selfDesc.registerTool({
    name: 'web_search',
    description: 'Search web',
    confidence: 0.85,
    successRate: 0.88,
  });

  // 模拟反思
  const reflection = await selfDesc.reflect({
    recentMemories: [
      { content: 'User asked to read a PDF file but I cannot do that', type: 'episodic' },
      { content: 'Browser MCP server available in environment', type: 'system' },
      { content: 'Canvas tool can display visual content', type: 'discovery' },
    ],
    performanceMetrics: [
      { tool: 'web_search', success: true, time: 1000 },
      { tool: 'web_search', success: true, time: 1200 },
      { task: 'pdf_read', success: false, error: 'tool_not_found' },
    ],
    systemEvents: [
      { type: 'hardware_detected', name: 'canvas_display', capabilities: ['visualization'] },
    ],
    trigger: 'performance_drop',
  });

  console.log('反思结果:');
  console.log(`- 触发原因: ${reflection.trigger}`);
  console.log(`- 洞察数量: ${reflection.insights.length}`);
  console.log(`- 建议变更: ${reflection.proposedChanges.length}\n`);

  // 展示洞察
  for (const insight of reflection.insights) {
    console.log(`洞察 [${insight.category}/${insight.type}]:`);
    console.log(`  ${insight.description}`);
    console.log(`  置信度: ${insight.confidence}`);
    console.log(`  建议: ${insight.suggestedAction}\n`);
  }

  // 应用变更
  const changes = await selfDesc.applyReflectionChanges(reflection, 'conservative');
  console.log(`应用了 ${changes.changes.length} 个变更`);
}

// ============================================================================
// 示例3: 完整的自我进化循环
// ============================================================================

async function example3_evolutionLoop() {
  console.log('=== 示例3: 完整进化循环 ===\n');

  const selfDesc = new UnifiedSelfDescription('./data/unified-self');

  // 初始化状态
  selfDesc.updateBodySchema({
    sensors: [
      { name: 'file_system', type: 'data_source', status: 'active' },
    ],
    actuators: [
      { name: 'console_output', type: 'display', capabilities: ['text'] },
    ],
  });

  selfDesc.updateWorldModel({
    environment: {
      type: 'linux-server',
      description: 'Server environment with limited tools',
      constraints: ['no_gui', 'limited_memory'],
    },
    capabilities: {
      strengths: ['fast_text_processing', 'web_search'],
      weaknesses: ['no_visual_capabilities', 'limited_storage'],
      limitations: ['cannot_process_pdfs', 'no_image_generation'],
    },
  });

  console.log('初始状态:');
  console.log('- 传感器:', selfDesc.getPart('body').sensors.length);
  console.log('- 执行器:', selfDesc.getPart('body').actuators.length);
  console.log('- 工具:', selfDesc.getPart('toolSet').builtIn.length);
  console.log('- 世界模型模式:', selfDesc.getPart('worldModel').dynamics.patterns.length);

  // 模拟一轮反思
  console.log('\n执行反思...');
  
  const reflection = await selfDesc.reflect({
    recentMemories: [
      { type: 'discovery', content: 'Found canvas tool in environment' },
      { type: 'discovery', content: 'MCP puppeteer server available' },
      { type: 'pattern', content: 'User frequently asks for visual content' },
      { type: 'limitation', content: 'Cannot generate images - missing tool' },
    ],
    performanceMetrics: [],
    systemEvents: [
      { type: 'hardware_detected', name: 'canvas_display' },
      { type: 'mcp_available', name: 'puppeteer' },
    ],
    trigger: 'scheduled',
  });

  // 应用变更
  const changes = await selfDesc.applyReflectionChanges(reflection, 'auto');

  console.log('\n反思后状态:');
  console.log('- 传感器:', selfDesc.getPart('body').sensors.length);
  console.log('- 执行器:', selfDesc.getPart('body').actuators.length);
  console.log('- 最近发现工具:', selfDesc.getPart('toolSet').recentlyDiscovered.length);
  console.log('- 世界模型模式:', selfDesc.getPart('worldModel').dynamics.patterns.length);

  // 生成更新后的自我提示词
  console.log('\n更新后的自我提示词摘要:');
  const prompt = selfDesc.generateSelfPrompt();
  const lines = prompt.split('\n').filter(l => l.includes('Discovered') || l.includes('Patterns'));
  for (const line of lines) {
    console.log(line);
  }
}

// ============================================================================
// 示例4: 与原有子系统集成
// ============================================================================

async function example4_integrationWithSubsystems() {
  console.log('=== 示例4: 与原有子系统集成 ===\n');

  const selfDesc = new UnifiedSelfDescription('./data/unified-self');

  console.log('展示统一自我描述如何整合原有子系统:\n');

  // 1. 激素系统 → cognitiveState.hormoneLevels
  console.log('1. 激素系统整合:');
  selfDesc.updateCognitiveState({
    hormoneLevels: {
      adrenaline: 0.1,
      cortisol: 0.2,
      dopamine: 0.8,  // 高多巴胺，积极状态
      serotonin: 0.6,
      curiosity: 0.9,
    },
  });
  console.log('   激素状态已同步到 cognitiveState.hormoneLevels\n');

  // 2. 贝叶斯认知 → toolSet.builtIn.confidence
  console.log('2. 贝叶斯认知整合:');
  selfDesc.registerTool({
    name: 'code_analysis',
    description: 'Analyze code quality',
    confidence: 0.5,  // 低置信度，需要练习
    successRate: 0.4,
  });
  
  // 成功使用几次后更新
  selfDesc.updateToolConfidence('code_analysis', 0.7, 0.75);
  console.log('   工具置信度已从 0.5 提升到 0.7\n');

  // 3. 身体图式 → body.resources
  console.log('3. 身体图式整合:');
  selfDesc.updateBodySchema({
    resources: {
      memory: { total: 32, used: 12, available: 20 },
      storage: { total: 2000, used: 500, available: 1500 },
      compute: { cores: 16, load: 0.3 },
    },
  });
  console.log('   资源状态已同步到 body.resources\n');

  // 4. 世界模型更新
  console.log('4. 世界模型整合:');
  selfDesc.addWorldPattern('Users prefer concise responses in morning');
  selfDesc.addWorldPattern('Visual tools increase user satisfaction by 40%');
  console.log('   已添加 2 个观察到的模式到 worldModel.dynamics.patterns\n');

  // 5. 生成完整的自我提示词
  console.log('5. 生成的自我提示词包含所有整合信息:');
  const prompt = selfDesc.generateSelfPrompt();
  
  // 提取关键部分
  const sections = ['Cognitive State', 'Tool Set', 'Body', 'World Model'];
  for (const section of sections) {
    const match = prompt.match(new RegExp(`### ${section}[\\s\\S]*?(?=###|$)`));
    if (match) {
      console.log(`\n${match[0].slice(0, 200)}...`);
    }
  }
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log('🐍 Ouroboros 统一自我描述系统 - 使用示例\n');
  console.log('=' .repeat(60) + '\n');

  try {
    // 示例1: 基础使用
    await example1_basicUsage();

    // 示例2: 反思驱动更新
    await example2_reflectionDrivenUpdate();

    // 示例3: 完整进化循环
    await example3_evolutionLoop();

    // 示例4: 与原有子系统集成
    await example4_integrationWithSubsystems();

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
