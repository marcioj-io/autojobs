"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogsRepository = void 0;
const schema_1 = require("../schema");
class AuditLogsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async createAuditLog(entry) {
        await this.db.insert(schema_1.auditLogs).values(entry);
    }
    async getRecentAuditLogs(limit = 50) {
        return this.db.select().from(schema_1.auditLogs).limit(limit).all();
    }
}
exports.AuditLogsRepository = AuditLogsRepository;
