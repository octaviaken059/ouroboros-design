# Ouroboros 完整实现 Roadmap

**版本**: v2.0  
**目标**: 严格按照设计文档实现完整功能  
**原则**: 不求快，只求完整和正确

---

## Phase 0: 基础架构搭建（预计 2-3 天）

### Step 0.1: 项目初始化和工具配置
**目标**: 搭建符合规范的 TypeScript 项目骨架

**详细逻辑**:
1. 初始化 npm 项目
2. 安装 TypeScript、ESLint、Prettier、Jest
3. 配置严格的 tsconfig.json
4. 配置 ESLint 规则
5. 配置 Prettier 格式化
6. 配置 Git hooks (husky + lint-staged)
7. 安装 Winston 日志库并配置
8. 创建目录结构
9. 配置环境变量管理

**验证标准**:
- [ ] `npm run lint` 通过
- [ ] `npm run type-check` 通过
- [ ] `npm run test` 运行（空测试通过）
- [ ] `npm run format` 工作正常
- [ ] 目录结构符合规范

**需要确认**: Ken，这个基础配置你满意吗？有没有需要调整的地方？

---

### Step 0.2: 核心类型定义
**目标**: 定义所有子系统的 TypeScript 接口

**详细逻辑**:
1. 定义 Identity 接口（id, name, version, evolutionStage）
2. 定义 Body 接口（sensors, actuators, resources）
3. 定义 WorldModel 接口（patterns, risks, opportunities, capabilities）
4. 定义 CognitiveState 接口（hormoneLevels, mode, goals, focus）
5. 定义 Tool 接口（name, confidence, lastUsed, successRate）
6. 定义 Memory 接口（分层记忆的统一接口）
7. 定义错误类型 OuroborosError
8. 定义事件类型

**验证标准**:
- [ ] 所有接口都有完整的中文注释
- [ ] 接口通过 TypeScript 编译
- [ ] 类型之间关系正确

---

### Step 0.3: 日志和错误处理基础设施
**目标**: 实现统一的日志和错误处理

**详细逻辑**:
1. 实现 Winston logger 配置
2. 实现日志分级（error/warn/info/debug/trace）
3. 实现日志文件轮转
4. 实现 OuroborosError 类
5. 实现全局错误处理器
6. 实现 tryCatch 工具函数

**验证标准**:
- [ ] 日志能正确写入文件
- [ ] 错误能被正确捕获和记录
- [ ] 单元测试覆盖 100%

---

## Phase 1: 统一自我描述系统（预计 4-5 天）

### Step 1.1: Identity 模块
**目标**: 实现身份认知组件

**详细逻辑**:
1. 实现 Identity 类
2. 属性：name, version, evolutionStage, createdAt
3. 方法：
   - `getIdentity()`: 返回身份信息
   - `updateVersion(newVersion)`: 更新版本
   - `advanceStage()`: 进化到下一阶段
   - `generateIdentityPrompt()`: 生成身份描述文本
4. 持久化到 SQLite

**验证标准**:
- [ ] 身份信息能正确保存和读取
- [ ] 版本更新有日志记录
- [ ] 生成的提示词文本正确
- [ ] 单元测试覆盖所有方法

---

### Step 1.2: Body 模块
**目标**: 实现身体图式组件

**详细逻辑**:
1. 实现 Body 类
2. 实现传感器管理：
   - `addSensor(name, type, status)`: 添加传感器
   - `removeSensor(name)`: 移除传感器
   - `updateSensorStatus(name, status)`: 更新状态
   - `getActiveSensors()`: 获取活跃传感器
3. 实现执行器管理：
   - `addActuator(name, type)`: 添加执行器
   - `executeAction(actuator, action)`: 执行动作
4. 实现资源监控：
   - `updateResources()`: 更新 CPU/内存/磁盘
   - `getResourceStatus()`: 获取资源状态
5. 生成身体图式描述文本

**验证标准**:
- [ ] 传感器能正确添加和更新
- [ ] 资源数据准确（对比系统实际数据）
- [ ] 生成的提示词包含所有传感器
- [ ] 单元测试 + 集成测试

---

### Step 1.3: WorldModel 模块
**目标**: 实现世界模型组件

**详细逻辑**:
1. 实现 WorldModel 类
2. 模式管理：
   - `addPattern(pattern, confidence)`: 添加模式
   - `getPatterns(minConfidence)`: 获取符合条件的模式
   - `updatePatternConfidence(id, delta)`: 更新置信度
