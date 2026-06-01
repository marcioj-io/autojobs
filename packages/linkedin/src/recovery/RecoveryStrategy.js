"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyRecovery = classifyRecovery;
const TRANSIENT_PATTERNS = [/network error/i, /timeout/i, /server error/i];
const BLOCKED_PATTERNS = [/captcha/i, /deny/i, /forbidden/i, /unusual activity/i, /session expired/i];
function classifyRecovery(error) {
    const message = error instanceof Error ? error.message : String(error);
    if (BLOCKED_PATTERNS.some((pattern) => pattern.test(message))) {
        return { action: 'rotateSession', reason: 'Detected blocked session or anti-bot enforcement.', transient: false };
    }
    if (TRANSIENT_PATTERNS.some((pattern) => pattern.test(message))) {
        return { action: 'retry', reason: 'Transient network or timeout failure.', transient: true };
    }
    return { action: 'refreshSession', reason: 'Unknown failure, refreshing session state.', transient: false };
}
