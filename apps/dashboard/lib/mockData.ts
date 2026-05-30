export interface JobRow {
  id: string;
  title: string;
  company: string;
  score: number;
  status: string;
  location: string;
  modality: string;
  easyApply: boolean;
  postedAt: string;
}

export interface ReviewItem {
  id: string;
  title: string;
  company: string;
  category: string;
  note: string;
  status: 'pending' | 'approved' | 'rejected' | 'snoozed';
  reviewReason: string;
  reviewNotes: string;
  reviewer?: string;
  updatedAt: string;
  snoozedUntil?: string;
}

export interface ProfileSummary {
  name: string;
  status: string;
  dailyLimit: number;
  minScore: number;
  seniority: string;
  cv: string;
}

export interface SettingsState {
  minScore: number;
  maxDailyApplications: number;
  autoApply: boolean;
  preferredLocation: string;
  blacklistedKeywords: string[];
}

export interface LogEntry {
  id: string;
  type: string;
  message: string;
  source: string;
  timestamp: string;
}

const reviewItems: ReviewItem[] = [
  {
    id: 'review-001',
    title: 'Senior NestJS Backend',
    company: 'Pulse Group',
    category: 'Classe B',
    note: 'Pagamento complexo e formulário curto com perguntas de experiência.',
    status: 'pending',
    reviewReason: 'Formulário LinkedIn exige experiência e respostas livres.',
    reviewNotes: 'Retornar ao candidato com portfólio e preenchimento do campo “Projetos”.',
    reviewer: 'Lucas',
    updatedAt: '2026-05-28 22:10'
  },
  {
    id: 'review-002',
    title: 'React Developer',
    company: 'Mira Labs',
    category: 'Classe B',
    note: 'Revisão rápida necessária para confirmar dados de portfólio.',
    status: 'pending',
    reviewReason: 'Pergunta aberta sobre equipes remotas e disponibilidade.',
    reviewNotes: 'Confirmação manual para evitar respostas genéricas.',
    updatedAt: '2026-05-28 21:00'
  },
  {
    id: 'review-003',
    title: 'Fullstack Engineer',
    company: 'Vertex Labs',
    category: 'Classe C',
    note: 'Processo externo com cover letter e perguntas abertas.',
    status: 'snoozed',
    reviewReason: 'Formulário com etapas de upload e perguntas customizadas.',
    reviewNotes: 'Revisar em proximidade do final do dia.',
    reviewer: 'Ana',
    updatedAt: '2026-05-27 18:45',
    snoozedUntil: '2026-05-30'
  }
];

export const mockDashboardData = {
  metrics: [
    { label: 'Vagas encontradas hoje', value: '18', delta: '+8 em 24h', icon: '🔥' },
    { label: 'Aplicações automáticas', value: '7', delta: '+5 em 24h', icon: '✅' },
    { label: 'Pendências', value: '4', delta: '-2 em 24h', icon: '⏳' },
    { label: 'Score médio', value: '82', delta: '+12', icon: '📈' }
  ],
  jobs: [
    {
      id: 'job-001',
      title: 'Backend Developer',
      company: 'Nuvem Tech',
      score: 87,
      status: 'Easy Apply',
      location: 'Remoto',
      modality: 'Full remote',
      easyApply: true,
      postedAt: 'há 2h'
    },
    {
      id: 'job-002',
      title: 'Frontend Engineer',
      company: 'Omega Systems',
      score: 79,
      status: 'Manual Review',
      location: 'Lisboa, PT',
      modality: 'Híbrido',
      easyApply: false,
      postedAt: 'há 5h'
    },
    {
      id: 'job-003',
      title: 'Fullstack TypeScript',
      company: 'Atlas Digital',
      score: 91,
      status: 'Easy Apply',
      location: 'Remoto',
      modality: 'Remoto',
      easyApply: true,
      postedAt: 'há 7h'
    }
  ],
  reviews: reviewItems,
  profiles: [
    {
      name: 'backend',
      status: 'Ativo',
      dailyLimit: 25,
      minScore: 70,
      seniority: 'Senior',
      cv: 'CV_EN'
    },
    {
      name: 'frontend',
      status: 'Ativo',
      dailyLimit: 25,
      minScore: 70,
      seniority: 'Mid',
      cv: 'CV_EN'
    },
    {
      name: 'fullstack',
      status: 'Ativo',
      dailyLimit: 25,
      minScore: 70,
      seniority: 'Senior',
      cv: 'CV_EN'
    }
  ],
  settings: {
    minScore: 70,
    maxDailyApplications: 25,
    autoApply: true,
    preferredLocation: 'Remoto',
    blacklistedKeywords: ['wordpress', 'php', 'presencial']
  },
  logs: [
    {
      id: 'log-001',
      type: 'Erro',
      message: 'Falha ao conectar com LinkedIn em worker-02',
      source: 'Worker',
      timestamp: '2026-05-28 09:15'
    },
    {
      id: 'log-002',
      type: 'Execução',
      message: 'Worker iniciado com sucesso',
      source: 'CI',
      timestamp: '2026-05-28 15:00'
    },
    {
      id: 'log-003',
      type: 'Aplicação',
      message: 'Aplicação automática enviada para vaga Easy Apply',
      source: 'Worker',
      timestamp: '2026-05-28 21:05'
    }
  ]
};
