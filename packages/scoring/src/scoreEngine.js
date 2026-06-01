"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateScore = calculateScore;
const keywordScores = {
    remoto: 30,
    'easy apply': 25,
    'node.js': 20,
    nestjs: 20,
    typescript: 15,
    presencial: -50,
    wordpress: -100
};
const seniorityScore = {
    junior: 5,
    mid: 15,
    senior: 25
};
function calculateScore(input) {
    let score = 0;
    const normalizedTitle = input.title.toLowerCase();
    const normalizedDescription = input.description.toLowerCase();
    const normalizedLocation = input.location.toLowerCase();
    Object.entries(keywordScores).forEach(([keyword, weight]) => {
        if (normalizedTitle.includes(keyword) || normalizedDescription.includes(keyword) || normalizedLocation.includes(keyword)) {
            score += weight;
        }
    });
    input.keywords.forEach((keyword) => {
        const normalizedKeyword = keyword.toLowerCase();
        if (keywordScores[normalizedKeyword]) {
            score += keywordScores[normalizedKeyword];
        }
        else if (normalizedTitle.includes(normalizedKeyword) || normalizedDescription.includes(normalizedKeyword)) {
            score += 10;
        }
    });
    score += seniorityScore[input.seniority] ?? 0;
    score += input.easyApply ? 25 : 0;
    return Math.min(Math.max(score, 0), 100);
}
