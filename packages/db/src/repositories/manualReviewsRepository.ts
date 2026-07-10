// packages\db\src\repositories\manualReviewsRepository.ts
import { eq, gte, count } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { manualReviews } from '../schema';
import type { ManualReviewModel } from '../schema';

export class ManualReviewsRepository {
  constructor(private db: DrizzleD1Database<any>) {}

  async createReview(review: ManualReviewModel) {
    await this.db.insert(manualReviews).values(review);
  }

  async getReviewById(id: string) {
    return this.db.select().from(manualReviews).where(eq(manualReviews.id, id)).get();
  }

  async getPendingReviews() {
    const now = Date.now();
    const reviews = await this.db
      .select()
      .from(manualReviews)
      .where(eq(manualReviews.reviewStatus, 'pending'))
      .all();

    return reviews.filter((review) => !review.snoozedUntil || review.snoozedUntil.getTime() <= now);
  }

  async countReviewsSince(since: Date) {
    const result = await this.db
      .select({ count: count(manualReviews.id).as('count') })
      .from(manualReviews)
      .where(gte(manualReviews.createdAt, since))
      .get();

    return Number(result?.count ?? 0);
  }

  async getAllReviews() {
    return this.db.select().from(manualReviews).all();
  }

  async updateReviewStatus(
    id: string,
    reviewStatus: string,
    payload: Partial<Pick<ManualReviewModel, 'reviewNotes' | 'reviewedBy' | 'reviewedAt' | 'reviewReason' | 'snoozedUntil'>>
  ) {
    const updates: Partial<Pick<ManualReviewModel, 'reviewStatus' | 'reviewNotes' | 'reviewReason' | 'reviewedBy' | 'reviewedAt' | 'snoozedUntil' | 'updatedAt'>> = {
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

    await this.db.update(manualReviews).set(updates).where(eq(manualReviews.id, id));
  }

  async snoozeReview(id: string, snoozedUntil: Date) {
    await this.db
      .update(manualReviews)
      .set({ snoozedUntil, updatedAt: new Date() })
      .where(eq(manualReviews.id, id));
  }
}
