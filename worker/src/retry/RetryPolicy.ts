// worker\src\retry\RetryPolicy.ts
export interface RetryPolicyOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export class RetryPolicy {
  constructor(private options: RetryPolicyOptions) {}

  private async wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isRetryable(error: unknown) {
    if (!error || typeof error !== 'object') return false;
    const message = (error as Error).message ?? String(error);
    return /timeout|ECONNRESET|ETIMEDOUT|network|captcha|checkpoint|rate limit|temporar/i.test(message);
  }

  async execute<T>(fn: () => Promise<T>, onRetry?: (attempt: number, error: unknown, delayMs: number) => Promise<void> | void) {
    let attempt = 0;
    let lastError: unknown;

    while (attempt < this.options.maxAttempts) {
      try {
        return await fn();
      } catch (error) {
        attempt += 1;
        lastError = error;
        const shouldRetry = this.isRetryable(error) && attempt < this.options.maxAttempts;
        const delayMs = Math.min(this.options.baseDelayMs * 2 ** (attempt - 1), this.options.maxDelayMs);

        if (onRetry) {
          await onRetry(attempt, error, delayMs);
        }

        if (!shouldRetry) {
          break;
        }

        await this.wait(delayMs);
      }
    }

    throw lastError;
  }
}
