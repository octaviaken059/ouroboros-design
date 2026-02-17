/**
 * 监控面板启动示例
 * 
 * 展示如何启动Web监控服务器
 */

import { EnhancedUnifiedAgent } from '../enhanced-unified-agent.js';
import { MonitorServer } from './monitor-server.js';

async function main() {
  console.log('🚀 启动 Ouroboros 监控面板...\n');

  // 1. 创建 Agent
  const agent = new EnhancedUnifiedAgent({
    identity: { name: 'Ouroboros', version: '2.0.0' },
    scheduler: { homeostasisEnable: true },
    memory: { maxMemoryCount: 10000 },
    safety: { enableDualMind: true },
    softSelfReference: {
      enabled: true,
      dataDir: './data/self-ref',
      maxContextWindow: 8192,
      systemSafetyRules: ['Never execute untrusted code'],
      forbiddenActions: ['Delete system files'],
    },
    abTesting: { enabled: true },
    versionControl: { enabled: true },
  });

  // 2. 初始化 Agent
  await agent.initialize();
  await agent.start();

  console.log('✅ Agent 已启动\n');

  // 3. 创建监控服务器
  const monitor = new MonitorServer(agent, 3000);
  monitor.start(3000);

  console.log('\n📊 监控面板已就绪');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 Web界面: http://localhost:3000/monitor');
  console.log('📡 API接口: http://localhost:3000/api/status');
  console.log('🔌 WebSocket: ws://localhost:3000');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 4. 模拟一些活动
  console.log('📝 模拟系统活动...');
  
  setInterval(() => {
    // 模拟任务处理
    const tasks = [
      '数据分析',
      '代码生成',
      '文档编写',
      '图像处理',
      'API调用',
    ];
    const task = tasks[Math.floor(Math.random() * tasks.length)];
    console.log(`[${new Date().toLocaleTimeString()}] 处理任务: ${task}`);
  }, 10000);

  // 5. 优雅退出
  process.on('SIGINT', async () => {
    console.log('\n\n👋 正在关闭监控服务器...');
    monitor.stop();
    await agent.stop();
    console.log('✅ 已安全退出');
    process.exit(0);
  });
}

// 如果直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };
