// Default: SQLite schema (re-export everything for backward compatibility)

// Named namespace exports for explicit schema selection per DB_MODE
export * as pgSchema from './postgres';
export * from './sqlite';
export * as sqliteSchema from './sqlite';
