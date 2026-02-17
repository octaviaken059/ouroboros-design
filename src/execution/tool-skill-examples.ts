/**
 * 工具与技能管理示例
 * 
 * 展示工具 vs 技能的区别，以及按需加载机制
 */

import {
  ToolSkillManager,
  ToolType,
  SkillType,
  TOOL_CATEGORIES,
  SKILL_CATEGORIES,
} from './tool-skill-manager.js';

// ============================================================================
// 示例1: 工具 vs 技能概念演示
// ============================================================================

async function example1_toolVsSkillConcept() {
  console.log('=== 示例1: 工具 vs 技能概念 ===\n');

  const manager = new ToolSkillManager();

  // === 工具 (滑雪板) ===
  console.log('🛠️ 工具 (外部资源) - 类似滑雪板\n');
  
  const ffmpegTool = manager.registerTool({
    name: 'ffmpeg',
    displayName: 'FFmpeg',
    description: '音视频处理命令行工具',
    type: ToolType.CLI,
    category: 'content.video',
    tags: ['video', 'audio', 'conversion', 'media'],
    source: {
      type: 'system',
      location: '/usr/bin/ffmpeg',
      version: '5.1.2',
    },
    capabilities: [
      'convert video formats',
      'extract audio from video',
      'merge audio and video',
      'resize video resolution',
    ],
    inputs: [
      { name: 'input', type: 'file', description: 'Input file path', required: true },
      { name: 'output', type: 'file', description: 'Output file path', required: true },
      { name: 'codec', type: 'string', description: 'Video codec', required: false },
    ],
    outputs: [
      { name: 'output_file', type: 'file', description: 'Processed media file' },
    ],
    loadPriority: 'on_demand',  // 按需加载
    autoLoad: false,
  });

  const openaiTool = manager.registerTool({
    name: 'openai_api',
    displayName: 'OpenAI API',
    description: 'OpenAI大语言模型API',
    type: ToolType.API,
    category: 'ai.llm',
    tags: ['ai', 'llm', 'generation', 'completion'],
    source: {
      type: 'service',
      location: 'https://api.openai.com',
    },
    capabilities: [
      'text generation',
      'chat completion',
      'embedding creation',
    ],
    inputs: [
      { name: 'prompt', type: 'string', description: 'Input prompt', required: true },
      { name: 'model', type: 'string', description: 'Model name', required: false },
    ],
    outputs: [
      { name: 'text', type: 'string', description: 'Generated text' },
      { name: 'tokens', type: 'number', description: 'Token count' },
    ],
    loadPriority: 'critical',  // 关键工具，总是加载
    autoLoad: true,
  });

  console.log(`注册工具: ${ffmpegTool.displayName}`);
  console.log(`  - 类型: ${ffmpegTool.type} (外部命令行工具)`);
  console.log(`  - 位置: ${ffmpegTool.source.location}`);
  console.log(`  - 能力: ${ffmpegTool.capabilities.length} 项`);
  console.log(`  - 加载策略: ${ffmpegTool.loadPriority}`);
  console.log();

  console.log(`注册工具: ${openaiTool.displayName}`);
  console.log(`  - 类型: ${openaiTool.type} (在线服务API)`);
  console.log(`  - 位置: ${openaiTool.source.location}`);
  console.log(`  - 加载策略: ${openaiTool.loadPriority}`);
  console.log();

  // === 技能 (滑雪技术) ===
  console.log('🧠 技能 (内部能力) - 类似滑雪技术\n');

  const videoEditingSkill = manager.registerSkill({
    name: 'video_editing',
    displayName: '视频编辑',
    description: '使用FFmpeg等工具进行视频剪辑、转码、合并',
    type: SkillType.CONTENT_CREATION,
    category: 'content',
    tags: ['video', 'editing', 'media-processing'],
    level: 'intermediate',
    experience: 3500,
    requires: {
      tools: ['tool.content.video.ffmpeg'],  // 依赖 ffmpeg 工具
      skills: ['skill.fundamental.plan'],      // 需要规划能力
      capabilities: ['file-manipulation'],
    },
    implementation: {
      type: 'workflow',
      workflow: [
        '分析视频需求和约束',
        '选择合适的编码参数',
        '执行 ffmpeg 命令',
        '验证输出质量',
        '优化文件大小（如需要）',
      ],
    },
    loadPriority: 'on_demand',
    autoLoad: false,
  });

  const codeRefactoringSkill = manager.registerSkill({
    name: 'code_refactoring',
    displayName: '代码重构',
    description: '改进代码结构而不改变外部行为',
    type: SkillType.REFACTORING,
    category: 'coding',
    tags: ['code-quality', 'maintenance', 'optimization'],
    level: 'advanced',
    experience: 7200,
    requires: {
      tools: ['tool.dev.vcs.git'],  // 依赖 git 做版本控制
      skills: ['skill.coding.js', 'skill.fundamental.logic'],
      capabilities: ['pattern-recognition', 'abstraction'],
    },
    implementation: {
      type: 'pattern',
      pattern: `
        1. 识别代码坏味道 (code smells)
        2. 确保有充分的测试覆盖
        3. 小步重构，频繁测试
        4. 使用重构手法: {extract_method, rename_variable, inline_temp}
        5. 提交变更到版本控制
      `,
    },
    loadPriority: 'medium',
    autoLoad: false,
  });

  console.log(`注册技能: ${videoEditingSkill.displayName}`);
  console.log(`  - 类型: ${videoEditingSkill.type} (领域技能)`);
  console.log(`  - 等级: ${videoEditingSkill.level} (${videoEditingSkill.experience} XP)`);
  console.log(`  - 依赖工具: ${videoEditingSkill.requires.tools?.join(', ')}`);
  console.log(`  - 实现方式: ${videoEditingSkill.implementation.type}`);
  console.log();

  console.log(`注册技能: ${codeRefactoringSkill.displayName}`);
  console.log(`  - 类型: ${codeRefactoringSkill.type} (技术技能)`);
  console.log(`  - 等级: ${codeRefactoringSkill.level}`);
  console.log(`  - 掌握度: ${Math.round(codeRefactoringSkill.mastery * 100)}%`);
  console.log();

  // === 概念对比 ===
  console.log('📊 工具 vs 技能对比:\n');
  console.log('| 维度 | 工具 (滑雪板) | 技能 (滑雪技术) |');
  console.log('|------|--------------|----------------|');
  console.log('| 本质 | 外部资源 | 内部能力 |');
  console.log('| 获取 | 发现/安装 | 学习/练习 |');
  console.log('| 存储 | 系统路径/URL | 知识/经验 |');
  console.log('| 使用 | 直接调用 | 应用解法 |');
  console.log('| 改进 | 升级/替换 | 练习/反思 |');
  console.log('| 置信度 | 成功率统计 | 掌握度评估 |');
  console.log();
}

