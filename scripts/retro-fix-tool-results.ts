#!/usr/bin/env bun
/**
 * Retroactive fix for missing container-agent:tool:result events
 *
 * This script finds all container-agent:tool:start events that don't have
 * matching tool:result events and creates synthetic result events for them.
 */

import { Database } from 'bun:sqlite';
import { createId } from '@paralleldrive/cuid2';

const DB_PATH = 'data/agentpane.db';

interface ToolStartEvent {
  id: string;
  session_id: string;
  timestamp: number;
  tool_id: string;
  tool_name: string;
}

function main() {
  console.log('\n🔧 Retroactive Tool Result Fix\n');
  console.log('─'.repeat(50));

  const db = new Database(DB_PATH);

  // Find orphaned tool:start events
  const orphanedStarts = db
    .query(`
    SELECT
      se.id,
      se.session_id,
      se.timestamp,
      json_extract(se.data, '$.toolId') as tool_id,
      json_extract(se.data, '$.toolName') as tool_name,
      se.data
    FROM session_events se
    WHERE se.type = 'container-agent:tool:start'
    AND NOT EXISTS (
      SELECT 1 FROM session_events se2
      WHERE se2.type = 'container-agent:tool:result'
      AND json_extract(se2.data, '$.toolId') = json_extract(se.data, '$.toolId')
    )
  `)
    .all() as (ToolStartEvent & { data: string })[];

  console.log(`\nFound ${orphanedStarts.length} tool:start events without matching results\n`);

  if (orphanedStarts.length === 0) {
    console.log('✅ Nothing to fix!\n');
    db.close();
    return;
  }

  // Group by session for display
  const bySession = new Map<string, (ToolStartEvent & { data: string })[]>();
  for (const event of orphanedStarts) {
    const list = bySession.get(event.session_id) || [];
    list.push(event);
    bySession.set(event.session_id, list);
  }

  console.log('Sessions affected:');
  for (const [sessionId, events] of bySession) {
    console.log(`  • ${sessionId.slice(0, 8)}... (${events.length} tools)`);
  }
  console.log('');

  // Find the next event after each tool:start to estimate duration
  const getNextEventTime = db.prepare(`
    SELECT timestamp FROM session_events
    WHERE session_id = ? AND timestamp > ?
    ORDER BY timestamp ASC
    LIMIT 1
  `);

  // Get max offset for a session
  const getMaxOffset = db.prepare(`
    SELECT COALESCE(MAX(offset), 0) as max_offset
    FROM session_events
    WHERE session_id = ?
  `);

  // Insert statement for new events (include all required columns)
  const insertEvent = db.prepare(`
    INSERT INTO session_events (id, session_id, offset, type, channel, data, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Track offsets per session
  const sessionOffsets = new Map<string, number>();

  // Process in a transaction
  let created = 0;
  db.run('BEGIN TRANSACTION');

  try {
    for (const startEvent of orphanedStarts) {
      // Find next event to estimate when tool completed
      const nextEvent = getNextEventTime.get(startEvent.session_id, startEvent.timestamp) as {
        timestamp: number;
      } | null;

      // Use next event time or add 1 second if no next event
      const resultTimestamp = nextEvent?.timestamp ?? startEvent.timestamp + 1000;
      const durationMs = resultTimestamp - startEvent.timestamp;

      // Parse original data to preserve input
      const originalData = JSON.parse(startEvent.data);

      // Create result event data
      const resultData = {
        toolId: startEvent.tool_id,
        toolName: startEvent.tool_name,
        input: originalData.input || {},
        result: '(retroactively marked as complete)',
        isError: false,
        durationMs: durationMs,
        taskId: originalData.taskId,
        sessionId: originalData.sessionId,
        projectId: originalData.projectId,
      };

      // Get next offset for this session
      let offset = sessionOffsets.get(startEvent.session_id);
      if (offset === undefined) {
        const result = getMaxOffset.get(startEvent.session_id) as { max_offset: number };
        offset = result.max_offset;
      }
      offset++;
      sessionOffsets.set(startEvent.session_id, offset);

      // Insert the result event
      const newId = createId();
      insertEvent.run(
        newId,
        startEvent.session_id,
        offset,
        'container-agent:tool:result',
        'default', // channel
        JSON.stringify(resultData),
        resultTimestamp
      );

      created++;
      console.log(
        `  ✓ Created result for ${startEvent.tool_name} (${startEvent.tool_id.slice(0, 12)}...)`
      );
    }

    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }

  console.log('');
  console.log('─'.repeat(50));
  console.log(`\n✅ Created ${created} synthetic tool:result events\n`);

  // Verify
  const remaining = db
    .query(`
    SELECT COUNT(*) as count
    FROM session_events se
    WHERE se.type = 'container-agent:tool:start'
    AND NOT EXISTS (
      SELECT 1 FROM session_events se2
      WHERE se2.type = 'container-agent:tool:result'
      AND json_extract(se2.data, '$.toolId') = json_extract(se.data, '$.toolId')
    )
  `)
    .get() as { count: number };

  console.log(`Verification: ${remaining.count} orphaned tool:start events remaining\n`);

  db.close();
}

main();
