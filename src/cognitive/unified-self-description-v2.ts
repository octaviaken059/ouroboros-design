/**
 * 统一自我描述系统 v2 - 集成工具技能管理
 * 
 * 核心特性：
 * 1. 区分工具(外部)和技能(内部)
 * 2. 按需加载到自我描述
 * 3. 反思驱动工具发现和技能学习
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ToolSkillManager,
  Tool,
  Skill,
  LoadConfig,
  LoadResult,
  ToolType,
} from '../execution/tool-skill-manager.js';

// ============================================================================
// 类型定义
// ============================================================================

/** 自我描述 v2 */
export interface SelfDescriptionV2 {
  // 1. 身份认知
  identity: {
    name: string;
    version: string;
    description: string;
    createdAt: string;
    lastUpdated: string;
    evolutionStage: number;
  };

  // 2. 身体图式
  body: {
    type: 'software' | 'hybrid' | 'embodied';
    environment: {
      platform: string;
      runtime: string;
      architecture: string;
    };
    resources: {
      memory: { total: number; used: number; available: number };
      storage: { total: number; used: number; available: number };
      compute: { cores: number; load: number };
    };
  };

  // 3. 世界模型
  worldModel: {
    environment: {
      type: string;
      constraints: string[];
    };
    patterns: string[];
    risks: string[];
    opportunities: string[];
  };

  // 4. 认知状态
  cognitiveState: {
    hormoneLevels: Record<string, number>;
    mode: 'serving' | 'evolving' | 'reflecting';
    activeGoals: string[];
    currentFocus: string;
  };

  // 5. 能力概览 (不包含完整工具/技能列表，只存统计)
  capabilities: {
    tools: {
      total: number;
      available: number;
      critical: number;
      byCategory: Record<string, number>;
    };
    skills: {
      total: number;
      active: number;
      mastered: number;
      byCategory: Record<string, number>;
    };
  };

  // 6. 元数据
  meta: {
    version: number;
    lastReflectionAt: string;
    reflectionCount: number;
    lastLoadConfig?: LoadConfig;
  };
}

/** 反思结果 v2 */
export interface ReflectionResultV2 {
  timestamp: number;
  trigger: 'scheduled' | 'performance_drop' | 'user_request' | 'anomaly_detected' | 'tool_discovered';
  insights: Array<{
    category: 'tool' | 'skill' | 'world_model' | 'body' | 'capability';
    type: 'pattern' | 'limitation' | 'error' | 'opportunity' | 'discovery';
    description: string;
    confidence: number;
    suggestedAction: string;
  }>;
  discoveries: {
    newTools: Tool[];
    newSkills: Skill[];
    patternRecognitions: string[];
  };
}

// ============================================================================
// 统一自我描述管理器 v2
// ============================================================================

export class UnifiedSelfDescriptionV2 extends EventEmitter {
  private description: SelfDescriptionV2;
  private toolSkillManager: ToolSkillManager;
  private dataDir: string;
  private currentLoadResult?: LoadResult;

  constructor(dataDir: string = './data/unified-self-v2') {
    super();
    this.dataDir = dataDir;
    this.toolSkillManager = new ToolSkillManager(path.join(dataDir, 'tool-skill'));
    this.description = this.createDefaultDescription();
  }

  /**
   * 创建默认描述
   */
  private createDefaultDescription(): SelfDescriptionV2 {
    return {
      identity: {
        name: 'Ouroboros',
        version: '2.0.0',
        description: 'Self-evolving AI Agent with unified self-description and tool-skill management',
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        evolutionStage: 1,
      },
      body: {
        type: 'software',
        environment: {
          platform: process.platform,
          runtime: `Node.js ${process.version}`,
          architecture: process.arch,
        },
        resources: {
          memory: { total: 0, used: 0, available: 0 },
          storage: { total: 0, used: 0, available: 0 },
          compute: { cores: 0, load: 0 },
        },
      },
      worldModel: {
        environment: {
          type: 'linux-server',
          constraints: ['no_direct_hardware_access', 'network_dependent'],
        },
        patterns: [],
        risks: [],
        opportunities: [],
      },
      cognitiveState: {
        hormoneLevels: {
          adrenaline: 0.1,
          cortisol: 0.1,
          dopamine: 0.1,
          serotonin: 0.5,
          curiosity: 0.3,
        },
        mode: 'serving',
        activeGoals: [],
        currentFocus: '',
      },
      capabilities: {
        tools: { total: 0, available: 0, critical: 0, byCategory: {} },
        skills: { total: 0, active: 0, mastered: 0, byCategory: {} },
      },
      meta: {
        version: 2,
        lastReflectionAt: '',
        reflectionCount: 0,
      },
    };
  }

