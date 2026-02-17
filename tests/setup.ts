/**
 * Ouroboros Test Environment Setup
 * 测试环境初始化
 */

import { jest } from '@jest/globals';

// ============================================================================
// Global Mocks
// ============================================================================

// Mock fetch for embedding service tests
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Mock Node.js built-in modules
jest.mock('os', () => {
  const actual = jest.requireActual('os') as typeof import('os');
  return {
    ...actual,
    totalmem: jest.fn().mockReturnValue(8 * 1024 * 1024 * 1024),
    freemem: jest.fn().mockReturnValue(4 * 1024 * 1024 * 1024),
    loadavg: jest.fn().mockReturnValue([1.5, 1.2, 1.0]),
    cpus: jest.fn().mockReturnValue(Array(4).fill({ model: 'Mock CPU' })),
    hostname: jest.fn().mockReturnValue('test-host'),
    platform: jest.fn().mockReturnValue('linux'),
    arch: jest.fn().mockReturnValue('x64'),
    uptime: jest.fn().mockReturnValue(3600),
  };
});

// Mock crypto for deterministic UUID generation
let uuidCounter = 0;
let hashCounter = 0;
jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto') as typeof import('crypto');
  return {
    ...actual,
    randomUUID: jest.fn().mockImplementation(() => {
      uuidCounter++;
      return `mock-uuid-${uuidCounter.toString().padStart(6, '0')}`;
    }),
    createHash: jest.fn().mockImplementation((algorithm: string) => ({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockImplementation((encoding?: string) => {
        hashCounter++;
        if (encoding === 'hex') {
          // 返回 64 字符的十六进制字符串，每次调用不同
          return hashCounter.toString(16).padStart(64, '0');
        }
        return Buffer.from(`mock-hash-${hashCounter}`);
      }),
    })),
  };
});

// Mock fs promises
jest.mock('fs', () => {
  const actual = jest.requireActual('fs') as typeof import('fs');
  return {
    ...actual,
    promises: {
      mkdir: jest.fn().mockResolvedValue(undefined as never),
      writeFile: jest.fn().mockResolvedValue(undefined as never),
      readFile: jest.fn().mockResolvedValue('[]' as never),
      unlink: jest.fn().mockResolvedValue(undefined as never),
      access: jest.fn().mockResolvedValue(undefined as never),
    },
  };
});

// ============================================================================
// Test Utilities
// ============================================================================

export const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

export const mockFetchResponse = (response: unknown, ok = true): void => {
  (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(response as never),
    text: jest.fn().mockResolvedValue(JSON.stringify(response) as never),
  } as unknown as Response);
};

export const mockFetchError = (message: string): void => {
  (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
    new Error(message)
  );
};

// ============================================================================
// Jest Lifecycle Hooks
// ============================================================================

beforeAll(() => {
  // 测试套件开始前的全局设置
  console.log('🧪 Ouroboros Integration Test Suite Started');
});

afterAll(() => {
  // 测试套件结束后的全局清理
  console.log('✅ Ouroboros Integration Test Suite Completed');
});

beforeEach(() => {
  // 每个测试前的重置
  uuidCounter = 0;
  jest.clearAllMocks();
});

afterEach(() => {
  // 每个测试后的清理
});
