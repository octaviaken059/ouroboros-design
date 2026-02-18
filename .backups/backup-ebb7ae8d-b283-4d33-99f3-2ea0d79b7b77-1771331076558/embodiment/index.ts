/**
 * 身体层 (Embodiment Layer)
 * 
 * Ouroboros 具身认知核心
 * 
 * 模块:
 * - BodySchema: 身体图式 - 感知自身运行环境
 * - HormoneSystem: 激素系统 - 情绪/动机调节
 * - Homeostasis: 稳态保护 - 资源监控与降载
 * - Watchdog: 硬件看门狗 - 系统监控与恢复
 */

// 导出身体图式
export {
  BodySchemaMonitor,
  bodySchema,
  ProcessIdentity,
  ResourceStatus,
  BodySchema,
  BodySchemaChangeEvent,
  SystemCapabilities,
  ToolCapability,
  HardwareCapability,
  ServiceCapability,
  MemoryInfo,
  CPUInfo,
  DiskInfo,
  EnvironmentInfo
} from './body-schema.js';

// 导出激素系统
export {
  HormoneSystem,
  hormoneSystem,
  HormoneType,
  HormoneState,
  HormoneConfig,
  HormonalEffects,
  BehavioralAdvice,
  HormoneHistoryEntry,
  HORMONE_CONFIGS
} from './hormone-system.js';

// 导出稳态保护
export {
  Homeostasis,
  homeostasis,
  ResourceThresholds,
  HealthStatus,
  ResourceAlert,
  HomeostasisReport,
  LoadReductionPlan,
  LoadReductionAction,
  HomeostasisConfig,
  DEFAULT_THRESHOLDS,
  DEFAULT_CONFIG
} from './homeostasis.js';

// 导出硬件看门狗
export {
  Watchdog,
  createWatchdog,
  WatchdogConfig,
  SystemMetrics,
  AlertSeverity,
  WatchdogStatus,
  Alert,
  RecoveryStrategy,
  RecoveryResult,
  WatchdogState
} from './watchdog.js';
