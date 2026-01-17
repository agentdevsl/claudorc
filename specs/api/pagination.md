# API Pagination Specification

## Overview

This specification defines cursor-based pagination for all list endpoints in the AgentPane API. Cursor pagination provides consistent, performant navigation through datasets, especially for real-time data that may change between requests.

---

## Pagination Strategy

### Cursor-Based vs Offset-Based

| Aspect | Cursor-Based | Offset-Based |
|--------|-------------|--------------|
| **Performance** | O(1) for any page | O(n) for deep pages |
| **Consistency** | Stable during modifications | Skips/duplicates on insert/delete |
| **Real-time data** | Excellent | Poor |
| **Random access** | Not supported | Supported |
| **Cacheability** | URL-based caching works | Page 5 may change |
| **Implementation** | More complex | Simple |

### Why Cursor-Based for AgentPane

AgentPane uses cursor-based pagination as the primary strategy for several reasons:

1. **Real-time data streams**: Agent sessions emit events continuously; offset pagination would cause missed or duplicate events during playback
2. **Data consistency**: Tasks move between Kanban columns; cursor pagination ensures users see consistent views during navigation
3. **Performance at scale**: Projects may have thousands of tasks and sessions; cursor pagination maintains constant-time queries regardless of page depth
4. **Infinite scroll UX**: Cursor pagination aligns naturally with infinite scroll patterns used throughout the UI

### When to Use Each Approach

**Use cursor-based (default):**
- List endpoints with real-time updates
- Infinite scroll UIs
- Large datasets (>1000 items)
- Data that changes frequently

**Consider offset-based (special cases only):**
- Admin reports requiring page jumping
- Export functionality with known total count
- Static datasets that rarely change

---

## Cursor Format

### Encoding Strategy

Cursors are **Base64-encoded JSON objects** that contain the information needed to resume pagination from a specific point.

```typescript
interface CursorPayload {
  /** Primary ID of the last item */
  id: string;
  /** Value of the sort field for the last item */
  sortValue: string | number | null;
  /** Name of the sort field */
  sortField: string;
  /** Sort direction */
  order: 'asc' | 'desc';
  /** Version for future cursor format changes */
  version: 1;
}
```

### Cursor Encoding/Decoding

```typescript
// lib/api/cursor.ts
import { z } from 'zod';

const CURSOR_VERSION = 1;

const cursorPayloadSchema = z.object({
  id: z.string(),
  sortValue: z.union([z.string(), z.number(), z.null()]),
  sortField: z.string(),
  order: z.enum(['asc', 'desc']),
  version: z.literal(CURSOR_VERSION),
});

type CursorPayload = z.infer<typeof cursorPayloadSchema>;

export type CursorResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: 'INVALID_CURSOR' | 'CURSOR_EXPIRED' };

/**
 * Encode a cursor payload to a URL-safe Base64 string
 */
export function encodeCursor(payload: Omit<CursorPayload, 'version'>): string {
  const fullPayload: CursorPayload = {
    ...payload,
    version: CURSOR_VERSION,
  };
  const json = JSON.stringify(fullPayload);
  // Use URL-safe Base64 encoding
  return btoa(json)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decode a cursor string back to a payload
 * Returns a Result type for safe error handling
 */
export function decodeCursor(cursor: string): CursorResult<CursorPayload> {
  try {
    // Restore standard Base64 from URL-safe encoding
    const standardBase64 = cursor
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    // Add padding if needed
    const padded = standardBase64 + '=='.slice(0, (4 - (standardBase64.length % 4)) % 4);

    const json = atob(padded);
    const parsed = JSON.parse(json);

    const validated = cursorPayloadSchema.safeParse(parsed);
    if (!validated.success) {
      return { ok: false, error: 'INVALID_CURSOR' };
    }

    return { ok: true, value: validated.data };
  } catch {
    return { ok: false, error: 'INVALID_CURSOR' };
  }
}

/**
 * Create a cursor from an item and sort configuration
 */
export function createCursor<T extends { id: string }>(
  item: T,
  sortField: keyof T & string,
  order: 'asc' | 'desc'
): string {
  return encodeCursor({
    id: item.id,
    sortValue: item[sortField] as string | number | null,
    sortField,
    order,
  });
}
```

### Cursor Validation

Cursors should be validated on every request:

```typescript
// lib/api/pagination.ts
import { decodeCursor, type CursorResult, type CursorPayload } from './cursor';

interface ValidateCursorOptions {
  /** Expected sort field (must match cursor) */
  sortField: string;
  /** Expected sort order (must match cursor) */
  order: 'asc' | 'desc';
  /** Maximum cursor age in milliseconds (optional) */
  maxAgeMs?: number;
}

export function validateCursor(
  cursor: string,
  options: ValidateCursorOptions
): CursorResult<CursorPayload> {
  const decoded = decodeCursor(cursor);

  if (!decoded.ok) {
    return decoded;
  }

  const payload = decoded.value;

  // Validate sort field matches
  if (payload.sortField !== options.sortField) {
    return { ok: false, error: 'INVALID_CURSOR' };
  }

  // Validate order matches
  if (payload.order !== options.order) {
    return { ok: false, error: 'INVALID_CURSOR' };
  }

  // Optional: Check cursor expiration
  // Note: This requires embedding a timestamp in the cursor
  // Uncomment if implementing cursor expiration
  // if (options.maxAgeMs && payload.createdAt) {
  //   const age = Date.now() - payload.createdAt;
  //   if (age > options.maxAgeMs) {
  //     return { ok: false, error: 'CURSOR_EXPIRED' };
  //   }
  // }

  return { ok: true, value: payload };
}
```

### Opaqueness Principle

Cursors are **opaque to clients**. The API documentation should never describe the internal cursor format. Clients must:
- Treat cursors as opaque strings
- Never parse or construct cursors manually
- Only use cursors returned from the API
- Not assume cursor stability across API versions

---

## Request Parameters

### Standard Pagination Parameters

All paginated endpoints accept these query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cursor` | string | (none) | Opaque cursor from previous response. Omit for first page. |
| `limit` | number | 20 | Items per page (1-100) |
| `sort` | string | varies | Sort field name (endpoint-specific) |
| `order` | 'asc' \| 'desc' | 'desc' | Sort direction |

### Zod Schema

```typescript
// db/schema/validation.ts
import { z } from 'zod';

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationParams = z.infer<typeof paginationSchema>;
```

### Parameter Validation

```typescript
// lib/api/pagination.ts
import { z } from 'zod';

