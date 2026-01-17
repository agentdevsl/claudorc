import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { Toaster } from '@/app/components/ui/toast';
import { TooltipProvider } from '@/app/components/ui/tooltip';
import type { RouterContext } from '@/app/router';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-canvas text-fg">
        <Outlet />
        <Toaster />
      </div>
    </TooltipProvider>
  ),
});
