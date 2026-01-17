import { createRouter } from '@tanstack/react-router';
import { db } from '@/db/client';
import { routeTree } from './routeTree.gen';

export const router = createRouter({
  routeTree,
  context: { db },
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
