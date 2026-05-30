import { PersistenceService } from '@autojobs/db';

export class RuntimeLogger {
  constructor(private persistence: PersistenceService) {}

  async logInfo(message: string, source = 'runtime') {
    await this.persistence.persistLog({
      type: 'runtime',
      message,
      source,
      level: 'info'
    });
  }

  async logWarning(message: string, source = 'runtime') {
    await this.persistence.persistLog({
      type: 'runtime',
      message,
      source,
      level: 'warning'
    });
  }

  async logError(message: string, error?: unknown, source = 'runtime') {
    const details = typeof error === 'string' ? error : error instanceof Error ? error.stack ?? error.message : JSON.stringify(error);
    await this.persistence.persistLog({
      type: 'runtime',
      message: `${message}${details ? ` - ${details}` : ''}`,
      source,
      level: 'error'
    });
  }
}
