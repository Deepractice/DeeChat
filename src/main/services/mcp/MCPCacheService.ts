/**
 * MCP缓存服务
 * 提供工具缓存、连接池管理等性能优化功能
 */

import { MCPToolEntity } from '../../../shared/entities/MCPToolEntity'
import { MCPToolCallResponse } from '../../../shared/interfaces/IMCPProvider'

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // 生存时间（毫秒）
}

interface ToolCallCacheEntry {
  response: MCPToolCallResponse;
  timestamp: number;
  ttl: number;
}

/**
 * MCP缓存服务
 */
export class MCPCacheService {
  private toolsCache: Map<string, CacheEntry<MCPToolEntity[]>> = new Map();
  private toolCallCache: Map<string, ToolCallCacheEntry> = new Map();
  private serverStatusCache: Map<string, CacheEntry<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  // 缓存配置
  private readonly TOOLS_CACHE_TTL = 5 * 60 * 1000; // 5分钟
  private readonly BUILTIN_TOOLS_CACHE_TTL = 24 * 60 * 60 * 1000; // 内置插件24小时
  private readonly TOOL_CALL_CACHE_TTL = 30 * 1000; // 30秒
  private readonly SERVER_STATUS_CACHE_TTL = 10 * 1000; // 10秒
  private readonly CLEANUP_INTERVAL = 60 * 1000; // 1分钟清理一次

  constructor() {
    // 启动定期清理
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);

