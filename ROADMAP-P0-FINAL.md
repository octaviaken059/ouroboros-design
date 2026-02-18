# Ouroboros P0 核心功能 - 最终确认版

**版本**: v2.0 P0  
**原则**: 核心必须功能，没有这些系统无法自我进化  
**总时间**: 36-47天

---

## Phase 0: 基础架构 (2-3天)

### Step 0.1: 项目初始化
- TypeScript 严格配置
- ESLint + Prettier
- Jest 测试框架
- Git hooks

### Step 0.2: 类型定义
- Identity/Body/WorldModel/CognitiveState/Tool/Memory 接口
- 错误类型 OuroborosError
- 事件类型

### Step 0.3: 日志和错误处理
- Winston logger
- 日志分级
- 全局错误处理器

### Step 0.4: 配置系统
- 配置加载器 (config/agent.json)
- 配置验证 (JSON Schema)
- 环境变量支持
- **配置热重载**
- 配置持久化到 SQLite

**交付验证**: `npm run lint/type-check/test` 全部通过

---

## Phase 1: 统一自我描述 (5-6天)

### Step 1.1: Identity
- 属性: name, version, evolutionStage
- 方法: updateVersion, advanceStage
- 持久化到 SQLite

### Step 1.2: Body (完整身体图式)
- **Sensors**: file_system, network, process, time, system_resources
- **Actuators**: file_write, exec_command, http_request, websocket_send
- **Resources**: CPU, memory, disk, network, uptime
- 传感器状态管理
- 执行器调用
- 资源监控更新

### Step 1.3: WorldModel
- 模式管理 (addPattern, getPatterns)
- 风险管理 (addRisk, resolveRisk)
- 机会管理
- 能力评估

### Step 1.4: CognitiveState
- 激素水平管理 (5种激素)
- 模式管理 (serving/evolving/reflection)
- 目标管理
- 专注度管理

### Step 1.5: ToolSet
- 工具注册/注销
- 工具置信度管理
- 工具描述生成
- 支持内置工具和 MCP 工具

### Step 1.6: UnifiedSelfDescription 整合
- 整合所有组件
- 生成完整自我描述
- 生成自我提示词
- 序列化/反序列化
- 变更监听

**交付验证**: 
- 单元测试 >80% 覆盖
- 自我描述包含所有部分
- 提示词格式正确

---

## Phase 2: 激素系统 (3-4天)

### Step 2.1: 激素模型
- 5种激素: Adrenaline, Cortisol, Dopamine, Serotonin, Curiosity
- 属性: value, baseline, decayRate, halfLife
- 方法: increase, decrease, naturalDecay
- 激素相互作用

### Step 2.2: 触发器系统
- 触发器类型: TaskSuccess, TaskFailure, SystemOverload, SecurityThreat, Novelty, Routine
- TriggerEngine: registerTrigger, evaluateTriggers, fireTrigger
- 与事件系统集成

### Step 2.3: HormoneSystem 整合
- 管理所有激素实例
- 运行触发器引擎
- 定期自然衰减
- 与 CognitiveState 集成
- API: /api/hormones

**交付验证**:
- 激素值始终在 0-1
- 自然衰减计算正确
- 触发器响应正确

---

## Phase 2.5: 模型引擎 (3-4天) ⭐ 新增

### Step 2.5.1: ModelClient
- 支持 Ollama API
- 支持 OpenAI API 格式
- 流式响应处理
- 错误重试机制

### Step 2.5.2: PromptAssembler
- 加载 System 提示词（静态）
- 加载 Self 提示词（从 UnifiedSelfDescription）
- 组装 Memory 提示词
- 调用 TokenBudgetManager

### Step 2.5.3: TokenBudgetManager
- **默认预算配置**:
  ```json
  {
    "system": 0.2,    // 20%
    "self": 0.4,      // 40%
    "memory": 0.3,    // 30%
    "user": 0.1       // 10%
  }
  ```
- 从配置文件读取预算分配
- **持久化到 SQLite config 表**
- 计算实际 Token 使用
- 超出时截断（优先截断 memory）
- **可被反思引擎修改**

### Step 2.5.4: PerformanceMonitor
- 记录: 模型名称、输入/输出 Token、响应时间、成功率
- 保存到 performance_logs 表
- 为反思引擎提供数据

**交付验证**:
- 能正确调用 Ollama
- Token 预算分配正确
- 配置可热重载
- 性能数据正确记录

---

## Phase 3: 分层记忆 (5-6天)

### Step 3.1: 基础记忆存储
- Memory 接口定义
- MemoryStore 基类
- SQLite 持久化
- 向量索引 (nomic-embed-text)

### Step 3.2: 情景记忆 (Episodic)
- recordEvent, recordConversation
- 时间检索 (getRecent, getByTimeRange)
- 压缩机制

