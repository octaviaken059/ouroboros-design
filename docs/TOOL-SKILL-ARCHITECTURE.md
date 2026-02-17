# 工具与技能架构 v2.0

## 核心概念：滑雪板 vs 滑雪技术

```
工具 (Tool)                        技能 (Skill)
===========                        =============
外部资源                           内部能力
可替换、可发现                     学习获得、经验积累
直接调用                           应用解法
升级/替换                          练习/反思提升

类比：                             类比：
滑雪板                            滑雪技术
- 可换不同板                      - 需要练习掌握
- 影响性能上限                    - 决定实际表现
- 外部装备                        - 个人能力
```

## 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                     Tool & Skill Manager                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                        工具 (Tools)                        │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │ │
│  │  │ CLI     │ │ API     │ │ MCP     │ │Hardware │         │ │
│  │  │ffmpeg   │ │OpenAI   │ │Puppeteer│ │Camera   │         │ │
│  │  │git      │ │Google   │ │SQLite   │ │Sensor   │         │ │
│  │  │docker   │ │Stripe   │ │GitHub   │ │Driver   │         │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │ │
│  │                                                             │ │
│  │  属性: name, type, source, capabilities, confidence        │ │
│  │  加载: critical/high/medium/low/on_demand                  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                       技能 (Skills)                        │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │ │
│  │  │ Technical   │ │ Domain      │ │ Meta        │         │ │
│  │  │ Coding      │ │ Web Dev     │ │ Self-Improve│         │ │
│  │  │ Debugging   │ │ Data Analys │ │ Tool Integ  │         │ │
│  │  │ Refactoring │ │ Browser Aut │ │ Skill Comp  │         │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘         │ │
│  │                                                             │ │
│  │  属性: name, type, level, mastery, experience              │ │
│  │  实现: pattern | algorithm | workflow | hybrid             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                      按需加载机制                          │ │
│  │                                                             │ │
│  │  输入: context, intent, topic, maxTools, maxSkills         │ │
│  │     ↓                                                       │ │
│  │  匹配: critical(必选) → intent匹配 → topic匹配              │ │
│  │     ↓                                                       │ │
│  │  输出: LoadResult {tools[], skills[], reasoning[]}         │ │
│  │                                                             │ │
│  │  节省: 从 80+ 项 → 5-10 项 (节省 ~90% token)               │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│              Unified Self-Description v2                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  动态生成自我描述:                                               │
│  ─────────────────                                               │
│  "I have 5 tools available for this task:"                      │
│  "- ffmpeg (95% confidence) - Video processing"                 │
│  "- puppeteer (88% confidence) - Browser automation"            │
│  ""                                                             │
│  "And 3 relevant skills:"                                        │
│  "- Video Editing [intermediate, 72% mastery]"                  │
│  "- Web Scraping [advanced, 85% mastery]"                       │
│  ""                                                             │
│  "Reason: Task involves video + web interaction"                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 分类体系

### 工具分类 (Tool Categories)

```
system/                    # 系统工具
  file/                    # 文件操作
  process/                 # 进程管理
  network/                 # 网络工具

dev/                       # 开发工具
  vcs/                     # 版本控制
  build/                   # 构建工具
  test/                    # 测试工具

ai/                        # AI/ML工具
  llm/                     # 大语言模型
  vision/                  # 视觉AI
  voice/                   # 语音AI

data/                      # 数据工具
  db/                      # 数据库
  analysis/                # 数据分析

content/                   # 内容创作
  image/                   # 图像生成
  video/                   # 视频处理
  audio/                   # 音频处理

mcp/                       # MCP工具
  browser/                 # 浏览器MCP
  fs/                      # 文件系统MCP

hardware/                  # 硬件工具
  camera/                  # 摄像头
  sensor/                  # 传感器
```

### 技能分类 (Skill Categories)

