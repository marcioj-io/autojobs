"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogsService = void 0;
const auditLogsRepository_1 = require("../repositories/auditLogsRepository");
class AuditLogsService {
    repository;
    constructor(db) {
        this.repository = new auditLogsRepository_1.AuditLogsRepository(db);
    }
    async recordAuditLog(entry) {
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
exports.AuditLogsService = AuditLogsService;
