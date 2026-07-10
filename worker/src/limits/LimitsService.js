// worker\src\limits\LimitsService.ts
import { ApplicationsRepository } from '@autojobs/db';
export class LimitsService {
    config;
    applicationsRepository;
    constructor(db, config) {
        this.config = config;
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
