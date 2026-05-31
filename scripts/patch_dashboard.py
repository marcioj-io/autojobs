from pathlib import Path
import re

root = Path(r'c:\Repos\autojobs')

# 1) dashboardStore.ts
store = root / 'apps' / 'dashboard' / 'lib' / 'dashboardStore.ts'
text = store.read_text(encoding='utf8')
text = text.replace("import { randomUUID } from 'crypto';\n", '')
if 'const generateEdgeId' not in text:
    text = 'const generateEdgeId = () => {\n' \
           '  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();\n' \
           '  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;\n' \
           '};\n\n' + text
text = re.sub(r'\brandomUUID\(\)', 'generateEdgeId()', text)
store.write_text(text, encoding='utf8')

# 2) backend.ts
backend = root / 'apps' / 'dashboard' / 'lib' / 'services' / 'backend.ts'
text = backend.read_text(encoding='utf8')
text = text.replace('async function createDbBackend(): Promise<Backend | null> {', 'async function createDbBackend(d1Client?: any): Promise<Backend | null> {')
text = text.replace(
    "  // detect any pre-attached D1 client\n  // eslint-disable-next-line @typescript-eslint/ban-ts-comment\n  // @ts-ignore\n  const d1 = globalThis.__AUTOJOBS_D1_CLIENT__ as any | undefined;\n  if (!d1) return null;\n",
    '  if (!d1Client) return null;\n'
)
if 'const isProduction = typeof process !==' not in text:
    text = text.replace('};\n\nasync function createDbBackend', '};\n\nconst isProduction = typeof process !== \"undefined\" && process.env?.NODE_ENV === \"production\";\n\nasync function createDbBackend')
# remove old cache block
old_block = (
    'let cachedBackend: Promise<Backend | null> | null = null;\n\nexport async function getBackend() {\n'
    '  if (!cachedBackend) cachedBackend = createDbBackend();\n'
    '  const b = await cachedBackend;\n'
    '  if (b) return b;\n'
)
if old_block in text:
    text = text.replace(old_block, 'export async function getBackend(d1Client?: any) {\n  const b = await createDbBackend(d1Client);\n  if (b) return b;\n')
else:
    # fallback: replace only function signature and block if needed
    text = text.replace('export async function getBackend() {\n  if (!cachedBackend) cachedBackend = createDbBackend();\n  const b = await cachedBackend;\n  if (b) return b;\n', 'export async function getBackend(d1Client?: any) {\n  const b = await createDbBackend(d1Client);\n  if (b) return b;\n')
text = text.replace('export async function getBackend() {', 'export async function getBackend(d1Client?: any) {')
text = text.replace('  if (process.env.NODE_ENV === \'production\') {\n    throw new Error(\'Dashboard requires a real D1 database client in production; no mock fallback allowed.\');\n  }\n', '  if (isProduction) {\n    throw new Error(\'Dashboard requires a real D1 database client in production; no mock fallback allowed.\');\n  }\n')
backend.write_text(text, encoding='utf8')

# 3) route files: add runtime edge and explicit binding
api_root = root / 'apps' / 'dashboard' / 'app' / 'api'
for path in api_root.rglob('route.ts'):
    text = path.read_text(encoding='utf8')
    if "export const runtime = 'edge';" not in text:
        text = text.replace("export const dynamic = 'force-dynamic';\n", "export const runtime = 'edge';\nexport const dynamic = 'force-dynamic';\n")
    text = re.sub(r'await getBackend\(\)', 'await getBackend((globalThis as any).AUTOJOBS_D1)', text)
    path.write_text(text, encoding='utf8')

print('Modifications complete')
