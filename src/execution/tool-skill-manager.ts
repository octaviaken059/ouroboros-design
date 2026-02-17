/**
 * 工具与技能管理系统 (Tool & Skill Management System)
 * 
 * 核心理念：
 * - 工具 (Tool): 外部资源 - 滑雪板 (可替换、可发现)
 * - 技能 (Skill): 内部能力 - 滑雪技术 (学习获得、经验积累)
 * 
 * 分类体系 + 按需加载 = 高效的自我描述
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// 类型定义
// ============================================================================

/** 工具类型 */
export enum ToolType {
  // 软件工具
  CLI = 'cli',           // 命令行工具 (ffmpeg, git, curl)
  LIBRARY = 'library',   // 代码库 (lodash, pandas)
  SERVICE = 'service',   // 在线服务 (OpenAI API, Google Search)
  
  // 硬件工具
  HARDWARE = 'hardware', // 硬件设备 (摄像头, 传感器)
  DRIVER = 'driver',     // 驱动程序
  
  // 协议工具
  MCP = 'mcp',           // Model Context Protocol
  API = 'api',           // 通用 API 接口
  SDK = 'sdk',           // 软件开发套件
}

/** 技能类型 */
export enum SkillType {
  // 认知技能
  REASONING = 'reasoning',     // 推理能力
  PLANNING = 'planning',       // 规划能力
  PROBLEM_SOLVING = 'problem_solving', // 问题解决
  
  // 技术技能
  CODING = 'coding',           // 编程
  DEBUGGING = 'debugging',     // 调试
  REFACTORING = 'refactoring', // 重构
  
  // 领域技能
  WEB_DEVELOPMENT = 'web_development',
  DATA_ANALYSIS = 'data_analysis',
  BROWSER_AUTOMATION = 'browser_automation',
  CONTENT_CREATION = 'content_creation',
  
  // 元技能
  SELF_IMPROVEMENT = 'self_improvement', // 自我改进
  TOOL_INTEGRATION = 'tool_integration', // 工具集成
  SKILL_COMPOSITION = 'skill_composition', // 技能组合
}

/** 工具定义 */
export interface Tool {
  // 基本信息
  id: string;
  name: string;
  displayName: string;
  description: string;
  type: ToolType;
  
  // 分类
  category: string;  // 分类ID (如 'content.video')
  tags: string[];
  
  // 来源信息
  source: {
    type: 'built_in' | 'system' | 'mcp' | 'discovered' | 'installed';
    location?: string;      // 安装路径/URL
    version?: string;
    discoveredAt?: string;
  };
  
  // 能力描述
  capabilities: string[];   // 能做什么
  inputs: ToolInput[];      // 输入参数
  outputs: ToolOutput[];    // 输出结果
  
  // 使用统计
  stats: {
    usageCount: number;
    successCount: number;
    failureCount: number;
    avgExecutionTime: number;
    lastUsedAt?: string;
  };
  
  // 状态
  status: 'available' | 'unavailable' | 'error' | 'deprecated';
  confidence: number;       // 0-1, 基于成功率
  
  // 加载控制
  loadPriority: 'critical' | 'high' | 'medium' | 'low' | 'on_demand';
  autoLoad: boolean;        // 是否自动加载到自我描述
}

/** 技能定义 */
export interface Skill {
  // 基本信息
  id: string;
  name: string;
  displayName: string;
  description: string;
  type: SkillType;
  
  // 分类
  category: string;  // 分类ID (如 'coding.web')
  tags: string[];
  
  // 能力层级
  level: 'novice' | 'intermediate' | 'advanced' | 'expert';
  experience: number;       // 经验值 (0-10000)
  
  // 依赖关系
  requires: {
    tools?: string[];       // 依赖的工具ID
    skills?: string[];      // 依赖的技能ID (前置技能)
    capabilities?: string[]; // 需要的基础能力
  };
  
