/**
 * SQLite 工具仓储实现
 * 实现MCP工具领域的持久化操作
 */

import { Database } from 'sqlite3'
import { MCPTool, ToolId } from '../../../domain/tool/entities/MCPTool'
import { ToolExecution } from '../../../domain/tool/entities/ToolExecution'
import { IToolRepository } from '../../../domain/tool/repositories/IToolRepository'
import { IToolExecutionRepository } from '../../../domain/tool/repositories/IToolExecutionRepository'
import { ToolExecutionResult } from '../../../domain/tool/value-objects/ToolExecutionResult'
import { Result } from '../../../domain/shared/primitives/Result'

export class SqliteToolRepository implements IToolRepository, IToolExecutionRepository {
  constructor(
    private readonly database: Database
  ) {}

  // Tool Repository 实现
  async save(tool: MCPTool): Promise<Result<void, Error>> {
    try {
      const stmt = this.database.prepare(`
        INSERT OR REPLACE INTO mcp_tools (
          id, name, description, server_name, schema, capabilities,
          is_enabled, is_healthy, created_at, updated_at, last_used_at,
          usage_count, success_rate, average_execution_time, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      await new Promise<void>((resolve, reject) => {
        stmt.run([
          tool.getId().getValue(),
          tool.getName(),
          tool.getDescription(),
          tool.getServerName(),
          JSON.stringify(tool.getSchema()),
          JSON.stringify(tool.getCapabilities()),
          tool.isEnabled() ? 1 : 0,
          tool.isHealthy() ? 1 : 0,
          tool.getCreatedAt().toISOString(),
          tool.getUpdatedAt().toISOString(),
          tool.getLastUsedAt()?.toISOString() || null,
          tool.getUsageCount(),
          tool.getSuccessRate(),
          tool.getAverageExecutionTime(),
          JSON.stringify(tool.getMetadata())
        ], (error) => {
          if (error) reject(error)
          else resolve()
        })
      })

      stmt.finalize()
      return Result.success()
    } catch (error) {
      return Result.error(new Error(`Failed to save tool: ${error.message}`))
    }
  }

  async findById(toolId: ToolId): Promise<Result<MCPTool | null, Error>> {
    try {
      const row = await new Promise<any>((resolve, reject) => {
        this.database.get(
          'SELECT * FROM mcp_tools WHERE id = ?',
          [toolId.getValue()],
          (error, row) => {
            if (error) reject(error)
            else resolve(row)
          }
        )
      })

      if (!row) {
        return Result.success(null)
      }

      const tool = this.mapRowToTool(row)
      return Result.success(tool)
    } catch (error) {
      return Result.error(new Error(`Failed to find tool: ${error.message}`))
    }
  }

  async findByName(name: string): Promise<Result<MCPTool | null, Error>> {
    try {
      const row = await new Promise<any>((resolve, reject) => {
        this.database.get(
          'SELECT * FROM mcp_tools WHERE name = ?',
          [name],
          (error, row) => {
            if (error) reject(error)
            else resolve(row)
          }
        )
      })

      if (!row) {
        return Result.success(null)
      }

      const tool = this.mapRowToTool(row)
      return Result.success(tool)
    } catch (error) {
      return Result.error(new Error(`Failed to find tool by name: ${error.message}`))
    }
  }

  async findByServer(serverName: string): Promise<Result<MCPTool[], Error>> {
    try {
      const rows = await new Promise<any[]>((resolve, reject) => {
        this.database.all(
          'SELECT * FROM mcp_tools WHERE server_name = ? ORDER BY name ASC',
          [serverName],
          (error, rows) => {
            if (error) reject(error)
            else resolve(rows || [])
          }
        )
      })

      const tools = rows.map(row => this.mapRowToTool(row))
      return Result.success(tools)
    } catch (error) {
      return Result.error(new Error(`Failed to find tools by server: ${error.message}`))
    }
  }

  async findEnabled(): Promise<Result<MCPTool[], Error>> {
    try {
      const rows = await new Promise<any[]>((resolve, reject) => {
        this.database.all(
          `SELECT * FROM mcp_tools 
           WHERE is_enabled = 1 AND is_healthy = 1 
           ORDER BY usage_count DESC, name ASC`,
          [],
          (error, rows) => {
            if (error) reject(error)
            else resolve(rows || [])
          }
        )
      })

      const tools = rows.map(row => this.mapRowToTool(row))
      return Result.success(tools)
    } catch (error) {
      return Result.error(new Error(`Failed to find enabled tools: ${error.message}`))
    }
  }

  async findByCapabilities(requiredCapabilities: string[]): Promise<Result<MCPTool[], Error>> {
    try {
      const rows = await new Promise<any[]>((resolve, reject) => {
        this.database.all(
          'SELECT * FROM mcp_tools WHERE is_enabled = 1 AND is_healthy = 1',
          [],
          (error, rows) => {
            if (error) reject(error)
            else resolve(rows || [])
          }
        )
      })

      const matchingTools = rows
        .filter(row => {
          try {
            const capabilities = JSON.parse(row.capabilities)
            return requiredCapabilities.some(required => capabilities.includes(required))
          } catch {
            return false
          }
        })
        .map(row => this.mapRowToTool(row))

      return Result.success(matchingTools)
    } catch (error) {
      return Result.error(new Error(`Failed to find tools by capabilities: ${error.message}`))
    }
  }

  async updateHealthStatus(toolId: ToolId, isHealthy: boolean): Promise<Result<void, Error>> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.database.run(
          'UPDATE mcp_tools SET is_healthy = ?, updated_at = ? WHERE id = ?',
          [isHealthy ? 1 : 0, new Date().toISOString(), toolId.getValue()],
          (error) => {
            if (error) reject(error)
            else resolve()
          }
        )
      })

      return Result.success()
    } catch (error) {
      return Result.error(new Error(`Failed to update health status: ${error.message}`))
    }
  }

  async updateUsageStatistics(
    toolId: ToolId, 
    executionTime: number, 
    success: boolean
  ): Promise<Result<void, Error>> {
    try {
      // 获取当前统计数据
      const currentStats = await new Promise<any>((resolve, reject) => {
        this.database.get(
          'SELECT usage_count, success_rate, average_execution_time FROM mcp_tools WHERE id = ?',
          [toolId.getValue()],
          (error, row) => {
            if (error) reject(error)
            else resolve(row)
          }
        )
      })

      if (!currentStats) {
        return Result.error(new Error('Tool not found for statistics update'))
      }

      // 计算新的统计数据
      const newUsageCount = currentStats.usage_count + 1
      const currentSuccessRate = currentStats.success_rate || 0
      const currentAvgTime = currentStats.average_execution_time || 0

      // 更新成功率
      const newSuccessRate = success 
        ? (currentSuccessRate * currentStats.usage_count + 1) / newUsageCount
        : (currentSuccessRate * currentStats.usage_count) / newUsageCount

      // 更新平均执行时间
      const newAvgTime = (currentAvgTime * currentStats.usage_count + executionTime) / newUsageCount

      await new Promise<void>((resolve, reject) => {
        this.database.run(
          `UPDATE mcp_tools 
           SET usage_count = ?, 
               success_rate = ?, 
               average_execution_time = ?, 
               last_used_at = ?, 
               updated_at = ? 
           WHERE id = ?`,
          [
            newUsageCount,
            newSuccessRate,
            newAvgTime,
            new Date().toISOString(),
            new Date().toISOString(),
            toolId.getValue()
          ],
          (error) => {
            if (error) reject(error)
            else resolve()
          }
        )
      })

      return Result.success()
    } catch (error) {
      return Result.error(new Error(`Failed to update usage statistics: ${error.message}`))
    }
  }

  async delete(toolId: ToolId): Promise<Result<void, Error>> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.database.run(
          'DELETE FROM mcp_tools WHERE id = ?',
          [toolId.getValue()],
          (error) => {
            if (error) reject(error)
            else resolve()
          }
        )
      })

      // 删除相关的执行记录
      await new Promise<void>((resolve, reject) => {
        this.database.run(
          'DELETE FROM tool_executions WHERE tool_id = ?',
          [toolId.getValue()],
          (error) => {
            if (error) reject(error)
            else resolve()
          }
        )
      })

      return Result.success()
    } catch (error) {
      return Result.error(new Error(`Failed to delete tool: ${error.message}`))
    }
  }

  // Tool Execution Repository 实现
  async saveExecution(execution: ToolExecution): Promise<Result<void, Error>> {
    try {
      const stmt = this.database.prepare(`
        INSERT OR REPLACE INTO tool_executions (
          id, tool_id, parameters, result, success, execution_time,
          created_at, user_id, session_id, context
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      await new Promise<void>((resolve, reject) => {
        stmt.run([
          execution.getId(),
          execution.getToolId().getValue(),
          JSON.stringify(execution.getParameters()),
          JSON.stringify(this.serializeExecutionResult(execution.getResult())),
          execution.isSuccess() ? 1 : 0,
          execution.getExecutionTime(),
          execution.getCreatedAt().toISOString(),
          execution.getUserId() || null,
          execution.getSessionId() || null,
          JSON.stringify(execution.getContext() || {})
        ], (error) => {
          if (error) reject(error)
          else resolve()
        })
      })

      stmt.finalize()
      return Result.success()
    } catch (error) {
      return Result.error(new Error(`Failed to save execution: ${error.message}`))
    }
  }

  async findExecutionsByTool(
    toolId: ToolId,
    limit: number = 50
  ): Promise<Result<ToolExecution[], Error>> {
    try {
      const rows = await new Promise<any[]>((resolve, reject) => {
        this.database.all(
          `SELECT * FROM tool_executions 
           WHERE tool_id = ? 
           ORDER BY created_at DESC 
           LIMIT ?`,
          [toolId.getValue(), limit],
          (error, rows) => {
            if (error) reject(error)
            else resolve(rows || [])
          }
        )
      })

      const executions = rows.map(row => this.mapRowToExecution(row))
      return Result.success(executions)
    } catch (error) {
      return Result.error(new Error(`Failed to find executions by tool: ${error.message}`))
    }
  }

  async findExecutionsByUser(
    userId: string,
    limit: number = 50
  ): Promise<Result<ToolExecution[], Error>> {
    try {
      const rows = await new Promise<any[]>((resolve, reject) => {
        this.database.all(
          `SELECT * FROM tool_executions 
           WHERE user_id = ? 
           ORDER BY created_at DESC 
           LIMIT ?`,
          [userId, limit],
          (error, rows) => {
            if (error) reject(error)
            else resolve(rows || [])
          }
        )
      })

      const executions = rows.map(row => this.mapRowToExecution(row))
      return Result.success(executions)
    } catch (error) {
      return Result.error(new Error(`Failed to find executions by user: ${error.message}`))
    }
  }

  /**
   * 序列化执行结果
   */
  private serializeExecutionResult(result: ToolExecutionResult): any {
    return {
      toolId: result.getToolId().getValue(),
      success: result.isSuccess(),
      data: result.getData(),
      message: result.getMessage(),
      metadata: result.getMetadata()
    }
  }

  /**
   * 反序列化执行结果
   */
  private deserializeExecutionResult(data: any): ToolExecutionResult {
    return ToolExecutionResult.create({
      toolId: ToolId.create(data.toolId).getValue(),
      success: data.success,
      data: data.data,
      message: data.message,
      metadata: data.metadata
    }).getValue()
  }

  /**
   * 将数据库行映射为工具实体
   */
  private mapRowToTool(row: any): MCPTool {
    return MCPTool.create({
      id: ToolId.create(row.id).getValue(),
      name: row.name,
      description: row.description,
      serverName: row.server_name,
      schema: JSON.parse(row.schema),
      capabilities: JSON.parse(row.capabilities),
      isEnabled: Boolean(row.is_enabled),
      isHealthy: Boolean(row.is_healthy),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
      usageCount: row.usage_count,
      successRate: row.success_rate,
      averageExecutionTime: row.average_execution_time,
      metadata: JSON.parse(row.metadata || '{}')
    }).getValue()
  }

  /**
   * 将数据库行映射为执行实体
   */
  private mapRowToExecution(row: any): ToolExecution {
    const resultData = JSON.parse(row.result)
    const result = this.deserializeExecutionResult(resultData)

    return ToolExecution.create({
      id: row.id,
      toolId: ToolId.create(row.tool_id).getValue(),
      parameters: JSON.parse(row.parameters),
      result,
      executionTime: row.execution_time,
      createdAt: new Date(row.created_at),
      userId: row.user_id,
      sessionId: row.session_id,
      context: JSON.parse(row.context || '{}')
    }).getValue()
  }
}