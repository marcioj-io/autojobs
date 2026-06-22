export type RecoveryAction = 'retry' | 'refreshSession' | 'rotateSession' | 'abort';

export interface RecoveryRecommendation {
  action: RecoveryAction;
  reason: string;
  transient: boolean;
}

const TRANSIENT_PATTERNS = [/network error/i, /timeout/i, /server error/i];
const BLOCKED_PATTERNS = [/captcha/i, /deny/i, /forbidden/i, /unusual activity/i, /session expired/i];

export function classifyRecovery(error: unknown): RecoveryRecommendation {
  const message = error instanceof Error ? error.message : String(error);

  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(message))) {
    return { action: 'rotateSession', reason: 'Detected blocked session or anti-bot enforcement.', transient: false };
  }

  if (TRANSIENT_PATTERNS.some((pattern) => pattern.test(message))) {
    return { action: 'retry', reason: 'Transient network or timeout failure.', transient: true };
  }

  return { action: 'refreshSession', reason: 'Unknown failure, refreshing session state.', transient: false };
}
