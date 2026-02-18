/**
 * Ouroboros - UnifiedAgent 集成软自指系统
 * 
 * 集成内容：
 * 1. 软自指提示词系统
 * 2. A/B测试机制
 * 3. 版本回滚功能
 * 4. 硬自指架构准备
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

// 导入软自指系统
import {
  PromptAssembler,
  SelfPromptManager,
  MemoryPromptManager,
  TokenBudgetManager,
  PerformanceMetrics,
  SelfPromptContent,
  MemoryPromptContent,
  PromptType,
} from './cognitive/soft-self-reference.js';

// 导入原有子系统
import {
  Scheduler,
  HormoneSystem,
  HormoneType,
  BodySchemaManager,
  LayeredMemory,
  MemoryEntry,
  BayesianCore,
  SafetyEngine,
  Task,
  TaskPriority,
  ToolSkill,
  UnifiedAgentConfig,
} from './unified-agent.js';

// ============================================================================
// A/B测试管理器
// ============================================================================

export interface SelfPromptVariant {
  id: string;
  name: string;
  content: SelfPromptContent;
  performance: {
    totalTasks: number;
    successfulTasks: number;
    averageTokenEfficiency: number;
    userSatisfaction: number;
  };
  createdAt: number;
  isActive: boolean;
}

export class ABTestManager extends EventEmitter {
  private variants: Map<string, SelfPromptVariant> = new Map();
  private activeVariantId: string | null = null;
  private testHistory: Array<{
    timestamp: number;
    variantA: string;
    variantB: string;
    winner: string;
    improvement: number;
  }> = [];
  private minSamplesForComparison: number = 10;
  private confidenceThreshold: number = 0.95;

  constructor(private dataDir: string) {
    super();
    this.loadVariants();
  }

  /**
   * 创建新的变体
   */
  createVariant(baseContent: SelfPromptContent, name: string): SelfPromptVariant {
    const variant: SelfPromptVariant = {
      id: crypto.randomUUID(),
      name,
      content: JSON.parse(JSON.stringify(baseContent)), // 深拷贝
      performance: {
        totalTasks: 0,
        successfulTasks: 0,
        averageTokenEfficiency: 0,
        userSatisfaction: 0,
      },
      createdAt: Date.now(),
      isActive: false,
    };

    this.variants.set(variant.id, variant);
    return variant;
  }

  /**
   * 启动A/B测试
   */
  startABTest(variantAId: string, variantBId: string): void {
    const variantA = this.variants.get(variantAId);
    const variantB = this.variants.get(variantBId);

    if (!variantA || !variantB) {
      throw new Error('Variant not found');
    }

    // 重置性能统计
    variantA.performance = { totalTasks: 0, successfulTasks: 0, averageTokenEfficiency: 0, userSatisfaction: 0 };
    variantB.performance = { totalTasks: 0, successfulTasks: 0, averageTokenEfficiency: 0, userSatisfaction: 0 };
    
    // 随机选择活跃变体
    this.activeVariantId = Math.random() < 0.5 ? variantAId : variantBId;
    
    variantA.isActive = this.activeVariantId === variantAId;
    variantB.isActive = this.activeVariantId === variantBId;

    this.emit('abTestStarted', { variantA: variantAId, variantB: variantBId });
  }

  /**
   * 获取当前活跃变体
   */
  getActiveVariant(): SelfPromptVariant | null {
    if (!this.activeVariantId) return null;
    return this.variants.get(this.activeVariantId) || null;
  }

  /**
   * 记录任务结果（用于A/B测试统计）
   */
  recordTaskResult(success: boolean, metrics: PerformanceMetrics): void {
    const activeVariant = this.getActiveVariant();
    if (!activeVariant) return;

    activeVariant.performance.totalTasks++;
    if (success) activeVariant.performance.successfulTasks++;
    
    // 更新平均token效率
    const oldEff = activeVariant.performance.averageTokenEfficiency;
    const count = activeVariant.performance.totalTasks;
    activeVariant.performance.averageTokenEfficiency = 
      (oldEff * (count - 1) + (metrics.tokenEfficiency || 0)) / count;

    // 检查是否应该评估结果
    this.checkTestCompletion();
  }

  /**
   * 检查A/B测试是否应该结束
   */
  private checkTestCompletion(): void {
    // 找到正在测试的两个变体
    const testingVariants = Array.from(this.variants.values()).filter(v => v.isActive);
    if (testingVariants.length !== 2) return;

    const [variantA, variantB] = testingVariants;

    // 检查是否有足够的样本
    if (variantA.performance.totalTasks < this.minSamplesForComparison ||
        variantB.performance.totalTasks < this.minSamplesForComparison) {
      return;
    }

    // 计算统计显著性 (简化版)
    const successRateA = variantA.performance.successfulTasks / variantA.performance.totalTasks;
    const successRateB = variantB.performance.successfulTasks / variantB.performance.totalTasks;
    
    const winner = successRateA > successRateB ? variantA : variantB;
    const loser = successRateA > successRateB ? variantB : variantA;
    const improvement = Math.abs(successRateA - successRateB);

    // 如果改进显著，结束测试
    if (improvement > 0.1) {
      this.endABTest(winner.id, loser.id, improvement);
    }
  }

  /**
   * 结束A/B测试
   */
  private endABTest(winnerId: string, loserId: string, improvement: number): void {
    const winner = this.variants.get(winnerId);
    const loser = this.variants.get(loserId);

    if (!winner || !loser) return;

    // 激活获胜者
    this.activeVariantId = winnerId;
    winner.isActive = true;
    loser.isActive = false;

    // 记录历史
    this.testHistory.push({
      timestamp: Date.now(),
      variantA: winnerId,
      variantB: loserId,
      winner: winnerId,
      improvement,
    });

    this.emit('abTestCompleted', {
      winner: winnerId,
      loser: loserId,
      improvement,
    });

    this.persist();
  }

  /**
   * 获取所有变体
   */
  getAllVariants(): SelfPromptVariant[] {
    return Array.from(this.variants.values());
  }

  /**
   * 获取测试历史
   */
  getTestHistory(): typeof this.testHistory {
    return [...this.testHistory];
  }

  /**
   * 持久化到磁盘
   */
  private async persist(): Promise<void> {
    try {
      const data = {
        variants: Array.from(this.variants.entries()),
        activeVariantId: this.activeVariantId,
        testHistory: this.testHistory,
      };
      
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.writeFile(
        path.join(this.dataDir, 'ab-test-variants.json'),
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    } catch (error) {
      this.emit('error', { type: 'persist', error });
    }
  }

  /**
   * 从磁盘加载
   */
  private async loadVariants(): Promise<void> {
    try {
      const data = await fs.readFile(
        path.join(this.dataDir, 'ab-test-variants.json'),
        'utf-8'
      );
      const parsed = JSON.parse(data);
      
      this.variants = new Map(parsed.variants);
      this.activeVariantId = parsed.activeVariantId;
      this.testHistory = parsed.testHistory || [];
    } catch {
      // 文件不存在，创建默认变体
    }
  }
}