3. 风险管理：
   - `addRisk(risk, severity)`: 添加风险
   - `resolveRisk(id)`: 解决风险
   - `getActiveRisks()`: 获取活跃风险
4. 机会管理：
   - `addOpportunity(opp, potential)`: 添加机会
   - `getOpportunities()`: 获取机会列表
5. 能力评估：
   - `updateCapability(name, level)`: 更新能力水平
   - `getCapability(name)`: 获取能力

**验证标准**:
- [ ] 模式能正确添加和查询
- [ ] 风险状态管理正确
- [ ] 生成的提示词包含关键模式和风险
- [ ] 单元测试覆盖

---

### Step 1.4: CognitiveState 模块
**目标**: 实现认知状态组件（激素系统的基础）

**详细逻辑**:
1. 实现 CognitiveState 类
2. 激素水平管理（临时简单实现，完整激素系统在后面）：
   - `updateHormone(name, value, reason)`: 更新激素
   - `getHormoneLevels()`: 获取所有激素水平
   - `getDominantHormone()`: 获取主导激素
3. 模式管理：
   - `setMode(mode)`: 设置模式 (serving/evolving/reflection)
   - `getMode()`: 获取当前模式
4. 目标管理：
   - `setGoal(goal, priority)`: 设置目标
   - `getCurrentGoal()`: 获取当前目标
   - `completeGoal(id)`: 完成目标
5. 专注度管理：
   - `updateFocus(value)`: 更新专注度
   - `getFocus()`: 获取专注度

**验证标准**:
- [ ] 激素更新有边界检查 (0-1)
- [ ] 模式切换记录日志
- [ ] 生成的提示词包含当前模式
- [ ] 单元测试

---

### Step 1.5: ToolSet 模块
**目标**: 实现工具集组件

**详细逻辑**:
1. 实现 ToolSet 类
2. 工具注册：
   - `registerTool(tool)`: 注册工具
   - `unregisterTool(name)`: 注销工具
3. 工具置信度：
   - `updateConfidence(name, success)`: 基于使用结果更新
   - `getConfidence(name)`: 获取置信度
   - `getToolsByConfidence(min)`: 按置信度筛选
4. 工具描述生成：
   - `generateToolPrompt()`: 生成工具列表描述
5. 支持内置工具和 MCP 工具

**验证标准**:
- [ ] 工具能正确注册和注销
- [ ] 置信度更新逻辑正确（贝叶斯基础）
- [ ] 生成的提示词包含工具列表和置信度
- [ ] 单元测试

---

### Step 1.6: UnifiedSelfDescription 整合
**目标**: 整合所有组件，实现统一的自我描述

**详细逻辑**:
1. 整合所有组件：
   ```typescript
   class UnifiedSelfDescription {
     identity: Identity;
     body: Body;
     worldModel: WorldModel;
     cognitiveState: CognitiveState;
     toolSet: ToolSet;
   }
   ```
2. 实现初始化：
   - `initialize()`: 从持久化加载或创建默认
3. 实现描述生成：
   - `generateSelfDescription()`: 生成完整的自我描述
   - `generateSelfPrompt()`: 生成用于 LLM 的提示词
4. 实现序列化：
   - `toJSON()`: 导出为 JSON
   - `fromJSON(data)`: 从 JSON 加载
5. 实现变更监听：
   - `onChange(callback)`: 监听任何变化

**验证标准**:
- [ ] 所有组件正确初始化
- [ ] 生成的自我描述包含所有部分
- [ ] 提示词格式正确
- [ ] 能正确持久化和恢复
- [ ] 单元测试 + 集成测试

**里程碑 1**: 统一自我描述系统完成

---

## Phase 2: 激素系统（预计 3-4 天）

### Step 2.1: 激素模型实现
**目标**: 实现完整的激素调节模型

**详细逻辑**:
1. 定义激素类型：
   - Adrenaline (肾上腺素): 警觉/紧急响应
   - Cortisol (皮质醇): 压力/资源紧张
   - Dopamine (多巴胺): 奖励/学习动力
   - Serotonin (血清素): 稳定/情绪调节
   - Curiosity (好奇心): 探索/学习欲望
2. 实现 Hormone 类：
   - `value`: 当前水平 (0-1)
   - `baseline`: 基线水平
   - `decayRate`: 自然衰减率
   - `halfLife`: 半衰期
