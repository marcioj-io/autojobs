import fs from 'node:fs';
import path from 'node:path';

const migrationsDir = path.resolve(__dirname, '..', 'src', 'migrations');
const name = process.argv[2] || 'migration';

if (!fs.existsSync(migrationsDir)) fs.mkdirSync(migrationsDir, { recursive: true });

const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
let next = 1;
if (files.length) {
  const last = files[files.length - 1];
  const match = /^0*(\d+)-/.exec(last);
  if (match) next = parseInt(match[1], 10) + 1;
}

const id = String(next).padStart(4, '0');
const filename = `${id}-${name}.sql`;
const filePath = path.join(migrationsDir, filename);
const template = `-- Migration ${filename}
-- Add SQL statements below

`;
fs.writeFileSync(filePath, template, { flag: 'wx' });
console.log(`Created migration: ${filePath}`);
