/**
 * @file tests/unit/utils/error.test.ts
 * @description 错误类单元测试 - 提高分支覆盖率
 * @author Ouroboros
 * @date 2026-02-18
 */

import {
  OuroborosError,
  ConfigError,
  MemoryError,
  ToolError,
  ModelError,
  ReflectionError,
  EvolutionError,
  SafetyError,
  ValidationError,
  tryCatch,
  tryCatchAsync,
} from '@/utils/error';

describe('OuroborosError', () => {
  it('应该创建基础错误', () => {
    const error = new OuroborosError(
      '测试错误',
      'CONFIG_ERROR',
      'test-context',
      true,
      new Error('原始错误')
    );

    expect(error.message).toBe('测试错误');
    expect(error.code).toBe('CONFIG_ERROR');
    expect(error.context).toBe('test-context');
    expect(error.recoverable).toBe(true);
    expect(error.cause).toBeDefined();
    expect(error.timestamp).toBeDefined();
  });

  it('应该转换为JSON', () => {
    const error = new OuroborosError('测试', 'CONFIG_ERROR', 'context');
    const json = error.toJSON();

    expect(json.name).toBe('OuroborosError');
    expect(json.message).toBe('测试');
    expect(json.code).toBe('CONFIG_ERROR');
  });
});

describe('ConfigError', () => {
  it('应该创建配置错误', () => {
    const error = new ConfigError('配置无效', 'test');

    expect(error.name).toBe('ConfigError');
    expect(error.code).toBe('CONFIG_ERROR');
    expect(error.recoverable).toBe(true);
  });

  it('应该支持原始错误', () => {
    const cause = new Error('原始错误');
    const error = new ConfigError('配置失败', 'test', true, cause);

    expect(error.cause).toBe(cause);
  });
});

describe('MemoryError', () => {
  it('应该创建记忆错误', () => {
    const error = new MemoryError('记忆读取失败', 'memory.read');

    expect(error.name).toBe('MemoryError');
    expect(error.code).toBe('MEMORY_ERROR');
  });
});

describe('ToolError', () => {
  it('应该创建工具错误', () => {
    const error = new ToolError('工具执行失败', 'tool.exec');

    expect(error.name).toBe('ToolError');
    expect(error.code).toBe('TOOL_ERROR');
  });
});

describe('ModelError', () => {
  it('应该创建模型错误', () => {
    const error = new ModelError('API调用失败', 'model.call');

    expect(error.name).toBe('ModelError');
    expect(error.code).toBe('MODEL_ERROR');
  });
});

describe('ReflectionError', () => {
  it('应该创建反思错误', () => {
    const error = new ReflectionError('反思过程失败', 'reflection.process');

    expect(error.name).toBe('ReflectionError');
    expect(error.code).toBe('REFLECTION_ERROR');
  });
});

describe('EvolutionError', () => {
  it('应该创建进化错误', () => {
    const error = new EvolutionError('进化失败', 'evolution.run');

    expect(error.name).toBe('EvolutionError');
    expect(error.code).toBe('EVOLUTION_ERROR');
    expect(error.recoverable).toBe(false);
  });
});

describe('SafetyError', () => {
  it('应该创建安全错误', () => {
    const error = new SafetyError('安全检查失败', 'safety.check');

    expect(error.name).toBe('SafetyError');
    expect(error.code).toBe('SAFETY_ERROR');
    expect(error.recoverable).toBe(false);
  });
});

describe('ValidationError', () => {
  it('应该创建验证错误', () => {
    const error = new ValidationError('验证失败', { field: 'name' });

    expect(error.name).toBe('ValidationError');
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('应该支持空上下文', () => {
    const error = new ValidationError('验证失败');

    expect(error.context).toBe('{}');
  });
});

describe('tryCatch', () => {
  it('应该包装同步函数成功执行', () => {
    const fn = tryCatch((a: number, b: number) => a + b, 'test', ConfigError);
    const result = fn(1, 2);

    expect(result).toBe(3);
  });

  it('应该捕获并包装错误', () => {
    const fn = tryCatch(() => {
      throw new Error('原始错误');
    }, 'test', ConfigError);

    expect(() => fn()).toThrow(ConfigError);
  });

  it('不应该重复包装OuroborosError', () => {
    const fn = tryCatch(() => {
      throw new ConfigError('已有错误', 'test');
    }, 'test', MemoryError);

    expect(() => fn()).toThrow(ConfigError);
  });
});

describe('tryCatchAsync', () => {
  it('应该包装异步函数成功执行', async () => {
    const fn = tryCatchAsync(
      async (a: number, b: number) => a + b,
      'test',
      ConfigError
    );
    const result = await fn(1, 2);

    expect(result).toBe(3);
  });

  it('应该捕获并包装异步错误', async () => {
    const fn = tryCatchAsync(async () => {
      throw new Error('异步错误');
    }, 'test', ConfigError);

    await expect(fn()).rejects.toThrow(ConfigError);
  });

  it('不应该重复包装OuroborosError', async () => {
    const fn = tryCatchAsync(async () => {
      throw new ConfigError('已有错误', 'test');
    }, 'test', MemoryError);

    await expect(fn()).rejects.toThrow(ConfigError);
  });
});