3. 实现调节机制：
   - `increase(amount, reason)`: 增加（瞬时）
   - `decrease(amount, reason)`: 减少（瞬时）
   - `naturalDecay()`: 自然衰减
   - `returnToBaseline()`: 回归基线
4. 实现相互作用：
   - 高 Cortisol 抑制 Dopamine
   - 高 Dopamine 提升 Serotonin
   - 等等

**验证标准**:
- [ ] 激素值始终在 0-1 范围内
- [ ] 自然衰减计算正确
- [ ] 相互作用逻辑正确
- [ ] 所有变化记录日志
- [ ] 单元测试覆盖所有场景

---

### Step 2.2: 触发器系统
**目标**: 实现激素变化的自动触发

**详细逻辑**:
1. 定义触发器类型：
   - TaskSuccess: 任务成功 → Dopamine+
   - TaskFailure: 任务失败 → Cortisol+
   - SystemOverload: 系统过载 → Cortisol+, Adrenaline+
   - SecurityThreat: 安全威胁 → Adrenaline+
   - Novelty: 新奇事物 → Curiosity+
   - Routine: 例行公事 → Serotonin+
2. 实现 TriggerEngine：
   - `registerTrigger(condition, hormone, amount)`: 注册触发器
   - `evaluateTriggers(context)`: 评估所有触发器
   - `fireTrigger(name, context)`: 触发特定激素变化
3. 与事件系统集成：
   - 监听系统事件
   - 自动评估和触发

**验证标准**:
- [ ] 触发器能正确注册和触发
- [ ] 事件能正确引起激素变化
- [ ] 触发有防抖动机制
- [ ] 单元测试

---

### Step 2.3: HormoneSystem 整合
**目标**: 整合激素模型和触发器

**详细逻辑**:
1. 实现 HormoneSystem 类：
   - 管理所有激素实例
   - 运行触发器引擎
   - 定期执行自然衰减
2. 实现与 CognitiveState 的集成：
   - 激素变化时更新 CognitiveState
   - 生成激素状态描述
3. 实现持久化：
   - 保存激素历史
   - 加载时恢复状态
4. 实现 API：
   - `/api/hormones`: 获取当前水平
   - `/api/hormones/history`: 获取历史数据

**验证标准**:
- [ ] 所有激素能同时管理
- [ ] 激素变化实时反映到提示词
- [ ] 历史数据正确保存
- [ ] API 工作正常
- [ ] 单元测试 + 集成测试

**里程碑 2**: 激素系统完成

---

## Phase 3: 分层记忆系统（预计 5-6 天）

### Step 3.1: 基础记忆存储
**目标**: 实现底层记忆存储机制

**详细逻辑**:
1. 设计记忆存储接口：
   ```typescript
   interface Memory {
     id: string;
     type: 'episodic' | 'semantic' | 'procedural' | 'reflective';
     content: any;
     timestamp: Date;
     importance: number;
     embedding?: number[];
     metadata: Record<string, any>;
   }
   ```
2. 实现 MemoryStore 基类：
   - `save(memory)`: 保存记忆
   - `get(id)`: 获取记忆
   - `query(filter)`: 查询记忆
   - `delete(id)`: 删除记忆
3. 实现 SQLite 持久化
4. 实现向量索引（使用已有的 nomic-embed-text）

**验证标准**:
- [ ] 记忆能正确保存和读取
- [ ] 支持向量搜索
- [ ] 性能满足要求（查询 < 100ms）
- [ ] 单元测试

---

### Step 3.2: 情景记忆 (Episodic Memory)
**目标**: 实现事件和对话记忆

**详细逻辑**:
1. 实现 EpisodicMemory 类：
   - `recordEvent(event)`: 记录事件
   - `recordConversation(userMsg, aiMsg, metadata)`: 记录对话
2. 实现时间检索：
   - `getRecent(hours)`: 获取最近记忆
   - `getByTimeRange(start, end)`: 按时间范围查询
3. 实现压缩机制：
   - 当记忆数量超过阈值时，压缩旧记忆
   - 保留关键信息，删除细节
4. 与聊天系统集成

**验证标准**:
- [ ] 对话能正确记录
- [ ] 时间查询准确
- [ ] 压缩机制工作正常
- [ ] 单元测试

---

