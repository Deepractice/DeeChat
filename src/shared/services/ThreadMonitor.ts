/**
 * 📊 线程监控服务
 * 负责收集和分析线程性能数据，提供实时监控能力
 */

import { ThreadManager, ThreadInfo, ThreadStatus } from './ThreadManager'

export interface MonitoringMetrics {
  timestamp: number
  // 线程指标
  threadMetrics: {
    total: number
    active: number
    idle: number
    busy: number
    error: number
    queueLength: number
  }
  // 性能指标
  performanceMetrics: {
    averageResponseTime: number
    totalTokensUsed: number
    requestsPerMinute: number
    successRate: number
  }
  // 资源指标
  resourceMetrics: {
    totalMemoryUsage: number
    averageMemoryPerThread: number
    maxMemoryUsage: number
    activeCacheCount: number
  }
  // 健康指标
  healthMetrics: {
    overallHealth: 'healthy' | 'warning' | 'critical'
    issues: string[]
    recommendations: string[]
  }
}

export interface AlertRule {
  id: string
  name: string
  condition: (metrics: MonitoringMetrics) => boolean
  severity: 'info' | 'warning' | 'critical'
  message: string
  enabled: boolean
}

export interface Alert {
  id: string
  ruleId: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  timestamp: number
  metrics: MonitoringMetrics
  acknowledged: boolean
}

/**
 * 🎯 线程监控器
 */
export class ThreadMonitor {
  private threadManager: ThreadManager
  private metricsHistory: MonitoringMetrics[] = []
  private activeAlerts: Map<string, Alert> = new Map()
  private alertRules: Map<string, AlertRule> = new Map()
  private monitoringInterval?: NodeJS.Timeout
  private metricsRetentionHours = 24 // 保留24小时的指标数据

  constructor(threadManager: ThreadManager) {
    this.threadManager = threadManager
    this.initializeDefaultAlertRules()
  }

  /**
   * 🚀 启动监控
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring()
    }

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics()
    }, intervalMs)

    console.log('[ThreadMonitor] 📊 监控已启动')
  }

  /**
   * ⏹️ 停止监控
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }
    console.log('[ThreadMonitor] ⏹️ 监控已停止')
  }

  /**
   * 📈 收集指标
   */
  private collectMetrics(): void {
    const systemStats = this.threadManager.getSystemStats()
    const threads = this.threadManager.getAllThreads()
    const now = Date.now()

    // 计算性能指标
    const recentMetrics = this.metricsHistory.filter(m => now - m.timestamp < 60000) // 最近1分钟
    const requestsPerMinute = recentMetrics.reduce((sum, m) => 
      sum + threads.reduce((tSum, t) => tSum + t.stats.totalRequests, 0), 0
    )

    const totalRequests = threads.reduce((sum, t) => sum + t.stats.totalRequests, 0)
    const successfulRequests = threads.reduce((sum, t) => sum + t.stats.successfulRequests, 0)
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100

    // 计算资源指标
    const memoryUsages = threads.map(t => t.resources.memoryUsage)
    const maxMemoryUsage = Math.max(...memoryUsages, 0)
    const averageMemoryPerThread = memoryUsages.length > 0 ? 
      memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length : 0

    // 生成健康指标
    const healthAnalysis = this.analyzeHealth(systemStats, threads)

    const metrics: MonitoringMetrics = {
      timestamp: now,
      threadMetrics: {
        total: systemStats.totalThreads,
        active: systemStats.activeThreads,
        idle: systemStats.idleThreads,
        busy: systemStats.busyThreads,
        error: systemStats.errorThreads,
        queueLength: systemStats.queueLength
      },
      performanceMetrics: {
        averageResponseTime: systemStats.averageResponseTime,
        totalTokensUsed: systemStats.totalTokensUsed,
        requestsPerMinute,
        successRate
      },
      resourceMetrics: {
        totalMemoryUsage: systemStats.totalMemoryUsage,
        averageMemoryPerThread,
        maxMemoryUsage,
        activeCacheCount: threads.reduce((sum, t) => sum + t.resources.modelCacheSize, 0)
      },
      healthMetrics: healthAnalysis
    }

    // 存储指标
    this.metricsHistory.push(metrics)
    this.cleanupOldMetrics()

    // 检查告警
    this.checkAlerts(metrics)

    // 触发事件
    this.threadManager.emit?.('monitoring:metrics_collected', metrics)
  }

