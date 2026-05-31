const fs = require('fs');
const path = require('path');
const root = path.resolve('c:\\Repos\\autojobs');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}
function write(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

const storePath = path.join(root, 'apps', 'dashboard', 'lib', 'dashboardStore.ts');
let text = read(storePath);
text = text.replace("import { randomUUID } from 'crypto';\n", '');
if (!text.includes('const generateEdgeId')) {
  text = 'const generateEdgeId = () => {\n' +
    '  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();\n' +
    '  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;\n' +
    '};\n\n' + text;
}
text = text.replace(/\brandomUUID\(\)/g, 'generateEdgeId()');
write(storePath, text);

const backendPath = path.join(root, 'apps', 'dashboard', 'lib', 'services', 'backend.ts');
text = read(backendPath);
text = text.replace('async function createDbBackend(): Promise<Backend | null> {', 'async function createDbBackend(d1Client?: any): Promise<Backend | null> {');
text = text.replace(
  "  // detect any pre-attached D1 client\n  // eslint-disable-next-line @typescript-eslint/ban-ts-comment\n  // @ts-ignore\n  const d1 = globalThis.__AUTOJOBS_D1_CLIENT__ as any | undefined;\n  if (!d1) return null;\n",
  '  if (!d1Client) return null;\n'
);
if (!text.includes('const isProduction = typeof process !==')) {
  text = text.replace('};\n\nasync function createDbBackend', '};\n\nconst isProduction = typeof process !== "undefined" && process.env?.NODE_ENV === "production";\n\nasync function createDbBackend');
}
const oldBlock =
  'let cachedBackend: Promise<Backend | null> | null = null;\n\nexport async function getBackend() {\n' +
  '  if (!cachedBackend) cachedBackend = createDbBackend();\n' +
  '  const b = await cachedBackend;\n' +
  '  if (b) return b;\n';
if (text.includes(oldBlock)) {
  text = text.replace(oldBlock, 'export async function getBackend(d1Client?: any) {\n  const b = await createDbBackend(d1Client);\n  if (b) return b;\n');
} else {
  text = text.replace('export async function getBackend() {\n  if (!cachedBackend) cachedBackend = createDbBackend();\n  const b = await cachedBackend;\n  if (b) return b;\n', 'export async function getBackend(d1Client?: any) {\n  const b = await createDbBackend(d1Client);\n  if (b) return b;\n');
}
text = text.replace('export async function getBackend() {', 'export async function getBackend(d1Client?: any) {');
text = text.replace(
  '  if (process.env.NODE_ENV === \'production\') {\n    throw new Error(\'Dashboard requires a real D1 database client in production; no mock fallback allowed.\');\n  }\n',
  '  if (isProduction) {\n    throw new Error(\'Dashboard requires a real D1 database client in production; no mock fallback allowed.\');\n  }\n'
);
write(backendPath, text);

const apiRoot = path.join(root, 'apps', 'dashboard', 'app', 'api');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (entry.isFile() && entry.name === 'route.ts') return [full];
    return [];
  });
}
for (const filePath of walk(apiRoot)) {
  text = read(filePath);
  if (!text.includes("export const runtime = 'edge';")) {
    text = text.replace("export const dynamic = 'force-dynamic';\n", "export const runtime = 'edge';\nexport const dynamic = 'force-dynamic';\n");
  }
  text = text.replace(/await getBackend\(\)/g, 'await getBackend((globalThis as any).AUTOJOBS_D1)');
  write(filePath, text);
}

console.log('Modifications complete');
