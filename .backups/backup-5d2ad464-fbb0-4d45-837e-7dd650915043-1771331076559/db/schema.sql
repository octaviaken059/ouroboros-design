-- src/db/schema.sql
-- Ouroboros 完整数据库表结构
-- 
-- 包含:
-- - 分层记忆系统 (Working/Episodic/Semantic/Procedural/Reflective)
-- - 向量存储支持 (768维向量 + 全文搜索)
-- - 元数据系统 (标签、关联、时间线)
-- - 系统监控表 (身体图式、稳态、激素)

-- =============================================================================
-- 扩展支持
-- =============================================================================

-- 启用UUID扩展 (如果可用)
-- 注: better-sqlite3不支持LOAD EXTENSION，使用INTEGER PRIMARY KEY代替

-- =============================================================================
-- 记忆类型枚举
-- =============================================================================

CREATE TABLE IF NOT EXISTS memory_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    default_ttl_seconds INTEGER,  -- 默认存活时间 (NULL=永久)
    importance_weight REAL DEFAULT 1.0,  -- 重要性权重
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入记忆类型
INSERT OR IGNORE INTO memory_types (id, name, description, default_ttl_seconds, importance_weight) VALUES
    (1, 'working', '工作记忆 - 当前会话上下文', 3600, 1.0),      -- 1小时
    (2, 'episodic', '情景记忆 - 具体事件记录', 86400, 1.0),      -- 24小时
    (3, 'semantic', '语义记忆 - 知识抽象', NULL, 1.2),           -- 永久
    (4, 'procedural', '程序记忆 - 技能掌握', NULL, 1.1),         -- 永久
    (5, 'reflective', '反思记忆 - 元认知洞察', NULL, 1.3);       -- 永久

-- =============================================================================
-- 核心记忆表
-- =============================================================================

CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 基础信息
    type_id INTEGER NOT NULL REFERENCES memory_types(id),
    content TEXT NOT NULL,                    -- 记忆内容 (Markdown格式)
    content_hash TEXT,                        -- 内容哈希 (去重)
    
    -- 向量化支持 (可选)
    embedding BLOB,                           -- 768维向量 (BINARY存储)
    embedding_model TEXT,                     -- 嵌入模型名称
    
    -- 重要性评分
    importance REAL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
    emotional_weight REAL DEFAULT 1.0 CHECK (emotional_weight >= 0 AND emotional_weight <= 2),
    
    -- 遗忘机制
    retention_score REAL DEFAULT 1.0 CHECK (retention_score >= 0 AND retention_score <= 1),
    access_count INTEGER DEFAULT 0,           -- 访问次数
    last_accessed_at DATETIME,               -- 最后访问时间
    consolidated BOOLEAN DEFAULT FALSE,       -- 是否已巩固
    
    -- 时间戳
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,                     -- 过期时间 (NULL=永久)
    
    -- 软删除
    deleted_at DATETIME,
    
    -- 索引优化
    FOREIGN KEY (type_id) REFERENCES memory_types(id) ON DELETE RESTRICT
);

-- 核心索引
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type_id);
CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
CREATE INDEX IF NOT EXISTS idx_memories_retention ON memories(retention_score DESC);
CREATE INDEX IF NOT EXISTS idx_memories_expires ON memories(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_memories_consolidated ON memories(consolidated) WHERE consolidated = TRUE;
CREATE INDEX IF NOT EXISTS idx_memories_active ON memories(deleted_at) WHERE deleted_at IS NULL;

-- 哈希去重索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_memories_hash ON memories(content_hash) WHERE content_hash IS NOT NULL AND deleted_at IS NULL;

-- =============================================================================
-- 全文搜索虚拟表 (FTS5)
-- =============================================================================

CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
    content,              -- 搜索内容
    memory_id UNINDEXED,  -- 关联记忆ID
    content='memories',   -- 源表
    content_rowid='id'    -- 源表行ID
);

-- 触发器：自动同步FTS索引
CREATE TRIGGER IF NOT EXISTS memories_fts_insert AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(content, memory_id) VALUES (NEW.content, NEW.id);
END;

