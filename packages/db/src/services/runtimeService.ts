import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { RuntimeStateRepository } from '../repositories/runtimeStateRepository';
import { RuntimeHistoryRepository } from '../repositories/runtimeHistoryRepository';
import { RetryHistoryRepository } from '../repositories/retryHistoryRepository';
import { RuntimeMetricsRepository } from '../repositories/runtimeMetricsRepository';
import type { RuntimeStateModel, RuntimeHistoryModel, RetryHistoryModel, RuntimeMetricModel } from '../schema';

export class RuntimeService {
  private runtimeStateRepository: RuntimeStateRepository;
  private runtimeHistoryRepository: RuntimeHistoryRepository;
  private retryHistoryRepository: RetryHistoryRepository;
  private runtimeMetricsRepository: RuntimeMetricsRepository;

  constructor(db: DrizzleD1Database<any>) {
    this.runtimeStateRepository = new RuntimeStateRepository(db);
    this.runtimeHistoryRepository = new RuntimeHistoryRepository(db);
    this.retryHistoryRepository = new RetryHistoryRepository(db);
    this.runtimeMetricsRepository = new RuntimeMetricsRepository(db);
  }

  async getState(id: string) {
    return this.runtimeStateRepository.getState(id);
  }

  async ensureState(id: string) {
    const existing = await this.getState(id);
    if (existing) return existing;

    const defaultState: RuntimeStateModel = {
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

  async updateState(id: string, patch: Partial<Omit<RuntimeStateModel, 'id' | 'createdAt'>>) {
    await this.runtimeStateRepository.patchState(id, patch);
  }

  async recordRun(entry: Omit<RuntimeHistoryModel, 'id' | 'createdAt' | 'updatedAt'>) {
    await this.runtimeHistoryRepository.createHistory({
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  async recordRetry(entry: Omit<RetryHistoryModel, 'id'>) {
    await this.retryHistoryRepository.createRetry({
      ...entry,
      id: crypto.randomUUID()
    });
  }

  async recordMetrics(entry: Omit<RuntimeMetricModel, 'id' | 'createdAt' | 'updatedAt'>) {
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
