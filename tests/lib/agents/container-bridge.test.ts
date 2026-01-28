// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseContainerEvent } from '../../../src/lib/agents/container-bridge';

describe('parseContainerEvent', () => {
  it('defaults missing data to an empty object', () => {
    const line = JSON.stringify({
      type: 'agent:token',
      timestamp: Date.now(),
      taskId: 'task-1',
      sessionId: 'session-1',
    });

    const event = parseContainerEvent(line);

    expect(event).not.toBeNull();
    expect(event?.data).toEqual({});
  });

  it('returns null for invalid events', () => {
    const line = JSON.stringify({
      type: 'agent:token',
      timestamp: Date.now(),
    });

    expect(parseContainerEvent(line)).toBeNull();
  });
});
