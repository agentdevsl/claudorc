# Frontend Architecture Analysis

## 1. Giant Monolithic Components - Critical Issue

### Problem: 1,000+ Line Dialog Components

| Component | LOC | Embedded Sub-components |
|-----------|-----|------------------------|
| `new-project-dialog.tsx` | 1,361 | RepoInfoCard, RecentRepoList, SkillCard, Divider, GitHubRepoList (9 total) |
| `new-task-dialog.tsx` | 1,137 | Multiple form sections, validation logic |
| `add-template-dialog.tsx` | 738 | Template selection, preview |
| `error-state.tsx` | 550 | 10+ variant-specific renders |
| `sidebar.tsx` | 457 | Navigation, project list, actions |

### Current Structure (Problem)

```
new-project-dialog.tsx (1,361 lines)
├── RepoInfoCard (inline sub-component, ~40 lines)
├── RecentRepoList (inline sub-component, ~60 lines)
├── SkillCard (inline sub-component, ~30 lines)
├── GitHubRepoList (inline sub-component, ~150 lines)
└── Multiple useEffect hooks with complex state
```

### Recommended Structure

```
new-project-dialog/
├── index.tsx (orchestrator, ~200 lines)
├── repo-info-card.tsx (~50 lines)
├── recent-repo-list.tsx (~70 lines)
├── skill-card.tsx (~35 lines)
├── github-repo-list.tsx (~100 lines)
└── hooks/
    ├── use-repo-validation.ts
    ├── use-github-repos.ts
    └── use-skill-config.ts
```

**Impact**: -40% code per component, improved testability

---

## 2. Dual Component Implementations - Consolidation Needed

### Problem: Flat Files + Directory Modules Coexist

Several features have parallel implementations:

| Feature | Flat File | Directory Module |
|---------|-----------|------------------|
| Kanban Board | `kanban-board.tsx` (256 lines) | `kanban-board/` (9 files, 32KB) |
| Agent Session View | `agent-session-view.tsx` | `agent-session-view/` (8 files) |
| Task Detail Dialog | `task-detail-dialog.tsx` | `task-detail-dialog/` (7 files) |

### Recommendation

Remove flat file versions where directory-based implementations exist. Update barrel exports in `features/index.ts`.

---

## 3. Over-Engineered State Management

### ProjectContext - Excessive Memoization

**File**: `/src/app/providers/project-context.tsx` (224 lines)

**Issues**:
- Lines 78-80: Three separate state variables for loading/error (should be single state machine)
- Lines 115-142: Complex memoization chains (allProjects → recentProjects → derived from summaries)
- Lines 171-204: Massive useMemo dependencies array (13 items) - performance anti-pattern
- Mixing data fetching logic with UI state (picker modals, navigation)

```typescript
// Current: 13 dependencies in useMemo
const contextValue = useMemo(() => ({
  // ...many derived values
}), [
  currentProject, allProjects, recentProjects, isLoading, error,
  summaries, navigateToProject, setCurrentProject, togglePicker,
  refreshProjects, createNewProject, updateProject, deleteProject
]);
```

**Recommendation**:
```typescript
// Separate concerns:
// 1. Data fetching → single hook or TanStack Query
// 2. UI state (picker/dialog) → local state
// 3. Navigation → router-based state
```

**Impact**: ~120 lines instead of 224, clearer data flow

---

### use-board-state.ts - Nested Memoization

**File**: `/src/app/components/features/kanban-board/use-board-state.ts` (157 lines)

**Issues**:
- Lines 125-153: Wrapping already-memoized values in useMemo again
- Lines 130-153: 9-item dependency array (over-engineered)
- Pattern: `selectCard` wrapped, then `toggleSelection` aliased to `selectCard`

**Recommendation**: Remove redundant memoization layers

---

### task-detail-dialog - Unnecessary useReducer

**File**: `/src/app/components/features/task-detail-dialog/index.tsx` (341 lines)

**Issue**: useReducer for 4 simple boolean state flags

