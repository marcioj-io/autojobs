// packages/engine/src/applicationCounter.ts
// Serviço simples para consultar contador diário de aplicações por profile.
// Implementação exemplo que chama o Worker endpoint /applications/count
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';

export class ApplicationCounter {
  static async getTodayCount(profileName: string): Promise<number> {
    try {
      const date = new Date().toISOString().slice(0, 10);
      const res = await fetch(`${WORKER_URL}/applications/count?profile=${encodeURIComponent(profileName)}&date=${date}`);
      if (!res.ok) return 0;
      const json = await res.json();
      return json.count || 0;
    } catch (err) {
      console.warn('ApplicationCounter fallback to 0 due to error', err);
      return 0;
    }
  }
}
