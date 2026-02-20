/**
 * @file core/cognition/thinking/engine.ts
 * @description 思维链执行引擎 - 执行和管理思考过程
 */

import { createContextLogger } from '@/utils/logger';
import { ProblemClassifier, type ClassificationResult } from './classifier';
import {
  ThinkingTemplate,
  ThinkingStep,
  ThinkingTemplateManager,
} from './templates';

const logger = createContextLogger('ChainOfThoughtEngine');

/**
 * 思考步骤结果
 */
export interface ThoughtStep {
  id: string;
  name: string;
  content: string;
  timestamp: Date;
  durationMs: number;
  quality?: number;
}

/**
 * 思维链结果
 */
export interface ThinkingChain {
  id: string;
  problem: string;
  classification: ClassificationResult;
  template: ThinkingTemplate;
  steps: ThoughtStep[];
  finalAnswer?: string;
  totalDurationMs: number;
  createdAt: Date;
  metadata?: Record<string, any>;
}

/**
 * 思维链选项
 */
export interface ThinkingOptions {
  enableThinkingOutput?: boolean;  // 是否输出思考过程
  maxSteps?: number;               // 最大步骤数
  timeoutMs?: number;              // 超时时间
  complexity?: 'simple' | 'moderate' | 'complex';
  exploreBranches?: boolean;       // 是否探索多个分支
  maxBranches?: number;            // 最大分支数
}

/**
 * 思维分支（用于 Tree of Thoughts）
 */
export interface ThoughtBranch {
  id: string;
  approach: string;
  chain: ThinkingChain;
  evaluation: BranchEvaluation;
}

interface BranchEvaluation {
  completeness: number;
  coherence: number;
  depth: number;
  overall: number;
}

/**
 * 思维链执行引擎
 */
export class ChainOfThoughtEngine {
  private classifier: ProblemClassifier;
  private templateManager: ThinkingTemplateManager;
  private activeChains: Map<string, ThinkingChain> = new Map();

  constructor(
    classifier: ProblemClassifier = new ProblemClassifier(),
    templateManager: ThinkingTemplateManager = new ThinkingTemplateManager()
  ) {
    this.classifier = classifier;
    this.templateManager = templateManager;
  }

  /**
   * 执行思维链
   */
  async execute(
    problem: string,
    options: ThinkingOptions = {},
    modelCaller: (prompt: string) => Promise<string>
  ): Promise<ThinkingChain> {
    const startTime = Date.now();
    const chainId = this.generateId();

    logger.info('开始思维链', { chainId, problem: problem.slice(0, 100) });

    try {
      // 1. 分类问题
      const classification = this.classifier.classify(problem);
      logger.debug('问题分类', { chainId, classification });

      // 2. 选择模板
      const template = this.selectTemplate(classification, options.complexity);
      if (!template) {
        throw new Error('没有合适的思维模板');
      }
      logger.debug('选择模板', { chainId, templateId: template.id });

      // 3. 初始化思维链
      const chain: ThinkingChain = {
        id: chainId,
        problem,
        classification,
        template,
        steps: [],
        totalDurationMs: 0,
        createdAt: new Date(),
      };

      this.activeChains.set(chainId, chain);

      // 4. 执行每个思考步骤
      const maxSteps = options.maxSteps || template.steps.length;
      for (let i = 0; i < Math.min(maxSteps, template.steps.length); i++) {
        const step = template.steps[i];
        const stepStartTime = Date.now();

        logger.debug('执行思考步骤', { chainId, stepId: step.id, stepName: step.name });

        // 构建步骤提示词
        const stepPrompt = this.buildStepPrompt(step, problem, chain);

        // 调用模型进行思考
        const stepContent = await modelCaller(stepPrompt);

        const stepResult: ThoughtStep = {
          id: step.id,
          name: step.name,
          content: stepContent,
          timestamp: new Date(),
          durationMs: Date.now() - stepStartTime,
        };

        chain.steps.push(stepResult);

        // 评估步骤质量（可选）
        if (step.verification) {
          stepResult.quality = await this.assessStepQuality(
            step,
            stepContent,
            modelCaller
          );

          // 如果质量太低，可能需要重新思考
          if (stepResult.quality < 0.4) {
            logger.warn('步骤质量低，重新思考', {
              chainId,
              stepId: step.id,
              quality: stepResult.quality,
            });

            // 重新执行这一步
            const retryContent = await modelCaller(
              `${stepPrompt}\n\n注意：之前的思考不够深入，请更加详细和严谨。`
            );
            stepResult.content = retryContent;
            stepResult.quality = await this.assessStepQuality(
              step,
              retryContent,
              modelCaller
            );
          }
        }

        // 检查是否超时
        if (options.timeoutMs && Date.now() - startTime > options.timeoutMs) {
          logger.warn('思维链超时', { chainId, elapsedMs: Date.now() - startTime });
          break;
        }
      }

      // 5. 生成最终答案
      chain.finalAnswer = await this.synthesizeAnswer(chain, modelCaller);
      chain.totalDurationMs = Date.now() - startTime;

      // 6. 更新模板统计
      this.templateManager.updateStats(template.id, true, 0.7);

      logger.info('思维链完成', {
        chainId,
        stepsCount: chain.steps.length,
        totalDurationMs: chain.totalDurationMs,
      });

      return chain;
    } catch (error) {
      logger.error('思维链执行失败', { chainId, error });
      throw error;
    } finally {
      this.activeChains.delete(chainId);
    }
  }

