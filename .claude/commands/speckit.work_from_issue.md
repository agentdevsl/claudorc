## User Input

```text
$ARGUMENTS
```

## Outline

work on $ARGUMENT autonomously
when performing UI design use the frontend-design skill

Workflow - autonomously complete the tasks,

0. first confirm the gh issue is valid, when you start mark the issue to in-progress using the label in-progress, update the github issue with comments when you start and finish each speckit stage with a short summary
1. `/speckit.specify_parent` - Create feature specification from natural language and continue to next stage
2. commit and update Git issue
3. `/speckit.plan` - Generate implementation plan with design artifacts
4. commit and update Git issue and continue to next stage
5. `/speckit.tasks` - Generate actionable task list
6. commit and update Git issue and continue to next stage
7. `/speckit.analyze` - Analyze spec for TDD compliance
8. commit and update Git issue and continue to next stage
9. `/speckit.implement` - Execute all tasks to implement the feature, use tdd, resolve issues independently, validate all tests passing, documentation generated. validate linking and fix any linting issues
10. perform and complete code review using concurrent opus agents, resolves issues, repeate 2 times
11. once fully tested ensure full test coverage and tests completed successfully create a Git PR with summary once all successful otherwise work to resolve issues
12. Validate CICD is passing, if not fix issues and update PR created
