export class ObservabilityService {
    persistence;
    constructor(persistence) {
        this.persistence = persistence;
    }
    async logAnomaly(type, message, details, severity = 'warning') {
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
    async recordSelectorFailure(selectorType, selector, url, error, metadata) {
        await this.persistence.persistSelectorFailure({
            selectorType,
            selector,
            pageUrl: url ?? null,
            error: error ?? 'unknown',
            metadata: metadata ? JSON.stringify(metadata) : null,
            timestamp: new Date()
        });
    }
    async recordScreenshotMetadata(contextType, contextId, path, metadata) {
        await this.persistence.persistScreenshotMetadata({
            contextType,
            contextId,
            path,
            metadata: metadata ? JSON.stringify(metadata) : null,
            timestamp: new Date()
        });
    }
}
