"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogsRepository = void 0;
const schema_1 = require("../schema");
class LogsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async createLog(entry) {
        await this.db.insert(schema_1.logs).values(entry);
    }
    async getRecentLogs(limit = 50) {
        return this.db.select().from(schema_1.logs).limit(limit).all();
    }
}
exports.LogsRepository = LogsRepository;
