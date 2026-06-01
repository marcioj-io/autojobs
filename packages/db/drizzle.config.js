"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_path_1 = __importDefault(require("node:path"));
exports.default = {
    schema: node_path_1.default.resolve(__dirname, 'src', 'schema.ts'),
    migrationsFolder: node_path_1.default.resolve(__dirname, 'migrations'),
    // Note: This file provides minimal config for tooling (drizzle-kit or CI). Fill driver/credentials in CI secrets.
};
