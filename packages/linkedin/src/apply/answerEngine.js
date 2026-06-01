"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAnswerMap = buildAnswerMap;
const booleanPositive = [
    'yes',
    'sim',
    'true',
    'available',
    'authorized',
    'qualified',
    'willing'
];
const booleanNegative = ['no', 'não', 'nao', 'false', 'unavailable', 'not'];
const genericAnswers = {
    'email': process.env.LINKEDIN_CONTACT_EMAIL ?? '',
    'phone': process.env.LINKEDIN_CONTACT_PHONE ?? '',
    'telefone': process.env.LINKEDIN_CONTACT_PHONE ?? '',
    'relocation': 'Yes',
    'work authorization': 'Yes',
    'authorized to work': 'Yes',
    'visa sponsorship': 'Yes',
    'willing to relocate': 'Yes',
    'remote': 'Yes',
    'cover letter': process.env.LINKEDIN_COVER_LETTER ?? ''
};
function buildAnswerMap(answers = {}) {
    return (label, fieldType) => {
        const normalized = label.trim().toLowerCase();
        for (const key of Object.keys(answers)) {
            if (normalized.includes(key.toLowerCase())) {
                return answers[key];
            }
        }
        for (const key of Object.keys(genericAnswers)) {
            if (normalized.includes(key)) {
                return genericAnswers[key];
            }
        }
        if (fieldType === 'yesno' || fieldType === 'radio' || fieldType === 'checkbox') {
            return inferBooleanAnswer(normalized);
        }
        return '';
    };
}
function inferBooleanAnswer(label) {
    const normalized = label.toLowerCase();
    for (const negative of booleanNegative) {
        if (normalized.includes(negative)) {
            return 'No';
        }
    }
    for (const positive of booleanPositive) {
        if (normalized.includes(positive)) {
            return 'Yes';
        }
    }
    return 'Yes';
}