// ============================================================================
// 版本回滚管理器
// ============================================================================

export interface SelfPromptVersion {
  id: string;
  timestamp: number;
  content: SelfPromptContent;
  performanceSnapshot: {
    avgSuccessRate: number;
    avgTokenEfficiency: number;
  };
  changeDescription: string;
}

export class VersionRollbackManager extends EventEmitter {
  private versions: SelfPromptVersion[] = [];
  private maxVersions: number = 50;
  private dataDir: string;

  constructor(dataDir: string) {
    super();
    this.dataDir = dataDir;
    this.loadVersions();
  }

  /**
   * 保存新版本
   */
  saveVersion(
    content: SelfPromptContent,
    performance: { avgSuccessRate: number; avgTokenEfficiency: number },
    changeDescription: string
  ): SelfPromptVersion {
    const version: SelfPromptVersion = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      content: JSON.parse(JSON.stringify(content)),
      performanceSnapshot: performance,
      changeDescription,
    };

    this.versions.push(version);
    
    // 保留最近maxVersions个版本
    if (this.versions.length > this.maxVersions) {
      this.versions = this.versions.slice(-this.maxVersions);
    }

    this.persist();
    this.emit('versionSaved', version);
    
    return version;
  }

  /**
   * 回滚到指定版本
   */
  rollbackToVersion(versionId: string): SelfPromptVersion | null {
    const version = this.versions.find(v => v.id === versionId);
    if (!version) return null;

    this.emit('rollback', {
      from: this.versions[this.versions.length - 1]?.id,
      to: versionId,
      timestamp: Date.now(),
    });

    return version;
  }

  /**
   * 回滚到上一个版本
   */
  rollback(): SelfPromptVersion | null {
    if (this.versions.length < 2) return null;
    return this.rollbackToVersion(this.versions[this.versions.length - 2].id);
  }

  /**
   * 检查是否应该回滚（性能下降时）
   */
  shouldRollback(currentPerformance: { avgSuccessRate: number }, lookback: number = 5): {
    shouldRollback: boolean;
    reason?: string;
    targetVersion?: SelfPromptVersion;
  } {
    if (this.versions.length < lookback + 1) {
      return { shouldRollback: false };
    }

    const recentVersions = this.versions.slice(-lookback);
    const avgPastPerformance = recentVersions.reduce(
      (sum, v) => sum + v.performanceSnapshot.avgSuccessRate, 0
    ) / recentVersions.length;

    // 如果当前性能比过去平均值低15%以上，建议回滚
    if (currentPerformance.avgSuccessRate < avgPastPerformance * 0.85) {
      // 找到性能最好的历史版本
      const bestVersion = recentVersions.reduce((best, current) =>
        current.performanceSnapshot.avgSuccessRate > best.performanceSnapshot.avgSuccessRate
          ? current
          : best
      );

      return {
        shouldRollback: true,
        reason: `Performance dropped from ${avgPastPerformance.toFixed(2)} to ${currentPerformance.avgSuccessRate.toFixed(2)}`,
        targetVersion: bestVersion,
      };
    }

    return { shouldRollback: false };
  }

  /**
   * 获取版本历史
   */
  getVersionHistory(): SelfPromptVersion[] {
    return [...this.versions];
  }

  /**
   * 获取最新版本
   */
  getLatestVersion(): SelfPromptVersion | null {
    return this.versions[this.versions.length - 1] || null;
  }

  /**
   * 持久化
   */
  private async persist(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.writeFile(
        path.join(this.dataDir, 'self-prompt-versions.json'),
        JSON.stringify(this.versions, null, 2),
        'utf-8'
      );
    } catch (error) {
      this.emit('error', { type: 'persist', error });
    }
  }

  /**
   * 加载版本
   */
  private async loadVersions(): Promise<void> {
    try {
      const data = await fs.readFile(
        path.join(this.dataDir, 'self-prompt-versions.json'),
        'utf-8'
      );
      this.versions = JSON.parse(data);
    } catch {
      // 文件不存在
    }
  }
}

