import { ok } from '../../utils/result.js';
import type { BootstrapContext } from '../types.js';

/**
 * Initialize collections for client mode.
 * In client mode, data is fetched from API endpoints, so this just sets up
 * an empty collections structure for compatibility.
 */
export const initializeCollections = async (_ctx: BootstrapContext) => {
  console.log('[Bootstrap] Collections initialized (client mode - data via API)');

  // In client mode, collections are managed via API fetch
  // This phase just marks collections as ready
  return ok({
    projects: { ready: true },
    tasks: { ready: true },
    agents: { ready: true },
    sessions: { ready: true },
  });
};
