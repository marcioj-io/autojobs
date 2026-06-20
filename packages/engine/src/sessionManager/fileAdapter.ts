// packages\engine\src\sessionManager\fileAdapter.ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { LinkedInSessionAdapter } from '../types';
import type { Cookie } from 'playwright';

const DEFAULT_SESSION_DIR = '.linkedin-sessions';

export class FileSessionAdapter implements LinkedInSessionAdapter {
  constructor(private sessionDirectory = DEFAULT_SESSION_DIR) {}

  private getSessionPath(sessionId: string) {
    const directory = resolve(process.cwd(), this.sessionDirectory);
    return join(directory, `${sessionId}.json`);
  }

  async load(sessionId: string): Promise<Cookie[] | null> {
    const path = this.getSessionPath(sessionId);

    try {
      const raw = await readFile(path, 'utf-8');
      return JSON.parse(raw) as Cookie[];
    } catch {
      return null;
    }
  }

  async save(sessionId: string, cookies: Cookie[]): Promise<void> {
    const path = this.getSessionPath(sessionId);

    await mkdir(dirname(path), { recursive: true });

    await writeFile(
      path,
      JSON.stringify(cookies, null, 2),
      'utf-8'
    );
  }
}