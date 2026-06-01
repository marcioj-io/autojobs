"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../schema");
class SettingsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async getSettings(id) {
        return this.db.select().from(schema_1.settings).where((0, drizzle_orm_1.eq)(schema_1.settings.id, id)).get();
    }
    async upsertSettings(entry) {
        const existing = await this.getSettings(entry.id);
        if (existing) {
            await this.db.update(schema_1.settings).set(entry).where((0, drizzle_orm_1.eq)(schema_1.settings.id, entry.id));
            return;
        }
        await this.db.insert(schema_1.settings).values(entry);
    }
}
exports.SettingsRepository = SettingsRepository;
