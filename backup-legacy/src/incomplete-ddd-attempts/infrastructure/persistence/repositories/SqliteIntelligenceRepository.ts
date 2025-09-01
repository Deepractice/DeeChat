/**
 * SQLite 智能仓储实现
 * 实现AI角色智能领域的持久化操作
 */

import { Database } from 'sqlite3'
import { PromptXRole, RoleId } from '../../../domain/intelligence/entities/PromptXRole'
import { LayeredPrompt } from '../../../domain/intelligence/entities/LayeredPrompt'
import { IRoleRepository } from '../../../domain/intelligence/repositories/IRoleRepository'
import { PromptContent } from '../../../domain/intelligence/value-objects/PromptContent'
import { TokenUsage } from '../../../domain/intelligence/value-objects/TokenUsage'
import { Result } from '../../../domain/shared/primitives/Result'

export class SqliteIntelligenceRepository implements IRoleRepository {
  constructor(
    private readonly database: Database
  ) {}

  async save(role: PromptXRole): Promise<Result<void, Error>> {
    try {
      const stmt = this.database.prepare(`
        INSERT OR REPLACE INTO promptx_roles (
          id, name, description, capabilities, layered_prompt, 
          is_active, created_at, updated_at, usage_count, 
          last_used_at, version, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const layeredPromptData = this.serializeLayeredPrompt(role.getLayeredPrompt())
      
      await new Promise<void>((resolve, reject) => {
        stmt.run([
          role.getId().getValue(),
          role.getName().getValue(),
          role.getDescription(),
          JSON.stringify(role.getCapabilities().getCapabilities()),
          JSON.stringify(layeredPromptData),
          role.isActive() ? 1 : 0,
          role.getCreatedAt().toISOString(),
          role.getUpdatedAt().toISOString(),
          role.getUsageCount(),
          role.getLastUsedAt()?.toISOString() || null,
          role.getVersion(),
          JSON.stringify(role.getMetadata())
        ], (error) => {
          if (error) reject(error)
          else resolve()
        })
      })

      stmt.finalize()
      return Result.success()
    } catch (error) {
      return Result.error(new Error(`Failed to save role: ${error.message}`))
    }
  }

  async findById(roleId: RoleId): Promise<Result<PromptXRole | null, Error>> {
    try {
      const row = await new Promise<any>((resolve, reject) => {
        this.database.get(
          'SELECT * FROM promptx_roles WHERE id = ?',
          [roleId.getValue()],
          (error, row) => {
            if (error) reject(error)
            else resolve(row)
          }
        )
      })

      if (!row) {
        return Result.success(null)
      }

      const role = this.mapRowToRole(row)
      return Result.success(role)
    } catch (error) {
      return Result.error(new Error(`Failed to find role: ${error.message}`))
    }
  }

  async findByName(name: string): Promise<Result<PromptXRole | null, Error>> {
    try {
      const row = await new Promise<any>((resolve, reject) => {
        this.database.get(
          'SELECT * FROM promptx_roles WHERE name = ?',
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

      const role = this.mapRowToRole(row)
      return Result.success(role)
    } catch (error) {
      return Result.error(new Error(`Failed to find role by name: ${error.message}`))
    }
  }

  async findByCapabilities(
    requiredCapabilities: string[]
  ): Promise<Result<PromptXRole[], Error>> {
    try {
      // 使用JSON查询查找包含所需能力的角色
      const placeholders = requiredCapabilities.map(() => '?').join(',')
      const rows = await new Promise<any[]>((resolve, reject) => {
        // 简化查询，在内存中过滤
        this.database.all(
          'SELECT * FROM promptx_roles WHERE is_active = 1',
          [],
          (error, rows) => {
            if (error) reject(error)
            else resolve(rows || [])
          }
        )
      })

      const matchingRoles = rows
        .filter(row => {
          try {
            const capabilities = JSON.parse(row.capabilities)
            return requiredCapabilities.every(required => capabilities.includes(required))
          } catch {
            return false
          }
        })
        .map(row => this.mapRowToRole(row))

      return Result.success(matchingRoles)
    } catch (error) {
      return Result.error(new Error(`Failed to find roles by capabilities: ${error.message}`))
    }
  }

  async findActive(): Promise<Result<PromptXRole[], Error>> {
    try {
      const rows = await new Promise<any[]>((resolve, reject) => {
        this.database.all(
          'SELECT * FROM promptx_roles WHERE is_active = 1 ORDER BY usage_count DESC, last_used_at DESC',
          [],
          (error, rows) => {
            if (error) reject(error)
            else resolve(rows || [])
          }
        )
      })

      const roles = rows.map(row => this.mapRowToRole(row))
      return Result.success(roles)
    } catch (error) {
      return Result.error(new Error(`Failed to find active roles: ${error.message}`))
    }
  }

  async findMostUsed(limit: number = 10): Promise<Result<PromptXRole[], Error>> {
    try {
      const rows = await new Promise<any[]>((resolve, reject) => {
        this.database.all(
          `SELECT * FROM promptx_roles 
           WHERE is_active = 1 
           ORDER BY usage_count DESC, last_used_at DESC 
           LIMIT ?`,
          [limit],
          (error, rows) => {
            if (error) reject(error)
            else resolve(rows || [])
          }
        )
      })

      const roles = rows.map(row => this.mapRowToRole(row))
      return Result.success(roles)
    } catch (error) {
      return Result.error(new Error(`Failed to find most used roles: ${error.message}`))
    }
  }

  async updateUsageStatistics(
    roleId: RoleId, 
    tokenUsage: TokenUsage
  ): Promise<Result<void, Error>> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.database.run(
          `UPDATE promptx_roles 
           SET usage_count = usage_count + 1, 
               last_used_at = ?, 
               updated_at = ?
           WHERE id = ?`,
          [
            new Date().toISOString(),
            new Date().toISOString(),
            roleId.getValue()
          ],
          (error) => {
            if (error) reject(error)
            else resolve()
          }
        )
      })

      // 记录token使用情况
      await this.recordTokenUsage(roleId, tokenUsage)

      return Result.success()
    } catch (error) {
      return Result.error(new Error(`Failed to update usage statistics: ${error.message}`))
    }
  }

  async delete(roleId: RoleId): Promise<Result<void, Error>> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.database.run(
          'DELETE FROM promptx_roles WHERE id = ?',
          [roleId.getValue()],
          (error) => {
            if (error) reject(error)
            else resolve()
          }
        )
      })

      // 删除相关的token使用记录
      await new Promise<void>((resolve, reject) => {
        this.database.run(
          'DELETE FROM role_token_usage WHERE role_id = ?',
          [roleId.getValue()],
          (error) => {
            if (error) reject(error)
            else resolve()
          }
        )
      })

      return Result.success()
    } catch (error) {
      return Result.error(new Error(`Failed to delete role: ${error.message}`))
    }
  }

  async searchByKeyword(keyword: string): Promise<Result<PromptXRole[], Error>> {
    try {
      const rows = await new Promise<any[]>((resolve, reject) => {
        this.database.all(
          `SELECT * FROM promptx_roles 
           WHERE (name LIKE ? OR description LIKE ?) 
           AND is_active = 1 
           ORDER BY usage_count DESC`,
          [`%${keyword}%`, `%${keyword}%`],
          (error, rows) => {
            if (error) reject(error)
            else resolve(rows || [])
          }
        )
      })

      const roles = rows.map(row => this.mapRowToRole(row))
      return Result.success(roles)
    } catch (error) {
      return Result.error(new Error(`Failed to search roles: ${error.message}`))
    }
  }

  /**
   * 记录token使用情况
   */
  private async recordTokenUsage(roleId: RoleId, tokenUsage: TokenUsage): Promise<void> {
    const stmt = this.database.prepare(`
      INSERT INTO role_token_usage (
        role_id, input_tokens, output_tokens, total_tokens, timestamp
      ) VALUES (?, ?, ?, ?, ?)
    `)

    await new Promise<void>((resolve, reject) => {
      stmt.run([
        roleId.getValue(),
        tokenUsage.getInputTokens(),
        tokenUsage.getOutputTokens(),
        tokenUsage.getTotalTokens(),
        new Date().toISOString()
      ], (error) => {
        if (error) reject(error)
        else resolve()
      })
    })

    stmt.finalize()
  }

  /**
   * 序列化分层提示词
   */
  private serializeLayeredPrompt(layeredPrompt: LayeredPrompt): any {
    return {
      system: layeredPrompt.getSystemPrompt().getValue(),
      task: layeredPrompt.getTaskPrompt().getValue(),
      context: layeredPrompt.getContextPrompt().getValue(),
      examples: layeredPrompt.getExamplesPrompt().getValue(),
      output: layeredPrompt.getOutputPrompt().getValue()
    }
  }

  /**
   * 反序列化分层提示词
   */
  private deserializeLayeredPrompt(data: any): LayeredPrompt {
    return LayeredPrompt.create({
      system: PromptContent.create(data.system).getValue(),
      task: PromptContent.create(data.task).getValue(),
      context: PromptContent.create(data.context).getValue(),
      examples: PromptContent.create(data.examples).getValue(),
      output: PromptContent.create(data.output).getValue()
    }).getValue()
  }

  /**
   * 将数据库行映射为角色实体
   */
  private mapRowToRole(row: any): PromptXRole {
    const layeredPromptData = JSON.parse(row.layered_prompt)
    const layeredPrompt = this.deserializeLayeredPrompt(layeredPromptData)

    return PromptXRole.create({
      id: RoleId.create(row.id).getValue(),
      name: row.name,
      description: row.description,
      capabilities: JSON.parse(row.capabilities),
      layeredPrompt,
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      usageCount: row.usage_count,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
      version: row.version,
      metadata: JSON.parse(row.metadata || '{}')
    }).getValue()
  }
}