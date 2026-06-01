"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectors = exports.selectorChains = void 0;
exports.selectorChains = {
    jobCard: ['li.jobs-search-results__list-item', 'li.job-card-container', '.job-card-container'],
    title: ['h3.base-search-card__title', 'h3.job-card-list__title', '.artdeco-entity-lockup__title'],
    company: ['h4.base-search-card__subtitle', 'h4.job-card-container__company-name', '.artdeco-entity-lockup__subtitle'],
    location: ['.job-search-card__location', '.job-card-container__metadata-item', '.job-card-list__location'],
    url: ['a.base-card__full-link', 'a.job-card-list__title-link', 'a[href*="/jobs/view"]'],
    easyApply: ['.job-card-container__apply-method', '.artdeco-badge', 'button[aria-label*="easy apply"], button:has-text("Easy Apply")'],
    postedAt: ['time', 'span.job-search-card__listdate', 'span.posted-time-ago__text'],
    description: ['p.job-search-card__snippet', 'div.job-card-container__description-preview', '.job-card-list__snippet'],
    applyModal: ['form.jobs-easy-apply-form', '.jobs-easy-apply-modal', '.jobs-easy-apply__content'],
    applyFormQuestion: ['div.jobs-easy-apply-form__question', 'div.jobs-easy-apply-form__question-item', 'div.artdeco-form__field']
};
exports.selectors = {
    jobCard: exports.selectorChains.jobCard[0],
    title: exports.selectorChains.title[0],
    company: exports.selectorChains.company[0],
    location: exports.selectorChains.location[0],
    url: exports.selectorChains.url[0],
    easyApply: exports.selectorChains.easyApply[0],
    postedAt: exports.selectorChains.postedAt[0],
    description: exports.selectorChains.description[0],
    applyModal: exports.selectorChains.applyModal[0],
    applyFormQuestion: exports.selectorChains.applyFormQuestion[0]
};
