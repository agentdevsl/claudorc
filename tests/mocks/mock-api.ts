import type { Context } from 'hono';
import { vi } from 'vitest';

/**
 * Options for creating a mock Hono context
 */
export interface MockHonoContextOptions {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  vars?: Record<string, unknown>;
  method?: string;
  path?: string;
}

/**
 * Mock response object that captures response data for assertions
 */
export interface MockResponse {
  data: unknown;
  status: number;
  headers: Map<string, string>;
  getJson: () => unknown;
}

/**
 * Creates a mock Hono Context object for testing route handlers
 */
export function createMockHonoContext(opts: MockHonoContextOptions = {}): Context {
  const {
    body = {},
    params = {},
    query = {},
    headers = {},
    vars = {},
    method = 'GET',
    path = '/',
  } = opts;

  const varsStore = new Map<string, unknown>(Object.entries(vars));
  let statusCode = 200;
  const responseHeaders = new Map<string, string>();
  let capturedData: unknown = null;

  // Mock Request object
  const mockRequest = {
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    blob: vi.fn().mockResolvedValue(new Blob()),
    formData: vi.fn().mockResolvedValue(new FormData()),
    method,
    url: `http://localhost${path}`,
    headers: new Headers(headers),
    raw: new Request(`http://localhost${path}`, {
      method,
      headers,
      body: method !== 'GET' && method !== 'HEAD' ? JSON.stringify(body) : undefined,
    }),
  };

  // Mock Context object
  const mockContext = {
    req: {
      ...mockRequest,
      param: vi.fn((name?: string) => {
        if (name === undefined) return params;
        return params[name];
      }),
      query: vi.fn((name?: string) => {
        if (name === undefined) return query;
        return query[name];
      }),
      queries: vi.fn((name?: string) => {
        if (name === undefined) return query;
        const value = query[name];
        return value ? [value] : [];
      }),
      header: vi.fn((name?: string) => {
        if (name === undefined) return headers;
        return headers[name];
      }),
      raw: mockRequest.raw,
      json: mockRequest.json,
      text: mockRequest.text,
      arrayBuffer: mockRequest.arrayBuffer,
      blob: mockRequest.blob,
      formData: mockRequest.formData,
      valid: vi.fn((target: string) => {
        if (target === 'json') return body;
        if (target === 'query') return query;
        if (target === 'param') return params;
        return undefined;
      }),
    },
    json: vi.fn((data: unknown, statusOrInit?: number | ResponseInit) => {
      capturedData = data;
      if (typeof statusOrInit === 'number') {
        statusCode = statusOrInit;
      } else if (statusOrInit?.status) {
        statusCode = statusOrInit.status;
      }
      return new Response(JSON.stringify(data), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json', ...Object.fromEntries(responseHeaders) },
      });
    }),
    text: vi.fn((data: string, statusOrInit?: number | ResponseInit) => {
      capturedData = data;
      if (typeof statusOrInit === 'number') {
        statusCode = statusOrInit;
      } else if (statusOrInit?.status) {
        statusCode = statusOrInit.status;
      }
      return new Response(data, {
        status: statusCode,
        headers: { 'Content-Type': 'text/plain', ...Object.fromEntries(responseHeaders) },
      });
    }),
    html: vi.fn((data: string, statusOrInit?: number | ResponseInit) => {
      capturedData = data;
      if (typeof statusOrInit === 'number') {
        statusCode = statusOrInit;
      } else if (statusOrInit?.status) {
        statusCode = statusOrInit.status;
      }
      return new Response(data, {
        status: statusCode,
        headers: { 'Content-Type': 'text/html', ...Object.fromEntries(responseHeaders) },
      });
    }),
    redirect: vi.fn((location: string, statusOrInit?: number) => {
      statusCode = typeof statusOrInit === 'number' ? statusOrInit : 302;
      responseHeaders.set('Location', location);
      return new Response(null, {
        status: statusCode,
        headers: Object.fromEntries(responseHeaders),
      });
    }),
    notFound: vi.fn(() => {
      statusCode = 404;
      capturedData = { error: 'Not Found' };
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
    get: vi.fn(<T = unknown>(key: string): T | undefined => {
      return varsStore.get(key) as T | undefined;
    }),
    set: vi.fn((key: string, value: unknown) => {
      varsStore.set(key, value);
    }),
    status: vi.fn((code: number) => {
      statusCode = code;
      return mockContext;
    }),
    header: vi.fn((name: string, value: string) => {
      responseHeaders.set(name, value);
    }),
    body: vi.fn((data: unknown, statusOrInit?: number | ResponseInit) => {
      capturedData = data;
      if (typeof statusOrInit === 'number') {
        statusCode = statusOrInit;
      } else if (statusOrInit?.status) {
        statusCode = statusOrInit.status;
      }
      return new Response(data as BodyInit, {
        status: statusCode,
        headers: Object.fromEntries(responseHeaders),
      });
    }),
    stream: vi.fn(
      (callback: (stream: { write: (data: unknown) => void; close: () => void }) => void) => {
        const chunks: unknown[] = [];
        const mockStream = {
          write: (data: unknown) => chunks.push(data),
          close: () => {},
        };
        callback(mockStream);
        return new Response(new ReadableStream(), {
          status: statusCode,
          headers: Object.fromEntries(responseHeaders),
        });
      }
    ),
    // Expose captured data for testing
    _getCapturedData: () => capturedData,
    _getStatus: () => statusCode,
    _getHeaders: () => responseHeaders,
  };

  return mockContext as unknown as Context;
}

/**
 * Creates a mock Hono context with authentication variables pre-set
 */
export function createMockAuthContext(
  userId?: string,
  opts: Omit<MockHonoContextOptions, 'vars'> & { sessionToken?: string } = {}
): Context {
  const { sessionToken = 'mock-session-token', ...restOpts } = opts;
  return createMockHonoContext({
    ...restOpts,
    vars: {
      userId: userId || 'test-user-id',
      sessionToken,
    },
  });
}

/**
 * Options for creating a mock Request
 */
export interface MockRequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string>;
}

