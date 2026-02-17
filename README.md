# Ouroboros Design

> 具身自指进化AI Agent - 按DESIGN文档严格实现的生产级版本
> 
> 🐍⭕ *Ouroboros (衔尾蛇): 自我指涉的终极象征 — 无限循环、自我创生、永恒回归*

## ✨ 核心特性

### 🫀 具身性 (Embodiment)
- **身体图式感知**: 通过 `/proc/self` 实时监控系统状态
- **资源监控**: CPU、内存、磁盘使用追踪
- **进程身份**: PID、灵魂签名、变更检测

### 🔄 自指性 (Self-Reference)
- **元认知能力**: 反思和监控自身认知过程
- **贝叶斯认知**: 能力置信度动态更新
- **自我模型**: 持续更新的能力评估

### ⚖️ 稳态保护 (Homeostasis)
- **自动资源管理**: CPU/内存阈值监控
- **智能降载**: 四级降载策略（轻/中/重/紧急）
- **激素调节**: 5种激素影响行为模式

### 🧠 分层记忆 (Layered Memory)
- **5层架构**: 工作/情景/语义/程序/反思记忆
- **混合搜索**: 向量相似度 + 关键词匹配
- **智能遗忘**: 艾宾浩斯遗忘曲线 + 睡眠巩固

### 🛡️ 安全架构 (4层防御)
1. **身份锚定**: 进程签名验证
2. **技术不朽**: 硬件看门狗监控
3. **对抗免疫**: 双思维验证
4. **神圣核心**: 不可变核心保护
5. **Gödel免疫**: 8种自指攻击检测

---

## 📦 安装

### 环境要求
- Node.js >= 18.0.0
- SQLite3
- (可选) Ollama - 本地模型支持
- (可选) OpenAI API Key - 云端模型支持

### 安装步骤

```bash
# 克隆项目
git clone <repository-url>
cd ouroboros-design

# 安装依赖
npm install

# 编译TypeScript
npm run build

# 初始化数据库
npm run db:migrate

# 启动服务
npm start
```

---

## 🚀 快速开始

### 1. CLI 模式

```bash
# 查看系统状态
npm start -- cli status

# 获取身体图式信息
npm start -- cli body

# 查看激素水平
npm start -- cli hormones

# 触发反思
npm start -- cli reflect
```

### 2. Web 模式

```bash
# 启动Web服务 (默认端口8080)
npm start -- web

# 指定端口
npm start -- web --port 3000

# 访问
open http://localhost:8080
```

### 3. 监控面板

```bash
# 启动监控服务器
npx ts-node src/adapters/monitor-example.ts

# 或编程方式启动
import { MonitorServer } from './src/adapters/monitor-server.js';

const monitor = new MonitorServer(agent, 3000);
monitor.start();
```

**监控面板功能:**
- 📊 实时系统状态（运行时间、任务数、成功率）
- 🧪 激素水平可视化（肾上腺素、多巴胺、皮质醇等）
- 🛠️ 工具/技能状态（置信度、可用性）
- 🌍 世界模型（识别模式、风险评估）
- 📈 性能趋势图表
- 📜 实时日志流

**Web API 端点:**
- `GET /api/health` - 健康检查
- `GET /api/status` - 完整系统状态
- `GET /api/hormones` - 激素水平
- `GET /api/tools` - 工具列表
- `GET /api/skills` - 技能列表
- `GET /api/resources` - 资源使用
- `GET /api/logs` - 最近日志
- `POST /api/reflect` - 触发反思
- `GET /api/status` - 系统状态
- `GET /api/body` - 身体图式
- `GET /api/hormones` - 激素水平
- `GET /api/memory` - 记忆统计
- `POST /api/chat` - 对话接口

### 3. TUI 模式

```bash
# 启动交互式终端界面
npm start -- tui
```

### 4. Docker 部署

```bash
# 构建镜像
docker build -t ouroboros-design .

# 运行
docker run -p 8080:8080 \
  -v $(pwd)/data:/app/data \
  -e MODEL_PROVIDER=ollama \
  ouroboros-design

# 或使用 docker-compose
docker-compose up -d
```

---

## ⚙️ 配置

### 环境变量

复制 `.env.example` 为 `.env` 并修改:

```bash
# 基础配置
NODE_ENV=production
PORT=8080
LOG_LEVEL=info

# 模型配置
MODEL_PROVIDER=ollama
MODEL_NAME=llama2
MODEL_API_URL=http://localhost:11434

# 嵌入配置
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text

# 数据库
DATABASE_PATH=./data/ouroboros.db

# 安全
ENABLE_SAFETY_CHECK=true
```

### 配置文件

配置文件位于 `config/default.json`:

```json
{
  "memory": {
    "workingCapacity": 7,
    "maxMemoryCount": 10000,
    "similarityThreshold": 0.7
  },
  "hormones": {
    "decayRate": 0.01,
    "adrenalineThreshold": 0.7
  },
  "scheduler": {
    "maxConcurrent": 3,
    "defaultTimeout": 30000
  }
}
```

---

## 🧪 测试

### 运行所有测试

```bash
# 运行单元测试
npm test

# 运行集成测试
npm run test:integration

# 运行端到端测试
npm run test:e2e

# 查看覆盖率
npm run test:coverage
```

### 测试结构

