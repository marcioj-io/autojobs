import type { ProfileDefinition } from '@autojobs/shared';

export const fullstackProfile: ProfileDefinition = {
  name: 'fullstack',
  searches: [
    'Fullstack Developer',
    'Fullstack Engineer',
    'TypeScript Fullstack',
    'Backend + Frontend Developer'
  ],
  keywords: {
    typescript: 30,
    react: 20,
    nestjs: 20,
    nodejs: 15
  },
  negativeKeywords: {
    wordpress: -100,
    'php': -50,
    presencial: -40
  },
  minScore: 70,
  dailyLimit: 25,
  seniority: 'senior',
  stackPriority: ['typescript', 'react', 'nestjs', 'nodejs'],
  cv: 'CV_EN'
};