  // 实现方式
  implementation: {
    type: 'pattern' | 'algorithm' | 'workflow' | 'hybrid';
    pattern?: string;       // 如果是模式，存储模式模板
    workflow?: string[];    // 如果是工作流，存储步骤
    algorithm?: string;     // 如果是算法，存储算法描述
  };
  
  // 使用统计
  stats: {
    usageCount: number;
    successRate: number;
    avgComplexity: number;  // 平均问题复杂度 (1-10)
    lastAppliedAt?: string;
  };
  
  // 状态
  status: 'learning' | 'active' | 'deprecated' | 'mastered';
  mastery: number;          // 掌握程度 0-1
  
  // 加载控制
  loadPriority: 'critical' | 'high' | 'medium' | 'low' | 'on_demand';
  autoLoad: boolean;
}

/** 工具分类 */
export interface ToolCategory {
  id: string;
  name: string;
  description: string;
  parent?: string;          // 父分类
  toolTypes: ToolType[];    // 包含的工具类型
}

/** 技能分类 */
export interface SkillCategory {
  id: string;
  name: string;
  description: string;
  parent?: string;
  skillTypes: SkillType[];
}

/** 工具输入定义 */
export interface ToolInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'file';
  description: string;
  required: boolean;
  default?: unknown;
  constraints?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
}

/** 工具输出定义 */
export interface ToolOutput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'file' | 'stream';
  description: string;
}

/** 按需加载配置 */
export interface LoadConfig {
  context: string;          // 当前上下文 (用户输入摘要)
  intent?: string;          // 推断的用户意图
  topic?: string;           // 当前主题
  maxTools: number;         // 最大加载工具数
  maxSkills: number;        // 最大加载技能数
  includePatterns: boolean; // 是否包含模式匹配
}

/** 加载结果 */
export interface LoadResult {
  tools: Tool[];
  skills: Skill[];
  reasoning: string[];      // 为什么加载这些
  estimatedRelevance: number; // 估计的相关度
}

// ============================================================================
// 预定义分类
// ============================================================================

