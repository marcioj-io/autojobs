import { RuntimeStateType } from "@autojobs/shared";
export interface RecoveryResult {
    shouldBlock: boolean;
    shouldRetry: boolean;
    nextState: RuntimeStateType;
    reason: string;
}
export declare class RecoveryService {
    analyzeError(error: unknown): RecoveryResult;
}
