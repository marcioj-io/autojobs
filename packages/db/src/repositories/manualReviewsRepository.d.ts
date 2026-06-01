import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { ManualReviewModel } from '../schema';
export declare class ManualReviewsRepository {
    private db;
    constructor(db: DrizzleD1Database<any>);
    createReview(review: ManualReviewModel): Promise<void>;
    getReviewById(id: string): Promise<{
        id: string;
        jobId: string;
        profile: string;
        reviewStatus: string;
        reviewReason: string;
        reviewNotes: string | null;
        reviewedAt: Date | null;
        reviewedBy: string | null;
        snoozedUntil: Date | null;
        createdAt: Date;
        updatedAt: Date;
    } | undefined>;
    getPendingReviews(): Promise<{
        id: string;
        jobId: string;
        profile: string;
        reviewStatus: string;
        reviewReason: string;
        reviewNotes: string | null;
        reviewedAt: Date | null;
        reviewedBy: string | null;
        snoozedUntil: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    countReviewsSince(since: Date): Promise<number>;
    getAllReviews(): Promise<{
        id: string;
        jobId: string;
        profile: string;
        reviewStatus: string;
        reviewReason: string;
        reviewNotes: string | null;
        reviewedAt: Date | null;
        reviewedBy: string | null;
        snoozedUntil: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    updateReviewStatus(id: string, reviewStatus: string, payload: Partial<Pick<ManualReviewModel, 'reviewNotes' | 'reviewedBy' | 'reviewedAt' | 'reviewReason' | 'snoozedUntil'>>): Promise<void>;
    snoozeReview(id: string, snoozedUntil: Date): Promise<void>;
}