### Step 3.3: 语义记忆 (Semantic Memory)
**目标**: 实现知识和事实记忆

**详细逻辑**:
1. 实现 SemanticMemory 类：
   - `addFact(key, value, confidence)`: 添加事实
   - `getFact(key)`: 获取事实
   - `updateFact(key, value)`: 更新事实
2. 实现向量检索：
   - `searchSimilar(query, topK)`: 语义搜索
   - 使用 nomic-embed-text 生成 embedding
3. 实现冲突处理：
   - 当新事实与旧事实冲突时，标记并记录
4. 实现置信度更新：
   - 基于验证次数更新置信度

**验证标准**:
- [ ] 语义搜索准确
- [ ] 相似度排序正确
- [ ] 冲突检测有效
- [ ] 单元测试

---

### Step 3.4: 程序记忆 (Procedural Memory)
**目标**: 实现技能和流程记忆

**详细逻辑**:
1. 实现 ProceduralMemory 类：
   - `recordSkill(name, steps, successRate)`: 记录技能
   - `getSkill(name)`: 获取技能
   - `updateSkillSuccess(name, success)`: 更新成功率
2. 实现技能检索：
   - `getSkillsByTag(tag)`: 按标签查询
   - `getTopSkills(n)`: 获取最常用技能
3. 与 ToolSet 集成：
   - 技能与工具关联
   - 使用技能时更新工具置信度

**验证标准**:
- [ ] 技能能正确记录和检索
- [ ] 成功率统计准确
- [ ] 与工具集成正常
- [ ] 单元测试

---

### Step 3.5: 反思记忆 (Reflective Memory)
**目标**: 实现洞察和模式记忆

**详细逻辑**:
1. 实现 ReflectiveMemory 类：
   - `recordInsight(insight, source, confidence)`: 记录洞察
   - `getInsights(topic)`: 按主题查询
   - `getPatterns()`: 获取识别的模式
2. 实现重要性评估：
   - 自动评估洞察的重要性
   - 高重要性洞察优先保留
3. 与反思引擎集成（后续步骤）

**验证标准**:
- [ ] 洞察能正确记录
- [ ] 重要性评估合理
- [ ] 单元测试

---

### Step 3.6: MemorySystem 整合
**目标**: 整合所有记忆类型

**详细逻辑**:
1. 实现 MemorySystem 类：
   - 管理所有记忆类型实例
   - 提供统一的存储接口
2. 实现跨类型检索：
   - `query(query, types)`: 跨类型查询
   - 优先返回高重要性结果
3. 实现遗忘机制：
   - 基于重要性、时间、使用频率决定遗忘
   - 低重要性旧记忆优先遗忘
4. 实现记忆提示词生成：
   - `generateMemoryPrompt(context)`: 生成相关记忆描述
5. 实现 API：
   - `/api/memory`: 记忆管理
   - `/api/memory/search`: 记忆搜索

**验证标准**:
- [ ] 所有记忆类型统一管理
- [ ] 跨类型查询工作正常
- [ ] 遗忘机制合理
- [ ] 提示词包含相关记忆
- [ ] 单元测试 + 集成测试

**里程碑 3**: 分层记忆系统完成

---

## Phase 4: 贝叶斯认知核心（预计 2-3 天）

### Step 4.1: 贝叶斯更新实现
**目标**: 实现置信度的贝叶斯更新

**详细逻辑**:
1. 实现贝叶斯更新函数：
   ```typescript
   function bayesianUpdate(
     prior: number,      // 先验置信度
     likelihood: number, // 似然
     evidence: number    // 证据
   ): number {
     return (likelihood * prior) / evidence;
   }
   ```
2. 实现 Beta 分布：
   - 使用 Beta 分布建模二项分布的共轭先验
   - 参数 α (成功次数), β (失败次数)
   - 均值 = α / (α + β)
   - 方差 = αβ / ((α+β)²(α+β+1))
3. 实现置信度计算：
   - 基于历史成功/失败次数
   - 计算置信度和不确定性

**验证标准**:
- [ ] 贝叶斯更新数学正确
- [ ] 置信度随使用收敛
- [ ] 单元测试覆盖数学计算

---

### Step 4.2: BayesianCore 整合
**目标**: 整合到 ToolSet 和技能系统

