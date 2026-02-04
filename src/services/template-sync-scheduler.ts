/**
 * Template Sync Scheduler Service
 *
 * Background service that periodically syncs templates from GitHub based on their
 * configured sync intervals. Runs as a background interval that checks for templates
 * due for sync and triggers the sync process.
 */
import { and, eq, isNotNull, lte } from 'drizzle-orm';
import { templates } from '../db/schema';
import type { Database } from '../types/database.js';
import type { TemplateService } from './template.service.js';

/** Scheduler check interval: how often to check for templates needing sync (1 minute) */
const SCHEDULER_INTERVAL_MS = 60 * 1000;

/** Minimum sync interval allowed (5 minutes) to prevent abuse */
export const MIN_SYNC_INTERVAL_MINUTES = 5;

/**
 * Extract error message from unknown error type
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type SchedulerState = {
  intervalId: ReturnType<typeof setInterval> | null;
  isRunning: boolean;
  lastCheckAt: string | null;
  syncInProgress: Set<string>;
};

const state: SchedulerState = {
  intervalId: null,
  isRunning: false,
  lastCheckAt: null,
  syncInProgress: new Set(),
};

/**
 * Calculate the next sync time based on an interval in minutes
 */
export function calculateNextSyncAt(intervalMinutes: number): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + intervalMinutes);
  return now.toISOString();
}

/**
 * Validate sync interval value
 * Must be >= 5 minutes or null (disabled)
 */
export function validateSyncInterval(interval: number | null | undefined): boolean {
  if (interval === null || interval === undefined) {
    return true; // Disabled is valid
  }
  return typeof interval === 'number' && interval >= MIN_SYNC_INTERVAL_MINUTES;
}

/**
 * Check for templates due for sync and trigger sync process
 */
async function checkAndSyncTemplates(
  db: Database,
  templateService: TemplateService
): Promise<{ synced: number; errors: number }> {
  const now = new Date().toISOString();
  let synced = 0;
  let errors = 0;

  try {
    // Find templates where:
    // - syncIntervalMinutes is set (auto-sync enabled)
    // - nextSyncAt is in the past or now
    // - status is not 'syncing' (prevent overlapping syncs)
    const dueTemplates = await db.query.templates.findMany({
      where: and(
        isNotNull(templates.syncIntervalMinutes),
        isNotNull(templates.nextSyncAt),
        lte(templates.nextSyncAt, now)
      ),
    });

    for (const template of dueTemplates) {
      // Skip if already syncing this template
      if (state.syncInProgress.has(template.id)) {
        console.log(`[TemplateSyncScheduler] Skipping ${template.name} - sync already in progress`);
        continue;
      }

      // Skip if template is currently in syncing state
      if (template.status === 'syncing') {
        console.log(`[TemplateSyncScheduler] Skipping ${template.name} - status is syncing`);
        continue;
      }

      try {
        state.syncInProgress.add(template.id);
        console.log(`[TemplateSyncScheduler] Starting scheduled sync for: ${template.name}`);

        const result = await templateService.sync(template.id);

        if (result.ok) {
          synced++;
          console.log(
            `[TemplateSyncScheduler] Successfully synced ${template.name}: ` +
              `${result.value.skillCount} skills, ${result.value.commandCount} commands, ${result.value.agentCount} agents`
          );
        } else {
          errors++;
          console.error(
            `[TemplateSyncScheduler] Failed to sync ${template.name}: ${result.error.message}`
          );
        }

        // Update nextSyncAt for next scheduled sync (only if interval is still set)
        // Wrapped separately so sync success isn't affected by schedule update failure
        if (template.syncIntervalMinutes) {
          try {
            const nextSyncAt = calculateNextSyncAt(template.syncIntervalMinutes);
            await db.update(templates).set({ nextSyncAt }).where(eq(templates.id, template.id));
          } catch (updateError) {
            console.error(
              `[TemplateSyncScheduler] Failed to update nextSyncAt for ${template.name}: ${getErrorMessage(updateError)}`
            );
          }
        }
      } catch (error) {
        errors++;
        console.error(
          `[TemplateSyncScheduler] Error syncing ${template.name}: ${getErrorMessage(error)}`
        );
      } finally {
        state.syncInProgress.delete(template.id);
      }
    }
  } catch (error) {
    console.error(`[TemplateSyncScheduler] Error checking templates: ${getErrorMessage(error)}`);
  }

  state.lastCheckAt = now;
  return { synced, errors };
}

/**
 * Start the template sync scheduler
 *
 * Initializes a background interval that periodically checks for templates
 * due for sync and triggers the sync process.
 *
 * @param db - Database instance
 * @param templateService - Template service instance for syncing
 * @returns Cleanup function to stop the scheduler
 */
export function startSyncScheduler(db: Database, templateService: TemplateService): () => void {
  if (state.isRunning) {
    console.warn('[TemplateSyncScheduler] Scheduler already running');
    return () => stopSyncScheduler();
  }

  console.log('[TemplateSyncScheduler] Starting scheduler');
  state.isRunning = true;

  // Run immediately on start
  checkAndSyncTemplates(db, templateService)
    .then(({ synced, errors }) => {
      if (synced > 0 || errors > 0) {
        console.log(`[TemplateSyncScheduler] Initial check: ${synced} synced, ${errors} errors`);
      }
    })
    .catch((error) => {
      console.error(
        `[TemplateSyncScheduler] Critical error during startup sync: ${getErrorMessage(error)}`
      );
    });

  // Set up periodic checking
  state.intervalId = setInterval(async () => {
    try {
      const { synced, errors } = await checkAndSyncTemplates(db, templateService);
      if (synced > 0 || errors > 0) {
        console.log(`[TemplateSyncScheduler] Periodic check: ${synced} synced, ${errors} errors`);
      }
    } catch (error) {
      console.error(
        `[TemplateSyncScheduler] Error during periodic check: ${getErrorMessage(error)}`
      );
    }
  }, SCHEDULER_INTERVAL_MS);

  return () => stopSyncScheduler();
}

/**
 * Stop the template sync scheduler
 *
 * Cleans up the background interval and resets state.
 */
export function stopSyncScheduler(): void {
  if (!state.isRunning) {
    return;
  }

  console.log('[TemplateSyncScheduler] Stopping scheduler');

  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }

  state.isRunning = false;
  state.syncInProgress.clear();
}

/**
 * Get the current scheduler state (for debugging/monitoring)
 */
export function getSchedulerState(): Readonly<{
  isRunning: boolean;
  lastCheckAt: string | null;
  syncInProgressCount: number;
}> {
  return {
    isRunning: state.isRunning,
    lastCheckAt: state.lastCheckAt,
    syncInProgressCount: state.syncInProgress.size,
  };
}