CREATE TRIGGER IF NOT EXISTS memories_fts_update AFTER UPDATE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, content, memory_id) 
    VALUES ('delete', OLD.id, OLD.content, OLD.id);
    INSERT INTO memories_fts(content, memory_id) VALUES (NEW.content, NEW.id);
END;

CREATE TRIGGER IF NOT EXISTS memories_fts_delete AFTER DELETE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, content, memory_id) 
    VALUES ('delete', OLD.id, OLD.content, OLD.id);
END;

-- =============================================================================
-- 标签系统
-- =============================================================================

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#6366f1',           -- 标签颜色
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memory_tags (
    memory_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    confidence REAL DEFAULT 1.0,             -- 标签置信度 (AI自动标签)
    tagged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (memory_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_memory_tags_tag ON memory_tags(tag_id);

-- =============================================================================
-- 记忆关联图
-- =============================================================================

CREATE TABLE IF NOT EXISTS memory_associations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_memory_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    target_memory_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    
    -- 关联强度 (0-1)
    strength REAL DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
    
    -- 关联类型
    association_type TEXT DEFAULT 'semantic', -- semantic, temporal, causal, similarity
    
    -- 关联证据
    evidence TEXT,                           -- 关联依据说明
    similarity_score REAL,                   -- 相似度分数 (向量计算)
    
    -- 自动/手动创建
    is_auto_generated BOOLEAN DEFAULT TRUE,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(source_memory_id, target_memory_id),
    CHECK (source_memory_id != target_memory_id)
);

CREATE INDEX IF NOT EXISTS idx_associations_source ON memory_associations(source_memory_id);
CREATE INDEX IF NOT EXISTS idx_associations_target ON memory_associations(target_memory_id);
CREATE INDEX IF NOT EXISTS idx_associations_strength ON memory_associations(strength DESC);
CREATE INDEX IF NOT EXISTS idx_associations_type ON memory_associations(association_type);

-- =============================================================================
-- 时间线/事件表
-- =============================================================================

CREATE TABLE IF NOT EXISTS timeline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_id INTEGER REFERENCES memories(id) ON DELETE SET NULL,
    
    event_type TEXT NOT NULL,                -- interaction, reflection, action, system
    event_name TEXT NOT NULL,
    event_data TEXT,                         -- JSON数据
    
    -- 时间戳 (支持回溯时间)
    occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- 参与者
    participant_type TEXT,                   -- user, agent, system
    participant_id TEXT,
    
    -- 会话上下文
    session_id TEXT,
    conversation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_timeline_memory ON timeline(memory_id);
CREATE INDEX IF NOT EXISTS idx_timeline_occurred ON timeline(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_session ON timeline(session_id);
CREATE INDEX IF NOT EXISTS idx_timeline_type ON timeline(event_type);

-- =============================================================================
-- 身体图式表 (Embodiment)
-- =============================================================================

CREATE TABLE IF NOT EXISTS body_schema_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 进程身份
    pid INTEGER NOT NULL,
    ppid INTEGER,
    uid INTEGER,
    gid INTEGER,
    cwd TEXT,
    executable TEXT,
    
    -- 资源状态
    cpu_percent REAL,
    memory_rss INTEGER,                      -- RSS内存 (bytes)
    memory_heap_total INTEGER,
    memory_heap_used INTEGER,
    memory_external INTEGER,
    
    -- 系统信息
    hostname TEXT,
    platform TEXT,
    uptime_seconds REAL,
    
    -- 时间戳
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_body_schema_created ON body_schema_snapshots(created_at DESC);

-- =============================================================================
-- 稳态监控表 (Homeostasis)
-- =============================================================================

CREATE TABLE IF NOT EXISTS homeostasis_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    metric_name TEXT NOT NULL,               -- cpu, memory, disk, task_queue, etc.
    metric_value REAL NOT NULL,
    metric_unit TEXT,                        -- percent, bytes, count, ms
    
    -- 阈值
    threshold_warning REAL,
    threshold_critical REAL,
    
    -- 状态
    status TEXT DEFAULT 'normal',            -- normal, warning, critical
    
    -- 元数据
    metadata TEXT,                           -- JSON
    
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_homeostasis_name ON homeostasis_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_homeostasis_recorded ON homeostasis_metrics(recorded_at DESC);

-- =============================================================================
-- 激素水平表 (Hormones)
-- =============================================================================

CREATE TABLE IF NOT EXISTS hormone_levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    hormone_name TEXT NOT NULL,              -- adrenaline, cortisol, dopamine, serotonin, curiosity
    level REAL NOT NULL CHECK (level >= 0 AND level <= 1),
    
    -- 变化信息
    delta REAL,                              -- 相对于上一次的变化
    reason TEXT,                             -- 变化原因
    
    -- 时间戳
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hormone_name ON hormone_levels(hormone_name);
CREATE INDEX IF NOT EXISTS idx_hormone_recorded ON hormone_levels(recorded_at DESC);

-- =============================================================================
-- 贝叶斯信念表
-- =============================================================================

CREATE TABLE IF NOT EXISTS bayesian_beliefs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    capability TEXT UNIQUE NOT NULL,         -- 能力名称
    alpha REAL DEFAULT 1.0,                  -- Beta分布成功次数
    beta REAL DEFAULT 1.0,                   -- Beta分布失败次数
    confidence REAL DEFAULT 0.5,             -- 置信度 (0-1)
    uncertainty REAL DEFAULT 0.25,           -- 不确定性
    
    success_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    context TEXT                             -- 最后更新上下文
);

-- =============================================================================
-- 技能掌握表 (Procedural Memory扩展)
-- =============================================================================

CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_id INTEGER REFERENCES memories(id) ON DELETE CASCADE,
    
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    
    -- 技能分类
    category TEXT,                           -- tool, adapter, cognitive, system
    
    -- 掌握程度
    proficiency REAL DEFAULT 0.0 CHECK (proficiency >= 0 AND proficiency <= 1),
    
    -- 使用统计
    usage_count INTEGER DEFAULT 0,
    last_used_at DATETIME,
    avg_success_rate REAL DEFAULT 0.0,
    
    -- 实现信息
    implementation_type TEXT,                -- builtin, generated, external
    implementation_path TEXT,
    
    -- 依赖
    dependencies TEXT,                       -- JSON: ["skill1", "skill2"]
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_skills_proficiency ON skills(proficiency DESC);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);