  /**
   * 🏥 分析系统健康状况
   */
  private analyzeHealth(systemStats: any, threads: ThreadInfo[]): {
    overallHealth: 'healthy' | 'warning' | 'critical'
    issues: string[]
    recommendations: string[]
  } {
    const issues: string[] = []
    const recommendations: string[] = []
    let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy'

    // 检查错误线程比例
    const errorRate = systemStats.totalThreads > 0 ? 
      (systemStats.errorThreads / systemStats.totalThreads) * 100 : 0
    
    if (errorRate > 50) {
      issues.push(`错误线程比例过高: ${errorRate.toFixed(1)}%`)
      recommendations.push('检查模型配置和网络连接')
      overallHealth = 'critical'
    } else if (errorRate > 20) {
      issues.push(`错误线程比例偏高: ${errorRate.toFixed(1)}%`)
      recommendations.push('监控错误日志并考虑重启异常线程')
      if (overallHealth === 'healthy') overallHealth = 'warning'
    }

    // 检查队列积压
    if (systemStats.queueLength > 10) {
      issues.push(`任务队列积压严重: ${systemStats.queueLength} 个任务`)
      recommendations.push('考虑增加并发线程数或优化任务处理')
      if (overallHealth !== 'critical') overallHealth = 'warning'
    }

    // 检查平均响应时间
    if (systemStats.averageResponseTime > 30000) {
      issues.push(`响应时间过慢: ${(systemStats.averageResponseTime/1000).toFixed(1)}秒`)
      recommendations.push('检查网络连接和模型服务状态')
      overallHealth = 'critical'
    } else if (systemStats.averageResponseTime > 15000) {
      issues.push(`响应时间偏慢: ${(systemStats.averageResponseTime/1000).toFixed(1)}秒`)
      recommendations.push('监控网络延迟和服务负载')
      if (overallHealth === 'healthy') overallHealth = 'warning'
    }

    // 检查内存使用
    if (systemStats.totalMemoryUsage > 2048) {
      issues.push(`内存使用过高: ${systemStats.totalMemoryUsage.toFixed(1)}MB`)
      recommendations.push('清理长时间空闲的线程和模型缓存')
      if (overallHealth !== 'critical') overallHealth = 'warning'
    }

    // 检查长时间无活动的线程
    const now = Date.now()
    const staleThreads = threads.filter(t => 
      t.status === ThreadStatus.IDLE && (now - t.lastActiveAt) > 300000 // 5分钟无活动
    )
    
    if (staleThreads.length > 3) {
      issues.push(`${staleThreads.length} 个线程长时间无活动`)
      recommendations.push('考虑清理空闲线程以释放资源')
      if (overallHealth === 'healthy') overallHealth = 'warning'
    }

    return { overallHealth, issues, recommendations }
  }

  /**
   * 🚨 初始化默认告警规则
   */
  private initializeDefaultAlertRules(): void {
    const defaultRules: Omit<AlertRule, 'id'>[] = [
      {
        name: '高错误率告警',
        condition: (metrics) => {
          const errorRate = metrics.threadMetrics.total > 0 ? 
            (metrics.threadMetrics.error / metrics.threadMetrics.total) * 100 : 0
          return errorRate > 30
        },
        severity: 'critical',
        message: '线程错误率超过30%，请立即检查系统状态',
        enabled: true
      },
      {
        name: '队列积压告警',
        condition: (metrics) => metrics.threadMetrics.queueLength > 20,
        severity: 'warning',
        message: '任务队列积压超过20个，可能影响响应速度',
        enabled: true
      },
      {
        name: '响应时间告警',
        condition: (metrics) => metrics.performanceMetrics.averageResponseTime > 20000,
        severity: 'warning',
        message: '平均响应时间超过20秒，性能可能存在问题',
        enabled: true
      },
      {
        name: '内存使用告警',
        condition: (metrics) => metrics.resourceMetrics.totalMemoryUsage > 1536, // 1.5GB
        severity: 'warning',
        message: '内存使用超过1.5GB，建议清理空闲资源',
        enabled: true
      },
      {
        name: '成功率低告警',
        condition: (metrics) => metrics.performanceMetrics.successRate < 80,
        severity: 'critical',
        message: '请求成功率低于80%，系统可能存在严重问题',
        enabled: true
      }
    ]

    defaultRules.forEach(rule => {
      const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      this.alertRules.set(id, { ...rule, id })
    })
  }

  /**
   * ⚠️ 检查告警
   */
  private checkAlerts(metrics: MonitoringMetrics): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue

