"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnomalyLogsRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../schema");
class AnomalyLogsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async createAnomaly(entry) {
        await this.db.insert(schema_1.anomalyLogs).values(entry);
    }
    async getRecentAnomalies(limit = 50) {
        return this.db.select().from(schema_1.anomalyLogs).orderBy((0, drizzle_orm_1.desc)(schema_1.anomalyLogs.timestamp)).limit(limit).all();
    }
}
exports.AnomalyLogsRepository = AnomalyLogsRepository;
