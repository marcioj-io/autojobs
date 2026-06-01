"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryHistoryRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../schema");
class RetryHistoryRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async createRetry(entry) {
        await this.db.insert(schema_1.retryHistory).values(entry);
    }
    async getRetriesForRun(runId) {
        return this.db.select().from(schema_1.retryHistory).where((0, drizzle_orm_1.eq)(schema_1.retryHistory.runId, runId)).all();
    }
    async getRecentRetries(limit = 50) {
        return this.db.select().from(schema_1.retryHistory).orderBy((0, drizzle_orm_1.desc)(schema_1.retryHistory.timestamp)).limit(limit).all();
    }
}
exports.RetryHistoryRepository = RetryHistoryRepository;
