# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Note**: This project uses AGENTS.md files for detailed guidance.

## Primary Reference

Please see the root `./AGENTS.md` in this same directory for the main project documentation and guidance.

@/workspace/AGENTS.md

## Additional Component-Specific Guidance

For detailed module-specific implementation guides, also check for AGENTS.md files in subdirectories throughout the project

These component-specific AGENTS.md files contain targeted guidance for working with those particular areas of the codebase.

If you need to ask the user a question use the tool AskUserQuestion this is useful during speckit.clarify

## Updating AGENTS.md Files

When you discover new information that would be helpful for future development work, please:

- **Update existing AGENTS.md files** when you learn implementation details, debugging insights, or architectural patterns specific to that component
- **Create new AGENTS.md files** in relevant directories when working with areas that don't yet have documentation
- **Add valuable insights** such as common pitfalls, debugging techniques, dependency relationships, or implementation patterns

## Important use subagents liberally

When performing any research concurrent subagents can be used for performance and isolation
use parrallel tool calls and tasks where possible

## Use this teck stack

| Layer              | Technology       | Package                                                                                             | Version          |
| ------------------ | ---------------- | --------------------------------------------------------------------------------------------------- | ---------------- |
| Runtime            | Bun              | https://bun.sh                                                                                      | 1.3.6            |
| Framework          | TanStack Start   | @tanstack/react-start (https://github.com/TanStack/router)                                          | 1.150.0          |
| Database           | PGlite           | @electric-sql/pglite (https://github.com/electric-sql/pglite)                                       | 0.3.15           |
| ORM                | Drizzle          | drizzle-orm + drizzle-kit (https://github.com/drizzle-team/drizzle-orm)                             | 0.45.1           |
| Client State       | TanStack DB      | @tanstack/db + @tanstack/react-db (https://github.com/TanStack/db)                                  | 0.5.20 / 0.1.64  |
| Agent Events       | Durable Streams  | @durable-streams/client + @durable-streams/state (https://github.com/durable-streams/durable-streams) | 0.1.5            |
| AI / Agents        | Claude Agent SDK | @anthropic-ai/claude-agent-sdk (https://github.com/anthropics/claude-agent-sdk-typescript)          | 0.2.9            |
| UI                 | Radix + Tailwind | @radix-ui/* + tailwindcss (https://github.com/radix-ui/primitives)                                  | 1.2.4 / 4.1.18   |
| Drag & Drop        | dnd-kit          | @dnd-kit/core + @dnd-kit/sortable (https://github.com/clauderic/dnd-kit)                            | 6.3.1            |
| Testing            | Vitest           | vitest (https://github.com/vitest-dev/vitest)                                                       | 4.0.17           |
| UI Testing         | Agent Browser    | agent-browser (https://github.com/vercel-labs/agent-browser)                                        | 0.5.0            |
| Linting/Formatting | Biome            | @biomejs/biome (https://github.com/biomejs/biome)                                                   | 2.3.11           |
| CI/CD              | GitHub Actions   | https://github.com/features/actions                                                                 | -                |

### Utility Libraries

| Package                  | Version | Purpose                         |
| ------------------------ | ------- | ------------------------------- |
| class-variance-authority | 0.7.1   | Component variant styling (cva) |
| @paralleldrive/cuid2     | 3.0.6   | Secure collision-resistant IDs  |
| zod                      | 4.3.5   | Schema validation               |
| @radix-ui/react-slot     | 1.2.4   | asChild prop support            |
| @tailwindcss/vite        | 4.1.18  | Tailwind v4 Vite plugin         |