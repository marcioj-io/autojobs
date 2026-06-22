import type { PersistenceService } from '@autojobs/db';

export class ObservabilityService {
  constructor(private persistence: PersistenceService) {}

  async logAnomaly(type: string, message: string, details?: unknown, severity: 'info' | 'warning' | 'error' = 'warning') {
    await this.persistence.persistLog({
      type: 'anomaly',
      message,
      source: 'observability',
      level: severity
    });

    if (typeof details !== 'undefined') {
      await this.persistence.persistAnomalyLog({
        type,
        message,
        details: JSON.stringify(details),
        severity,
        timestamp: new Date()
      });
    }
  }

  async recordSelectorFailure(selectorType: string, selector: string, url?: string, error?: string, metadata?: unknown) {
    await this.persistence.persistSelectorFailure({
      selectorType,
      selector,
      pageUrl: url ?? null,
      error: error ?? 'unknown',
      metadata: metadata ? JSON.stringify(metadata) : null,
      timestamp: new Date()
    });
  }

  async recordScreenshotMetadata(contextType: string, contextId: string | null, path: string | null, metadata?: unknown) {
    await this.persistence.persistScreenshotMetadata({
      contextType,
      contextId,
      path,
      metadata: metadata ? JSON.stringify(metadata) : null,
      timestamp: new Date()
    });
  }
}
