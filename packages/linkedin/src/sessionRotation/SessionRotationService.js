"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionRotationService = void 0;
class SessionRotationService {
    safeThreshold = 65;
    calculateHealthScore(issues) {
        const score = Math.max(0, 100 - issues.reduce((total, issue) => total + issue.weight, 0));
        return Math.min(100, score);
    }
    evaluate(sessionId, issues) {
        const healthScore = this.calculateHealthScore(issues);
        const status = healthScore >= this.safeThreshold ? 'healthy' : 'degraded';
        return {
            sessionId,
            healthScore,
            lastValidatedAt: new Date().toISOString(),
            status,
            reason: issues.length ? issues.map((issue) => issue.type).join(', ') : 'no issues detected'
        };
    }
    shouldRotate(state) {
        return state.healthScore < this.safeThreshold;
    }
}
exports.SessionRotationService = SessionRotationService;
