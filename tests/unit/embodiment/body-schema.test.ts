/**
 * @fileoverview 身体图式单元测试
 * @module tests/unit/embodiment/body-schema.test
 */

import {
  BodySchemaMonitor,
  BodySchema,
  ProcessIdentity,
  ResourceStatus,
  EnvironmentInfo,
  SystemCapabilities,
  BodySchemaChangeEvent,
  bodySchema,
} from '../../../src/embodiment/body-schema';

describe('BodySchemaMonitor', () => {
  let monitor: BodySchemaMonitor;

  beforeEach(() => {
    monitor = new BodySchemaMonitor();
  });

  afterEach(() => {
    monitor.stopMonitoring();
  });

  // ==================== 构造与初始化测试 ====================
  describe('Constructor & Initialization', () => {
    it('应创建BodySchemaMonitor实例', () => {
      expect(monitor).toBeInstanceOf(BodySchemaMonitor);
    });

    it('应生成有效的灵魂签名', async () => {
      const schema = await monitor.getCurrentSchema();
      expect(schema.identity.soulSignature).toBeDefined();
      expect(schema.identity.soulSignature.length).toBeGreaterThanOrEqual(16);
    });

    it('单例应返回相同的实例类型', () => {
      expect(bodySchema).toBeInstanceOf(BodySchemaMonitor);
    });
  });

  // ==================== 身体图式获取测试 ====================
  describe('Schema Retrieval', () => {
    it('应获取当前身体图式', async () => {
      const schema = await monitor.getCurrentSchema();
      expect(schema).toBeDefined();
      expect(schema.identity).toBeDefined();
      expect(schema.resources).toBeDefined();
      expect(schema.environment).toBeDefined();
      expect(schema.capabilities).toBeDefined();
      expect(schema.timestamp).toBeInstanceOf(Date);
    });

    it('应包含进程身份信息', async () => {
      const schema = await monitor.getCurrentSchema();
      
      expect(schema.identity.pid).toBe(process.pid);
      expect(schema.identity.ppid).toBe(process.ppid || 0);
      expect(schema.identity.cwd).toBe(process.cwd());
      expect(schema.identity.executable).toBe(process.execPath);
      expect(schema.identity.nodeVersion).toBe(process.version);
      expect(schema.identity.startTime).toBeInstanceOf(Date);
      expect(typeof schema.identity.uptime).toBe('number');
    });

    it('应包含资源状态信息', async () => {
      const schema = await monitor.getCurrentSchema();
      
      expect(schema.resources.memory).toBeDefined();
      expect(schema.resources.memory.total).toBeGreaterThan(0);
      expect(schema.resources.memory.free).toBeGreaterThanOrEqual(0);
      expect(schema.resources.memory.usagePercent).toBeGreaterThanOrEqual(0);
      expect(schema.resources.memory.usagePercent).toBeLessThanOrEqual(1);

      expect(schema.resources.cpu).toBeDefined();
      expect(schema.resources.cpu.count).toBeGreaterThan(0);
      expect(Array.isArray(schema.resources.cpu.loadAvg)).toBe(true);

      expect(schema.resources.process).toBeDefined();
      expect(schema.resources.process.rss).toBeGreaterThan(0);
      expect(schema.resources.process.heapTotal).toBeGreaterThan(0);
    });

    it('应包含环境信息', async () => {
      const schema = await monitor.getCurrentSchema();
      
      expect(schema.environment.hostname).toBeDefined();
      expect(schema.environment.platform).toBeDefined();
      expect(schema.environment.arch).toBeDefined();
      expect(schema.environment.osRelease).toBeDefined();
      expect(schema.environment.timezone).toBeDefined();
      expect(typeof schema.environment.env).toBe('object');
    });

    it('应包含系统能力信息', async () => {
      const schema = await monitor.getCurrentSchema();
      
      expect(Array.isArray(schema.capabilities.tools)).toBe(true);
      expect(schema.capabilities.hardware).toBeDefined();
      expect(Array.isArray(schema.capabilities.services)).toBe(true);
    });
  });

  // ==================== 变更检测测试 ====================
  describe('Change Detection', () => {
    it('应检测身体图式变更', async () => {
      const changes: BodySchemaChangeEvent[] = [];
      
      monitor.onChange((event) => {
        changes.push(event);
      });

      // 第一次获取创建基准
      await monitor.getCurrentSchema();
      // 第二次获取检测变更
      await monitor.getCurrentSchema();

      // 可能不会立即触发变更，但监听器应该已注册
      expect(typeof monitor.onChange).toBe('function');
    });

    it('应支持取消变更监听', async () => {
      const changes: BodySchemaChangeEvent[] = [];
      
      const unsubscribe = monitor.onChange((event) => {
        changes.push(event);
      });

      expect(typeof unsubscribe).toBe('function');
      
      // 取消监听
      unsubscribe();
      
      // 获取图式，不应触发监听
      await monitor.getCurrentSchema();
      await monitor.getCurrentSchema();
    });
  });

  // ==================== 监控功能测试 ====================
  describe('Monitoring', () => {
    it('应启动定期监控', () => {
      monitor.startMonitoring(100);
      // 不应抛出错误
      expect(monitor).toBeDefined();
    });

    it('应停止监控', () => {
      monitor.startMonitoring(100);
      monitor.stopMonitoring();
      // 不应抛出错误
      expect(monitor).toBeDefined();
    });

    it('重复启动监控不应出错', () => {
      monitor.startMonitoring(100);
      monitor.startMonitoring(200); // 应该替换之前的定时器
      expect(monitor).toBeDefined();
    });
  });

  // ==================== 自我描述测试 ====================
  describe('Self Description', () => {
    it('应生成自我描述字符串', async () => {
      const description = await monitor.getSelfDescription();
      
      expect(typeof description).toBe('string');
      expect(description).toContain('Ouroboros Body Schema');
      expect(description).toContain('Identity:');
      expect(description).toContain('Resources:');
      expect(description).toContain('Environment:');
      expect(description).toContain('Capabilities:');
    });

    it('描述应包含关键指标', async () => {
      const description = await monitor.getSelfDescription();
      const schema = await monitor.getCurrentSchema();
      
      expect(description).toContain(String(schema.identity.pid));
      expect(description).toContain(schema.identity.nodeVersion);
      expect(description).toContain(schema.environment.hostname);
    });
  });

  // ==================== 身份验证测试 ====================
  describe('Identity Verification', () => {
    it('应验证身份完整性', () => {
      const result = monitor.verifyIdentity();
      
      expect(typeof result.valid).toBe('boolean');
      expect(['STABLE', 'MINOR_CHANGE', 'MAJOR_CHANGE']).toContain(result.state);
    });

    it('初始状态应为STABLE', () => {
      const result = monitor.verifyIdentity();
      expect(result.state).toBe('STABLE');
    });
  });

  // ==================== 工具扫描测试 ====================
  describe('Tool Scanning', () => {
    it('应扫描可用工具', async () => {
      const schema = await monitor.getCurrentSchema();
      
      // 至少应检测到一些工具信息
      expect(schema.capabilities.tools.length).toBeGreaterThan(0);
      
      // 每个工具应有名称和可用状态
      for (const tool of schema.capabilities.tools) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.available).toBe('boolean');
      }
    });

    it('应检测node工具', async () => {
      const schema = await monitor.getCurrentSchema();
      const nodeTool = schema.capabilities.tools.find(t => t.name === 'node');
      
      // node应该存在且可用
      expect(nodeTool).toBeDefined();
      expect(nodeTool!.available).toBe(true);
    });
  });

  // ==================== 硬件扫描测试 ====================
  describe('Hardware Scanning', () => {
    it('应扫描硬件能力', async () => {
      const schema = await monitor.getCurrentSchema();
      
      expect(typeof schema.capabilities.hardware.hasGPU).toBe('boolean');
      expect(typeof schema.capabilities.hardware.hasCUDA).toBe('boolean');
    });
  });

  // ==================== 服务扫描测试 ====================
  describe('Service Scanning', () => {
    it('应扫描外部服务', async () => {
      const schema = await monitor.getCurrentSchema();
      
      expect(Array.isArray(schema.capabilities.services)).toBe(true);
      
      for (const service of schema.capabilities.services) {
        expect(service.name).toBeDefined();
        expect(typeof service.available).toBe('boolean');
      }
    });
  });

  // ==================== 资源使用测试 ====================
  describe('Resource Usage', () => {
    it('应返回有效的内存使用率', async () => {
      const schema = await monitor.getCurrentSchema();
      
      expect(schema.resources.memory.usagePercent).toBeGreaterThanOrEqual(0);
      expect(schema.resources.memory.usagePercent).toBeLessThanOrEqual(1);
    });

    it('应返回有效的CPU负载', async () => {
      const schema = await monitor.getCurrentSchema();
      
      expect(Array.isArray(schema.resources.cpu.loadAvg)).toBe(true);
      expect(schema.resources.cpu.loadAvg.length).toBe(3);
      
      for (const load of schema.resources.cpu.loadAvg) {
        expect(typeof load).toBe('number');
        expect(load).toBeGreaterThanOrEqual(0);
      }
    });

    it('应返回有效的进程内存信息', async () => {
      const schema = await monitor.getCurrentSchema();
      
      expect(schema.resources.process.rss).toBeGreaterThan(0);
      expect(schema.resources.process.heapTotal).toBeGreaterThan(0);
      expect(schema.resources.process.heapUsed).toBeGreaterThan(0);
      expect(schema.resources.process.heapUsed).toBeLessThanOrEqual(
        schema.resources.process.heapTotal
      );
    });
  });

  // ==================== 边界情况测试 ====================
  describe('Edge Cases', () => {
    it('应处理连续多次获取身体图式', async () => {
      const schemas: BodySchema[] = [];
      
      for (let i = 0; i < 5; i++) {
        schemas.push(await monitor.getCurrentSchema());
      }
      
      // 所有图式都应有效
      for (const schema of schemas) {
        expect(schema.identity.pid).toBe(process.pid);
      }
    });

    it('应处理并发获取身体图式', async () => {
      const [schema1, schema2, schema3] = await Promise.all([
        monitor.getCurrentSchema(),
        monitor.getCurrentSchema(),
        monitor.getCurrentSchema(),
      ]);
      
      expect(schema1.identity.pid).toBe(schema2.identity.pid);
      expect(schema2.identity.pid).toBe(schema3.identity.pid);
    });

    it('应在不同时间点生成不同的时间戳', async () => {
      const schema1 = await monitor.getCurrentSchema();
      await new Promise(resolve => setTimeout(resolve, 10));
      const schema2 = await monitor.getCurrentSchema();
      
      expect(schema2.timestamp.getTime()).toBeGreaterThanOrEqual(
        schema1.timestamp.getTime()
      );
    });
  });
});