```typescript
// Current: Complex reducer for simple state
const [state, dispatch] = useReducer(dialogReducer, initialState);

// Should be:
const [isEditing, setIsEditing] = useState(false);
const [editingSection, setEditingSection] = useState<EditSection | null>(null);
const [isSaving, setIsSaving] = useState(false);
const [activeTab, setActiveTab] = useState<ActivityTab>('timeline');
```

**Impact**: -25 lines, improved readability

---

## 4. Prop Drilling Issues

### LayoutShell → Sidebar

**File**: `/src/app/components/features/layout-shell.tsx` (76 lines)

```typescript
// Current: 3 separate props for one entity
<Sidebar
  projectId={projectId}
  projectName={projectName}
  projectPath={projectPath}
/>

// Sidebar then uses useProjectContext() anyway (line 62)
```

**Recommendation**:
```typescript
// Just pass project ID or use context directly
<Sidebar projectId={projectId} />
// OR
<Sidebar /> // Gets everything from useProjectContext()
```

---

## 5. Service Layer Client/Server Confusion

**Files**:
- `/src/app/services/services.ts` (133 lines)
- `/src/app/services/service-context.tsx` (26 lines)

**Issue**: Services object passed via context but only used on server. Client components bypass entirely:

```typescript
// Current: Dual mode (server + client nulls)
export const useServices = (): Services | null => {
  return useContext(ServiceContext);  // Always null on client
};

// Client-side components use apiClient directly anyway
```

**Recommendation**:
```typescript
// Client-only hook for API - no context needed
export const useApi = () => apiClient;
```

---

## 6. UI Components - Well Structured

**Files**: `/src/app/components/ui/` (13 components)

Components: Button, Dialog, Checkbox, Select, Tabs, Textarea, TextInput, Tooltip, Toast, Skeleton, Dropdown

**Status**: Well-designed with CVA patterns. No changes needed.

```typescript
// Good pattern in use
const buttonVariants = cva('base classes', {
  variants: { variant: {...}, size: {...} }
});

export const Button = forwardRef(({ className, variant, size, ...props }) => (
  <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
```

---

## 7. Shortcuts System - Over-Engineered

**Files**:
- `/src/app/providers/shortcuts-provider.tsx` (120+ lines)
- `/src/app/hooks/use-keyboard-shortcuts.ts`

**Issues**:
- useRef + Map for shortcut registry
- Complex registration/unregistration API
- Memoized context values with large dependency arrays

**Recommendation**: Simple hook for global shortcuts, no context needed for most cases

---

## 8. Session Hook - Duplicate HTTP Calls

**File**: `/src/app/hooks/use-session.ts` (217 lines)

**Issues**:
- Lines 178-179: EventSource subscription manages stream state
- Lines 196-212: Separate setInterval for presence updates (15 second heartbeat)
- Lines 140-175: Two separate fetch calls for join/leave (duplicated logic)

**Recommendation**: Single session manager with AbortController cleanup

---

## Summary: Frontend Simplification Priorities

### Phase 1 (High Impact)
1. ✅ Split new-project-dialog into smaller components (-400 lines)
2. ✅ Simplify ProjectContext memoization (-100 lines)
3. ✅ Replace task-detail-dialog useReducer with useState (-25 lines)

### Phase 2 (Medium Impact)
4. Consolidate dual component implementations
5. Simplify use-board-state hook (remove nested memoization)
6. Extract sub-components from monoliths (error-state, sidebar)

### Phase 3 (Low Priority)
7. Remove unused service abstractions on client side
8. Standardize shortcuts to simpler hook-based approach
9. Audit dependency array sizes across hooks

---

## Code Statistics

| Metric | Value |
|--------|-------|
| Total frontend files | 150 components |
| Largest component | new-project-dialog.tsx (1,361 lines) |
| Total feature code | ~25,700 lines |
| Hook usage | 392 hook calls |
| State approaches | 3 (context, hooks, services) |
| Feature directories | 22 with nested structure |
| Route files | 30 |
