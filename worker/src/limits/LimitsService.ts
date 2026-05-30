import { ApplicationsRepository } from '@autojobs/db';
import type { DrizzleD1Database } from '@autojobs/db';

interface LimitsConfig {
  dailyApplyLimit: number;
  hourlyApplyLimit: number;
  applyCooldownMs: number;
  scrapeCooldownMs: number;
  allowAutoApply: boolean;
}

export class LimitsService {
  private applicationsRepository: ApplicationsRepository;

  constructor(db: DrizzleD1Database<any>, private config: LimitsConfig) {
    this.applicationsRepository = new ApplicationsRepository(db);
  }

  getDailyLimit() {
    return this.config.dailyApplyLimit;
  }

  getHourlyLimit() {
    return this.config.hourlyApplyLimit;
  }

  canAutoApply() {
    return this.config.allowAutoApply;
  }

  async countAutoAppliesToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.applicationsRepository.countApplicationsSince(today, 'submitted');
  }

  async countAutoAppliesLastHour() {
    const since = new Date(Date.now() - 1000 * 60 * 60);
    return this.applicationsRepository.countApplicationsSince(since, 'submitted');
  }

  async shouldPauseAfterApply() {
    const daily = await this.countAutoAppliesToday();
    const hourly = await this.countAutoAppliesLastHour();
    return daily >= this.config.dailyApplyLimit || hourly >= this.config.hourlyApplyLimit;
  }

  getApplyCooldownUntil(now = new Date()) {
    return new Date(now.getTime() + this.config.applyCooldownMs);
  }

  getScrapeCooldownUntil(now = new Date()) {
    return new Date(now.getTime() + this.config.scrapeCooldownMs);
  }
}
