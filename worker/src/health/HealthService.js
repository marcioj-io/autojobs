export class HealthService {
    options;
    constructor(options = { maxConsecutiveFailures: 3, blockedStates: ['BLOCKED'] }) {
        this.options = options;
    }
    determineHealth(state, consecutiveFailures, sessionStatus) {
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
