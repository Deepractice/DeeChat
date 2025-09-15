/**
 * Base Transport class with common functionality
 */

import { EventEmitter } from 'events';
import type { Transport, TransportOptions } from './types.js';
import { ConnectionError, TimeoutError } from '../utils/errors.js';

export abstract class BaseTransport extends EventEmitter implements Transport {
  protected connected = false;
  protected options: TransportOptions;

  constructor(options: TransportOptions = {}) {
    super();
    this.options = {
      timeout: 30000,
      ...options
    };
  }

  // ============== Abstract Methods ==============

  abstract connect(): Promise<void>;
  abstract send(message: string): Promise<void>;
  abstract receive(): Promise<string | null>;
  abstract close(): Promise<void>;

  // ============== Common Implementation ==============

  isConnected(): boolean {
    return this.connected;
  }

  onMessage(handler: (message: string) => void): void {
    this.on('message', handler);
  }

  onError(handler: (error: Error) => void): void {
    this.on('error', handler);
  }

  onClose(handler: () => void): void {
    this.on('close', handler);
  }

  // ============== Protected Utilities ==============

  protected setConnected(connected: boolean): void {
    const wasConnected = this.connected;
    this.connected = connected;

    if (connected && !wasConnected) {
      this.emit('connected');
    } else if (!connected && wasConnected) {
      this.emit('close');
    }
  }

  protected emitMessage(message: string): void {
    this.emit('message', message);
  }

  protected emitError(error: Error): void {
    this.emit('error', error);
  }

  protected async withTimeout<T>(
    promise: Promise<T>, 
    timeoutMs?: number
  ): Promise<T> {
    const timeout = timeoutMs || this.options.timeout || 30000;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new TimeoutError(`Operation timed out after ${timeout}ms`, timeout));
      }, timeout);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  protected createConnectionError(message: string, originalError?: Error): ConnectionError {
    return new ConnectionError(message, {
      originalError: originalError?.message,
      transport: this.constructor.name
    });
  }
}