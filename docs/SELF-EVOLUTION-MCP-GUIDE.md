# 自我进化与MCP集成指南

## 1. 系统自我进化能力

### 当前状态：✅ 半自主模式

Ouroboros Agent 已具备**软自指**和**硬自指**双重进化能力：

```
┌─────────────────────────────────────────────────────────────┐
│                   自我进化循环                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   反思 Reflection ───────┐                                  │
│         │                │                                  │
│         ▼                │                                  │
│   生成修改建议           │                                  │
│         │                │                                  │
│         ▼                │                                  │
│   安全验证 (自动)        │                                  │
│         │                │                                  │
│         ▼                │                                  │
│   沙箱测试 (自动)        │                                  │
│         │                │                                  │
│         ▼                │                                  │
│   人工批准? ───否───┐    │                                  │
│         │          │    │                                  │
│        是          │    │                                  │
│         │          │    │                                  │
│         ▼          │    │                                  │
│   部署更新         │    │                                  │
│         │          │    │                                  │
│         └──────────┘    │                                  │
│                         │                                  │
│   性能反馈 ─────────────┘                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 开启完全自主进化

修改 `enhanced-unified-agent.ts` 配置：

```typescript
const agent = new EnhancedUnifiedAgent({
  // ... 其他配置
  
  hardSelfReference: {
    enabled: true,
    codeBasePath: './src',
    requireHumanApproval: false,  // ← 关闭人工批准
    autoDeploy: true,              // ← 开启自动部署
  },
});
```

**⚠️ 警告**：完全自主进化存在风险，建议：
1. 先在隔离环境测试
2. 确保有完整的备份
3. 配置自动回滚阈值

### 进化能力矩阵

| 进化类型 | 修改对象 | 自动化程度 | 安全机制 |
|----------|----------|------------|----------|
| **软自指** | 提示词 | 100%自动 | Token预算、模板约束 |
| **硬自指** | 源代码 | 半自动/全自动 | 静态分析、沙箱测试、人工审批 |
| **A/B测试** | 提示词变体 | 100%自动 | 性能对比、统计显著性 |
| **版本回滚** | 完整版本 | 100%自动 | 自动触发、一键恢复 |

---

## 2. MCP (Model Context Protocol) 集成

### 什么是 MCP？

MCP 是 Anthropic 推出的**开放协议**，允许 AI Agent 通过标准化接口连接外部工具和数据源。

**核心理念**：每个 MCP 服务器 = 一个工具集

### 支持的 MCP 服务器

| 服务器 | 功能 | 安装 |
|--------|------|------|
| `@modelcontextprotocol/server-filesystem` | 文件系统操作 | `npx -y @modelcontextprotocol/server-filesystem /path` |
| `@modelcontextprotocol/server-git` | Git 操作 | `npx -y @modelcontextprotocol/server-git` |
| `@modelcontextprotocol/server-sqlite` | SQLite 数据库 | `npx -y @modelcontextprotocol/server-sqlite /path.db` |
| `@modelcontextprotocol/server-puppeteer` | 浏览器自动化 | `npx -y @modelcontextprotocol/server-puppeteer` |
| `@modelcontextprotocol/server-github` | GitHub API | `npx -y @modelcontextprotocol/server-github` |

### 快速开始

#### 1. 安装 MCP 服务器

```bash
# 文件系统 MCP
npm install -g @modelcontextprotocol/server-filesystem

# Git MCP
npm install -g @modelcontextprotocol/server-git

# SQLite MCP
npm install -g @modelcontextprotocol/server-sqlite
```

#### 2. 配置 MCP 服务器

```typescript
import { MCPToolManager, MCPServerConfig } from './execution/mcp-tool-manager.js';

const mcpManager = new MCPToolManager('./data/mcp-servers.json');

// 配置 MCP 服务器
const config: MCPServerConfig = {
  name: 'filesystem',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/user'],
  enabled: true,
};

// 连接
await mcpManager.connectServer(config);
```

#### 3. 使用 MCP 工具

```typescript
// 获取所有可用工具
const tools = mcpManager.getAllTools();

// 调用工具
const result = await mcpManager.callTool('filesystem.read_file', {
  path: '/home/user/document.txt',
});

// 或使用完整名称
const result = await mcpManager.callTool('filesystem.list_directory', {
  path: '/home/user',
});
```

### MCP 工具命名规范

```
{serverName}.{toolName}

示例：
- filesystem.read_file
- filesystem.write_file
- filesystem.list_directory
- git.status
- git.log
- sqlite.query
- puppeteer.navigate
```

### 与 Agent 集成

```typescript
import { EnhancedUnifiedAgent } from './enhanced-unified-agent.js';
import { MCPToolManager } from './execution/mcp-tool-manager.js';

