#!/bin/bash
# 完整诊断和修复脚本

echo "=== Ouroboros 诊断工具 ==="
echo ""

# 检查端口
echo "1. 检查端口 8080..."
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "   ❌ 端口8080被占用，尝试关闭..."
    lsof -Pi :8080 -sTCP:LISTEN -t | xargs kill -9 2>/dev/null
    sleep 1
else
    echo "   ✅ 端口8080可用"
fi

# 检查数据库锁定文件
echo "2. 检查数据库锁定..."
if [ -f "data/ouroboros.db-shm" ] || [ -f "data/ouroboros.db-wal" ]; then
    echo "   ⚠️  发现数据库锁定文件，清理中..."
    rm -f data/ouroboros.db-shm data/ouroboros.db-wal
    echo "   ✅ 已清理"
else
    echo "   ✅ 数据库未锁定"
fi

# 检查依赖
echo "3. 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "   ❌ node_modules 不存在，安装中..."
    npm install
else
    echo "   ✅ 依赖已安装"
fi

echo ""
echo "=== 启动 Agent ==="
echo ""

# 启动
unset DEBUG
export DEBUG=""
node launch.mjs 2>&1 | grep -E "(启动成功|失败|http://|Error|Error:)" || true
