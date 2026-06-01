"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSessionAdapter = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const DEFAULT_SESSION_DIR = '.linkedin-sessions';
class FileSessionAdapter {
    sessionDirectory;
    constructor(sessionDirectory = DEFAULT_SESSION_DIR) {
        this.sessionDirectory = sessionDirectory;
    }
    getSessionPath(sessionId) {
        const directory = (0, node_path_1.resolve)(process.cwd(), this.sessionDirectory);
        return (0, node_path_1.join)(directory, `${sessionId}.json`);
    }
    async load(sessionId) {
        const path = this.getSessionPath(sessionId);
        try {
            return await (0, promises_1.readFile)(path, 'utf-8');
        }
        catch {
            return null;
        }
    }
    async save(sessionId, storageState) {
        const path = this.getSessionPath(sessionId);
        await (0, promises_1.mkdir)((0, node_path_1.dirname)(path), { recursive: true });
        await (0, promises_1.writeFile)(path, storageState, 'utf-8');
    }
}
exports.FileSessionAdapter = FileSessionAdapter;
