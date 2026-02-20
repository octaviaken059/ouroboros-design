/**
 * @file core/cognition/thinking/templates.ts
 * @description 思维模板库 - 定义不同问题类型的思考步骤
 */

import { ProblemType } from './classifier';

/**
 * 思考步骤
 */
export interface ThinkingStep {
  id: string;
  name: string;
  description: string;
  prompt: string;           // 引导模型思考的提示词
  outputFormat: string;     // 期望的输出格式
  verification?: string;    // 如何验证这一步的质量
  estimatedTime?: number;   // 预计思考时间（秒）
}

/**
 * 思维模板
 */
export interface ThinkingTemplate {
  id: string;
  name: string;
  description: string;
  problemTypes: ProblemType[];
  complexity: 'simple' | 'moderate' | 'complex';
  steps: ThinkingStep[];
  metaPrompt?: string;      // 整体元提示
  // 统计数据
  usageCount: number;
  successCount: number;
  avgQualityScore: number;
  createdAt: Date;
  lastUsedAt?: Date;
  evolvedFrom?: string[];   // 从哪些模板进化而来
}

/**
 * 默认思维模板库
 */
export const defaultTemplates: ThinkingTemplate[] = [
  // ========== 分析类问题 ==========
  {
    id: 'analytical-deep-dive',
    name: '深度分析模板',
    description: '适用于需要深入分析的问题，帮助拆解复杂问题',
    problemTypes: ['analytical'],
    complexity: 'complex',
    usageCount: 0,
    successCount: 0,
    avgQualityScore: 0,
    createdAt: new Date(),
    steps: [
      {
        id: 'a1-understand',
        name: '问题理解',
        description: '确保正确理解问题',
        prompt: `首先，用自己的话重新描述这个问题。
确认你理解的核心要点：
1. 问题的本质是什么？
2. 问题的边界在哪里（什么在范围内，什么不在）？
3. 有哪些关键约束条件？
4. 期望的输出是什么？`,
        outputFormat: '问题重述：...\n核心要点：1. ... 2. ...\n约束条件：...',
        verification: '检查是否准确捕捉了问题核心，没有遗漏关键信息',
        estimatedTime: 30,
      },
      {
        id: 'a2-decompose',
        name: '问题拆解',
        description: '将复杂问题拆分为子问题',
        prompt: `将这个问题拆解为3-5个独立的子问题或维度。
对于每个部分：
1. 给它一个清晰的名称
2. 说明它是什么
3. 解释为什么它是问题的一部分

思考：这些部分之间有什么依赖关系？`,
        outputFormat: '子问题1 [名称]：描述...\n子问题2 [名称]：描述...\n依赖关系：...',
        verification: '检查拆解是否完备（MECE原则：相互独立，完全穷尽）',
        estimatedTime: 45,
      },
      {
        id: 'a3-analyze-each',
        name: '逐一分析',
        description: '对每个子问题进行深入分析',
        prompt: `对每个子问题进行深入分析：
1. 使用什么分析框架或方法？（例如：5W1H、SWOT、因果分析等）
2. 有哪些关键因素？
3. 这些因素之间如何相互作用？
4. 有哪些证据或数据支持你的分析？

注意：要深入，不要停留在表面。`,
        outputFormat: '子问题1分析：\n- 分析方法：...\n- 关键因素：...\n- 相互作用：...\n\n子问题2分析：...',
        verification: '检查分析是否足够深入，有数据/证据支持',
        estimatedTime: 90,
      },
      {
        id: 'a4-synthesize',
        name: '综合关联',
        description: '建立各部分之间的联系',
        prompt: `现在将各部分的分析综合起来：
1. 这些分析结果如何相互影响？
2. 有哪些 emergent patterns（涌现模式）？
3. 整体呈现出什么样的结构或系统？
4. 最关键的洞察是什么？

用一句简洁的话总结核心发现。`,
        outputFormat: '相互影响：...\n涌现模式：...\n整体结构：...\n核心洞察：...\n一句话总结：...',
        verification: '检查综合是否超越了各部分之和',
        estimatedTime: 45,
      },
      {
        id: 'a5-conclusion',
        name: '形成结论',
        description: '基于分析得出结论',
        prompt: `基于以上分析，形成你的结论：
1. 主要结论是什么？（2-3点）
2. 每个结论的支撑证据是什么？
3. 置信度如何？（高/中/低，为什么）
4. 如果置信度不高，还需要什么信息？

结论应该直接回应原始问题。`,
        outputFormat: '结论1：...（证据：...，置信度：...）\n结论2：...\n缺失信息：...',
        verification: '检查结论是否直接回答原问题，有充分支撑',
        estimatedTime: 30,
      },
      {
        id: 'a6-reflect',
        name: '反思验证',
        description: '检查完整性和潜在问题',
        prompt: `最后，进行批判性反思：
1. 分析中可能遗漏了什么重要方面？
2. 有什么反例或例外情况？
3. 有什么潜在的偏见或假设？
4. 如果结论是错的，可能是因为什么？
5. 如何验证这些结论的正确性？`,
        outputFormat: '可能遗漏：...\n反例/例外：...\n潜在偏见：...\n验证方法：...',
        verification: '检查是否识别了关键风险和局限性',
        estimatedTime: 30,
      },
    ],
    metaPrompt: `你是一个严谨的分析专家。面对复杂问题时，不要急于给出答案。
按照以下步骤深入思考，展示你的思考过程。`,
  },

  // ========== 决策类问题 ==========
  {
    id: 'decision-framework',
    name: '决策框架模板',
    description: '系统化的决策过程，帮助做出理性选择',
    problemTypes: ['decision'],
    complexity: 'moderate',
    usageCount: 0,
    successCount: 0,
    avgQualityScore: 0,
    createdAt: new Date(),
    steps: [
      {
        id: 'd1-clarify',
        name: '明确决策目标',
        description: '确定决策的核心目标',
        prompt: `首先明确这个决策：
1. 决策的目标是什么？（用一句话说清楚）
2. 成功的标准是什么？如何衡量？
3. 决策的时间约束？
4. 有哪些不可妥协的约束条件？
5. 这个决策的影响范围有多大？`,
        outputFormat: '决策目标：...\n成功标准：...\n约束条件：...',
        estimatedTime: 20,
      },
      {
        id: 'd2-options',
        name: '生成选项',
        description: '列出所有可行选项',
        prompt: `列出所有可行的选项：
1. 明显的选项有哪些？（至少2-3个）
2. 有没有不那么明显但值得考虑的选项？
3. 组合选项呢？（能否结合多个选项的优点）
4. "什么都不做"是一个选项吗？

为每个选项写一个简短的描述。`,
        outputFormat: '选项1：...（描述）\n选项2：...\n选项3：...',
        estimatedTime: 30,
      },
      {
        id: 'd3-criteria',
        name: '建立评估标准',
        description: '定义评估维度',
        prompt: `建立评估每个选项的标准：
1. 最重要的3-5个评估维度是什么？
2. 每个维度的重要性权重？（总和100%）
3. 每个维度如何量化或评估？

考虑：成本、收益、风险、可行性、长期影响等`,
        outputFormat: '评估维度：\n1. xxx (权重：30%)\n2. xxx (权重：25%)\n...',
        estimatedTime: 25,
      },
      {
        id: 'd4-evaluate',
        name: '评估各选项',
        description: '用标准评估每个选项',
        prompt: `用上述标准评估每个选项：

对每个选项，评估：
- 在各个维度上的表现（高/中/低 或 1-10分）
- 关键优势是什么？
- 关键劣势是什么？
- 主要风险是什么？
- 需要什么资源？

尽量客观，避免确认偏见。`,
        outputFormat: '选项1评估：\n- 维度1：8分\n- 维度2：6分\n- 优势：...\n- 劣势：...\n- 风险：...',
        estimatedTime: 60,
      },
      {
        id: 'd5-decision',
        name: '做出决策',
        description: '综合评估结果做出选择',
        prompt: `基于评估，做出你的决策：
1. 推荐选择哪个选项？为什么？
2. 这个选择的总得分是多少？
3. 与第二选择相比，优势在哪里？
4. 选择这个选项，意味着什么妥协？
5. 如果情况变化，Plan B是什么？`,
        outputFormat: '推荐选项：...\n理由：...\n妥协：...\nPlan B：...',
        estimatedTime: 25,
      },
      {
        id: 'd6-action',
        name: '制定行动计划',
        description: '将决策转化为行动',
        prompt: `将决策转化为具体行动：
1. 第一步做什么？
2. 关键的里程碑有哪些？
3. 需要什么资源？
4. 谁需要参与或知情？
5. 如何监控进展？
6. 何时重新评估这个决策？`,
        outputFormat: '第一步：...\n里程碑：...\n资源需求：...',
        estimatedTime: 20,
      },
    ],
  },

  // ========== 调试类问题 ==========
  {
    id: 'debugging-systematic',
    name: '系统调试模板',
    description: '结构化的错误排查过程',
    problemTypes: ['debugging'],
    complexity: 'moderate',
    usageCount: 0,
    successCount: 0,
    avgQualityScore: 0,
    createdAt: new Date(),
    steps: [
      {
        id: 'b1-observe',
        name: '观察现象',
        description: '准确描述错误现象',
        prompt: `准确描述你观察到的错误：
1. 错误信息是什么？（完整复制）
2. 错误发生在什么场景/操作后？
3. 是每次都发生还是偶尔发生？
4. 错误的影响范围？
5. 最近有什么变更？（代码、配置、环境）`,
        outputFormat: '错误信息：...\n发生场景：...\n发生频率：...\n最近变更：...',
        estimatedTime: 15,
      },
      {
        id: 'b2-reproduce',
        name: '复现步骤',
        description: '确定如何稳定复现',
        prompt: `确定复现步骤：
1. 最小复现步骤是什么？（从干净状态开始）
2. 哪些步骤是必须的？
3. 有没有前置条件？
4. 能否简化为更小的测试用例？

目标是找到最简复现路径。`,
        outputFormat: '复现步骤：\n1. ...\n2. ...\n前置条件：...',
        estimatedTime: 20,
      },
      {
        id: 'b3-hypothesize',
        name: '提出假设',
        description: '生成可能的错误原因',
        prompt: `提出至少3个可能的原因假设：
1. 最可能的原因是什么？为什么？
2. 其他可能的原因？
3. 每个假设的置信度？

对每种假设，思考：
- 如果是这个原因，会伴随什么其他现象？
- 如何验证或排除这个假设？`,
        outputFormat: '假设1：...（置信度：高/中/低，验证方法：...）\n假设2：...',
        estimatedTime: 25,
      },
      {
        id: 'b4-test',
        name: '测试验证',
        description: '验证或排除假设',
        prompt: `设计测试来验证你的假设：
1. 从置信度最高的假设开始
2. 设计一个能快速验证或排除的测试
3. 执行测试，记录结果
4. 如果假设被排除，转向下一个假设
5. 如果无法验证，需要更多信息

测试应该是有针对性的，不是盲目尝试。`,
        outputFormat: '测试假设1：...\n测试方法：...\n结果：...\n结论：...',
        estimatedTime: 40,
      },
      {
        id: 'b5-locate',
        name: '定位根因',
        description: '找到错误的根本原因',
        prompt: `基于测试结果，定位根本原因：
1. 根因是什么？（根本原因，不是表面现象）
2. 为什么之前的假设正确/错误？
3. 这个根因影响了哪些其他部分？
4. 类似问题在其他地方是否存在？

区分：直接原因 vs 根本原因`,
        outputFormat: '根因：...\n影响范围：...\n类似风险：...',
        estimatedTime: 20,
      },
      {
        id: 'b6-fix',
        name: '修复方案',
        description: '设计修复并验证',
        prompt: `设计修复方案：
1. 修复方案是什么？
2. 这个方案会有什么副作用？
3. 如何确保修复不引入新问题？
4. 修复后如何验证？（回归测试）
5. 需要更新文档吗？

考虑：最简修复 vs 彻底修复`,
        outputFormat: '修复方案：...\n副作用评估：...\n验证方法：...',
        estimatedTime: 25,
      },
    ],
  },

  // ========== 规划类问题 ==========
  {
    id: 'planning-goal-oriented',
    name: '目标导向规划模板',
    description: '将目标分解为可执行的计划',
    problemTypes: ['planning'],
    complexity: 'moderate',
    usageCount: 0,
    successCount: 0,
    avgQualityScore: 0,
    createdAt: new Date(),
    steps: [
      {
        id: 'p1-goal',
        name: '明确目标',
        description: '定义清晰的目标',
        prompt: `明确你的目标：
1. SMART目标是什么？（具体、可衡量、可达成、相关、有时限）
2. 为什么这个目标重要？
3. 达成目标的标志是什么？
4. 有什么约束条件？（时间、资源、质量）
5. 谁是利益相关者？`,
        outputFormat: '目标：...\n成功标志：...\n约束：...',
        estimatedTime: 20,
      },
      {
        id: 'p2-milestones',
        name: '设定里程碑',
        description: '定义关键检查点',
        prompt: `将目标分解为3-5个关键里程碑：
1. 每个里程碑的交付物是什么？
2. 每个里程碑的完成标准是什么？
3. 每个里程碑的时间节点？
4. 里程碑之间有什么依赖关系？

里程碑应该是可验证的、有明确输出的。`,
        outputFormat: '里程碑1：...（交付物：...，标准：...，时间：...）',
        estimatedTime: 25,
      },
      {
        id: 'p3-tasks',
        name: '细化任务',
        description: '将里程碑细化为具体任务',
        prompt: `为每个里程碑细化任务：
1. 需要完成哪些具体任务？
2. 每个任务的预计时间？
3. 任务之间的依赖关系？
4. 哪些任务可以并行？
5. 哪些任务是关键的（关键路径）？

任务粒度：1-3天的工作量比较合适。`,
        outputFormat: '里程碑1任务：\n- 任务1（预计x天，依赖：无）\n- 任务2...',
        estimatedTime: 35,
      },
      {
        id: 'p4-resources',
        name: '资源评估',
        description: '评估所需资源',
        prompt: `评估所需资源：
1. 需要哪些人力？（技能、时间）
2. 需要哪些工具/技术？
3. 需要多少预算？
4. 有什么外部依赖？（第三方、审批）
5. 资源约束是什么？瓶颈在哪里？

现实评估：资源是否足够？`,
        outputFormat: '人力需求：...\n技术需求：...\n外部依赖：...\n瓶颈：...',
        estimatedTime: 20,
      },
      {
        id: 'p5-risks',
        name: '风险评估',
        description: '识别和应对风险',
        prompt: `识别风险并制定应对：
1. 最大的3-5个风险是什么？
2. 每个风险的概率和影响？
3. 如何预防或减轻？
4. 如果发生，应急方案是什么？
5. 需要监控什么早期预警信号？`,
        outputFormat: '风险1：...（概率：高/中/低，影响：...，应对：...）',
        estimatedTime: 20,
      },
      {
        id: 'p6-timeline',
        name: '制定时间表',
        description: '整合为完整时间表',
        prompt: `制定完整时间表：
1. 整体时间线（甘特图思维）
2. 关键路径是什么？
3. 缓冲时间在哪里？
4. 检查点/评审点设置？
5. 如果延期，什么可以调整？

时间表应该是现实可行的，不是理想化的。`,
        outputFormat: '时间表：\n第1周：...\n第2周：...\n关键路径：...',
        estimatedTime: 20,
      },
    ],
  },
];

