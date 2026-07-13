import type { ExecutionContext, ScheduledEvent } from '@cloudflare/workers-types';
export interface WorkerEnv {
    AUTOD1: any;
    ENGINE_URL: string;
}
/**
 * Cloudflare Worker Fetch Handler
 */
declare const _default: {
    fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response>;
    scheduled(event: ScheduledEvent, env: WorkerEnv, ctx: ExecutionContext): Promise<void>;
};
export default _default;
