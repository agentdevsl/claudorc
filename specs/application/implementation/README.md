# Implementation Guides

This directory contains detailed implementation guides for AgentPane development.

## Available Guides

### [Component Patterns](./component-patterns.md)

Complete guide to implementing Radix UI + Tailwind CSS components with class-variance-authority.

**Coverage:**

- Button component with CVA variants (primary, secondary, success, danger, ghost)
- Dialog/Modal with Radix Dialog, overlay blur, scale animations
- Dropdown menus with Radix Dropdown Menu (theme switcher, project picker)
- Tabs with Radix Tabs (diff viewer, settings)
- Tooltips with Radix Tooltip (keyboard hints, status explanations)
- Select menus with Radix Select (agent type, priority)
- Switch/Toggle with Radix Switch (auto-cleanup, settings)
- Checkbox with Radix Checkbox (worktree selection, task selection)

**Key Features:**

- GitHub Dark design system tokens (colors, spacing, typography, timing)
- Animation patterns (fade, slide, zoom with 200ms standard timing)
- Accessibility checklist (WCAG 2.1 AA)
- Form patterns and status badges
- Testing examples with Vitest

**Usage:**
Import components from `@/components/ui/` following shadcn/ui style patterns.

---

## Quick Start

1. **Copy UI primitives** from `component-patterns.md` into `app/components/ui/`
2. **Reference tokens** for design consistency
3. **Follow animation timing** (fast: 100ms, base: 200ms, slow: 300ms)
4. **Use `asChild` pattern** with Radix Slot for composition flexibility
5. **Apply CVA variants** for consistent styling across variants

---

## Design System

**Colors:**

- Canvas: `#0d1117` (main background)
- Default: `#161b22` (cards/sections)
- Subtle: `#1c2128` (hover)
- Muted: `#21262d` (disabled)
- Text: `#e6edf3` (foreground)
- Muted text: `#8b949e`
- Accent: `#58a6ff` (blue)
- Success: `#3fb950` (green)
- Error: `#f85149` (red)

**Typography:**

- Sans-serif: Mona Sans (primary)
- Monospace: Fira Code (code/data)
- Base: 14px, Code: 13px

**Spacing:**

- Border radius: 6px
- Padding scale: 1/2/3/4/6 units (4px base)

**Animation Timing:**

- Fast: 100ms (feedback)
- Base: 200ms (standard interactions)
- Slow: 300ms (complex animations)

---

## Related Documentation

- **AGENTS.md** - Tech stack, architecture, API patterns
- **wireframe-review.md** - Design system analysis, component inventory
- **user-stories.md** - Feature requirements and user flows
- **wireframes/** - Visual mockups and references

---

## Contributing

When adding new components or patterns:

1. Follow the structure in `component-patterns.md`
2. Include import statements and full implementation
3. Provide at least one usage example
4. Add accessibility considerations
5. List animation classes used
6. Update this README with new sections
