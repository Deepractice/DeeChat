/**
 * 工具执行领域服务
 * 🏗️ DDD重构: 负责工具的执行逻辑和生命周期管理
 */

import { MCPTool } from '../entities/MCPTool';
import { ToolExecution } from '../entities/ToolExecution';
import { ToolId } from '../value-objects/ToolId';
import { ToolExecutionResult } from '../value-objects/ToolExecutionResult';
import { IToolRepository } from '../repositories/IToolRepository';
import { IToolExecutionRepository } from '../repositories/IToolExecutionRepository';
import { ToolExecutionStarted } from '../events/ToolExecutionStarted';
import { ToolExecutionCompleted } from '../events/ToolExecutionCompleted';
import { ToolExecutionFailed } from '../events/ToolExecutionFailed';

export interface MCPToolExecutor {
  executetool(toolName: string, args: any): Promise<any>;
}

export class ToolExecutionService {
  constructor(
    private readonly toolRepository: IToolRepository,
    private readonly executionRepository: IToolExecutionRepository,
    private readonly toolExecutor: MCPToolExecutor,
    private readonly eventPublisher: (event: any) => void
  ) {}

  /**
   * 执行工具
   */
  async executeTool(
    toolId: ToolId,
    args: any,
    sessionId: string,
    userId?: string
  ): Promise<ToolExecutionResult> {
    // 获取工具信息
    const tool = await this.toolRepository.findById(toolId);
    if (!tool) {
      return ToolExecutionResult.failure(`工具不存在: ${toolId.value}`);
    }

    if (!tool.isAvailable) {
      return ToolExecutionResult.failure(`工具不可用: ${tool.name}`);
    }

    // 验证参数
    const validationResult = tool.validateArgs(args);
    if (!validationResult.success) {
      return ToolExecutionResult.failure(`参数验证失败: ${validationResult.error}`);
    }

    // 创建执行记录
    const execution = ToolExecution.create({
      toolId,
      args,
      sessionId,
      userId
    });

    try {
      // 开始执行
      execution.start();
      await this.executionRepository.save(execution);
      
      // 发布执行开始事件
      this.eventPublisher(new ToolExecutionStarted(
        execution.id,
        toolId,
        tool.name,
        sessionId
      ));

      // 执行工具
      const startTime = Date.now();
      const result = await this.toolExecutor.executetool(tool.name, args);
      const duration = Date.now() - startTime;

      // 创建成功结果
      const executionResult = ToolExecutionResult.success(result, duration);
      execution.complete(executionResult);

      // 更新工具使用统计
      tool.recordUsage();
      await this.toolRepository.save(tool);
      await this.executionRepository.save(execution);

      // 发布执行完成事件
      this.eventPublisher(new ToolExecutionCompleted(
        execution.id,
        toolId,
        tool.name,
        sessionId,
        duration,
        true
      ));

      return executionResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const executionResult = ToolExecutionResult.failure(errorMessage, execution.duration);
      
      execution.fail(errorMessage);
      await this.executionRepository.save(execution);

      // 发布执行失败事件
      this.eventPublisher(new ToolExecutionFailed(
        execution.id,
        toolId,
        tool.name,
        sessionId,
        errorMessage
      ));

      return executionResult;
    }
  }

  /**
   * 批量执行工具
   */
  async executeToolsBatch(
    requests: Array<{
      toolId: ToolId;
      args: any;
      sessionId: string;
      userId?: string;
    }>
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];

    for (const request of requests) {
      try {
        const result = await this.executeTool(
          request.toolId,
          request.args,
          request.sessionId,
          request.userId
        );
        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push(ToolExecutionResult.failure(errorMessage));
      }
    }

    return results;
  }

  /**
   * 获取正在运行的执行
   */
  async getRunningExecutions(): Promise<ToolExecution[]> {
    return await this.executionRepository.findRunning();
  }

  /**
   * 取消执行（如果支持）
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = await this.executionRepository.findById(executionId);
    if (!execution || !execution.isRunning()) {
      return false;
    }

    // 在实际实现中，这里需要取消实际的工具执行
    // 目前只是标记为失败
    execution.fail('执行已取消');
    await this.executionRepository.save(execution);

    this.eventPublisher(new ToolExecutionFailed(
      execution.id,
      execution.toolId,
      `工具: ${execution.toolId.toolName}`,
      execution.sessionId,
      '执行已取消'
    ));

    return true;
  }

  /**
   * 获取执行历史
   */
  async getExecutionHistory(
    sessionId: string,
    limit: number = 50
  ): Promise<ToolExecution[]> {
    return await this.executionRepository.findBySessionId(sessionId);
  }

  /**
   * 获取工具执行统计
   */
  async getToolExecutionStats(toolId: ToolId): Promise<ToolExecutionStats | null> {
    const executions = await this.executionRepository.findByToolId(toolId, 1000);
    
    if (executions.length === 0) {
      return null;
    }

    const completed = executions.filter(e => e.isCompleted());
    const successful = executions.filter(e => e.isSuccessful());
    const failed = completed.filter(e => !e.isSuccessful());

    const durations = completed
      .map(e => e.duration)
      .filter((d): d is number => d !== undefined);

    const averageDuration = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

    return {
      toolId: toolId.value,
      totalExecutions: executions.length,
      successfulExecutions: successful.length,
      failedExecutions: failed.length,
      successRate: completed.length > 0 ? successful.length / completed.length : 0,
      averageDuration,
      lastExecution: executions[0]?.startTime
    };
  }

  /**
   * 清理过期的执行记录
   */
  async cleanupOldExecutions(olderThanDays: number = 30): Promise<number> {
    return await this.executionRepository.cleanupOldExecutions(olderThanDays);
  }
}

export interface ToolExecutionStats {
  toolId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  averageDuration: number;
  lastExecution?: Date;
}