interface EndpointPaginationConfig {
  /** Default sort field for this endpoint */
  defaultSort: string;
  /** Allowed sort fields */
  allowedSorts: string[];
  /** Default sort order */
  defaultOrder: 'asc' | 'desc';
  /** Default limit */
  defaultLimit: number;
  /** Maximum allowed limit */
  maxLimit: number;
}

export function createPaginationSchema(config: EndpointPaginationConfig) {
  return z.object({
    cursor: z.string().optional(),
    limit: z.coerce
      .number()
      .min(1)
      .max(config.maxLimit)
      .default(config.defaultLimit),
    sort: z
      .enum(config.allowedSorts as [string, ...string[]])
      .default(config.defaultSort),
    order: z.enum(['asc', 'desc']).default(config.defaultOrder),
  });
}

// Example: Projects endpoint schema
export const projectsPaginationSchema = createPaginationSchema({
  defaultSort: 'updatedAt',
  allowedSorts: ['updatedAt', 'createdAt', 'name'],
  defaultOrder: 'desc',
  defaultLimit: 20,
  maxLimit: 100,
});
```

---

## Response Format

### Type Definition

```typescript
// lib/api/types.ts

/**
 * Pagination metadata in API responses
 */
interface PaginationMeta {
  /** Cursor to fetch next page, null if no more pages */
  nextCursor: string | null;
  /** Cursor to fetch previous page, null if on first page */
  prevCursor: string | null;
  /** Whether there are more items after this page */
  hasMore: boolean;
  /**
   * Total count of items matching the query.
   * Optional - may be omitted for performance on large datasets.
   */
  totalCount?: number;
}

/**
 * Standard paginated API response
 */
interface PaginatedResponse<T> {
  ok: true;
  data: {
    items: T[];
    pagination: PaginationMeta;
  };
}

/**
 * Full API response type (success or error)
 */
type ApiResponse<T> =
  | PaginatedResponse<T>
  | { ok: false; error: { code: string; message: string; details?: unknown } };
```

### Response Builder

```typescript
// lib/api/pagination.ts

interface BuildPaginatedResponseParams<T extends { id: string }> {
  items: T[];
  limit: number;
  sortField: keyof T & string;
  order: 'asc' | 'desc';
  /** Cursor from request (for generating prevCursor) */
  requestCursor?: string;
  /** Whether to include total count */
  includeTotalCount?: boolean;
  /** Total count if already computed */
  totalCount?: number;
}

export function buildPaginatedResponse<T extends { id: string }>(
  params: BuildPaginatedResponseParams<T>
): PaginatedResponse<T>['data'] {
  const { items, limit, sortField, order, requestCursor, totalCount } = params;

  // Check if there are more items
  // We fetch limit + 1 items to detect if there are more
  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;

  // Generate next cursor from last item
  const nextCursor = hasMore && pageItems.length > 0
    ? createCursor(pageItems[pageItems.length - 1], sortField, order)
    : null;

  // Generate prev cursor from first item (if not first page)
  const prevCursor = requestCursor && pageItems.length > 0
    ? createCursor(pageItems[0], sortField, invertOrder(order))
    : null;

  return {
    items: pageItems,
    pagination: {
      nextCursor,
      prevCursor,
      hasMore,
      ...(totalCount !== undefined && { totalCount }),
    },
  };
}

function invertOrder(order: 'asc' | 'desc'): 'asc' | 'desc' {
  return order === 'asc' ? 'desc' : 'asc';
}
```

---

## Cursor Generation

### Complete Implementation

```typescript
// lib/api/cursor.ts
import { z } from 'zod';

const CURSOR_VERSION = 1;

// Re-export types
export interface CursorPayload {
  id: string;
  sortValue: string | number | null;
  sortField: string;
  order: 'asc' | 'desc';
  version: number;
}

export type CursorResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: 'INVALID_CURSOR' | 'CURSOR_EXPIRED' };

const cursorPayloadSchema = z.object({
  id: z.string(),
  sortValue: z.union([z.string(), z.number(), z.null()]),
  sortField: z.string(),
  order: z.enum(['asc', 'desc']),
  version: z.number(),
});

/**
 * Encode a cursor payload to a URL-safe Base64 string.
 *
 * @example
 * const cursor = encodeCursor({
 *   id: 'clx1234567890',
 *   sortValue: '2026-01-15T10:00:00Z',
 *   sortField: 'createdAt',
 *   order: 'desc'
 * });
 * // => 'eyJpZCI6ImNseDEyMzQ1Njc4OTAiLC...'
 */
