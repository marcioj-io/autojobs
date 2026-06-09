// packages\db\src\services\auditLogsService.ts
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { AuditLogsRepository } from '../repositories/auditLogsRepository';
import type { AuditLogModel } from '../schema';

export class AuditLogsService {
  private repository: AuditLogsRepository;

  constructor(db: DrizzleD1Database<any>) {
    this.repository = new AuditLogsRepository(db);
  }

  async recordAuditLog(entry: Omit<AuditLogModel, 'id' | 'createdAt'>) {
    await this.repository.createAuditLog({
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date()
    });
  }

  async getRecentAuditLogs(limit = 50) {
    return this.repository.getRecentAuditLogs(limit);
  }
}
