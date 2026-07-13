// packages\shared\src\types.ts
export type LanguageCode = 'PT' | 'EN' | 'ES';

// export interface ProfileDefinition {
//   name: 'backend' | 'frontend' | 'fullstack';
//   searches: string[];
//   keywords: Record<string, number>;
//   negativeKeywords: Record<string, number>;
//   minScore: number;
//   dailyLimit: number;
//   seniority: 'junior' | 'mid' | 'senior';
//   stackPriority: string[];
//   cv: 'CV_PT' | 'CV_EN';
// }

export interface JobRecord {
  id: string;
  company: string;
  title: string;
  url: string;
  score: number;
  location: string;
  profileName: string;
  easyApply: boolean;
  description?: string;
  applyResult?: string;
  language: LanguageCode;
  modality: 'Remoto' | 'Híbrido' | 'Presencial';
  status: 'found' | 'applied' | 'pending_review' | 'manual';
  createdAt: string;
  updatedAt: string;
  postedAt?: string;
}

export interface ScoreInput {
  title: string;
  description: string;
  location: string;

  modality: 'Remoto' | 'Híbrido' | 'Presencial';

  seniority: 'junior' | 'mid' | 'senior';

  language: LanguageCode;

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

export interface SettingsRecord {
  id: string;
  minScore: number;
  maxDailyApplications: number;
  autoApply: boolean;
  preferredLocation: string;
  blacklist: string;
}

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

