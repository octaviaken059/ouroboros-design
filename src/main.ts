/**
 * @file main.ts
 * @description Ouroboros Agent 启动入口
 * @author Ouroboros
 * @date 2026-02-18
 */

import { OuroborosAgent } from './core/agent';
import { createContextLogger } from './utils/logger';

const logger = createContextLogger('Main');

/**
 * 启动 Agent
 */
async function main() {
  console.log('>>> MAIN STARTED');
  try {
    logger.info('🐍⭕ Ouroboros Agent 启动中...');
    console.log('>>> BEFORE CREATE');
    
    // 创建 Agent 实例
    const agent = OuroborosAgent.create();
    console.log('>>> AFTER CREATE');
    
    // 启动 Agent（会自动启动 Web 服务器）
    console.log('>>> BEFORE START');
    await agent.start();
    console.log('>>> AFTER START');
    
    logger.info('✅ Agent 启动成功');
    logger.info('🌐 Web 控制台: http://localhost:8080');
    logger.info('💬 聊天界面: http://localhost:8080');
    logger.info('📊 监控面板: http://localhost:8080 → 点击"监控"');
    logger.info('🐛 调试模式: http://localhost:8080 → 点击"调试"');
    
    // 优雅关闭处理
    process.on('SIGINT', async () => {
      logger.info('🛑 接收到 SIGINT，正在关闭...');
      await agent.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('🛑 接收到 SIGTERM，正在关闭...');
      await agent.stop();
      process.exit(0);
    });
    
    // 保持进程运行
    await new Promise(() => {});
    
  } catch (error) {
    logger.error('❌ Agent 启动失败', { error });
    process.exit(1);
  }
}

// 启动
main();
