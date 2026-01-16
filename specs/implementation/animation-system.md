# Animation System

AgentPane animation system aligned with the design skills guidelines and React Motion library defaults.

## Core Timing Tokens

| Token | Duration | Use Case |
|-------|----------|----------|
| `--duration-instant` | 50ms | Micro-feedback (button press) |
| `--duration-fast` | 150ms | Micro-interactions (hover, focus) |
| `--duration-normal` | 200ms | Standard transitions (modals, panels) |
| `--duration-slow` | 300ms | Complex animations (page transitions) |

## Easing Functions

| Name | Value | Use Case |
|------|-------|----------|
| `--ease-out` | `cubic-bezier(0.25, 1, 0.5, 1)` | Default for all UI transitions |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Symmetric animations |

**Important:** Never use spring/bouncy animations in enterprise UI. Keep motion subtle and purposeful.

## CSS Custom Properties

```css
:root {
  /* Duration */
  --duration-instant: 50ms;
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;

  /* Easing */
  --ease-out: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

## Tailwind v4 Configuration

```css
@theme {
  --animate-duration-instant: 50ms;
  --animate-duration-fast: 150ms;
  --animate-duration-normal: 200ms;
  --animate-duration-slow: 300ms;

  --animate-timing-out: cubic-bezier(0.25, 1, 0.5, 1);
  --animate-timing-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

## Animation Keyframes

### Fade In/Out

```css
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
```

### Scale In (Modals)

```css
@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes scale-out {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.96);
  }
}
```

### Slide Animations

```css
@keyframes slide-in-from-top {
  from { transform: translateY(-8px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes slide-in-from-bottom {
  from { transform: translateY(8px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes slide-in-from-left {
  from { transform: translateX(-8px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes slide-in-from-right {
  from { transform: translateX(8px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
```

### Staggered Card Enter

```css
@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Usage with stagger delays */
.card:nth-child(1) { animation-delay: 0ms; }
.card:nth-child(2) { animation-delay: 50ms; }
.card:nth-child(3) { animation-delay: 100ms; }
.card:nth-child(4) { animation-delay: 150ms; }
```

### Status Pulse

```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Running status indicator */
.status-running {
  animation: pulse 2s ease-in-out infinite;
}
```

## Component Animation Patterns

### Modal/Dialog

```css
/* Overlay */
.modal-overlay {
  animation: fade-in var(--duration-normal) var(--ease-out);
}

/* Content */
.modal-content {
  animation: scale-in var(--duration-normal) var(--ease-out);
}

/* Exit state (via Radix data attributes) */
.modal-overlay[data-state="closed"] {
  animation: fade-out var(--duration-fast) var(--ease-out);
}

.modal-content[data-state="closed"] {
  animation: scale-out var(--duration-fast) var(--ease-out);
}
```

### Dropdown Menu

```css
.dropdown-content {
  animation: slide-in-from-top var(--duration-fast) var(--ease-out);
}

.dropdown-content[data-state="closed"] {
  animation: fade-out var(--duration-fast) var(--ease-out);
}
```

### Toast/Notification

```css
.toast {
  animation: slide-in-from-right var(--duration-normal) var(--ease-out);
}

.toast[data-state="closed"] {
  animation: slide-out-to-right var(--duration-fast) var(--ease-out);
}
```

### Tooltip

```css
.tooltip {
  animation: fade-in var(--duration-fast) var(--ease-out);
}
```

### Sidebar Toggle

```css
.sidebar {
  transition: transform var(--duration-normal) var(--ease-out);
}

.sidebar[data-collapsed="true"] {
  transform: translateX(-100%);
}
```

## React Motion Integration

For complex animations, use Motion library (Framer Motion successor):

```tsx
import { motion } from 'motion/react';

// Design system aligned variants
const modalVariants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: [0.25, 1, 0.5, 1] }
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: 0.15, ease: [0.25, 1, 0.5, 1] }
  }
};

// Stagger children (empty states, lists)
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 1, 0.5, 1] }
  }
};
```

### Motion Preset Objects

```tsx
// Reusable transition presets
export const transitions = {
  fast: { duration: 0.15, ease: [0.25, 1, 0.5, 1] },
  normal: { duration: 0.2, ease: [0.25, 1, 0.5, 1] },
  slow: { duration: 0.3, ease: [0.25, 1, 0.5, 1] },
};

// Layout transition for shared element animations
export const layoutTransition = {
  type: 'tween',
  duration: 0.2,
  ease: [0.25, 1, 0.5, 1],
};
```

## Tailwind Utility Classes

```css
/* Base transition utilities */
.transition-fast {
  transition-duration: 150ms;
  transition-timing-function: cubic-bezier(0.25, 1, 0.5, 1);
}

.transition-normal {
  transition-duration: 200ms;
  transition-timing-function: cubic-bezier(0.25, 1, 0.5, 1);
}

.transition-slow {
  transition-duration: 300ms;
  transition-timing-function: cubic-bezier(0.25, 1, 0.5, 1);
}

/* Animation utilities */
.animate-fade-in {
  animation: fade-in 200ms cubic-bezier(0.25, 1, 0.5, 1);
}

.animate-scale-in {
  animation: scale-in 200ms cubic-bezier(0.25, 1, 0.5, 1);
}

.animate-slide-in-top {
  animation: slide-in-from-top 150ms cubic-bezier(0.25, 1, 0.5, 1);
}

.animate-slide-in-bottom {
  animation: slide-in-from-bottom 150ms cubic-bezier(0.25, 1, 0.5, 1);
}
```

## Animation Guidelines

### Do ✓

- Use 150ms for micro-interactions (hover, focus, toggle)
- Use 200ms for modals, panels, and standard transitions
- Use staggered animations for lists/grids (50ms delay between items)
- Use `cubic-bezier(0.25, 1, 0.5, 1)` as the default easing
- Animate opacity + transform together for best performance
- Use CSS transitions for simple hover/focus states
- Use Motion for complex orchestrated animations

### Don't ✗

- No spring/bouncy animations
- No animations longer than 300ms
- No gratuitous decorative motion
- No animation that blocks user interaction
- No motion that could cause accessibility issues
- Don't animate layout properties (width, height) directly - use transform

## Reduced Motion Support

Always respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

```tsx
// Motion hook
import { useReducedMotion } from 'motion/react';

function Modal({ children }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
    >
      {children}
    </motion.div>
  );
}
```

## Animation Checklist

When implementing animations, verify:

- [ ] Duration matches design system tokens (150ms/200ms/300ms)
- [ ] Uses `cubic-bezier(0.25, 1, 0.5, 1)` easing
- [ ] Respects `prefers-reduced-motion`
- [ ] Only animates transform/opacity for performance
- [ ] No spring/bouncy effects
- [ ] Stagger delays are consistent (50ms increments)
- [ ] Exit animations are faster than enter (150ms vs 200ms)
