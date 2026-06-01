"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionHealthRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../schema");
class SessionHealthRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async createHealthRecord(entry) {
        await this.db.insert(schema_1.sessionHealth).values(entry);
    }
    async getRecentHealth(limit = 20) {
        return this.db.select().from(schema_1.sessionHealth).orderBy((0, drizzle_orm_1.desc)(schema_1.sessionHealth.createdAt)).limit(limit).all();
    }
}
exports.SessionHealthRepository = SessionHealthRepository;
