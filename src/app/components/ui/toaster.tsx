import { Toast, ToastProvider, ToastViewport } from '@/app/components/ui/toast';
import { useToast } from '@/app/hooks/use-toast';

/**
 * Toaster component that renders all active toasts.
 *
 * This component should be placed once at the root of your application
 * (typically in _app.tsx, layout.tsx, or __root.tsx).
 *
 * @example
 * ```tsx
 * // In your root layout or app component
 * import { Toaster } from '@/app/components/ui/toaster';
 *
 * export function App() {
 *   return (
 *     <>
 *       <YourAppContent />
 *       <Toaster />
 *     </>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Using toasts in components
 * import { useToast, toast } from '@/app/hooks/use-toast';
 *
 * function MyComponent() {
 *   const { success, error, warning, info } = useToast();
 *
 *   // Basic usage
 *   success('Saved successfully');
 *   error('Failed to save', 'Check your connection');
 *   warning('Low disk space');
 *   info('New version available');
 *
 *   // With action button
 *   toast.show({
 *     title: 'File deleted',
 *     description: 'This action can be undone',
 *     action: { label: 'Undo', onClick: () => undoDelete() }
 *   });
 *
 *   // Promise pattern
 *   toast.promise(saveData(), {
 *     loading: 'Saving...',
 *     success: 'Saved!',
 *     error: 'Failed to save'
 *   });
 * }
 * ```
 */
export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map((toastData) => (
        <Toast
          key={toastData.id}
          variant={toastData.variant}
          title={toastData.title}
          description={toastData.description}
          duration={toastData.duration}
          action={toastData.action}
          dismissible={toastData.dismissible}
          showProgress={toastData.showProgress}
        />
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}

export { ToastProvider, ToastViewport } from '@/app/components/ui/toast';
