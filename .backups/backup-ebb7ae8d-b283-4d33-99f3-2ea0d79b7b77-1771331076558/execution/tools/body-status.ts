/**
 * Body Status Tool
 * 获取Ouroboros系统状态和健康信息
 */

import { Tool, ToolDefinition, ExecutionContext } from '../tool-registry.js';

export interface BodyStatusInput {
  includeMetrics?: boolean;
  includeMemory?: boolean;
  detailLevel?: 'basic' | 'detailed' | 'full';
}

export interface BodyStatusOutput {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  components: {
    name: string;
    status: 'up' | 'down' | 'warning';
    latency?: number;
    message?: string;
  }[];
  metrics?: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu?: number;
    activeSessions?: number;
    requestRate?: number;
  };
  memory?: {
    shortTerm: number;
    longTerm: number;
    totalEntries: number;
  };
}

const definition: ToolDefinition = {
  name: 'body_status',
  description: '获取Ouroboros系统的当前状态和健康信息，包括各组件状态、资源使用情况和记忆统计',
  parameters: {
    type: 'object',
    properties: {
      includeMetrics: {
        type: 'boolean',
        description: '是否包含系统指标数据（CPU、内存等）'
      },
      includeMemory: {
        type: 'boolean',
        description: '是否包含记忆系统统计'
      },
      detailLevel: {
        type: 'string',
        description: '详细程度级别',
        enum: ['basic', 'detailed', 'full']
      }
    }
  },
  execute: async () => ({}),
  category: 'system',
  tags: ['status', 'health', 'monitoring'],
  version: '1.0.0'
};

/**
 * 模拟获取系统组件状态
 */
function getComponentStatus(): BodyStatusOutput['components'] {
  const components = [
    { name: 'model_engine', required: true },
    { name: 'tool_registry', required: true },
    { name: 'memory_system', required: true },
    { name: 'file_system', required: false },
    { name: 'web_search', required: false }
  ];

  return components.map(comp => {
    // 模拟随机状态，实际系统中应该是真实检查
    const rand = Math.random();
    let status: 'up' | 'down' | 'warning' = 'up';
    let message: string | undefined;
    let latency: number | undefined;

    if (rand > 0.95) {
      status = comp.required ? 'warning' : 'down';
      message = comp.required ? 'High latency detected' : 'Service unavailable';
    }

    if (status !== 'down') {
      latency = Math.floor(Math.random() * 100) + 10;
    }

    return {
      name: comp.name,
      status,
      latency,
      message
    };
  });
}

/**
 * 获取内存使用情况
 */
function getMemoryMetrics(): BodyStatusOutput['metrics']['memory'] {
  // 模拟内存数据，实际系统应该从os模块获取
  const total = 16 * 1024 * 1024 * 1024; // 16GB
  const used = Math.floor(total * (0.3 + Math.random() * 0.4)); // 30-70%
  
  return {
    used,
    total,
    percentage: Math.floor((used / total) * 100)
  };
}

/**
 * 获取记忆系统统计
 */
async function getMemoryStats(): Promise<BodyStatusOutput['memory']> {
  // 实际实现中应该查询记忆系统
  return {
    shortTerm: Math.floor(Math.random() * 100),
    longTerm: Math.floor(Math.random() * 1000),
    totalEntries: Math.floor(Math.random() * 10000)
  };
}

/**
 * 计算整体系统状态
 */
function calculateOverallStatus(components: BodyStatusOutput['components']): BodyStatusOutput['status'] {
  const downCount = components.filter(c => c.status === 'down').length;
  const warningCount = components.filter(c => c.status === 'warning').length;
  const requiredComponents = components.filter(c => 
    ['model_engine', 'tool_registry', 'memory_system'].includes(c.name)
  );
  const requiredDown = requiredComponents.filter(c => c.status === 'down').length;

  if (requiredDown > 0) return 'unhealthy';
  if (downCount > 0 || warningCount > 0) return 'degraded';
  return 'healthy';
}

/**
 * 格式化字节大小
 */
function formatBytes(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}

async function execute(
  params: BodyStatusInput,
  context: ExecutionContext
): Promise<BodyStatusOutput> {
  const { 
    includeMetrics = true, 
    includeMemory = true, 
    detailLevel = 'basic' 
  } = params;

  const components = getComponentStatus();
  const status = calculateOverallStatus(components);

  const result: BodyStatusOutput = {
    status,
    version: process.env.OUROBOROS_VERSION || '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    components
  };

  if (includeMetrics) {
    const memory = getMemoryMetrics();
    result.metrics = {
      memory,
      cpu: detailLevel !== 'basic' ? Math.floor(Math.random() * 100) : undefined,
      activeSessions: detailLevel === 'full' ? Math.floor(Math.random() * 50) : undefined,
      requestRate: detailLevel === 'full' ? Math.floor(Math.random() * 1000) : undefined
    };
  }

  if (includeMemory) {
    result.memory = await getMemoryStats();
  }

  // 格式化输出
  if (detailLevel === 'basic') {
    // 基本级别只返回关键信息
    return {
      status: result.status,
      version: result.version,
      uptime: result.uptime,
      timestamp: result.timestamp,
      components: result.components.map(c => ({
        name: c.name,
        status: c.status
      }))
    } as BodyStatusOutput;
  }

  return result;
}

/**
 * 验证输入参数
 */
function validate(params: BodyStatusInput): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (params.detailLevel && !['basic', 'detailed', 'full'].includes(params.detailLevel)) {
    errors.push("detailLevel must be one of: 'basic', 'detailed', 'full'");
  }

  return { valid: errors.length === 0, errors };
}

export const bodyStatusTool: ToolDefinition = definition;

export default bodyStatusTool;
