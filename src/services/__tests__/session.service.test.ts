import { describe, expect, it, vi } from 'vitest';
import { SessionErrors } from '../../lib/errors/session-errors.js';
import { SessionService } from '../session.service.js';

const createDbMock = () => ({
  query: {
    projects: { findFirst: vi.fn() },
    sessions: { findFirst: vi.fn(), findMany: vi.fn() },
  },
  insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
  update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
});

const createStreamsMock = () => ({
  createStream: vi.fn(),
  publish: vi.fn(),
  subscribe: vi.fn(async function* () {
    yield { type: 'chunk', data: { text: 'hello' } };
  }),
});

describe('SessionService', () => {
  it('creates session and returns active status', async () => {
    const db = createDbMock();
    const streams = createStreamsMock();
    db.query.projects.findFirst.mockResolvedValue({ id: 'p1' });
    db.insert.mockReturnValue({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 's1', status: 'initializing' }]),
      })),
    });

    const service = new SessionService(db as never, streams as never, {
      baseUrl: 'http://localhost:3000',
    });

    const result = await service.create({ projectId: 'p1' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('active');
    }
  });

  it('returns error when session missing', async () => {
    const db = createDbMock();
    const streams = createStreamsMock();
    db.query.sessions.findFirst.mockResolvedValue(null);

    const service = new SessionService(db as never, streams as never, {
      baseUrl: 'http://localhost:3000',
    });

    const result = await service.getById('missing');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual(SessionErrors.NOT_FOUND);
    }
  });

  it('publishes events via streams', async () => {
    const db = createDbMock();
    const streams = createStreamsMock();

    const service = new SessionService(db as never, streams as never, {
      baseUrl: 'http://localhost:3000',
    });

    const result = await service.publish('s1', {
      id: 'e1',
      type: 'chunk',
      timestamp: 1,
      data: { text: 'hi' },
    });

    expect(result.ok).toBe(true);
    expect(streams.publish).toHaveBeenCalled();
  });

  it('subscribe yields events', async () => {
    const db = createDbMock();
    const streams = createStreamsMock();

    const service = new SessionService(db as never, streams as never, {
      baseUrl: 'http://localhost:3000',
    });

    const iterator = service.subscribe('s1');
    const first = await iterator.next();

    expect(first.done).toBe(false);
  });
});
