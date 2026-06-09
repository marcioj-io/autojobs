import { HealthStatus, RuntimeStateType } from "@autojobs/shared";

interface HealthOptions {
  maxConsecutiveFailures: number;
  blockedStates: RuntimeStateType[];
}

export class HealthService {
  constructor(private options: HealthOptions = { maxConsecutiveFailures: 3, blockedStates: ['BLOCKED'] }) {}

  determineHealth(state: RuntimeStateType, consecutiveFailures: number, sessionStatus?: string | null): HealthStatus {
    if (this.options.blockedStates.includes(state)) {
      return 'blocked';
    }

    if (consecutiveFailures >= this.options.maxConsecutiveFailures) {
      return 'degraded';
    }

    if (sessionStatus && sessionStatus !== 'active') {
      return 'warning';
    }

    if (state === 'ERROR') {
      return 'warning';
    }

    return 'healthy';
  }
}
