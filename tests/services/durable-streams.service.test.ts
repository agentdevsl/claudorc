// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DurableStreamsService } from '../../src/services/durable-streams.service';

describe('DurableStreamsService', () => {
  it('includes publish offset in subscriber events', async () => {
    const server = {
      createStream: async () => undefined,
      publish: async () => 7,
      subscribe: async function* () {},
    };

    const service = new DurableStreamsService(server);
    await service.createStream('stream-1', {});

    let received: { offset?: number } | undefined;
    service.addSubscriber('stream-1', (event) => {
      received = event;
    });

    await service.publish('stream-1', 'sandbox:creating', {
      sandboxId: 'sandbox-1',
      projectId: 'project-1',
      image: 'srlynch1/agent-sandbox:latest',
    });

    expect(received?.offset).toBe(7);
  });
});
