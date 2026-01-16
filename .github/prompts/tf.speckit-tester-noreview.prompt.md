---
name: github-speckit-tester-noreview
description: Test harness for executing Speckit workflows non-interactively using subagents. Use when you need to test the complete Speckit pipeline (Phase 0 → Phase 3) or individual phases, validate artifact generation across all commands, automate testing of specification-to-implementation workflows, or verify cross-phase consistency. This skill orchestrates the execution of all Speckit commands in order without user intervention.
---

# GitHub Speckit Tester

A comprehensive test harness for validating the Speckit workflow system by executing all phases non-interactively using subagents. After each phase clear the context using /clear

## Overview

This skill provides automated testing capabilities for the complete Speckit pipeline, executing all commands in sequence from specification to implementation without requiring user interaction.

## Test Scenario

Please read the following file to load the test scenario:
#file: github/test-scenarios/${input:scenario}

## Core Concepts

### Non-Interactive Execution

All Speckit commands must be executed without user intervention:

- Automatic decision-making for clarifications
- Default selections for ambiguous choices
- Automated validation and progression through phases
- Error handling and recovery without user input

### Subagent Orchestration

The test harness uses subagents to:

- Execute each phase independently
- Isolate phase execution for better debugging
- Parallelize independent phases when possible
- Maintain clean execution context per phase

Document start time and end time, totals execution time, and tokens consumed inclusive of all subagents

### Execution Workflow

| Step | Command                            | Description                                                                             | Output                     |
| ---- | ---------------------------------- | --------------------------------------------------------------------------------------- | -------------------------- |
| 1    | Prerequisites                      | Validate environment and credentials by running `.specify/scripts/bash/validate-env.sh` | Validation confirmation    |
| 2    | `/speckit.specify`                 | Create feature specification                                                            | `spec.md`                  |
| 3    | `/speckit.clarify`                 | Resolve ambiguities                                                                     | Updated `spec.md`          |
| 4    | `/speckit.plan`                    | Design technical architecture                                                           | `plan.md`, `data-model.md` |
| 5    | Run `/review.tf-design` prompt     | Review and approve design                                                               | Approval confirmation      |
| 6    | `/speckit.tasks`                   | Generate implementation tasks                                                           | `tasks.md`                 |
| 7    | `/speckit.implement`               | Generate Terraform code and test deployment in sandbox workspace                        | `.tf` files                |
| 8    | Deploy                             | Deploy to HCP Terraform                                                                 | Workspace created          |
| 9    | Run `/report.tf-deployment` prompt | Generate comprehensive deployment report                                                |
| 10   | Cleanup                            | Queue destroy plan                                                                      | Resources cleaned          |