  /**
   * 初始化 - 加载数据和发现工具
   */
  async initialize(): Promise<void> {
    // 加载已有数据
    await this.load();
    await this.toolSkillManager.load();

    // 发现系统工具
    const discoveredTools = await this.toolSkillManager.discoverTools();
    if (discoveredTools.length > 0) {
      this.emit('toolsDiscovered', discoveredTools);
    }

    // 更新能力统计
    this.updateCapabilityStats();

    // 注册一些核心技能
    this.registerCoreSkills();
  }

  /**
   * 注册核心技能
   */
  private registerCoreSkills(): void {
    // 自我反思技能
    this.toolSkillManager.registerSkill({
      name: 'self_reflection',
      displayName: '自我反思',
      description: '分析自身状态、性能和认知，生成改进建议',
      type: 'self_improvement' as any,
      category: 'meta',
      tags: ['meta-cognition', 'self-awareness', 'improvement'],
      level: 'advanced',
      experience: 5000,
      requires: {},
      implementation: {
        type: 'workflow',
        workflow: [
          '收集近期记忆和性能数据',
          '识别模式和异常',
          '评估当前能力状态',
          '生成insights和改进行动',
          '更新自我描述',
        ],
      },
      loadPriority: 'critical',
      autoLoad: true,
    });

    // 工具集成技能
    this.toolSkillManager.registerSkill({
      name: 'tool_integration',
      displayName: '工具集成',
      description: '发现、评估和整合新工具到能力体系',
      type: 'tool_integration' as any,
      category: 'meta',
      tags: ['tool-discovery', 'integration', 'adaptation'],
      level: 'intermediate',
      experience: 3000,
      requires: {},
      implementation: {
        type: 'pattern',
        pattern: '扫描系统 -> 发现工具 -> 评估能力 -> 测试验证 -> 注册集成',
      },
      loadPriority: 'high',
      autoLoad: true,
    });

    // 技能学习技能
    this.toolSkillManager.registerSkill({
      name: 'skill_learning',
      displayName: '技能学习',
      description: '从经验中学习新技能或提升现有技能',
      type: 'self_improvement' as any,
      category: 'meta',
      tags: ['learning', 'practice', 'mastery'],
      level: 'expert',
      experience: 8000,
      requires: {},
      implementation: {
        type: 'pattern',
        pattern: '观察 -> 尝试 -> 反馈 -> 调整 -> 精通',
      },
      loadPriority: 'critical',
      autoLoad: true,
    });
  }

  /**
   * 更新能力统计
   */
  private updateCapabilityStats(): void {
    const allTools = this.toolSkillManager.getAllTools();
    const allSkills = this.toolSkillManager.getAllSkills();

    // 工具统计
    const toolByCategory: Record<string, number> = {};
    for (const tool of allTools) {
      const cat = tool.category.split('.')[0];
      toolByCategory[cat] = (toolByCategory[cat] || 0) + 1;
    }

    this.description.capabilities.tools = {
      total: allTools.length,
      available: allTools.filter(t => t.status === 'available').length,
      critical: allTools.filter(t => t.loadPriority === 'critical').length,
      byCategory: toolByCategory,
    };

    // 技能统计
    const skillByCategory: Record<string, number> = {};
    for (const skill of allSkills) {
      const cat = skill.category.split('.')[0];
      skillByCategory[cat] = (skillByCategory[cat] || 0) + 1;
    }

    this.description.capabilities.skills = {
      total: allSkills.length,
      active: allSkills.filter(s => s.status === 'active' || s.status === 'mastered').length,
      mastered: allSkills.filter(s => s.status === 'mastered').length,
      byCategory: skillByCategory,
    };

    this.description.identity.lastUpdated = new Date().toISOString();
  }

