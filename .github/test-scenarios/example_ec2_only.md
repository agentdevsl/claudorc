# Example: A public EC2 Instance

**IMPORTANT**: Do not prompt me - make best practice decisions independently

Using the **github-speckit-tester** skill non-interactively.

## Infrastructure Requirements

Provision using Terraform:

- A single EC2 instance accessible via SSH
- SSH server should be configured to allow access using username/password.
- No SSH private/public key access is required.
- AWS Region: `ap-southeast-1`
- Use existing default VPC
- enviromnment development minimal cost

## HCP Terraform Configuration

- **Organization**: `ravi-panchal-org`
- **Project**: `Default Project`
- **Workspace**: `sandbox_ec2<GITHUB_REPO_NAME>`

## Workflow Instructions

- Always create a new branch
- Follow best practice
- Use subagents to make best practice decisions if you need clarity
- Don't prompt the user - make decisions yourself
- If you hit issues, resolve them without prompting
