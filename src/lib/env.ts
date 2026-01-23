export type RuntimeEnv = Readonly<{
  e2eSeed: boolean;
}>;

export const getRuntimeEnv = (): RuntimeEnv => {
  // Support both Vite (import.meta.env) and Node.js (process.env)
  let e2eSeedRaw: string | undefined;

  if (typeof import.meta !== 'undefined' && import.meta.env) {
    e2eSeedRaw = import.meta.env.VITE_E2E_SEED;
    /* v8 ignore start -- Node.js fallback unreachable in Vitest environment */
  } else if (typeof process !== 'undefined' && process.env) {
    e2eSeedRaw = process.env.VITE_E2E_SEED;
  }
  /* v8 ignore stop */

  return {
    e2eSeed: e2eSeedRaw === 'true',
  };
};
