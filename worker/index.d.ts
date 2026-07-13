import type { ExecutionContext, ScheduledEvent } from '@cloudflare/workers-types';
export interface WorkerEnv {
    AUTOD1: any;
    ENGINE_URL: string;
}
declare const _default: {
    scheduled(event: ScheduledEvent, env: WorkerEnv, ctx: ExecutionContext): Promise<void>;
    fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response>;
};
export default _default;