```
tests/
├── unit/                    # 单元测试
│   ├── cognitive/           # 认知层测试
│   ├── embodiment/          # 身体层测试
│   ├── decision/            # 决策层测试
│   ├── safety/              # 安全层测试
│   └── utils/               # 工具函数测试
├── integration/             # 集成测试
│   ├── memory-integration.test.ts
│   ├── scheduler-integration.test.ts
│   └── unified-agent-integration.test.ts
└── e2e/                     # 端到端测试
    └── end-to-end.test.ts
```

---

## 📚 核心概念

### 5层记忆架构

```typescript
// 工作记忆 (7±2 chunks, 秒级)
const working = memory.createWorking({
  content: "当前对话上下文",
  importance: 0.8
});

// 情景记忆 (事件记录, 天级)
const episodic = memory.createEpisodic({
  content: "用户完成了任务",
  context: "项目管理会话",
  outcome: "success"
});

// 语义记忆 (知识抽象, 永久)
const semantic = memory.createSemantic({
  content: "Node.js 是单线程的",
  category: "编程知识",
  confidence: 0.95
});

// 程序记忆 (技能掌握, 永久)
const procedural = memory.createProcedural({
  content: "如何重启服务",
  skillName: "system_restart",
  successRate: 0.9
});

// 反思记忆 (元认知洞察, 永久)
const reflective = memory.createReflective({
  insight: "用户在晚上更喜欢简短回复",
  impact: 0.8
});
```

### 激素系统

```typescript
// 5种激素影响行为
hormoneSystem.adjust('adrenaline', 0.2, '遇到紧急任务');
hormoneSystem.adjust('dopamine', 0.15, '任务成功');
hormoneSystem.adjust('curiosity', 0.1, '空闲状态');

// 获取行为建议
const advice = hormoneSystem.getBehavioralAdvice();
// ["⚠️ 高肾上腺素状态：适合处理紧急任务"]
```

### 贝叶斯认知

```typescript
// 更新能力置信度
bayesian.update('code_review', true);
bayesian.update('code_review', false); // 失败后自动降低置信度

// 预测表现
const prediction = bayesian.predict('code_review');
console.log(prediction.confidence); // 0.75
console.log(prediction.recommendation); // "可以尝试"
```

### 安全架构

```typescript
// 完整安全检查
const check = safetyEngine.fullCheck(userInput);
if (!check.safe) {
  console.log(check.issues);
  // ["安全威胁: prompt_injection - 拒绝执行"]
}

// 双思维验证
const result = await dualMindVerifier.verify(
  () => generatePlan(),
  (plan) => auditPlan(plan)
);
```

---

## 🔧 开发指南

### 项目结构

```
src/
├── adapters/          # 接口层 - Web/TUI/WebSocket
├── cognitive/         # 认知层 - 记忆/贝叶斯/反射
├── config/            # 配置管理
├── db/                # 数据库层 - SQLite/迁移
├── decision/          # 决策层 - 调度器
├── embodiment/        # 身体层 - 身体图式/激素/稳态
├── execution/         # 执行层 - 模型引擎/工具
├── pages/             # 前端页面
├── safety/            # 安全层 - 4层防御
├── unified-agent/     # 核心协调器
└── utils/             # 工具函数
tests/
├── unit/              # 单元测试
├── integration/       # 集成测试
└── e2e/               # 端到端测试
```

### 添加新工具

```typescript
// src/execution/tools/my-tool.ts
export const myTool: ToolSkill = {
  name: 'my_tool',
  description: '我的自定义工具',
  parameters: {
    input: { type: 'string', required: true }
  },
  execute: async (args) => {
    return { result: `处理: ${args.input}` };
  }
};

// 自动注册，无需额外配置
```

### 添加新适配器

```typescript
// src/adapters/my-adapter.ts
export class MyAdapter implements IAdapter {
  async start(): Promise<void> {
    // 初始化你的接口
  }
  
  async handleCommand(cmd: string, args: string[]): Promise<unknown> {
    return agent.handleCommand(cmd, args);
  }
}
```

---

## 📖 API 文档

### REST API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/status` | 系统状态 |
| GET | `/api/body` | 身体图式 |
| GET | `/api/hormones` | 激素水平 |
| GET | `/api/memory` | 记忆统计 |
| POST | `/api/memory/query` | 查询记忆 |
| POST | `/api/chat` | 对话接口 |
| POST | `/api/reflect` | 触发反思 |

### WebSocket 事件

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'token':
      console.log(data.content); // 流式token
      break;
    case 'thinking':
      console.log(data.content); // 思考过程
      break;
    case 'complete':
      console.log(data.content); // 完整回复
      break;
  }
};
```

---

## 🐛 故障排除

### 常见问题

**Q: 启动时报错 "Cannot find module"**
```bash
# 重新编译
npm run build
```

**Q: 数据库连接失败**
```bash
# 检查目录权限
mkdir -p data
chmod 755 data

# 重新初始化
npm run db:migrate
```

**Q: Ollama 连接失败**
```bash
# 检查 Ollama 是否运行
curl http://localhost:11434/api/tags

# 或者切换到 OpenAI
export MODEL_PROVIDER=openai
export MODEL_API_KEY=your-key
```

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

---

## 🙏 致谢

- 严格按照 [DESIGN.md](./DESIGN.md) 文档实现
- 灵感来自认知科学、生物学和哲学中的自我指涉概念
- 感谢所有贡献者和测试者

---

**文档版本**: 1.0.0  
**最后更新**: 2026-02-16
