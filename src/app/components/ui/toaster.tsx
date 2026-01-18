/**
 * Toaster component re-export for backwards compatibility.
 *
 * The main Toaster component is now exported from toast.tsx.
 * This file provides re-exports for existing imports.
 *
 * @example
 * ```tsx
 * // Preferred import (from toast.tsx)
 * import { Toaster, toast } from '@/app/components/ui/toast';
 *
 * // Alternative import (for backwards compatibility)
 * import { Toaster } from '@/app/components/ui/toaster';
 * ```
 */

export type {
  PromiseMessages,
  ToastAction,
  ToastData,
  ToastOptions,
  ToastVariant,
} from '@/app/components/ui/toast';
export { Toaster, ToastProvider, ToastViewport, toast } from '@/app/components/ui/toast';
