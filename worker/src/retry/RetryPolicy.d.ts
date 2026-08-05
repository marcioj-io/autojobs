export interface RetryPolicyOptions {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
}
export declare class RetryPolicy {
    private options;
    constructor(options: RetryPolicyOptions);
    private wait;
    private isRetryable;
    execute<T>(fn: () => Promise<T>, onRetry?: (attempt: number, error: unknown, delayMs: number) => Promise<void> | void): Promise<T>;
}
