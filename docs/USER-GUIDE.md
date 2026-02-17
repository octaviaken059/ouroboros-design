# Ouroboros Design - 用户使用指南

> 自我进化型 AI Agent 使用手册

---

## 快速开始

### 1. 安装

```bash
# 克隆仓库
git clone https://github.com/octaviaken059/ouroboros-design.git
cd ouroboros-design

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，添加你的 API 密钥
```

### 2. 配置文件

创建 `config/agent.json`：

```json
{
  "identity": {
    "name": "MyOuroboros",
    "version": "1.0.0"
  },
  "selfEvolution": {
    "enabled": true,
    "mode": "semi_autonomous",
    "softSelfReference": {
      "enabled": true,
      "maxContextWindow": 8192
    },
    "hardSelfReference": {
      "enabled": false,
      "requireHumanApproval": true
    }
  },
  "safety": {
    "enableGodelImmunity": true,
    "enableDualMind": true
  }
}
```

### 3. 启动

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start

# Docker 部署
docker-compose up -d
```

---

## 基本使用

### 方式一：直接运行示例

```bash
# 运行软自指示例
npx ts-node src/cognitive/soft-self-reference-examples.ts

# 运行硬自指示例
npx ts-node src/cognitive/hard-self-reference-examples.ts

# 运行工具技能管理示例
npx ts-node src/execution/tool-skill-examples.ts
```

### 方式二：编程使用

```typescript
import { EnhancedUnifiedAgent } from './src/enhanced-unified-agent';

// 创建 Agent
const agent = new EnhancedUnifiedAgent({
  identity: { name: 'MyAgent', version: '1.0.0' },
  scheduler: { homeostasisEnable: true },
  memory: { maxMemoryCount: 10000 },
  safety: { enableDualMind: true },
  softSelfReference: {
    enabled: true,
    dataDir: './data/self-ref',
    maxContextWindow: 8192,
    systemSafetyRules: ['Never execute untrusted code'],
    forbiddenActions: ['Delete system files']
  },
  abTesting: { enabled: true },
  versionControl: { enabled: true }
});

// 初始化并启动
await agent.initialize();
await agent.start();

// 处理用户消息
const response = await agent.processMessage('帮我分析这个CSV文件');
console.log(response);
```

### 方式三：Web 界面

```bash
# 启动 Web 服务
npm run web

# 访问 http://localhost:3000
```

---

## 核心功能使用

### 1. 按需加载能力

```typescript
// 根据任务加载相关工具和技能
const result = agent.loadCapabilities({
  context: '分析销售数据',
  intent: 'data analysis',
  topic: 'data',
  maxTools: 5,
  maxSkills: 3
});

console.log('加载的工具:', result.tools.map(t => t.name));
console.log('加载的技能:', result.skills.map(s => s.name));
```

### 2. 注册新工具

```typescript
// 注册系统工具
agent.getToolSkillManager().registerTool({
  name: 'my_custom_tool',
  displayName: 'My Custom Tool',
  description: '执行特定任务',
  type: ToolType.CLI,
  category: 'custom',
  capabilities: ['task1', 'task2'],
  loadPriority: 'on_demand',
  autoLoad: false
});
```

### 3. 注册新技能

```typescript
// 注册技能
agent.getToolSkillManager().registerSkill({
  name: 'data_cleaning',
  displayName: '数据清洗',
  description: '清洗和预处理数据',
  type: SkillType.DATA_ANALYSIS,
  category: 'data',
  level: 'intermediate',
  experience: 3000,
  requires: {
    tools: ['tool.data.pandas']
  },
  implementation: {
    type: 'workflow',
    workflow: ['检查缺失值', '处理异常值', '标准化数据']
  }
});
```

### 4. 执行反思

```typescript
// 手动触发反思
const reflection = await agent.reflect({
  recentMemories: [...],
  performanceMetrics: [...],
  systemEvents: [...],
  trigger: 'scheduled'
});

console.log('发现的洞察:', reflection.insights);
```

### 5. MCP 工具集成

```typescript
import { MCPToolManager } from './src/execution/mcp-tool-manager';

const mcpManager = new MCPToolManager();

// 连接 MCP 服务器
await mcpManager.connectServer({
  name: 'filesystem',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
  enabled: true
});

// 调用 MCP 工具
const result = await mcpManager.callTool('filesystem.read_file', {
  path: '/workspace/data.txt'
});
```

---

## 配置 MCP 服务器

编辑 `config/mcp-servers.json`：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"],
      "enabled": true
    },
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"],
      "enabled": true
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      },
      "enabled": true
    }
  }
}
```

---

## 最佳实践

### 1. 工具发现

定期运行工具发现，自动扫描系统中新安装的工具：

```typescript
// 自动发现系统工具
const discoveredTools = await agent.getToolSkillManager().discoverTools();
console.log(`发现了 ${discoveredTools.length} 个新工具`);
```

### 2. 性能监控

```typescript
// 记录工具使用
agent.getToolSkillManager().recordToolUsage(
  'tool.data.pandas',
  true,  // 成功
  1200   // 执行时间(ms)
);

// 记录技能应用
agent.getToolSkillManager().recordSkillApplication(
  'skill.data.data_cleaning',
  true,  // 成功
  5      // 复杂度(1-10)
);
```

### 3. 自我描述生成

```typescript
// 生成完整的自我描述
const selfDesc = agent.generateSelfDescription();
console.log(selfDesc);

// 生成精简版
const brief = agent.generateBriefSelfDescription();
// 输出: "I am MyAgent v1.0.0 (Stage 2). Mode: serving..."
```

### 4. 安全使用硬自指

```typescript
// 配置硬自指（谨慎使用）
const agent = new EnhancedUnifiedAgent({
  hardSelfReference: {
    enabled: true,
    requireHumanApproval: true,  // 必须人工批准
    autoDeploy: false            // 不自动部署
  }
});

// 查看修改建议
agent.on('hardSelfModificationConsidered', (info) => {
  console.log('建议修改:', info.suggestion);
  // 人工审核后再决定是否应用
});
```

---

## 命令行工具

### 可用的 CLI 命令

```bash
# 查看状态
npm run status

# 执行自我检查
npm run self-check

# 运行测试
npm test

# 运行特定测试
npm test -- cognitive

# 构建项目
npm run build

# 清理数据
npm run clean
```

---

## 常见问题

### Q: 如何添加自定义工具？

A: 使用 `registerTool()` 方法注册，指定工具类型、能力和加载优先级。

### Q: 如何查看 Agent 的当前状态？

A: 调用 `agent.getStatus()` 获取完整状态，或 `agent.generateBriefSelfDescription()` 获取精简版。

### Q: 如何启用完全自主进化？

A: 修改配置将 `hardSelfReference.requireHumanApproval` 设为 `false`，**但请谨慎使用**。

### Q: 如何集成新的 MCP 服务器？

A: 在 `config/mcp-servers.json` 中添加配置，Agent 会自动连接并发现工具。

### Q: 如何调试问题？

A: 查看日志文件 `logs/agent.log`，或启用调试模式 `DEBUG=ouroboros:* npm start`。

---

## 下一步

- 查看 [SYSTEM-DESIGN.md](./docs/SYSTEM-DESIGN.md) 了解完整架构
- 查看 [TOOL-SKILL-ARCHITECTURE.md](./docs/TOOL-SKILL-ARCHITECTURE.md) 了解工具技能设计
- 运行示例代码学习使用方法
- 加入社区讨论新功能和改进

---

*版本: 2.0.0*  
*最后更新: 2026-02-17*
