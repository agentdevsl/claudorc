# Architecture Simplification Review

> **Status**: Analysis Complete
> **Date**: 2026-01-24
> **Purpose**: Document opportunities to reduce code complexity while maintaining 100% functionality

## Executive Summary

This review identifies **~5,500-6,500 lines of code** that can be eliminated through simplification, consolidation, and removal of redundant abstractions. The codebase has grown organically with several areas of duplication and over-engineering that can be addressed without changing functionality.

### Key Findings

| Area | Current LOC | Potential Reduction | Priority |
|------|-------------|---------------------|----------|
| API Handlers | 1,676 | -75% (~1,250) | High |
| Duplicate Routes | ~800 | -100% | High |
| Giant Components | 3,200+ | -40% (~1,280) | Medium |
| Error Handling | 1,418 | -70% (~990) | Medium |
| Vite Config Stubs | 330 | -75% (~250) | Low |
| Service Layer | 7,310 | -20% (~1,460) | Medium |

---

## Detailed Analysis

### 1. Backend Architecture

See: [backend-analysis.md](./backend-analysis.md)

**Critical Issues:**
- API handlers with repetitive error wrapping patterns
- Duplicate route sets (`-api/` and `api/`)
- Monolithic services mixing multiple concerns
- Fragmented error definitions across 14+ files

### 2. Frontend Architecture

See: [frontend-analysis.md](./frontend-analysis.md)

**Critical Issues:**
- Giant monolithic dialog components (1,000+ lines each)
- Over-engineered state management with excessive memoization
- Dual component implementations (flat files + directory modules)
- Unnecessary abstraction layers in service context

### 3. Shared Infrastructure

See: [infrastructure-analysis.md](./infrastructure-analysis.md)

**Critical Issues:**
- Custom utilities duplicating npm package functionality
- Overly complex Vite stub plugin (330 lines)
- Scattered type definitions across multiple locations
- Test infrastructure with manual cleanup patterns

---

## Document Index

1. [Backend Analysis](./backend-analysis.md) - Services, API, State Machines, Database
2. [Frontend Analysis](./frontend-analysis.md) - Components, State, Routes, UI
3. [Infrastructure Analysis](./infrastructure-analysis.md) - Utils, Config, Build, Testing
4. [Recommendations](./recommendations.md) - Prioritized action items

---

## Quick Reference: Files to Review

### Highest Impact (Backend)
- `/src/server/api-handlers.ts` (1,676 LOC) - Repetitive error wrapping
- `/src/app/routes/-api/` (entire directory) - Duplicate routes to remove
- `/src/services/session.service.ts` (705 LOC) - Multiple concerns
- `/src/services/plan-mode.service.ts` (682 LOC) - Mixed responsibilities

### Highest Impact (Frontend)
- `/src/app/components/features/new-project-dialog.tsx` (1,361 LOC) - Monolithic
- `/src/app/components/features/new-task-dialog.tsx` (1,137 LOC) - Monolithic
- `/src/app/providers/project-context.tsx` (224 LOC) - Over-memoized
- `/src/app/components/features/error-state.tsx` (550 LOC) - Complex variants

### Highest Impact (Infrastructure)
- `/vite.config.ts` (394 LOC) - 330 lines of stubs
- `/src/lib/errors/` (14 files) - Fragmented error definitions
- `/src/lib/api/client.ts` (945 LOC) - Duplicate fetch functions
