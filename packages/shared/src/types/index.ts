// packages/shared/src/types.ts
// Tipos compartilhados entre engine, scoring e outros pacotes

// ============================================================================
// INTENÇÃO E CAPACIDADE DO USUÁRIO (PROFILE)
// ============================================================================

export interface SkillCategory {
  years: number;
  level: 'básico' | 'intermediário' | 'avançado' | 'especialista';
  tools: string[];
}

export interface SkillMatrix {
  [category: string]: SkillCategory;
}

export interface ProfileContext {
  id: string;
  name: string;
  targetRoles: string[];
  targetAreas: string[];
  seniority: string[];
  searchLocation: string[];
  allowedModalities: string[];
  hybridCities: string[];
  skillMatrix: SkillMatrix;
  languages: Record<string, string>;
  negativeKeywords: string[];
  aiApplicationContext: string; // O "Brain Dump"
  minScore: number;
  dailyLimit?: number;
  // campos adicionais podem ser adicionados sem quebrar consumidores
  [k: string]: any;
}

// ============================================================================
// RETORNO DO LLM EVALUATOR (NOVO CONTRATO)
// ============================================================================

export interface JobClassification {
  area: string;
  role: string;
  seniority: string;
}

/**
 * Resultado estruturado esperado do LLM evaluator.
 * - rawScore: pontuação base 0-100 calculada pelo LLM
 * - isMatch: booleano indicando se LLM considera compatível
 * - reason: justificativa curta
 * - requiredSkillsFound: skills obrigatórias detectadas na vaga
 * - optionalSkillsFound: skills opcionais detectadas na vaga
 * - missingRequired: required que não foram encontradas
 * - matchedSkills / missingSkills: listas gerais
 * - scoreBreakdown: mapa de componentes do score (opcional)
 */
export interface LlmEvaluationResult {
  rawScore: number;
  isMatch: boolean;
  reason: string;
  classification: JobClassification;
  requiredSkillsFound: string[];
  optionalSkillsFound: string[];
  missingRequired: string[];
  matchedSkills: string[];
  missingSkills: string[];
  scoreBreakdown?: Record<string, number>;
  // campo livre para debug/metadata do LLM
  [k: string]: any;
}

// Entrada exigida pelo Evaluator
export interface JobEvaluationInput {
  title: string;
  description: string;
  location: string;
  profile: ProfileContext;
}

// ============================================================================
// TIPOS GERAIS (APLICAÇÃO / JOBS / SESSÃO)
// ============================================================================

export type LinkedInLanguage = 'PT' | 'EN' | 'ES';

export interface ApplyResult {
  status: 'submitted' | 'no_easy_apply' | 'complex_form' | 'error';
  details: string;
}

export interface JobRecord {
  id: string;
  company: string;
  title: string;
  location: string;
  url: string;
  easyApply: boolean;
  postedAt?: string;
  description?: string;
  language: LinkedInLanguage;
  profileName: string;
  modality?: 'Remoto' | 'Híbrido' | 'Presencial';
  score?: number;
  status?:
    | 'found'
    | 'pending'
    | 'applied'
    | 'submitted'
    | 'failed'
    | 'rejected'
    | 'error'
    | 'pending_review'
    | 'manual';
  applyResult?: ApplyResult | any;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScoreInput {
  title: string;
  description: string;
  location: string;
  modality: 'Remoto' | 'Híbrido' | 'Presencial';
  seniority: 'junior' | 'mid' | 'senior';
  language: LinkedInLanguage;
  easyApply: boolean;
  positiveKeywords: string[];
  negativeKeywords: string[];
}

export interface ApplicationRecord {
  id: string;
  jobId: string;
  status: 'submitted' | 'accepted' | 'rejected' | 'pending';
  result?: string;
  appliedAt: string;
}

export interface ManualReviewRecord {
  id: string;
  jobId: string;
  profile: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewReason?: string;
  reviewNotes?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  snoozedUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LogEntry {
  id: string;
  type: string;
  message: string;
  source: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error';
}

// Runtime / Health types
export type RuntimeStateType = 'IDLE' | 'SCRAPING' | 'APPLYING' | 'COOLDOWN' | 'BLOCKED' | 'DEGRADED' | 'ERROR';
export type HealthStatus = 'healthy' | 'warning' | 'blocked' | 'degraded' | 'offline';

export interface RuntimeStateRecord {
  id: string;
  currentState: RuntimeStateType;
  health: HealthStatus;
  lastExecutionStartedAt?: string;
  lastExecutionFinishedAt?: string;
  nextExecutionAt?: string;
  consecutiveFailures: number;
  cooldownUntil?: string;
  sessionStatus?: string;
  sessionId?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeHistoryRecord {
  id: string;
  runType: 'scheduled' | 'manual' | 'recovery';
  state: RuntimeStateType;
  status: 'success' | 'failure' | 'skipped' | 'blocked';
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  jobsProcessed: number;
  autoApplies: number;
  reviewsCreated: number;
  successRate?: number;
  errorMessage?: string;
  metadata?: string;
}

export interface RetryHistoryRecord {
  id: string;
  runId: string;
  attempt: number;
  error: string;
  backoffMs: number;
  timestamp: string;
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

export interface SessionHealthRecord {
  id: string;
  sessionId: string;
  healthScore: number;
  status: 'healthy' | 'degraded' | 'rotating';
  reason?: string;
  lastValidatedAt: string;
  cooldownUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SelectorFailureRecord {
  id: string;
  selectorType: string;
  selector: string;
  pageUrl?: string;
  error: string;
  metadata?: string;
  timestamp: string;
}

export interface AnomalyLogRecord {
  id: string;
  type: string;
  message: string;
  details?: string;
  severity: 'info' | 'warning' | 'error';
  timestamp: string;
}

export interface ScreenshotMetadataRecord {
  id: string;
  contextType: string;
  contextId?: string;
  path?: string;
  metadata?: string;
  timestamp: string;
}

export type RuntimeControlAction =
  | 'pause'
  | 'resume'
  | 'cooldown'
  | 'emergencyStop'
  | 'resetSession'
  | 'quarantineSession'
  | 'retryApplication';

export interface ReviewActionRequest {
  reviewId: string;
  action: 'approve' | 'reject' | 'snooze';
  reviewer?: string;
  note?: string;
}

export interface SessionControlRequest {
  sessionId: string;
  action: 'reset' | 'quarantine' | 'refresh';
}

export interface SearchFilter {
  id: string;
  profile: string;
  name: string;
  jobTitle?: string;
  modalities: string[]; // ['Remoto', 'Híbrido', 'Presencial']
  cvId?: string;
  useLatestCv: boolean;
  postedWithinHours: number;
  requiredSkills: string[];
  excludedSkills: string[];
  seniority: ('junior' | 'mid' | 'senior')[];
  locations: string[];
  excludedCompanies?: string[];
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}


export interface SettingsRecord {
  id: string;
  minScore: number;
  maxDailyApplications: number;
  autoApply: boolean;
  preferredLocation: string;
  blacklist: string;
}