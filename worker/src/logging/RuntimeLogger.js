export class RuntimeLogger {
    persistence;
    constructor(persistence) {
        this.persistence = persistence;
    }
    async logInfo(message, source = 'runtime') {
        await this.persistence.persistLog({
            type: 'runtime',
            message,
            source,
            level: 'info'
        });
    }
    async logWarning(message, source = 'runtime') {
        await this.persistence.persistLog({
            type: 'runtime',
            message,
            source,
            level: 'warning'
        });
    }
    async logError(message, error, source = 'runtime') {
        const details = typeof error === 'string' ? error : error instanceof Error ? error.stack ?? error.message : JSON.stringify(error);
        await this.persistence.persistLog({
            type: 'runtime',
            message: `${message}${details ? ` - ${details}` : ''}`,
            source,
            level: 'error'
        });
    }
}
