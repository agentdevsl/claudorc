import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { GlobalShortcuts } from '@/app/components/features/global-shortcuts';
import { Toaster } from '@/app/components/ui/toaster';
import { TooltipProvider } from '@/app/components/ui/tooltip';
import { ShortcutsProvider } from '@/app/providers/shortcuts-provider';
import type { RouterContext } from '@/app/router';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <ShortcutsProvider>
      <TooltipProvider delayDuration={300}>
        <div className="min-h-screen bg-canvas text-fg">
          <Outlet />
          <Toaster />
          <GlobalShortcuts />
        </div>
      </TooltipProvider>
    </ShortcutsProvider>
  ),
});
