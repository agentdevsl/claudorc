# Full Implementation Review Prompt

## Objective

Perform a comprehensive implementation review to confirm that all specifications are fully implemented, the UI is complete, and the application is tested and ready for release.

## Scope

- `@spec/application`
- All subfolders under `@spec/application/**`

These specifications are the **single source of truth** for requirements.  
Review the entire codebase, including UI, business logic, tests, configuration, and build tooling.

## Instructions

### 1. Specification Coverage

- Enumerate all functional and non-functional requirements defined in `@spec/application/**`
- For each requirement:
  - Identify the exact file(s), module(s), or component(s) that implement it
  - Assign one of the following statuses:
    - ✅ Implemented
    - ⚠️ Partially implemented
    - ❌ Missing
- Explicitly call out:
  - Ambiguous requirements
  - Implicit assumptions
  - Spec items with no clear implementation mapping

### 2. UI Completeness

- Verify that all UI elements described in the specifications exist and are wired correctly
- Validate:
  - Loading, error, empty, and success states
  - Navigation flows and user journeys
  - Accessibility (keyboard navigation, ARIA attributes where applicable)
  - Visual and structural completeness (no placeholders or dead ends)
- Identify any missing screens, broken flows, or incomplete UI states

### 3. Behavior & Integration

- Confirm end-to-end wiring:
  - UI → state management → services / APIs
- Verify:
  - Error handling paths
  - Edge cases explicitly mentioned in the specs
  - Configuration, feature flags, and environment-specific behavior
- Identify any mocked, stubbed, or bypassed logic that should be production-ready

### 4. Testing Validation

- Inventory existing tests:
  - Unit
  - Integration
  - UI / component
  - End-to-end
- Map tests back to specification requirements where possible
- Identify:
  - Untested critical paths
  - Missing negative or failure-mode tests
  - Superficial or low-signal tests
- Assess whether the current test coverage provides sufficient release confidence

### 5. Quality & Readiness Checks

- Identify:
  - TODOs, FIXMEs, stubs, or commented-out code
  - Dead code or unused components
  - Security, performance, or stability red flags
- Verify:
  - Build, lint, and test workflows exist and are coherent
  - No obvious release blockers remain

## Output Format

Produce the review using the following structure:

## Executive Summary

- Overall readiness: Ready / Not Ready
- Blocking issues (if any)

## Specification Coverage Matrix

| Spec Item | Implementation Location | Status | Notes |

## UI Review

- Completed items
- Gaps and missing flows
- Accessibility findings

## Testing Review

- Existing coverage
- Coverage gaps
- Risk assessment

## Issues & Recommendations

- Must fix before release
- Should fix
