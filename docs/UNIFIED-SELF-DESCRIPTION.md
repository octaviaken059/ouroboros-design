# 统一自我描述系统架构

## 核心思想

**所有关于"我是谁"的信息都存储在统一自我描述中**

```
传统架构                    统一自我描述架构
┌──────────────┐           ┌─────────────────────────────────────────────┐
│ 身体图式     │           │              统一自我描述                    │
│ BodySchema   │           │  ┌─────────────────────────────────────────┐ │
└──────┬───────┘           │  │  1. Identity (身份认知)                  │ │
       │                   │  │     - name, version, evolutionStage     │ │
       ▼                   │  │     - 原自我认知                          │ │
┌──────────────┐           │  ├─────────────────────────────────────────┤ │
│ 自我认知     │───────────│  │  2. Body (身体图式)                      │ │
│ SelfIdentity │           │  │     - sensors, actuators, resources     │ │
└──────┬───────┘           │  │     - 原身体图式                          │ │
       │                   │  ├─────────────────────────────────────────┤ │
       ▼                   │  │  3. WorldModel (世界模型)                │ │
┌──────────────┐           │  │     - patterns, risks, capabilities     │ │
│ 世界模型     │───────────│  │     - 原世界模型                          │ │
│ WorldModel   │           │  ├─────────────────────────────────────────┤ │
└──────┬───────┘           │  │  4. ToolSet (工具集)                     │ │
       │                   │  │     - builtIn, mcpServers               │ │
       ▼                   │  │     - 原工具集+MCP                        │ │
┌──────────────┐           │  ├─────────────────────────────────────────┤ │
│ 工具集       │───────────│  │  5. CognitiveState (认知状态)            │ │
│ ToolSet      │           │  │     - hormoneLevels, mode, goals        │ │
└──────────────┘           │  │     - 原激素系统+调度器状态               │ │
                           │  └─────────────────────────────────────────┘ │
                           └─────────────────────────────────────────────┘
```

## 反思：自我描述的唯一更新入口

```
┌───────────────────────────────────────────────────────────────────────┐
│                         反思 (Reflection)                             │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   输入                                                                  │
│   ├── 最近记忆 (recentMemories)                                        │
│   ├── 性能指标 (performanceMetrics)                                    │
│   ├── 系统事件 (systemEvents)                                          │
│   └── 触发原因 (trigger: scheduled/performance_drop/anomaly)           │
│                                                                       │
│   处理流程                                                              │
│   ├── 1. 分析性能模式 → 发现能力规律 → 更新 WorldModel.patterns        │
│   ├── 2. 扫描记忆文本 → 发现工具名称 → 添加到 ToolSet.recentlyDiscovered│
│   ├── 3. 检测系统事件 → 发现新硬件 → 添加到 Body.sensors/actuators     │
│   └── 4. 识别限制 → 发现弱点 → 更新 WorldModel.capabilities.weaknesses │
│                                                                       │
│   输出: ReflectionResult                                               │
│   ├── insights[]: 发现的问题/机会                                       │
│   └── proposedChanges[]: 具体的自我描述变更建议                          │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    applyReflectionChanges()                           │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   审批模式 (approval)                                                  │
│   ├── 'auto': 自动应用所有变更                                         │
│   ├── 'conservative': 只应用高置信度(>0.8)的非关键变更                  │
│   └── 'human': 等待人工批准                                            │
│                                                                       │
│   变更记录: SelfDescriptionChange                                      │
│   ├── timestamp, reflectionId                                          │
│   ├── changes[]: path, oldValue, newValue, reason                      │
│   └── applied: boolean                                                 │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

## 子系统融合细节

### 1. 激素系统 → CognitiveState

```typescript
// 激素系统更新时
hormoneSystem.on('changed', (levels) => {
  selfDesc.updateCognitiveState({
    hormoneLevels: levels,
  });
});

// 生成的自我提示词包含
const prompt = selfDesc.generateSelfPrompt();
// 输出:
// ### Cognitive State
// - Hormones: { adrenaline: 0.1, cortisol: 0.2, dopamine: 0.8, ... }
// - Mode: serving
```

### 2. 贝叶斯认知 → ToolSet

```typescript
// 工具使用后更新置信度
bayesian.updateConfidence('web_search', true);

// 同步到自我描述
selfDesc.updateToolConfidence('web_search', 0.92, 0.95);

// 生成的自我提示词包含
// ### Tool Set
// - Built-in: web_search(0.92), file_read(0.88), ...
```

### 3. 身体图式 → Body

```typescript
// 资源监控更新
bodySchema.on('resourceChanged', (resources) => {
  selfDesc.updateBodySchema({ resources });
});

// 新传感器检测
selfDesc.addSensor({
  name: 'canvas_display',
  type: 'visualization',
  status: 'active',
});

// 生成的自我提示词包含
// ### Body
// - Sensors: canvas_display, file_system, ...
// - Resources: { memory: {...}, storage: {...} }
```

### 4. 世界模型 → WorldModel

```typescript
// 反思发现新模式
selfDesc.addWorldPattern('Users prefer visual explanations');

// 反思识别风险
selfDesc.updateWorldModel({
  dynamics: {
    risks: ['API rate limit approaching', 'Storage capacity 80%'],
  },
});

// 生成的自我提示词包含
// ### World Model
// - Patterns: Users prefer visual explanations, ...
// - Risks: API rate limit approaching, ...
```

### 5. 反思能力 → 驱动所有更新

```typescript
// 定期反思
async function scheduledReflection() {
  const result = await selfDesc.reflect({
    recentMemories: memory.getRecent(100),
    performanceMetrics: metrics.getLast(50),
    systemEvents: eventLog.getRecent(),
    trigger: 'scheduled',
  });

  // 应用变更
  await selfDesc.applyReflectionChanges(result, 'conservative');
}

