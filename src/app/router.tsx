import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { db } from "@/db/client";

export const router = createRouter({
  routeTree,
  context: { db },
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
