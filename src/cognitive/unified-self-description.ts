/**
 * 统一自我描述系统 (Unified Self-Description System)
 * 
 * 整合：身体图式 + 自我认知 + 世界模型 + 工具集
 * 
 * 核心思想：
 * - 所有关于"我是什么"的信息都存储在自我描述中
 * - 反思是更新自我描述的唯一入口
 * - 自我描述的变更会触发相应子系统的更新
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// 类型定义
// ============================================================================

/** 自我描述对象 */
export interface SelfDescription {
  // 1. 身份认知 (原自我认知)
  identity: {
    name: string;
    version: string;
    description: string;
    createdAt: string;
    lastUpdated: string;
    evolutionStage: number;  // 进化阶段
  };

  // 2. 身体图式 (原身体图式)
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
    sensors: Array<{
      name: string;
      type: string;
      status: 'active' | 'inactive' | 'error';
    }>;
    actuators: Array<{
      name: string;
      type: string;
      capabilities: string[];
    }>;
  };

  // 3. 世界模型 (原世界模型)
  worldModel: {
    environment: {
      type: string;
      description: string;
      constraints: string[];
    };
    entities: Array<{
      type: 'user' | 'system' | 'agent' | 'tool';
      relationship: string;
      trustLevel: number;
    }>;
    dynamics: {
      patterns: string[];
      risks: string[];
      opportunities: string[];
    };
    capabilities: {
      strengths: string[];
      weaknesses: string[];
      limitations: string[];
    };
  };

  // 4. 工具集 (原工具集 + MCP)
  toolSet: {
    builtIn: Array<{
      name: string;
      description: string;
      confidence: number;
      successRate: number;
      usageCount: number;
    }>;
    mcpServers: Array<{
      name: string;
      enabled: boolean;
      tools: string[];
      status: 'connected' | 'disconnected' | 'error';
    }>;
    recentlyDiscovered: Array<{
      name: string;
      source: string;
      discoveredAt: string;
    }>;
  };

  // 5. 认知状态
  cognitiveState: {
    hormoneLevels: Record<string, number>;
    mode: 'serving' | 'evolving' | 'reflecting';
    activeGoals: string[];
    currentFocus: string;
  };

  // 6. 元数据
  meta: {
    version: number;
    lastReflectionAt: string;
    reflectionCount: number;
    modificationCount: number;
  };
}

/** 反思结果 */
export interface ReflectionResult {
  timestamp: number;
  trigger: 'scheduled' | 'performance_drop' | 'user_request' | 'anomaly_detected';
  insights: Array<{
    category: 'world_model' | 'tool' | 'body' | 'identity' | 'capability';
    type: 'pattern' | 'limitation' | 'error' | 'opportunity' | 'discovery';
    description: string;
    confidence: number;
    suggestedAction: string;
  }>;
  proposedChanges: Array<{
    target: 'worldModel' | 'toolSet' | 'body' | 'identity';
    path: string;
    operation: 'add' | 'update' | 'remove';
    value: unknown;
    reasoning: string;
  }>;
}

/** 自我描述变更记录 */
export interface SelfDescriptionChange {
  timestamp: number;
  reflectionId: string;
  changes: Array<{
    path: string;
    oldValue: unknown;
    newValue: unknown;
    reason: string;
  }>;
  applied: boolean;
}

// ============================================================================
// 统一自我描述管理器
// ============================================================================

export class UnifiedSelfDescription extends EventEmitter {
  private description: SelfDescription;
  private dataDir: string;
  private changeHistory: SelfDescriptionChange[] = [];

  constructor(dataDir: string = './data/self-description') {
    super();
    this.dataDir = dataDir;
    this.description = this.createDefaultDescription();
  }