export function encodeCursor(payload: Omit<CursorPayload, 'version'>): string {
  const fullPayload: CursorPayload = {
    ...payload,
    version: CURSOR_VERSION,
  };

  const json = JSON.stringify(fullPayload);

  // URL-safe Base64: replace +/ with -_, strip padding
  return btoa(json)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decode a cursor string back to a payload.
 * Returns a Result type for safe error handling.
 *
 * @example
 * const result = decodeCursor('eyJpZCI6ImNseDEyMzQ1Njc4OTAiLC...');
 * if (result.ok) {
 *   console.log(result.value.id); // 'clx1234567890'
 * }
 */
export function decodeCursor(cursor: string): CursorResult<CursorPayload> {
  try {
    // Restore standard Base64 from URL-safe encoding
    let standardBase64 = cursor
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    // Add padding if needed (Base64 length must be multiple of 4)
    const paddingNeeded = (4 - (standardBase64.length % 4)) % 4;
    standardBase64 += '='.repeat(paddingNeeded);

    const json = atob(standardBase64);
    const parsed = JSON.parse(json);

    const validated = cursorPayloadSchema.safeParse(parsed);
    if (!validated.success) {
      return { ok: false, error: 'INVALID_CURSOR' };
    }

    // Check version compatibility
    if (validated.data.version > CURSOR_VERSION) {
      // Future cursor version - client should refresh
      return { ok: false, error: 'INVALID_CURSOR' };
    }

    return { ok: true, value: validated.data };
  } catch {
    return { ok: false, error: 'INVALID_CURSOR' };
  }
}

/**
 * Create a cursor from an item and sort configuration.
 * Convenience function for building response cursors.
 *
 * @example
 * const cursor = createCursor(project, 'updatedAt', 'desc');
 */
export function createCursor<T extends { id: string }>(
  item: T,
  sortField: keyof T & string,
  order: 'asc' | 'desc'
): string {
  const sortValue = item[sortField];

  // Normalize sort value for consistent encoding
  let normalizedValue: string | number | null;
  if (sortValue === null || sortValue === undefined) {
    normalizedValue = null;
  } else if (sortValue instanceof Date) {
    normalizedValue = sortValue.toISOString();
  } else if (typeof sortValue === 'string' || typeof sortValue === 'number') {
    normalizedValue = sortValue;
  } else {
    normalizedValue = String(sortValue);
  }

  return encodeCursor({
    id: item.id,
    sortValue: normalizedValue,
    sortField,
    order,
  });
}

/**
 * Extract sort value from cursor for use in queries.
 * Handles type conversion based on expected field type.
 */
export function getSortValueFromCursor(
  cursor: CursorPayload,
  asType: 'string' | 'number' | 'date' = 'string'
): string | number | Date | null {
  const { sortValue } = cursor;

  if (sortValue === null) {
    return null;
  }

  switch (asType) {
    case 'number':
      return typeof sortValue === 'number' ? sortValue : Number(sortValue);
    case 'date':
      return new Date(sortValue);
    default:
      return String(sortValue);
  }
}
```

---

## Database Queries

### Drizzle ORM Pagination Patterns

```typescript
// lib/db/pagination.ts
import { and, or, gt, lt, gte, lte, eq, asc, desc, sql, SQL } from 'drizzle-orm';
import type { PgColumn, PgTableWithColumns } from 'drizzle-orm/pg-core';
import { decodeCursor, type CursorPayload } from '../api/cursor';

interface CursorPaginationOptions {
  /** Decoded cursor payload */
  cursor?: CursorPayload;
  /** Sort column */
  sortColumn: PgColumn;
  /** ID column for tie-breaking */
  idColumn: PgColumn;
  /** Sort direction */
  order: 'asc' | 'desc';
  /** Number of items to fetch */
  limit: number;
}

/**
 * Build WHERE clause for cursor pagination.
 *
 * Uses (sortValue, id) compound comparison for stable ordering:
 * - For ASC:  WHERE (sortCol > cursorVal) OR (sortCol = cursorVal AND id > cursorId)
 * - For DESC: WHERE (sortCol < cursorVal) OR (sortCol = cursorVal AND id < cursorId)
 */
export function buildCursorWhere(options: CursorPaginationOptions): SQL | undefined {
  const { cursor, sortColumn, idColumn, order } = options;

  if (!cursor) {
    return undefined;
  }

  const sortValue = cursor.sortValue;
  const cursorId = cursor.id;

  // Determine comparison operators based on order
  const primaryOp = order === 'asc' ? gt : lt;
  const secondaryOp = order === 'asc' ? gt : lt;

  // Handle null sort values
  if (sortValue === null) {
    // For null values, only compare by ID
    return secondaryOp(idColumn, cursorId);
  }

  // Compound comparison: (sortCol > val) OR (sortCol = val AND id > cursorId)
  return or(
    primaryOp(sortColumn, sortValue),
    and(
      eq(sortColumn, sortValue),
      secondaryOp(idColumn, cursorId)
    )
  );
}

/**
 * Build ORDER BY clause for cursor pagination.
 * Always includes ID as secondary sort for stable ordering.
 */
export function buildCursorOrderBy(options: Pick<CursorPaginationOptions, 'sortColumn' | 'idColumn' | 'order'>): SQL[] {
  const { sortColumn, idColumn, order } = options;
  const orderFn = order === 'asc' ? asc : desc;

  return [
    orderFn(sortColumn),
    orderFn(idColumn),
  ];
}
```

### Complete Query Builder

```typescript
// lib/services/pagination-query.ts
import { db } from '@/db';
import { and, count, sql, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTableWithColumns } from 'drizzle-orm/pg-core';
import { decodeCursor, createCursor } from '@/lib/api/cursor';
import { buildCursorWhere, buildCursorOrderBy } from '@/lib/db/pagination';

interface PaginatedQueryOptions<TTable extends PgTableWithColumns<any>> {
  table: TTable;
  sortColumn: PgColumn;
  idColumn: PgColumn;
  order: 'asc' | 'desc';
  limit: number;
  cursor?: string;
  /** Additional WHERE conditions */
  where?: SQL;
  /** Whether to compute total count */
  includeTotalCount?: boolean;
}

interface PaginatedQueryResult<T> {
  items: T[];
  pagination: {
    nextCursor: string | null;
    prevCursor: string | null;
    hasMore: boolean;
    totalCount?: number;
  };
}

export async function paginatedQuery<
  TTable extends PgTableWithColumns<any>,
  TResult = TTable['$inferSelect']
>(
  options: PaginatedQueryOptions<TTable>
): Promise<PaginatedQueryResult<TResult>> {
  const {
    table,
    sortColumn,
    idColumn,
    order,
    limit,
    cursor,
    where: additionalWhere,
    includeTotalCount,
  } = options;

  // Decode cursor if provided
  let decodedCursor: ReturnType<typeof decodeCursor>['value'] | undefined;
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded.ok) {
      throw new Error(decoded.error);
    }
    decodedCursor = decoded.value;
  }

  // Build WHERE clause
  const cursorWhere = buildCursorWhere({
    cursor: decodedCursor,
    sortColumn,
    idColumn,
    order,
  });

  const whereClause = and(additionalWhere, cursorWhere);

  // Build ORDER BY clause
  const orderByClause = buildCursorOrderBy({ sortColumn, idColumn, order });

  // Fetch limit + 1 to detect if there are more items
  const query = db
    .select()
    .from(table)
    .where(whereClause)
    .orderBy(...orderByClause)
    .limit(limit + 1);

  // Optionally fetch total count in parallel
  const [items, countResult] = await Promise.all([
    query as Promise<TResult[]>,
    includeTotalCount
      ? db.select({ count: count() }).from(table).where(additionalWhere)
      : Promise.resolve(null),
  ]);

  // Determine if there are more items
  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;

  // Get sort field name from column
  const sortField = sortColumn.name as keyof TResult & string;

  // Generate cursors
  const nextCursor = hasMore && pageItems.length > 0
    ? createCursor(pageItems[pageItems.length - 1] as any, sortField, order)
    : null;

  const prevCursor = cursor && pageItems.length > 0
    ? createCursor(pageItems[0] as any, sortField, order === 'asc' ? 'desc' : 'asc')
    : null;

  return {
    items: pageItems,
    pagination: {
      nextCursor,
      prevCursor,
      hasMore,
      ...(countResult && { totalCount: countResult[0].count }),
    },
  };
}
```

### Index Requirements

For efficient cursor pagination, ensure compound indexes exist:

```sql
-- Projects: sorted by updatedAt descending
CREATE INDEX idx_projects_updated_at_id ON projects (updated_at DESC, id DESC);

