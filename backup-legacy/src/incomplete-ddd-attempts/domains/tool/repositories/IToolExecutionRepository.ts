/**
 * 工具执行仓储接口
 * 🏗️ DDD重构: 定义工具执行历史持久化的契约
 */

import { ToolExecution } from '../entities/ToolExecution';
import { ToolId } from '../value-objects/ToolId';

export interface IToolExecutionRepository {
  /**
   * 根据ID查找执行记录
   */
  findById(id: string): Promise<ToolExecution | null>;

  /**
   * 根据会话ID查找执行记录
   */
  findBySessionId(sessionId: string): Promise<ToolExecution[]>;

  /**
   * 根据工具ID查找执行记录
   */
  findByToolId(toolId: ToolId, limit?: number): Promise<ToolExecution[]>;

  /**
   * 根据用户ID查找执行记录
   */
  findByUserId(userId: string, limit?: number): Promise<ToolExecution[]>;

  /**
   * 查找正在运行的执行
   */
  findRunning(): Promise<ToolExecution[]>;

  /**
   * 保存执行记录
   */
  save(execution: ToolExecution): Promise<void>;

  /**
   * 删除执行记录
   */
  delete(id: string): Promise<void>;

  /**
   * 清理过期的执行记录
   */
  cleanupOldExecutions(olderThanDays: number): Promise<number>;

  /**
   * 获取执行统计
   */
  getExecutionStats(criteria: ExecutionStatsCriteria): Promise<ExecutionStats>;
}

export interface ExecutionStatsCriteria {
  toolId?: ToolId;
  sessionId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ExecutionStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  mostUsedTools: Array<{
    toolId: string;
    count: number;
  }>;
}