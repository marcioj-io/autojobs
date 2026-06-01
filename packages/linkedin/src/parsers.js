"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeLinkedInJobRecord = normalizeLinkedInJobRecord;
exports.buildLinkedInJobRecord = buildLinkedInJobRecord;
function normalizeText(value) {
    return value?.trim().replace(/\s+/g, ' ') ?? '';
}
function normalizeLinkedInJobRecord(raw) {
    return {
        id: raw.id ?? '',
        company: normalizeText(raw.company),
        title: normalizeText(raw.title),
        location: normalizeText(raw.location),
        url: raw.url?.trim() ?? '',
        easyApply: raw.easyApply ?? false,
        postedAt: normalizeText(raw.postedAt),
        description: normalizeText(raw.description),
        language: raw.language ?? 'PT',
        profile: raw.profile ?? 'backend'
    };
}
function buildLinkedInJobRecord(raw) {
    return normalizeLinkedInJobRecord(raw);
}