  /**
   * 创建默认自我描述
   */
  private createDefaultDescription(): SelfDescription {
    return {
      identity: {
        name: 'Ouroboros',
        version: '2.0.0',
        description: 'Self-evolving AI Agent with unified self-description',
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
        sensors: [],
        actuators: [],
      },
      worldModel: {
        environment: {
          type: 'linux-server',
          description: 'Running in Node.js environment with access to system resources',
          constraints: [
            'No direct hardware access',
            'Network dependent',
            'Resource limited',
          ],
        },
        entities: [],
        dynamics: {
          patterns: [],
          risks: [],
          opportunities: [],
        },
        capabilities: {
          strengths: [],
          weaknesses: [],
          limitations: [],
        },
      },
      toolSet: {
        builtIn: [],
        mcpServers: [],
        recentlyDiscovered: [],
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
      meta: {
        version: 1,
        lastReflectionAt: '',
        reflectionCount: 0,
        modificationCount: 0,
      },
    };
  }

  /**
   * 获取当前自我描述
   */
  getDescription(): SelfDescription {
    return JSON.parse(JSON.stringify(this.description));
  }

  /**
   * 获取特定部分
   */
  getPart<K extends keyof SelfDescription>(key: K): SelfDescription[K] {
    return JSON.parse(JSON.stringify(this.description[key]));
  }

  /**
   * 更新身体图式 (来自BodySchemaManager)
   */
  updateBodySchema(schema: Partial<SelfDescription['body']>): void {
    const oldBody = JSON.parse(JSON.stringify(this.description.body));
    this.description.body = { ...this.description.body, ...schema };
    this.description.identity.lastUpdated = new Date().toISOString();
    
    this.emit('bodyUpdated', {
      old: oldBody,
      new: this.description.body,
      changes: this.diffObjects(oldBody, this.description.body),
    });
  }

  /**
   * 添加传感器
   */
  addSensor(sensor: SelfDescription['body']['sensors'][0]): void {
    this.description.body.sensors.push(sensor);
    this.emit('sensorAdded', sensor);
  }

  /**
   * 添加执行器
   */
  addActuator(actuator: SelfDescription['body']['actuators'][0]): void {
    this.description.body.actuators.push(actuator);
    this.emit('actuatorAdded', actuator);
  }

  /**
   * 更新工具置信度 (来自BayesianCore)
   */
  updateToolConfidence(toolName: string, confidence: number, successRate: number): void {
    const tool = this.description.toolSet.builtIn.find(t => t.name === toolName);
    if (tool) {
      tool.confidence = confidence;
      tool.successRate = successRate;
      this.emit('toolUpdated', { name: toolName, confidence, successRate });
    }
  }

  /**
   * 注册新工具
   */
  registerTool(tool: Omit<SelfDescription['toolSet']['builtIn'][0], 'usageCount'>): void {
    const existing = this.description.toolSet.builtIn.find(t => t.name === tool.name);
    if (!existing) {
      this.description.toolSet.builtIn.push({ ...tool, usageCount: 0 });
      this.emit('toolRegistered', tool);
    }
  }

  /**
   * 发现新工具 (来自反思)
   */
  discoverTool(name: string, source: string): void {
    this.description.toolSet.recentlyDiscovered.push({
      name,
      source,
      discoveredAt: new Date().toISOString(),
    });
    this.emit('toolDiscovered', { name, source });
  }

  /**
   * 添加MCP服务器
   */
  addMCPServer(server: SelfDescription['toolSet']['mcpServers'][0]): void {
    const existing = this.description.toolSet.mcpServers.find(s => s.name === server.name);
    if (!existing) {
      this.description.toolSet.mcpServers.push(server);
      this.emit('mcpServerAdded', server);
    }
  }

  /**
   * 更新世界模型 (来自反思)
   */
  updateWorldModel(updates: Partial<SelfDescription['worldModel']>): void {
    const oldModel = JSON.parse(JSON.stringify(this.description.worldModel));
    this.description.worldModel = { ...this.description.worldModel, ...updates };
    
    this.emit('worldModelUpdated', {
      old: oldModel,
      new: this.description.worldModel,
    });
  }

  /**
   * 添加世界模型规律
   */
  addWorldPattern(pattern: string): void {
    if (!this.description.worldModel.dynamics.patterns.includes(pattern)) {
      this.description.worldModel.dynamics.patterns.push(pattern);
      this.emit('patternAdded', pattern);
    }
  }

  /**
   * 更新认知状态
   */
  updateCognitiveState(updates: Partial<SelfDescription['cognitiveState']>): void {
    this.description.cognitiveState = { ...this.description.cognitiveState, ...updates };
    this.emit('cognitiveStateUpdated', updates);
  }

  /**
   * 执行反思 (核心入口)
   * 
   * 这是更新自我描述的主要入口
   * 反思结果会产生对自我描述的变更建议
   */
  async reflect(context: {
    recentMemories: any[];
    performanceMetrics: any[];
    systemEvents: any[];
    trigger: ReflectionResult['trigger'];
  }): Promise<ReflectionResult> {
    const result: ReflectionResult = {
      timestamp: Date.now(),
      trigger: context.trigger,
      insights: [],
      proposedChanges: [],
    };

    // 1. 分析性能模式
    const patterns = this.analyzePerformancePatterns(context.performanceMetrics);
    for (const pattern of patterns) {
      result.insights.push({
        category: 'capability',
        type: 'pattern',
        description: pattern.description,
        confidence: pattern.confidence,
        suggestedAction: pattern.action,
      });
    }

    // 2. 发现未使用的工具/MCP
    const undiscoveredTools = this.findUndiscoveredTools(context.recentMemories);
    for (const tool of undiscoveredTools) {
      result.insights.push({
        category: 'tool',
        type: 'discovery',
        description: `Discovered new tool: ${tool.name}`,
        confidence: 0.8,
        suggestedAction: `Add ${tool.name} to toolSet`,
      });
      
      result.proposedChanges.push({
        target: 'toolSet',
        path: `recentlyDiscovered`,
        operation: 'add',
        value: tool,
        reasoning: `Found in memory: ${tool.source}`,
      });
    }

    // 3. 发现新硬件/传感器
    const newHardware = this.detectNewHardware(context.systemEvents);
    for (const hw of newHardware) {
      result.insights.push({
        category: 'body',
        type: 'discovery',
        description: `Detected new hardware: ${hw.name}`,
        confidence: 0.9,
        suggestedAction: `Add to body.sensors or body.actuators`,
      });
      
      result.proposedChanges.push({
        target: 'body',
        path: hw.type === 'sensor' ? 'sensors' : 'actuators',
        operation: 'add',
        value: hw,
        reasoning: `System event detected: ${hw.description}`,
      });
    }

    // 4. 世界模型更新
    const worldInsights = this.inferWorldModelUpdates(context);
    for (const insight of worldInsights) {
      result.insights.push(insight);
      
      result.proposedChanges.push({
        target: 'worldModel',
        path: insight.category === 'pattern' ? 'dynamics.patterns' : 'dynamics.risks',
        operation: 'add',
        value: insight.description,
        reasoning: insight.suggestedAction,
      });
    }

    // 更新元数据
    this.description.meta.lastReflectionAt = new Date().toISOString();
    this.description.meta.reflectionCount++;

    this.emit('reflectionCompleted', result);
    return result;
  }

  /**
   * 应用反思产生的变更
   */
  async applyReflectionChanges(
    reflection: ReflectionResult,
    approval: 'auto' | 'human' | 'conservative' = 'conservative'
  ): Promise<SelfDescriptionChange> {
    const changeRecord: SelfDescriptionChange = {
      timestamp: Date.now(),
      reflectionId: `${reflection.timestamp}`,
      changes: [],
      applied: false,
    };

    for (const proposed of reflection.proposedChanges) {
      // 根据审批模式决定是否应用
      let shouldApply = false;
      
      switch (approval) {
        case 'auto':
          shouldApply = true;
          break;
        case 'human':
          // 等待人工批准 (简化版)
          shouldApply = false;
          break;
        case 'conservative':
          // 只应用高置信度的变更
          shouldApply = proposed.target !== 'worldModel' || 
                       reflection.insights.find(i => 
                         i.suggestedAction === proposed.reasoning
                       )?.confidence! > 0.8;
          break;
      }

      if (shouldApply) {
        const oldValue = this.getValueAtPath(proposed.path);
        this.applyChange(proposed);
        
        changeRecord.changes.push({
          path: proposed.path,
          oldValue,
          newValue: proposed.value,
          reason: proposed.reasoning,
        });
      }
    }

    if (changeRecord.changes.length > 0) {
      changeRecord.applied = true;
      this.description.meta.modificationCount++;
      this.description.identity.lastUpdated = new Date().toISOString();
      this.changeHistory.push(changeRecord);
      
      this.emit('changesApplied', changeRecord);
      await this.persist();
    }

    return changeRecord;
  }

  /**
   * 生成自我提示词 (用于LLM)
   */
  generateSelfPrompt(): string {
    const d = this.description;
    
    return `## Self-Description

### Identity
- Name: ${d.identity.name} v${d.identity.version}
- Stage: Evolution ${d.identity.evolutionStage}
- Description: ${d.identity.description}
- Last Updated: ${d.identity.lastUpdated}

### Body
- Type: ${d.body.type}
- Platform: ${d.body.environment.platform} (${d.body.environment.architecture})
- Runtime: ${d.body.environment.runtime}
- Resources: ${JSON.stringify(d.body.resources)}
- Sensors: ${d.body.sensors.map(s => s.name).join(', ') || 'None'}
- Actuators: ${d.body.actuators.map(a => a.name).join(', ') || 'None'}

### World Model
- Environment: ${d.worldModel.environment.type}
- Patterns: ${d.worldModel.dynamics.patterns.join(', ') || 'None observed'}
- Risks: ${d.worldModel.dynamics.risks.join(', ') || 'None identified'}
- Strengths: ${d.worldModel.capabilities.strengths.join(', ') || 'Unknown'}
- Weaknesses: ${d.worldModel.capabilities.weaknesses.join(', ') || 'Unknown'}

### Tool Set
- Built-in: ${d.toolSet.builtIn.map(t => `${t.name}(${t.confidence.toFixed(2)})`).join(', ') || 'None'}
- MCP Servers: ${d.toolSet.mcpServers.map(s => s.name).join(', ') || 'None'}
- Recently Discovered: ${d.toolSet.recentlyDiscovered.map(t => t.name).join(', ') || 'None'}

### Cognitive State
- Mode: ${d.cognitiveState.mode}
- Hormones: ${JSON.stringify(d.cognitiveState.hormoneLevels)}
- Active Goals: ${d.cognitiveState.activeGoals.join(', ') || 'None'}
- Current Focus: ${d.cognitiveState.currentFocus || 'None'}

### Meta
- Reflections: ${d.meta.reflectionCount}
- Modifications: ${d.meta.modificationCount}
`;
  }

  /**
   * 持久化到磁盘
   */
  async persist(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    
    await fs.writeFile(
      path.join(this.dataDir, 'self-description.json'),
      JSON.stringify(this.description, null, 2),
      'utf-8'
    );
    
    await fs.writeFile(
      path.join(this.dataDir, 'change-history.json'),
      JSON.stringify(this.changeHistory, null, 2),
      'utf-8'
    );
  }

  /**
   * 从磁盘加载
   */
  async load(): Promise<void> {
    try {
      const data = await fs.readFile(
        path.join(this.dataDir, 'self-description.json'),
        'utf-8'
      );
      this.description = JSON.parse(data);
      
      const history = await fs.readFile(
        path.join(this.dataDir, 'change-history.json'),
        'utf-8'
      );
      this.changeHistory = JSON.parse(history);
    } catch {
      // 使用默认配置
    }
  }

  // ============ 私有方法 ============

  private analyzePerformancePatterns(metrics: any[]): Array<{ description: string; confidence: number; action: string }> {
    // 简化实现
    return [];
  }

  private findUndiscoveredTools(memories: any[]): Array<{ name: string; source: string }> {
    // 简化实现：从记忆中提取工具名称
    return [];
  }

  private detectNewHardware(events: any[]): Array<{ name: string; type: 'sensor' | 'actuator'; description: string }> {
    // 简化实现
    return [];
  }

  private inferWorldModelUpdates(context: any): Array<{
    category: 'world_model';
    type: 'pattern' | 'risk' | 'opportunity';
    description: string;
    confidence: number;
    suggestedAction: string;
  }> {
    // 简化实现
    return [];
  }

  private diffObjects(oldObj: any, newObj: any): string[] {
    const changes: string[] = [];
    // 简化实现
    return changes;
  }

  private getValueAtPath(path: string): any {
    const parts = path.split('.');
    let current: any = this.description;
    for (const part of parts) {
      current = current?.[part];
    }
    return current;
  }

  private applyChange(change: ReflectionResult['proposedChanges'][0]): void {
    // 简化实现
    const parts = change.path.split('.');
    let current: any = this.description;
    
    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]];
    }
    
    const lastPart = parts[parts.length - 1];
    
    if (change.operation === 'add' && Array.isArray(current[lastPart])) {
      current[lastPart].push(change.value);
    } else {
      current[lastPart] = change.value;
    }
  }
}

export default UnifiedSelfDescription;