// ============================================================================
// 示例2: 按需加载机制
// ============================================================================

async function example2_onDemandLoading() {
  console.log('\n=== 示例2: 按需加载机制 ===\n');

  const manager = new ToolSkillManager();

  // 注册一批工具
  const tools = [
    { name: 'ffmpeg', category: 'content.video', priority: 'on_demand' as const, tags: ['video'] },
    { name: 'git', category: 'dev.vcs', priority: 'critical' as const, tags: ['version-control'] },
    { name: 'docker', category: 'system.process', priority: 'medium' as const, tags: ['container'] },
    { name: 'openai', category: 'ai.llm', priority: 'critical' as const, tags: ['ai', 'generation'] },
    { name: 'puppeteer', category: 'auto.browser', priority: 'on_demand' as const, tags: ['browser'] },
    { name: 'pandas', category: 'data.analysis', priority: 'on_demand' as const, tags: ['data'] },
    { name: 'canvas', category: 'content.image', priority: 'high' as const, tags: ['visualization'] },
    { name: 'sqlite', category: 'data.db', priority: 'medium' as const, tags: ['database'] },
  ];

  for (const t of tools) {
    manager.registerTool({
      name: t.name,
      displayName: t.name.toUpperCase(),
      description: `${t.name} tool`,
      type: ToolType.CLI,
      category: t.category,
      tags: t.tags,
      source: { type: 'system' },
      capabilities: [],
      inputs: [],
      outputs: [],
      loadPriority: t.priority,
      autoLoad: t.priority === 'critical' || t.priority === 'high',
    });
  }

  // 注册一批技能
  const skills = [
    { name: 'video_editing', category: 'content', priority: 'on_demand' as const, tags: ['video'] },
    { name: 'web_development', category: 'coding', priority: 'high' as const, tags: ['web'] },
    { name: 'data_analysis', category: 'data', priority: 'on_demand' as const, tags: ['data'] },
    { name: 'debugging', category: 'fundamental', priority: 'critical' as const, tags: ['debug'] },
    { name: 'browser_automation', category: 'automation', priority: 'on_demand' as const, tags: ['browser'] },
  ];

  for (const s of skills) {
    manager.registerSkill({
      name: s.name,
      displayName: s.name.replace('_', ' '),
      description: `${s.name} skill`,
      type: SkillType.CODING,
      category: s.category,
      tags: s.tags,
      level: 'intermediate',
      experience: 3000,
      requires: {},
      implementation: { type: 'pattern' },
      loadPriority: s.priority,
      autoLoad: s.priority === 'critical' || s.priority === 'high',
    });
  }

  console.log('总注册数量:');
  console.log(`- 工具: ${manager.getAllTools().length} 个`);
  console.log(`- 技能: ${manager.getAllSkills().length} 个\n`);

  // 场景1: 处理视频请求
  console.log('场景1: 用户请求 "帮我剪辑这个视频"\n');
  const videoResult = manager.loadOnDemand({
    context: '帮我剪辑这个视频',
    intent: 'video editing',
    topic: 'video',
    maxTools: 5,
    maxSkills: 3,
    includePatterns: true,
  });

  console.log(`加载结果:`);
  console.log(`- 工具: ${videoResult.tools.map(t => t.name).join(', ')}`);
  console.log(`- 技能: ${videoResult.skills.map(s => s.name).join(', ')}`);
  console.log(`- 相关度: ${Math.round(videoResult.estimatedRelevance * 100)}%`);
  console.log(`- 原因: ${videoResult.reasoning.join('; ')}\n`);

  // 生成自我描述
  const videoDesc = manager.generateSelfDescription(videoResult);
  console.log('生成的自我描述:');
  console.log(videoDesc.slice(0, 800) + '...\n');

  // 场景2: 数据分析请求
  console.log('场景2: 用户请求 "分析这个CSV文件"\n');
  const dataResult = manager.loadOnDemand({
    context: '分析这个CSV文件',
    intent: 'data analysis',
    topic: 'data',
    maxTools: 5,
    maxSkills: 3,
    includePatterns: true,
  });

  console.log(`加载结果:`);
  console.log(`- 工具: ${dataResult.tools.map(t => t.name).join(', ')}`);
  console.log(`- 技能: ${dataResult.skills.map(s => s.name).join(', ')}`);
  console.log(`- 相关度: ${Math.round(dataResult.estimatedRelevance * 100)}%\n`);
}

