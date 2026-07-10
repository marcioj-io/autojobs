export class AntiDetectionService {
    lastActionAt = Date.now();
    getPauseInterval() {
        const base = 1200 + Math.floor(Math.random() * 1800);
        return base + Math.floor(Math.random() * 900);
    }
    shouldThrottle() {
        if (Date.now() - this.lastActionAt < 1000) {
            return true;
        }
        this.lastActionAt = Date.now();
        return false;
    }
    async waitBetweenActions() {
        const delay = this.getPauseInterval();
        await new Promise((resolve) => setTimeout(resolve, delay));
    }
    planInteractionCount(max = 5) {
        return 1 + Math.floor(Math.random() * max);
    }
}
