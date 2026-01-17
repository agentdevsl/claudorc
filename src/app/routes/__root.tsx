import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Toaster } from '@/app/components/ui/toast';
import { TooltipProvider } from '@/app/components/ui/tooltip';
import { BootstrapProvider } from '@/app/providers/bootstrap-provider';

export const Route = createRootRoute({
  component: () => (
    <BootstrapProvider>
      <TooltipProvider delayDuration={300}>
        <div className="min-h-screen bg-canvas text-fg">
          <Outlet />
          <Toaster />
        </div>
      </TooltipProvider>
    </BootstrapProvider>
  ),
});
