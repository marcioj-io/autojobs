"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkedInSessionsRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../schema");
class LinkedInSessionsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async getSessionById(id) {
        return this.db.select().from(schema_1.linkedinSessions).where((0, drizzle_orm_1.eq)(schema_1.linkedinSessions.id, id)).get();
    }
    async upsertSession(session) {
        const existing = await this.getSessionById(session.id);
        if (existing) {
            await this.db
                .update(schema_1.linkedinSessions)
                .set({ cookies: session.cookies, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(schema_1.linkedinSessions.id, session.id));
        }
        else {
            await this.db.insert(schema_1.linkedinSessions).values(session);
        }
    }
    async listAll() {
        return this.db.select().from(schema_1.linkedinSessions).all();
    }
}
exports.LinkedInSessionsRepository = LinkedInSessionsRepository;
