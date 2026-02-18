/**
 * 硬自指系统 - Phase 2 完整实现
 * 
 * 核心能力：Agent修改自己的源代码
 * 
 * 安全机制：
 * 1. 沙箱测试环境
 * 2. 自动回滚机制
 * 3. 代码审查流水线
 * 4. 渐进式部署
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import * as crypto from 'crypto';

// ============================================================================
// 类型定义
// ============================================================================

/** 代码修改类型 */
export enum ModificationType {
  ADD_TOOL = 'add_tool',           // 添加新工具
  MODIFY_LOGIC = 'modify_logic',   // 修改业务逻辑
  OPTIMIZE_PERFORMANCE = 'optimize_performance', // 性能优化
  FIX_BUG = 'fix_bug',             // 修复bug
  REFACTOR = 'refactor',           // 代码重构
  UPDATE_CONFIG = 'update_config', // 更新配置
}

/** 修改状态 */
export enum ModificationStatus {
  PROPOSED = 'proposed',       // 已提议
  VALIDATING = 'validating',   // 验证中
  SANDBOX_TESTING = 'sandbox_testing', // 沙箱测试
  CODE_REVIEW = 'code_review', // 代码审查
  APPROVED = 'approved',       // 已批准
  REJECTED = 'rejected',       // 已拒绝
  DEPLOYING = 'deploying',     // 部署中
  DEPLOYED = 'deployed',       // 已部署
  ROLLED_BACK = 'rolled_back', // 已回滚
}

/** 代码修改提议 */
export interface CodeModification {
  id: string;
  timestamp: number;
  type: ModificationType;
  description: string;
  reasoning: string;           // 为什么需要这个修改
  targetFiles: Array<{
    path: string;
    originalContent: string;
    proposedContent: string;
    diff: string;
  }>;
  safetyChecks: {
    staticAnalysis: boolean;
    noDangerousPatterns: boolean;
    testCoverage: boolean;
    backupCreated: boolean;
  };
  testResults?: {
    unitTestsPassed: boolean;
    integrationTestsPassed: boolean;
    performanceBenchmark?: {
      before: number;
      after: number;
      improvement: number;
    };
  };
  reviewComments: Array<{
    reviewer: 'human' | 'ai' | 'automated';
    comment: string;
    severity: 'info' | 'warning' | 'critical';
    resolved: boolean;
  }>;
  status: ModificationStatus;
  deployedAt?: number;
  rolledBackAt?: number;
  rollbackReason?: string;
}

/** 部署配置 */
export interface DeploymentConfig {
  strategy: 'hot_reload' | 'rolling_restart' | 'full_restart';
  healthCheckTimeout: number;
  autoRollbackOnFailure: boolean;
  canaryPercentage?: number;   // 金丝雀部署比例
  requireHumanApproval: boolean;
}

/** 沙箱测试结果 */
export interface SandboxTestResult {
  success: boolean;
  duration: number;
  logs: string[];
  errors: string[];
  performanceMetrics?: {
    cpuUsage: number;
    memoryUsage: number;
    responseTime: number;
  };
}

// ============================================================================
// 代码安全分析器
// ============================================================================

