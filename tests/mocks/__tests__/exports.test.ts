// @vitest-environment node
import { describe, expect, it } from 'vitest';

/**
 * Tests to verify that all mock-streams exports are accessible from the mocks index
 */
describe('mock-streams exports', () => {
  it('exports createMockDurableStreamsServer from index', async () => {
    const { createMockDurableStreamsServer } = await import('../index');
    expect(createMockDurableStreamsServer).toBeDefined();
    expect(typeof createMockDurableStreamsServer).toBe('function');
  });

  it('exports createMockDurableStreamsService from index', async () => {
    const { createMockDurableStreamsService } = await import('../index');
    expect(createMockDurableStreamsService).toBeDefined();
    expect(typeof createMockDurableStreamsService).toBe('function');
  });

  it('exports createMockEventCollector from index', async () => {
    const { createMockEventCollector } = await import('../index');
    expect(createMockEventCollector).toBeDefined();
    expect(typeof createMockEventCollector).toBe('function');
  });

  it('exports createMockSSEResponse from index', async () => {
    const { createMockSSEResponse } = await import('../index');
    expect(createMockSSEResponse).toBeDefined();
    expect(typeof createMockSSEResponse).toBe('function');
  });

  it('exports createAgentEvent from index', async () => {
    const { createAgentEvent } = await import('../index');
    expect(createAgentEvent).toBeDefined();
    expect(typeof createAgentEvent).toBe('function');
  });

  it('exports createContainerAgentEvent from index', async () => {
    const { createContainerAgentEvent } = await import('../index');
    expect(createContainerAgentEvent).toBeDefined();
    expect(typeof createContainerAgentEvent).toBe('function');
  });

  it('exports MockEventCollector type from index', async () => {
    const mocks = await import('../index');
    expect(mocks).toHaveProperty('createMockEventCollector');
  });

  it('exports MockSSEResponse type from index', async () => {
    const mocks = await import('../index');
    expect(mocks).toHaveProperty('createMockSSEResponse');
  });

  it('all stream mock functions are callable', async () => {
    const {
      createMockDurableStreamsServer,
      createMockDurableStreamsService,
      createMockEventCollector,
      createMockSSEResponse,
      createAgentEvent,
      createContainerAgentEvent,
    } = await import('../index');

    // Verify they can be called without errors
    expect(() => createMockDurableStreamsServer()).not.toThrow();
    expect(() => createMockDurableStreamsService()).not.toThrow();
    expect(() => createMockEventCollector()).not.toThrow();
    expect(() => createMockSSEResponse()).not.toThrow();
    expect(() => createAgentEvent('agent:started')).not.toThrow();
    expect(() => createContainerAgentEvent('container-agent:started')).not.toThrow();
  });
});
