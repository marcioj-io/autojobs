"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewService = void 0;
const manualReviewsRepository_1 = require("../repositories/manualReviewsRepository");
class ReviewService {
    repository;
    constructor(db) {
        this.repository = new manualReviewsRepository_1.ManualReviewsRepository(db);
    }
    async getPendingReviews() {
        return this.repository.getPendingReviews();
    }
    async getReview(id) {
        return this.repository.getReviewById(id);
    }
    async approveReview(id, reviewer, notes) {
        await this.repository.updateReviewStatus(id, 'approved', {
            reviewedBy: reviewer,
            reviewNotes: notes ?? null,
            reviewedAt: new Date(),
            reviewReason: 'Approved by human reviewer'
        });
    }
    async rejectReview(id, reviewer, notes) {
        await this.repository.updateReviewStatus(id, 'rejected', {
            reviewedBy: reviewer,
            reviewNotes: notes ?? null,
            reviewedAt: new Date(),
            reviewReason: 'Rejected by human reviewer'
        });
    }
    async snoozeReview(id, until, reviewer) {
        await this.repository.updateReviewStatus(id, 'pending', {
            reviewedBy: reviewer ?? null,
            reviewedAt: null,
            snoozedUntil: until,
            reviewReason: 'Review snoozed until next cycle'
        });
    }
    async createReview(review) {
        await this.repository.createReview(review);
    }
}
exports.ReviewService = ReviewService;
