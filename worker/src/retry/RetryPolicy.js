export class RetryPolicy {
    options;
    constructor(options) {
        this.options = options;
    }
    async wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    isRetryable(error) {
        if (!error || typeof error !== 'object')
            return false;
        const message = error.message ?? String(error);
        return /timeout|ECONNRESET|ETIMEDOUT|network|captcha|checkpoint|rate limit|temporar/i.test(message);
    }
    async execute(fn, onRetry) {
        let attempt = 0;
        let lastError;
        while (attempt < this.options.maxAttempts) {
            try {
                return await fn();
            }
            catch (error) {
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
