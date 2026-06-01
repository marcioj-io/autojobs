import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { ManualReviewModel } from '../schema';
export declare class ReviewService {
    private repository;
    constructor(db: DrizzleD1Database<any>);
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
    getReview(id: string): Promise<{
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
    approveReview(id: string, reviewer: string, notes?: string): Promise<void>;
    rejectReview(id: string, reviewer: string, notes?: string): Promise<void>;
    snoozeReview(id: string, until: Date, reviewer?: string): Promise<void>;
    createReview(review: ManualReviewModel): Promise<void>;
}
