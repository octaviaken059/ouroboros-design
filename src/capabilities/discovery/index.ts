/**
 * @file capabilities/discovery/index.ts
 * @description 能力发现模块入口
 * @author Ouroboros
 * @date 2026-02-19
 */

// 系统扫描器
export {
  SystemScanner,
  scanSystemCapabilities,
  type SystemScannerOptions,
  type SystemToolDefinition,
  type SystemScanResult,
  type DiscoveredSystemTool,
} from './system-scanner';

// 硬件检测器
export {
  HardwareDetector,
  detectHardware,
  type HardwareInfo,
  type StorageDevice,
  type GPUInfo,
  type NetworkInterface,
  type HardwareChangeEvent,
} from './hardware-detector';

// 能力注册器
export {
  CapabilityRegistry,
  type Capability,
  type CapabilityType,
  type CapabilityRegistryOptions,
} from './capability-registry';

// 统一发现管理器
export { DiscoveryManager, type DiscoveryOptions, type DiscoveryReport } from './discovery-manager';
