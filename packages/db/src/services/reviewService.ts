import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { ManualReviewsRepository } from '../repositories/manualReviewsRepository';
import type { ManualReviewModel } from '../schema';

export class ReviewService {
  private repository: ManualReviewsRepository;

  constructor(db: DrizzleD1Database<any>) {
    this.repository = new ManualReviewsRepository(db);
  }

  async getPendingReviews() {
    return this.repository.getPendingReviews();
  }

  async getReview(id: string) {
    return this.repository.getReviewById(id);
  }

  async approveReview(id: string, reviewer: string, notes?: string) {
    await this.repository.updateReviewStatus(id, 'approved', {
      reviewedBy: reviewer,
      reviewNotes: notes ?? null,
      reviewedAt: new Date(),
      reviewReason: 'Approved by human reviewer'
    });
  }

  async rejectReview(id: string, reviewer: string, notes?: string) {
    await this.repository.updateReviewStatus(id, 'rejected', {
      reviewedBy: reviewer,
      reviewNotes: notes ?? null,
      reviewedAt: new Date(),
      reviewReason: 'Rejected by human reviewer'
    });
  }

  async snoozeReview(id: string, until: Date, reviewer?: string) {
    await this.repository.updateReviewStatus(id, 'pending', {
      reviewedBy: reviewer ?? null,
      reviewedAt: null,
      snoozedUntil: until,
      reviewReason: 'Review snoozed until next cycle'
    });
  }

  async createReview(review: ManualReviewModel) {
    await this.repository.createReview(review);
  }
}
