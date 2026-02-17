/**
 * MCP 集成示例
 * 
 * 展示如何将 MCP 服务器作为工具集成到 Agent
 */

import { EnhancedUnifiedAgent } from '../enhanced-unified-agent.js';
import { MCPToolManager, MCPServerConfig } from './mcp-tool-manager.js';

// ============================================================================
// 示例1: 基础 MCP 集成
// ============================================================================

async function example1_basicMCPIntegration() {
  console.log('=== 示例1: MCP 基础集成 ===\n');

  // 创建 Agent
  const agent = new EnhancedUnifiedAgent({
    scheduler: { homeostasisEnable: true },
    memory: { maxMemoryCount: 1000 },
    safety: { enableDualMind: true },
  });

  await agent.start();

  // 创建 MCP 工具管理器
  const mcpManager = new MCPToolManager('./data/mcp-servers.json');

  // 配置 MCP 服务器（示例：文件系统 MCP）
  const fsServerConfig: MCPServerConfig = {
    name: 'filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    enabled: true,
    timeout: 30000,
  };

  // 配置 Git MCP
  const gitServerConfig: MCPServerConfig = {
    name: 'git',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-git'],
    enabled: true,
  };

  // 配置 SQLite MCP
  const sqliteServerConfig: MCPServerConfig = {
    name: 'sqlite',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite', '/tmp/data.db'],
    enabled: true,
  };

  console.log('正在连接 MCP 服务器...\n');

  try {
    // 连接各 MCP 服务器
    await mcpManager.connectServer(fsServerConfig);
    console.log('✅ Filesystem MCP 已连接');

    await mcpManager.connectServer(gitServerConfig);
    console.log('✅ Git MCP 已连接');

    await mcpManager.connectServer(sqliteServerConfig);
    console.log('✅ SQLite MCP 已连接');

    // 获取所有可用工具
    const tools = mcpManager.getAllTools();
    console.log(`\n📦 共发现 ${tools.length} 个 MCP 工具:\n`);

    for (const tool of tools) {
      console.log(`- ${tool.name}`);
      console.log(`  ${tool.description}`);
      console.log('');
    }

    // 示例：调用文件系统工具
    console.log('📂 调用 filesystem.read_file 工具示例:');
    try {
      const result = await mcpManager.callTool('filesystem.read_file', {
        path: '/tmp/test.txt',
      });
      console.log('结果:', result);
    } catch (error) {
      console.log('预期错误（文件不存在）:', (error as Error).message);
    }

    // 将 MCP 工具注册到 Agent
    console.log('\n🔗 将 MCP 工具注册到 Agent...');
    for (const tool of tools) {
      // 这里假设 Agent 有 registerTool 方法
      // agent.registerTool(tool.name, tool.execute, tool.parameters);
    }

    // 查看连接状态
    console.log('\n📊 MCP 服务器状态:');
    console.table(mcpManager.getStatus());

  } catch (error) {
    console.error('MCP 连接失败:', error);
  }

  // 断开所有连接
  await mcpManager.disconnectAll();
  await agent.stop();

  console.log('\n✅ MCP 集成示例完成');
}

// ============================================================================
// 示例2: 动态 MCP 服务器管理
// ============================================================================

async function example2_dynamicMCPManagement() {
  console.log('\n=== 示例2: 动态 MCP 管理 ===\n');

  const mcpManager = new MCPToolManager('./data/mcp-servers.json');

  // 保存配置
  const servers: MCPServerConfig[] = [
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/user'],
      enabled: true,
    },
    {
      name: 'puppeteer',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
      enabled: false, // 默认不启用
    },
  ];

  await mcpManager.saveConfig(servers);
  console.log('✅ MCP 配置已保存');

  // 加载配置
  const loadedConfig = await mcpManager.loadConfig();
  console.log(`\n📋 加载了 ${loadedConfig.length} 个 MCP 服务器配置`);

  for (const server of loadedConfig) {
    console.log(`- ${server.name}: ${server.enabled ? '已启用' : '已禁用'}`);
  }
}

// ============================================================================
// 示例3: Agent + MCP 完整集成
// ============================================================================

async function example3_agentWithMCP() {
  console.log('\n=== 示例3: Agent + MCP 完整集成 ===\n');

  // 创建支持 MCP 的 Agent 配置
  const agent = new EnhancedUnifiedAgent({
    scheduler: { homeostasisEnable: true },
    memory: { maxMemoryCount: 10000, enableVectorization: true },
    safety: { enableDualMind: true, enableGodelImmunity: true },
    softSelfReference: {
      enabled: true,
      dataDir: './data/self-ref',
      maxContextWindow: 8192,
      systemSafetyRules: [
        'MCP tools must be validated before execution',
        'File system operations require path validation',
      ],
      forbiddenActions: [
        'Execute MCP tools outside sandbox',
        'Modify system files via MCP',
      ],
    },
    abTesting: { enabled: true },
    versionControl: { enabled: true },
  });

  // MCP 管理器
  const mcpManager = new MCPToolManager();

  // 监听 MCP 事件
  mcpManager.on('serverStatusChange', ({ server, status }) => {
    console.log(`[MCP] ${server} 状态变化: ${status}`);
    agent.recordEvent('mcp_status_change', { server, status });
  });

  mcpManager.on('toolRegistered', ({ server, tool }) => {
    console.log(`[MCP] 新工具注册: ${server}.${tool.name}`);
  });

  await agent.start();

  console.log('Agent 已启动，支持 MCP 工具\n');

  // 在实际应用中，这里会将 MCP 工具与 Agent 的工具系统集成
  // 使得 Agent 可以像调用普通工具一样调用 MCP 工具

  await agent.stop();
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log('🐍 Ouroboros MCP 集成示例\n');
  console.log('=' .repeat(60) + '\n');

  try {
    // 示例1: 基础集成
    await example1_basicMCPIntegration();

    // 示例2: 动态管理
    await example2_dynamicMCPManagement();

    // 示例3: 完整集成
    await example3_agentWithMCP();

    console.log('\n' + '=' .repeat(60));
    console.log('✅ 所有 MCP 示例执行完成!');

  } catch (error) {
    console.error('\n❌ 执行出错:', error);
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };
