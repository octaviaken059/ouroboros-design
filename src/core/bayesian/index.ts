export {
  // Beta分布函数
  createUniformPrior,
  createPriorFromHistory,
  bayesianUpdate,
  batchBayesianUpdate,
  calculateConfidence,
  calculateUncertainty,
  calculateConfidenceInterval,
  getConfidenceResult,
  shouldUse,
  calculateUCB,
  compareDistributions,
  serializeDistribution,
  deserializeDistribution,
  
  // 贝叶斯核心类
  BayesianCore,
} from './bayesian-core';

// 类型导出
export type {
  BetaDistribution,
  ConfidenceResult,
} from './bayesian-core';
