// Default: SQLite schema (re-export everything for backward compatibility)
export * from './sqlite';

// Named namespace exports for explicit schema selection per DB_MODE
export * as pgSchema from './postgres';
export * as sqliteSchema from './sqlite';
