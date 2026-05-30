import { randomUUID } from 'crypto';

export type RuntimeState = 'IDLE' | 'SCRAPING' | 'APPLYING' | 'COOLDOWN' | 'BLOCKED' | 'DEGRADED' | 'ERROR';
export type HealthStatus = 'healthy' | 'warning' | 'blocked' | 'degraded' | 'offline';
export type RuntimeControlAction = 'pause' | 'resume' | 'cooldown' | 'emergencyStop' | 'resetSession' | 'quarantineSession' | 'retryApplication';
export type ReviewAction = 'approve' | 'reject' | 'snooze';
export type SessionControlAction = 'reset' | 'quarantine' | 'refresh';

export interface RuntimeOverview {
  currentState: RuntimeState;
  healthStatus: HealthStatus;
  lastExecutionAt: string;
  nextExecutionAt: string;
  cooldownUntil?: string;
  jobsProcessed: number;
  jobsApplied: number;
  jobsPendingReview: number;
  retriesActive: number;
  lastError?: string;
}

export interface RuntimeEvent {
  id: string;
  timestamp: string;
  type: 'run' | 'retry' | 'recovery' | 'error';
  title: string;
  details: string;
}

export interface MetricCardItem {
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'flat' | 'down';
}

export interface RuntimeMetricRecord {
  id: string;
  recordedAt: string;
  jobsPerDay: number;
  appliesPerDay: number;
  reviewsPerDay: number;
  applySuccessRate: number;
  uptimePercent: number;
  averageScore: number;
  averageDurationMs: number;
}