/**
 * Creates a mock Request object
 */
export function createMockRequest(
  method: string,
  path: string,
  opts: MockRequestOptions = {}
): Request {
  const { body, headers = {}, params = {} } = opts;

  let url = `http://localhost${path}`;

  // Replace params in path
  for (const [key, value] of Object.entries(params)) {
    url = url.replace(`:${key}`, value);
  }

  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body && method !== 'GET' && method !== 'HEAD') {
    init.body = JSON.stringify(body);
  }

  return new Request(url, init);
}

/**
 * Creates a mock Response that captures data for assertions
 */
export function createMockResponse(): MockResponse {
  const response: MockResponse = {
    data: null,
    status: 200,
    headers: new Map(),
    getJson: () => {
      if (typeof response.data === 'string') {
        return JSON.parse(response.data);
      }
      return response.data;
    },
  };

  return response;
}

/**
 * Mock SSE stream for testing Server-Sent Events endpoints
 */
export interface MockSSEStream {
  write: (data: string) => void;
  close: () => void;
  getEvents: () => Array<{ event?: string; data: string; id?: string }>;
  getRawOutput: () => string;
}

/**
 * Creates a mock SSE stream that captures written events
 */
export function createMockSSEStream(): MockSSEStream {
  const chunks: string[] = [];

  return {
    write: (data: string) => {
      chunks.push(data);
    },
    close: () => {},
    getEvents: () => {
      const fullOutput = chunks.join('');
      const events: Array<{ event?: string; data: string; id?: string }> = [];
      const lines = fullOutput.split('\n');

      let currentEvent: { event?: string; data: string; id?: string } = { data: '' };

      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent.event = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          const dataContent = line.slice(5).trim();
          currentEvent.data = currentEvent.data
            ? `${currentEvent.data}\n${dataContent}`
            : dataContent;
        } else if (line.startsWith('id:')) {
          currentEvent.id = line.slice(3).trim();
        } else if (line === '') {
          // Empty line indicates end of event
          if (currentEvent.data) {
            events.push({ ...currentEvent });
          }
          currentEvent = { data: '' };
        }
      }

      // Parse JSON data fields
      return events.map((evt) => {
        try {
          return { ...evt, data: JSON.parse(evt.data) };
        } catch {
          return evt;
        }
      });
    },
    getRawOutput: () => chunks.join(''),
  };
}

/**
 * Result from a route test harness call
 */
