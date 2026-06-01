"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationsRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../schema");
class ApplicationsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async createApplication(application) {
        await this.db.insert(schema_1.applications).values(application);
    }
    async listAll() {
        return this.db.select().from(schema_1.applications).all();
    }
    async getById(id) {
        return this.db.select().from(schema_1.applications).where((0, drizzle_orm_1.eq)(schema_1.applications.id, id)).get();
    }
    async getApplicationsByJob(jobId) {
        return this.db.select().from(schema_1.applications).where((0, drizzle_orm_1.eq)(schema_1.applications.jobId, jobId)).all();
    }
    async countApplicationsSince(since, status) {
        const condition = status
            ? (0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)(schema_1.applications.appliedAt, since), (0, drizzle_orm_1.eq)(schema_1.applications.status, status))
            : (0, drizzle_orm_1.gte)(schema_1.applications.appliedAt, since);
        const result = await this.db
            .select({ count: (0, drizzle_orm_1.count)(schema_1.applications.id).as('count') })
            .from(schema_1.applications)
            .where(condition)
            .get();
        return Number(result?.count ?? 0);
    }
}
exports.ApplicationsRepository = ApplicationsRepository;