  /**
   * 执行反思
   */
  async reflect(context: {
    recentMemories: any[];
    performanceMetrics: any[];
    systemEvents: any[];
    trigger: ReflectionResultV2['trigger'];
  }): Promise<ReflectionResultV2> {
    const result: ReflectionResultV2 = {
      timestamp: Date.now(),
      trigger: context.trigger,
      insights: [],
      discoveries: {
        newTools: [],
        newSkills: [],
        patternRecognitions: [],
      },
    };

    // 1. 检查是否有新工具可用
    const discoveredTools = await this.toolSkillManager.discoverTools();
    if (discoveredTools.length > 0) {
      result.discoveries.newTools = discoveredTools;
      for (const tool of discoveredTools) {
        result.insights.push({
          category: 'tool',
          type: 'discovery',
          description: `Discovered new tool: ${tool.displayName} (${tool.type})`,
          confidence: 0.9,
          suggestedAction: `Register and evaluate ${tool.name}`,
        });
      }
    }

    // 2. 分析性能模式
    if (context.performanceMetrics.length > 0) {
      const failures = context.performanceMetrics.filter((m: any) => !m.success);
      if (failures.length > 3) {
        result.insights.push({
          category: 'capability',
          type: 'limitation',
          description: `Detected ${failures.length} consecutive failures`,
          confidence: 0.8,
          suggestedAction: 'Consider learning new skill or acquiring new tool',
        });
      }
    }

    // 3. 从记忆中提取模式
    const toolMentions = this.extractToolMentions(context.recentMemories);
    for (const mention of toolMentions) {
      if (!this.toolSkillManager.getTool(`tool.${mention.category}.${mention.name}`)) {
        result.insights.push({
          category: 'tool',
          type: 'opportunity',
          description: `User mentioned ${mention.name} which is not available`,
          confidence: 0.7,
          suggestedAction: `Investigate ${mention.name} and consider integration`,
        });
      }
    }

    // 4. 更新世界模型
    if (result.insights.length > 0) {
      this.description.worldModel.patterns.push(
        `Reflection at ${new Date().toISOString()}: ${result.insights.length} insights`
      );
    }

    // 更新元数据
    this.description.meta.lastReflectionAt = new Date().toISOString();
    this.description.meta.reflectionCount++;

    this.emit('reflectionCompleted', result);
    return result;
  }

  /**
   * 按需加载能力
   */
  loadCapabilities(config: LoadConfig): LoadResult {
    // 保存配置
    this.description.meta.lastLoadConfig = config;

    // 执行加载
    const result = this.toolSkillManager.loadOnDemand(config);
    this.currentLoadResult = result;

    this.emit('capabilitiesLoaded', result);
    return result;
  }

  /**
   * 生成自我描述文本 (仅包含加载的能力)
   */
  generateSelfDescription(): string {
    const d = this.description;
    const lines: string[] = [];

    // 头部
    lines.push(`# Self-Description: ${d.identity.name} v${d.identity.version}`);
    lines.push(`Evolution Stage: ${d.identity.evolutionStage} | Mode: ${d.cognitiveState.mode}\n`);

    // 身体状态
    lines.push('## Body Status');
    lines.push(`- Platform: ${d.body.environment.platform} (${d.body.environment.architecture})`);
    lines.push(`- Resources: Memory ${d.body.resources.memory.used}/${d.body.resources.memory.total}MB`);
    lines.push(`- Status: ${this.getBodyStatus()}\n`);

    // 世界模型
    lines.push('## World Model');
    if (d.worldModel.patterns.length > 0) {
      lines.push('- Patterns: ' + d.worldModel.patterns.slice(-3).join('; '));
    }
    if (d.worldModel.risks.length > 0) {
      lines.push('- Risks: ' + d.worldModel.risks.join(', '));
    }
    lines.push('');

    // 认知状态
    lines.push('## Cognitive State');
    lines.push(`- Mode: ${d.cognitiveState.mode}`);
    lines.push(`- Focus: ${d.cognitiveState.currentFocus || 'None'}`);
    lines.push(`- Hormones: Dopamine=${d.cognitiveState.hormoneLevels.dopamine.toFixed(2)}`);
    lines.push('');

    // 能力概览
    lines.push('## Capabilities Overview');
    lines.push(`- Tools: ${d.capabilities.tools.total} total, ${d.capabilities.tools.critical} critical`);
    lines.push(`- Skills: ${d.capabilities.skills.total} total, ${d.capabilities.skills.mastered} mastered`);
    lines.push('');

    // 当前加载的能力 (核心)
    if (this.currentLoadResult) {
      lines.push(this.toolSkillManager.generateSelfDescription(this.currentLoadResult));
    } else {
      lines.push('## Available Capabilities');
      lines.push('(No specific capabilities loaded - use loadCapabilities() first)');
    }

    // 元数据
    lines.push('\n## Meta');
    lines.push(`- Reflections: ${d.meta.reflectionCount}`);
    lines.push(`- Last Update: ${d.identity.lastUpdated}`);

    return lines.join('\n');
  }

