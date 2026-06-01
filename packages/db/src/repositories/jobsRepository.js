"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobsRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../schema");
class JobsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async createJob(job) {
        await this.db.insert(schema_1.jobs).values(job);
    }
    async getJobById(id) {
        return this.db.select().from(schema_1.jobs).where((0, drizzle_orm_1.eq)(schema_1.jobs.id, id)).get();
    }
    async getJobByUrl(url) {
        return this.db.select().from(schema_1.jobs).where((0, drizzle_orm_1.eq)(schema_1.jobs.url, url)).get();
    }
    async getJobsByStatus(status) {
        return this.db.select().from(schema_1.jobs).where((0, drizzle_orm_1.eq)(schema_1.jobs.status, status)).all();
    }
    async getAllJobs() {
        return this.db.select().from(schema_1.jobs).all();
    }
    async upsertJob(job) {
        const existing = await this.getJobByUrl(job.url);
        if (existing) {
            await this.db
                .update(schema_1.jobs)
                .set({
                company: job.company,
                title: job.title,
                location: job.location,
                score: job.score,
                status: job.status,
                modality: job.modality,
                easyApply: job.easyApply,
                language: job.language,
                profile: job.profile,
                updatedAt: new Date(),
                applyResult: job.applyResult ?? null,
                postedAt: job.postedAt ?? null,
                description: job.description ?? null
            })
                .where((0, drizzle_orm_1.eq)(schema_1.jobs.url, job.url));
        }
        else {
            await this.createJob(job);
        }
    }
    async updateJobStatus(id, status, applyResult) {
        await this.db
            .update(schema_1.jobs)
            .set({ status, applyResult, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.jobs.id, id));
    }
}
exports.JobsRepository = JobsRepository;
