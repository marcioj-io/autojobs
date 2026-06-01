"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeService = void 0;
const runtimeStateRepository_1 = require("../repositories/runtimeStateRepository");
const runtimeHistoryRepository_1 = require("../repositories/runtimeHistoryRepository");
const retryHistoryRepository_1 = require("../repositories/retryHistoryRepository");
const runtimeMetricsRepository_1 = require("../repositories/runtimeMetricsRepository");
class RuntimeService {
    runtimeStateRepository;
    runtimeHistoryRepository;
    retryHistoryRepository;
    runtimeMetricsRepository;
    constructor(db) {
        this.runtimeStateRepository = new runtimeStateRepository_1.RuntimeStateRepository(db);
        this.runtimeHistoryRepository = new runtimeHistoryRepository_1.RuntimeHistoryRepository(db);
        this.retryHistoryRepository = new retryHistoryRepository_1.RetryHistoryRepository(db);
        this.runtimeMetricsRepository = new runtimeMetricsRepository_1.RuntimeMetricsRepository(db);
    }
    async getState(id) {
        return this.runtimeStateRepository.getState(id);
    }
    async ensureState(id) {
        const existing = await this.getState(id);
        if (existing)
            return existing;
        const defaultState = {
            id,
            currentState: 'IDLE',
            health: 'healthy',
            lastExecutionStartedAt: null,
            lastExecutionFinishedAt: null,
            nextExecutionAt: null,
            consecutiveFailures: 0,
            cooldownUntil: null,
            sessionStatus: null,
            sessionId: null,
            lastError: null,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        await this.runtimeStateRepository.upsertState(defaultState);
        return defaultState;
    }
    async updateState(id, patch) {
        await this.runtimeStateRepository.patchState(id, patch);
    }
    async recordRun(entry) {
        await this.runtimeHistoryRepository.createHistory({
            ...entry,
            id: crypto.randomUUID(),
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }
    async recordRetry(entry) {
        await this.retryHistoryRepository.createRetry({
            ...entry,
            id: crypto.randomUUID()
        });
    }
    async recordMetrics(entry) {
        await this.runtimeMetricsRepository.createMetric({
            ...entry,
            id: crypto.randomUUID(),
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }
    async getRecentMetrics(limit = 50) {
        return this.runtimeMetricsRepository.getRecentMetrics(limit);
    }
    async getRecentRetries(limit = 50) {
        return this.retryHistoryRepository.getRecentRetries(limit);
    }
    async getRecentHistory(limit = 20) {
        return this.runtimeHistoryRepository.getRecentHistory(limit);
    }
}
exports.RuntimeService = RuntimeService;
