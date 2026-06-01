"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfilesRepository = void 0;
// packages\db\src\repositories\profilesRepository.ts
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../schema");
class ProfilesRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async createProfile(profile) {
        await this.db.insert(schema_1.profiles).values(profile);
    }
    async getProfileByName(name) {
        return this.db.select().from(schema_1.profiles).where((0, drizzle_orm_1.eq)(schema_1.profiles.name, name)).get();
    }
    async getAllProfiles() {
        return this.db.select().from(schema_1.profiles).all();
    }
}
exports.ProfilesRepository = ProfilesRepository;