  /**
   * 生成精简版自我描述 (用于快速响应)
   */
  generateBriefSelfDescription(): string {
    const d = this.description;
    return `
I am ${d.identity.name} v${d.identity.version} (Stage ${d.identity.evolutionStage}).
Mode: ${d.cognitiveState.mode} | Focus: ${d.cognitiveState.currentFocus || 'general'}
Tools: ${d.capabilities.tools.available}/${d.capabilities.tools.total} available
Skills: ${d.capabilities.skills.mastered}/${d.capabilities.skills.total} mastered
    `.trim();
  }

  /**
   * 获取工具技能管理器
   */
  getToolSkillManager(): ToolSkillManager {
    return this.toolSkillManager;
  }

  /**
   * 获取完整描述对象
   */
  getDescription(): SelfDescriptionV2 {
    return JSON.parse(JSON.stringify(this.description));
  }

  /**
   * 更新身体资源
   */
  updateBodyResources(resources: SelfDescriptionV2['body']['resources']): void {
    this.description.body.resources = resources;
    this.description.identity.lastUpdated = new Date().toISOString();
  }

  /**
   * 更新激素状态
   */
  updateHormoneLevels(levels: Partial<SelfDescriptionV2['cognitiveState']['hormoneLevels']>): void {
    this.description.cognitiveState.hormoneLevels = {
      ...this.description.cognitiveState.hormoneLevels,
      ...levels,
    };
  }

  /**
   * 设置当前焦点
   */
  setCurrentFocus(focus: string): void {
    this.description.cognitiveState.currentFocus = focus;
  }

  /**
   * 持久化
   */
  async persist(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    
    await fs.writeFile(
      path.join(this.dataDir, 'self-description.json'),
      JSON.stringify(this.description, null, 2)
    );

    await this.toolSkillManager.persist();
  }

  /**
   * 加载
   */
  async load(): Promise<void> {
    try {
      const data = await fs.readFile(
        path.join(this.dataDir, 'self-description.json'),
        'utf-8'
      );
      this.description = JSON.parse(data);
    } catch {
      // 使用默认
    }
  }

  // ============ 私有方法 ============

  private getBodyStatus(): string {
    const memPercent = this.description.body.resources.memory.used / 
                       (this.description.body.resources.memory.total || 1);
    if (memPercent > 0.9) return 'critical';
    if (memPercent > 0.8) return 'stressed';
    if (memPercent > 0.6) return 'busy';
    return 'healthy';
  }

  private extractToolMentions(memories: any[]): Array<{ name: string; category: string }> {
    // 简化实现：从记忆中提取可能的工具名称
    const mentions: Array<{ name: string; category: string }> = [];
    const keywords = ['ffmpeg', 'puppeteer', 'docker', 'kubernetes', 'terraform'];
    
    for (const mem of memories) {
      const content = typeof mem === 'string' ? mem : mem.content || '';
      for (const kw of keywords) {
        if (content.toLowerCase().includes(kw)) {
          mentions.push({ name: kw, category: 'discovered' });
        }
      }
    }
    
    return mentions;
  }
}

export default UnifiedSelfDescriptionV2;
