// packages\engine\src\fingerprints\BrowserFingerprint.ts
export interface BrowserFingerprint {
  userAgent: string;
  viewport: { width: number; height: number };
  locale: string;
  timezoneId: string;
}

export function buildBrowserFingerprint() {
    return {
        userAgent: process.env.LINKEDIN_USER_AGENT!,
        viewport: {
            width: Number(process.env.LINKEDIN_VIEWPORT_WIDTH ?? 1366),
            height: Number(process.env.LINKEDIN_VIEWPORT_HEIGHT ?? 768)
        },
        locale: process.env.LINKEDIN_LOCALE ?? "pt-BR",
        timezoneId: process.env.LINKEDIN_TIMEZONE ?? "America/Sao_Paulo"
    };
}