```
fundamental/               # 基础技能
  logic/                   # 逻辑推理
  plan/                    # 任务规划

coding/                    # 编程技能
  js/                      # JavaScript/TypeScript
  py/                      # Python
  go/                      # Go
  web/                     # Web开发

data/                      # 数据技能
  sql/                     # SQL
  stats/                   # 统计分析
  viz/                     # 数据可视化

automation/                # 自动化技能
  browser/                 # 浏览器自动化
  script/                  # 脚本自动化

content/                   # 内容创作
  write/                   # 写作
  design/                  # 设计

meta/                      # 元技能
  learning/                # 持续学习
  integration/             # 工具集成
  composition/             # 技能组合
```

## 按需加载策略

### 加载优先级

| 优先级 | 说明 | 示例 |
|--------|------|------|
| **critical** | 关键工具，总是加载 | openai_api, git, core skills |
| **high** | 高频使用，大概率加载 | file operations, web_search |
| **medium** | 中等优先级 | docker, database tools |
| **low** | 低频使用 | specialized dev tools |
| **on_demand** | 按需加载 | video processing, browser automation |

### 加载流程

```
用户输入: "分析这个销售数据报表"
    │
    ▼
┌────────────────────────────────────────┐
│ 1. 意图识别: "data analysis"           │
│ 2. 主题提取: "data"                    │
└──────────────┬─────────────────────────┘
               │
               ▼
┌────────────────────────────────────────┐
│ loadOnDemand()                         │
│ ─────────────────                      │
│                                        │
│ Step 1: 加载所有 critical 项           │
│   ✓ openai_api (critical tool)         │
│   ✓ self_reflection (critical skill)   │
│                                        │
│ Step 2: intent匹配 "data analysis"     │
│   ✓ pandas (data tool)                 │
│   ✓ data_analysis (skill)              │
│   ✓ sql_query (skill)                  │
│                                        │
│ Step 3: topic匹配 "data"               │
│   ✓ sqlite (db tool)                   │
│   ✓ data_visualization (skill)         │
│                                        │
│ Step 4: 去重 + 截断到 max 限制         │
│                                        │
│ Result: 6 items loaded                 │
└────────────────────────────────────────┘
    │
    ▼
生成自我描述:
"I have 6 relevant capabilities for data analysis:
 Tools: openai_api, pandas, sqlite
 Skills: self_reflection, data_analysis, sql_query
 Reason: Matched by intent 'data analysis' and topic 'data'"
```

## 工具 vs 技能对比

| 维度 | 工具 (Tool) | 技能 (Skill) |
|------|-------------|--------------|
| **本质** | 外部资源 | 内部能力 |
| **类比** | 滑雪板 | 滑雪技术 |
| **来源** | 系统发现、安装、API | 学习、练习、反思 |
| **存储** | 路径、URL、配置 | 知识、模式、经验 |
| **使用** | 直接调用 | 应用解法 |
| **改进** | 升级版本、替换 | 练习积累、反思优化 |
| **置信度** | 成功率统计 | 掌握度评估 |
| **依赖** | 可用性检查 | 前置技能/工具 |
| **表示** | `name(confidence%)` | `name[level, mastery%]` |

## 反思驱动发现

```
记忆流:
  "User asked to convert video to GIF"
  "Failed: ffmpeg not found"
  "User mentioned using puppeteer"
    │
    ▼
反思 (reflect):
  ├─ 发现工具提及
  │   └─ puppeteer 未注册 → 建议集成
  │
  ├─ 发现失败模式
  │   └─ 视频处理失败 → 建议获取ffmpeg
  │
  └─ 更新世界模型
      └─ patterns: "User frequently needs media processing"
          │
          ▼
按需加载配置更新:
  loadPriority of 'ffmpeg' → 'high'
  
下次用户请求视频相关:
  ffmpeg 自动加载
```

## Token 节省效果

