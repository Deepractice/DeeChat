/**
 * Configuration validation utilities
 */

import type { McpServerConfig, TransportConfig } from '../types/index.js';
import { ConfigurationError } from '../utils/errors.js';

/**
 * 验证服务器配置
 */
export function validateServerConfig(config: McpServerConfig): void {
  // 基础字段验证
  if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
    throw new ConfigurationError('Server ID is required and must be a non-empty string');
  }

  if (!config.name || typeof config.name !== 'string' || config.name.trim() === '') {
    throw new ConfigurationError('Server name is required and must be a non-empty string');
  }

  if (typeof config.enabled !== 'boolean') {
    throw new ConfigurationError('Server enabled flag must be a boolean');
  }

  // 传输配置验证
  validateTransportConfig(config.transport);

  // 可选字段验证
  if (config.description !== undefined && typeof config.description !== 'string') {
    throw new ConfigurationError('Server description must be a string');
  }

  if (config.timeout !== undefined) {
    if (typeof config.timeout !== 'number' || config.timeout < 1000) {
      throw new ConfigurationError('Server timeout must be a number >= 1000ms');
    }
  }

  if (config.autoReconnect !== undefined && typeof config.autoReconnect !== 'boolean') {
    throw new ConfigurationError('Server autoReconnect must be a boolean');
  }

  if (config.tags !== undefined) {
    if (!Array.isArray(config.tags) || !config.tags.every(tag => typeof tag === 'string')) {
      throw new ConfigurationError('Server tags must be an array of strings');
    }
  }

  if (config.createdAt !== undefined && typeof config.createdAt !== 'string') {
    throw new ConfigurationError('Server createdAt must be a string');
  }

  if (config.updatedAt !== undefined && typeof config.updatedAt !== 'string') {
    throw new ConfigurationError('Server updatedAt must be a string');
  }
}

/**
 * 验证传输配置
 */
export function validateTransportConfig(transport: TransportConfig): void {
  if (!transport || typeof transport !== 'object') {
    throw new ConfigurationError('Transport configuration is required');
  }

  if (!transport.type || typeof transport.type !== 'string') {
    throw new ConfigurationError('Transport type is required');
  }

  switch (transport.type) {
    case 'stdio':
      validateStdioTransport(transport);
      break;
    case 'http':
      validateHttpTransport(transport);
      break;
    case 'websocket':
      validateWebSocketTransport(transport);
      break;
    default:
      throw new ConfigurationError(`Unsupported transport type: ${(transport as any).type}`);
  }
}

/**
 * 验证 stdio 传输配置
 */
function validateStdioTransport(transport: any): void {
  if (!transport.command || typeof transport.command !== 'string') {
    throw new ConfigurationError('stdio transport requires a command');
  }

  if (transport.args !== undefined) {
    if (!Array.isArray(transport.args) || !transport.args.every((arg: any) => typeof arg === 'string')) {
      throw new ConfigurationError('stdio transport args must be an array of strings');
    }
  }

  if (transport.cwd !== undefined && typeof transport.cwd !== 'string') {
    throw new ConfigurationError('stdio transport cwd must be a string');
  }

  if (transport.env !== undefined) {
    if (typeof transport.env !== 'object' || transport.env === null || Array.isArray(transport.env)) {
      throw new ConfigurationError('stdio transport env must be an object');
    }
    
    for (const [key, value] of Object.entries(transport.env)) {
      if (typeof key !== 'string' || typeof value !== 'string') {
        throw new ConfigurationError('stdio transport env must contain only string key-value pairs');
      }
    }
  }
}

/**
 * 验证 HTTP 传输配置
 */
function validateHttpTransport(transport: any): void {
  if (!transport.url || typeof transport.url !== 'string') {
    throw new ConfigurationError('http transport requires a URL');
  }

  // 简单的 URL 格式验证
  try {
    new URL(transport.url);
  } catch {
    throw new ConfigurationError('http transport URL must be a valid URL');
  }

  if (transport.headers !== undefined) {
    if (typeof transport.headers !== 'object' || transport.headers === null || Array.isArray(transport.headers)) {
      throw new ConfigurationError('http transport headers must be an object');
    }
    
    for (const [key, value] of Object.entries(transport.headers)) {
      if (typeof key !== 'string' || typeof value !== 'string') {
        throw new ConfigurationError('http transport headers must contain only string key-value pairs');
      }
    }
  }
}

/**
 * 验证 WebSocket 传输配置
 */
function validateWebSocketTransport(transport: any): void {
  if (!transport.url || typeof transport.url !== 'string') {
    throw new ConfigurationError('websocket transport requires a URL');
  }

  // 简单的 WebSocket URL 格式验证
  try {
    const url = new URL(transport.url);
    if (!['ws:', 'wss:'].includes(url.protocol)) {
      throw new Error('WebSocket URL must use ws: or wss: protocol');
    }
  } catch (error) {
    throw new ConfigurationError(`websocket transport URL invalid: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (transport.headers !== undefined) {
    if (typeof transport.headers !== 'object' || transport.headers === null || Array.isArray(transport.headers)) {
      throw new ConfigurationError('websocket transport headers must be an object');
    }
    
    for (const [key, value] of Object.entries(transport.headers)) {
      if (typeof key !== 'string' || typeof value !== 'string') {
        throw new ConfigurationError('websocket transport headers must contain only string key-value pairs');
      }
    }
  }
}

/**
 * 清理和标准化服务器配置
 */
export function normalizeServerConfig(config: Partial<McpServerConfig>): McpServerConfig {
  const normalized: McpServerConfig = {
    id: config.id?.trim() || '',
    name: config.name?.trim() || '',
    description: config.description?.trim() || undefined,
    transport: config.transport!,
    enabled: config.enabled ?? true,
    autoReconnect: config.autoReconnect,
    timeout: config.timeout,
    tags: config.tags?.map(tag => tag.trim()).filter(Boolean),
    createdAt: config.createdAt,
    updatedAt: config.updatedAt
  };

  // 移除 undefined 值
  Object.keys(normalized).forEach(key => {
    if (normalized[key as keyof McpServerConfig] === undefined) {
      delete normalized[key as keyof McpServerConfig];
    }
  });

  return normalized;
}