### Step 3.3: 语义记忆 (Semantic)
- addFact, getFact, updateFact
- 向量检索 (searchSimilar)
- 冲突处理
- 置信度更新

### Step 3.4: 程序记忆 (Procedural)
- recordSkill, getSkill
- updateSkillSuccess
- 成功率统计

### Step 3.5: 反思记忆 (Reflective)
- recordInsight, getInsights
- 重要性评估

### Step 3.6: MemorySystem 整合
- 统一管理所有记忆类型
- 跨类型检索
- 遗忘机制
- 记忆提示词生成
- API: /api/memory

**交付验证**:
- 搜索准确
- 性能达标 (<100ms)
- 遗忘机制合理

---

## Phase 4: 贝叶斯核心 (2-3天)

### Step 4.1: 贝叶斯更新
- 贝叶斯更新函数
- Beta 分布实现
- 置信度计算

### Step 4.2: BayesianCore 整合
- updateToolConfidence
- getToolConfidence
- shouldUseTool
- 探索-利用平衡

**交付验证**:
- 数学公式正确
- 置信度收敛

---

## Phase 5: 反思引擎 (4-5天)

### Step 5.1: 反思触发器
- scheduled, performanceDrop, anomaly, manual
- 触发器引擎
- 性能监控

### Step 5.2: 反思分析
- 性能分析
- 记忆分析
- 事件分析
- 生成洞察 (Pattern/Problem/Opportunity)

### Step 5.3: 反思执行
- ReflectionEngine
- applyChanges
- **审批模式**: auto/conservative/human
- 变更历史记录
- **包括 Token 预算优化**

**交付验证**:
- 能识别真实问题
- 变更可追溯
- 包括预算调整

---

## Phase 6: 自我进化 (4-5天)

### Step 6.1: 软自指
- 三类提示词管理
- 优化策略
- **A/B 测试基础**

### Step 6.2: A/B 测试
- Variant 管理
- 测试执行
- 统计显著性检验
- 自动选择胜者
- **包括 Token 预算配置变体测试**

**交付验证**:
- 提示词可优化
- A/B 测试有效

---

## Phase 7: Web 界面 (3-4天)

### Step 7.1: 后端 API
- /api/chat (普通 + 流式)
- /api/status, /api/hormones, /api/memory
- /api/logs, /api/prompts
- POST /api/memory
- POST /api/reflection/trigger

### Step 7.2: 前端界面
- 聊天界面 (历史 + 流式 + Think)
- 监控界面 (系统指标 + 激素 + 记忆 + 提示词 + 日志)
- 管理界面 (添加记忆 + 触发反思)

**交付验证**:
- 所有 API 工作正常
- 界面美观响应式
- 端到端测试通过

---

## Phase 8: 测试和优化 (4-5天)

### Step 8.1: 单元测试
- 核心模块 >80% 覆盖

### Step 8.2: 集成测试
- 对话流程
- 反思流程

### Step 8.3: 端到端测试
- 用户聊天场景
- 系统监控场景

### Step 8.4: 性能优化
- 聊天响应 <2秒
- 记忆查询 <100ms

**交付验证**:
- 测试覆盖率达标
- 性能基准通过

---

## Token 预算配置说明

### 默认配置 (config/agent.json)
```json
{
  "promptBudget": {
    "system": 0.2,
    "self": 0.4,
    "memory": 0.3,
    "user": 0.1,
    "maxTotalTokens": 8192
  }
}
```

### 持久化
- 保存到 SQLite `config` 表
- 键: `prompt_budget_system`, `prompt_budget_self`, 等

### 可进化性
- 反思引擎分析 Token 使用效率
- 发现某部分经常不足/过剩
- 生成优化建议
- 修改 config 表中的预算分配
- 下次组装提示词时自动生效

---

## 总时间

| Phase | 时间 |
|-------|------|
| 0: 基础架构 | 2-3天 |
| 1: 统一自我描述 | 5-6天 |
| 2: 激素系统 | 3-4天 |
| 2.5: 模型引擎 | 3-4天 |
| 3: 分层记忆 | 5-6天 |
| 4: 贝叶斯核心 | 2-3天 |
| 5: 反思引擎 | 4-5天 |
| 6: 自我进化 | 4-5天 |
| 7: Web界面 | 3-4天 |
| 8: 测试优化 | 4-5天 |
| **总计** | **36-47天** |

---

## 下一步

请 Ken 最终确认：
1. **P0 功能列表是否完整？**
2. **Token 预算默认分配是否合理？** (20/40/30/10)
3. **总时间 36-47天是否可以接受？**
4. **是否可以开始 Phase 0 实现？**

确认后，我将严格按照此 roadmap 一步步实现，每步完成后汇报验证结果并等待你的确认。
