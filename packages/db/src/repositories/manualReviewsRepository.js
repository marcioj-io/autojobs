"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManualReviewsRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../schema");
class ManualReviewsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async createReview(review) {
        await this.db.insert(schema_1.manualReviews).values(review);
    }
    async getReviewById(id) {
        return this.db.select().from(schema_1.manualReviews).where((0, drizzle_orm_1.eq)(schema_1.manualReviews.id, id)).get();
    }
    async getPendingReviews() {
        const now = Date.now();
        const reviews = await this.db
            .select()
            .from(schema_1.manualReviews)
            .where((0, drizzle_orm_1.eq)(schema_1.manualReviews.reviewStatus, 'pending'))
            .all();
        return reviews.filter((review) => !review.snoozedUntil || review.snoozedUntil.getTime() <= now);
    }
    async countReviewsSince(since) {
        const result = await this.db
            .select({ count: (0, drizzle_orm_1.count)(schema_1.manualReviews.id).as('count') })
            .from(schema_1.manualReviews)
            .where((0, drizzle_orm_1.gte)(schema_1.manualReviews.createdAt, since))
            .get();
        return Number(result?.count ?? 0);
    }
    async getAllReviews() {
        return this.db.select().from(schema_1.manualReviews).all();
    }
    async updateReviewStatus(id, reviewStatus, payload) {
        const updates = {
            reviewStatus,
            updatedAt: new Date()
        };
        if (payload.reviewNotes !== undefined) {
            updates.reviewNotes = payload.reviewNotes ?? null;
        }
        if (payload.reviewReason !== undefined) {
            updates.reviewReason = payload.reviewReason;
        }
        if (payload.reviewedBy !== undefined) {
            updates.reviewedBy = payload.reviewedBy ?? null;
        }
        if (payload.reviewedAt !== undefined) {
            updates.reviewedAt = payload.reviewedAt ?? null;
        }
        if (payload.snoozedUntil !== undefined) {
            updates.snoozedUntil = payload.snoozedUntil ?? null;
        }
        await this.db.update(schema_1.manualReviews).set(updates).where((0, drizzle_orm_1.eq)(schema_1.manualReviews.id, id));
    }
    async snoozeReview(id, snoozedUntil) {
        await this.db
            .update(schema_1.manualReviews)
            .set({ snoozedUntil, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.manualReviews.id, id));
    }
}
exports.ManualReviewsRepository = ManualReviewsRepository;
