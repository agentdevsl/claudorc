# Test Coverage Report

**Generated:** 2026-01-23

## Summary

| Metric | Coverage | Threshold | Status |
|--------|----------|-----------|--------|
| **Statements** | 27.97% | 80% | Below |
| **Branches** | 22.85% | 80% | Below |
| **Functions** | 30.69% | 80% | Below |
| **Lines** | 27.84% | 80% | Below |

## Test Results

| Category | Count |
|----------|-------|
| Test Files Passed | 49 |
| Test Files Failed | 6 |
| Test Files Skipped | 15 |
| Tests Passed | 845 |
| Tests Failed | 33 |
| Tests Skipped | 186 |
| **Total Tests** | **1064** |

## Coverage by Directory

| Directory | Statements | Branches | Functions | Lines |
|-----------|------------|----------|-----------|-------|
| db | 0% | 0% | 0% | 0% |
| db/schema | 58.19% | 100% | 28.16% | 51.88% |
| lib | 66.66% | 37.5% | 100% | 66.66% |
| lib/agents | 0.75% | 0% | 0% | 0.78% |
| lib/agents/hooks | 0% | 0% | 0% | 0% |
| lib/agents/tools | 10.6% | 0% | 0% | 10.76% |
| lib/api | 41.95% | 22.46% | 17.77% | 46.21% |
| lib/bootstrap | 93.22% | 88.88% | 87.5% | 92.85% |
| lib/bootstrap/phases | 51.21% | 40% | 75% | 51.21% |
| lib/config | 37.11% | 23.8% | 50% | 37.5% |
| lib/crypto | 5.49% | 0% | 0% | 5.61% |
| lib/errors | 60.37% | 25% | 57.64% | 60.37% |
| lib/github | 0.53% | 0% | 0% | 0.55% |
| lib/durable-streams | 100% | 100% | 100% | 100% |
| lib/plan-mode | 3.96% | 0% | 4.54% | 4.13% |
| lib/sandbox | 0% | 0% | 0% | 0% |
| lib/state-machines/agent-lifecycle | 97.22% | 95.23% | 100% | 96.92% |
| lib/state-machines/session-lifecycle | 98.59% | 97.77% | 100% | 98.52% |
| lib/state-machines/task-workflow | 94.91% | 89.65% | 100% | 94.54% |
| lib/state-machines/worktree-lifecycle | 100% | 100% | 100% | 100% |
| lib/streams | 17.46% | 10.71% | 25% | 18.03% |
| lib/utils | 83.56% | 76.92% | 84.21% | 85.07% |
| lib/workflow-dsl | 0% | 0% | 0% | 0% |
| server | 0% | 0% | 0% | 0% |
| services | 44.74% | 43.17% | 45.89% | 44.88% |

## Detailed File Coverage

### Well-Covered Files (>80%)

| File | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| db/schema/enums.ts | 100% | 100% | 100% | 100% |
| db/schema/relations.ts | 100% | 100% | 100% | 100% |
| lib/durable-streams/schema.ts | 100% | 100% | 100% | 100% |
| lib/api/cursor.ts | 100% | 100% | 100% | 100% |
| lib/api/pagination.ts | 100% | 100% | 100% | 100% |
| lib/api/response.ts | 100% | 100% | 100% | 100% |
| lib/bootstrap/hooks.ts | 100% | 100% | 100% | 100% |
| lib/state-machines/worktree-lifecycle/* | 100% | 100% | 100% | 100% |
| lib/utils/cn.ts | 100% | 100% | 100% | 100% |
| lib/utils/result.ts | 100% | 62.5% | 100% | 100% |
| services/task.service.ts | 99% | 96.7% | 100% | 99% |
| services/worktree.service.ts | 98.33% | 85% | 100% | 98.32% |
| lib/state-machines/session-lifecycle/machine.ts | 98.41% | 97.67% | 100% | 98.36% |
| lib/state-machines/agent-lifecycle/machine.ts | 96.15% | 94.44% | 100% | 96.07% |
| lib/api/validation.ts | 94.44% | 83.33% | 100% | 94.11% |
| lib/state-machines/task-workflow/machine.ts | 93.87% | 88% | 100% | 93.75% |
| lib/bootstrap/service.ts | 90% | 83.33% | 83.33% | 89.18% |
| services/task-state-transitions.ts | 90.9% | 25% | 85.71% | 90.9% |
| services/project-config.service.ts | 88.5% | 78.57% | 100% | 93.5% |
| lib/api/schemas.ts | 87.71% | 12.5% | 33.33% | 92.45% |
| lib/utils/deep-merge.ts | 86.84% | 85.29% | 100% | 86.84% |
| lib/api/middleware.ts | 80% | 100% | 66.66% | 80% |

### Needs Improvement (0-50%)

| File | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| server/api.ts | 0% | 0% | 0% | 0% |
| server/crypto.ts | 0% | 0% | 0% | 0% |
| lib/sandbox/* | 0% | 0% | 0% | 0% |
| lib/workflow-dsl/* | 0% | 0% | 0% | 0% |
| lib/github/* | 0-8% | 0% | 0% | 0-8% |
| lib/agents/* | 0-3% | 0% | 0% | 0-3% |
| lib/plan-mode/* | 2-5% | 0% | 0-11% | 2-5% |
| db/client.ts | 0% | 0% | 0% | 0% |
| services/api-key.service.ts | 0% | 0% | 0% | 0% |
| services/sandbox.service.ts | 0% | 0% | 0% | 0% |
| services/marketplace.service.ts | 0% | 0% | 0% | 0% |
| services/claude-node.service.ts | 5.14% | 1.19% | 12.5% | 5.14% |
| services/forms.service.ts | 4.54% | 0% | 3.33% | 4.54% |

## Priority Areas for Improvement

### Critical (0% coverage, core functionality)

1. **server/api.ts** - Main API server (3455 lines uncovered)
2. **lib/sandbox/** - Sandbox providers and management
3. **db/client.ts** - Database client initialization
4. **services/sandbox.service.ts** - Sandbox service layer

### High Priority (Low coverage, important features)

1. **lib/github/** - GitHub integration (0.5% coverage)
2. **lib/agents/** - Agent SDK utilities (0.75% coverage)
3. **lib/plan-mode/** - Plan mode Claude client (4% coverage)
4. **services/claude-node.service.ts** - Claude node service (5% coverage)

### Medium Priority (Partial coverage)

1. **lib/api/client.ts** - API client (8% coverage)
2. **lib/streams/server.ts** - Streams server (9% coverage)
3. **services/project.service.ts** - Project service (33% coverage)
4. **lib/config/** - Configuration management (37% coverage)

## Recommendations

1. **Fix failing tests first** - 33 tests are currently failing, which may be blocking accurate coverage measurement
2. **Add integration tests for server/api.ts** - This is the core API with zero coverage
3. **Mock external dependencies** - GitHub, Claude SDK, and sandbox providers need mocked tests
4. **Increase service layer coverage** - Services are at 44.74% and contain critical business logic
5. **Maintain state machine coverage** - These are well-tested (95-100%) and should stay that way

## Running Coverage

```bash
# Run all tests with coverage
npm run test:coverage

# Run specific test file with coverage
npx vitest run tests/services --coverage

# Generate HTML report
npx vitest run --coverage --coverage.reporter=html
```
