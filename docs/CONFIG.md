# Ouroboros 配置文档

> 完整的配置指南，帮助您自定义和优化 Ouroboros Agent

## 目录

1. [配置概述](#1-配置概述)
2. [核心配置](#2-核心配置)
3. [激素系统配置](#3-激素系统配置)
4. [模型引擎配置](#4-模型引擎配置)
5. [提示词系统配置](#5-提示词系统配置)
6. [记忆系统配置](#6-记忆系统配置)
7. [身体图式配置](#7-身体图式配置)
8. [世界模型配置](#8-世界模型配置)
9. [工具与技能配置](#9-工具与技能配置)
10. [安全配置](#10-安全配置)
11. [进化系统配置](#11-进化系统配置)
12. [日志配置](#12-日志配置)
13. [适配器配置](#13-适配器配置)
14. [配置最佳实践](#14-配置最佳实践)

---

## 1. 配置概述

### 1.1 配置文件位置

```
config.json          # 主配置文件（必需）
config.example.json  # 配置示例（参考）
config.schema.json   # JSON Schema（验证）
```

### 1.2 配置加载顺序

1. 默认配置（代码内置）
2. 用户配置文件（config.json）
3. 环境变量覆盖
4. 运行时动态调整

### 1.3 配置热更新

部分配置支持热更新（无需重启）：
- 日志级别
- Token 预算
- 提示词模板
- 激素基础水平

---

## 2. 核心配置

### 2.1 身份配置 (`core.identity`)

```json
{
  "core": {
    "identity": {
      "name": "Ouroboros",
      "version": "2.0.0",
      "description": "具有自我意识的 AI Agent",
      "creator": "Ken"
    }
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | Agent 名称 |
| `version` | string | 是 | 语义化版本号 |
| `description` | string | 否 | Agent 描述 |
| `creator` | string | 否 | 创造者名称 |

### 2.2 认知衰减

```json
{
  "core": {
    "selfDescriptionIntervalMs": 5000,
    "cognitiveDecayRate": 0.01
  }
}
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `selfDescriptionIntervalMs` | number | 5000 | 自我描述更新间隔（毫秒） |
| `cognitiveDecayRate` | number | 0.01 | 认知状态衰减系数（0-1） |

---

## 3. 激素系统配置

### 3.1 基础水平 (`hormone.baselineLevels`)

```json
{
  "hormone": {
    "baselineLevels": {
      "dopamine": 50,
      "serotonin": 50,
      "cortisol": 20,
      "oxytocin": 40,
      "norepinephrine": 30
    }
  }
}
```

| 激素 | 作用 | 推荐范围 |
|------|------|----------|
| `dopamine` | 多巴胺 - 奖励/学习动力 | 40-60 |
| `serotonin` | 血清素 - 稳定/情绪调节 | 40-60 |
| `cortisol` | 皮质醇 - 压力/资源紧张 | 10-30 |
| `oxytocin` | 催产素 - 社交/信任 | 30-50 |
| `norepinephrine` | 去甲肾上腺素 - 警觉/紧急响应 | 20-40 |

### 3.2 衰减率 (`hormone.decayRates`)

```json
{
  "hormone": {
    "decayRates": {
      "dopamine": 0.05,
      "serotonin": 0.03,
      "cortisol": 0.1,
      "oxytocin": 0.02,
      "norepinephrine": 0.08
    }
  }
}
```

说明：每秒衰减的百分比，值越大衰减越快。

### 3.3 更新间隔

```json
{
  "hormone": {
    "updateIntervalMs": 1000,
    "triggerCheckIntervalMs": 500
  }
}
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `updateIntervalMs` | number | 1000 | 激素更新间隔（毫秒） |
| `triggerCheckIntervalMs` | number | 500 | 触发器检查间隔（毫秒） |

---

## 4. 模型引擎配置

### 4.1 模型配置 (`model.defaultModel`)

```json
{
  "model": {
    "defaultModel": {
      "provider": "ollama",
      "model": "deepseek-r1:8b",
      "baseUrl": "http://localhost:11434",
      "temperature": 0.7,
      "maxTokens": 2048,
      "timeoutMs": 60000
    }
  }
}
```

支持的提供商：
- `ollama` - 本地 Ollama 服务
- `openai` - OpenAI API
- `anthropic` - Anthropic Claude API
- `azure` - Azure OpenAI
- `custom` - 自定义端点

### 4.2 Token 预算 (`model.tokenBudget`)

```json
{
  "model": {
    "tokenBudget": {
      "system": 0.15,
      "self": 0.35,
      "memory": 0.30,
      "user": 0.20
    },
    "totalTokenBudget": 4096
  }
}
```

| 类别 | 说明 | 推荐比例 |
|------|------|----------|
| `system` | 系统提示词 | 10-20% |
| `self` | 自我描述 | 30-40% |
| `memory` | 记忆上下文 | 25-35% |
| `user` | 用户输入预留 | 15-25% |

**总和必须等于 1.0**

---

## 5. 提示词系统配置

### 5.1 三类提示词架构

Ouroboros 使用三类提示词：

1. **系统提示词** (`prompts.system`) - 安全约束、输出格式（只读）
2. **自我提示词** (`prompts.self`) - 身份、状态、能力（可优化）
3. **记忆提示词** (`prompts.memory`) - 相关记忆、上下文（动态组装）

### 5.2 系统提示词配置

```json
{
  "prompts": {
    "system": {
      "template": "你是 {name}...",
      "readOnly": true
    }
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `template` | string | 系统提示词模板，支持变量替换 |
| `readOnly` | boolean | 是否只读（禁止自我修改） |

### 5.3 自我提示词配置

```json
{
  "prompts": {
    "self": {
      "identityTemplate": "我是 {name} v{version}...",
      "capabilityTemplate": "我的能力包括: {capabilities}",
      "stateTemplate": "当前状态: 情绪 {emotion}...",
      "optimizable": true
    }
  }
}
```

变量说明：
- `{name}` - Agent 名称
- `{version}` - 版本号
- `{creator}` - 创造者
- `{evolutionStage}` - 进化阶段
- `{capabilities}` - 能力列表
- `{emotion}` - 当前情绪
- `{focus}` - 专注度
- `{load}` - 认知负荷

### 5.4 记忆提示词配置

```json
{
  "prompts": {
    "memory": {
      "maxContextMemories": 5,
      "includeRecentConversation": true,
      "includeRelevantFacts": true,
      "dynamicAssembly": true
    }
  }
}
```

---

## 6. 记忆系统配置

### 6.1 向量存储配置 (`memory.vectorStore`)

```json
{
  "memory": {
    "vectorStore": {
      "enabled": true,
      "provider": "ollama",
      "model": "nomic-embed-text",
      "dimension": 768,
      "baseUrl": "http://localhost:11434",
      "similarityThreshold": 0.7,
      "maxResults": 10
    }
  }
}
```

支持的向量存储提供商：
- `ollama` - 使用 Ollama 本地嵌入模型
- `openai` - OpenAI 嵌入 API
- `none` - 禁用向量存储（仅使用关键词搜索）

### 6.2 检索配置 (`memory.retrieval`)

```json
{
  "memory": {
    "retrieval": {
      "defaultLimit": 5,
      "maxLimit": 20,
      "semanticWeight": 0.4,
      "temporalWeight": 0.3,
      "importanceWeight": 0.3,
      "keywordSearchEnabled": true,
      "vectorSearchEnabled": true
    }
  }
}
```

检索算法权重（总和应为 1.0）：
- `semanticWeight` - 语义相似度权重
- `temporalWeight` - 时间衰减权重
- `importanceWeight` - 重要性权重

### 6.3 导入导出配置

```json
{
  "memory": {
    "importExport": {
      "allowedFormats": ["json", "markdown", "csv"],
      "maxExportSize": 1000000,
      "includeEmbeddings": false
    }
  }
}
```

---

## 7. 身体图式配置

### 7.1 传感器配置 (`bodySchema.sensors`)

```json
{
  "bodySchema": {
    "sensors": {
      "enabled": ["filesystem", "network", "process", "time", "system_resources"],
      "updateIntervalMs": 5000,
      "filesystem": {
        "watchPaths": ["./data", "./logs"],
        "maxDepth": 3
      },
      "network": {
        "checkConnectivity": true,
        "monitorInterfaces": true
      },
      "process": {
        "monitorSelf": true,
        "checkIntervalMs": 10000
      },
      "system_resources": {
        "cpuThreshold": 0.8,
        "memoryThreshold": 0.85,
        "diskThreshold": 0.9
      }
    }
  }
}
```

支持的传感器类型：
- `filesystem` - 文件系统监控
- `network` - 网络状态监控
- `process` - 进程状态监控
- `time` - 时间传感器
- `system_resources` - 系统资源监控（CPU/内存/磁盘）

### 7.2 执行器配置 (`bodySchema.actuators`)

```json
{
  "bodySchema": {
    "actuators": {
      "enabled": ["file_write", "exec_command", "http_request", "websocket_send"],
      "timeoutMs": 30000,
      "maxConcurrent": 5,
      "file_write": {
        "allowedPaths": ["./data", "./logs", "./output"],
        "maxFileSize": 10485760
      },
      "exec_command": {
        "allowedCommands": ["git", "npm", "node", "python"],
        "blockedPatterns": ["rm -rf /", ":(){ :|:& };:"]
      },
      "http_request": {
        "timeoutMs": 30000,
        "maxRedirects": 5,
        "allowedProtocols": ["http", "https"]
      }
    }
  }
}
```

支持的执行器类型：
- `file_write` - 文件写入
- `exec_command` - 执行系统命令
- `http_request` - HTTP 请求
- `websocket_send` - WebSocket 消息发送

### 7.3 资源监控配置

```json
{
  "bodySchema": {
    "resourceMonitor": {
      "enabled": true,
      "checkIntervalMs": 5000,
      "alertThresholds": {
        "cpu": 0.8,
        "memory": 0.85,
        "disk": 0.9
      }
    }
  }
}
```

---

## 8. 世界模型配置

### 8.1 模式识别

```json
{
  "worldModel": {
    "patternRecognition": {
      "enabled": true,
      "minConfidence": 0.6,
      "maxPatterns": 100
    }
  }
}
```

### 8.2 风险管理

```json
{
  "worldModel": {
    "riskManagement": {
      "enabled": true,
      "autoEscalate": true,
      "maxActiveRisks": 20
    }
  }
}
```

### 8.3 机会检测

```json
{
  "worldModel": {
    "opportunityDetection": {
      "enabled": true,
      "minPotential": 0.5,
      "maxOpportunities": 50
    }
  }
}
```

---

## 9. 工具与技能配置

### 9.1 工具发现配置

```json
{
  "tool": {
    "discovery": {
      "enabled": true,
      "scanIntervalMs": 300000,
      "scanPaths": ["/usr/bin", "/usr/local/bin"],
      "mcpServers": {
        "enabled": false,
        "configPath": "./config/mcp-servers.json"
      }
    }
  }
}
```

### 9.2 工具置信度配置

```json
{
  "tool": {
    "confidence": {
      "initialValue": 0.5,
      "learningRate": 0.1,
      "minConfidence": 0.1,
      "maxConfidence": 0.99
    }
  }
}
```

### 9.3 技能掌握度配置

```json
{
  "skills": {
    "mastery": {
      "noviceThreshold": 0,
      "intermediateThreshold": 100,
      "advancedThreshold": 500,
      "expertThreshold": 1000
    },
    "learning": {
      "successXpGain": 10,
      "failureXpGain": 2,
      "complexityMultiplier": 1.5
    }
  }
}
```

技能等级阈值：
- **新手 (Novice)**: 0-99 XP
- **中级 (Intermediate)**: 100-499 XP
- **高级 (Advanced)**: 500-999 XP
- **专家 (Expert)**: 1000+ XP

---

## 10. 安全配置

### 10.1 基础安全

```json
{
  "safety": {
    "dualMindEnabled": true,
    "hardwareWatchdogEnabled": false,
    "identityAnchorIntervalMs": 60000,
    "maxConsecutiveErrors": 5,
    "godelImmunityEnabled": true
  }
}
```

安全机制说明：
- `dualMindEnabled` - 双思维验证
- `hardwareWatchdogEnabled` - 硬件看门狗
- `identityAnchorIntervalMs` - 身份锚定检查间隔
- `maxConsecutiveErrors` - 最大连续错误次数
- `godelImmunityEnabled` - 哥德尔免疫

### 10.2 自指保护

```json
{
  "safety": {
    "selfReferenceProtection": {
      "codeModificationRequiresApproval": true,
      "maxModificationSize": 1000,
      "blockedPatterns": ["process.exit", "eval(", "require('child_process')"]
    }
  }
}
```

---

## 11. 进化系统配置

### 11.1 基础进化配置

```json
{
  "evolution": {
    "heartbeatIntervalMs": 300000,
    "deepEvolutionIntervalMs": 3600000,
    "reflectionThreshold": 0.8,
    "abTesting": {
      "enabled": true,
      "minSamples": 10,
      "confidenceLevel": 0.95,
      "maxConcurrentTests": 5
    },
    "learningQueueMaxSize": 100
  }
}
```

### 11.2 反思引擎配置

```json
{
  "reflection": {
    "enabled": true,
    "mode": "semi_autonomous",
    "scheduleIntervalMs": 1800000,
    "performanceThreshold": 0.7,
    "maxInsights": 10,
    "autoExecuteLowRisk": true,
    "triggers": {
      "scheduled": true,
      "performanceDrop": true,
      "anomalyDetected": true,
      "toolDiscovered": true,
      "userRequest": false
    }
  }
}
```

审批模式 (`mode`)：
- `auto` - 自动模式：所有优化自动执行
- `semi_autonomous` - 半自主：低风险自动，高风险需审批
- `conservative` - 保守模式：只自动执行低风险操作
- `human` - 人工模式：所有操作需人工审批

---

## 12. 日志配置

```json
{
  "log": {
    "level": "info",
    "outputDir": "./logs",
    "consoleOutput": true,
    "fileOutput": true,
    "retentionDays": 30,
    "errorMonitoring": {
      "enabled": true,
      "alertThreshold": 5,
      "alertIntervalMs": 300000
    }
  }
}
```

日志级别：
- `debug` - 调试信息（最详细）
- `info` - 一般信息
- `warn` - 警告信息
- `error` - 错误信息（最简略）

---

## 13. 适配器配置

### 13.1 Web 服务配置

```json
{
  "adapter": {
    "web": {
      "enabled": true,
      "port": 8080,
      "host": "0.0.0.0",
      "corsOrigins": ["*"],
      "dashboardRefreshIntervalMs": 5000
    }
  }
}
```

### 13.2 MCP 配置

```json
{
  "adapter": {
    "mcp": {
      "enabled": false,
      "serverName": "ouroboros-mcp"
    }
  }
}
```

### 13.3 WebSocket 配置

```json
{
  "adapter": {
    "websocket": {
      "enabled": false,
      "port": 8081
    }
  }
}
```

---

## 14. 配置最佳实践

### 14.1 开发环境推荐配置

```json
{
  "log": {
    "level": "debug",
    "consoleOutput": true,
    "fileOutput": true
  },
  "safety": {
    "dualMindEnabled": true,
    "codeModificationRequiresApproval": true
  },
  "reflection": {
    "mode": "conservative",
    "scheduleIntervalMs": 600000
  }
}
```

### 14.2 生产环境推荐配置

```json
{
  "log": {
    "level": "warn",
    "consoleOutput": false,
    "fileOutput": true,
    "retentionDays": 7
  },
  "safety": {
    "dualMindEnabled": true,
    "codeModificationRequiresApproval": true,
    "godelImmunityEnabled": true
  },
  "reflection": {
    "mode": "conservative",
    "autoExecuteLowRisk": false
  },
  "adapter": {
    "web": {
      "corsOrigins": ["https://yourdomain.com"]
    }
  }
}
```

### 14.3 性能优化配置

```json
{
  "memory": {
    "shortTermCapacity": 100,
    "vectorStore": {
      "enabled": true,
      "similarityThreshold": 0.75
    }
  },
  "model": {
    "tokenBudget": {
      "system": 0.1,
      "self": 0.2,
      "memory": 0.3,
      "user": 0.4
    }
  }
}
```

### 14.4 环境变量覆盖

以下配置项支持通过环境变量覆盖：

```bash
# 模型配置
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
OLLAMA_BASE_URL=http://localhost:11434

# Agent 身份
AGENT_NAME=MyAgent
AGENT_VERSION=2.0.0

# 安全配置
SAFETY_MODE=strict
MAX_CONSECUTIVE_ERRORS=3

# 日志配置
LOG_LEVEL=info
LOG_DIR=./logs
```

### 14.5 配置文件验证

使用 JSON Schema 验证配置：

```bash
# 使用 ajv-cli
npx ajv-cli validate -s config.schema.json -d config.json

# 或使用 Python
python -c "import json; json.load(open('config.json'))"
```

---

## 附录

### A. 完整配置模板

参见 `config.example.json` 获取完整的配置模板。

### B. 配置变更日志

| 版本 | 变更 |
|------|------|
| 2.0.0 | 新增提示词系统配置、身体图式配置、世界模型配置 |
| 1.5.0 | 新增 A/B 测试配置、技能系统配置 |
| 1.0.0 | 初始配置结构 |

### C. 故障排除

**Q: 配置加载失败？**
A: 检查 JSON 语法，使用 JSON 验证工具。

**Q: 向量存储连接失败？**
A: 确认 Ollama 服务已启动，检查 `baseUrl` 配置。

**Q: Token 预算超出？**
A: 调整 `model.tokenBudget` 分配，确保总和为 1.0。

---

*文档版本: 2.0.0*  
*最后更新: 2026-02-18*
