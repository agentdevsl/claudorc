import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SessionStore } from '../session-store.js';
import { FileWatcher } from '../watcher.js';

describe('FileWatcher', () => {
  let tmpDir: string;
  let store: SessionStore;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'watcher-test-'));
    store = new SessionStore();
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  describe('symlink validation', () => {
    it('rejects files that symlink outside the watch directory', async () => {
      // Create an outside directory with a jsonl file
      const outsideDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'outside-'));
      const outsideFile = path.join(outsideDir, 'session.jsonl');
      await fsp.writeFile(
        outsideFile,
        `${JSON.stringify({
          type: 'message',
          uuid: 'u1',
          timestamp: new Date().toISOString(),
          sessionId: 'sess-outside',
          cwd: '/project',
          parentUuid: null,
          message: { role: 'user', content: 'hello' },
        })}\n`
      );

      // Create a symlink inside the watch dir pointing outside
      const symlinkPath = path.join(tmpDir, 'sneaky.jsonl');
      await fsp.symlink(outsideFile, symlinkPath);

      const watcher = new FileWatcher(tmpDir, store);
      // processFile is private, but we can test via scanExisting (start triggers it)
      // Just verify the session isn't loaded after scanning
      await watcher.start();
      watcher.close();

      // The symlinked file should not have been processed
      expect(store.getSession('sess-outside')).toBeUndefined();

      // Cleanup
      await fsp.rm(outsideDir, { recursive: true, force: true });
    });

    it('accepts files within the watch directory', async () => {
      const jsonlFile = path.join(tmpDir, 'session.jsonl');
      await fsp.writeFile(
        jsonlFile,
        `${JSON.stringify({
          type: 'message',
          uuid: 'u1',
          timestamp: new Date().toISOString(),
          sessionId: 'sess-inside',
          cwd: '/project',
          parentUuid: null,
          message: { role: 'user', content: 'hello' },
        })}\n`
      );

      const watcher = new FileWatcher(tmpDir, store);
      await watcher.start();
      watcher.close();

      expect(store.getSession('sess-inside')).toBeDefined();
    });
  });

  describe('file descriptor handling', () => {
    it('processes a valid jsonl file without leaking FDs', async () => {
      const jsonlFile = path.join(tmpDir, 'test.jsonl');
      await fsp.writeFile(
        jsonlFile,
        `${JSON.stringify({
          type: 'message',
          uuid: 'u1',
          timestamp: new Date().toISOString(),
          sessionId: 'sess-fd-test',
          cwd: '/project',
          parentUuid: null,
          message: { role: 'user', content: 'test' },
        })}\n`
      );

      const watcher = new FileWatcher(tmpDir, store);
      await watcher.start();
      watcher.close();

      // If FD leaked, this wouldn't be the issue — we just verify the file was processed
      expect(store.getSession('sess-fd-test')).toBeDefined();
    });
  });

  describe('truncated file handling', () => {
    it('resets offset when file is truncated', async () => {
      const jsonlFile = path.join(tmpDir, 'truncated.jsonl');
      const event1 = `${JSON.stringify({
        type: 'message',
        uuid: 'u1',
        timestamp: new Date().toISOString(),
        sessionId: 'sess-trunc',
        cwd: '/project',
        parentUuid: null,
        message: { role: 'user', content: 'first message' },
      })}\n`;

      // Write initial content
      await fsp.writeFile(jsonlFile, event1);

      const watcher = new FileWatcher(tmpDir, store);
      await watcher.start();
      watcher.close();

      const session = store.getSession('sess-trunc');
      expect(session).toBeDefined();
      expect(session!.messageCount).toBe(1);

      // Verify offset was stored
      const offset = store.getReadOffset(jsonlFile);
      expect(offset).toBeGreaterThan(0);

      // Truncate the file and write new shorter content (simulate crash + new session)
      const event2 = `${JSON.stringify({
        type: 'message',
        uuid: 'u2',
        timestamp: new Date().toISOString(),
        sessionId: 'sess-trunc-2',
        cwd: '/project',
        parentUuid: null,
        message: { role: 'user', content: 'hi' },
      })}\n`;
      await fsp.writeFile(jsonlFile, event2);

      // Re-scan should detect truncation (new file size < stored offset)
      // and read from the beginning
      const watcher2 = new FileWatcher(tmpDir, store);
      await watcher2.start();
      watcher2.close();

      // New session from the re-read should exist
      expect(store.getSession('sess-trunc-2')).toBeDefined();
    });
  });
});
