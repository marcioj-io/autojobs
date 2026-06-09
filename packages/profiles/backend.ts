import { ProfileDefinition } from "@autojobs/shared";

export const backendProfile: ProfileDefinition = {
  name: 'backend',
  searches: [
    'Backend Developer',
    'Node.js Backend Developer',
    'NestJS Developer',
    'TypeScript Backend Engineer'
  ],
  keywords: {
    nestjs: 30,
    'node.js': 25,
    typescript: 20,
    postgresql: 10
  },
  negativeKeywords: {
    wordpress: -100,
    php: -50,
    presencial: -40
  },
  minScore: 70,
  dailyLimit: 25,
  seniority: 'senior',
  stackPriority: ['nestjs', 'node.js', 'typescript', 'postgresql'],
  cv: 'CV_EN'
};
