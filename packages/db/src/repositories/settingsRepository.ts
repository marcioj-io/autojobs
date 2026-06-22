import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { settings } from '../schema';
import type { SettingsModel } from '../schema';

export class SettingsRepository {
  constructor(private db: DrizzleD1Database<any>) {}

  async getSettings(id: string) {
    return this.db.select().from(settings).where(eq(settings.id, id)).get();
  }

  async upsertSettings(entry: SettingsModel) {
    const existing = await this.getSettings(entry.id);
    if (existing) {
      await this.db.update(settings).set(entry).where(eq(settings.id, entry.id));
      return;
    }

    await this.db.insert(settings).values(entry);
  }
}
