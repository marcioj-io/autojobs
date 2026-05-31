const fs = require('fs');
const path = require('path');
const root = path.resolve('c:/Repos/autojobs');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}
function write(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function applyDashboardStoreFix() {
  const filePath = path.join(root, 'apps', 'dashboard', 'lib', 'dashboardStore.ts');
  let text = read(filePath);
  text = text.replace(/import \{ randomUUID \} from 'crypto';\r?\n/, '');
  if (!text.includes('const generateEdgeId = () =>')) {
    text = 'const generateEdgeId = () => {\n' +
      '  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();\n' +
      '  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;\n' +
      '};\n\n' + text;
  }
  text = text.replace(/\brandomUUID\(\)/g, 'generateEdgeId()');
  write(filePath, text);
}

function applyBackendFix() {
  const filePath = path.join(root, 'apps', 'dashboard', 'lib', 'services', 'backend.ts');
  let text = read(filePath);
  text = text.replace(/async function createDbBackend\(.*\): Promise<Backend \| null> \{/, 'async function createDbBackend(d1Client?: any): Promise<Backend | null> {');
  text = text.replace(/const d1 = globalThis\.__AUTOJOBS_D1_CLIENT__ as any \| undefined;\r?\n\s*if \(!d1\) return null;\r?\n/, '  if (!d1Client) return null;\n');
  if (!text.includes('const isProduction = typeof process !== "undefined" && process.env?.NODE_ENV === "production";')) {
    text = text.replace(/};\r?\n\r?\nasync function createDbBackend/, '};\n\nconst isProduction = typeof process !== "undefined" && process.env?.NODE_ENV === "production";\n\nasync function createDbBackend');
  }
  text = text.replace(/let cachedBackend: Promise<Backend \| null> \| null = null;\r?\n\r?\n/, '');
  text = text.replace(/export async function getBackend\(d1Client\?: any\) \{\r?\n\s*if \(!cachedBackend\) cachedBackend = createDbBackend\(\);\r?\n\s*const b = await cachedBackend;\r?\n\s*if \(b\) return b;\r?\n/, 'export async function getBackend(d1Client?: any) {\n  const b = await createDbBackend(d1Client);\n  if (b) return b;\n');
  text = text.replace(/export async function getBackend\(\) \{/, 'export async function getBackend(d1Client?: any) {');
  text = text.replace(/if \(process\.env\.NODE_ENV === 'production'\) \{/, 'if (isProduction) {');
  write(filePath, text);
}

function applyRouteFixes() {
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
    let text = read(filePath);
    if (!text.includes("export const runtime = 'edge';")) {
      text = text.replace("export const dynamic = 'force-dynamic';\n", "export const runtime = 'edge';\nexport const dynamic = 'force-dynamic';\n");
    }
    text = text.replace(/await getBackend\(\)/g, 'await getBackend((globalThis as any).AUTOJOBS_D1)');
    write(filePath, text);
  }
}

applyDashboardStoreFix();
applyBackendFix();
applyRouteFixes();
console.log('Dashboard patch fix complete');
