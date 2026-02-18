/**
 * @file tests/unit/types/index.test.ts
 * @description 类型定义基础测试
 */

import { describe, it, expect } from '@jest/globals';
import type { Identity, HormoneLevels } from '../../../src/types/index.js';

describe('类型定义', () => {
  it('应该能创建 Identity 对象', () => {
    const identity: Identity = {
      id: 'test-id',
      name: 'Ouroboros',
      version: '2.0.0',
      evolutionStage: 'newborn',
      createdAt: new Date().toISOString(),
      description: '测试',
    };

    expect(identity.name).toBe('Ouroboros');
    expect(identity.version).toBe('2.0.0');
  });

  it('应该能创建 HormoneLevels 对象', () => {
    const levels: HormoneLevels = {
      adrenaline: 0.5,
      cortisol: 0.3,
      dopamine: 0.8,
      serotonin: 0.6,
      curiosity: 0.7,
    };

    expect(levels.adrenaline).toBe(0.5);
    expect(levels.dopamine).toBe(0.8);
  });
});
