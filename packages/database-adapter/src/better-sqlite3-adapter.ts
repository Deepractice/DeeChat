import type { Database } from 'better-sqlite3';
import { DatabaseAdapter, PreparedStatement, DatabaseOptions } from './interfaces.js';

export class BetterSQLite3Adapter implements DatabaseAdapter {
  private db: Database | null = null;
  private _isConnected = false;

  constructor(
    private dbPath: string,
    private options?: DatabaseOptions
  ) {}

  async connect(): Promise<void> {
    if (this._isConnected) {
      return;
    }

    try {
      // Dynamic import to avoid requiring better-sqlite3 at package level
      const { default: Database } = await import('better-sqlite3');
      this.db = new Database(this.dbPath, this.options);
      this._isConnected = true;
    } catch (error) {
      throw new Error(
        `Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async close(): Promise<void> {
    if (this.db && this._isConnected) {
      this.db.close();
      this.db = null;
      this._isConnected = false;
    }
  }

  prepare(sql: string): PreparedStatement {
    if (!this.db || !this._isConnected) {
      throw new Error('Database not connected');
    }

    const stmt = this.db.prepare(sql);

    return {
      run: (...params: any[]) => stmt.run(...params),
      get: <T = any>(...params: any[]): T | undefined => stmt.get(...params) as T | undefined,
      all: <T = any>(...params: any[]): T[] => stmt.all(...params) as T[],
      finalize: () => {
        // better-sqlite3 statements don't have finalize method in newer versions
        // This is a no-op for compatibility
      },
    };
  }

  exec(sql: string): void {
    if (!this.db || !this._isConnected) {
      throw new Error('Database not connected');
    }
    this.db.exec(sql);
  }

  transaction<T>(fn: () => T): T {
    if (!this.db || !this._isConnected) {
      throw new Error('Database not connected');
    }
    return this.db.transaction(fn)();
  }

  isConnected(): boolean {
    return this._isConnected && this.db !== null;
  }

  pragma(name: string, value?: string | number): any {
    if (!this.db || !this._isConnected) {
      throw new Error('Database not connected');
    }
    return value !== undefined
      ? this.db.pragma(`${name} = ${value}`)
      : this.db.pragma(name);
  }

  checkpoint(): void {
    if (!this.db || !this._isConnected) {
      throw new Error('Database not connected');
    }
    this.db.pragma('wal_checkpoint(TRUNCATE)');
  }
}