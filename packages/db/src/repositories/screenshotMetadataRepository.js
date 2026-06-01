"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScreenshotMetadataRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../schema");
class ScreenshotMetadataRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async createMetadata(entry) {
        await this.db.insert(schema_1.screenshotMetadata).values(entry);
    }
    async getRecentScreenshots(limit = 50) {
        return this.db.select().from(schema_1.screenshotMetadata).orderBy((0, drizzle_orm_1.desc)(schema_1.screenshotMetadata.timestamp)).limit(limit).all();
    }
}
exports.ScreenshotMetadataRepository = ScreenshotMetadataRepository;