// 事件触发反思
eventBus.on('performanceDrop', async (metrics) => {
  const result = await selfDesc.reflect({
    performanceMetrics: [metrics],
    trigger: 'performance_drop',
  });
  
  // 可能产生:
  // - insight: { category: 'tool', type: 'limitation', ... }
  // - proposedChange: { target: 'toolSet', path: 'recentlyDiscovered', ... }
});
```

## 数据流示例

### 场景：发现新MCP工具

```
1. 用户消息: "你能帮我操作浏览器吗？"
   ↓
2. Agent回复: "我需要检查是否有浏览器工具"
   ↓
3. 系统扫描: 发现 @modelcontextprotocol/server-puppeteer 可用
   ↓
4. 触发反思 (trigger: 'tool_discovery')
   ├─ 输入: { systemEvents: [{ type: 'mcp_available', name: 'puppeteer' }] }
   ├─ 处理: detectNewTools() 发现 puppeteer MCP
   └─ 输出: {
        insights: [{
          category: 'tool',
          type: 'discovery',
          description: 'Puppeteer MCP available for browser automation',
          suggestedAction: 'Add to toolSet.mcpServers'
        }],
        proposedChanges: [{
          target: 'toolSet',
          path: 'mcpServers',
          operation: 'add',
          value: { name: 'puppeteer', tools: ['navigate', 'click', 'screenshot'] }
        }]
      }
   ↓
5. 应用变更
   selfDesc.applyReflectionChanges(result, 'conservative')
   ├─ 添加 MCP 服务器到 toolSet.mcpServers
   ├─ 记录变更历史
   └─ 触发事件: 'mcpServerAdded'
   ↓
6. 后续调用
   user: "打开谷歌搜索AI"
   agent: 调用 mcpManager.callTool('puppeteer.navigate', { url: '...' })
```

### 场景：发现性能瓶颈

```
1. 监控告警: 内存使用 > 80%
   ↓
2. 激素系统: cortisol += 0.3 (stress)
   ↓
3. 触发反思 (trigger: 'anomaly_detected')
   ├─ 输入: { systemEvents: [{ type: 'resource_alert', resource: 'memory', level: 0.82 }] }
   ├─ 处理: analyzePerformancePatterns() 发现内存泄漏模式
   └─ 输出: {
        insights: [{
          category: 'capability',
          type: 'limitation',
          description: 'Memory leaks in long-running sessions',
          suggestedAction: 'Add memory management pattern to worldModel'
        }],
        proposedChanges: [{
          target: 'worldModel',
          path: 'capabilities.weaknesses',
          operation: 'add',
          value: 'Memory management in long sessions'
        }]
      }
   ↓
4. 应用变更
   ├─ 更新 WorldModel.capabilities.weaknesses
   ├─ 在自我提示词中体现
   └─ 后续LLM调用会看到:
      "Weaknesses: Memory management in long sessions"
      并可能建议重启或优化
```

## 配置文件示例

```json
{
  "identity": {
    "name": "Ouroboros",
    "version": "2.1.0",
    "description": "Self-evolving AI Agent",
    "evolutionStage": 5
  },
  "body": {
    "sensors": [
      { "name": "file_system", "type": "data_source", "status": "active" },
      { "name": "web_api", "type": "data_source", "status": "active" },
      { "name": "canvas_display", "type": "visualization", "status": "active" }
    ],
    "actuators": [
      { "name": "console_output", "type": "display", "capabilities": ["text"] },
      { "name": "file_writer", "type": "storage", "capabilities": ["write", "delete"] }
    ]
  },
  "worldModel": {
    "dynamics": {
      "patterns": [
        "Users prefer visual content when explaining complex topics",
        "File operations most common task type",
        "API failures correlate with high load times"
      ],
      "risks": [
        "API rate limits",
        "Storage capacity 85%"
      ]
    },
    "capabilities": {
      "strengths": ["Fast text processing", "Reliable web search"],
      "weaknesses": ["Limited visual generation", "No audio processing"]
    }
  },
  "toolSet": {
    "builtIn": [
      { "name": "web_search", "confidence": 0.92, "successRate": 0.95 },
      { "name": "file_read", "confidence": 0.98, "successRate": 0.99 }
    ],
    "mcpServers": [
      { "name": "filesystem", "tools": ["read", "write"], "status": "connected" },
      { "name": "puppeteer", "tools": ["navigate", "click"], "status": "connected" }
    ]
  }
}
```

## 优势总结

| 方面 | 传统分散架构 | 统一自我描述架构 |
|------|-------------|-----------------|
| **一致性** | 各子系统独立，容易不一致 | 单一数据源，保证一致 |
| **可观测性** | 需要查询多个系统 | 一个 `generateSelfPrompt()` 查看完整状态 |
| **可进化性** | 难以协调各系统更新 | 反思统一驱动所有更新 |
| **可扩展性** | 新增子系统需要新接口 | 新增内容只需扩展 SelfDescription 类型 |
| **持久化** | 多个文件分别保存 | 单一 JSON 文件，包含变更历史 |
| **LLM提示** | 需要组装多个来源 | 统一生成，格式一致 |

## 实现文件

| 文件 | 说明 |
|------|------|
| `unified-self-description.ts` | 核心实现 (17KB) |
| `unified-self-description-examples.ts` | 使用示例 (9KB) |
