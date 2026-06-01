export type RecoveryAction = 'retry' | 'refreshSession' | 'rotateSession' | 'abort';
export interface RecoveryRecommendation {
    action: RecoveryAction;
    reason: string;
    transient: boolean;
}
export declare function classifyRecovery(error: unknown): RecoveryRecommendation;
