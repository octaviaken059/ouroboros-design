/**
 * @file types/model.ts
 * @description 模型引擎类型定义
 * @author Ouroboros
 * @date 2026-02-18
 */

/**
 * 模型提供商类型
 */
export type ModelProvider = 'ollama' | 'openai';

/**
 * 模型配置接口
 */
export interface ModelConfig {
  /** 提供商 */
  provider: ModelProvider;
  /** 模型名称 */
  model: string;
  /** API基础URL */
  baseUrl?: string;
  /** API密钥 */
  apiKey?: string;
  /** 温度参数 */
  temperature: number;
  /** 最大Token数 */
  maxTokens: number;
  /** 超时时间(毫秒) */
  timeoutMs: number;
}

/**
 * 默认模型配置
 */
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: 'ollama',
  model: 'deepseek-r1:8b',
  baseUrl: 'http://localhost:11434',
  temperature: 0.7,
  maxTokens: 2048,
  timeoutMs: 60000,
};

/**
 * Token预算配置
 */
export interface TokenBudget {
  /** 系统提示词预算比例 */
  system: number;
  /** 自我描述预算比例 */
  self: number;
  /** 记忆预算比例 */
  memory: number;
  /** 用户输入预算比例 */
  user: number;
}

/**
 * 默认Token预算分配
 */
export const DEFAULT_TOKEN_BUDGET: TokenBudget = {
  system: 0.2,
  self: 0.4,
  memory: 0.3,
  user: 0.1,
};

/**
 * 消息角色
 */
export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * 聊天消息
 */
export interface ChatMessage {
  role: MessageRole;
  content: string;
  /** 元数据(如思考过程) */
  metadata?: Record<string, unknown>;
}

/**
 * 模型响应
 */
export interface ModelResponse {
  /** 响应内容 */
  content: string;
  /** 使用的Token数 */
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** 模型名称 */
  model: string;
  /** 响应时间(毫秒) */
  responseTimeMs: number;
  /** 思考过程(如果有) */
  thinking?: string;
}

/**
 * 流式响应回调
 */
export interface StreamingCallbacks {
  /** 收到内容片段 */
  onChunk: (chunk: string) => void;
  /** 收到思考过程 */
  onThinking?: (thinking: string) => void;
  /** 完成 */
  onComplete?: (response: ModelResponse) => void;
  /** 错误 */
  onError?: (error: Error) => void;
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  /** 模型名称 */
  model: string;
  /** 输入Token数 */
  inputTokens: number;
  /** 输出Token数 */
  outputTokens: number;
  /** 响应时间(毫秒) */
  responseTimeMs: number;
  /** 是否成功 */
  success: boolean;
  /** 时间戳 */
  timestamp: string;
}

/**
 * 三类提示词结构
 */
export interface ThreeTierPrompts {
  /** 系统提示词 */
  system: string;
  /** 自我提示词 */
  self: string;
  /** 记忆提示词 */
  memory: string;
}

/**
 * 提示词组装结果
 */
export interface AssembledPrompt {
  /** 系统提示词 */
  system: string;
  /** 用户提示词 */
  user: string;
  /** 实际使用的Token数 */
  tokenCount: number;
  /** 是否被截断 */
  truncated: boolean;
  /** 三类提示词（调试用） */
  threeTierPrompts?: ThreeTierPrompts;
}

/**
 * 预算分配结果
 */
export interface BudgetAllocation {
  /** 系统提示词预算 */
  systemBudget: number;
  /** 自我描述预算 */
  selfBudget: number;
  /** 记忆预算 */
  memoryBudget: number;
  /** 用户输入预算 */
  userBudget: number;
  /** 总预算 */
  totalBudget: number;
}

/**
 * Ollama 请求体
 */
export interface OllamaRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

/**
 * Ollama 响应
 */
export interface OllamaResponse {
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

/**
 * OpenAI 请求体
 */
export interface OpenAIRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

/**
 * OpenAI 响应
 */
export interface OpenAIResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
