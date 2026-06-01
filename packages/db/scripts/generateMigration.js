"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const migrationsDir = node_path_1.default.resolve(__dirname, '..', 'src', 'migrations');
const name = process.argv[2] || 'migration';
if (!node_fs_1.default.existsSync(migrationsDir))
    node_fs_1.default.mkdirSync(migrationsDir, { recursive: true });
const files = node_fs_1.default.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
let next = 1;
if (files.length) {
    const last = files[files.length - 1];
    const match = /^0*(\d+)-/.exec(last);
    if (match)
        next = parseInt(match[1], 10) + 1;
}
const id = String(next).padStart(4, '0');
const filename = `${id}-${name}.sql`;
const filePath = node_path_1.default.join(migrationsDir, filename);
const template = `-- Migration ${filename}
-- Add SQL statements below

`;
node_fs_1.default.writeFileSync(filePath, template, { flag: 'wx' });
console.log(`Created migration: ${filePath}`);