export const TOOL_CATEGORIES: ToolCategory[] = [
  // 系统工具
  { id: 'system', name: '系统工具', description: '系统级基础工具', toolTypes: [ToolType.CLI] },
  { id: 'system.file', name: '文件操作', description: '文件读写管理', parent: 'system', toolTypes: [ToolType.CLI] },
  { id: 'system.process', name: '进程管理', description: '进程控制和监控', parent: 'system', toolTypes: [ToolType.CLI] },
  { id: 'system.network', name: '网络工具', description: '网络通信和诊断', parent: 'system', toolTypes: [ToolType.CLI] },
  
  // 开发工具
  { id: 'dev', name: '开发工具', description: '软件开发相关', toolTypes: [ToolType.CLI, ToolType.LIBRARY] },
  { id: 'dev.vcs', name: '版本控制', description: 'Git等版本控制', parent: 'dev', toolTypes: [ToolType.CLI] },
  { id: 'dev.build', name: '构建工具', description: '编译构建工具', parent: 'dev', toolTypes: [ToolType.CLI] },
  { id: 'dev.test', name: '测试工具', description: '自动化测试', parent: 'dev', toolTypes: [ToolType.CLI, ToolType.LIBRARY] },
  
  // AI/ML工具
  { id: 'ai', name: 'AI/ML工具', description: '人工智能和机器学习', toolTypes: [ToolType.SERVICE, ToolType.API] },
  { id: 'ai.llm', name: '大语言模型', description: 'LLM API和服务', parent: 'ai', toolTypes: [ToolType.SERVICE, ToolType.API] },
  { id: 'ai.vision', name: '视觉AI', description: '图像视频处理', parent: 'ai', toolTypes: [ToolType.SERVICE, ToolType.API] },
  { id: 'ai.voice', name: '语音AI', description: '语音合成识别', parent: 'ai', toolTypes: [ToolType.SERVICE, ToolType.API] },
  
  // 数据工具
  { id: 'data', name: '数据工具', description: '数据处理和分析', toolTypes: [ToolType.CLI, ToolType.LIBRARY, ToolType.SERVICE] },
  { id: 'data.db', name: '数据库', description: '数据库操作', parent: 'data', toolTypes: [ToolType.CLI, ToolType.SERVICE] },
  { id: 'data.analysis', name: '数据分析', description: '统计分析和可视化', parent: 'data', toolTypes: [ToolType.LIBRARY, ToolType.SERVICE] },
  
  // 内容创作
  { id: 'content', name: '内容创作', description: '多媒体内容生成', toolTypes: [ToolType.CLI, ToolType.SERVICE] },
  { id: 'content.image', name: '图像生成', description: 'AI图像生成', parent: 'content', toolTypes: [ToolType.SERVICE] },
  { id: 'content.video', name: '视频处理', description: '视频编辑处理', parent: 'content', toolTypes: [ToolType.CLI, ToolType.SERVICE] },
  { id: 'content.audio', name: '音频处理', description: '音频编辑合成', parent: 'content', toolTypes: [ToolType.CLI, ToolType.SERVICE] },
  
  // MCP工具
  { id: 'mcp', name: 'MCP工具', description: 'Model Context Protocol', toolTypes: [ToolType.MCP] },
  { id: 'mcp.browser', name: '浏览器MCP', description: '浏览器自动化', parent: 'mcp', toolTypes: [ToolType.MCP] },
  { id: 'mcp.fs', name: '文件系统MCP', description: '文件操作MCP', parent: 'mcp', toolTypes: [ToolType.MCP] },
  
  // 硬件工具
  { id: 'hardware', name: '硬件工具', description: '硬件设备和驱动', toolTypes: [ToolType.HARDWARE, ToolType.DRIVER] },
  { id: 'hw.camera', name: '摄像头', description: '图像捕捉设备', parent: 'hardware', toolTypes: [ToolType.HARDWARE] },
  { id: 'hw.sensor', name: '传感器', description: '环境传感器', parent: 'hardware', toolTypes: [ToolType.HARDWARE] },
];

