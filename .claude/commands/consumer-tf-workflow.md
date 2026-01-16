### Execution Workflow

| Step | Command                    | Description                                                                             | Output                               |
| ---- | -------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------ | ----------------- |
| 1    | Prerequisites              | Validate environment and credentials by running `.specify/scripts/bash/validate-env.sh` | Validation confirmation              |
| 2    | `/speckit.specify`         | Create feature specification                                                            | `spec.md`                            |
| 3    | `/speckit.clarify`         | Resolve ambiguities                                                                     | Updated `spec.md`                    |
| 4    | `/speckit.checklist`       | Validate requirements quality                                                           | `checklists/*.md`                    |
| 5    | `/speckit.plan`            | Design technical architecture                                                           | `plan.md`, `data-model.md`           |
| 6    | `/review-tf-design`        | Review and approve design                                                               | Approval confirmation                |
| 7    | `/speckit.tasks`           | Generate implementation tasks                                                           | `tasks.md`                           |
| 8    | `/speckit.analyze`         | Validate consistency                                                                    | Analysis report                      |
| 9    | `/speckit.implement`       | Generate Terraform code and test in sandbox workspace (init, plan only)                 |
| 10   | Deploy to HCP Terraform    | Run `terraform init/plan/apply` via CLI (NOT MCP create_run)                            | Verify successful apply              |
| 11   | `/report-tf-deployment`    | Generate comprehensive deployment report                                                |
| 12   | Ask User before proceeding | Cleanup                                                                                 | Queue destroy plan onyl if confirmed | Resources cleaned |
