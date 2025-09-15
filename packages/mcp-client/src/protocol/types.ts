/**
 * Protocol layer types
 */

export interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: string | number | null;
}

export interface JsonRpcRequest extends JsonRpcMessage {
  method: string;
  params?: any;
  id: string | number;
}

export interface JsonRpcResponse extends JsonRpcMessage {
  id: string | number;
  result?: any;
  error?: JsonRpcError;
}

export interface JsonRpcNotification extends JsonRpcMessage {
  method: string;
  params?: any;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

// MCP 特定的方法定义
export interface McpMethods {
  // 初始化
  'initialize': {
    params: {
      protocolVersion: string;
      capabilities: any;
      clientInfo: {
        name: string;
        version: string;
      };
    };
    result: {
      protocolVersion: string;
      capabilities: any;
      serverInfo: {
        name: string;
        version: string;
      };
    };
  };

  // 工具相关
  'tools/list': {
    params?: any;
    result: {
      tools: Array<{
        name: string;
        description?: string;
        inputSchema: any;
      }>;
    };
  };

  'tools/call': {
    params: {
      name: string;
      arguments?: any;
    };
    result: {
      content: Array<{
        type: string;
        text?: string;
        data?: any;
      }>;
      isError?: boolean;
    };
  };

  // 资源相关
  'resources/list': {
    params?: any;
    result: {
      resources: Array<{
        uri: string;
        name?: string;
        description?: string;
        mimeType?: string;
      }>;
    };
  };

  'resources/read': {
    params: {
      uri: string;
    };
    result: {
      contents: Array<{
        uri: string;
        mimeType?: string;
        text?: string;
        blob?: string;
      }>;
    };
  };

  // 提示词相关
  'prompts/list': {
    params?: any;
    result: {
      prompts: Array<{
        name: string;
        description?: string;
        arguments?: any;
      }>;
    };
  };

  'prompts/get': {
    params: {
      name: string;
      arguments?: any;
    };
    result: {
      description?: string;
      messages: Array<{
        role: string;
        content: {
          type: string;
          text: string;
        };
      }>;
    };
  };
}

// 请求选项
export interface RequestOptions {
  /** 请求超时时间 */
  timeout?: number;
  /** 请求 ID */
  id?: string | number;
}