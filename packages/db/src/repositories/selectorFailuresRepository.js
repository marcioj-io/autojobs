"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectorFailuresRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../schema");
class SelectorFailuresRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async createFailure(entry) {
        await this.db.insert(schema_1.selectorFailures).values(entry);
    }
    async getRecentFailures(limit = 50) {
        return this.db.select().from(schema_1.selectorFailures).orderBy((0, drizzle_orm_1.desc)(schema_1.selectorFailures.timestamp)).limit(limit).all();
    }
}
exports.SelectorFailuresRepository = SelectorFailuresRepository;