// 创建 Agent
const agent = new EnhancedUnifiedAgent({
  // ... 配置
});

// 创建 MCP 管理器
const mcpManager = new MCPToolManager();

// 连接所有配置的 MCP 服务器
const configs = await mcpManager.loadConfig();
for (const config of configs) {
  if (config.enabled) {
    await mcpManager.connectServer(config);
  }
}

// 将 MCP 工具注册到 Agent
const mcpTools = mcpManager.getAllTools();
for (const tool of mcpTools) {
  agent.registerTool(tool.name, tool.execute, tool.parameters);
}

// 现在 Agent 可以在自我进化过程中使用 MCP 工具
// 例如：使用 filesystem 工具读取/写入文件
// 使用 git 工具进行版本控制
```

---

## 3. 自我进化 + MCP 协同场景

### 场景1：自动代码改进

```typescript
// Agent 使用 filesystem MCP 读取自身代码
const code = await mcpManager.callTool('filesystem.read_file', {
  path: './src/cognitive/soft-self-reference.ts',
});

// 反思发现可以优化
const reflection = await agent.reflect({
  topic: '代码优化',
  data: code,
});

// 生成修改建议
const modification = await agent.proposeModification(reflection);

// 使用 filesystem MCP 写入修改后的代码
await mcpManager.callTool('filesystem.write_file', {
  path: './src/cognitive/soft-self-reference.ts',
  content: modification.code,
});

// 使用 git MCP 提交更改
await mcpManager.callTool('git.commit', {
  message: 'Auto-optimization based on reflection',
});
```

### 场景2：基于 SQLite 的记忆增强

```typescript
// 使用 sqlite MCP 存储结构化记忆
await mcpManager.callTool('sqlite.execute', {
  sql: `INSERT INTO memories (type, content, timestamp) VALUES (?, ?, ?)`,
  params: ['insight', '发现新的优化机会', Date.now()],
});

// 查询相关记忆
const memories = await mcpManager.callTool('sqlite.query', {
  sql: `SELECT * FROM memories WHERE type = 'insight' ORDER BY timestamp DESC LIMIT 10`,
});

// 基于记忆进行反思
await agent.reflect({ memories });
```

---

## 4. 配置文件示例

### `mcp-servers.json`

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/workspace"],
      "enabled": true
    },
    "git": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-git"],
      "enabled": true
    },
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite", "/home/user/data.db"],
      "enabled": true
    },
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"],
      "enabled": false
    }
  }
}
```

---

## 5. 系统总览

```
┌─────────────────────────────────────────────────────────────────┐
│                    Ouroboros Self-Evolving Agent                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Self-Evolution System                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │ Soft Self   │  │ Hard Self   │  │ A/B Testing │     │   │
│  │  │ Reference   │  │ Reference   │  │             │     │   │
│  │  │ (Prompts)   │  │ (Code)      │  │ (Variants)  │     │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │   │
│  │         └─────────────────┼─────────────────┘           │   │
│  │                           │                             │   │
│  │                  ┌────────┴────────┐                    │   │
│  │                  │ Version Control │                    │   │
│  │                  │ (Rollback)      │                    │   │
│  │                  └─────────────────┘                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              MCP Tool Integration                        │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ Filesystem│ │   Git    │ │  SQLite  │ │Puppeteer │   │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │   │
│  │       └─────────────┴─────────────┴─────────────┘        │   │
│  │                     │                                     │   │
│  │              ┌──────┴──────┐                            │   │
│  │              │ MCP Manager │                            │   │
│  │              └─────────────┘                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Safety & Security                          │   │
│  │  • Static Analysis  • Sandbox Testing  • Auto-Rollback │   │
│  │  • Dual Mind        • Gödel Immunity   • Human Approval│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. 启动脚本

创建启动脚本 `start-with-mcp.sh`：

```bash
#!/bin/bash

# 安装 MCP 服务器（如果尚未安装）
npm list -g @modelcontextprotocol/server-filesystem >/dev/null 2>&1 || \
  npm install -g @modelcontextprotocol/server-filesystem

npm list -g @modelcontextprotocol/server-git >/dev/null 2>&1 || \
  npm install -g @modelcontextprotocol/server-git

npm list -g @modelcontextprotocol/server-sqlite >/dev/null 2>&1 || \
  npm install -g @modelcontextprotocol/server-sqlite

# 启动 Agent
npm run start:with-mcp
```

---

**完成状态**:
- ✅ 软自指系统 (Phase 1)
- ✅ 硬自指系统 (Phase 2)
- ✅ MCP 工具集成
- ✅ A/B 测试
- ✅ 版本回滚
- ✅ 安全机制

系统已具备**自我进化**和**MCP工具扩展**的完整能力！
