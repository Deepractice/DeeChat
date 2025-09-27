/**
 * Database adapter interfaces for DeeChat packages
 */

export interface PreparedStatement {
  run(...params: any[]): { changes: number; lastInsertRowid: number | bigint };
  get<T = any>(...params: any[]): T | undefined;
  all<T = any>(...params: any[]): T[];
  finalize(): void;
}

export interface DatabaseAdapter {
  // Connection management
  connect(): Promise<void>;
  close(): Promise<void>;

  // Query operations
  prepare(sql: string): PreparedStatement;
  exec(sql: string): void;
  transaction<T>(fn: () => T): T;

  // Status check
  isConnected(): boolean;

  // Optional utility methods
  pragma?(name: string, value?: string | number): any;
  checkpoint?(): void;
}

export interface DatabaseOptions {
  readonly?: boolean;
  fileMustExist?: boolean;
  timeout?: number;
  verbose?: (message?: any, ...additionalArgs: any[]) => void;
}