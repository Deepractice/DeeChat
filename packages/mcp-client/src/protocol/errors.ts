/**
 * JSON-RPC and MCP Protocol Error Definitions
 */

import { ProtocolError } from '../utils/errors.js';

// JSON-RPC 标准错误代码
export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR_START: -32099,
  SERVER_ERROR_END: -32000
} as const;

// MCP 特定错误代码
export const MCP_ERRORS = {
  TOOL_NOT_FOUND: -32001,
  RESOURCE_NOT_FOUND: -32002,
  PROMPT_NOT_FOUND: -32003,
  INVALID_TOOL_PARAMS: -32004,
  TOOL_EXECUTION_ERROR: -32005,
  RESOURCE_ACCESS_ERROR: -32006,
  PROMPT_EXECUTION_ERROR: -32007
} as const;

export class JsonRpcError extends ProtocolError {
  public readonly jsonRpcCode: number;
  public readonly data?: any;

  constructor(code: number, message: string, data?: any) {
    super(`JSON-RPC Error ${code}: ${message}`, `JSON_RPC_${code}`);
    this.name = 'JsonRpcError';
    this.jsonRpcCode = code;
    this.data = data;
  }

  static fromErrorObject(error: { code: number; message: string; data?: any }): JsonRpcError {
    return new JsonRpcError(error.code, error.message, error.data);
  }

  toErrorObject(): { code: number; message: string; data?: any } {
    return {
      code: this.code,
      message: this.message,
      ...(this.data && { data: this.data })
    };
  }
}

// 预定义的错误创建函数
export const createJsonRpcError = {
  parseError: (data?: any) => new JsonRpcError(
    JSON_RPC_ERRORS.PARSE_ERROR,
    'Parse error',
    data
  ),

  invalidRequest: (data?: any) => new JsonRpcError(
    JSON_RPC_ERRORS.INVALID_REQUEST,
    'Invalid request',
    data
  ),

  methodNotFound: (method: string) => new JsonRpcError(
    JSON_RPC_ERRORS.METHOD_NOT_FOUND,
    `Method not found: ${method}`
  ),

  invalidParams: (details?: string) => new JsonRpcError(
    JSON_RPC_ERRORS.INVALID_PARAMS,
    details ? `Invalid params: ${details}` : 'Invalid params'
  ),

  internalError: (details?: string) => new JsonRpcError(
    JSON_RPC_ERRORS.INTERNAL_ERROR,
    details ? `Internal error: ${details}` : 'Internal error'
  ),

  toolNotFound: (toolName: string) => new JsonRpcError(
    MCP_ERRORS.TOOL_NOT_FOUND,
    `Tool not found: ${toolName}`,
    { toolName }
  ),

  resourceNotFound: (uri: string) => new JsonRpcError(
    MCP_ERRORS.RESOURCE_NOT_FOUND,
    `Resource not found: ${uri}`,
    { uri }
  ),

  promptNotFound: (promptName: string) => new JsonRpcError(
    MCP_ERRORS.PROMPT_NOT_FOUND,
    `Prompt not found: ${promptName}`,
    { promptName }
  )
};