// ============================================================================
// 硬自指架构 - 准备阶段
// ============================================================================

/**
 * 硬自指管理器
 * 
 * 第二阶段实现：Agent修改自己的源代码
 * 当前为准备阶段，定义接口和架构
 */
export class HardSelfReferenceManager extends EventEmitter {
  private codeBasePath: string;
  private modificationProposals: Array<{
    id: string;
    timestamp: number;
    type: 'add_tool' | 'modify_logic' | 'optimize_performance' | 'fix_bug';
    description: string;
    targetFile: string;
    proposedCode: string;
    safetyChecks: string[];
    status: 'proposed' | 'validated' | 'approved' | 'rejected' | 'applied';
  }> = [];

  constructor(codeBasePath: string) {
    super();
    this.codeBasePath = codeBasePath;
  }

  /**
   * 提议代码修改
   */
  proposeModification(proposal: Omit<typeof this.modificationProposals[0], 'id' | 'timestamp' | 'status'>): string {
    const id = crypto.randomUUID();
    
    this.modificationProposals.push({
      ...proposal,
      id,
      timestamp: Date.now(),
      status: 'proposed',
    });

    this.emit('modificationProposed', { id, proposal });
    return id;
  }

  /**
   * 验证代码修改（模拟）
   */
  async validateModification(proposalId: string): Promise<{
    valid: boolean;
    issues: string[];
    safetyScore: number;
  }> {
    const proposal = this.modificationProposals.find(p => p.id === proposalId);
    if (!proposal) {
      return { valid: false, issues: ['Proposal not found'], safetyScore: 0 };
    }

    const issues: string[] = [];
    let safetyScore = 1.0;

    // 安全检查1: 是否修改核心系统文件
    if (proposal.targetFile.includes('safety') || proposal.targetFile.includes('security')) {
      issues.push('Modification targets safety-critical file');
      safetyScore -= 0.3;
    }

    // 安全检查2: 是否包含危险代码模式
    const dangerousPatterns = ['eval(', 'child_process', 'fs.unlinkSync'];
    for (const pattern of dangerousPatterns) {
      if (proposal.proposedCode.includes(pattern)) {
        issues.push(`Contains dangerous pattern: ${pattern}`);
        safetyScore -= 0.2;
      }
    }

    // 安全检查3: 是否有足够的测试覆盖
    if (!proposal.safetyChecks.includes('unit_tests')) {
      issues.push('Missing unit test verification');
      safetyScore -= 0.1;
    }

    proposal.status = issues.length > 0 ? 'rejected' : 'validated';

    return {
      valid: issues.length === 0,
      issues,
      safetyScore: Math.max(0, safetyScore),
    };
  }