      try {
        if (rule.condition(metrics)) {
          // 检查是否已有相同规则的活跃告警
          const existingAlert = Array.from(this.activeAlerts.values()).find(
            alert => alert.ruleId === rule.id && !alert.acknowledged
          )

          if (!existingAlert) {
            const alert: Alert = {
              id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              ruleId: rule.id,
              severity: rule.severity,
              message: rule.message,
              timestamp: Date.now(),
              metrics,
              acknowledged: false
            }

            this.activeAlerts.set(alert.id, alert)
            this.triggerAlert(alert)
          }
        }
      } catch (error) {
        console.error(`[ThreadMonitor] 告警规则执行失败 [${rule.id}]:`, error)
      }
    }
  }

  /**
   * 🔔 触发告警
   */
  private triggerAlert(alert: Alert): void {
    console[alert.severity === 'critical' ? 'error' : 'warn'](
      `[ThreadMonitor] 🚨 ${alert.severity.toUpperCase()}: ${alert.message}`
    )

    this.threadManager.emit?.('monitoring:alert_triggered', alert)
  }

  /**
   * ✅ 确认告警
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId)
    if (alert) {
      alert.acknowledged = true
      console.log(`[ThreadMonitor] ✅ 告警已确认: ${alertId}`)
    }
  }

  /**
   * 🗑️ 清理告警
   */
  clearAlert(alertId: string): void {
    if (this.activeAlerts.delete(alertId)) {
      console.log(`[ThreadMonitor] 🗑️ 告警已清理: ${alertId}`)
    }
  }

  /**
   * 🧹 清理旧指标数据
   */
  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - (this.metricsRetentionHours * 60 * 60 * 1000)
    this.metricsHistory = this.metricsHistory.filter(m => m.timestamp > cutoff)
  }

  // ==================== 公共API ====================

  /**
   * 📊 获取最新指标
   */
  getLatestMetrics(): MonitoringMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null
  }

  /**
   * 📈 获取指标历史
   */
  getMetricsHistory(hours: number = 1): MonitoringMetrics[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000)
    return this.metricsHistory.filter(m => m.timestamp > cutoff)
  }

  /**
   * 🚨 获取活跃告警
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values())
  }

  /**
   * 📋 获取告警规则
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values())
  }

  /**
   * 📝 添加自定义告警规则
   */
  addAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.alertRules.set(id, { ...rule, id })
    return id
  }

  /**
   * 🔧 更新告警规则
   */
  updateAlertRule(id: string, updates: Partial<AlertRule>): boolean {
    const rule = this.alertRules.get(id)
    if (rule) {
      this.alertRules.set(id, { ...rule, ...updates })
      return true
    }
    return false
  }

  /**
   * 🗑️ 删除告警规则
   */
  deleteAlertRule(id: string): boolean {
    return this.alertRules.delete(id)
  }

  /**
   * 📊 获取性能摘要
   */
  getPerformanceSummary(): {
    period: string
    summary: {
      avgResponseTime: number
      peakResponseTime: number
      totalRequests: number
      successRate: number
      avgConcurrency: number
      peakConcurrency: number
    }
  } {
    const oneHourAgo = Date.now() - (60 * 60 * 1000)
    const recentMetrics = this.metricsHistory.filter(m => m.timestamp > oneHourAgo)
    
    if (recentMetrics.length === 0) {
      return {
        period: '过去1小时',
        summary: {
          avgResponseTime: 0,
          peakResponseTime: 0,
          totalRequests: 0,
          successRate: 0,
          avgConcurrency: 0,
          peakConcurrency: 0
        }
      }
    }

    const responseTimes = recentMetrics.map(m => m.performanceMetrics.averageResponseTime)
    const concurrencies = recentMetrics.map(m => m.threadMetrics.busy)
    const successRates = recentMetrics.map(m => m.performanceMetrics.successRate)

    return {
      period: '过去1小时',
      summary: {
        avgResponseTime: responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length,
        peakResponseTime: Math.max(...responseTimes),
        totalRequests: recentMetrics.reduce((sum, m) => 
          sum + this.threadManager.getAllThreads().reduce((tSum, t) => tSum + t.stats.totalRequests, 0), 0
        ),
        successRate: successRates.reduce((sum, sr) => sum + sr, 0) / successRates.length,
        avgConcurrency: concurrencies.reduce((sum, c) => sum + c, 0) / concurrencies.length,
        peakConcurrency: Math.max(...concurrencies)
      }
    }
  }

  /**
   * 🧹 清理监控器
   */
  cleanup(): void {
    this.stopMonitoring()
    this.metricsHistory.length = 0
    this.activeAlerts.clear()
    this.alertRules.clear()
    console.log('[ThreadMonitor] 🧹 监控器已清理')
  }
}