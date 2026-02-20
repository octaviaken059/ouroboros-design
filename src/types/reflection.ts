/**
 * @file types/reflection.ts
 * @description 反思系统类型定义
 * @author Ouroboros
 * @date 2026-02-18
 */

/**
 * 反思触发器类型
 */
export type ReflectionTriggerType = 
  | 'scheduled'      // 定期触发
  | 'performanceDrop' // 性能下降
  | 'anomaly'        // 异常检测
  | 'manual';        // 手动触发

/**
 * 反思触发器
 */
export interface ReflectionTrigger {
  /** 唯一标识 */
  id: string;
  /** 触发器类型 */
  type: ReflectionTriggerType;
  /** 名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 是否启用 */
  enabled: boolean;
  /** 触发条件 */
  condition: ReflectionCondition;
  /** 冷却时间(毫秒) */
  cooldownMs: number;
  /** 最后触发时间 */
  lastTriggeredAt?: string;
  /** 触发次数 */
  triggerCount: number;
}

/**
 * 反思触发条件
 */
export interface ReflectionCondition {
  /** 性能下降阈值 (0-1) */
  performanceThreshold?: number;
  /** 响应时间阈值(毫秒) */
  responseTimeThreshold?: number;
  /** 异常模式 */
  anomalyPattern?: string;
  /** 连续失败阈值 */
  consecutiveFailureThreshold?: number;
  /** 错误数量阈值 */
  errorCountThreshold?: number;
  /** 定期触发间隔(毫秒) */
  scheduleIntervalMs?: number;
  /** 自定义检查函数 */
  customCheck?: () => boolean;
}

/**
 * 洞察类型
 */
export type InsightType = 'pattern' | 'problem' | 'opportunity';

/**
 * 洞察
 */
export interface Insight {
  /** 唯一标识 */
  id: string;
  /** 洞察类型 */
  type: InsightType;
  /** 标题 */
  title: string;
  /** 详细描述 */
  description: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 关联的记忆ID */
  relatedMemoryIds: string[];
  /** 关联的性能指标 */
  relatedMetrics?: string[] | undefined;
  /** 建议的改进措施 */
  suggestedActions: SuggestedAction[];
  /** 创建时间 */
  createdAt: string;
  /** 是否已应用 */
  applied: boolean;
  /** 应用时间 */
  appliedAt?: string;
}

/**
 * 建议的改进行动
 */
export interface SuggestedAction {
  /** 行动ID */
  id: string;
  /** 行动描述 */
  description: string;
  /** 行动类型 */
  type: 'promptOptimization' | 'budgetAdjustment' | 'parameterTuning' | 'workflowChange';
  /** 预期效果 */
  expectedImpact: string;
  /** 实施难度 (0-1) */
  difficulty: number;
  /** 风险等级 */
  riskLevel: 'low' | 'medium' | 'high';
  /** 具体配置变更 */
  configChanges?: ConfigChange[] | undefined;
  /** 元数据（用于存储执行相关的额外信息） */
  metadata?: Record<string, unknown>;
}

/**
 * 配置变更
 */
export interface ConfigChange {
  /** 配置路径 */
  path: string;
  /** 当前值 */
  currentValue: unknown;
  /** 建议值 */
  proposedValue: unknown;
  /** 变更原因 */
  reason: string;
}

/**
 * 审批模式
 */
export type ApprovalMode = 'auto' | 'conservative' | 'human';

/**
 * 反思结果
 */
export interface ReflectionResult {
  /** 反思ID */
  id: string;
  /** 触发类型 */
  triggerType: ReflectionTriggerType;
  /** 触发时间 */
  triggeredAt: string;
  /** 分析时长(毫秒) */
  analysisDurationMs: number;
  /** 生成的洞察 */
  insights: Insight[];
  /** 建议的行动 */
  suggestedActions: SuggestedAction[];
  /** 已批准的行动 */
  approvedActions: SuggestedAction[];
  /** 被拒绝的行动 */
  rejectedActions: SuggestedAction[];
  /** 审批模式 */
  approvalMode: ApprovalMode;
  /** 执行状态 */
  status: 'pending' | 'approved' | 'executed' | 'failed';
}

/**
 * 性能分析结果
 */
export interface PerformanceAnalysis {
  /** 分析时间段 */
  timeRange: { start: string; end: string };
  /** 平均响应时间 */
  avgResponseTime: number;
  /** 响应时间趋势 */
  responseTimeTrend: 'improving' | 'stable' | 'degrading';
  /** 成功率 */
  successRate: number;
  /** Token使用效率 */
  tokenEfficiency: number;
  /** 瓶颈识别 */
  bottlenecks: string[];
  /** 异常模式 - 字符串数组或异常对象数组 */
  anomalies: Array<string | { type: string; severity: 'low' | 'medium' | 'high'; description: string }>;
}

/**
 * 记忆分析结果
 */
export interface MemoryAnalysis {
  /** 记忆类型分布 */
  typeDistribution: Record<string, number>;
  /** 显著性分布 */
  salienceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  /** 重复主题 */
  recurringThemes: string[];
  /** 记忆空洞 */
  memoryGaps: string[];
  /** 遗忘建议 */
  pruneSuggestions: string[];
}

/**
 * 反思配置
 */
export interface ReflectionConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 审批模式 */
  approvalMode: ApprovalMode;
  /** 定期触发间隔(毫秒) */
  scheduleIntervalMs: number;
  /** 性能下降阈值 */
  performanceThreshold: number;
  /** 最大洞察数量 */
  maxInsights: number;
  /** 自动执行低风险变更 */
  autoExecuteLowRisk: boolean;
}

/**
 * 反思引擎状态
 */
export interface ReflectionEngineState {
  /** 是否运行中 */
  running: boolean;
  /** 已执行的反思次数 */
  reflectionCount: number;
  /** 已应用的洞察数量 */
  appliedInsightsCount: number;
  /** 等待审批的行动数量 */
  pendingActionsCount: number;
  /** 上次反思时间 */
  lastReflectionAt?: string;
  /** 当前模式 */
  currentMode: ApprovalMode;
}