// ============================================================================
// 示例3: 分类体系展示
// ============================================================================

async function example3_categorySystem() {
  console.log('\n=== 示例3: 分类体系 ===\n');

  console.log('工具分类 (TOOL_CATEGORIES):\n');
  
  const toolRootCats = TOOL_CATEGORIES.filter(c => !c.parent);
  for (const cat of toolRootCats) {
    console.log(`📁 ${cat.name}`);
    console.log(`   ${cat.description}`);
    
    const subCats = TOOL_CATEGORIES.filter(c => c.parent === cat.id);
    for (const sub of subCats) {
      console.log(`   └─ ${sub.name}: ${sub.description}`);
    }
    console.log();
  }

  console.log('技能分类 (SKILL_CATEGORIES):\n');
  
  const skillRootCats = SKILL_CATEGORIES.filter(c => !c.parent);
  for (const cat of skillRootCats) {
    console.log(`📁 ${cat.name}`);
    console.log(`   ${cat.description}`);
    
    const subCats = SKILL_CATEGORIES.filter(c => c.parent === cat.id);
    for (const sub of subCats) {
      console.log(`   └─ ${sub.name}: ${sub.description}`);
    }
    console.log();
  }
}

// ============================================================================
// 示例4: 技能成长和掌握
// ============================================================================

