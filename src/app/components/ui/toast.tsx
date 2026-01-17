import * as ToastPrimitive from '@radix-ui/react-toast';
import { X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils/cn';

export const ToastProvider = ToastPrimitive.Provider;
export const ToastViewport = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>) => (
  <ToastPrimitive.Viewport
    className={cn('fixed right-4 top-4 z-50 flex w-80 flex-col gap-2 outline-none', className)}
    {...props}
  />
);

export const Toast = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root>) => (
  <ToastPrimitive.Root
    className={cn(
      'relative flex w-full items-start gap-3 rounded-md border border-border bg-surface px-4 py-3 text-sm text-fg shadow-lg',
      className
    )}
    {...props}
  />
);

export const ToastTitle = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>) => (
  <ToastPrimitive.Title className={cn('font-medium text-fg', className)} {...props} />
);

export const ToastDescription = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>) => (
  <ToastPrimitive.Description className={cn('text-xs text-fg-muted', className)} {...props} />
);

export const ToastClose = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>) => (
  <ToastPrimitive.Close
    className={cn('ml-auto text-fg-muted transition hover:text-fg', className)}
    {...props}
  >
    <X className="h-3 w-3" />
  </ToastPrimitive.Close>
);

export const Toaster = () => (
  <ToastProvider>
    <ToastViewport />
  </ToastProvider>
);
