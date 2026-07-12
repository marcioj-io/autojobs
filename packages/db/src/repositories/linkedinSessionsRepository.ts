// packages\db\src\repositories\linkedinSessionsRepository.ts
import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { linkedinSessions } from '../schema';
import type { LinkedInSessionModel } from '../schema';

export class LinkedInSessionsRepository {
  constructor(private db: DrizzleD1Database<any>) {}

  async getSessionById(id: string) {
    return this.db.select().from(linkedinSessions).where(eq(linkedinSessions.id, id)).get();
  }

  async upsertSession(session: LinkedInSessionModel) {
    const existing = await this.db
      .select()
      .from(linkedinSessions)
      .where(eq(linkedinSessions.profile, session.profile))
      .get();

    if (existing) {
      await this.db
        .update(linkedinSessions)
        .set({
          cookies: session.cookies,
          updatedAt: new Date()
        })
        .where(eq(linkedinSessions.id, existing.id));
    } else {
      await this.db.insert(linkedinSessions).values(session);
    }
  }
  
  async listAll() {
    return this.db.select().from(linkedinSessions).all();
  }
}