    console.log('[MCP Cache] 缓存服务已启动');
  }

  /**
   * 缓存服务器工具列表
   */
  cacheServerTools(serverId: string, tools: MCPToolEntity[], ttl?: number): void {
    // 为内置插件使用更长的缓存时间
    const defaultTtl = serverId.includes('builtin') ? this.BUILTIN_TOOLS_CACHE_TTL : this.TOOLS_CACHE_TTL;

    const entry: CacheEntry<MCPToolEntity[]> = {
      data: tools,
      timestamp: Date.now(),
      ttl: ttl || defaultTtl
    };

    this.toolsCache.set(serverId, entry);
    console.log(`[MCP Cache] 缓存服务器工具: ${serverId}, 工具数量: ${tools.length}, TTL: ${entry.ttl}ms`);
  }

  /**
   * 获取缓存的服务器工具列表
   */
  getCachedServerTools(serverId: string): MCPToolEntity[] | null {
    const entry = this.toolsCache.get(serverId);
    
    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.toolsCache.delete(serverId);
      console.log(`[MCP Cache] 工具缓存已过期: ${serverId}`);
      return null;
    }

    console.log(`[MCP Cache] 命中工具缓存: ${serverId}, 工具数量: ${entry.data.length}`);
    return entry.data;
  }

  /**
   * 缓存工具调用结果
   */
  cacheToolCall(
    serverId: string, 
    toolName: string, 
    args: any, 
    response: MCPToolCallResponse,
    ttl?: number
  ): void {
    // 只缓存成功的调用结果
    if (!response.success) {
      return;
    }

    // 生成缓存键
    const cacheKey = this.generateToolCallCacheKey(serverId, toolName, args);
    
    const entry: ToolCallCacheEntry = {
      response,
      timestamp: Date.now(),
      ttl: ttl || this.TOOL_CALL_CACHE_TTL
    };

    this.toolCallCache.set(cacheKey, entry);
    console.log(`[MCP Cache] 缓存工具调用结果: ${toolName}`);
  }

  /**
   * 获取缓存的工具调用结果
   */
  getCachedToolCall(serverId: string, toolName: string, args: any): MCPToolCallResponse | null {
    const cacheKey = this.generateToolCallCacheKey(serverId, toolName, args);
    const entry = this.toolCallCache.get(cacheKey);
    
    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.toolCallCache.delete(cacheKey);
      console.log(`[MCP Cache] 工具调用缓存已过期: ${toolName}`);
      return null;
    }

    console.log(`[MCP Cache] 命中工具调用缓存: ${toolName}`);
    return entry.response;
  }

  /**
   * 缓存服务器状态
   */
  cacheServerStatus(serverId: string, status: any, ttl?: number): void {
    const entry: CacheEntry<any> = {
      data: status,
      timestamp: Date.now(),
      ttl: ttl || this.SERVER_STATUS_CACHE_TTL
    };
    
    this.serverStatusCache.set(serverId, entry);
  }

  /**
   * 获取缓存的服务器状态
   */
  getCachedServerStatus(serverId: string): any | null {
    const entry = this.serverStatusCache.get(serverId);
    
    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.serverStatusCache.delete(serverId);
      return null;
    }

    return entry.data;
  }

  /**
   * 使工具缓存失效
   */
  invalidateServerTools(serverId: string): void {
    this.toolsCache.delete(serverId);
    console.log(`[MCP Cache] 工具缓存已失效: ${serverId}`);
  }

  /**
   * 使服务器状态缓存失效
   */
  invalidateServerStatus(serverId: string): void {
    this.serverStatusCache.delete(serverId);
    console.log(`[MCP Cache] 服务器状态缓存已失效: ${serverId}`);
  }

  /**
   * 使所有相关缓存失效
   */
  invalidateServer(serverId: string): void {
    this.invalidateServerTools(serverId);
    this.invalidateServerStatus(serverId);
    
    // 清理相关的工具调用缓存
    const keysToDelete: string[] = [];
    for (const key of this.toolCallCache.keys()) {
      if (key.startsWith(`${serverId}:`)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.toolCallCache.delete(key);
    }
    
    console.log(`[MCP Cache] 服务器所有缓存已失效: ${serverId}`);
  }

  /**
   * 获取所有缓存的工具（用于替代MCPIntegrationService的本地缓存）
   */
  getAllCachedTools(): MCPToolEntity[] {
    const allTools: MCPToolEntity[] = [];

    for (const [serverId, entry] of this.toolsCache.entries()) {
      // 检查是否过期
      if (Date.now() - entry.timestamp <= entry.ttl) {
        allTools.push(...entry.data);
      } else {
        // 清理过期缓存
        this.toolsCache.delete(serverId);
        console.log(`[MCP Cache] 清理过期工具缓存: ${serverId}`);
      }
    }

    return allTools;
  }

  /**
   * 获取所有有效缓存的服务器ID
   */
  getAllCachedServerIds(): string[] {
    const serverIds: string[] = [];

    for (const [serverId, entry] of this.toolsCache.entries()) {
      // 检查是否过期
      if (Date.now() - entry.timestamp <= entry.ttl) {
        serverIds.push(serverId);
      } else {
        // 清理过期缓存
        this.toolsCache.delete(serverId);
        console.log(`[MCP Cache] 清理过期工具缓存: ${serverId}`);
      }
    }

    return serverIds;
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    toolsCache: { size: number; hitRate: number };
    toolCallCache: { size: number; hitRate: number };
    serverStatusCache: { size: number; hitRate: number };
  } {
    return {
      toolsCache: {
        size: this.toolsCache.size,
        hitRate: 0 // TODO: 实现命中率统计
      },
      toolCallCache: {
        size: this.toolCallCache.size,
        hitRate: 0
      },
      serverStatusCache: {
        size: this.serverStatusCache.size,
        hitRate: 0
      }
    };
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    // 清理工具缓存
    for (const [key, entry] of this.toolsCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.toolsCache.delete(key);
        cleanedCount++;
      }
    }

    // 清理工具调用缓存
    for (const [key, entry] of this.toolCallCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.toolCallCache.delete(key);
        cleanedCount++;
      }
    }

    // 清理服务器状态缓存
    for (const [key, entry] of this.serverStatusCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.serverStatusCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[MCP Cache] 清理了 ${cleanedCount} 个过期缓存项`);
    }
  }

  /**
   * 生成工具调用缓存键
   */
  private generateToolCallCacheKey(serverId: string, toolName: string, args: any): string {
    // 对参数进行排序以确保一致性
    const sortedArgs = this.sortObject(args);
    const argsHash = JSON.stringify(sortedArgs);
    return `${serverId}:${toolName}:${Buffer.from(argsHash).toString('base64')}`;
  }

  /**
   * 递归排序对象键
   */
  private sortObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObject(item));
    }

    const sortedKeys = Object.keys(obj).sort();
    const sortedObj: any = {};
    
    for (const key of sortedKeys) {
      sortedObj[key] = this.sortObject(obj[key]);
    }
    
    return sortedObj;
  }

  /**
   * 清理所有缓存
   */
  clearAll(): void {
    this.toolsCache.clear();
    this.toolCallCache.clear();
    this.serverStatusCache.clear();
    console.log('[MCP Cache] 所有缓存已清理');
  }

  /**
   * 销毁缓存服务
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clearAll();
    console.log('[MCP Cache] 缓存服务已销毁');
  }
}
