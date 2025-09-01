/**
 * 日志转发服务
 * 将后端日志转发到前端显示
 */

import { BrowserWindow } from 'electron';

export interface LogMessage {
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  message: string;
  timestamp: string;
  data?: any;
}

export class LogForwardingService {
  private static instance: LogForwardingService;
  private mainWindow: BrowserWindow | null = null;

  private constructor() {}

  static getInstance(): LogForwardingService {
    if (!LogForwardingService.instance) {
      LogForwardingService.instance = new LogForwardingService();
    }
    return LogForwardingService.instance;
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  /**
   * 发送日志到前端
   */
  sendLogToFrontend(log: LogMessage) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('backend-log', log);
    }
  }

  /**
   * 便捷方法 - 发送MCP相关日志
   */
  sendMCPLog(level: LogMessage['level'], message: string, data?: any) {
    this.sendLogToFrontend({
      level,
      source: 'MCP',
      message,
      timestamp: new Date().toISOString(),
      data
    });
  }

  /**
   * 便捷方法 - 发送服务相关日志
   */
  sendServiceLog(level: LogMessage['level'], service: string, message: string, data?: any) {
    this.sendLogToFrontend({
      level,
      source: service,
      message,
      timestamp: new Date().toISOString(),
      data
    });
  }
}