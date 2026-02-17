# Ouroboros Design - 系统设计文档 v2.0

> 自我进化型 AI Agent 架构设计
> 
> 核心理念：**认知即代码，进化即部署**

---

## 目录

1. [系统概述](#1-系统概述)
2. [架构设计](#2-架构设计)
3. [核心子系统](#3-核心子系统)
4. [自我进化机制](#4-自我进化机制)
5. [工具与技能管理](#5-工具与技能管理)
6. [数据流](#6-数据流)
7. [配置与部署](#7-配置与部署)
8. [API 参考](#8-api-参考)

---

## 1. 系统概述

### 1.1 设计哲学

Ouroboros 是一个**自我进化型 AI Agent**，其设计遵循以下哲学：

| 原则 | 说明 |
|------|------|
| **自我觉察** | Agent 对自身状态、能力、限制有完整认知 |
| **持续进化** | 通过反思和优化不断改进自身 |
| **资源效率** | 按需加载，避免浪费计算资源和 Token |
| **安全第一** | 多层防护机制确保自我修改的安全性 |
| **开放扩展** | 通过 MCP 等标准协议集成外部能力 |

### 1.2 系统特性

```yaml
核心能力:
  - 软自指: 修改自我提示词，优化行为模式
  - 硬自指: 修改源代码，添加新功能
  - A/B 测试: 对比不同策略，选择最优
  - 版本回滚: 性能下降时自动恢复
  - 工具发现: 自动扫描和集成新工具
  - 技能学习: 通过练习提升问题解决能力

安全机制:
  - 静态代码分析
  - 沙箱测试环境
  - 健康检查
  - 自动回滚
  - 人工审批（可选）

集成能力:
  - MCP (Model Context Protocol)
  - OpenClaw 生态 (Cron, Heartbeat, Skills)
  - 54+ 系统工具
  - 多种 AI 模型
```

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Ouroboros Agent v2.0                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     统一自我描述 (Unified Self-Description)           │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │   │
│  │  │   Identity   │ │    Body      │ │  WorldModel  │ │ Cognitive   │ │   │
│  │  │   (身份)     │ │  (身体图式)   │ │   (世界模型)  │ │   (认知状态) │ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘ │   │
│  │                                                                             │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  │              能力管理 (Capabilities)                                │   │
│  │  │  ┌─────────────────────────┐  ┌─────────────────────────┐          │   │
│  │  │  │     Tools (外部资源)     │  │    Skills (内部能力)     │          │   │
│  │  │  │  - ffmpeg, git, docker  │  │  - coding, debugging    │          │   │
│  │  │  │  - MCP servers          │  │  - data analysis        │          │   │
│  │  │  │  - API services         │  │  - self-improvement     │          │   │
│  │  │  └─────────────────────────┘  └─────────────────────────┘          │   │
│  │  │                                                                             │
│  │  │  按需加载: 根据意图和主题动态选择相关能力                               │   │
│  │  └─────────────────────────────────────────────────────────────────────┘   │
│  └─────────────────────────────────────────────────────────────────────────────┘
│                                    │
│                                    ▼
│  ┌─────────────────────────────────────────────────────────────────────────────┐
│  │                         自我进化系统 (Self-Evolution)                        │
│  │                                                                             │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │
│  │  │   软自指     │    │   硬自指     │    │   A/B 测试   │                 │
│  │  │  (提示词)    │◄──►│  (代码)      │    │  (变体对比)  │                 │
│  │  │              │    │              │    │              │                 │
│  │  │ • 自我提示词 │    │ • 代码修改   │    │ • 变体生成   │                 │
│  │  │ • 记忆提示词 │    │ • 沙箱测试   │    │ • 性能统计   │                 │
│  │  │ • 系统提示词 │    │ • 版本回滚   │    │ • 自动选优   │                 │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                 │
│  │         │                   │                   │                         │
│  │         └───────────────────┴───────────────────┘                         │
│  │                             │                                             │
│  │                    ┌────────┴────────┐                                    │
│  │                    │     反思 (Reflection)                               │
│  │                    │  ─────────────────                                  │
│  │                    │  输入: 记忆 + 性能 + 事件                             │
│  │                    │  输出: insights + 变更建议                            │
│  │                    └─────────────────┘                                    │
│  └─────────────────────────────────────────────────────────────────────────────┘
│                                    │
│                                    ▼
│  ┌─────────────────────────────────────────────────────────────────────────────┐
│  │                       核心子系统 (Core Subsystems)                           │
│  │                                                                             │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │  │ 调度器   │  │ 激素系统 │  │ 身体图式 │  │ 贝叶斯   │  │ 分层记忆 │     │
│  │  │Scheduler │  │Hormone   │  │Body      │  │Bayesian  │  │Layered   │     │
│  │  │          │  │System    │  │Schema    │  │Core      │  │Memory    │     │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│  │                                                                             │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                                  │
│  │  │ 安全引擎 │  │ MCP管理  │  │ 健康检查 │                                  │
│  │  │Safety    │  │MCP       │  │Health    │                                  │
│  │  │Engine    │  │Manager   │  │Check     │                                  │
│  │  └──────────┘  └──────────┘  └──────────┘                                  │
│  └─────────────────────────────────────────────────────────────────────────────┘
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 组件关系

```
用户输入
    │
    ▼
┌─────────────────────────────────────────┐
│  1. 意图识别 (Intent Recognition)       │
│     - 提取用户意图和主题                 │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  2. 能力加载 (Capability Loading)       │
│     - 按需加载相关工具和技能             │
│     - 生成精简的自我描述                 │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  3. 提示词组装 (Prompt Assembly)        │
│     - 系统提示词                         │
│     - 自我描述 (动态加载的能力)          │
│     - 相关记忆                           │
│     - 用户输入                           │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  4. LLM 推理 (Model Inference)          │
│     - 生成响应                           │
│     - 规划工具调用                       │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  5. 执行与反馈 (Execution & Feedback)   │
│     - 调用工具                           │
│     - 记录性能                           │
│     - 触发反思                           │
└─────────────────────────────────────────┘
```

---

## 3. 核心子系统

### 3.1 统一自我描述 (Unified Self-Description v2)

**职责**: 作为系统的"自我认知中心"，整合所有关于"我是谁"的信息。

**组成部分**:

| 组件 | 说明 | 数据示例 |
|------|------|----------|
| **Identity** | 身份认知 | name, version, evolutionStage |
| **Body** | 身体图式 | platform, resources, sensors |
| **WorldModel** | 世界模型 | patterns, risks, opportunities |
| **CognitiveState** | 认知状态 | hormoneLevels, mode, focus |
| **Capabilities** | 能力统计 | tools count, skills count |
| **ToolSkillManager** | 工具技能管理 | 按需加载具体能力 |

**关键方法**:

```typescript
class UnifiedSelfDescriptionV2 {
  // 初始化
  async initialize(): Promise<void>
  
  // 反思 - 更新自我描述的入口
  async reflect(context: ReflectionContext): Promise<ReflectionResult>
  
  // 按需加载能力
  loadCapabilities(config: LoadConfig): LoadResult
  
  // 生成自我描述文本
  generateSelfDescription(): string
  
  // 更新身体资源
  updateBodyResources(resources: ResourceInfo)
  
  // 更新激素状态
  updateHormoneLevels(levels: HormoneLevels)
}
```

### 3.2 工具与技能管理 (Tool & Skill Manager)

**职责**: 管理外部工具（滑雪板）和内部技能（滑雪技术），支持按需加载。

**工具分类**:

```
system/         - 系统工具 (file, process, network)
dev/            - 开发工具 (git, docker, build)
ai/             - AI/ML工具 (llm, vision, voice)
data/           - 数据工具 (db, analysis)
content/        - 内容创作 (image, video, audio)
mcp/            - MCP工具 (browser, fs)
hardware/       - 硬件工具 (camera, sensor)
```

**技能分类**:

```
fundamental/    - 基础技能 (reasoning, planning)
coding/         - 编程技能 (js, py, go, web)
data/           - 数据技能 (sql, stats, viz)
automation/     - 自动化技能 (browser, script)
content/        - 内容创作 (write, design)
meta/           - 元技能 (learning, integration)
```

**按需加载策略**:

| 优先级 | 加载时机 | 示例 |
|--------|----------|------|
| critical | 总是加载 | openai_api, git, self_reflection |
| high | 大概率加载 | file operations, web_search |
| medium | 中等概率 | docker, database |
| low | 低频 | specialized tools |
| on_demand | 按需 | video, browser automation |

### 3.3 自我进化系统

#### 3.3.1 软自指 (Soft Self-Reference)

**职责**: 通过修改提示词优化行为，无需代码变更。

**三类提示词**:

1. **系统提示词** - 安全约束、输出格式（只读）
2. **自我提示词** - 身份、状态、能力（可优化）
3. **记忆提示词** - 相关记忆、上下文（动态组装）

**优化策略**:

```typescript
enum OptimizationStrategy {
  REDUCE_RISK = 'reduce_risk',           // 降低风险偏好
  INCREASE_EXPLORATION = 'increase_exploration', // 增加探索
  IMPROVE_TOKEN_EFFICIENCY = 'improve_token_efficiency',
  ENHANCE_MEMORY_RETRIEVAL = 'enhance_memory_retrieval',
  ADJUST_VERBOSITY = 'adjust_verbosity',
}
```

#### 3.3.2 硬自指 (Hard Self-Reference)

**职责**: 修改源代码，实现更深层次的自我改进。

**安全流程**:

```
提议修改
    │
    ▼
┌─────────────────┐
│ 1. 静态代码分析 │ ← 检测危险模式
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. 创建备份     │ ← 完整代码备份
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. 沙箱测试     │ ← 编译+运行测试
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. 代码审查     │ ← 人工/AI审查
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 5. 生产部署     │ ← 应用修改
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 6. 健康检查     │ ← 验证功能
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐  ┌────────┐
│ 通过 ✅ │  │ 失败 ❌ │
└───────┘  └────┬───┘
                │
                ▼
           ┌────────┐
           │ 自动回滚 │
           └────────┘
```

#### 3.3.3 A/B 测试

**职责**: 对比不同提示词变体，选择最优策略。

```typescript
class ABTestManager {
  // 创建变体
  createVariant(baseContent: SelfPromptContent, name: string): Variant
  
  // 启动测试
  startABTest(variantAId: string, variantBId: string)
  
  // 记录结果
  recordTaskResult(success: boolean, metrics: PerformanceMetrics)
  
  // 自动选择胜者
  evaluateResults(): Winner | null
}
```

### 3.4 核心认知子系统

#### 3.4.1 激素系统 (Hormone System)

**职责**: 模拟神经内分泌调节，影响行为和决策。

| 激素 | 作用 | 触发条件 |
|------|------|----------|
| **Adrenaline** | 警觉/紧急响应 | 安全威胁、异常情况 |
| **Cortisol** | 压力/资源紧张 | 资源不足、连续失败 |
| **Dopamine** | 奖励/学习动力 | 任务成功、技能提升 |
| **Serotonin** | 稳定/情绪调节 | 系统稳定、正常运行 |
| **Curiosity** | 探索/学习欲望 | 新奇事物、用户请求 |

#### 3.4.2 贝叶斯认知核心 (Bayesian Core)

**职责**: 基于贝叶斯更新评估工具置信度。

```
P(H|E) = P(E|H) × P(H) / P(E)

工具置信度 = 成功次数 / 总使用次数
不确定性 = αβ / ((α+β)²(α+β+1))
```

#### 3.4.3 分层记忆 (Layered Memory)

**职责**: 多类型记忆存储和检索。

| 记忆类型 | 存储内容 | 检索方式 |
|----------|----------|----------|
| **情景记忆** | 事件、对话 | 时间最近 |
| **语义记忆** | 知识、事实 | 向量相似度 |
| **程序记忆** | 技能、流程 | 标签匹配 |
| **反思记忆** | 洞察、模式 | 重要性排序 |

#### 3.4.4 调度器 (Scheduler)

**职责**: 任务调度和资源管理。

```typescript
interface Scheduler {
  // 提交任务
  submitTask(task: Task): void
  
  // 稳态维护
  maintainHomeostasis(): void
  
  // 事件
  on('homeostasisAlert', callback)
}
```

#### 3.4.5 安全引擎 (Safety Engine)

**职责**: 多层安全防护。

```
Level 1: Gödel Immunity      - 检测自指攻击
Level 2: Dual Mind           - 双重确认机制
Level 3: Identity Anchor     - 身份签名验证
Level 4: Shadow Monitor      - 进程树审计
Level 5: Sacred Scheduler    - 核心调度器保护
```

---

## 4. 自我进化机制

### 4.1 反思循环

```
┌─────────────────────────────────────────────────────────────┐
│                      反思循环 (Reflection Loop)              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   执行任务 ───────┐                                         │
│      │            │                                         │
│      ▼            │                                         │
│   记录性能        │                                         │
│      │            │                                         │
│      ▼            │                                         │
│   触发反思 ◄──────┘                                         │
│      │                                                      │
│      ▼                                                      │
│   分析: 记忆 + 性能 + 事件                                   │
│      │                                                      │
│      ▼                                                      │
│   发现:                                                       │
│   • 新工具可集成                                            │
│   • 新模式可提取                                            │
│   • 新技能可学习                                            │
│   • 当前限制需改进                                          │
│      │                                                      │
│      ▼                                                      │
│   生成变更建议                                               │
│      │                                                      │
│      ▼                                                      │
│   应用变更 ──→ 软自指 (提示词优化)                           │
│           ──→ 硬自指 (代码修改) ──→ 安全验证 ──→ 部署        │
│           ──→ 技能学习 (经验积累)                           │
│           ──→ 工具集成 (发现注册)                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 进化触发条件

| 触发器 | 说明 | 行动 |
|--------|------|------|
| **scheduled** | 定时反思 | 常规优化 |
| **performance_drop** | 性能下降 | 紧急调整 |
| **anomaly_detected** | 异常检测 | 问题修复 |
| **tool_discovered** | 发现新工具 | 能力扩展 |
| **user_request** | 用户请求 | 专项优化 |

### 4.3 进化质量评估

```typescript
interface EvolutionQuality {
  // 性能指标
  taskSuccessRate: number;      // 任务成功率
  tokenEfficiency: number;      // Token 效率
  responseTime: number;         // 响应时间
  
  // 认知指标
  toolConfidence: number;       // 工具置信度
  skillMastery: number;         // 技能掌握度
  reflectionQuality: number;    // 反思质量
  
  // 资源指标
  memoryUsage: number;          // 内存使用
  cpuUsage: number;             // CPU 使用
}
```

---

## 5. 工具与技能管理

### 5.1 工具 (Tool) - 外部资源

**定义**: 外部可实现功能的软件、硬件、服务或接口。

**类比**: 滑雪板

**属性**:

```typescript
interface Tool {
  id: string;
  name: string;
  type: ToolType;           // CLI, API, MCP, Hardware
  category: string;         // 分类路径
  source: ToolSource;       // 来源信息
  capabilities: string[];   // 能力列表
  inputs: ToolInput[];      // 输入定义
  outputs: ToolOutput[];    // 输出定义
  confidence: number;       // 置信度 (0-1)
  status: ToolStatus;       // 可用状态
  loadPriority: Priority;   // 加载优先级
}
```

**发现机制**:

```typescript
// 系统扫描
async function discoverSystemTools(): Promise<Tool[]> {
  // 扫描 PATH 中的可执行文件
  // 检查常用工具位置
  // 验证工具可用性
}

// MCP 发现
async function discoverMCPServers(): Promise<Tool[]> {
  // 扫描配置的 MCP 服务器
  // 获取工具列表
  // 注册到工具集
}
```

### 5.2 技能 (Skill) - 内部能力

**定义**: 解决特定问题的内部方法，通常调用工具或自身能力。

**类比**: 滑雪技术

**属性**:

```typescript
interface Skill {
  id: string;
  name: string;
  type: SkillType;          // Technical, Domain, Meta
  category: string;         // 分类路径
  level: SkillLevel;        // novice/intermediate/advanced/expert
  experience: number;       // 经验值 (XP)
  mastery: number;          // 掌握度 (0-1)
  requires: SkillRequirements; // 依赖
  implementation: SkillImplementation; // 实现方式
}
```

**成长机制**:

```
应用技能 ──→ 成功/失败
    │
    ▼
积累经验值
    │
    ▼
掌握度提升
    │
    ▼
等级晋升: novice → intermediate → advanced → expert
```

### 5.3 按需加载

**策略**:

```typescript
interface LoadConfig {
  context: string;          // 当前上下文
  intent?: string;          // 推断意图
  topic?: string;           // 当前主题
  maxTools: number;         // 最大工具数
  maxSkills: number;        // 最大技能数
  includePatterns: boolean; // 是否包含模式
}

function loadOnDemand(config: LoadConfig): LoadResult {
  // 1. 加载 critical 项
  // 2. 意图匹配
  // 3. 主题匹配
  // 4. 去重 + 截断
  // 5. 生成原因说明
}
```

**效果**:

```
全量加载: 100 tools × 30 tokens + 50 skills × 40 tokens = 5,000 tokens
按需加载:  10 tools × 30 tokens +  5 skills × 40 tokens =   500 tokens

节省: 90% Token 消耗
```

---

## 6. 数据流

### 6.1 请求处理流程

```
┌─────────┐     ┌─────────────┐     ┌─────────────────┐
│ 用户输入 │────►│ 意图识别    │────►│ 能力按需加载    │
└─────────┘     └─────────────┘     └────────┬────────┘
                                             │
                                             ▼
┌─────────┐     ┌─────────────┐     ┌─────────────────┐
│ 输出响应 │◄────│ LLM 推理    │◄────│ 提示词组装      │
└─────────┘     └─────────────┘     └─────────────────┘
       │
       ▼
┌─────────────────┐     ┌─────────────────┐
│ 执行工具调用    │────►│ 记录性能        │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                          ┌─────────────────┐
                          │ 触发反思        │
                          │ (如果满足条件)  │
                          └─────────────────┘
```

### 6.2 反思数据流

```
┌─────────────────────────────────────────────────────────────┐
│                         反思数据流                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  输入数据源                                                  │
│  ├── 记忆系统 ──→ 最近记忆 (最近100条)                       │
│  ├── 性能日志 ──→ 成功率、响应时间、Token消耗                │
│  ├── 系统事件 ──→ 工具发现、资源告警、错误异常               │
│  └── 当前状态 ──→ 激素水平、活跃任务、身体资源               │
│      │                                                      │
│      ▼                                                      │
│  分析处理                                                    │
│  ├── 模式识别 ──→ 发现重复模式、异常情况                     │
│  ├── 工具扫描 ──→ 发现新可用工具                             │
│  ├── 技能评估 ──→ 评估技能效果、识别学习机会                 │
│  └── 限制识别 ──→ 发现当前能力限制                           │
│      │                                                      │
│      ▼                                                      │
│  输出                                                        │
│  ├── Insights[] ──→ 发现的洞察                               │
│  └── ProposedChanges[] ──→ 建议的变更                        │
│      │                                                      │
│      ▼                                                      │
│  应用                                                        │
│  ├── 软自指 ──→ 更新提示词参数                               │
│  ├── 硬自指 ──→ 修改代码 (需验证)                           │
│  ├── 技能学习 ──→ 增加经验值、更新掌握度                     │
│  └── 工具集成 ──→ 注册新工具                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 持久化策略

```
实时数据 ──→ 内存
├── 当前激素水平
├── 活跃任务状态
└── 临时计算结果

定期保存 ──→ 磁盘 (每5分钟)
├── 自我描述 (JSON)
├── 工具/技能状态 (JSON)
└── 性能指标 (时序数据)

事件触发 ──→ 立即保存
├── 重要反思结果
├── 代码修改 (硬自指)
└── 关键配置变更
```

---

## 7. 配置与部署

### 7.1 配置文件

#### `config/agent.json`

```json
{
  "identity": {
    "name": "Ouroboros",
    "version": "2.0.0",
    "description": "Self-evolving AI Agent"
  },
  
  "selfEvolution": {
    "enabled": true,
    "mode": "semi_autonomous",
    "softSelfReference": {
      "enabled": true,
      "maxContextWindow": 8192,
      "autoOptimize": true
    },
    "hardSelfReference": {
      "enabled": true,
      "requireHumanApproval": true,
      "sandboxTimeout": 60000
    },
    "abTesting": {
      "enabled": true,
      "minSamples": 10
    }
  },
  
  "capabilities": {
    "onDemandLoading": {
      "enabled": true,
      "maxTools": 10,
      "maxSkills": 5,
      "defaultPriority": "on_demand"
    }
  },
  
  "safety": {
    "enableGodelImmunity": true,
    "enableDualMind": true,
    "enableIdentityAnchor": true,
    "autoRollbackThreshold": 0.6
  },
  
  "integrations": {
    "mcp": {
      "enabled": true,
      "configPath": "./config/mcp-servers.json"
    },
    "openclaw": {
      "enabled": true,
      "heartbeatInterval": 300000
    }
  }
}
```

#### `config/mcp-servers.json`

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
    }
  }
}
```

### 7.2 Docker 部署

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache ffmpeg git python3

# 复制代码
COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY config/ ./config/

# 创建数据目录
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  ouroboros:
    build: .
    container_name: ouroboros-agent
    volumes:
      - ./data:/app/data
      - ./config:/app/config
    environment:
      - NODE_ENV=production
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    restart: unless-stopped
    
  # 可选：Prometheus 监控
  prometheus:
    image: prom/prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
```

### 7.3 启动流程

```typescript
// index.ts
import { EnhancedUnifiedAgent } from './enhanced-unified-agent';

async function main() {
  // 1. 加载配置
  const config = await loadConfig('./config/agent.json');
  
  // 2. 创建 Agent
  const agent = new EnhancedUnifiedAgent(config);
  
  // 3. 初始化
  await agent.initialize();
  
  // 4. 启动服务
  await agent.start();
  
  console.log('Ouroboros Agent started successfully');
}

main().catch(console.error);
```

---

## 8. API 参考

### 8.1 核心类

#### `EnhancedUnifiedAgent`

```typescript
class EnhancedUnifiedAgent extends EventEmitter {
  // 构造函数
  constructor(config: EnhancedUnifiedAgentConfig)
  
  // 生命周期
  async initialize(): Promise<void>
  async start(): Promise<void>
  async stop(): Promise<void>
  
  // 消息处理
  async processMessage(message: string): Promise<string>
  
  // 自我进化
  async reflect(trigger: ReflectionTrigger): Promise<ReflectionResult>
  async proposeModification(type: ModificationType): Promise<Modification>
  
  // 工具技能
  loadCapabilities(config: LoadConfig): LoadResult
  registerTool(tool: ToolDefinition): void
  registerSkill(skill: SkillDefinition): void
  
  // 状态查询
  getStatus(): AgentStatus
  generateSelfDescription(): string
}
```

#### `UnifiedSelfDescriptionV2`

```typescript
class UnifiedSelfDescriptionV2 extends EventEmitter {
  constructor(dataDir: string)
  
  async initialize(): Promise<void>
  async reflect(context: ReflectionContext): Promise<ReflectionResult>
  loadCapabilities(config: LoadConfig): LoadResult
  generateSelfDescription(): string
  generateBriefSelfDescription(): string
  
  // 更新方法
  updateBodyResources(resources: ResourceInfo): void
  updateHormoneLevels(levels: HormoneLevels): void
  setCurrentFocus(focus: string): void
  
  // 获取器
  getDescription(): SelfDescriptionV2
  getToolSkillManager(): ToolSkillManager
}
```

#### `ToolSkillManager`

```typescript
class ToolSkillManager extends EventEmitter {
  constructor(dataDir: string)
  
  // 注册
  registerTool(tool: ToolDefinition): Tool
  registerSkill(skill: SkillDefinition): Skill
  
  // 查询
  getTool(id: string): Tool | undefined
  getSkill(id: string): Skill | undefined
  getAllTools(): Tool[]
  getAllSkills(): Skill[]
  getToolsByCategory(category: string): Tool[]
  getSkillsByCategory(category: string): Skill[]
  
  // 按需加载
  loadOnDemand(config: LoadConfig): LoadResult
  generateSelfDescription(result: LoadResult): string
  
  // 统计
  recordToolUsage(toolId: string, success: boolean, time: number): void
  recordSkillApplication(skillId: string, success: boolean, complexity: number): void
  
  // 发现
  async discoverTools(): Promise<Tool[]>
}
```

### 8.2 事件

```typescript
// Agent 事件
agent.on('messageReceived', (msg) => {})
agent.on('responseGenerated', (response) => {})
agent.on('toolCalled', (tool, args) => {})
agent.on('reflectionCompleted', (result) => {})
agent.on('selfOptimized', (record) => {})
agent.on('codeModified', (modification) => {})
agent.on('skillMastered', (skill) => {})

// 自我描述事件
selfDesc.on('toolsDiscovered', (tools) => {})
selfDesc.on('capabilitiesLoaded', (result) => {})
selfDesc.on('reflectionCompleted', (result) => {})

// 工具技能事件
manager.on('toolRegistered', (tool) => {})
manager.on('skillRegistered', (skill) => {})
manager.on('toolUsed', (info) => {})
manager.on('skillApplied', (info) => {})
```

### 8.3 配置类型

```typescript
interface EnhancedUnifiedAgentConfig {
  identity: IdentityConfig;
  selfEvolution: SelfEvolutionConfig;
  capabilities: CapabilitiesConfig;
  safety: SafetyConfig;
  integrations: IntegrationsConfig;
}

interface SelfEvolutionConfig {
  enabled: boolean;
  mode: 'manual' | 'semi_autonomous' | 'fully_autonomous';
  softSelfReference: SoftSelfReferenceConfig;
  hardSelfReference: HardSelfReferenceConfig;
  abTesting: ABTestingConfig;
}

interface LoadConfig {
  context: string;
  intent?: string;
  topic?: string;
  maxTools: number;
  maxSkills: number;
  includePatterns: boolean;
}
```

---

## 9. 附录

### 9.1 文件清单

| 文件路径 | 大小 | 说明 |
|----------|------|------|
| `src/enhanced-unified-agent.ts` | 27KB | 增强版Agent主类 |
| `src/cognitive/unified-self-description-v2.ts` | 16KB | 统一自我描述v2 |
| `src/execution/tool-skill-manager.ts` | 24KB | 工具技能管理器 |
| `src/cognitive/soft-self-reference.ts` | 33KB | 软自指系统 |
| `src/cognitive/hard-self-reference.ts` | 23KB | 硬自指系统 |
| `src/execution/mcp-tool-manager.ts` | 11KB | MCP工具集成 |
| `docs/SYSTEM-DESIGN.md` | 25KB | 本设计文档 |
| `docs/TOOL-SKILL-ARCHITECTURE.md` | 12KB | 工具技能架构 |

### 9.2 性能指标

```yaml
响应时间:
  简单查询: < 1s
  复杂任务: 2-5s
  工具调用: +0.5-2s

资源消耗:
  内存: 200-500MB (根据任务)
  CPU: 10-50% (峰值)
  Token: 节省 90% (按需加载)

可靠性:
  任务成功率: > 95%
  自动恢复: < 5s
  数据持久化: 实时
```

### 9.3 路线图

```
v2.0 (当前)
├── 软自指系统
├── 硬自指架构
├── A/B测试
├── 版本回滚
└── MCP集成

v2.1 (计划)
├── 多Agent协作
├── 分布式记忆
├── 更智能的反思
└── 自动化测试套件

v3.0 (远景)
├── 自主代码生成
├── 跨平台部署
├── 联邦学习
└── 真正的自我复制
```

---

*文档版本: 2.0.0*  
*最后更新: 2026-02-17*  
*作者: Ouroboros Design Team*
