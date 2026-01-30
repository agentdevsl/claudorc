/**
 * Tests for SSE session stream DB replay with fromOffset filtering.
 *
 * Verifies that:
 * - DB replay assigns synthetic offsets when events lack stored offsets
 * - DB replay filters events by fromOffset (same as in-memory path)
 * - Events below fromOffset are skipped during DB replay
 */
import { describe, expect, it } from 'vitest';

describe('SSE DB replay fromOffset filtering', () => {
  // Test the filtering logic directly (extracted from sessions.ts route)
  // This tests the data transformation pipeline without needing full Hono/SSE

  function buildDbEvents(
    count: number
  ): Array<{ type: string; data: unknown; timestamp: number; offset?: number }> {
    return Array.from({ length: count }, (_, i) => ({
      type: `container-agent:turn`,
      data: { turn: i + 1 },
      timestamp: Date.now() + i * 100,
      // Simulate legacy events without offset stored
    }));
  }

  function applyDbReplayFilter(
    dbEvents: Array<{ type: string; data: unknown; timestamp: number; offset?: number }>,
    fromOffset: number
  ) {
    let syntheticOffset = 1;
    const withOffsets = dbEvents.map((dbEvent) => {
      const eventOffset =
        typeof (dbEvent as Record<string, unknown>).offset === 'number'
          ? ((dbEvent as Record<string, unknown>).offset as number)
          : syntheticOffset++;
      return { dbEvent, eventOffset };
    });
    return withOffsets.filter(({ eventOffset }) => eventOffset >= fromOffset);
  }

  it('assigns synthetic offsets to events without stored offsets', () => {
    const events = buildDbEvents(5);
    const filtered = applyDbReplayFilter(events, 0);

    expect(filtered).toHaveLength(5);
    expect(filtered[0].eventOffset).toBe(1);
    expect(filtered[4].eventOffset).toBe(5);
  });

  it('uses stored offsets when available', () => {
    const events = [
      { type: 'container-agent:turn', data: { turn: 1 }, timestamp: Date.now(), offset: 10 },
      { type: 'container-agent:turn', data: { turn: 2 }, timestamp: Date.now(), offset: 20 },
      { type: 'container-agent:turn', data: { turn: 3 }, timestamp: Date.now(), offset: 30 },
    ];
    const filtered = applyDbReplayFilter(events, 15);

    expect(filtered).toHaveLength(2);
    expect(filtered[0].eventOffset).toBe(20);
    expect(filtered[1].eventOffset).toBe(30);
  });

  it('filters events below fromOffset with synthetic offsets', () => {
    const events = buildDbEvents(10);
    const filtered = applyDbReplayFilter(events, 6);

    // Events with synthetic offsets 1-5 should be skipped
    expect(filtered).toHaveLength(5);
    expect(filtered[0].eventOffset).toBe(6);
    expect(filtered[4].eventOffset).toBe(10);
  });

  it('returns empty array when all events are below fromOffset', () => {
    const events = buildDbEvents(3);
    const filtered = applyDbReplayFilter(events, 100);

    expect(filtered).toHaveLength(0);
  });

  it('returns all events when fromOffset is 0', () => {
    const events = buildDbEvents(5);
    const filtered = applyDbReplayFilter(events, 0);

    expect(filtered).toHaveLength(5);
  });

  it('handles mixed stored and synthetic offsets', () => {
    const events = [
      { type: 'container-agent:status', data: {}, timestamp: Date.now() }, // synthetic: 1
      { type: 'container-agent:started', data: {}, timestamp: Date.now(), offset: 5 }, // stored: 5
      { type: 'container-agent:turn', data: {}, timestamp: Date.now() }, // synthetic: 2
    ];
    const filtered = applyDbReplayFilter(events, 3);

    // synthetic 1 < 3 → skip, stored 5 >= 3 → include, synthetic 2 < 3 → skip
    expect(filtered).toHaveLength(1);
    expect(filtered[0].eventOffset).toBe(5);
  });
});
