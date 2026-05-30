import type { D1Database } from '@cloudflare/workers-types';

declare global {
  interface Env {
    AUTOD1: D1Database;
  }
}

export {};
