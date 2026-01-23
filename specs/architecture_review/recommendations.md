# Recommendations

## Prioritized Action Items

### Phase 1: High Impact, Low Effort

| # | Task | Files | LOC Reduction | Effort |
|---|------|-------|---------------|--------|
| 1 | Delete duplicate `-api/` route directory | `/src/app/routes/-api/` | -800 | 15 min |
| 2 | Create API handler wrapper utility | `/src/server/api-handlers.ts` | -1,250 | 2 hours |
| 3 | Replace cn.ts with clsx | `/src/lib/utils/cn.ts` | -26 | 5 min |
| 4 | Consolidate duplicate github-token.service.ts | `/src/server/github-token.service.ts` | -470 | 30 min |
| 5 | Consolidate apiFetch/apiServerFetch | `/src/lib/api/client.ts` | -50 | 30 min |

**Phase 1 Total**: ~2,600 LOC reduction, ~4 hours effort

---

### Phase 2: Medium Impact, Medium Effort

| # | Task | Files | LOC Reduction | Effort |
|---|------|-------|---------------|--------|
| 6 | Split new-project-dialog into components | `/src/app/components/features/new-project-dialog.tsx` | -400 | 3 hours |
| 7 | Centralize error definitions | `/src/lib/errors/` (14 files) | -990 | 4 hours |
| 8 | Extract generic merge from template-merge.ts | `/src/lib/config/template-merge.ts` | -80 | 1 hour |
| 9 | Simplify ProjectContext memoization | `/src/app/providers/project-context.tsx` | -100 | 2 hours |
| 10 | Replace task-detail-dialog useReducer | `/src/app/components/features/task-detail-dialog/index.tsx` | -25 | 30 min |

**Phase 2 Total**: ~1,600 LOC reduction, ~10 hours effort

---

### Phase 3: Lower Priority

| # | Task | Files | LOC Reduction | Effort |
|---|------|-------|---------------|--------|
| 11 | Simplify Vite stub plugin | `/vite.config.ts` | -250 | 3 hours |
| 12 | Consolidate dual component implementations | Multiple feature directories | -300 | 4 hours |
| 13 | Split SessionService into focused services | `/src/services/session.service.ts` | -200 | 4 hours |
| 14 | Extract hooks/queue/streaming from AgentService | `/src/services/agent.service.ts` | -150 | 3 hours |
| 15 | Simplify deep-merge.ts | `/src/lib/utils/deep-merge.ts` | -50 | 1 hour |

**Phase 3 Total**: ~950 LOC reduction, ~15 hours effort

---

## Total Impact

| Phase | LOC Reduction | Effort |
|-------|---------------|--------|
| Phase 1 | ~2,600 | 4 hours |
| Phase 2 | ~1,600 | 10 hours |
| Phase 3 | ~950 | 15 hours |
| **Total** | **~5,150** | **29 hours** |

---

## Implementation Details

### 1. Delete Duplicate Route Directory

```bash
rm -rf src/app/routes/-api/
```

Verify no imports reference this path. Update any barrel exports.

---

### 2. API Handler Wrapper Utility

**Create**: `/src/server/utils/api-response.ts`

```typescript
import type { Result } from '@/lib/utils/result';
import type { AppError } from '@/lib/errors/base';

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; status: number } };

export function toApiResponse<T>(result: Result<T, AppError>): ApiResponse<T> {
  if (result.ok) {
    return { ok: true, data: result.value };
  }
  return {
    ok: false,
    error: {
      code: result.error.code,
      message: result.error.message,
      status: result.error.status,
    },
  };
}
```

**Refactor handlers from**:
```typescript
export async function getProject(ctx: ApiContext, id: string): Promise<ApiResponse<Project>> {
  try {
    const result = await ctx.services.project.getById(id);
    if (!result.ok) {
      return {
        ok: false,
        error: { code: result.error.code, message: result.error.message, status: result.error.status },
      };
    }
    return { ok: true, data: result.value };
  } catch (error) {
    // error handling
  }
}
```

**To**:
```typescript
export async function getProject(ctx: ApiContext, id: string): Promise<ApiResponse<Project>> {
  const result = await ctx.services.project.getById(id);
  return toApiResponse(result);
}
```

---

### 3. Replace cn.ts with clsx

```bash
npm install clsx
```

**Update** `/src/lib/utils/cn.ts`:
```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

### 6. Split new-project-dialog

**Create directory structure**:
```
src/app/components/features/new-project-dialog/
├── index.tsx              # Main orchestrator (~200 lines)
├── repo-info-card.tsx     # Repository info display
├── recent-repo-list.tsx   # Recently used repos
├── skill-card.tsx         # Skill selection
├── github-repo-list.tsx   # GitHub repo browser
├── divider.tsx            # Section divider
└── hooks/
    ├── use-repo-validation.ts
    ├── use-github-repos.ts
    └── use-project-form.ts
```

---

### 7. Centralize Error Definitions

**Create**: `/src/lib/errors/error-codes.ts`

```typescript
export const ErrorCodes = {
  // Agent errors
  AGENT_NOT_FOUND: { code: 'AGENT_NOT_FOUND', message: 'Agent not found', status: 404 },
  AGENT_ALREADY_RUNNING: { code: 'AGENT_ALREADY_RUNNING', message: 'Agent already running', status: 409 },

  // Task errors
  TASK_NOT_FOUND: { code: 'TASK_NOT_FOUND', message: 'Task not found', status: 404 },
  TASK_INVALID_STATUS: { code: 'TASK_INVALID_STATUS', message: 'Invalid task status', status: 400 },

  // Session errors
  SESSION_NOT_FOUND: { code: 'SESSION_NOT_FOUND', message: 'Session not found', status: 404 },
  SESSION_CLOSED: { code: 'SESSION_CLOSED', message: 'Session is closed', status: 400 },

  // ... all other errors
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

export function createAppError(code: ErrorCode, overrides?: Partial<AppError>): AppError {
  const base = ErrorCodes[code];
  return { ...base, ...overrides };
}
```

---

## Verification Checklist

After each phase, verify:

- [ ] All tests pass (`npm test`)
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] Dev server starts (`npm run dev`)
- [ ] No console errors in browser
- [ ] API endpoints respond correctly
- [ ] UI interactions work as expected

---

## Files Modified Per Phase

### Phase 1
- DELETE: `/src/app/routes/-api/` (entire directory)
- MODIFY: `/src/server/api-handlers.ts`
- CREATE: `/src/server/utils/api-response.ts`
- MODIFY: `/src/lib/utils/cn.ts`
- DELETE: `/src/server/github-token.service.ts`
- MODIFY: `/src/lib/api/client.ts`

### Phase 2
- CREATE: `/src/app/components/features/new-project-dialog/` (directory)
- DELETE: `/src/app/components/features/new-project-dialog.tsx` (old file)
- CREATE: `/src/lib/errors/error-codes.ts`
- DELETE: `/src/lib/errors/agent-errors.ts` (and 13 others)
- MODIFY: `/src/lib/config/template-merge.ts`
- MODIFY: `/src/app/providers/project-context.tsx`
- MODIFY: `/src/app/components/features/task-detail-dialog/index.tsx`

### Phase 3
- MODIFY: `/vite.config.ts`
- MODIFY: Multiple feature directories (consolidation)
- MODIFY: `/src/services/session.service.ts`
- MODIFY: `/src/services/agent.service.ts`
- MODIFY: `/src/lib/utils/deep-merge.ts`
