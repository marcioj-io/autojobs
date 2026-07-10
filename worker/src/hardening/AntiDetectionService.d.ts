export declare class AntiDetectionService {
    private lastActionAt;
    getPauseInterval(): number;
    shouldThrottle(): boolean;
    waitBetweenActions(): Promise<void>;
    planInteractionCount(max?: number): number;
}
