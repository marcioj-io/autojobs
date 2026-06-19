// packages\engine\src\sessionManager\fileAdapter.ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { LinkedInSessionAdapter } from '../types';

const DEFAULT_SESSION_DIR = '.linkedin-sessions';

export class FileSessionAdapter implements LinkedInSessionAdapter {
  constructor(private sessionDirectory = DEFAULT_SESSION_DIR) {}

  private getSessionPath(sessionId: string) {
    const directory = resolve(process.cwd(), this.sessionDirectory);
    return join(directory, `${sessionId}.json`);
  }

  async load(sessionId: string): Promise<string | null> {
    const path = this.getSessionPath(sessionId);
    try {
      return await readFile(path, 'utf-8');
    } catch {
      return null;
    }
  }

  async save(sessionId: string, storageState: string): Promise<void> {
    const path = this.getSessionPath(sessionId);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, storageState, 'utf-8');
  }
}