async function example4_skillGrowth() {
  console.log('\n=== 示例4: 技能成长 ===\n');

  const manager = new ToolSkillManager();

  // 注册一个初级技能
  const skill = manager.registerSkill({
    name: 'web_scraping',
    displayName: '网页抓取',
    description: '从网页提取结构化数据',
    type: SkillType.BROWSER_AUTOMATION,
    category: 'automation',
    tags: ['web', 'data-extraction'],
    level: 'novice',
    experience: 0,
    requires: {
      tools: ['tool.auto.browser.puppeteer'],
      skills: ['skill.fundamental.logic'],
    },
    implementation: {
      type: 'workflow',
      workflow: ['分析页面结构', '选择合适的选择器', '提取数据', '处理异常'],
    },
    loadPriority: 'on_demand',
    autoLoad: false,
  });

  console.log(`初始状态: ${skill.displayName}`);
  console.log(`- 等级: ${skill.level}`);
  console.log(`- 经验: ${skill.experience} XP`);
  console.log(`- 掌握度: ${Math.round(skill.mastery * 100)}%`);
  console.log(`- 状态: ${skill.status}\n`);

  // 模拟应用技能
  console.log('模拟技能应用:\n');
  
  const scenarios = [
    { success: true, complexity: 3 },   // 成功，简单任务
    { success: true, complexity: 5 },   // 成功，中等任务
    { success: false, complexity: 4 },  // 失败，中等任务
    { success: true, complexity: 6 },   // 成功，较难任务
    { success: true, complexity: 8 },   // 成功，困难任务
  ];

  for (let i = 0; i < 20; i++) {
    const scenario = scenarios[i % scenarios.length];
    manager.recordSkillApplication(skill.id, scenario.success, scenario.complexity);
    
    const updated = manager.getSkill(skill.id)!;
    if (i % 5 === 4) {
      console.log(`  应用 ${i + 1} 次后: ${updated.experience} XP, ${updated.level}, ${Math.round(updated.mastery * 100)}%`);
    }
  }

  const finalSkill = manager.getSkill(skill.id)!;
  console.log(`\n最终状态:`);
  console.log(`- 等级: ${finalSkill.level}`);
  console.log(`- 经验: ${finalSkill.experience} XP`);
  console.log(`- 掌握度: ${Math.round(finalSkill.mastery * 100)}%`);
  console.log(`- 成功率: ${Math.round(finalSkill.stats.successRate * 100)}%`);
  console.log(`- 状态: ${finalSkill.status}`);
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log('🐍 Ouroboros 工具与技能管理示例\n');
  console.log('=' .repeat(60) + '\n');

  try {
    // 示例1: 工具vs技能概念
    await example1_toolVsSkillConcept();

    // 示例2: 按需加载
    await example2_onDemandLoading();

    // 示例3: 分类体系
    await example3_categorySystem();

    // 示例4: 技能成长
    await example4_skillGrowth();

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
