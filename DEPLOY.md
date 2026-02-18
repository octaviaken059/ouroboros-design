# Ouroboros Vercel Deployment Guide

## 部署步骤

### 1. 推送到 GitHub
```bash
git push origin deploy/vercel
```

### 2. 在 Vercel 导入项目
1. 登录 https://vercel.com
2. 点击 "Add New Project"
3. 导入 GitHub 仓库
4. 选择 `deploy/vercel` 分支

### 3. 配置环境变量
在 Vercel 项目设置中添加：
- `OLLAMA_BASE_URL`: 你的 Ollama 代理地址
- `OPENAI_MODEL`: `deepseek-r1:8b`

### 4. 部署
Vercel 会自动构建和部署。

## 注意

Vercel Serverless 有 10秒超时限制，适合简单 API 但不适合长时间流式响应。

建议使用 Railway 或 Render 部署完整的 Node.js 应用：
- https://railway.app
- https://render.com
