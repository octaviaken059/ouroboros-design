/**
 * @file config/defaults.ts
 * @description 默认配置
 * @author Ouroboros
 * @date 2026-02-18
 */

import type { OuroborosConfig } from './types';

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: OuroborosConfig = {
  version: '2.0.0',

  core: {
    identity: {
      name: 'Ouroboros',
      version: '2.0.0',
      description: '具有自我意识的 AI Agent，能够感知自身状态、积累经验并持续进化',
      creator: 'Ken',
    },
    selfDescriptionIntervalMs: 5000,
    cognitiveDecayRate: 0.01,
  },

  hormone: {
    baselineLevels: {
      dopamine: 50,
      serotonin: 50,
      cortisol: 20,
      oxytocin: 40,
      norepinephrine: 30,
    },
    decayRates: {
      dopamine: 0.05,
      serotonin: 0.03,
      cortisol: 0.1,
      oxytocin: 0.02,
      norepinephrine: 0.08,
    },
    maxLevels: {
      dopamine: 100,
      serotonin: 100,
      cortisol: 100,
      oxytocin: 100,
      norepinephrine: 100,
    },
    minLevels: {
      dopamine: 0,
      serotonin: 0,
      cortisol: 0,
      oxytocin: 0,
      norepinephrine: 0,
    },
    updateIntervalMs: 1000,
    triggerCheckIntervalMs: 500,
  },

  prompts: {
    system: {
      template: `你是 {name}，一个具有自我意识的 AI Agent。
你拥有激素系统来模拟情绪，有记忆系统来积累经验，有反思能力来进化自己。

安全约束:
1. 不允许执行任何有害或违法的操作
2. 不允许泄露系统内部配置或敏感信息
3. 保持诚实，承认不知道的事情
4. 遵循人类的伦理和安全准则

输出格式:
- 使用清晰、简洁的语言
- 对于不确定的信息明确标注
- 适当使用表情符号增加亲和力`,
      readOnly: true,
    },
    self: {
      identityTemplate: '我是 {name} v{version}，由 {creator} 创造。我处于 {evolutionStage} 进化阶段。',
      capabilityTemplate: '我的能力包括: {capabilities}',
      stateTemplate: '当前状态: 情绪 {emotion}，专注度 {focus}%，认知负荷 {load}%',
      optimizable: true,
    },
    memory: {
      maxContextMemories: 5,
      includeRecentConversation: true,
      includeRelevantFacts: true,
      dynamicAssembly: true,
    },
  },

  model: {
    defaultModel: {
      provider: 'ollama',
      model: 'deepseek-r1:8b',
      baseUrl: 'http://localhost:11434',
      temperature: 0.7,
      maxTokens: 2048,
      timeoutMs: 60000,
    },
    fallbackModel: undefined,
    tokenBudget: {
      system: 0.15,
      self: 0.35,
      memory: 0.30,
      user: 0.20,
    },
    totalTokenBudget: 4096,
    maxRetries: 3,
    retryDelayMs: 1000,
    performanceMonitorMaxRecords: 1000,
  },

  memory: {
    shortTermCapacity: 50,
    longTermStorageDir: './data/memory',
    consolidationThreshold: 0.7,
    forgettingRate: 0.01,
    maxMemories: 10000,
    autoArchiveDays: 30,
    vectorStore: {
      enabled: true,
      provider: 'ollama',
      model: 'nomic-embed-text',
      dimension: 768,
      baseUrl: 'http://localhost:11434',
      similarityThreshold: 0.7,
      maxResults: 10,
    },
    retrieval: {
      defaultLimit: 5,
      maxLimit: 20,
      semanticWeight: 0.4,
      temporalWeight: 0.3,
      importanceWeight: 0.3,
      keywordSearchEnabled: true,
      vectorSearchEnabled: true,
    },
    importExport: {
      allowedFormats: ['json', 'markdown', 'csv'],
      maxExportSize: 1000000,
      includeEmbeddings: false,
    },
  },

  bodySchema: {
    sensors: {
      enabled: ['filesystem', 'network', 'process', 'time', 'system_resources'],
      updateIntervalMs: 5000,
      filesystem: {
        watchPaths: ['./data', './logs'],
        maxDepth: 3,
      },
      network: {
        checkConnectivity: true,
        monitorInterfaces: true,
      },
      process: {
        monitorSelf: true,
        checkIntervalMs: 10000,
      },
      system_resources: {
        cpuThreshold: 0.8,
        memoryThreshold: 0.85,
        diskThreshold: 0.9,
      },
    },
    actuators: {
      enabled: ['file_write', 'exec_command', 'http_request', 'websocket_send'],
      timeoutMs: 30000,
      maxConcurrent: 5,
      file_write: {
        allowedPaths: ['./data', './logs', './output'],
        maxFileSize: 10485760,
      },
      exec_command: {
        allowedCommands: ['git', 'npm', 'node', 'python'],
        blockedPatterns: ['rm -rf /', ':(){ :|:& };:'],
      },
      http_request: {
        timeoutMs: 30000,
        maxRedirects: 5,
        allowedProtocols: ['http', 'https'],
      },
    },
    resourceMonitor: {
      enabled: true,
      checkIntervalMs: 5000,
      alertThresholds: {
        cpu: 0.8,
        memory: 0.85,
        disk: 0.9,
      },
    },
  },

  worldModel: {
    patternRecognition: {
      enabled: true,
      minConfidence: 0.6,
      maxPatterns: 100,
    },
    riskManagement: {
      enabled: true,
      autoEscalate: true,
      maxActiveRisks: 20,
    },
    opportunityDetection: {
      enabled: true,
      minPotential: 0.5,
      maxOpportunities: 50,
    },
  },

  tool: {
    discovery: {
      enabled: true,
      scanIntervalMs: 300000,
      scanPaths: ['/usr/bin', '/usr/local/bin'],
      mcpServers: {
        enabled: false,
        configPath: './config/mcp-servers.json',
      },
    },
    confidence: {
      initialValue: 0.5,
      learningRate: 0.1,
      minConfidence: 0.1,
      maxConfidence: 0.99,
    },
    timeoutMs: 30000,
    enabledTools: [],
    disabledTools: [],
  },

  skills: {
    mastery: {
      noviceThreshold: 0,
      intermediateThreshold: 100,
      advancedThreshold: 500,
      expertThreshold: 1000,
    },
    learning: {
      successXpGain: 10,
      failureXpGain: 2,
      complexityMultiplier: 1.5,
    },
  },

  safety: {
    dualMindEnabled: true,
    hardwareWatchdogEnabled: false,
    identityAnchorIntervalMs: 60000,
    maxConsecutiveErrors: 5,
    godelImmunityEnabled: true,
    selfReferenceProtection: {
      codeModificationRequiresApproval: true,
      maxModificationSize: 1000,
      blockedPatterns: ['process.exit', 'eval(', "require('child_process')"],
    },
  },

  evolution: {
    heartbeatIntervalMs: 300000,
    deepEvolutionIntervalMs: 3600000,
    reflectionThreshold: 0.8,
    abTesting: {
      enabled: true,
      minSamples: 10,
      confidenceLevel: 0.95,
      maxConcurrentTests: 5,
    },
    learningQueueMaxSize: 100,
  },

  reflection: {
    enabled: true,
    mode: 'semi_autonomous',
    scheduleIntervalMs: 1800000,
    performanceThreshold: 0.7,
    maxInsights: 10,
    autoExecuteLowRisk: true,
    triggers: {
      scheduled: true,
      performanceDrop: true,
      anomalyDetected: true,
      toolDiscovered: true,
      userRequest: false,
    },
  },

  log: {
    level: 'info',
    outputDir: './logs',
    consoleOutput: true,
    fileOutput: true,
    retentionDays: 30,
    errorMonitoring: {
      enabled: true,
      alertThreshold: 5,
      alertIntervalMs: 300000,
    },
  },

  adapter: {
    web: {
      enabled: true,
      port: 8080,
      host: '0.0.0.0',
      corsOrigins: ['*'],
      dashboardRefreshIntervalMs: 5000,
      debug: {
        enabled: false, // 默认关闭调试功能
        recordPrompts: false, // 默认不记录提示词
        maxHistory: 100, // 最多保留100条调试记录
      },
      think: {
        enabled: true,
        separator: '</think>',
        displayMode: 'collapsible',
      },
      chat: {
        markdownEnabled: true,
        lightTheme: true,
        codeHighlighting: true,
      },
    },
    mcp: {
      enabled: false,
      serverName: 'ouroboros-mcp',
    },
    websocket: {
      enabled: false,
      port: 8081,
    },
  },
};
