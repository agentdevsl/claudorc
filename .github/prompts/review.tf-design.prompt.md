## User Input

$ARGUMENTS

## Agents to Invoke

1. Evaluate AWS infrastructure for security vulnerabilities, compliance gaps, and misconfigurations. Reviews Terraform/CloudFormation/CDK against AWS Well-Architected Framework with mandatory risk ratings and authoritative citations. Load instructions from #file: github/agents/aws-security-advisor-agent.md to evaluate.

2. Evaluate Terraform code quality with security-first scoring (30% weight) across 6 dimensions. Module-first architecture enforced. Invoked after /speckit.implement for production readiness assessment. Load instructions from #file: github/agents/code-quality-judge-agent.md to evaluate.

After both complete, update plan.md with critical findings. Make a recommendation on next steps, user input will be required.
