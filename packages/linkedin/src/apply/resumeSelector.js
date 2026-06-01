"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResumePath = getResumePath;
const node_path_1 = require("node:path");
const node_fs_1 = require("node:fs");
function getResumePath(profile) {
    const explicit = process.env.LINKEDIN_CV_PATH;
    if (explicit && (0, node_fs_1.existsSync)(explicit)) {
        return (0, node_path_1.resolve)(explicit);
    }
    if (!profile) {
        return undefined;
    }
    const profileKey = profile.toUpperCase();
    const envKey = `LINKEDIN_CV_${profileKey}`;
    const candidate = process.env[envKey];
    if (candidate && (0, node_fs_1.existsSync)(candidate)) {
        return (0, node_path_1.resolve)(candidate);
    }
    return undefined;
}