/**
 * 思维模板管理器
 */
export class ThinkingTemplateManager {
  private templates: Map<string, ThinkingTemplate> = new Map();

  constructor() {
    // 加载默认模板
    for (const template of defaultTemplates) {
      this.templates.set(template.id, template);
    }
  }

  /**
   * 获取适合问题类型的模板
   */
  getTemplatesForType(type: string): ThinkingTemplate[] {
    return Array.from(this.templates.values()).filter(t =>
      t.problemTypes.includes(type as any)
    );
  }

  /**
   * 获取最佳模板
   */
  getBestTemplate(type: string, _complexity?: string): ThinkingTemplate | undefined {
    const candidates = this.getTemplatesForType(type);

    if (candidates.length === 0) {
      // 返回通用分析模板
      return this.templates.get('analytical-deep-dive');
    }

    // 按成功率排序
    candidates.sort((a, b) => {
      const scoreA = a.successCount / Math.max(a.usageCount, 1);
      const scoreB = b.successCount / Math.max(b.usageCount, 1);
      return scoreB - scoreA;
    });

    return candidates[0];
  }

  /**
   * 添加新模板
   */
  addTemplate(template: ThinkingTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * 更新模板统计数据
   */
  updateStats(templateId: string, success: boolean, qualityScore: number): void {
    const template = this.templates.get(templateId);
    if (template) {
      template.usageCount++;
      if (success) template.successCount++;
      template.avgQualityScore =
        (template.avgQualityScore * (template.usageCount - 1) + qualityScore) /
        template.usageCount;
      template.lastUsedAt = new Date();
    }
  }

  /**
   * 获取所有模板
   */
  getAllTemplates(): ThinkingTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 根据ID获取模板
   */
  getTemplate(id: string): ThinkingTemplate | undefined {
    return this.templates.get(id);
  }
}

// 导出单例
export const templateManager = new ThinkingTemplateManager();
