export interface BrowserFingerprint {
    userAgent: string;
    viewport: {
        width: number;
        height: number;
    };
    locale: string;
    timezoneId: string;
}
export declare function buildBrowserFingerprint(): BrowserFingerprint;
