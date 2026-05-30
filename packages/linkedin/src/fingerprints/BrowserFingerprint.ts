export interface BrowserFingerprint {
  userAgent: string;
  viewport: { width: number; height: number };
  locale: string;
  timezoneId: string;
}

const VIEWPORTS = [
  { width: 1600, height: 900 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 800 }
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
];

function randomItem<T>(items: ReadonlyArray<T>) {
  return items[Math.floor(Math.random() * items.length)];
}

export function buildBrowserFingerprint(): BrowserFingerprint {
  return {
    userAgent: randomItem(USER_AGENTS),
    viewport: randomItem(VIEWPORTS),
    locale: 'en-US',
    timezoneId: 'America/Sao_Paulo'
  };
}