export const SKILL_CATEGORIES: SkillCategory[] = [
  // 基础技能
  { id: 'fundamental', name: '基础技能', description: '基础认知和操作能力', skillTypes: [SkillType.REASONING, SkillType.PLANNING] },
  { id: 'fundamental.logic', name: '逻辑推理', description: '逻辑分析和推理', parent: 'fundamental', skillTypes: [SkillType.REASONING] },
  { id: 'fundamental.plan', name: '任务规划', description: '分解和规划任务', parent: 'fundamental', skillTypes: [SkillType.PLANNING] },
  
  // 编程技能
  { id: 'coding', name: '编程技能', description: '软件开发和编程', skillTypes: [SkillType.CODING] },
  { id: 'coding.js', name: 'JavaScript/TypeScript', description: 'JS/TS开发', parent: 'coding', skillTypes: [SkillType.CODING] },
  { id: 'coding.py', name: 'Python', description: 'Python开发', parent: 'coding', skillTypes: [SkillType.CODING] },
  { id: 'coding.go', name: 'Go', description: 'Go开发', parent: 'coding', skillTypes: [SkillType.CODING] },
  { id: 'coding.web', name: 'Web开发', description: '前端后端开发', parent: 'coding', skillTypes: [SkillType.WEB_DEVELOPMENT] },
  
  // 数据技能
  { id: 'data', name: '数据技能', description: '数据处理和分析', skillTypes: [SkillType.DATA_ANALYSIS] },
  { id: 'data.sql', name: 'SQL', description: '数据库查询', parent: 'data', skillTypes: [SkillType.DATA_ANALYSIS] },
  { id: 'data.stats', name: '统计分析', description: '统计方法和应用', parent: 'data', skillTypes: [SkillType.DATA_ANALYSIS] },
  { id: 'data.viz', name: '数据可视化', description: '图表和可视化', parent: 'data', skillTypes: [SkillType.DATA_ANALYSIS] },
  
  // 自动化技能
  { id: 'automation', name: '自动化技能', description: '流程和浏览器自动化', skillTypes: [SkillType.BROWSER_AUTOMATION] },
  { id: 'auto.browser', name: '浏览器自动化', description: '网页自动化操作', parent: 'automation', skillTypes: [SkillType.BROWSER_AUTOMATION] },
  { id: 'auto.script', name: '脚本自动化', description: '批处理和脚本', parent: 'automation', skillTypes: [SkillType.BROWSER_AUTOMATION] },
  
  // 内容创作技能
  { id: 'content', name: '内容创作', description: '多媒体内容生成', skillTypes: [SkillType.CONTENT_CREATION] },
  { id: 'content.write', name: '写作', description: '文本内容创作', parent: 'content', skillTypes: [SkillType.CONTENT_CREATION] },
  { id: 'content.design', name: '设计', description: '视觉设计', parent: 'content', skillTypes: [SkillType.CONTENT_CREATION] },
  
  // 元技能
  { id: 'meta', name: '元技能', description: '自我提升和系统技能', skillTypes: [SkillType.SELF_IMPROVEMENT, SkillType.TOOL_INTEGRATION] },
  { id: 'meta.learning', name: '持续学习', description: '新技能习得', parent: 'meta', skillTypes: [SkillType.SELF_IMPROVEMENT] },
  { id: 'meta.integration', name: '工具集成', description: '整合新工具', parent: 'meta', skillTypes: [SkillType.TOOL_INTEGRATION] },
  { id: 'meta.compose', name: '技能组合', description: '组合多个技能', parent: 'meta', skillTypes: [SkillType.SKILL_COMPOSITION] },
];

// ============================================================================
// 工具与技能管理器
// ============================================================================

export class ToolSkillManager extends EventEmitter {
  private tools: Map<string, Tool> = new Map();
  private skills: Map<string, Skill> = new Map();
  private dataDir: string;

  constructor(dataDir: string = './data/tool-skill') {
    super();
    this.dataDir = dataDir;
  }

  /**
   * 注册工具
   */
  registerTool(tool: Omit<Tool, 'id' | 'stats' | 'status' | 'confidence'>): Tool {
    const id = `tool.${tool.category}.${tool.name}`;
    
    const fullTool: Tool = {
      ...tool,
      id,
      stats: {
        usageCount: 0,
        successCount: 0,
        failureCount: 0,
        avgExecutionTime: 0,
      },
      status: 'available',
      confidence: 0.5, // 初始置信度
    };

    this.tools.set(id, fullTool);
    this.emit('toolRegistered', fullTool);
    
    return fullTool;
  }

  /**
   * 注册技能
   */
  registerSkill(skill: Omit<Skill, 'id' | 'stats' | 'status' | 'mastery'>): Skill {
    const id = `skill.${skill.category}.${skill.name}`;
    
    const fullSkill: Skill = {
      ...skill,
      id,
      stats: {
        usageCount: 0,
        successRate: 0,
        avgComplexity: 5,
      },
      status: 'learning',
      mastery: 0.1, // 初始掌握度
    };

    this.skills.set(id, fullSkill);
    this.emit('skillRegistered', fullSkill);
    
    return fullSkill;
  }

