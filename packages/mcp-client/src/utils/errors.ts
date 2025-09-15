/**
 * Error classes for MCP Client
 */

// ============== Base Error ==============

export class McpClientError extends Error {
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'McpClientError';
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

// ============== Specific Errors ==============

export class ConnectionError extends McpClientError {
  constructor(message: string, details?: any) {
    super(message, 'CONNECTION_ERROR', details);
    this.name = 'ConnectionError';
  }
}

export class ConfigurationError extends McpClientError {
  constructor(message: string, details?: any) {
    super(message, 'CONFIGURATION_ERROR', details);
    this.name = 'ConfigurationError';
  }
}

export class ProtocolError extends McpClientError {
  constructor(message: string, details?: any) {
    super(message, 'PROTOCOL_ERROR', details);
    this.name = 'ProtocolError';
  }
}

export class TimeoutError extends McpClientError {
  constructor(message: string, timeout: number) {
    super(message, 'TIMEOUT_ERROR', { timeout });
    this.name = 'TimeoutError';
  }
}

export class ToolNotFoundError extends McpClientError {
  constructor(toolName: string, serverId: string) {
    super(`Tool '${toolName}' not found on server '${serverId}'`, 'TOOL_NOT_FOUND', {
      toolName,
      serverId
    });
    this.name = 'ToolNotFoundError';
  }
}

export class ResourceNotFoundError extends McpClientError {
  constructor(uri: string, serverId: string) {
    super(`Resource '${uri}' not found on server '${serverId}'`, 'RESOURCE_NOT_FOUND', {
      uri,
      serverId
    });
    this.name = 'ResourceNotFoundError';
  }
}

export class PromptNotFoundError extends McpClientError {
  constructor(promptName: string, serverId: string) {
    super(`Prompt '${promptName}' not found on server '${serverId}'`, 'PROMPT_NOT_FOUND', {
      promptName,
      serverId
    });
    this.name = 'PromptNotFoundError';
  }
}

// ============== Error Utilities ==============

export function isError(value: any): value is Error {
  return value instanceof Error;
}

export function isMcpError(value: any): value is McpClientError {
  return value instanceof McpClientError;
}

export function toMcpError(error: unknown): McpClientError {
  if (isMcpError(error)) {
    return error;
  }
  
  if (isError(error)) {
    return new McpClientError(error.message, 'UNKNOWN_ERROR', {
      originalError: error.name
    });
  }
  
  return new McpClientError(
    typeof error === 'string' ? error : 'Unknown error occurred',
    'UNKNOWN_ERROR',
    { originalValue: error }
  );
}