// packages/engine/src/selectors.ts
export const selectorChains = {
  jobCard: ['li.jobs-search-results__list-item', 'li.job-card-container', '.job-card-container'],
  title: ['h3.base-search-card__title', 'h3.job-card-list__title', '.artdeco-entity-lockup__title'],
  company: ['h4.base-search-card__subtitle', 'h4.job-card-container__company-name', '.artdeco-entity-lockup__subtitle'],
  location: ['.job-search-card__location', '.job-card-container__metadata-item', '.job-card-list__location'],
  url: ['a.base-card__full-link', 'a.job-card-list__title-link', 'a[href*="/jobs/view"]'],
  easyApply: ['.job-card-container__apply-method', '.artdeco-badge', 'button[aria-label*="easy apply"]'],  postedAt: ['time', 'span.job-search-card__listdate', 'span.posted-time-ago__text'],
  description: ['p.job-search-card__snippet', 'div.job-card-container__description-preview', '.job-card-list__snippet'],
  applyModal: ['form.jobs-easy-apply-form', '.jobs-easy-apply-modal', '.jobs-easy-apply__content'],
  applyFormQuestion: ['div.jobs-easy-apply-form__question', 'div.jobs-easy-apply-form__question-item', 'div.artdeco-form__field']
};

export const selectors = {
  jobCard: selectorChains.jobCard[0],
  title: selectorChains.title[0],
  company: selectorChains.company[0],
  location: selectorChains.location[0],
  url: selectorChains.url[0],
  easyApply: selectorChains.easyApply[0],
  postedAt: selectorChains.postedAt[0],
  description: selectorChains.description[0],
  applyModal: selectorChains.applyModal[0],
  applyFormQuestion: selectorChains.applyFormQuestion[0]
};
