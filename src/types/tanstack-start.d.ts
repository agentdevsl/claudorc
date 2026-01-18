/**
 * TanStack Start API Route Type Augmentations
 *
 * This file augments @tanstack/router-core's FilebaseRouteOptionsInterface
 * to include the `server` property with `handlers` for API routes.
 *
 * TanStack Start provides this augmentation in @tanstack/start-client-core/serverRoute,
 * but due to multiple copies of @tanstack/router-core in the node_modules tree,
 * the augmentation may not be applied correctly. This file provides a direct
 * augmentation to ensure the `server` property is recognized.
 */

import type { AnyRoute } from '@tanstack/router-core';

/**
 * HTTP methods supported by TanStack Start API routes
 */
export type RouteMethod = 'ANY' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

/**
 * Context provided to route method handlers.
 * Uses a generic for params to allow specific param shapes.
 */
export interface RouteMethodHandlerCtx<TParams = Record<string, string>> {
  request: Request;
  params: TParams;
  pathname: string;
  context: Record<string, unknown>;
  next: <TContext = undefined>(options?: {
    context?: TContext;
  }) => { isNext: true; context: TContext };
}

/**
 * Handler function type for route methods.
 * Accepts any function that takes a context-like object and returns a Response.
 */
// biome-ignore lint/suspicious/noExplicitAny: Allow flexible handler signatures
export type RouteMethodHandlerFn = (
  ctx: any
) => Response | Promise<Response> | undefined | Promise<undefined | Response>;

/**
 * Route method handler - can be a function or an object with handler and middleware
 */
export type RouteMethodHandler =
  | RouteMethodHandlerFn
  | {
      handler?: RouteMethodHandlerFn;
      middleware?: ReadonlyArray<unknown>;
    };

/**
 * Server options for file routes
 */
export interface RouteServerOptions {
  middleware?: ReadonlyArray<unknown>;
  handlers?: Partial<Record<RouteMethod, RouteMethodHandler>>;
}

declare module '@tanstack/router-core' {
  interface FilebaseRouteOptionsInterface<
    TRegister,
    TParentRoute extends AnyRoute = AnyRoute,
    TId extends string = string,
    TPath extends string = string,
    TSearchValidator = undefined,
    TParams = object,
    TLoaderDeps extends Record<string, unknown> = object,
    TLoaderFn = undefined,
    TRouterContext = object,
    TRouteContextFn = unknown,
    TBeforeLoadFn = unknown,
    TRemountDepsFn = unknown,
    TSSR = unknown,
    TServerMiddlewares = unknown,
    THandlers = undefined,
  > {
    /**
     * Server-side configuration for API routes.
     * Allows defining HTTP method handlers (GET, POST, PUT, DELETE, etc.)
     * for file-based API routes in TanStack Start.
     */
    server?: RouteServerOptions;
  }
}
