"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeStateRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../schema");
class RuntimeStateRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async getState(id) {
        return this.db.select().from(schema_1.runtimeState).where((0, drizzle_orm_1.eq)(schema_1.runtimeState.id, id)).get();
    }
    async upsertState(state) {
        const existing = await this.getState(state.id);
        if (existing) {
            await this.db.update(schema_1.runtimeState).set(state).where((0, drizzle_orm_1.eq)(schema_1.runtimeState.id, state.id));
        }
        else {
            await this.db.insert(schema_1.runtimeState).values(state);
        }
    }
    async patchState(id, patch) {
        await this.db.update(schema_1.runtimeState).set(patch).where((0, drizzle_orm_1.eq)(schema_1.runtimeState.id, id));
    }
}
exports.RuntimeStateRepository = RuntimeStateRepository;