export class CodeSafetyAnalyzer extends EventEmitter {
  private dangerousPatterns: Array<{
    pattern: RegExp;
    description: string;
    severity: 'critical' | 'warning';
  }> = [
    {
      pattern: /eval\s*\(/,
      description: 'Use of eval() can lead to code injection',
      severity: 'critical',
    },
    {
      pattern: /new\s+Function\s*\(/,
      description: 'Function constructor can execute arbitrary code',
      severity: 'critical',
    },
    {
      pattern: /child_process/,
      description: 'Direct use of child_process can be dangerous',
      severity: 'warning',
    },
    {
      pattern: /fs\.unlinkSync\s*\(/,
      description: 'Synchronous file deletion without validation',
      severity: 'warning',
    },
    {
      pattern: /process\.exit\s*\(/,
      description: 'Process exit can cause unexpected shutdowns',
      severity: 'warning',
    },
    {
      pattern: /require\s*\(\s*['"]`[^'"`]+['"`]/,
      description: 'Dynamic require with variable path',
      severity: 'warning',
    },
  ];

  private protectedFiles = [
    'safety',
    'security',
    'auth',
    'encryption',
    'core',
  ];

  /**
   * 分析代码安全性
   */
  analyze(code: string, filePath: string): {
    safe: boolean;
    issues: Array<{
      line: number;
      severity: string;
      description: string;
    }>;
    score: number;  // 0-1
  } {
    const issues: Array<{ line: number; severity: string; description: string }> = [];
    let score = 1.0;

    // 检查危险模式
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const { pattern, description, severity } of this.dangerousPatterns) {
        if (pattern.test(lines[i])) {
          issues.push({
            line: i + 1,
            severity,
            description,
          });
          score -= severity === 'critical' ? 0.3 : 0.1;
        }
      }
    }

    // 检查是否修改受保护文件
    for (const protectedPattern of this.protectedFiles) {
      if (filePath.includes(protectedPattern)) {
        issues.push({
          line: 0,
          severity: 'critical',
          description: `Modification to protected file: ${protectedPattern}`,
        });
        score -= 0.2;
      }
    }

    // 检查代码复杂度
    if (code.length > 5000) {
      issues.push({
        line: 0,
        severity: 'warning',
        description: 'Large code block, consider splitting into smaller functions',
      });
      score -= 0.05;
    }

    return {
      safe: issues.filter(i => i.severity === 'critical').length === 0,
      issues,
      score: Math.max(0, score),
    };
  }

  /**
   * 生成代码diff
   */
  generateDiff(original: string, modified: string, filePath: string): string {
    // 简化版diff生成
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');
    
    let diff = `--- ${filePath}\n+++ ${filePath}\n`;
    
    // 找出修改的行（简化实现）
    for (let i = 0; i < Math.max(originalLines.length, modifiedLines.length); i++) {
      const orig = originalLines[i];
      const mod = modifiedLines[i];
      
      if (orig !== mod) {
        if (orig) diff += `- ${orig}\n`;
        if (mod) diff += `+ ${mod}\n`;
      }
    }
    
    return diff;
  }
}

// ============================================================================
// 沙箱测试环境
// ============================================================================

export class SandboxEnvironment extends EventEmitter {
  private sandboxDir: string;
  private timeout: number;

  constructor(workDir: string, timeout: number = 60000) {
    super();
    this.sandboxDir = path.join(workDir, 'sandbox');
    this.timeout = timeout;
  }

  /**
   * 设置沙箱环境
   */
  async setup(originalCode: Map<string, string>): Promise<void> {
    // 清理旧沙箱
    try {
      await fs.rm(this.sandboxDir, { recursive: true });
    } catch {}

    // 创建新沙箱
    await fs.mkdir(this.sandboxDir, { recursive: true });

    // 复制原始代码到沙箱
    for (const [filePath, content] of originalCode) {
      const fullPath = path.join(this.sandboxDir, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
    }

    // 复制package.json和tsconfig.json
    await fs.copyFile(
      './package.json',
      path.join(this.sandboxDir, 'package.json')
    );
  }

  /**
   * 在沙箱中应用修改
   */
  async applyModification(files: Array<{ path: string; content: string }>): Promise<void> {
    for (const { path: filePath, content } of files) {
      const fullPath = path.join(this.sandboxDir, filePath);
      await fs.writeFile(fullPath, content, 'utf-8');
    }
  }

  /**
   * 在沙箱中运行测试
   */
  async runTests(): Promise<SandboxTestResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    const errors: string[] = [];

    try {
      // 安装依赖
      logs.push('Installing dependencies...');
      execSync('npm install', {
        cwd: this.sandboxDir,
        stdio: 'pipe',
        timeout: 120000,
      });

      // 编译TypeScript
      logs.push('Compiling TypeScript...');
      execSync('npx tsc --noEmit', {
        cwd: this.sandboxDir,
        stdio: 'pipe',
        timeout: 60000,
      });

      // 运行测试
      logs.push('Running tests...');
      execSync('npm test -- --forceExit', {
        cwd: this.sandboxDir,
        stdio: 'pipe',
        timeout: this.timeout,
      });

      logs.push('All tests passed!');

      return {
        success: true,
        duration: Date.now() - startTime,
        logs,
        errors,
      };
    } catch (error) {
      errors.push(String(error));
      return {
        success: false,
        duration: Date.now() - startTime,
        logs,
        errors,
      };
    }
  }

  /**
   * 性能基准测试
   */
  async runBenchmark(iterations: number = 100): Promise<{
    avgResponseTime: number;
    memoryUsage: number;
    cpuUsage: number;
  }> {
    // 简化版基准测试
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      // 模拟工作负载
      await new Promise(resolve => setTimeout(resolve, 1));
      const end = process.hrtime.bigint();
      times.push(Number(end - start) / 1000000); // 转换为毫秒
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const memUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB

    return {
      avgResponseTime: avgTime,
      memoryUsage: memUsage,
      cpuUsage: 0, // 简化版不测CPU
    };
  }

  /**
   * 清理沙箱
   */
  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.sandboxDir, { recursive: true });
    } catch {}
  }
}

// ============================================================================
// 部署管理器
// ============================================================================

export class DeploymentManager extends EventEmitter {
  private codeBasePath: string;
  private backupsDir: string;
  private config: DeploymentConfig;

  constructor(codeBasePath: string, config: DeploymentConfig) {
    super();
    this.codeBasePath = codeBasePath;
    this.backupsDir = path.join(codeBasePath, '..', '.backups');
    this.config = config;
  }

  /**
   * 创建备份
   */
  async createBackup(modificationId: string): Promise<string> {
    const backupPath = path.join(this.backupsDir, `backup-${modificationId}-${Date.now()}`);
    
    await fs.mkdir(this.backupsDir, { recursive: true });
    
    // 递归复制源代码目录
    await this.copyDirectory(this.codeBasePath, backupPath);
    
    return backupPath;
  }

  /**
   * 复制目录
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.backups') {
          await this.copyDirectory(srcPath, destPath);
        }
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * 应用修改到生产环境
   */
  async deploy(modification: CodeModification): Promise<{
    success: boolean;
    error?: string;
    healthCheck?: {
      passed: boolean;
      responseTime: number;
    };
  }> {
    this.emit('deploying', { modificationId: modification.id });

    try {
      // 1. 应用文件修改
      for (const file of modification.targetFiles) {
        const fullPath = path.join(this.codeBasePath, file.path);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, file.proposedContent, 'utf-8');
      }

      this.emit('deployed', { modificationId: modification.id });

      // 2. 健康检查
      const healthCheck = await this.performHealthCheck();
      
      if (!healthCheck.passed && this.config.autoRollbackOnFailure) {
        await this.rollback(modification);
        return {
          success: false,
          error: 'Health check failed, auto-rollback performed',
          healthCheck,
        };
      }

      return {
        success: true,
        healthCheck,
      };
    } catch (error) {
      if (this.config.autoRollbackOnFailure) {
        await this.rollback(modification);
      }
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<{
    passed: boolean;
    responseTime: number;
  }> {
    const start = Date.now();
    
    try {
      // 尝试导入主模块
      const agent = await import(path.join(this.codeBasePath, 'enhanced-unified-agent.js'));
      
      // 验证基本功能
      if (agent.EnhancedUnifiedAgent) {
        return {
          passed: true,
          responseTime: Date.now() - start,
        };
      }
      
      return {
        passed: false,
        responseTime: Date.now() - start,
      };
    } catch {
      return {
        passed: false,
        responseTime: Date.now() - start,
      };
    }
  }

  /**
   * 回滚修改
   */
  async rollback(modification: CodeModification): Promise<void> {
    this.emit('rollingBack', { modificationId: modification.id });

    // 恢复原始文件内容
    for (const file of modification.targetFiles) {
      const fullPath = path.join(this.codeBasePath, file.path);
      await fs.writeFile(fullPath, file.originalContent, 'utf-8');
    }

    this.emit('rolledBack', { modificationId: modification.id });
  }

  /**
   * 从备份恢复
   */
  async restoreFromBackup(backupPath: string): Promise<void> {
    // 清理当前代码
    await fs.rm(this.codeBasePath, { recursive: true });
    
    // 从备份恢复
    await this.copyDirectory(backupPath, this.codeBasePath);
  }
}

// ============================================================================
// 硬自指管理器 - 完整实现
// ============================================================================

export class HardSelfReferenceEngine extends EventEmitter {
  private codeBasePath: string;
  private workDir: string;
  private safetyAnalyzer: CodeSafetyAnalyzer;
  private sandbox: SandboxEnvironment;
  private deploymentManager: DeploymentManager;
  private modifications: Map<string, CodeModification> = new Map();

  constructor(
    codeBasePath: string,
    config: {
      workDir: string;
      sandboxTimeout: number;
      deployment: DeploymentConfig;
    }
  ) {
    super();
    this.codeBasePath = codeBasePath;
    this.workDir = config.workDir;
    this.safetyAnalyzer = new CodeSafetyAnalyzer();
    this.sandbox = new SandboxEnvironment(config.workDir, config.sandboxTimeout);
    this.deploymentManager = new DeploymentManager(codeBasePath, config.deployment);

    // 监听部署事件
    this.deploymentManager.on('deployed', ({ modificationId }) => {
      this.emit('codeDeployed', { modificationId });
    });

    this.deploymentManager.on('rolledBack', ({ modificationId }) => {
      this.emit('codeRolledBack', { modificationId });
    });
  }

  /**
   * 提议代码修改（完整流程）
   */
  async proposeModification(
    type: ModificationType,
    description: string,
    reasoning: string,
    changes: Array<{
      filePath: string;
      proposedContent: string;
    }>
  ): Promise<CodeModification> {
    const id = crypto.randomUUID();

    // 读取原始文件内容
    const targetFiles: CodeModification['targetFiles'] = [];
    for (const { filePath, proposedContent } of changes) {
      const fullPath = path.join(this.codeBasePath, filePath);
      let originalContent = '';
      
      try {
        originalContent = await fs.readFile(fullPath, 'utf-8');
      } catch {
        // 文件不存在，视为新文件
      }

      const diff = this.safetyAnalyzer.generateDiff(
        originalContent,
        proposedContent,
        filePath
      );

      targetFiles.push({
        path: filePath,
        originalContent,
        proposedContent,
        diff,
      });
    }

    const modification: CodeModification = {
      id,
      timestamp: Date.now(),
      type,
      description,
      reasoning,
      targetFiles,
      safetyChecks: {
        staticAnalysis: false,
        noDangerousPatterns: false,
        testCoverage: false,
        backupCreated: false,
      },
      reviewComments: [],
      status: ModificationStatus.PROPOSED,
    };

    this.modifications.set(id, modification);

    // 自动开始验证流程
    this.validateModification(id);

    return modification;
  }

  /**
   * 验证修改（自动流水线）
   */
  private async validateModification(id: string): Promise<void> {
    const modification = this.modifications.get(id);
    if (!modification) return;

    modification.status = ModificationStatus.VALIDATING;
    this.emit('validating', { modificationId: id });

    // 1. 静态代码分析
    let allSafe = true;
    for (const file of modification.targetFiles) {
      const analysis = this.safetyAnalyzer.analyze(
        file.proposedContent,
        file.path
      );

      if (!analysis.safe) {
        allSafe = false;
        for (const issue of analysis.issues) {
          modification.reviewComments.push({
            reviewer: 'automated',
            comment: `${issue.description} (line ${issue.line})`,
            severity: issue.severity as 'info' | 'warning' | 'critical',
            resolved: false,
          });
        }
      }
    }

    modification.safetyChecks.staticAnalysis = true;
    modification.safetyChecks.noDangerousPatterns = allSafe;

    if (!allSafe) {
      modification.status = ModificationStatus.REJECTED;
      this.emit('rejected', { modificationId: id, reason: 'Safety check failed' });
      return;
    }

    // 2. 创建备份
    await this.deploymentManager.createBackup(id);
    modification.safetyChecks.backupCreated = true;

    // 3. 沙箱测试
    modification.status = ModificationStatus.SANDBOX_TESTING;
    this.emit('sandboxTesting', { modificationId: id });

    const originalCode = new Map<string, string>();
    for (const file of modification.targetFiles) {
      originalCode.set(file.path, file.originalContent);
    }

    await this.sandbox.setup(originalCode);
    await this.sandbox.applyModification(
      modification.targetFiles.map(f => ({
        path: f.path,
        content: f.proposedContent,
      }))
    );

    const testResult = await this.sandbox.runTests();
    await this.sandbox.cleanup();

    modification.testResults = {
      unitTestsPassed: testResult.success,
      integrationTestsPassed: testResult.success,
    };
    modification.safetyChecks.testCoverage = testResult.success;

    if (!testResult.success) {
      modification.status = ModificationStatus.REJECTED;
      this.emit('rejected', {
        modificationId: id,
        reason: 'Tests failed',
        logs: testResult.logs,
        errors: testResult.errors,
      });
      return;
    }

    // 4. 等待人工审查（如果配置需要）
    modification.status = ModificationStatus.CODE_REVIEW;
    this.emit('awaitingReview', { modificationId: id });

    if (!this.deploymentManager['config'].requireHumanApproval) {
      // 自动批准
      await this.approveModification(id);
    }
  }

  /**
   * 人工批准修改
   */
  async approveModification(id: string, reviewer?: string): Promise<void> {
    const modification = this.modifications.get(id);
    if (!modification) throw new Error('Modification not found');

    modification.status = ModificationStatus.APPROVED;
    if (reviewer) {
      modification.reviewComments.push({
        reviewer: 'human',
        comment: `Approved by ${reviewer}`,
        severity: 'info',
        resolved: true,
      });
    }

    this.emit('approved', { modificationId: id });

    // 自动部署
    await this.deployModification(id);
  }

  /**
   * 拒绝修改
   */
  rejectModification(id: string, reason: string): void {
    const modification = this.modifications.get(id);
    if (!modification) return;

    modification.status = ModificationStatus.REJECTED;
    modification.reviewComments.push({
      reviewer: 'human',
      comment: `Rejected: ${reason}`,
      severity: 'critical',
      resolved: false,
    });

    this.emit('rejected', { modificationId: id, reason });
  }

  /**
   * 部署修改
   */
  private async deployModification(id: string): Promise<void> {
    const modification = this.modifications.get(id);
    if (!modification) return;

    modification.status = ModificationStatus.DEPLOYING;
    this.emit('deploying', { modificationId: id });

    const result = await this.deploymentManager.deploy(modification);

    if (result.success) {
      modification.status = ModificationStatus.DEPLOYED;
      modification.deployedAt = Date.now();
    } else {
      modification.status = ModificationStatus.ROLLED_BACK;
      modification.rolledBackAt = Date.now();
      modification.rollbackReason = result.error;
    }
  }

  /**
   * 手动回滚
   */
  async rollbackModification(id: string, reason: string): Promise<void> {
    const modification = this.modifications.get(id);
    if (!modification) return;

    await this.deploymentManager.rollback(modification);
    
    modification.status = ModificationStatus.ROLLED_BACK;
    modification.rolledBackAt = Date.now();
    modification.rollbackReason = reason;
  }

  /**
   * 获取所有修改
   */
  getModifications(): CodeModification[] {
    return Array.from(this.modifications.values());
  }

  /**
   * 获取单个修改
   */
  getModification(id: string): CodeModification | undefined {
    return this.modifications.get(id);
  }

  /**
   * 基于反思自动生成修改建议
   */
  async generateModificationFromReflection(
    reflection: {
      insights: Array<{
        category: string;
        insight: string;
        actionItems: string[];
      }>;
      learningDirections: string[];
    }
  ): Promise<Array<Omit<CodeModification, 'id' | 'timestamp' | 'status' | 'safetyChecks' | 'reviewComments'>>> {
    const suggestions: Array<Omit<CodeModification, 'id' | 'timestamp' | 'status' | 'safetyChecks' | 'reviewComments'>> = [];

    for (const insight of reflection.insights) {
      if (insight.category === 'limitation') {
        // 识别到限制，建议添加新工具
        const toolName = insight.insight.toLowerCase().replace(/\s+/g, '_').slice(0, 30);
        
        suggestions.push({
          type: ModificationType.ADD_TOOL,
          description: `Add tool to address: ${insight.insight}`,
          reasoning: `Based on reflection: ${insight.insight}\nAction items: ${insight.actionItems.join(', ')}`,
          targetFiles: [
            {
              path: `src/execution/tools/${toolName}.ts`,
              originalContent: '',
              proposedContent: this.generateToolTemplate(toolName, insight.insight),
              diff: '', // 新文件
            },
          ],
        });
      }

      if (insight.category === 'error') {
        // 识别到错误，建议修复
        suggestions.push({
          type: ModificationType.FIX_BUG,
          description: `Fix bug: ${insight.insight}`,
          reasoning: `Error pattern detected: ${insight.insight}`,
          targetFiles: [], // 需要具体分析
        });
      }
    }

    return suggestions;
  }

  /**
   * 生成工具模板
   */
  private generateToolTemplate(name: string, description: string): string {
    return `/**
 * ${name} Tool
 * Auto-generated based on self-reflection
 * 
 * Purpose: ${description}
 */

import { ToolSkill } from '../tool-registry.js';

export const ${name}Tool: ToolSkill = {
  name: '${name}',
  description: '${description}',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input for the tool' },
    },
    required: ['input'],
  },
  execute: async (args: unknown) => {
    const { input } = args as { input: string };
    
    // TODO: Implement tool logic
    return { result: \`Processed: \${input}\` };
  },
};

export default ${name}Tool;
`;
  }
}

export default HardSelfReferenceEngine;
