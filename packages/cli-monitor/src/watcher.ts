import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { parseJsonlFile } from './parser.js';
import type { SessionStore } from './session-store.js';

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
      console.log(`Watch directory does not exist yet: ${this.watchDir}`);
      console.log('Will start watching when it appears...');
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
        console.error('[Watcher] fs.watch error:', err);
      });
    } catch (err) {
      console.error('Failed to start file watcher:', err);
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
        // Check if a new directory was created and watch it recursively
        fsp
          .stat(fullPath)
          .then((stat) => {
            if (stat.isDirectory() && !this.linuxWatchers.has(fullPath)) {
              this.startLinuxWatch(fullPath);
            }
          })
          .catch(() => {
            // File/dir may have been deleted
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
      console.error('Error scanning existing files:', err);
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
    try {
      const stat = await fsp.stat(filePath);
      const existingOffset = this.store.getReadOffset(filePath);

      // File truncated or new — read from start
      const offset = stat.size < existingOffset ? 0 : existingOffset;

      if (stat.size <= offset) return; // No new data

      // Read only new bytes
      const fd = await fsp.open(filePath, 'r');
      try {
        const buffer = Buffer.alloc(stat.size - offset);
        await fd.read(buffer, 0, buffer.length, offset);
        const newContent = buffer.toString('utf-8');

        const bytesConsumed = parseJsonlFile(filePath, newContent, offset, this.store);
        this.store.setReadOffset(filePath, offset + bytesConsumed);
      } finally {
        await fd.close();
      }
    } catch (err) {
      // File may have been deleted between detection and read
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        this.store.removeByFilePath(filePath);
      }
    }
  }
}