-- Tasks: sorted by position within column
CREATE INDEX idx_tasks_column_position_id ON tasks (project_id, column, position ASC, id ASC);

-- Session history: sorted by timestamp
CREATE INDEX idx_session_events_session_timestamp ON session_events (session_id, timestamp ASC, id ASC);

-- Agents: sorted by status then name
CREATE INDEX idx_agents_project_status_name ON agents (project_id, status, name ASC, id ASC);
```

Drizzle schema definition:

```typescript
// db/schema/indexes.ts
import { index } from 'drizzle-orm/pg-core';
import { projects, tasks, sessionEvents, agents } from './tables';

export const projectIndexes = {
  updatedAtIdx: index('idx_projects_updated_at_id')
    .on(projects.updatedAt, projects.id)
    .desc(),
};

export const taskIndexes = {
  columnPositionIdx: index('idx_tasks_column_position_id')
    .on(tasks.projectId, tasks.column, tasks.position, tasks.id),
};

export const sessionEventIndexes = {
  sessionTimestampIdx: index('idx_session_events_session_timestamp')
    .on(sessionEvents.sessionId, sessionEvents.timestamp, sessionEvents.id),
};

export const agentIndexes = {
  projectStatusNameIdx: index('idx_agents_project_status_name')
    .on(agents.projectId, agents.status, agents.name, agents.id),
};
```

---

## Endpoint-Specific Details

### GET /api/projects

**Sort Configuration:**
- Default sort: `updatedAt` DESC
- Allowed sorts: `updatedAt`, `createdAt`, `name`

```typescript
// app/routes/api/projects/index.ts
import { createServerFileRoute } from '@tanstack/react-start/server';
import { paginatedQuery } from '@/lib/services/pagination-query';
import { projects } from '@/db/schema';
import { eq } from 'drizzle-orm';

const projectsListSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  sort: z.enum(['updatedAt', 'createdAt', 'name']).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
});