**详细逻辑**:
1. 实现 BayesianCore 类：
   - `updateToolConfidence(tool, success)`: 更新工具置信度
   - `getToolConfidence(tool)`: 获取置信度和不确定性
   - `shouldUseTool(tool, threshold)`: 判断是否应使用
2. 与 ToolSet 集成：
   - 工具注册时初始化 Beta 分布
   - 使用后自动更新
3. 实现探索-利用平衡：
   - 对新工具给予探索机会
   - 对高置信度工具优先使用

**验证标准**:
- [ ] 工具置信度更新正确
- [ ] 探索-利用平衡合理
- [ ] 单元测试

**里程碑 4**: 贝叶斯认知核心完成

---

## Phase 5: 反思引擎（预计 4-5 天）

### Step 5.1: 反思触发器
**目标**: 实现反思的自动触发

**详细逻辑**:
1. 实现触发器：
   - `schedule`: 定期触发（如每30分钟）
   - `performanceDrop`: 性能下降时
   - `anomaly`: 检测到异常时
   - `manual`: 手动触发
2. 实现触发器引擎：
   - 监控性能指标
   - 检测异常模式
   - 触发反思流程

**验证标准**:
- [ ] 触发器能正确触发
- [ ] 性能监控准确
- [ ] 单元测试

---

### Step 5.2: 反思分析
**目标**: 实现反思的分析逻辑

**详细逻辑**:
1. 实现性能分析：
   - 分析最近任务的执行时间和成功率
   - 识别性能下降的模式
2. 实现记忆分析：
   - 扫描最近的对话和事件
   - 识别重复出现的问题
3. 实现事件分析：
   - 分析系统事件日志
   - 识别异常模式
4. 生成洞察：
   - `Pattern`: 发现的模式
   - `Problem`: 发现的问题
   - `Opportunity`: 发现的机会

**验证标准**:
- [ ] 性能分析准确
- [ ] 能识别真实问题
- [ ] 生成的洞察有价值
- [ ] 单元测试

---

### Step 5.3: 反思执行
**目标**: 应用反思结果到自我描述

**详细逻辑**:
1. 实现 ReflectionEngine 类：
   - `reflect(context)`: 执行完整反思流程
   - `applyChanges(result)`: 应用反思结果
2. 实现审批模式：
   - `auto`: 自动应用
   - `conservative`: 只应用高置信度变更
   - `human`: 等待人工批准
3. 记录变更历史：
   - 所有变更都有记录
   - 支持回滚

**验证标准**:
- [ ] 反思能正确执行
- [ ] 变更应用正确
- [ ] 审批模式工作正常
- [ ] 单元测试 + 集成测试

**里程碑 5**: 反思引擎完成

---

## Phase 6: 自我进化系统（预计 6-8 天）

### Step 6.1: 软自指 - 提示词优化
**目标**: 实现通过修改提示词优化行为

**详细逻辑**:
1. 实现三类提示词管理：
   - System Prompt (安全约束，只读)
   - Self Prompt (身份、状态，可优化)
   - Memory Prompt (动态组装)
2. 实现优化策略：
   - `REDUCE_RISK`: 降低风险偏好
   - `INCREASE_EXPLORATION`: 增加探索
   - `IMPROVE_TOKEN_EFFICIENCY`: 提高Token效率
   - `ENHANCE_MEMORY_RETRIEVAL`: 增强记忆检索
   - `ADJUST_VERBOSITY`: 调整详细程度
3. 实现 A/B 测试基础：
   - 创建变体
   - 记录性能
   - 比较结果

**验证标准**:
- [ ] 提示词能正确修改
- [ ] 优化策略有效
- [ ] A/B 测试基础工作正常
- [ ] 单元测试

---

### Step 6.2: 硬自指 - 代码修改（简化版）
**目标**: 实现安全的代码自我修改

**详细逻辑**:
1. 实现静态代码分析：
   - 检测危险模式
   - 评估修改风险
2. 实现安全流程：
   - 创建备份
   - 沙箱测试
   - 健康检查
   - 自动回滚
3. **简化范围**: 初期只允许修改配置文件和提示词模板

**验证标准**:
- [ ] 危险模式能正确检测
- [ ] 安全流程完整
- [ ] 回滚机制工作正常
- [ ] 单元测试

---

### Step 6.3: A/B 测试系统
**目标**: 实现完整的 A/B 测试

**详细逻辑**:
1. 实现 Variant 管理：
   - 创建变体
   - 分配流量