export interface RouteTestResult {
  status: number;
  data: unknown;
  headers: Map<string, string>;
}

/**
 * Route test harness for simplified route handler testing
 */
export interface RouteTestHarness {
  get: (path: string, opts?: RouteTestOptions) => Promise<RouteTestResult>;
  post: (path: string, opts?: RouteTestOptions) => Promise<RouteTestResult>;
  put: (path: string, opts?: RouteTestOptions) => Promise<RouteTestResult>;
  patch: (path: string, opts?: RouteTestOptions) => Promise<RouteTestResult>;
  delete: (path: string, opts?: RouteTestOptions) => Promise<RouteTestResult>;
}

/**
 * Options for route test calls
 */
export interface RouteTestOptions {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  auth?: string; // userId for authenticated requests
}

/**
 * Creates a test harness for a Hono route handler
 */
export function createRouteTestHarness(
  routeHandler: (c: Context) => Promise<Response> | Response
): RouteTestHarness {
  const makeRequest = async (
    method: string,
    path: string,
    opts: RouteTestOptions = {}
  ): Promise<RouteTestResult> => {
    const { body, params = {}, query = {}, headers = {}, auth } = opts;

    const contextOpts: MockHonoContextOptions = {
      method,
      path,
      body,
      params,
      query,
      headers,
      vars: auth ? { userId: auth, sessionToken: 'test-session' } : {},
    };

    const context = createMockHonoContext(contextOpts);
    await routeHandler(context);

    // Extract captured data from mock context
    const capturedData = (context as { _getCapturedData: () => unknown })._getCapturedData();
    const status = (context as { _getStatus: () => number })._getStatus();
    const responseHeaders = (context as { _getHeaders: () => Map<string, string> })._getHeaders();

    return {
      status,
      data: capturedData,
      headers: responseHeaders,
    };
  };

  return {
    get: (path, opts) => makeRequest('GET', path, opts),
    post: (path, opts) => makeRequest('POST', path, opts),
    put: (path, opts) => makeRequest('PUT', path, opts),
    patch: (path, opts) => makeRequest('PATCH', path, opts),
    delete: (path, opts) => makeRequest('DELETE', path, opts),
  };
}

/**
 * Mock middleware for testing middleware chains
 */
export interface MockMiddleware {
  handler: ReturnType<typeof vi.fn>;
  calls: Array<{ context: Context; next: () => Promise<void> }>;
}

/**
 * Creates a mock middleware function
 */
export function createMockMiddleware(): MockMiddleware {
  const calls: Array<{ context: Context; next: () => Promise<void> }> = [];

  const handler = vi.fn(async (c: Context, next: () => Promise<void>) => {
    calls.push({ context: c, next });
    await next();
  });

  return {
    handler,
    calls,
  };
}

/**
 * Options for configuring a mock rate limiter
 */
export interface MockRateLimiterOptions {
  shouldBlock?: boolean;
  remaining?: number;
  limit?: number;
  reset?: number;
}

/**
 * Mock rate limiter for testing rate limiting middleware
 */
export interface MockRateLimiter {
  handler: ReturnType<typeof vi.fn>;
  shouldBlock: boolean;
  remaining: number;
  limit: number;
  reset: number;
  setBlocking: (block: boolean) => void;
}

/**
 * Creates a mock rate limiter
 */
export function createMockRateLimiter(opts: MockRateLimiterOptions = {}): MockRateLimiter {
  const limiter = {
    shouldBlock: opts.shouldBlock || false,
    remaining: opts.remaining ?? 100,
    limit: opts.limit ?? 100,
    reset: opts.reset ?? Date.now() + 60000,
    setBlocking: (block: boolean) => {
      limiter.shouldBlock = block;
    },
  };

  const handler = vi.fn(async (c: Context, next: () => Promise<void>) => {
    if (limiter.shouldBlock) {
      c.header('X-RateLimit-Limit', String(limiter.limit));
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', String(limiter.reset));
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    c.header('X-RateLimit-Limit', String(limiter.limit));
    c.header('X-RateLimit-Remaining', String(limiter.remaining));
    c.header('X-RateLimit-Reset', String(limiter.reset));

    await next();
  });

  return {
    ...limiter,
    handler,
  };
}