  /**
   * 获取工具
   */
  getTool(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  /**
   * 获取技能
   */
  getSkill(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  /**
   * 获取所有工具
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 获取所有技能
   */
  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * 按分类获取工具
   */
  getToolsByCategory(categoryId: string): Tool[] {
    return this.getAllTools().filter(t => 
      t.category === categoryId || t.category.startsWith(`${categoryId}.`)
    );
  }

  /**
   * 按分类获取技能
   */
  getSkillsByCategory(categoryId: string): Skill[] {
    return this.getAllSkills().filter(s => 
      s.category === categoryId || s.category.startsWith(`${categoryId}.`)
    );
  }

  /**
   * 按标签搜索
   */
  searchByTag(tag: string): { tools: Tool[]; skills: Skill[] } {
    return {
      tools: this.getAllTools().filter(t => t.tags.includes(tag)),
      skills: this.getAllSkills().filter(s => s.tags.includes(tag)),
    };
  }

  /**
   * 记录工具使用
   */
  recordToolUsage(toolId: string, success: boolean, executionTime: number): void {
    const tool = this.tools.get(toolId);
    if (!tool) return;

    tool.stats.usageCount++;
    tool.stats.lastUsedAt = new Date().toISOString();
    
    if (success) {
      tool.stats.successCount++;
    } else {
      tool.stats.failureCount++;
    }

    // 更新平均执行时间
    const oldAvg = tool.stats.avgExecutionTime;
    const count = tool.stats.usageCount;
    tool.stats.avgExecutionTime = (oldAvg * (count - 1) + executionTime) / count;

    // 更新置信度 (贝叶斯式)
    tool.confidence = tool.stats.successCount / tool.stats.usageCount;

    this.emit('toolUsed', { toolId, success, executionTime });
  }

  /**
   * 记录技能应用
   */
  recordSkillApplication(skillId: string, success: boolean, complexity: number): void {
    const skill = this.skills.get(skillId);
    if (!skill) return;

    skill.stats.usageCount++;
    skill.stats.lastAppliedAt = new Date().toISOString();

    // 更新成功率
    const oldRate = skill.stats.successRate;
    const count = skill.stats.usageCount;
    skill.stats.successRate = (oldRate * (count - 1) + (success ? 1 : 0)) / count;

    // 更新平均复杂度
    const oldComplexity = skill.stats.avgComplexity;
    skill.stats.avgComplexity = (oldComplexity * (count - 1) + complexity) / count;

    // 更新掌握度 (经验值累积)
    const expGain = success ? complexity * 10 : complexity * 2;
    skill.experience += expGain;
    skill.mastery = Math.min(1, skill.experience / 10000);

    // 升级检查
    if (skill.mastery > 0.8 && skill.status !== 'mastered') {
      skill.status = 'mastered';
      skill.level = 'expert';
      this.emit('skillMastered', skill);
    } else if (skill.mastery > 0.5 && skill.level === 'novice') {
      skill.level = 'intermediate';
      skill.status = 'active';
    }

    this.emit('skillApplied', { skillId, success, complexity });
  }

  /**
   * 按需加载 (核心功能)
   */
  loadOnDemand(config: LoadConfig): LoadResult {
    const result: LoadResult = {
      tools: [],
      skills: [],
      reasoning: [],
      estimatedRelevance: 0,
    };

    // 1. 加载关键和高优先级项目
    const criticalTools = this.getAllTools().filter(t => 
      t.loadPriority === 'critical' && t.status === 'available'
    );
    const criticalSkills = this.getAllSkills().filter(s => 
      s.loadPriority === 'critical' && s.status === 'active'
    );

    result.tools.push(...criticalTools);
    result.skills.push(...criticalSkills);
    result.reasoning.push(`Loaded ${criticalTools.length} critical tools`);
    result.reasoning.push(`Loaded ${criticalSkills.length} critical skills`);

    // 2. 基于意图匹配
    if (config.intent) {
      const matched = this.matchByIntent(config.intent);
      result.tools.push(...matched.tools.slice(0, config.maxTools - result.tools.length));
      result.skills.push(...matched.skills.slice(0, config.maxSkills - result.skills.length));
      result.reasoning.push(`Matched by intent "${config.intent}"`);
    }

    // 3. 基于主题匹配
    if (config.topic) {
      const topicMatched = this.matchByTopic(config.topic);
      const remainingToolSlots = config.maxTools - result.tools.length;
      const remainingSkillSlots = config.maxSkills - result.skills.length;
      
      result.tools.push(...topicMatched.tools.slice(0, remainingToolSlots));
      result.skills.push(...topicMatched.skills.slice(0, remainingSkillSlots));
      result.reasoning.push(`Matched by topic "${config.topic}"`);
    }

    // 4. 去重
    result.tools = this.deduplicateById(result.tools);
    result.skills = this.deduplicateById(result.skills);

    // 5. 计算相关度
    result.estimatedRelevance = this.calculateRelevance(result, config);

    this.emit('loaded', result);
    return result;
  }

  /**
   * 生成自我描述 (仅包含加载的项目)
   */
  generateSelfDescription(result: LoadResult): string {
    const lines: string[] = ['## Available Capabilities\n'];

    // 工具部分
    if (result.tools.length > 0) {
      lines.push('### Tools (External Resources)');
      
      // 按分类分组
      const byCategory = this.groupByCategory(result.tools);
      for (const [category, tools] of Object.entries(byCategory)) {
        lines.push(`\n**${category}:**`);
        for (const tool of tools) {
          const confidence = Math.round(tool.confidence * 100);
          lines.push(`- ${tool.displayName} (${confidence}% confidence) - ${tool.description}`);
        }
      }
    }

    // 技能部分
    if (result.skills.length > 0) {
      lines.push('\n### Skills (Internal Capabilities)');
      
      const byCategory = this.groupByCategory(result.skills);
      for (const [category, skills] of Object.entries(byCategory)) {
        lines.push(`\n**${category}:**`);
        for (const skill of skills) {
          const mastery = Math.round(skill.mastery * 100);
          const level = skill.level;
          lines.push(`- ${skill.displayName} [${level}, ${mastery}% mastery] - ${skill.description}`);
        }
      }
    }

    // 加载原因
    lines.push('\n### Selection Reasoning');
    for (const reason of result.reasoning) {
      lines.push(`- ${reason}`);
    }
    lines.push(`- Estimated relevance: ${Math.round(result.estimatedRelevance * 100)}%`);

    return lines.join('\n');
  }

  /**
   * 发现新工具 (来自系统扫描)
   */
  async discoverTools(): Promise<Tool[]> {
    const discovered: Tool[] = [];

    // 扫描系统PATH中的工具
    const systemTools = await this.scanSystemTools();
    
    for (const toolInfo of systemTools) {
      // 检查是否已注册
      const existing = Array.from(this.tools.values()).find(t => 
        t.name === toolInfo.name
      );
      
      if (!existing) {
        const newTool = this.registerTool({
          name: toolInfo.name,
          displayName: toolInfo.displayName || toolInfo.name,
          description: toolInfo.description || `System tool: ${toolInfo.name}`,
          type: toolInfo.type || ToolType.CLI,
          category: toolInfo.category || 'system',
          tags: toolInfo.tags || [],
          source: {
            type: 'discovered',
            location: toolInfo.path,
            discoveredAt: new Date().toISOString(),
          },
          capabilities: toolInfo.capabilities || [],
          inputs: toolInfo.inputs || [],
          outputs: toolInfo.outputs || [],
          loadPriority: 'on_demand',
          autoLoad: false,
        });
        
        discovered.push(newTool);
      }
    }

    if (discovered.length > 0) {
      this.emit('toolsDiscovered', discovered);
    }

    return discovered;
  }

  /**
   * 持久化
   */
  async persist(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    
    await fs.writeFile(
      path.join(this.dataDir, 'tools.json'),
      JSON.stringify(Array.from(this.tools.values()), null, 2)
    );
    
    await fs.writeFile(
      path.join(this.dataDir, 'skills.json'),
      JSON.stringify(Array.from(this.skills.values()), null, 2)
    );
  }

  /**
   * 加载
   */
  async load(): Promise<void> {
    try {
      const toolsData = await fs.readFile(path.join(this.dataDir, 'tools.json'), 'utf-8');
      const tools: Tool[] = JSON.parse(toolsData);
      for (const tool of tools) {
        this.tools.set(tool.id, tool);
      }
    } catch {}

    try {
      const skillsData = await fs.readFile(path.join(this.dataDir, 'skills.json'), 'utf-8');
      const skills: Skill[] = JSON.parse(skillsData);
      for (const skill of skills) {
        this.skills.set(skill.id, skill);
      }
    } catch {}
  }

  // ============ 私有方法 ============

  private matchByIntent(intent: string): { tools: Tool[]; skills: Skill[] } {
    const intentKeywords = this.extractKeywords(intent);
    
    const tools = this.getAllTools().filter(t => {
      const toolText = `${t.name} ${t.description} ${t.tags.join(' ')} ${t.capabilities.join(' ')}`;
      return intentKeywords.some(kw => toolText.toLowerCase().includes(kw.toLowerCase()));
    });

    const skills = this.getAllSkills().filter(s => {
      const skillText = `${s.name} ${s.description} ${s.tags.join(' ')}`;
      return intentKeywords.some(kw => skillText.toLowerCase().includes(kw.toLowerCase()));
    });

    return { tools, skills };
  }

  private matchByTopic(topic: string): { tools: Tool[]; skills: Skill[] } {
    // 主题到分类的映射
    const topicToCategory: Record<string, string[]> = {
      'coding': ['dev', 'coding'],
      'web': ['dev', 'content'],
      'data': ['data'],
      'image': ['content.image', 'ai.vision'],
      'video': ['content.video'],
      'browser': ['automation', 'mcp.browser'],
      'file': ['system.file', 'mcp.fs'],
    };

    const categories = topicToCategory[topic.toLowerCase()] || [];
    
    const tools: Tool[] = [];
    const skills: Skill[] = [];

    for (const cat of categories) {
      tools.push(...this.getToolsByCategory(cat));
      skills.push(...this.getSkillsByCategory(cat));
    }

    return { tools, skills };
  }

  private extractKeywords(text: string): string[] {
    // 简化版关键词提取
    return text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  }

  private deduplicateById<T extends { id: string }>(items: T[]): T[] {
    const seen = new Set<string>();
    return items.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  private groupByCategory<T extends { category: string; displayName: string }>(items: T[]): Record<string, T[]> {
    const grouped: Record<string, T[]> = {};
    for (const item of items) {
      const parts = item.category.split('.');
      const topCategory = parts[0];
      if (!grouped[topCategory]) grouped[topCategory] = [];
      grouped[topCategory].push(item);
    }
    return grouped;
  }

  private calculateRelevance(result: LoadResult, config: LoadConfig): number {
    // 简化版相关度计算
    let score = 0.5;
    
    // 有工具匹配
    if (result.tools.length > 0) score += 0.2;
    
    // 有技能匹配
    if (result.skills.length > 0) score += 0.2;
    
    // 意图明确
    if (config.intent) score += 0.1;

    return Math.min(1, score);
  }

  private async scanSystemTools(): Promise<Array<Partial<Tool>>> {
    // 简化实现：返回一些常见工具
    return [
      {
        name: 'ffmpeg',
        displayName: 'FFmpeg',
        description: '音视频处理工具',
        type: ToolType.CLI,
        category: 'content.video',
        tags: ['video', 'audio', 'conversion'],
        capabilities: ['convert', 'extract', 'merge'],
      },
      {
        name: 'git',
        displayName: 'Git',
        description: '版本控制工具',
        type: ToolType.CLI,
        category: 'dev.vcs',
        tags: ['version-control', ' collaboration'],
        capabilities: ['commit', 'branch', 'merge', 'history'],
      },
    ];
  }
}

export default ToolSkillManager;
