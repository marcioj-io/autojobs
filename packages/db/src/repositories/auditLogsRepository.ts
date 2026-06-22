import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { auditLogs } from '../schema';
import type { AuditLogModel } from '../schema';

export class AuditLogsRepository {
  constructor(private db: DrizzleD1Database<any>) {}

  async createAuditLog(entry: AuditLogModel) {
    await this.db.insert(auditLogs).values(entry);
  }

  async getRecentAuditLogs(limit = 50) {
    return this.db.select().from(auditLogs).limit(limit).all();
  }
}
