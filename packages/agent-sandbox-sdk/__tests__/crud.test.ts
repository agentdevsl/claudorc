import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentSandboxError, AlreadyExistsError, NotFoundError } from '../src/errors.js';
import { CustomResourceCrud } from '../src/operations/crud.js';
import type { CRDResource } from '../src/types/common.js';

// Use vi.hoisted so mock objects are available inside the vi.mock factory
const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    createNamespacedCustomObject: vi.fn(),
    getNamespacedCustomObject: vi.fn(),
    listNamespacedCustomObject: vi.fn(),
    listClusterCustomObject: vi.fn(),
    replaceNamespacedCustomObject: vi.fn(),
    patchNamespacedCustomObject: vi.fn(),
    deleteNamespacedCustomObject: vi.fn(),
  },
}));

vi.mock('@kubernetes/client-node', () => ({
  CustomObjectsApi: class MockCustomObjectsApi {},
  KubeConfig: class MockKubeConfig {
    makeApiClient() {
      return mockApi;
    }
  },
}));

import { KubeConfig } from '@kubernetes/client-node';

const crudConfig = {
  group: 'agents.x-k8s.io',
  version: 'v1alpha1',
  plural: 'sandboxes',
};

function makeCrud() {
  const kc = new KubeConfig();
  return new CustomResourceCrud<CRDResource>(kc, crudConfig);
}

function makeResource(name = 'test'): CRDResource {
  return {
    apiVersion: 'agents.x-k8s.io/v1alpha1',
    kind: 'Sandbox',
    metadata: { name },
    spec: {},
  };
}

