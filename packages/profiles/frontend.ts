import type { ProfileDefinition } from '@autojobs/shared';

export const frontendProfile: ProfileDefinition = {
  name: 'frontend',
  searches: [
    'Frontend Developer',
    'React Developer',
    'Next.js Engineer',
    'UI Engineer'
  ],
  keywords: {
    react: 30,
    'next.js': 25,
    typescript: 20,
    javascript: 10
  },
  negativeKeywords: {
    wordpress: -100,
    php: -50,
    presencial: -40
  },
  minScore: 70,
  dailyLimit: 25,
  seniority: 'mid',
  stackPriority: ['react', 'next.js', 'typescript', 'javascript'],
  cv: 'CV_EN'
};
