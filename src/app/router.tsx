import { createRouter } from '@tanstack/react-router';
import type { BootstrapContext as BootstrapContextType } from '@/lib/bootstrap/types';
import { routeTree } from './routeTree.gen';
import type { Services } from './services/services';

export type RouterContext = {
  services: Services | null;
  bootstrap: BootstrapContextType | null;
};

export const router = createRouter({
  routeTree,
  context: { services: null, bootstrap: null } satisfies RouterContext,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
