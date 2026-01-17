import type { Config } from 'tailwindcss';

/**
 * Tailwind CSS v4 Configuration
 *
 * This configuration file transfers design tokens from the project wireframes
 * into a production-ready Tailwind v4 setup. It includes:
 * - Dark theme as default with light theme support via media queries
 * - Custom color palette matching GitHub-inspired design system
 * - Typography tokens (font families and sizes)
 * - Border radius scale
 * - Animation utilities (durations and easing)
 * - Shadow system for depth
 *
 * Usage: Apply theme classes using the 'dark:' prefix for dark theme overrides,
 * or use 'light:' class when implementing light theme toggle functionality.
 */

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],

  theme: {
    extend: {
      /**
       * Color System
       *
       * Dark theme is the default. Light theme colors are provided
       * for use with dark: prefix or light: class selector.
       *
       * Color hierarchy:
       * - bg-canvas: Main background (page level)
       * - bg-default: Default surface (components)
       * - bg-subtle: Subtle backgrounds
       * - bg-muted: Muted backgrounds (hover states)
       * - bg-emphasis: Emphasized backgrounds (selected states)
       * - fg-default: Primary text
       * - fg-muted: Secondary text
       * - fg-subtle: Tertiary text (weak emphasis)
       * - Semantic colors: success, danger, attention, done, accent
       */
      colors: {
        // Canvas and surface backgrounds
        canvas: {
          DEFAULT: '#0d1117',
          light: '#ffffff',
        },
        'bg-default': {
          DEFAULT: '#161b22',
          light: '#f6f8fa',
        },
        'bg-subtle': {
          DEFAULT: '#1c2128',
          light: '#f0f3f6',
        },
        'bg-muted': {
          DEFAULT: '#21262d',
          light: '#eaeef2',
        },
        'bg-emphasis': {
          DEFAULT: '#30363d',
          light: '#d0d7de',
        },

        // Text colors (foreground)
        'fg-default': {
          DEFAULT: '#e6edf3',
          light: '#1f2328',
        },
        'fg-muted': {
          DEFAULT: '#8b949e',
          light: '#656d76',
        },
        'fg-subtle': {
          DEFAULT: '#6e7681',
          light: '#6e7781',
        },

        // Borders
        'border-default': {
          DEFAULT: '#30363d',
          light: '#d0d7de',
        },

        // Semantic colors - Accent/Primary
        'accent-fg': {
          DEFAULT: '#58a6ff',
          light: '#0969da',
        },

        // Semantic colors - Success
        'success-fg': {
          DEFAULT: '#3fb950',
          light: '#1a7f37',
        },

        // Semantic colors - Danger/Error
        'danger-fg': {
          DEFAULT: '#f85149',
          light: '#cf222e',
        },

        // Semantic colors - Warning/Attention
        'attention-fg': {
          DEFAULT: '#d29922',
          light: '#9a6700',
        },

        // Semantic colors - Done/Purple
        'done-fg': {
          DEFAULT: '#a371f7',
          light: '#8250df',
        },
      },

      /**
       * Border Radius
       *
       * Three-tier system:
       * - sm: 4px (small elements, tight radius)
       * - DEFAULT: 6px (standard radius for most components)
       * - lg: 12px (large elements, prominent containers)
       */
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        lg: '12px',
      },

      /**
       * Typography
       *
       * Font families:
       * - sans: 'Mona Sans' for UI text (primary font)
       * - mono: 'Fira Code' for code blocks and monospaced text
       */
      fontFamily: {
        sans: ['Mona Sans', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },

      /**
       * Animation System
       *
       * Duration tiers for different interaction contexts:
       * - fast: 150ms (quick feedback, micro-interactions)
       * - normal: 200ms (standard transitions)
       * - slow: 300ms (deliberate, attention-drawing animations)
       *
       * All animations use a cubic-bezier easing function for smooth motion:
       * cubic-bezier(0.25, 1, 0.5, 1) - Creates a natural ease-out effect
       */
      animation: {
        // Fade animations
        'fade-in': 'fadeIn 200ms cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'fade-out': 'fadeOut 200ms cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'fade-in-fast': 'fadeIn 150ms cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'fade-out-fast': 'fadeOut 150ms cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'fade-in-slow': 'fadeIn 300ms cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'fade-out-slow': 'fadeOut 300ms cubic-bezier(0.25, 1, 0.5, 1) forwards',

        // Scale animations
        'scale-in': 'scaleIn 200ms cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'scale-out': 'scaleOut 200ms cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'scale-in-fast': 'scaleIn 150ms cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'scale-out-fast': 'scaleOut 150ms cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'scale-in-slow': 'scaleIn 300ms cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'scale-out-slow': 'scaleOut 300ms cubic-bezier(0.25, 1, 0.5, 1) forwards',

        // Slide animations
        'slide-in-up': 'slideInUp 200ms cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'slide-out-down': 'slideOutDown 200ms cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'slide-in-down': 'slideInDown 200ms cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'slide-out-up': 'slideOutUp 200ms cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'slide-in-left': 'slideInLeft 200ms cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'slide-out-right': 'slideOutRight 200ms cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'slide-in-right': 'slideInRight 200ms cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'slide-out-left': 'slideOutLeft 200ms cubic-bezier(0.25, 1, 0.5, 1) forwards',
      },

      /**
       * Keyframes
       *
       * Animation definitions for use with the animation utilities above.
       * These keyframes provide the motion for fade, scale, and slide effects.
       */
      keyframes: {
        // Fade keyframes
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },

        // Scale keyframes
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        scaleOut: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.95)', opacity: '0' },
        },

        // Slide keyframes
        slideInUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideOutDown: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(12px)', opacity: '0' },
        },
        slideInDown: {
          '0%': { transform: 'translateY(-12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideOutUp: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-12px)', opacity: '0' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-12px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(12px)', opacity: '0' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(12px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideOutLeft: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(-12px)', opacity: '0' },
        },
      },

      /**
       * Box Shadows
       *
       * Shadow system for depth hierarchy in dark theme:
       * - sm: subtle shadows for interactive elements
       * - DEFAULT: standard shadows for floating elements
       * - lg: prominent shadows for modal dialogs and overlays
       * - xl: maximum depth for full-screen modals
       *
       * All shadows use dark theme-appropriate colors with
       * varying opacity levels for hierarchy.
       */
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
        DEFAULT: '0 4px 12px rgba(0, 0, 0, 0.4)',
        lg: '0 12px 32px rgba(0, 0, 0, 0.5)',
        xl: '0 20px 64px rgba(0, 0, 0, 0.6)',

        // Inset shadows for sunken effects
        'inset-sm': 'inset 0 1px 2px rgba(0, 0, 0, 0.3)',
        'inset-DEFAULT': 'inset 0 1px 4px rgba(0, 0, 0, 0.4)',

        // Focus ring shadows
        focus: '0 0 0 3px rgba(88, 166, 255, 0.3)',
        'focus-error': '0 0 0 3px rgba(248, 81, 73, 0.3)',
        'focus-success': '0 0 0 3px rgba(63, 185, 80, 0.3)',
      },

      /**
       * Transitions
       *
       * Timing configuration for property transitions.
       * Uses consistent easing and durations throughout the application.
       */
      transitionDuration: {
        fast: '150ms',
        normal: '200ms',
        slow: '300ms',
      },
      transitionTimingFunction: {
        'ease-out': 'cubic-bezier(0.25, 1, 0.5, 1)',
      },

      /**
       * Opacity
       *
       * Extended opacity scale for fine-grained transparency control
       * in dark theme context.
       */
      opacity: {
        '0': '0',
        '5': '0.05',
        '10': '0.1',
        '20': '0.2',
        '25': '0.25',
        '30': '0.3',
        '40': '0.4',
        '50': '0.5',
        '60': '0.6',
        '70': '0.7',
        '75': '0.75',
        '80': '0.8',
        '90': '0.9',
        '95': '0.95',
        '100': '1',
      },

      /**
       * Spacing
       *
       * Tailwind's default spacing scale works well for this design system.
       * Base unit is 0.25rem (4px), providing 4px, 8px, 12px, 16px increments, etc.
       */
      spacing: {
        '0': '0',
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '7': '28px',
        '8': '32px',
        '9': '36px',
        '10': '40px',
        '12': '48px',
        '14': '56px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
      },
    },
  },

  plugins: [],
};

export default config;
