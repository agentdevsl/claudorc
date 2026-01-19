/**
 * Type declarations for Bun's built-in modules
 * Used by src/server/api.ts which runs under Bun runtime
 */

declare module 'bun:sqlite' {
  export class Database {
    constructor(filename: string, options?: { readonly?: boolean; create?: boolean });
    close(): void;
    exec(sql: string): void;
    prepare<T = unknown>(sql: string): Statement<T>;
    query<T = unknown>(sql: string): Statement<T>;
    transaction<T>(fn: () => T): () => T;
  }

  export class Statement<T = unknown> {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number };
    get(...params: unknown[]): T | undefined;
    all(...params: unknown[]): T[];
    values(...params: unknown[]): unknown[][];
  }
}
