"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyApplyForm = classifyApplyForm;
const MAX_AUTO_STEPS = 2;
const MAX_AUTO_FIELDS = 8;
function classifyApplyForm(form) {
    if (form.hasCaptcha) {
        return 'ABORT';
    }
    if (form.stepCount > MAX_AUTO_STEPS) {
        return 'REVIEW';
    }
    if (form.hasCoverLetter) {
        return 'REVIEW';
    }
    if (form.rawFields.some((field) => field.type === 'textarea')) {
        return 'REVIEW';
    }
    if (form.hasFileUpload && form.rawFields.some((field) => field.type !== 'file' && field.name.toLowerCase().includes('cover'))) {
        return 'REVIEW';
    }
    if (form.rawFields.length > MAX_AUTO_FIELDS) {
        return 'REVIEW';
    }
    if (form.rawFields.some((field) => field.type === 'unknown')) {
        return 'REVIEW';
    }
    return 'AUTO';
}
