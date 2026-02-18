/**
 * @file capabilities/model-engine/performance-monitor.ts
 * @description 性能监控器 - 记录和分析模型性能指标
 * @author Ouroboros
 * @date 2026-02-18
 */

import type { PerformanceMetrics } from '@/types/model';
import { createContextLogger } from '@/utils/logger';
import { getConfig } from '@/config';

const logger = createContextLogger('PerformanceMonitor');

/**
 * 性能记录
 */
interface PerformanceRecord extends PerformanceMetrics {
  /** 请求ID */
  requestId: string;
}

/**
 * 性能统计
 */
interface PerformanceStats {
  /** 平均输入Token */
  avgInputTokens: number;
  /** 平均输出Token */
  avgOutputTokens: number;
  /** 平均响应时间 */
  avgResponseTimeMs: number;
  /** 成功率 */
  successRate: number;
  /** 总请求数 */
  totalRequests: number;
  /** 成功请求数 */
  successCount: number;
  /** 失败请求数 */
  failureCount: number;
}

/**
 * 性能监控器类
 * 记录和统计模型性能指标
 */
export class PerformanceMonitor {
  /** 性能记录列表 */
  private records: PerformanceRecord[] = [];
  /** 最大记录数 */
  private maxRecords: number;

  /**
   * 创建性能监控器
   * @param maxRecords 最大记录数（可选，不传则使用全局配置）
   */
  constructor(maxRecords?: number) {
    const config = getConfig();
    this.maxRecords = maxRecords ?? config.model.performanceMonitorMaxRecords;
    logger.info('性能监控器初始化完成', { maxRecords: this.maxRecords });
  }

  /**
   * 记录性能指标
   * @param metrics 性能指标
   */
  record(metrics: PerformanceMetrics): void {
    const record: PerformanceRecord = {
      ...metrics,
      requestId: this.generateRequestId(),
    };

    this.records.push(record);

    // 限制记录数量
    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }

    logger.debug('性能指标已记录', {
      model: metrics.model,
      tokens: metrics.inputTokens + metrics.outputTokens,
      responseTimeMs: metrics.responseTimeMs,
      success: metrics.success,
    });
  }

  /**
   * 获取所有记录
   * @returns 性能记录列表
   */
  getRecords(): PerformanceRecord[] {
    return [...this.records];
  }

  /**
   * 获取最近N条记录
   * @param n 数量
   * @returns 性能记录列表
   */
  getRecentRecords(n: number): PerformanceRecord[] {
    return this.records.slice(-n);
  }

  /**
   * 获取按模型的统计
   * @param model 模型名称
   * @returns 性能统计
   */
  getStatsByModel(model: string): PerformanceStats {
    const modelRecords = this.records.filter((r) => r.model === model);

    if (modelRecords.length === 0) {
      return this.getEmptyStats();
    }

    return this.calculateStats(modelRecords);
  }

  /**
   * 获取总体统计
   * @returns 性能统计
   */
  getOverallStats(): PerformanceStats {
    if (this.records.length === 0) {
      return this.getEmptyStats();
    }

    return this.calculateStats(this.records);
  }

  /**
   * 获取按时间范围的统计
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @returns 性能统计
   */
  getStatsByTimeRange(startTime: string, endTime: string): PerformanceStats {
    const filtered = this.records.filter(
      (r) => r.timestamp >= startTime && r.timestamp <= endTime
    );

    if (filtered.length === 0) {
      return this.getEmptyStats();
    }

    return this.calculateStats(filtered);
  }

  /**
   * 计算统计数据
   * @param records 记录列表
   * @returns 性能统计
   */
  private calculateStats(records: PerformanceRecord[]): PerformanceStats {
    const totalRequests = records.length;
    const successCount = records.filter((r) => r.success).length;
    const failureCount = totalRequests - successCount;

    const totalInputTokens = records.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalOutputTokens = records.reduce((sum, r) => sum + r.outputTokens, 0);
    const totalResponseTime = records.reduce((sum, r) => sum + r.responseTimeMs, 0);

    return {
      avgInputTokens: Math.round(totalInputTokens / totalRequests),
      avgOutputTokens: Math.round(totalOutputTokens / totalRequests),
      avgResponseTimeMs: Math.round(totalResponseTime / totalRequests),
      successRate: Math.round((successCount / totalRequests) * 1000) / 10,
      totalRequests,
      successCount,
      failureCount,
    };
  }

  /**
   * 获取空统计
   * @returns 空统计对象
   */
  private getEmptyStats(): PerformanceStats {
    return {
      avgInputTokens: 0,
      avgOutputTokens: 0,
      avgResponseTimeMs: 0,
      successRate: 0,
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
    };
  }

  /**
   * 生成请求ID
   * @returns 请求ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 清空记录
   */
  clear(): void {
    this.records = [];
    logger.info('性能记录已清空');
  }

  /**
   * 导出为 CSV
   * @returns CSV 字符串
   */
  exportToCSV(): string {
    if (this.records.length === 0) {
      return 'timestamp,model,inputTokens,outputTokens,responseTimeMs,success\n';
    }

    const headers = 'timestamp,model,inputTokens,outputTokens,responseTimeMs,success\n';
    const rows = this.records
      .map(
        (r) =>
          `${r.timestamp},${r.model},${r.inputTokens},${r.outputTokens},${r.responseTimeMs},${r.success}`
      )
      .join('\n');

    return headers + rows;
  }

  /**
   * 生成性能报告
   * @returns 性能报告文本
   */
  generateReport(): string {
    const stats = this.getOverallStats();

    return `## 性能报告

### 总体统计
- 总请求数: ${stats.totalRequests}
- 成功: ${stats.successCount} (${stats.successRate}%)
- 失败: ${stats.failureCount}
- 平均输入Token: ${stats.avgInputTokens}
- 平均输出Token: ${stats.avgOutputTokens}
- 平均响应时间: ${stats.avgResponseTimeMs}ms

### 记录时间范围
${this.records.length > 0
        ? `- 最早: ${this.records[0].timestamp}\n- 最晚: ${this.records[this.records.length - 1].timestamp}`
        : '- 无记录'
      }
`;
  }

  /**
   * 序列化为 JSON
   * @returns 序列化数据
   */
  toJSON(): object {
    return {
      records: [...this.records],
      maxRecords: this.maxRecords,
    };
  }

  /**
   * 从 JSON 恢复
   * @param data 序列化数据
   * @returns PerformanceMonitor 实例
   */
  static fromJSON(data: {
    records: PerformanceRecord[];
    maxRecords: number;
  }): PerformanceMonitor {
    const monitor = new PerformanceMonitor(data.maxRecords);
    monitor.records = [...data.records];
    return monitor;
  }
}