  /**
   * Tree of Thoughts: 探索多个思维分支
   */
  async exploreBranches(
    problem: string,
    options: ThinkingOptions = {},
    modelCaller: (prompt: string) => Promise<string>
  ): Promise<ThoughtBranch[]> {
    const maxBranches = options.maxBranches || 3;
    const branches: ThoughtBranch[] = [];

    logger.info('开始探索思维分支', { problem: problem.slice(0, 100), maxBranches });

    // 生成不同的思考角度
    const approaches = [
      '系统分析角度：拆解问题的各个组成部分',
      '第一性原理角度：从最基本的事实出发推理',
      '类比角度：用相似领域的知识类比',
      '逆向角度：从目标倒推路径',
      '多角度视角：考虑不同利益相关者的观点',
    ];

    for (let i = 0; i < Math.min(maxBranches, approaches.length); i++) {
      const approach = approaches[i];

      // 为这个角度创建一个变体提示词
      const variantProblem = `[思考角度：${approach}]\n${problem}`;

      const chain = await this.execute(variantProblem, options, modelCaller);

      // 评估这个分支
      const evaluation = await this.evaluateBranch(chain, modelCaller);

      branches.push({
        id: `branch-${i}`,
        approach,
        chain,
        evaluation,
      });
    }

    // 按评估分数排序
    branches.sort((a, b) => b.evaluation.overall - a.evaluation.overall);

    logger.info('思维分支探索完成', {
      branchCount: branches.length,
      bestBranch: branches[0]?.approach,
    });

    return branches;
  }

  /**
   * 选择最佳思维模板
   */
  private selectTemplate(
    classification: ClassificationResult,
    complexity?: string
  ): ThinkingTemplate | undefined {
    return this.templateManager.getBestTemplate(
      classification.primary,
      complexity
    );
  }

  /**
   * 构建步骤提示词
   */
  private buildStepPrompt(
    step: ThinkingStep,
    problem: string,
    chain: ThinkingChain
  ): string {
    let prompt = `问题：${problem}\n\n`;

    // 添加上下文（之前的思考步骤）
    if (chain.steps.length > 0) {
      prompt += '=== 之前的思考 ===\n';
      for (const prevStep of chain.steps) {
        prompt += `${prevStep.name}：\n${prevStep.content}\n\n`;
      }
      prompt += '==================\n\n';
    }

    // 添加当前步骤
    prompt += `=== 当前步骤：${step.name} ===\n`;
    prompt += `${step.description}\n\n`;
    prompt += `${step.prompt}\n\n`;
    prompt += `输出格式：${step.outputFormat}`;

    return prompt;
  }

  /**
   * 评估步骤质量
   */
  private async assessStepQuality(
    step: ThinkingStep,
    content: string,
    modelCaller: (prompt: string) => Promise<string>
  ): Promise<number> {
    if (!step.verification) return 0.7; // 默认中等质量

    const verifyPrompt = `请评估以下思考步骤的质量（0-1分）：

步骤要求：${step.verification}

思考内容：
${content}

请只输出一个0-1之间的数字表示质量分数。`;

    try {
      const result = await modelCaller(verifyPrompt);
      const score = parseFloat(result.trim());
      return isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score));
    } catch {
      return 0.5;
    }
  }

  /**
   * 综合最终答案
   */
  private async synthesizeAnswer(
    chain: ThinkingChain,
    modelCaller: (prompt: string) => Promise<string>
  ): Promise<string> {
    const prompt = `基于以下思考过程，给出最终答案：

问题：${chain.problem}

思考过程：
${chain.steps.map((s) => `【${s.name}】\n${s.content}`).join('\n\n')}

请给出一个清晰、完整、直接回答原问题的最终答案。
确保答案综合了以上所有思考的要点。`;

    return await modelCaller(prompt);
  }

  /**
   * 评估思维分支
   */
  private async evaluateBranch(
    chain: ThinkingChain,
    modelCaller: (prompt: string) => Promise<string>
  ): Promise<BranchEvaluation> {
    const prompt = `请评估以下思维过程的质量（每个维度0-1分）：

问题：${chain.problem}

思考过程：
${chain.steps.map((s) => `${s.name}：${s.content.slice(0, 200)}...`).join('\n')}

请评估：
1. 完整性（是否覆盖所有关键方面）：0-1
2. 连贯性（逻辑是否通顺）：0-1
3. 深度（分析是否深入）：0-1

返回格式：完整性:x, 连贯性:y, 深度:z`;

    try {
      const result = await modelCaller(prompt);
      const matches = result.match(/完整性:([\d.]+).*连贯性:([\d.]+).*深度:([\d.]+)/);

      if (matches) {
        const completeness = parseFloat(matches[1]) || 0.5;
        const coherence = parseFloat(matches[2]) || 0.5;
        const depth = parseFloat(matches[3]) || 0.5;

        return {
          completeness,
          coherence,
          depth,
          overall: (completeness + coherence + depth) / 3,
        };
      }
    } catch {
      // 使用默认评分
    }

    return {
      completeness: 0.5,
      coherence: 0.5,
      depth: 0.5,
      overall: 0.5,
    };
  }

  /**
   * 获取活跃的思维链
   */
  getActiveChain(id: string): ThinkingChain | undefined {
    return this.activeChains.get(id);
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `chain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 导出单例
export const chainOfThoughtEngine = new ChainOfThoughtEngine();