export interface ReviewQueueItem {
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

export interface ApplicationItem {
  id: string;
  title: string;
  company: string;
  status: 'submitted' | 'accepted' | 'rejected' | 'pending';
  result: string;
  appliedAt: string;
  failureDetails?: string;
}

export interface SessionHealthItem {
  id: string;
  sessionId: string;
  healthScore: number;
  status: HealthStatus;
  reason?: string;
  lastValidatedAt: string;
  cooldownUntil?: string;
}

export interface SessionItem {
  id: string;
  state: 'active' | 'quarantined' | 'refreshing';
  lastUpdated: string;
  ageMinutes: number;
  source: string;
}

export interface SelectorFailureItem {
  id: string;
  selectorType: string;
  selector: string;
  pageUrl?: string;
  error: string;
  metadata?: string;
  timestamp: string;
}

export interface AnomalyLogItem {
  id: string;
  type: string;
  message: string;
  details?: string;
  severity: 'info' | 'warning' | 'error';
  timestamp: string;
}

export interface AuditLogItem {
  id: string;
  eventType: string;
  action: string;
  message: string;
  source: string;
  metadata?: string;
  severity: 'info' | 'warning' | 'error';
  createdAt: string;
}

export interface ScreenshotMetadataItem {
  id: string;
  contextType: string;
  contextId?: string;
  path?: string;
  metadata?: string;
  timestamp: string;
}

const now = new Date();

const runtimeOverview: RuntimeOverview = {
  currentState: 'SCRAPING',
  healthStatus: 'healthy',
  lastExecutionAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
  nextExecutionAt: new Date(now.getTime() + 12 * 60 * 1000).toISOString(),
  cooldownUntil: undefined,
  jobsProcessed: 42,
  jobsApplied: 12,
  jobsPendingReview: 4,
  retriesActive: 1,
  lastError: undefined
};

const runtimeEvents: RuntimeEvent[] = [
  {
    id: randomUUID(),
    timestamp: new Date(now.getTime() - 28 * 60 * 1000).toISOString(),
    type: 'run',
    title: 'Execução planejada iniciada',
    details: 'O runtime iniciou a varredura de vagas e coleta de métricas.'
  },
  {
    id: randomUUID(),
    timestamp: new Date(now.getTime() - 17 * 60 * 1000).toISOString(),
    type: 'retry',
    title: 'Retry aplicado',
    details: 'Aplicação falhou e operação de retry iniciada.'
  },
  {
    id: randomUUID(),
    timestamp: new Date(now.getTime() - 6 * 60 * 1000).toISOString(),
    type: 'recovery',
    title: 'Recuperação automátizada',
    details: 'A sessão foi atualizada após uma detecção de bloqueio leve.'
  }
];

const runtimeMetrics: RuntimeMetricRecord[] = [
  {
    id: randomUUID(),
    recordedAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    jobsPerDay: 36,
    appliesPerDay: 9,
    reviewsPerDay: 4,
    applySuccessRate: 0.78,
    uptimePercent: 99,
    averageScore: 81,
    averageDurationMs: 244000
  },
  {
    id: randomUUID(),
    recordedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    jobsPerDay: 41,
    appliesPerDay: 11,
    reviewsPerDay: 3,
    applySuccessRate: 0.71,
    uptimePercent: 98,
    averageScore: 79,
    averageDurationMs: 256000
  }
];

const reviewQueue: ReviewQueueItem[] = [
  {
    id: 'review-001',
    title: 'Senior NestJS Backend',
    company: 'Pulse Group',
    category: 'Classe B',
    note: 'Está pendente revisão humana para respostas abertas.',
    status: 'pending',
    reviewReason: 'Formulário LinkedIn exige experiência e respostas livres.',
    reviewNotes: 'Retornar ao candidato com portfólio e preenchimento do campo “Projetos”.',
    updatedAt: new Date(now.getTime() - 4 * 60 * 1000).toISOString()
  },
  {
    id: 'review-002',
    title: 'React Developer',
    company: 'Mira Labs',
    category: 'Classe B',
    note: 'Pergunta de disponibilidade remota exige validação.',
    status: 'pending',
    reviewReason: 'Pergunta aberta sobre equipes remotas e disponibilidade.',
    reviewNotes: 'Evitar respostas genéricas para aumentar conversão.',
    updatedAt: new Date(now.getTime() - 38 * 60 * 1000).toISOString()
  },
  {
    id: 'review-003',
    title: 'Fullstack Engineer',
    company: 'Vertex Labs',
    category: 'Classe C',
    note: 'Adiado até o final do dia para revisão de cover letter.',
    status: 'snoozed',
    reviewReason: 'Formulário com etapas de upload e perguntas customizadas.',
    reviewNotes: 'Revisar em proximidade do final do dia.',
    reviewer: 'Ana',
    updatedAt: new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(),
    snoozedUntil: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString()
  }
];

const applicationHistory: ApplicationItem[] = [
  {
    id: 'app-001',
    title: 'Backend Developer',
    company: 'Nuvem Tech',
    status: 'submitted',
    result: 'Aplicação enviada com sucesso',
    appliedAt: new Date(now.getTime() - 75 * 60 * 1000).toISOString()
  },
  {
    id: 'app-002',
    title: 'Frontend Engineer',
    company: 'Omega Systems',
    status: 'pending',
    result: 'Fluxo de aplicação em revisão',
    appliedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'app-003',
    title: 'Fullstack TypeScript',
    company: 'Atlas Digital',
    status: 'rejected',
    result: 'Aplicação revisitda por ressalvas de senioridade',
    appliedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
    failureDetails: 'Perguntas abertas não foram compatíveis.'
  }
];

const sessionHealthItems: SessionHealthItem[] = [
  {
    id: 'session-001',
    sessionId: 'linkedin-backend',
    healthScore: 78,
    status: 'healthy',
    reason: 'Sessão ativa e validada recentemente.',
    lastValidatedAt: new Date(now.getTime() - 18 * 60 * 1000).toISOString(),
    cooldownUntil: undefined
  }
];

const sessionItems: SessionItem[] = [
  {
    id: 'linkedin-backend',
    state: 'active',
    lastUpdated: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
    ageMinutes: 30,
    source: 'worker-01'
  }
];

const selectorFailures: SelectorFailureItem[] = [
  {
    id: 'selector-001',
    selectorType: 'jobCard',
    selector: 'li.jobs-search-results__list-item',
    pageUrl: 'https://www.linkedin.com/jobs/search/',
    error: 'Elemento não encontrado após atualização do DOM',
    metadata: 'viewport=1366x768',
    timestamp: new Date(now.getTime() - 48 * 60 * 1000).toISOString()
  }
];

const anomalyLogs: AnomalyLogItem[] = [
  {
    id: 'anomaly-001',
    type: 'captcha',
    message: 'LinkedIn detectou comportamento incomum durante aplicação.',
    details: 'Tentativas de clique rápido em múltiplos botões de envio.',
    severity: 'warning',
    timestamp: new Date(now.getTime() - 16 * 60 * 1000).toISOString()
  }
];

const auditLogs: AuditLogItem[] = [
  {
    id: 'audit-001',
    eventType: 'runtime',
    action: 'startup',
    message: 'Worker inicializado e pronto para processar jobs.',
    source: 'dashboard-mock',
    metadata: JSON.stringify({ profile: 'backend' }),
    severity: 'info',
    createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'audit-002',
    eventType: 'manual_review',
    action: 'approve',
    message: 'Revisão manual aprovada pelo operador.',
    source: 'dashboard-mock',
    metadata: JSON.stringify({ reviewId: 'review-001' }),
    severity: 'info',
    createdAt: new Date(now.getTime() - 90 * 60 * 1000).toISOString()
  }
];

const screenshotMetadata: ScreenshotMetadataItem[] = [
  {
    id: 'screenshot-001',
    contextType: 'runtime-error',
    contextId: 'run-001',
    path: '/assets/screenshots/error-2026-05-29-02.png',
    metadata: '{"page":"apply","reason":"submit-failure"}',
    timestamp: new Date(now.getTime() - 16 * 60 * 1000).toISOString()
  }
];

const logs = [
  {
    id: 'log-001',
    type: 'error',
    message: 'Falha ao conectar com LinkedIn em worker-02',
    source: 'worker',
    level: 'error',
    timestamp: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'log-002',
    type: 'execution',
    message: 'Worker iniciado com sucesso',
    source: 'worker',
    level: 'info',
    timestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'log-003',
    type: 'application',
    message: 'Aplicação automática enviada para vaga Easy Apply',
    source: 'worker',
    level: 'info',
    timestamp: new Date(now.getTime() - 45 * 60 * 1000).toISOString()
  }
];

export function getRuntimeOverview() {
  return runtimeOverview;
}

export function getRuntimeEvents() {
  return runtimeEvents.slice();
}

export function getRuntimeMetrics() {
  return runtimeMetrics.slice();
}

export function getReviewQueue() {
  return reviewQueue.slice();
}

export function performReviewAction(id: string, action: ReviewAction, note?: string) {
  const review = reviewQueue.find((item) => item.id === id);
  if (!review) return null;
  if (action === 'snooze') {
    review.status = 'snoozed';
    review.snoozedUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    review.reviewer = 'Operador';
    review.reviewNotes = note ?? review.reviewNotes;
  } else {
    review.status = action === 'approve' ? 'approved' : 'rejected';
    review.reviewer = 'Operador';
    review.reviewNotes = note ?? review.reviewNotes;
  }
  review.updatedAt = new Date().toISOString();
  logs.unshift({
    id: randomUUID(),
    type: 'review',
    message: `Revisão ${action} em ${review.title}`,
    source: 'dashboard',
    level: 'info',
    timestamp: new Date().toISOString()
  });
  return review;
}

export function getApplications() {
  return applicationHistory.slice();
}

export function retryApplication(id: string) {
  const application = applicationHistory.find((item) => item.id === id);
  if (!application) return null;
  application.status = 'submitted';
  application.result = 'Retry disparado e reaplicação em andamento';
  logs.unshift({
    id: randomUUID(),
    type: 'retry',
    message: `Retry de aplicação ${application.title}`,
    source: 'dashboard',
    level: 'info',
    timestamp: new Date().toISOString()
  });
  return application;
}

export function getSessions() {
  return sessionItems.slice();
}

export function getSessionHealth() {
  return sessionHealthItems.slice();
}

export function controlRuntime(action: RuntimeControlAction) {
  switch (action) {
    case 'pause':
      runtimeOverview.currentState = 'COOLDOWN';
      runtimeOverview.healthStatus = 'warning';
      runtimeOverview.cooldownUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      break;
    case 'resume':
      runtimeOverview.currentState = 'SCRAPING';
      runtimeOverview.healthStatus = 'healthy';
      runtimeOverview.cooldownUntil = undefined;
      break;
    case 'cooldown':
      runtimeOverview.currentState = 'COOLDOWN';
      runtimeOverview.healthStatus = 'warning';
      runtimeOverview.cooldownUntil = new Date(Date.now() + 45 * 60 * 1000).toISOString();
      break;
    case 'emergencyStop':
      runtimeOverview.currentState = 'BLOCKED';
      runtimeOverview.healthStatus = 'blocked';
      runtimeOverview.cooldownUntil = undefined;
      break;
    case 'resetSession':
      sessionHealthItems[0].healthScore = 70;
      sessionHealthItems[0].reason = 'Sessão resetada manualmente.';
      sessionHealthItems[0].lastValidatedAt = new Date().toISOString();
      break;
    case 'quarantineSession':
      sessionItems[0].state = 'quarantined';
      sessionItems[0].lastUpdated = new Date().toISOString();
      break;
    case 'retryApplication':
      runtimeOverview.retriesActive += 1;
      break;
  }

  logs.unshift({
    id: randomUUID(),
    type: 'control',
    message: `Ação de controle: ${action}`,
    source: 'dashboard',
    level: action === 'emergencyStop' ? 'error' : 'info',
    timestamp: new Date().toISOString()
  });

  return { action, state: runtimeOverview };
}

export function getLogs() {
  return logs.slice(0, 80);
}

export function getAuditLogs() {
  return auditLogs.slice(0, 80);
}

export function getSelectorFailures() {
  return selectorFailures.slice();
}

export function getAnomalies() {
  return anomalyLogs.slice();
}

export function getScreenshots() {
  return screenshotMetadata.slice();
}