  /**
   * 应用代码修改（需要双重确认）
   */
  async applyModification(proposalId: string, confirmation: {
    humanApproved: boolean;
    automatedTestsPassed: boolean;
    backupCreated: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    if (!confirmation.humanApproved) {
      return { success: false, error: 'Human approval required for code modification' };
    }

    if (!confirmation.automatedTestsPassed) {
      return { success: false, error: 'Automated tests must pass' };
    }

    if (!confirmation.backupCreated) {
      return { success: false, error: 'Backup must be created before modification' };
    }

    const proposal = this.modificationProposals.find(p => p.id === proposalId);
    if (!proposal) {
      return { success: false, error: 'Proposal not found' };
    }

    // 实际应用修改（简化版）
    try {
      // 1. 备份原文件
      const backupPath = `${proposal.targetFile}.backup-${Date.now()}`;
      await fs.copyFile(
        path.join(this.codeBasePath, proposal.targetFile),
        path.join(this.codeBasePath, backupPath)
      );

      // 2. 写入新代码（实际实现中需要更谨慎）
      await fs.writeFile(
        path.join(this.codeBasePath, proposal.targetFile),
        proposal.proposedCode,
        'utf-8'
      );

      proposal.status = 'applied';
      this.emit('modificationApplied', { proposalId, backupPath });

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * 获取所有修改提议
   */
  getProposals(): typeof this.modificationProposals {
    return [...this.modificationProposals];
  }

  /**
   * 生成代码修改建议（基于反思结果）
   */
  generateModificationSuggestions(reflectionResult: {
    insights: Array<{ category: string; insight: string; actionItems: string[] }>;
    learningDirections: string[];
  }): Array<Omit<typeof this.modificationProposals[0], 'id' | 'timestamp' | 'status'>> {
    const suggestions: Array<Omit<typeof this.modificationProposals[0], 'id' | 'timestamp' | 'status'>> = [];

    // 分析反思结果，生成代码修改建议
    for (const insight of reflectionResult.insights) {
      if (insight.category === 'limitation') {
        // 识别到限制，建议添加新工具
        suggestions.push({
          type: 'add_tool',
          description: `Add tool to address: ${insight.insight}`,
          targetFile: 'src/execution/tools/index.ts',
          proposedCode: `// Auto-generated tool based on reflection\nexport const newTool = {...}`,
          safetyChecks: ['unit_tests', 'integration_tests'],
        });
      }
    }

    return suggestions;
  }
}

// ============================================================================
// 增强版 UnifiedAgent（集成软自指）
// ============================================================================

export interface EnhancedUnifiedAgentConfig extends UnifiedAgentConfig {
  softSelfReference: {
    enabled: boolean;
    dataDir: string;
    maxContextWindow: number;
    systemSafetyRules: string[];
    forbiddenActions: string[];
  };
  abTesting: {
    enabled: boolean;
    minSamplesForComparison: number;
    confidenceThreshold: number;
  };
  versionControl: {
    enabled: boolean;
    maxVersions: number;
    autoRollbackThreshold: number;
  };
  hardSelfReference: {
    enabled: boolean;
    codeBasePath: string;
    requireHumanApproval: boolean;
  };
}

export class EnhancedUnifiedAgent extends EventEmitter {
  // 原有子系统
  public scheduler: Scheduler;
  public hormoneSystem: HormoneSystem;
  public bodySchema: BodySchemaManager;
  public memory: LayeredMemory;
  public bayesian: BayesianCore;
  public safety: SafetyEngine;

  // 软自指系统
  public promptAssembler: PromptAssembler;
  private abTestManager: ABTestManager;
  private versionManager: VersionRollbackManager;

  // 硬自指（准备阶段）
  private hardSelfRefManager: HardSelfReferenceManager | null = null;

  // 配置
  private config: EnhancedUnifiedAgentConfig;
  private tools: Map<string, ToolSkill> = new Map();
  private reflectionInterval: NodeJS.Timeout | null = null;
  private performanceWindow: Array<PerformanceMetrics & { timestamp: number }> = [];

  constructor(config: EnhancedUnifiedAgentConfig) {
    super();
    this.config = config;

    // 初始化原有子系统
    this.scheduler = new Scheduler(config.scheduler);
    this.hormoneSystem = new HormoneSystem();
    this.bodySchema = new BodySchemaManager();
    this.memory = new LayeredMemory(config.memory);
    this.bayesian = new BayesianCore();
    this.safety = new SafetyEngine(config.safety);

    // 初始化软自指系统
    if (config.softSelfReference?.enabled) {
      this.initializeSoftSelfReference();
    }

    // 初始化A/B测试
    if (config.abTesting?.enabled) {
      this.abTestManager = new ABTestManager(config.softSelfReference.dataDir);
    }

    // 初始化版本控制
    if (config.versionControl?.enabled) {
      this.versionManager = new VersionRollbackManager(config.softSelfReference.dataDir);
    }

    // 初始化硬自指（准备阶段）
    if (config.hardSelfReference?.enabled) {
      this.hardSelfRefManager = new HardSelfReferenceManager(config.hardSelfReference.codeBasePath);
    }

    // 设置事件监听
    this.setupEventListeners();
  }

  /**
   * 初始化软自指系统
   */
  private initializeSoftSelfReference(): void {
    this.promptAssembler = new PromptAssembler(
      {
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        safetyRules: this.config.softSelfReference.systemSafetyRules,
        forbiddenActions: this.config.softSelfReference.forbiddenActions,
      },
      path.join(this.config.softSelfReference.dataDir, 'self-prompt.json'),
      this.config.softSelfReference.maxContextWindow
    );

    // 订阅自我优化事件
    this.promptAssembler.getSelfManager().on('optimized', (record) => {
      this.emit('selfOptimized', record);
      
      // 保存版本
      if (this.versionManager) {
        const content = this.promptAssembler.getSelfManager().getContent();
        this.versionManager.saveVersion(
          content,
          {
            avgSuccessRate: this.calculateRecentSuccessRate(),
            avgTokenEfficiency: this.calculateRecentTokenEfficiency(),
          },
          record.changes.join(', ')
        );
      }

      // 检查是否需要回滚
      this.checkForRollback();
    });

    // 开始状态同步
    this.startStateSync();
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    // 稳态告警
    this.scheduler.on('homeostasisAlert', (status) => {
      this.hormoneSystem.adjustHormone(HormoneType.CORTISOL, 0.3, 'resource_stress');
      this.emit('homeostasisAlert', status);
    });

    // 攻击检测
    this.safety.on('attackDetected', (info) => {
      this.hormoneSystem.adjustHormone(HormoneType.ADRENALINE, 0.5, 'security_threat');
      this.emit('securityAlert', info);
    });

    // 记忆存储
    this.memory.on('memoryStored', (entry) => {
      this.hormoneSystem.adjustHormone(HormoneType.DOPAMINE, 0.05, 'learning');
    });
  }

  /**
   * 组装提示词（供模型调用使用）
   */
  assemblePrompt(userMessage: string): {
    prompt: string;
    totalTokens: number;
    truncated: boolean;
  } {
    if (!this.promptAssembler) {
      throw new Error('Soft self-reference not enabled');
    }

    // 获取相关记忆
    const recentMemories = this.getRecentMemories(20);
    const retrievedMemories = this.searchRelevantMemories(userMessage, 10);
    const summary = this.generateMemorySummary();

    const result = this.promptAssembler.assemble({
      userMessage,
      recentMemories,
      retrievedMemories,
      summary,
      context: {
        topic: this.inferTopic(userMessage),
        userIntent: this.inferIntent(userMessage),
        pendingQuestions: this.getPendingQuestions(),
        establishedFacts: this.getEstablishedFacts(),
      },
    });

    return {
      prompt: result.fullPrompt,
      totalTokens: result.totalTokens,
      truncated: result.truncated,
    };
  }

  /**
   * 记录性能反馈
   */
  async recordPerformance(metrics: PerformanceMetrics): Promise<void> {
    // 记录到窗口
    this.performanceWindow.push({ ...metrics, timestamp: Date.now() });
    if (this.performanceWindow.length > 100) {
      this.performanceWindow.shift();
    }

    // A/B测试统计
    if (this.abTestManager) {
      this.abTestManager.recordTaskResult(metrics.taskSuccess, metrics);
    }

    // 触发软自指优化
    if (this.promptAssembler) {
      const record = await this.promptAssembler.recordPerformance(metrics);
      
      if (record) {
        // 记录到记忆
        await this.memory.store(
          `Self-prompt optimized: ${record.strategy}. Changes: ${record.changes.join(', ')}`,
          'reflective',
          { importance: 0.9, tags: ['self_optimization', 'meta_learning'] }
        );

        // 激素反馈
        if (record.afterPerformance > record.beforePerformance) {
          this.hormoneSystem.adjustHormone(HormoneType.DOPAMINE, 0.1, 'optimization_success');
        } else {
          this.hormoneSystem.adjustHormone(HormoneType.CORTISOL, 0.05, 'optimization_ineffective');
        }
      }
    }

    // 检查是否触发硬自指（准备阶段）
    if (this.hardSelfRefManager && this.shouldConsiderHardSelfModification()) {
      this.emit('hardSelfModificationConsidered', {
        reason: 'Repeated performance issues detected',
        suggestion: 'Consider adding new tool or optimizing existing logic',
      });
    }
  }

  /**
   * 检查是否应该回滚
   */
  private checkForRollback(): void {
    if (!this.versionManager) return;

    const currentPerformance = {
      avgSuccessRate: this.calculateRecentSuccessRate(),
    };

    const rollbackCheck = this.versionManager.shouldRollback(currentPerformance);
    
    if (rollbackCheck.shouldRollback && rollbackCheck.targetVersion) {
      this.emit('rollbackRecommended', rollbackCheck);
      
      // 可以自动回滚或等待人工确认
      if (this.config.versionControl.autoRollbackThreshold > 0 &&
          currentPerformance.avgSuccessRate < this.config.versionControl.autoRollbackThreshold) {
        this.performRollback(rollbackCheck.targetVersion.id);
      }
    }
  }

  /**
   * 执行回滚
   */
  async performRollback(versionId: string): Promise<boolean> {
    const version = this.versionManager?.rollbackToVersion(versionId);
    if (!version) return false;

    // 应用旧版本内容
    const selfManager = this.promptAssembler?.getSelfManager();
    if (selfManager) {
      // 这里需要通过某种方式应用旧版本内容
      // 实际实现中可能需要暴露更多API
      this.emit('rollbackPerformed', version);
      return true;
    }

    return false;
  }

  /**
   * 同步状态到自我提示词
   */
  private startStateSync(): void {
    setInterval(() => {
      const selfManager = this.promptAssembler?.getSelfManager();
      if (!selfManager) return;

      // 同步激素状态
      const hormoneState = this.hormoneSystem.getState();
      selfManager.updateState({
        hormoneLevels: {
          adrenaline: hormoneState.adrenaline,
          cortisol: hormoneState.cortisol,
          dopamine: hormoneState.dopamine,
          serotonin: hormoneState.serotonin,
          curiosity: hormoneState.curiosity,
        },
        activeTasks: this.scheduler.getStatus().runningCount,
        bodyStatus: this.getBodyStatus(),
        memoryStats: this.memory.getStats(),
      });

      // 同步工具置信度
      for (const belief of this.bayesian.getAllCapabilities()) {
        selfManager.updateToolConfidence(belief.capability, belief.confidence);
      }
    }, 30000);
  }

  // ============ 工具方法 ============

  private getRecentMemories(limit: number): MemoryPromptContent['recentMemories'] {
    // 从LayeredMemory获取最近记忆
    return []; // 简化实现
  }

  private searchRelevantMemories(query: string, limit: number): MemoryPromptContent['retrievedMemories'] {
    // 搜索相关记忆
    return []; // 简化实现
  }

  private generateMemorySummary(): MemoryPromptContent['summary'] {
    return {
      keyInsights: [],
      recurringPatterns: [],
      lessonsLearned: [],
    };
  }

  private inferTopic(message: string): string {
    return 'general';
  }

  private inferIntent(message: string): string {
    return 'conversation';
  }

  private getPendingQuestions(): string[] {
    return [];
  }

  private getEstablishedFacts(): string[] {
    return [];
  }

  private getBodyStatus(): string {
    const schema = this.bodySchema.getSchema();
    return schema.resources.memory.percent > 0.8 ? 'stressed' : 'healthy';
  }

  private calculateRecentSuccessRate(): number {
    if (this.performanceWindow.length === 0) return 0.5;
    const successes = this.performanceWindow.filter(m => m.taskSuccess).length;
    return successes / this.performanceWindow.length;
  }

  private calculateRecentTokenEfficiency(): number {
    if (this.performanceWindow.length === 0) return 0.5;
    const sum = this.performanceWindow.reduce((acc, m) => acc + (m.tokenEfficiency || 0), 0);
    return sum / this.performanceWindow.length;
  }

  private shouldConsiderHardSelfModification(): boolean {
    // 连续失败次数超过阈值时考虑硬自指
    const recentFailures = this.performanceWindow
      .slice(-10)
      .filter(m => !m.taskSuccess).length;
    return recentFailures >= 7;
  }

  // ============ 公共API ============

  async start(): Promise<void> {
    this.scheduler.start();
    
    await this.memory.store(
      `Enhanced Agent started with soft self-reference: ${this.config.softSelfReference?.enabled}`,
      'episodic',
      { importance: 1.0, tags: ['system', 'startup'] }
    );

    this.emit('started');
  }

  async stop(): Promise<void> {
    if (this.reflectionInterval) {
      clearInterval(this.reflectionInterval);
    }
    this.scheduler.stop();
    this.emit('stopped');
  }

  getStatus() {
    return {
      scheduler: this.scheduler.getStatus(),
      hormones: this.hormoneSystem.getState(),
      body: this.bodySchema.getSchema(),
      memory: this.memory.getStats(),
      capabilities: this.bayesian.getAllCapabilities(),
      softSelfReference: this.config.softSelfReference?.enabled,
      abTesting: this.config.abTesting?.enabled,
      versionControl: this.config.versionControl?.enabled,
    };
  }
}

export default EnhancedUnifiedAgent;
