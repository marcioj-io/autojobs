// packages\engine\src\apply\resumeSelector.ts
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

export function getResumePath(profile?: string): string | undefined {
  const explicit = process.env.LINKEDIN_CV_PATH;
  if (explicit && existsSync(explicit)) {
    return resolve(explicit);
  }

  if (!profile) {
    return undefined;
  }

  const profileKey = profile.toUpperCase();
  const envKey = `LINKEDIN_CV_${profileKey}`;
  const candidate = process.env[envKey];
  if (candidate && existsSync(candidate)) {
    return resolve(candidate);
  }

  return undefined;
}
