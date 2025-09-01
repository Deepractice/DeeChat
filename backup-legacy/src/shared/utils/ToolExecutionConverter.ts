/**
 * 工具执行数据转换工具
 * 
 * 用于在新的StreamChunk系统和旧的ToolExecution系统之间进行数据转换
 * 确保向后兼容性和数据一致性
 */

import { ToolExecution } from '../types'
import { StreamChunk, ToolStartChunk, ToolResultChunk } from '../streaming/StreamTypes'

/**
 * 将StreamChunk数据转换为ToolExecution格式
 * 
 * @param chunks 流式块数组
 * @returns 转换后的ToolExecution数组
 */
export function convertStreamChunksToToolExecutions(chunks: StreamChunk[]): ToolExecution[] {
  // 提取工具调用开始和结果块
  const toolStarts = chunks.filter((chunk): chunk is ToolStartChunk => 
    chunk.type === 'tool_start'
  )
  const toolResults = chunks.filter((chunk): chunk is ToolResultChunk => 
    chunk.type === 'tool_result'
  )

  // 将结果与开始块配对，生成完整的ToolExecution记录
  return toolResults.map(resultChunk => {
    const startChunk = toolStarts.find(start => start.toolId === resultChunk.toolId)
    
    return {
      id: resultChunk.toolId,
      toolName: resultChunk.toolName,
      serverId: resultChunk.sessionId, // 使用sessionId作为serverId的替代
      serverName: extractServerName(resultChunk.toolName),
      params: startChunk?.args || {},
      result: resultChunk.result,
      success: resultChunk.success,
      error: resultChunk.error,
      duration: resultChunk.duration,
      timestamp: resultChunk.timestamp || Date.now()
    } as ToolExecution
  })
}

/**
 * 从工具名称中提取服务器名称
 * 
 * @param toolName 工具名称
 * @returns 服务器名称
 */
function extractServerName(toolName: string): string {
  // 常见的MCP服务器名称映射
  const serverMapping: Record<string, string> = {
    'context7_resolve-library-id': 'Context7',
    'context7_get-library-docs': 'Context7',
    'promptx_welcome': 'PromptX',
    'promptx_action': 'PromptX',
    'promptx_remember': 'PromptX',
    'promptx_recall': 'PromptX',
    'promptx_learn': 'PromptX',
    'promptx_tool': 'PromptX',
    'mcp__mysql-server__connect_db': 'MySQL Server',
    'mcp__mysql-server__query': 'MySQL Server',
    'mcp__mysql-server__execute': 'MySQL Server',
    'mcp__ide__getDiagnostics': 'IDE Server',
    'mcp__ide__executeCode': 'IDE Server'
  }

  // 尝试从映射中查找
  if (serverMapping[toolName]) {
    return serverMapping[toolName]
  }

  // 从工具名称中推断服务器名称
  if (toolName.startsWith('mcp__')) {
    const parts = toolName.split('__')
    if (parts.length >= 2) {
      return parts[1].split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    }
  }

  // 默认返回 "MCP Server"
  return 'MCP Server'
}

/**
 * 将单个StreamChunk转换为ToolExecution（用于实时显示）
 * 
 * @param startChunk 工具调用开始块
 * @param resultChunk 可选的工具结果块
 * @returns ToolExecution对象
 */
export function convertSingleStreamChunkToToolExecution(
  startChunk: ToolStartChunk,
  resultChunk?: ToolResultChunk
): ToolExecution {
  return {
    id: startChunk.toolId,
    toolName: startChunk.toolName,
    serverId: startChunk.sessionId,
    serverName: extractServerName(startChunk.toolName),
    params: startChunk.args,
    result: resultChunk?.result,
    success: resultChunk?.success,
    error: resultChunk?.error,
    duration: resultChunk?.duration,
    timestamp: resultChunk?.timestamp || startChunk.timestamp || Date.now()
  }
}