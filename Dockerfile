# Ouroboros - 具身自指进化AI Agent
# 🐍⭕ "The Eternal Serpent Devours Itself to Be Reborn"

# ============================================================================
# 构建阶段
# ============================================================================
FROM node:20-alpine AS builder

# 设置工作目录
WORKDIR /app

# 安装构建依赖
RUN apk add --no-cache python3 make g++

# 复制包管理文件
COPY package*.json ./

# 安装所有依赖 (包括开发依赖)
RUN npm ci

# 复制源代码
COPY . .

# 编译 TypeScript
RUN npm run build

# 清理开发依赖
RUN npm prune --production

# ============================================================================
# 生产阶段
# ============================================================================
FROM node:20-alpine AS production

# 元数据
LABEL maintainer="Ouroboros Team"
LABEL description="Embodied Self-Referential Evolving AI Agent"
LABEL version="1.0.0"

# 安装生产环境依赖
RUN apk add --no-cache \
    curl \
    ca-certificates \
    tzdata \
    && rm -rf /var/cache/apk/*

# 创建非root用户
RUN addgroup -g 1001 -S ouro && \
    adduser -S ouro -u 1001

# 设置工作目录
WORKDIR /app

# 从构建阶段复制必要文件
COPY --from=builder --chown=ouro:ouro /app/dist ./dist
COPY --from=builder --chown=ouro:ouro /app/node_modules ./node_modules
COPY --from=builder --chown=ouro:ouro /app/package*.json ./

# 创建数据目录
RUN mkdir -p /app/data && chown -R ouro:ouro /app/data

# 切换到非root用户
USER ouro

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# 环境变量
ENV NODE_ENV=production \
    OURO_MODE=web \
    OURO_PORT=8080 \
    OURO_HOST=0.0.0.0 \
    OURO_DATA_DIR=/app/data \
    OURO_LOG_LEVEL=info \
    OURO_HOMEOSTASIS=true \
    OURO_CPU_THRESHOLD=80 \
    OURO_MEMORY_THRESHOLD=85 \
    OURO_REFLECTION=true \
    OURO_REFLECTION_INTERVAL=30 \
    OURO_MAX_MEMORY=10000 \
    OURO_ENABLE_VECTORIZATION=false

# 启动命令
CMD ["node", "dist/agent.js", "web"]

# ============================================================================
# 开发阶段 (可选)
# ============================================================================
FROM node:20-alpine AS development

WORKDIR /app

# 安装开发工具
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl

# 复制包管理文件
COPY package*.json ./

# 安装所有依赖
RUN npm install

# 复制源代码
COPY . .

# 暴露端口
EXPOSE 8080

# 开发模式环境变量
ENV NODE_ENV=development \
    OURO_MODE=web \
    OURO_PORT=8080 \
    OURO_LOG_LEVEL=debug

# 开发模式启动 (支持热重载)
CMD ["npm", "run", "dev"]