```
场景: Agent有100个工具和50个技能

全量加载:
  工具: 100 × 30 tokens = 3,000 tokens
  技能: 50 × 40 tokens = 2,000 tokens
  总计: ~5,000 tokens

按需加载 (加载10%):
  工具: 10 × 30 tokens = 300 tokens
  技能: 5 × 40 tokens = 200 tokens
  总计: ~500 tokens

节省: 90% token 消耗
```

## 代码示例

### 注册工具

```typescript
// 工具 - 外部资源
manager.registerTool({
  name: 'ffmpeg',
  displayName: 'FFmpeg',
  description: '音视频处理',
  type: ToolType.CLI,
  category: 'content.video',
  source: { type: 'system', location: '/usr/bin/ffmpeg' },
  capabilities: ['convert', 'extract', 'merge'],
  loadPriority: 'on_demand',  // 按需加载
  autoLoad: false,
});
```

### 注册技能

```typescript
// 技能 - 内部能力
manager.registerSkill({
  name: 'video_editing',
  displayName: '视频编辑',
  description: '使用FFmpeg进行视频处理',
  type: SkillType.CONTENT_CREATION,
  category: 'content',
  level: 'intermediate',
  experience: 3500,
  requires: {
    tools: ['tool.content.video.ffmpeg'],  // 依赖ffmpeg
  },
  implementation: {
    type: 'workflow',
    workflow: ['分析需求', '选择参数', '执行处理', '验证结果'],
  },
  loadPriority: 'on_demand',
});
```

### 按需加载

```typescript
const result = self.loadCapabilities({
  context: '剪辑视频',
  intent: 'video editing',
  topic: 'video',
  maxTools: 5,
  maxSkills: 3,
});

console.log(result.tools);   // [ffmpeg, canvas, ...]
console.log(result.skills);  // [video_editing, ...]
console.log(result.reasoning); // ["Matched by intent"]
```

### 生成自我描述

```typescript
const description = self.generateSelfDescription();
// 输出:
// ## Available Capabilities
// 
// ### Tools (External Resources)
// **content:**
// - FFmpeg (95% confidence) - 音视频处理
// - Canvas API (90% confidence) - 图像生成
// 
// ### Skills (Internal Capabilities)
// **content:**
// - 视频编辑 [intermediate, 72% mastery] - 使用FFmpeg...
// - 图像设计 [advanced, 85% mastery] - 使用Canvas...
// 
// ### Selection Reasoning
// - Loaded 2 critical tools
// - Matched by intent "video editing"
// - Estimated relevance: 92%
```

## 文件清单

| 文件 | 大小 | 说明 |
|------|------|------|
| `tool-skill-manager.ts` | 24KB | 核心管理器 |
| `tool-skill-examples.ts` | 14KB | 使用示例 |
| `unified-self-description-v2.ts` | 16KB | 统一自我描述v2 |
| `unified-self-description-v2-examples.ts` | 8KB | v2示例 |

## 集成到Ouroboros

```typescript
// 在 EnhancedUnifiedAgent 中使用
class EnhancedUnifiedAgent {
  private selfDescription: UnifiedSelfDescriptionV2;
  private toolSkillManager: ToolSkillManager;

  async processUserMessage(message: string) {
    // 1. 分析意图和主题
    const intent = this.inferIntent(message);
    const topic = this.inferTopic(message);

    // 2. 按需加载能力
    const capabilities = this.selfDescription.loadCapabilities({
      context: message,
      intent,
      topic,
      maxTools: 5,
      maxSkills: 3,
    });

    // 3. 生成包含加载能力的自我描述
    const selfPrompt = this.selfDescription.generateSelfDescription();

    // 4. 组装完整提示词
    const prompt = `${selfPrompt}\n\nUser: ${message}`;

    // 5. 调用LLM
    const response = await llm.generate(prompt);

    // 6. 记录性能，触发反思
    await this.selfDescription.reflect({
      recentMemories: [...],
      performanceMetrics: [{success: true, ...}],
      trigger: 'scheduled',
    });

    return response;
  }
}
```
