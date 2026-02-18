/**
 * @file tests/setup.ts
 * @description Jest 测试设置
 */

// 设置测试环境
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // 测试中只记录错误日志

// 清理日志目录
import { rmSync, existsSync } from 'fs';
import { join } from 'path';

const logsDir = join(process.cwd(), 'logs');
if (existsSync(logsDir)) {
  rmSync(logsDir, { recursive: true, force: true });
}
