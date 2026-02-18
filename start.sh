#!/bin/bash
# 启动脚本 - 禁用调试日志

export DEBUG=""
export NODE_ENV="production"

cd "$(dirname "$0")"
npx tsx src/main.ts
