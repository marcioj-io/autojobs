"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeHistoryRepository = void 0;
const schema_1 = require("../schema");
class RuntimeHistoryRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async createHistory(entry) {
        await this.db.insert(schema_1.runtimeHistory).values(entry);
    }
    async getRecentHistory(limit = 20) {
        return this.db.select().from(schema_1.runtimeHistory).limit(limit).all();
    }
}
exports.RuntimeHistoryRepository = RuntimeHistoryRepository;
