export interface SessionHealthState {
    sessionId: string;
    healthScore: number;
    lastValidatedAt: string;
    status: 'healthy' | 'degraded' | 'rotating';
    reason?: string;
}
export declare class SessionRotationService {
    private readonly safeThreshold;
    calculateHealthScore(issues: Array<{
        type: string;
        weight: number;
    }>): number;
    evaluate(sessionId: string, issues: Array<{
        type: string;
        weight: number;
    }>): SessionHealthState;
    shouldRotate(state: SessionHealthState): boolean;
}
