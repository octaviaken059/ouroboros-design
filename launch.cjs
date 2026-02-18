#!/usr/bin/env node
/**
 * 简化启动脚本 - 使用 tsx 运行
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('>>> 正在启动 Ouroboros Agent...\n');

// 使用 tsx 运行 TypeScript
const child = spawn('npx', ['tsx', 'src/main.ts'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DEBUG: '',
    NODE_ENV: 'production'
  },
  cwd: __dirname
});

child.on('error', (err) => {
  console.error('>>> 启动失败:', err.message);
  if (err.code === 'ENOENT') {
    console.error('>>> 请先运行: npm install');
  }
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code);
});
