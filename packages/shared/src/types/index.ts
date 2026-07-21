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

// worker/src/utils/index.ts
import { z } from 'zod';

/**
 * Normaliza strings: trim, NFC, remove espaços extras.
 */
export function normalizeString(input?: string): string {
  if (input === undefined || input === null) return '';
  const s = String(input).trim();
  return s.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/**
 * Normaliza nomes de cidade/país para comparação e armazenamento.
 * Corrige padrões comuns de mojibake e aplica NFC.
 */
export function normalizeCityName(input?: string): string {
  if (!input) return '';
  let n = String(input).normalize('NFC').trim();

  // heurísticas simples para corrigir mojibake comuns
  const fixes: Record<string, string> = {
    'S�o Paulo': 'São Paulo',
    'SÃ£o Paulo': 'São Paulo',
    'H�brido': 'Híbrido',
    'HÃ­brido': 'Híbrido'
  };

  for (const [k, v] of Object.entries(fixes)) {
    if (n.includes(k)) n = n.replace(new RegExp(k, 'g'), v);
  }

  // fallback: replace lone replacement char if present
  n = n.replace(/�/g, 'ó');

  return n.replace(/\s+/g, ' ').trim();
}

/**
 * Garante que o valor seja array de strings limpo, sem duplicatas.
 */
export function ensureStringArray(value: any, fallback: string[] = []): string[] {
  if (value === undefined || value === null) return [...fallback];
  if (Array.isArray(value)) {
    return dedupeAndNormalize(value.map(v => normalizeString(String(v))));
  }
  if (typeof value === 'string') {
    // tenta parse JSON primeiro
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return dedupeAndNormalize(parsed.map((v: any) => normalizeString(String(v))));
    } catch {
      // não JSON: trata como CSV
      return dedupeAndNormalize(value.split(',').map(s => normalizeString(s)));
    }
  }
  return [...fallback];
}

function dedupeAndNormalize(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const v = raw.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

/**
 * Canonicaliza modalidades (aceita variações e devolve padrão)
 */
export function normalizeModalities(value: any): string[] {
  const raw = ensureStringArray(value, ['remoto', 'híbrido']);
  const map: Record<string, string> = {
    'remoto': 'Remoto',
    'remota': 'Remoto',
    'home': 'Remoto',
    'híbrido': 'Híbrido',
    'hibrido': 'Híbrido',
    'presencial': 'Presencial',
    'presencialmente': 'Presencial'
  };

  return dedupeAndNormalize(raw.map(r => {
    const k = r.toLowerCase();
    return map[k] ?? capitalizeWords(r);
  }));
}

function capitalizeWords(s: string) {
  return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Validação Zod do payload mínimo para profiles.
 */
export const ProfileInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  targetRoles: z.any().optional(),
  targetAreas: z.any().optional(),
  seniority: z.any().optional(),
  searchLocation: z.any().optional(),
  allowedModalities: z.any().optional(),
  hybridCities: z.any().optional(),
  skillMatrix: z.any().optional(),
  languages: z.any().optional(),
  negativeKeywords: z.any().optional(),
  resumeFilePath: z.string().nullable().optional(),
  aiApplicationContext: z.string().optional(),
  minScore: z.number().int().optional(),
  dailyLimit: z.number().int().optional()
});

/**
 * Normaliza todo o objeto profile antes de persistir.
 */
export function normalizeProfileInput(raw: any) {
  const input = raw ?? {};
  const name = normalizeString(input.name ?? input.title ?? '');
  const targetRoles = ensureStringArray(input.targetRoles, []);
  const targetAreas = ensureStringArray(input.targetAreas, []);
  const seniority = ensureStringArray(input.seniority, []);
  const searchLocation = ensureStringArray(input.searchLocation, ['Brasil']).map(normalizeCityName);
  const allowedModalities = normalizeModalities(input.allowedModalities);
  const hybridCities = ensureStringArray(input.hybridCities, []).map(normalizeCityName);
  const negativeKeywords = ensureStringArray(input.negativeKeywords, []);
  const languages = (typeof input.languages === 'string' ? tryParseJson(input.languages) : input.languages) ?? {};
  const skillMatrix = (typeof input.skillMatrix === 'string' ? tryParseJson(input.skillMatrix) : input.skillMatrix) ?? {};

  return {
    ...input,
    name,
    targetRoles,
    targetAreas,
    seniority,
    searchLocation,
    allowedModalities,
    hybridCities,
    negativeKeywords,
    languages,
    skillMatrix,
    resumeFilePath: input.resumeFilePath ?? null,
    aiApplicationContext: normalizeString(input.aiApplicationContext ?? ''),
    minScore: Number.isFinite(Number(input.minScore)) ? Number(input.minScore) : 75,
    dailyLimit: Number.isFinite(Number(input.dailyLimit)) ? Number(input.dailyLimit) : 10,
    updatedAt: input.updatedAt ? new Date(input.updatedAt) : new Date(),
    createdAt: input.createdAt ? new Date(input.createdAt) : new Date()
  };
}

function tryParseJson(s: any) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
