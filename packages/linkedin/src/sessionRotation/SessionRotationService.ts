export interface SessionHealthState {
  sessionId: string;
  healthScore: number;
  lastValidatedAt: string;
  status: 'healthy' | 'degraded' | 'rotating';
  reason?: string;
}

export class SessionRotationService {
  private readonly safeThreshold = 65;

  calculateHealthScore(issues: Array<{ type: string; weight: number }>) {
    const score = Math.max(0, 100 - issues.reduce((total, issue) => total + issue.weight, 0));
    return Math.min(100, score);
  }

  evaluate(sessionId: string, issues: Array<{ type: string; weight: number }>) {
    const healthScore = this.calculateHealthScore(issues);
    const status = healthScore >= this.safeThreshold ? 'healthy' : 'degraded';

    return {
      sessionId,
      healthScore,
      lastValidatedAt: new Date().toISOString(),
      status,
      reason: issues.length ? issues.map((issue) => issue.type).join(', ') : 'no issues detected'
    } as SessionHealthState;
  }

  shouldRotate(state: SessionHealthState) {
    return state.healthScore < this.safeThreshold;
  }
}
