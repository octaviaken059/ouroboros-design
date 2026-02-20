/**
 * @file capabilities/loader/index.ts
 * @description 能力加载器模块入口
 * @author Ouroboros
 * @date 2026-02-19
 */

export {
  CapabilitySelector,
  type CapabilitySelectionOptions,
  type SelectedCapabilities,
} from './capability-selector';

export {
  CapabilityLoader,
  type CapabilityLoadOptions,
  type LoadedCapability,
  type CapabilityLoadResult,
} from './capability-loader';

export {
  OnDemandLoader,
  type OnDemandLoadOptions,
  type LoadContext,
} from './on-demand-loader';
