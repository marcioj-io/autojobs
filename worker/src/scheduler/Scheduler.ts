// worker\src\scheduler\Scheduler.ts
interface SchedulerWindow {
  name: string;
  startHour: number;
  endHour: number;
}

interface SchedulerConfig {
  cooldownMs: number;
  errorCooldownMs: number;
  minRandomDelayMs: number;
  maxRandomDelayMs: number;
}

const scheduleWindows: SchedulerWindow[] = [
  { name: 'morning', startHour: 8, endHour: 10 },
  { name: 'afternoon', startHour: 14, endHour: 16 },
  { name: 'night', startHour: 20, endHour: 22 }
];

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class Scheduler {
  constructor(private config: SchedulerConfig) {}

  getNextExecutionTime(now = new Date(), cooldownUntil?: Date | null) {
    if (cooldownUntil && cooldownUntil > now) {
      return cooldownUntil;
    }

    const candidateTimes = scheduleWindows
      .map((window) => {
        const windowStart = new Date(now);
        windowStart.setHours(window.startHour, 0, 0, 0);
        const offsetMinutes = randomBetween(0, 30);
        windowStart.setMinutes(windowStart.getMinutes() + offsetMinutes);
        return windowStart;
      })
      .filter((date) => date > now);

    const nextCandidate = candidateTimes.sort((a, b) => a.getTime() - b.getTime())[0];
    if (nextCandidate) {
      return nextCandidate;
    }

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(scheduleWindows[0].startHour, randomBetween(0, 30), 0, 0);
    return tomorrow;
  }

  getCooldownTime(now = new Date()) {
    const randomDelay = randomBetween(this.config.minRandomDelayMs, this.config.maxRandomDelayMs);
    return new Date(now.getTime() + Math.max(this.config.cooldownMs, randomDelay));
  }

  getErrorCooldownTime(now = new Date()) {
    return new Date(now.getTime() + this.config.errorCooldownMs);
  }

  shouldStart(now: Date, nextExecutionAt?: Date | null, cooldownUntil?: Date | null, currentState?: string) {
    if (currentState === 'BLOCKED') {
      return false;
    }
    if (cooldownUntil && cooldownUntil > now) {
      return false;
    }
    if (!nextExecutionAt) {
      return true;
    }
    return now >= nextExecutionAt;
  }
}
