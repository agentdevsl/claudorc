import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { logger } from './logger.js';
import { parseJsonlFile } from './parser.js';
import type { SessionStore } from './session-store.js';

/** Max bytes to read from a single file in one pass (100MB) */
const MAX_FILE_READ_BYTES = 100 * 1024 * 1024;

export class FileWatcher {
  private watcher: fs.FSWatcher | null = null;
  private linuxWatchers = new Map<string, fs.FSWatcher>();
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly DEBOUNCE_MS = 200;

  constructor(
    private watchDir: string,
    private store: SessionStore
  ) {}

  async start(): Promise<void> {
    // Ensure watch directory exists
    try {
      await fsp.access(this.watchDir);
    } catch {
      logger.info('Watch directory does not exist yet, waiting...', { path: this.watchDir });
      // Poll for directory creation
      await this.waitForDirectory();
    }

    // Initial scan
    await this.scanExisting();

    // Watch for changes — Linux lacks recursive fs.watch support
    if (process.platform === 'linux') {
      await this.startLinuxWatch(this.watchDir);
    } else {
      this.startNativeRecursiveWatch();
    }
  }

  private startNativeRecursiveWatch(): void {
    try {
      this.watcher = fs.watch(this.watchDir, { recursive: true }, (_eventType, filename) => {
        if (!filename || !filename.endsWith('.jsonl')) return;
        const fullPath = path.join(this.watchDir, filename);
        this.debouncedProcess(fullPath);
      });
      this.watcher.on('error', (err) => {
        logger.error('fs.watch error', { error: String(err) });
      });
    } catch (err) {
      logger.error('Failed to start file watcher', { error: String(err) });
    }
  }

  private async startLinuxWatch(dir: string): Promise<void> {
    try {
      const watcher = fs.watch(dir, (_eventType, filename) => {
        if (!filename) return;
        const fullPath = path.join(dir, filename);
        if (filename.endsWith('.jsonl')) {
          this.debouncedProcess(fullPath);
        }
        // Check if a new directory was created and watch it recursively,
        // or if a directory was deleted and we should clean up its watcher.
        fsp
          .stat(fullPath)
          .then((stat) => {
            if (stat.isDirectory() && !this.linuxWatchers.has(fullPath)) {
              this.startLinuxWatch(fullPath);
            }
          })
          .catch(() => {
            // File/dir may have been deleted — clean up its watcher if tracked
            const existingWatcher = this.linuxWatchers.get(fullPath);
            if (existingWatcher) {
              existingWatcher.close();
              this.linuxWatchers.delete(fullPath);
            }
          });
      });
      this.linuxWatchers.set(dir, watcher);

      // Recurse into existing subdirectories
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await this.startLinuxWatch(path.join(dir, entry.name));
        }
      }
    } catch {
      // Directory may not exist or permission denied
    }
  }

  close(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    for (const w of this.linuxWatchers.values()) {
      w.close();
    }
    this.linuxWatchers.clear();
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  private async waitForDirectory(): Promise<void> {
    const MAX_WAIT_MS = 5 * 60 * 1000;
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      const check = async () => {
        try {
          await fsp.access(this.watchDir);
          resolve();
        } catch {
          if (Date.now() - startTime > MAX_WAIT_MS) {
            reject(new Error(`Watch directory ${this.watchDir} not found after 5 minutes`));
            return;
          }
          setTimeout(check, 5000);
        }
      };
      check();
    });
  }

  private debouncedProcess(filePath: string): void {
    const existing = this.debounceTimers.get(filePath);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(
      filePath,
      setTimeout(async () => {
        this.debounceTimers.delete(filePath);
        await this.processFile(filePath);
      }, this.DEBOUNCE_MS)
    );
  }

  private async scanExisting(): Promise<void> {
    try {
      const entries = await this.walkJsonlFiles(this.watchDir);
      for (const filePath of entries) {
        await this.processFile(filePath);
      }
    } catch (err) {
      logger.error('Error scanning existing files', { error: String(err) });
    }
  }

  private async walkJsonlFiles(dir: string): Promise<string[]> {
    const results: string[] = [];
    try {
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const nested = await this.walkJsonlFiles(fullPath);
          results.push(...nested);
        } else if (entry.name.endsWith('.jsonl')) {
          results.push(fullPath);
        }
      }
    } catch {
      // Permission denied or deleted during scan
    }
    return results;
  }

  private async processFile(filePath: string): Promise<void> {
    // Validate path is within watch directory, resolving symlinks
    let realFile: string;
    let realWatchDir: string;
    try {
      realFile = await fsp.realpath(filePath);
      realWatchDir = await fsp.realpath(this.watchDir);
    } catch {
      // File or directory may not exist
      return;
    }
    if (!realFile.startsWith(realWatchDir + path.sep) && realFile !== realWatchDir) {
      logger.warn('Skipping file outside watch directory (symlink resolved)', { filePath });
      return;
    }

    try {
      const stat = await fsp.stat(filePath);
      const existingOffset = this.store.getReadOffset(filePath);

      // File truncated or new — read from start
      const offset = stat.size < existingOffset ? 0 : existingOffset;

      if (stat.size <= offset) return; // No new data

      const bytesToRead = stat.size - offset;
      if (bytesToRead > MAX_FILE_READ_BYTES) {
        logger.warn('File exceeds max read size, reading last chunk only', {
          filePath,
          fileSize: stat.size,
          maxBytes: MAX_FILE_READ_BYTES,
        });
      }
      const readSize = Math.min(bytesToRead, MAX_FILE_READ_BYTES);
      const readOffset =
        bytesToRead > MAX_FILE_READ_BYTES ? stat.size - MAX_FILE_READ_BYTES : offset;

      // Read only new bytes
      const fd = await fsp.open(filePath, 'r');
      try {
        let buffer = Buffer.alloc(readSize);
        await fd.read(buffer, 0, buffer.length, readOffset);

        // Skip leading UTF-8 continuation bytes (0x80-0xBF) that result from
        // reading mid-character when the offset splits a multi-byte sequence
        let skip = 0;
        while (skip < buffer.length && ((buffer[skip] ?? 0) & 0xc0) === 0x80) {
          skip++;
        }
        if (skip > 0) {
          buffer = buffer.subarray(skip);
        }

        const newContent = buffer.toString('utf-8');

        const bytesConsumed = parseJsonlFile(filePath, newContent, readOffset, this.store);
        this.store.setReadOffset(filePath, readOffset + bytesConsumed);
      } finally {
        await fd.close();
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        // File deleted between detection and read
        this.store.removeByFilePath(filePath);
      } else if (code === 'EACCES' || code === 'EPERM') {
        logger.warn('Permission denied reading file, skipping', { filePath, code });
      }
    }
  }
}