describe('CustomResourceCrud', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('creates a resource and returns it', async () => {
      const resource = makeResource();
      mockApi.createNamespacedCustomObject.mockResolvedValue(resource);

      const crud = makeCrud();
      const result = await crud.create('default', resource);

      expect(result).toEqual(resource);
      expect(mockApi.createNamespacedCustomObject).toHaveBeenCalledWith({
        group: 'agents.x-k8s.io',
        version: 'v1alpha1',
        namespace: 'default',
        plural: 'sandboxes',
        body: resource,
      });
    });

    it('throws AlreadyExistsError on 409', async () => {
      mockApi.createNamespacedCustomObject.mockRejectedValue({
        statusCode: 409,
      });

      const crud = makeCrud();
      await expect(crud.create('default', makeResource())).rejects.toThrow(AlreadyExistsError);
    });

    it('AlreadyExistsError contains kind and name', async () => {
      mockApi.createNamespacedCustomObject.mockRejectedValue({
        statusCode: 409,
      });

      const crud = makeCrud();
      try {
        await crud.create('default', makeResource('my-sandbox'));
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AlreadyExistsError);
        expect((err as AlreadyExistsError).code).toBe('ALREADY_EXISTS');
        expect((err as AlreadyExistsError).statusCode).toBe(409);
        expect((err as AlreadyExistsError).message).toContain('my-sandbox');
      }
    });

    it('wraps unknown errors as AgentSandboxError', async () => {
      mockApi.createNamespacedCustomObject.mockRejectedValue(new Error('network failure'));

      const crud = makeCrud();
      try {
        await crud.create('default', makeResource());
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentSandboxError);
        expect((err as AgentSandboxError).code).toBe('K8S_API_ERROR');
        expect((err as AgentSandboxError).message).toContain('network failure');
      }
    });

    it('wraps non-Error rejections as AgentSandboxError', async () => {
      mockApi.createNamespacedCustomObject.mockRejectedValue('string error');

      const crud = makeCrud();
      try {
        await crud.create('default', makeResource());
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentSandboxError);
        expect((err as AgentSandboxError).message).toContain('string error');
      }
    });

    it('preserves statusCode from HTTP errors in wrapped error', async () => {
      mockApi.createNamespacedCustomObject.mockRejectedValue({
        statusCode: 500,
        message: 'internal server error',
      });

      const crud = makeCrud();
      try {
        await crud.create('default', makeResource());
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentSandboxError);
        expect((err as AgentSandboxError).statusCode).toBe(500);
      }
    });
  });

  describe('get', () => {
    it('gets a resource by name', async () => {
      const resource = makeResource();
      mockApi.getNamespacedCustomObject.mockResolvedValue(resource);

      const crud = makeCrud();
      const result = await crud.get('default', 'test');

      expect(result).toEqual(resource);
      expect(mockApi.getNamespacedCustomObject).toHaveBeenCalledWith({
        group: 'agents.x-k8s.io',
        version: 'v1alpha1',
        namespace: 'default',
        plural: 'sandboxes',
        name: 'test',
      });
    });

    it('throws NotFoundError on 404', async () => {
      mockApi.getNamespacedCustomObject.mockRejectedValue({ statusCode: 404 });

      const crud = makeCrud();
      await expect(crud.get('default', 'missing')).rejects.toThrow(NotFoundError);
    });

    it('NotFoundError contains resource details', async () => {
      mockApi.getNamespacedCustomObject.mockRejectedValue({ statusCode: 404 });

      const crud = makeCrud();
      try {
        await crud.get('my-ns', 'my-resource');
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundError);
        expect((err as NotFoundError).code).toBe('NOT_FOUND');
        expect((err as NotFoundError).statusCode).toBe(404);
        expect((err as NotFoundError).message).toContain('sandboxes');
        expect((err as NotFoundError).message).toContain('my-resource');
        expect((err as NotFoundError).message).toContain('my-ns');
      }
    });

    it('wraps non-404 errors as AgentSandboxError', async () => {
      mockApi.getNamespacedCustomObject.mockRejectedValue({ statusCode: 503 });

      const crud = makeCrud();
      try {
        await crud.get('default', 'test');
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentSandboxError);
        expect(err).not.toBeInstanceOf(NotFoundError);
      }
    });
  });

  describe('list', () => {
    it('lists resources in a namespace', async () => {
      const list = {
        apiVersion: 'agents.x-k8s.io/v1alpha1',
        kind: 'SandboxList',
        metadata: {},
        items: [makeResource('a'), makeResource('b')],
      };
      mockApi.listNamespacedCustomObject.mockResolvedValue(list);

      const crud = makeCrud();
      const result = await crud.list({ namespace: 'default' });

      expect(result).toEqual(list);
      expect(result.items).toHaveLength(2);
    });

    it('lists resources cluster-wide when no namespace', async () => {
      const list = {
        apiVersion: 'agents.x-k8s.io/v1alpha1',
        kind: 'SandboxList',
        metadata: {},
        items: [],
      };
      mockApi.listClusterCustomObject.mockResolvedValue(list);

      const crud = makeCrud();
      const result = await crud.list();

      expect(result).toEqual(list);
      expect(mockApi.listClusterCustomObject).toHaveBeenCalled();
      expect(mockApi.listNamespacedCustomObject).not.toHaveBeenCalled();
    });

    it('passes label and field selectors', async () => {
      mockApi.listNamespacedCustomObject.mockResolvedValue({
        items: [],
        metadata: {},
      });

      const crud = makeCrud();
      await crud.list({
        namespace: 'default',
        labelSelector: 'app=test',
        fieldSelector: 'metadata.name=foo',
        limit: 10,
      });

      expect(mockApi.listNamespacedCustomObject).toHaveBeenCalledWith(
        expect.objectContaining({
          labelSelector: 'app=test',
          fieldSelector: 'metadata.name=foo',
          limit: 10,
        })
      );
    });

    it('passes continue token for pagination', async () => {
      mockApi.listNamespacedCustomObject.mockResolvedValue({
        items: [],
        metadata: { continue: 'token2' },
      });

      const crud = makeCrud();
      await crud.list({
        namespace: 'default',
        continueToken: 'token1',
      });

      expect(mockApi.listNamespacedCustomObject).toHaveBeenCalledWith(
        expect.objectContaining({
          _continue: 'token1',
        })
      );
    });

    it('wraps list errors as AgentSandboxError', async () => {
      mockApi.listNamespacedCustomObject.mockRejectedValue(new Error('forbidden'));

      const crud = makeCrud();
      try {
        await crud.list({ namespace: 'default' });
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentSandboxError);
        expect((err as AgentSandboxError).message).toContain('list failed');
      }
    });
  });

  describe('update', () => {
    it('replaces a resource', async () => {
      const resource = {
        ...makeResource(),
        spec: { replicas: 1 },
      };
      mockApi.replaceNamespacedCustomObject.mockResolvedValue(resource);

      const crud = makeCrud();
      const result = await crud.update('default', 'test', resource);

      expect(result).toEqual(resource);
      expect(mockApi.replaceNamespacedCustomObject).toHaveBeenCalledWith({
        group: 'agents.x-k8s.io',
        version: 'v1alpha1',
        namespace: 'default',
        plural: 'sandboxes',
        name: 'test',
        body: resource,
      });
    });

    it('throws NotFoundError on 404', async () => {
      mockApi.replaceNamespacedCustomObject.mockRejectedValue({
        statusCode: 404,
      });

      const crud = makeCrud();
      await expect(crud.update('default', 'missing', makeResource('missing'))).rejects.toThrow(
        NotFoundError
      );
    });

    it('wraps other errors as AgentSandboxError', async () => {
      mockApi.replaceNamespacedCustomObject.mockRejectedValue({
        statusCode: 422,
        message: 'unprocessable',
      });

      const crud = makeCrud();
      try {
        await crud.update('default', 'test', makeResource());
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentSandboxError);
        expect((err as AgentSandboxError).statusCode).toBe(422);
      }
    });
  });

  describe('patch', () => {
    it('patches a resource', async () => {
      const patched = {
        ...makeResource(),
        spec: { replicas: 0 },
      };
      mockApi.patchNamespacedCustomObject.mockResolvedValue(patched);

      const crud = makeCrud();
      const result = await crud.patch('default', 'test', {
        spec: { replicas: 0 },
      } as any);

      expect(result.spec).toEqual({ replicas: 0 });
      expect(mockApi.patchNamespacedCustomObject).toHaveBeenCalledWith({
        group: 'agents.x-k8s.io',
        version: 'v1alpha1',
        namespace: 'default',
        plural: 'sandboxes',
        name: 'test',
        body: { spec: { replicas: 0 } },
      });
    });

    it('throws NotFoundError on 404', async () => {
      mockApi.patchNamespacedCustomObject.mockRejectedValue({
        statusCode: 404,
      });

      const crud = makeCrud();
      await expect(crud.patch('default', 'missing', {} as any)).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('deletes a resource', async () => {
      mockApi.deleteNamespacedCustomObject.mockResolvedValue({});

      const crud = makeCrud();
      await expect(crud.delete('default', 'test')).resolves.toBeUndefined();
      expect(mockApi.deleteNamespacedCustomObject).toHaveBeenCalledWith({
        group: 'agents.x-k8s.io',
        version: 'v1alpha1',
        namespace: 'default',
        plural: 'sandboxes',
        name: 'test',
      });
    });

    it('throws NotFoundError on 404', async () => {
      mockApi.deleteNamespacedCustomObject.mockRejectedValue({
        statusCode: 404,
      });

      const crud = makeCrud();
      await expect(crud.delete('default', 'missing')).rejects.toThrow(NotFoundError);
    });

    it('wraps other errors as AgentSandboxError', async () => {
      mockApi.deleteNamespacedCustomObject.mockRejectedValue({
        statusCode: 403,
        message: 'forbidden',
      });

      const crud = makeCrud();
      try {
        await crud.delete('default', 'test');
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentSandboxError);
        expect((err as AgentSandboxError).statusCode).toBe(403);
      }
    });
  });

  describe('exists', () => {
    it('returns true when resource exists', async () => {
      mockApi.getNamespacedCustomObject.mockResolvedValue(makeResource());

      const crud = makeCrud();
      expect(await crud.exists('default', 'test')).toBe(true);
    });

    it('returns false when resource does not exist (404)', async () => {
      mockApi.getNamespacedCustomObject.mockRejectedValue({ statusCode: 404 });

      const crud = makeCrud();
      expect(await crud.exists('default', 'missing')).toBe(false);
    });

    it('rethrows non-NotFound errors', async () => {
      mockApi.getNamespacedCustomObject.mockRejectedValue({ statusCode: 500 });

      const crud = makeCrud();
      await expect(crud.exists('default', 'test')).rejects.toThrow(AgentSandboxError);
    });
  });
});
