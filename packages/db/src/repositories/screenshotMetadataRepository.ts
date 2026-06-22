import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { desc } from 'drizzle-orm';
import { screenshotMetadata } from '../schema';
import type { ScreenshotMetadataModel } from '../schema';

export class ScreenshotMetadataRepository {
  constructor(private db: DrizzleD1Database<any>) {}

  async createMetadata(entry: ScreenshotMetadataModel) {
    await this.db.insert(screenshotMetadata).values(entry);
  }

  async getRecentScreenshots(limit = 50) {
    return this.db.select().from(screenshotMetadata).orderBy(desc(screenshotMetadata.timestamp)).limit(limit).all();
  }
}
