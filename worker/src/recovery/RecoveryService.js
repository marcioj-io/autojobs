export class RecoveryService {
    analyzeError(error) {
        const message = error instanceof Error ? error.message : String(error);
        const lower = message.toLowerCase();
        if (/checkpoint|captcha|login redirect|login.*required|401|403/.test(lower)) {
            return {
                shouldBlock: true,
                shouldRetry: false,
                nextState: 'BLOCKED',
                reason: 'Sessão LinkedIn expirada ou bloqueio detectado'
            };
        }
        if (/timeout|ec|etimedout|network|temporar|rate limit|429/.test(lower)) {
            return {
                shouldBlock: false,
                shouldRetry: true,
                nextState: 'DEGRADED',
                reason: 'Erro transitório de rede ou LinkedIn lag'
            };
        }
        return {
            shouldBlock: false,
            shouldRetry: false,
            nextState: 'ERROR',
            reason: 'Erro inesperado durante a execução'
        };
    }
}