2. 实现测试执行：
   - 并行运行多个变体
   - 记录性能指标
3. 实现结果评估：
   - 统计显著性检验
   - 选择胜者
4. 实现自动切换：
   - 胜者优先使用
   - 败者归档

**验证标准**:
- [ ] 变体能正确创建和运行
- [ ] 统计检验正确
- [ ] 自动切换工作正常
- [ ] 单元测试 + 集成测试

**里程碑 6**: 自我进化系统完成

---

## Phase 7: Web 界面和监控（预计 3-4 天）

### Step 7.1: 后端 API 完善
**目标**: 实现完整的 REST API

**详细逻辑**:
1. 实现聊天 API：
   - POST /api/chat: 普通聊天
   - POST /api/chat/stream: 流式聊天
   - 正确使用提示词组装
2. 实现监控 API：
   - GET /api/status: 系统状态
   - GET /api/hormones: 激素水平
   - GET /api/memory: 记忆查询
   - GET /api/logs: 系统日志
   - GET /api/prompts: 提示词查看
3. 实现管理 API：
   - POST /api/memory: 添加记忆
   - POST /api/reflection/trigger: 触发反思

**验证标准**:
- [ ] 所有 API 工作正常
- [ ] 使用统一自我描述生成提示词
- [ ] 集成测试覆盖

---

### Step 7.2: 前端界面
**目标**: 实现功能完整的前端

**详细逻辑**:
1. 聊天界面：
   - 显示对话历史
   - 支持流式响应
   - 显示思考过程（Think标签）
2. 监控界面：
   - 实时显示系统指标
   - 显示激素水平（真实数据）
   - 显示记忆状态
   - 显示当前提示词
   - 显示系统日志
3. 管理界面：
   - 添加记忆
   - 触发反思
   - 查看自我描述

**验证标准**:
- [ ] 界面美观、响应式
- [ ] 数据实时更新
- [ ] 所有功能可用
- [ ] 端到端测试

**里程碑 7**: 完整系统完成

---

## Phase 8: 测试和优化（预计 4-5 天）

### Step 8.1: 单元测试完善
**目标**: 核心模块测试覆盖 > 80%

**验证标准**:
- [ ] 所有核心类都有单元测试
- [ ] 边界条件覆盖
- [ ] 错误路径覆盖

---

### Step 8.2: 集成测试
**目标**: 关键流程有集成测试

**验证标准**:
- [ ] 对话流程测试
- [ ] 反思流程测试
- [ ] 进化流程测试

---

### Step 8.3: 端到端测试
**目标**: 完整用户场景测试

**验证标准**:
- [ ] 用户聊天场景
- [ ] 系统监控场景
- [ ] 自我进化场景

---

### Step 8.4: 性能优化
**目标**: 系统性能满足要求

**验证标准**:
- [ ] 聊天响应 < 2秒
- [ ] 记忆查询 < 100ms
- [ ] 内存使用稳定

---

## 总时间估算

| Phase | 时间 | 里程碑 |
|-------|------|--------|
| Phase 0: 基础架构 | 2-3 天 | 项目骨架完成 |
| Phase 1: 统一自我描述 | 4-5 天 | 核心组件完成 |
| Phase 2: 激素系统 | 3-4 天 | 情感模拟完成 |
| Phase 3: 分层记忆 | 5-6 天 | 记忆系统完成 |
| Phase 4: 贝叶斯核心 | 2-3 天 | 认知核心完成 |
| Phase 5: 反思引擎 | 4-5 天 | 反思能力完成 |
| Phase 6: 自我进化 | 6-8 天 | 进化能力完成 |
| Phase 7: Web界面 | 3-4 天 | 界面完成 |
| Phase 8: 测试优化 | 4-5 天 | 系统稳定 |
| **总计** | **33-43 天** | **完整系统** |

---

## 下一步

Ken，我已经制定了详细的 roadmap。

**请你确认**:
1. 这个 roadmap 的结构和详细程度是否符合你的要求？
2. 各 Phase 的优先级是否需要调整？
3. 是否有功能需要删减或增加？
4. 时间估算是否合理？

**确认后**，我将从 Phase 0 Step 0.1 开始，严格按照规范一步步实现。
每一步完成后，我会：
1. 提交代码
2. 运行测试
3. 报告完成的功能和验证结果
4. 等待你的确认后再进行下一步

请审阅 roadmap 并给出反馈。
