"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeMetricsRepository = void 0;
const schema_1 = require("../schema");
class RuntimeMetricsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async createMetric(metric) {
        await this.db.insert(schema_1.runtimeMetrics).values(metric);
    }
    async getRecentMetrics(limit = 20) {
        return this.db.select().from(schema_1.runtimeMetrics).limit(limit).all();
    }
}
exports.RuntimeMetricsRepository = RuntimeMetricsRepository;