export const ServerRoute = createServerFileRoute().methods({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);

    const parsed = projectsListSchema.safeParse(params);
    if (!parsed.success) {
      return Response.json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters' },
      }, { status: 400 });
    }

    const { cursor, limit, sort, order, search } = parsed.data;

    // Map sort field to column
    const sortColumnMap = {
      updatedAt: projects.updatedAt,
      createdAt: projects.createdAt,
      name: projects.name,
    };

    try {
      const result = await paginatedQuery({
        table: projects,
        sortColumn: sortColumnMap[sort],
        idColumn: projects.id,
        order,
        limit,
        cursor,
        where: search ? ilike(projects.name, `%${search}%`) : undefined,
        includeTotalCount: true,
      });

      return Response.json({ ok: true, data: result });
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_CURSOR') {
        return Response.json({
          ok: false,
          error: { code: 'INVALID_CURSOR', message: 'Invalid or malformed cursor' },
        }, { status: 400 });
      }
      throw error;
    }
  },
});
```

### GET /api/tasks

**Sort Configuration:**
- Default sort: `position` ASC (within column)
- Allowed sorts: `position`, `createdAt`, `updatedAt`
- Always filtered by `projectId`

```typescript
// app/routes/api/tasks/index.ts
const tasksListSchema = z.object({
  projectId: z.string().cuid2(),
  column: z.enum(['backlog', 'in_progress', 'waiting_approval', 'verified']).optional(),
  agentId: z.string().cuid2().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  sort: z.enum(['position', 'createdAt', 'updatedAt']).default('position'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

// Query with position-based cursor for Kanban ordering
const result = await paginatedQuery({
  table: tasks,
  sortColumn: tasks.position,
  idColumn: tasks.id,
  order: 'asc',
  limit,
  cursor,
  where: and(
    eq(tasks.projectId, projectId),
    column ? eq(tasks.column, column) : undefined,
    agentId ? eq(tasks.agentId, agentId) : undefined
  ),
});
```

### GET /api/agents

**Sort Configuration:**
- Default sort: `status`, then `name` ASC
- Complex multi-field sorting

```typescript
// For agents, we use a compound cursor with status priority
const agentStatusPriority = {
  running: 0,
  starting: 1,
  paused: 2,
  error: 3,
  idle: 4,
  completed: 5,
};

// Custom sort using computed column
const result = await paginatedQuery({
  table: agents,
  sortColumn: agents.name, // Primary visible sort
  idColumn: agents.id,
  order: 'asc',
  limit,
  cursor,
  where: and(
    eq(agents.projectId, projectId),
    status ? eq(agents.status, status) : undefined
  ),
});
```

### GET /api/sessions/:id/history

**Sort Configuration:**
- Default sort: `timestamp` ASC (chronological playback)
- Supports filtering by event type and time range

```typescript
// app/routes/api/sessions/$id/history.ts
const historySchema = z.object({
  startTime: z.coerce.number().optional(),
  endTime: z.coerce.number().optional(),
  eventTypes: z.string().transform(s => s.split(',')).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(1000).default(100),
});

// Time-bounded pagination for session replay
const result = await paginatedQuery({
  table: sessionEvents,
  sortColumn: sessionEvents.timestamp,
  idColumn: sessionEvents.id,
  order: 'asc',
  limit,
  cursor,
  where: and(
    eq(sessionEvents.sessionId, sessionId),
    startTime ? gte(sessionEvents.timestamp, startTime) : undefined,
    endTime ? lte(sessionEvents.timestamp, endTime) : undefined,
    eventTypes ? inArray(sessionEvents.type, eventTypes) : undefined
  ),
});
```

---

## Edge Cases

### Empty Results

When a query returns no items:

```typescript
{
  ok: true,
  data: {
    items: [],
    pagination: {
      nextCursor: null,
      prevCursor: null,
      hasMore: false,
      totalCount: 0
    }
  }
}
```

### Single Item

```typescript
{
  ok: true,
  data: {
    items: [{ id: 'clx123', name: 'Only Project' }],
    pagination: {
      nextCursor: null,
      prevCursor: null,
      hasMore: false,
      totalCount: 1
    }
  }
}
```

### Deleted Items (Cursor Points to Deleted Record)

When the cursor's reference item has been deleted:

```typescript
// lib/db/pagination.ts
export function buildCursorWhere(options: CursorPaginationOptions): SQL | undefined {
  const { cursor, sortColumn, idColumn, order } = options;

  if (!cursor) {
    return undefined;
  }

  // Use >= / <= instead of > / < to handle deleted items gracefully
  // This means if the cursor item is deleted, we still get items after that position
  const primaryOp = order === 'asc' ? gte : lte;

  return or(
    primaryOp(sortColumn, cursor.sortValue),
    and(
      eq(sortColumn, cursor.sortValue),
      order === 'asc' ? gt(idColumn, cursor.id) : lt(idColumn, cursor.id)
    )
  );
}
```

**Alternative approach: Validate cursor item exists**

```typescript
async function validateCursorItem(
  table: PgTableWithColumns<any>,
  idColumn: PgColumn,
  cursorId: string
): Promise<boolean> {
  const result = await db
    .select({ id: idColumn })
    .from(table)
    .where(eq(idColumn, cursorId))
    .limit(1);

  return result.length > 0;
}
```

### Sort Field Changes Between Requests

If the client requests a different sort field than the cursor was generated with:

```typescript
// Validate cursor matches requested sort
if (cursor) {
  const decoded = decodeCursor(cursor);
  if (decoded.ok && decoded.value.sortField !== requestedSort) {
    // Option 1: Return error
    return Response.json({
      ok: false,
      error: {
        code: 'INVALID_CURSOR',
        message: 'Cursor sort field does not match requested sort. Please start pagination from the beginning.',
      },
    }, { status: 400 });

    // Option 2: Ignore cursor and start fresh (less strict)
    // cursor = undefined;
  }
}
```

### Concurrent Modifications

When items are added/removed during pagination:

**Behavior guarantees:**
- Items added before current cursor position: Will NOT appear
- Items added after current cursor position: Will appear when reached
- Items deleted before cursor: No effect (cursor still valid)
- Items deleted at cursor: Next page starts from next valid item
- Items moved (e.g., task position change): May appear multiple times or be skipped

**Mitigation strategies:**

1. **Accept eventual consistency**: For most UIs, minor inconsistencies are acceptable
2. **Use optimistic updates**: Client-side state management handles immediate feedback
3. **Implement versioned cursors**: Include a data version in cursor, reject if stale

```typescript
// Versioned cursor approach (optional)
interface VersionedCursorPayload extends CursorPayload {
  dataVersion: number; // Increment on any data change
}

// Check version on decode
if (cursor.dataVersion !== currentDataVersion) {
  return { ok: false, error: 'CURSOR_EXPIRED' };
}
```

---

## Performance Considerations

### Index Requirements

**Critical indexes for each paginated endpoint:**

```sql
-- Required indexes for efficient cursor pagination
-- Each index should include (sort_column, id) at minimum

-- Projects
CREATE INDEX CONCURRENTLY idx_projects_updated_id
  ON projects (updated_at DESC, id DESC);
CREATE INDEX CONCURRENTLY idx_projects_created_id
  ON projects (created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY idx_projects_name_id
  ON projects (name ASC, id ASC);

-- Tasks (within project scope)
CREATE INDEX CONCURRENTLY idx_tasks_project_column_position
  ON tasks (project_id, column, position ASC, id ASC);
CREATE INDEX CONCURRENTLY idx_tasks_project_created
  ON tasks (project_id, created_at DESC, id DESC);

-- Session events (high volume, time-series)
CREATE INDEX CONCURRENTLY idx_session_events_session_time
  ON session_events (session_id, timestamp ASC, id ASC);

-- Agents
CREATE INDEX CONCURRENTLY idx_agents_project_status_name
  ON agents (project_id, status, name ASC, id ASC);
```

### Total Count Trade-offs

Computing `totalCount` requires a full table scan:

```typescript
// lib/services/pagination-query.ts

interface TotalCountOptions {
  /** Always include total count */
  always: boolean;
  /** Include only if estimated row count is below threshold */
  threshold?: number;
  /** Use estimated count from statistics for large tables */
  useEstimate?: boolean;
}

async function getTotalCount(
  table: PgTableWithColumns<any>,
  where: SQL | undefined,
  options: TotalCountOptions
): Promise<number | undefined> {
  if (!options.always && !options.useEstimate) {
    return undefined;
  }

  if (options.useEstimate) {
    // Use PostgreSQL statistics for fast estimate
    const result = await db.execute(sql`
      SELECT reltuples::bigint AS estimate
      FROM pg_class
      WHERE relname = ${table._.name}
    `);

    const estimate = result.rows[0]?.estimate ?? 0;

    if (options.threshold && estimate > options.threshold) {
      return undefined; // Skip exact count for large tables
    }
  }

  // Exact count
  const [{ count: exactCount }] = await db
    .select({ count: count() })
    .from(table)
    .where(where);

  return exactCount;
}
```

**Recommendations:**
- Include `totalCount` for small datasets (<10,000 rows)
- Use estimated count for large datasets
- Omit entirely for time-series data (session events)

### Caching Strategies

```typescript
// lib/api/cache.ts
import { createHash } from 'crypto';

interface CacheConfig {
  /** Cache TTL in seconds */
  ttl: number;
  /** Whether to use stale-while-revalidate */
  swr?: boolean;
  /** SWR window in seconds */
  swrWindow?: number;
}

function buildCacheKey(
  endpoint: string,
  params: Record<string, unknown>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');

  return createHash('sha256')
    .update(`${endpoint}?${sortedParams}`)
    .digest('hex')
    .slice(0, 16);
}

function buildCacheHeaders(config: CacheConfig): Headers {
  const headers = new Headers();

  if (config.swr && config.swrWindow) {
    headers.set(
      'Cache-Control',
      `public, max-age=${config.ttl}, stale-while-revalidate=${config.swrWindow}`
    );
  } else {
    headers.set('Cache-Control', `public, max-age=${config.ttl}`);
  }

  return headers;
}

// Per-endpoint cache configuration
const endpointCacheConfig: Record<string, CacheConfig> = {
  '/api/projects': { ttl: 60, swr: true, swrWindow: 300 },
  '/api/tasks': { ttl: 30, swr: true, swrWindow: 60 },
  '/api/agents': { ttl: 10, swr: true, swrWindow: 30 },
  '/api/sessions/:id/history': { ttl: 3600 }, // Historical data is stable
};
```

### Rate Limiting Interaction

Pagination requests count toward rate limits. Configure limits appropriately:

```typescript
// Rate limit configuration from endpoints.md
const rateLimits = {
  read: { limit: 1000, windowMs: 60_000 },   // 1000 reads/min
  write: { limit: 100, windowMs: 60_000 },    // 100 writes/min
};

// Pagination doesn't require special rate limit handling
// But consider: deep pagination (many sequential requests)
// could hit limits during infinite scroll

// Solution: Encourage larger page sizes for bulk operations
const recommendedLimits = {
  infiniteScroll: 20,    // Interactive browsing
  bulkFetch: 100,        // Data export, sync
  sessionReplay: 1000,   // Event replay (high volume)
};
```

---

## Client Usage

### React Query Infinite Scroll Pattern

```typescript
// hooks/use-paginated-query.ts
import { useInfiniteQuery, type UseInfiniteQueryOptions } from '@tanstack/react-query';

interface UsePaginatedQueryOptions<T> {
  queryKey: unknown[];
  endpoint: string;
  params?: Record<string, string | number>;
  limit?: number;
  enabled?: boolean;
}

interface PaginatedResponse<T> {
  ok: true;
  data: {
    items: T[];
    pagination: {
      nextCursor: string | null;
      hasMore: boolean;
      totalCount?: number;
    };
  };
}

export function usePaginatedQuery<T>({
  queryKey,
  endpoint,
  params = {},
  limit = 20,
  enabled = true,
}: UsePaginatedQueryOptions<T>) {
  return useInfiniteQuery({
    queryKey: [...queryKey, params, limit],
    queryFn: async ({ pageParam }): Promise<PaginatedResponse<T>> => {
      const searchParams = new URLSearchParams({
        ...Object.fromEntries(
          Object.entries(params).map(([k, v]) => [k, String(v)])
        ),
        limit: String(limit),
        ...(pageParam && { cursor: pageParam }),
      });

      const response = await fetch(`${endpoint}?${searchParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch');
      }

      return response.json();
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.data.pagination.hasMore
        ? lastPage.data.pagination.nextCursor
        : undefined,
    enabled,
  });
}
```

### useInfiniteQuery Hook Example

```typescript
// components/project-list.tsx
import { usePaginatedQuery } from '@/hooks/use-paginated-query';
import { useInView } from 'react-intersection-observer';
import { useEffect } from 'react';

interface Project {
  id: string;
  name: string;
  path: string;
  updatedAt: string;
}

export function ProjectList() {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = usePaginatedQuery<Project>({
    queryKey: ['projects'],
    endpoint: '/api/projects',
    params: { sort: 'updatedAt', order: 'desc' },
    limit: 20,
  });

  // Intersection observer for infinite scroll
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '100px', // Trigger before reaching end
  });

  // Auto-load more when sentinel comes into view
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return <ProjectListSkeleton />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  // Flatten pages into single array
  const projects = data?.pages.flatMap(page => page.data.items) ?? [];
  const totalCount = data?.pages[0]?.data.pagination.totalCount;

  return (
    <div className="space-y-4">
      <header className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Projects</h2>
        {totalCount !== undefined && (
          <span className="text-sm text-muted-foreground">
            {totalCount} total
          </span>
        )}
      </header>

      <div className="grid gap-4">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      {/* Load more sentinel */}
      <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
        {isFetchingNextPage && <Spinner />}
        {!hasNextPage && projects.length > 0 && (
          <span className="text-sm text-muted-foreground">
            No more projects
          </span>
        )}
      </div>
    </div>
  );
}
```

### Intersection Observer for Auto-Load

```typescript
// hooks/use-infinite-scroll.ts
import { useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Whether currently loading */
  isLoading: boolean;
  /** Function to load more items */
  onLoadMore: () => void;
  /** Root margin for early trigger */
  rootMargin?: string;
  /** Threshold for intersection */
  threshold?: number;
}

export function useInfiniteScroll({
  hasMore,
  isLoading,
  onLoadMore,
  rootMargin = '200px',
  threshold = 0,
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoading) {
        onLoadMore();
      }
    },
    [hasMore, isLoading, onLoadMore]
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin,
      threshold,
    });

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [handleIntersection, rootMargin, threshold]);

  return sentinelRef;
}

// Usage
function TaskList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    usePaginatedQuery<Task>({ ... });

  const sentinelRef = useInfiniteScroll({
    hasMore: hasNextPage ?? false,
    isLoading: isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  return (
    <div>
      {tasks.map(task => <TaskCard key={task.id} task={task} />)}
      <div ref={sentinelRef} />
    </div>
  );
}
```

---

## Error Responses

### INVALID_CURSOR (400)

Returned when the cursor is malformed, tampered with, or incompatible.

```typescript
{
  ok: false,
  error: {
    code: 'INVALID_CURSOR',
    message: 'Invalid or malformed cursor. Please restart pagination from the beginning.',
    details: {
      reason: 'DECODE_FAILED' | 'VERSION_MISMATCH' | 'SORT_MISMATCH'
    }
  }
}
```

**Causes:**
- Cursor string is not valid Base64
- Cursor JSON structure is invalid
- Cursor version is incompatible
- Cursor sort field doesn't match request
- Cursor was tampered with

**Client handling:**
```typescript
if (error.code === 'INVALID_CURSOR') {
  // Reset pagination and start fresh
  queryClient.resetQueries({ queryKey: ['projects'] });
}
```

### CURSOR_EXPIRED (400)

Optional error for time-limited cursors.

```typescript
{
  ok: false,
  error: {
    code: 'CURSOR_EXPIRED',
    message: 'Cursor has expired. Please restart pagination.',
    details: {
      expiredAt: '2026-01-15T10:00:00Z',
      maxAge: 3600
    }
  }
}
```

**Implementation (optional):**
```typescript
// lib/api/cursor.ts
const CURSOR_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

interface TimestampedCursorPayload extends CursorPayload {
  createdAt: number;
}

export function encodeCursor(payload: Omit<TimestampedCursorPayload, 'version'>): string {
  const fullPayload: TimestampedCursorPayload = {
    ...payload,
    createdAt: Date.now(),
    version: CURSOR_VERSION,
  };
  // ... encode
}

export function decodeCursor(cursor: string): CursorResult<CursorPayload> {
  // ... decode

  // Check expiration
  if (payload.createdAt && Date.now() - payload.createdAt > CURSOR_MAX_AGE_MS) {
    return { ok: false, error: 'CURSOR_EXPIRED' };
  }

  return { ok: true, value: payload };
}
```

---

## Testing

### Unit Tests for Cursor Encoding/Decoding

```typescript
// lib/api/__tests__/cursor.test.ts
import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor, createCursor } from '../cursor';

describe('cursor encoding', () => {
  it('should encode and decode a cursor correctly', () => {
    const payload = {
      id: 'clx1234567890',
      sortValue: '2026-01-15T10:00:00Z',
      sortField: 'createdAt',
      order: 'desc' as const,
    };

    const encoded = encodeCursor(payload);
    const decoded = decodeCursor(encoded);

    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value.id).toBe(payload.id);
      expect(decoded.value.sortValue).toBe(payload.sortValue);
      expect(decoded.value.sortField).toBe(payload.sortField);
      expect(decoded.value.order).toBe(payload.order);
    }
  });

  it('should produce URL-safe Base64', () => {
    const cursor = encodeCursor({
      id: 'test',
      sortValue: 'value with special chars: +/=',
      sortField: 'field',
      order: 'asc',
    });

    expect(cursor).not.toMatch(/[+/=]/);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('should handle null sort values', () => {
    const payload = {
      id: 'clx123',
      sortValue: null,
      sortField: 'deletedAt',
      order: 'asc' as const,
    };

    const encoded = encodeCursor(payload);
    const decoded = decodeCursor(encoded);

    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value.sortValue).toBe(null);
    }
  });

  it('should handle numeric sort values', () => {
    const payload = {
      id: 'clx123',
      sortValue: 42,
      sortField: 'position',
      order: 'asc' as const,
    };

    const encoded = encodeCursor(payload);
    const decoded = decodeCursor(encoded);

    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value.sortValue).toBe(42);
    }
  });

  it('should reject invalid cursor strings', () => {
    expect(decodeCursor('not-valid-base64!')).toEqual({
      ok: false,
      error: 'INVALID_CURSOR',
    });

    expect(decodeCursor('')).toEqual({
      ok: false,
      error: 'INVALID_CURSOR',
    });

    // Valid Base64 but invalid JSON
    expect(decodeCursor(btoa('not json'))).toEqual({
      ok: false,
      error: 'INVALID_CURSOR',
    });

    // Valid JSON but wrong schema
    expect(decodeCursor(btoa('{"foo":"bar"}'))).toEqual({
      ok: false,
      error: 'INVALID_CURSOR',
    });
  });

  it('should reject future version cursors', () => {
    const futureVersionCursor = btoa(JSON.stringify({
      id: 'clx123',
      sortValue: 'test',
      sortField: 'createdAt',
      order: 'desc',
      version: 999,
    }));

    expect(decodeCursor(futureVersionCursor)).toEqual({
      ok: false,
      error: 'INVALID_CURSOR',
    });
  });
});

describe('createCursor', () => {
  it('should create cursor from item', () => {
    const item = {
      id: 'clx123',
      createdAt: new Date('2026-01-15T10:00:00Z'),
      name: 'Test',
    };

    const cursor = createCursor(item, 'createdAt', 'desc');
    const decoded = decodeCursor(cursor);

    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value.id).toBe('clx123');
      expect(decoded.value.sortValue).toBe('2026-01-15T10:00:00.000Z');
      expect(decoded.value.sortField).toBe('createdAt');
    }
  });
});
```

### Integration Tests for Pagination Flow

```typescript
// lib/services/__tests__/pagination-query.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { paginatedQuery } from '../pagination-query';
import { decodeCursor } from '@/lib/api/cursor';

describe('paginatedQuery', () => {
  beforeEach(async () => {
    // Seed test data
    await db.delete(projects);
    await db.insert(projects).values(
      Array.from({ length: 25 }, (_, i) => ({
        id: `proj_${String(i).padStart(3, '0')}`,
        name: `Project ${i}`,
        path: `/projects/${i}`,
        updatedAt: new Date(Date.now() - i * 86400000), // Each day older
      }))
    );
  });

  it('should return first page with correct pagination', async () => {
    const result = await paginatedQuery({
      table: projects,
      sortColumn: projects.updatedAt,
      idColumn: projects.id,
      order: 'desc',
      limit: 10,
    });

    expect(result.items).toHaveLength(10);
    expect(result.pagination.hasMore).toBe(true);
    expect(result.pagination.nextCursor).not.toBeNull();
    expect(result.pagination.prevCursor).toBeNull();

    // First item should be most recently updated
    expect(result.items[0].id).toBe('proj_000');
  });

  it('should return second page using cursor', async () => {
    const firstPage = await paginatedQuery({
      table: projects,
      sortColumn: projects.updatedAt,
      idColumn: projects.id,
      order: 'desc',
      limit: 10,
    });

    const secondPage = await paginatedQuery({
      table: projects,
      sortColumn: projects.updatedAt,
      idColumn: projects.id,
      order: 'desc',
      limit: 10,
      cursor: firstPage.pagination.nextCursor!,
    });

    expect(secondPage.items).toHaveLength(10);
    expect(secondPage.pagination.hasMore).toBe(true);
    expect(secondPage.pagination.prevCursor).not.toBeNull();

    // First item of second page should follow last item of first page
    expect(secondPage.items[0].id).toBe('proj_010');
  });

  it('should return last page correctly', async () => {
    // Fetch all pages
    let cursor: string | undefined;
    let pages: typeof result[] = [];
    let result;

    do {
      result = await paginatedQuery({
        table: projects,
        sortColumn: projects.updatedAt,
        idColumn: projects.id,
        order: 'desc',
        limit: 10,
        cursor,
      });
      pages.push(result);
      cursor = result.pagination.nextCursor ?? undefined;
    } while (result.pagination.hasMore);

    expect(pages).toHaveLength(3);
    expect(pages[2].items).toHaveLength(5);
    expect(pages[2].pagination.hasMore).toBe(false);
    expect(pages[2].pagination.nextCursor).toBeNull();
  });

  it('should include total count when requested', async () => {
    const result = await paginatedQuery({
      table: projects,
      sortColumn: projects.updatedAt,
      idColumn: projects.id,
      order: 'desc',
      limit: 10,
      includeTotalCount: true,
    });

    expect(result.pagination.totalCount).toBe(25);
  });

  it('should handle ascending order', async () => {
    const result = await paginatedQuery({
      table: projects,
      sortColumn: projects.updatedAt,
      idColumn: projects.id,
      order: 'asc',
      limit: 10,
    });

    // First item should be oldest
    expect(result.items[0].id).toBe('proj_024');
  });

  it('should apply where clause', async () => {
    // Add some projects with specific names
    await db.insert(projects).values([
      { id: 'special_1', name: 'Special Project', path: '/special/1', updatedAt: new Date() },
      { id: 'special_2', name: 'Another Special', path: '/special/2', updatedAt: new Date() },
    ]);

    const result = await paginatedQuery({
      table: projects,
      sortColumn: projects.updatedAt,
      idColumn: projects.id,
      order: 'desc',
      limit: 10,
      where: ilike(projects.name, '%special%'),
    });

    expect(result.items).toHaveLength(2);
    expect(result.items.every(p => p.name.toLowerCase().includes('special'))).toBe(true);
  });
});
```

### Edge Case Coverage

```typescript
// lib/services/__tests__/pagination-edge-cases.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { paginatedQuery } from '../pagination-query';
import { encodeCursor } from '@/lib/api/cursor';

describe('pagination edge cases', () => {
  beforeEach(async () => {
    await db.delete(projects);
  });

  it('should handle empty results', async () => {
    const result = await paginatedQuery({
      table: projects,
      sortColumn: projects.updatedAt,
      idColumn: projects.id,
      order: 'desc',
      limit: 10,
    });

    expect(result.items).toHaveLength(0);
    expect(result.pagination).toEqual({
      nextCursor: null,
      prevCursor: null,
      hasMore: false,
    });
  });

  it('should handle single item', async () => {
    await db.insert(projects).values({
      id: 'only_one',
      name: 'Only Project',
      path: '/only',
      updatedAt: new Date(),
    });

    const result = await paginatedQuery({
      table: projects,
      sortColumn: projects.updatedAt,
      idColumn: projects.id,
      order: 'desc',
      limit: 10,
    });

    expect(result.items).toHaveLength(1);
    expect(result.pagination.hasMore).toBe(false);
    expect(result.pagination.nextCursor).toBeNull();
  });

  it('should handle deleted cursor item gracefully', async () => {
    // Create items
    await db.insert(projects).values([
      { id: 'proj_1', name: 'Project 1', path: '/p1', updatedAt: new Date('2026-01-03') },
      { id: 'proj_2', name: 'Project 2', path: '/p2', updatedAt: new Date('2026-01-02') },
      { id: 'proj_3', name: 'Project 3', path: '/p3', updatedAt: new Date('2026-01-01') },
    ]);

    // Get first page
    const firstPage = await paginatedQuery({
      table: projects,
      sortColumn: projects.updatedAt,
      idColumn: projects.id,
      order: 'desc',
      limit: 1,
    });

    // Delete the item the cursor points to
    await db.delete(projects).where(eq(projects.id, 'proj_1'));

    // Fetching next page should still work
    const secondPage = await paginatedQuery({
      table: projects,
      sortColumn: projects.updatedAt,
      idColumn: projects.id,
      order: 'desc',
      limit: 1,
      cursor: firstPage.pagination.nextCursor!,
    });

    // Should get remaining items
    expect(secondPage.items.length).toBeGreaterThan(0);
  });

  it('should reject cursor with wrong sort field', async () => {
    const wrongCursor = encodeCursor({
      id: 'proj_1',
      sortValue: '2026-01-01',
      sortField: 'createdAt', // Wrong field
      order: 'desc',
    });

    await expect(
      paginatedQuery({
        table: projects,
        sortColumn: projects.updatedAt, // Expecting updatedAt
        idColumn: projects.id,
        order: 'desc',
        limit: 10,
        cursor: wrongCursor,
      })
    ).rejects.toThrow('INVALID_CURSOR');
  });

  it('should maintain stable ordering with duplicate sort values', async () => {
    const sameTime = new Date('2026-01-15T10:00:00Z');

    await db.insert(projects).values([
      { id: 'aaa', name: 'Project A', path: '/a', updatedAt: sameTime },
      { id: 'bbb', name: 'Project B', path: '/b', updatedAt: sameTime },
      { id: 'ccc', name: 'Project C', path: '/c', updatedAt: sameTime },
    ]);

    const firstPage = await paginatedQuery({
      table: projects,
      sortColumn: projects.updatedAt,
      idColumn: projects.id,
      order: 'desc',
      limit: 1,
    });

    const secondPage = await paginatedQuery({
      table: projects,
      sortColumn: projects.updatedAt,
      idColumn: projects.id,
      order: 'desc',
      limit: 1,
      cursor: firstPage.pagination.nextCursor!,
    });

    // Items should be different (ordered by ID as tiebreaker)
    expect(firstPage.items[0].id).not.toBe(secondPage.items[0].id);

    // Should see all items across pages
    const allIds = [firstPage.items[0].id, secondPage.items[0].id];
    expect(new Set(allIds).size).toBe(2);
  });

  it('should handle concurrent insertions', async () => {
    await db.insert(projects).values([
      { id: 'proj_1', name: 'Project 1', path: '/p1', updatedAt: new Date('2026-01-01') },
      { id: 'proj_2', name: 'Project 2', path: '/p2', updatedAt: new Date('2026-01-02') },
    ]);

    // Get first page
    const firstPage = await paginatedQuery({
      table: projects,
      sortColumn: projects.updatedAt,
      idColumn: projects.id,
      order: 'desc',
      limit: 1,
    });

    // Insert new item that would appear before cursor
    await db.insert(projects).values({
      id: 'proj_new',
      name: 'New Project',
      path: '/new',
      updatedAt: new Date('2026-01-03'),
    });

    // Second page should NOT include the new item (consistent cursor)
    const secondPage = await paginatedQuery({
      table: projects,
      sortColumn: projects.updatedAt,
      idColumn: projects.id,
      order: 'desc',
      limit: 1,
      cursor: firstPage.pagination.nextCursor!,
    });

    expect(secondPage.items[0].id).toBe('proj_1');
  });
});
```

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [API Endpoints](/specs/api/endpoints.md) | Endpoint definitions using pagination |
| [Database Schema](/specs/database/schema.md) | Table structures and indexes |
| [Error Catalog](/specs/errors/error-catalog.md) | Error code definitions |
| [AGENTS.md](/AGENTS.md) | TanStack Query patterns |
