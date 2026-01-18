/**
 * SQLite Date Utilities
 *
 * SQLite stores dates as TEXT strings. These utilities help convert
 * between JavaScript Date objects and SQLite text format.
 */

/**
 * Convert a Date to SQLite-compatible text format
 */
export function toSqliteDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString();
}

/**
 * Get current timestamp in SQLite format
 */
export function nowSqlite(): string {
  return new Date().toISOString();
}

/**
 * Parse a SQLite date string to a Date object
 */
export function fromSqliteDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  return new Date(dateStr);
}
