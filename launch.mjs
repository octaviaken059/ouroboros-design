#!/usr/bin/env node
/**
 * 简化启动脚本 - 绕过所有环境变量问题
 */

process.env.DEBUG = '';
process.env.NODE_ENV = 'production';

console.log('>>> 正在启动 Ouroboros Agent...');
console.log('>>> 如果卡住超过5秒，请按 Ctrl+C 退出\n');

// 设置超时检测
const timeout = setTimeout(() => {
  console.log('\n>>> 启动似乎卡住了，可能的原因：');
  console.log('1. 端口8080被占用 - 请检查并关闭其他服务');
  console.log('2. 数据库锁定 - 请删除 data/ouroboros.db-shm 和 data/ouroboros.db-wal');
  console.log('3. 模型服务未启动 - 请确保 Ollama 在运行 (ollama serve)');
  process.exit(1);
}, 10000);

async function main() {
  try {
    const { OuroborosAgent } = await import('./src/core/agent');
    const agent = OuroborosAgent.create();
    await agent.start();
    
    clearTimeout(timeout);
    console.log('\n✅ 启动成功！');
    console.log('🌐 http://localhost:8080');
    console.log('按 Ctrl+C 停止\n');
    
    // 保持运行
    await new Promise(() => {});
  } catch (err) {
    clearTimeout(timeout);
    console.error('\n❌ 启动失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