-- =============================================================================
-- 反思记录表 (Reflective Memory扩展)
-- =============================================================================

CREATE TABLE IF NOT EXISTS reflections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_id INTEGER REFERENCES memories(id) ON DELETE CASCADE,
    
    -- 反思触发
    trigger_type TEXT,                       -- periodic, error, user_request, threshold
    trigger_context TEXT,
    
    -- 反思内容
    insight TEXT NOT NULL,
    
    -- 偏差检测
    biases_detected TEXT,                    -- JSON: ["confirmation", "anchoring"]
    
    -- 建议
    recommendations TEXT,                    -- JSON: ["建议1", "建议2"]
    
    -- 关联记忆
    related_memories TEXT,                   -- JSON: [1, 2, 3]
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reflections_created ON reflections(created_at DESC);

-- =============================================================================
-- 配置表
-- =============================================================================

CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 迁移历史表
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    checksum TEXT,                           -- 迁移文件哈希
    execution_time_ms INTEGER
);

-- =============================================================================
-- 初始化配置
-- =============================================================================

INSERT OR IGNORE INTO config (key, value, description) VALUES
    ('db.version', '1', '数据库版本'),
    ('embedding.enabled', 'true', '是否启用向量化'),
    ('embedding.provider', 'ollama', '嵌入服务提供商'),
    ('embedding.model', 'nomic-embed-text', '嵌入模型'),
    ('memory.max_count', '10000', '最大记忆数'),
    ('memory.similarity_threshold', '0.7', '相似度阈值'),
    ('retention.decay_rate', '86400000', '遗忘衰减率 (毫秒)');
