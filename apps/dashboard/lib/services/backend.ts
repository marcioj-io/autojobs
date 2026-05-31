// apps\dashboard\lib\services\backend.ts
import {
  getRuntimeOverview as mockGetRuntimeOverview,
  getRuntimeEvents as mockGetRuntimeEvents,
  getRuntimeMetrics as mockGetRuntimeMetrics,
  getApplications as mockGetApplications,
  getReviewQueue as mockGetReviewQueue,
  getSessions as mockGetSessions,
  getSessionHealth as mockGetSessionHealth,
  getLogs as mockGetLogs,
  getSelectorFailures as mockGetSelectorFailures,
  getAnomalies as mockGetAnomalies,
  performReviewAction,
  controlRuntime as mockControlRuntime
} from '../dashboardStore';
import { mockDashboardData } from '../mockData';

// Lightweight adapter: if a D1 client is attached to globalThis as AUTOJOBS_D1 or __AUTOJOBS_D1_CLIENT__, use @autojobs/db services; otherwise fallback to mock store.

type RuntimeAction = 'pause' | 'resume' | 'stop' | 'restart' | 'cooldown' | 'emergencyStop';

type Backend = {
  getRuntimeOverview: () => Promise<any>;
  getRuntimeHistory: () => Promise<any>;
  getRuntimeMetrics: () => Promise<any>;
  getApplications: () => Promise<any>;
  getJobs: () => Promise<any>;
  getApplicationById: (id: string) => Promise<any>;
  getReviews: () => Promise<any>;
  getReviewById: (id: string) => Promise<any>;
  getSessions: () => Promise<any>;
  getSessionHealth: () => Promise<any>;
  getLogs: () => Promise<any>;
  getAnomalies: () => Promise<any>;
  getRetries: () => Promise<any>;
  getAuditLogs: () => Promise<any>;
  getProfiles: () => Promise<any>;
  createProfile: (profile: any) => Promise<any>;
  getSettings: (id: string) => Promise<any>;
  upsertSettings: (settings: any) => Promise<any>;
  approveReview: (id: string, reviewer: string, notes?: string) => Promise<any>;
  rejectReview: (id: string, reviewer: string, notes?: string) => Promise<any>;
  snoozeReview: (id: string, until: Date, reviewer?: string) => Promise<any>;
  controlRuntime: (action: RuntimeAction) => Promise<any>;
  getHealthOverview: () => Promise<any>;
  getObservabilityOverview: () => Promise<any>;
};

const isProduction = typeof process !== "undefined" && process.env?.NODE_ENV === "production";

function resolveD1Client(d1Client?: any) {
  if (d1Client) return d1Client;
  if (typeof globalThis !== 'undefined') {
    return (globalThis as any).AUTOJOBS_D1 ?? (globalThis as any).__AUTOJOBS_D1_CLIENT__ ?? null;
  }
  return null;
}

async function createDbBackend(d1Client?: any): Promise<Backend | null> {
  const client = resolveD1Client(d1Client);
  if (!client) return null;

  try {
    // Use webpackIgnore to prevent Webpack from bundling @autojobs/db into Edge Runtime builds.
    // In Edge context, d1Client will be undefined and this path won't execute; in Node/Worker, the import succeeds.
    const dbModule = await import(/* webpackIgnore: true */ '@autojobs/db');
    const { bootstrapDatabase, PersistenceService, RuntimeService, ReviewService, AuditLogsService } = dbModule as any;
    const drizzleClient = await bootstrapDatabase(d1Client);
    if (!drizzleClient) return null;

    const persistence = new PersistenceService(drizzleClient);
    const runtime = new RuntimeService(drizzleClient);
    const review = new ReviewService(drizzleClient);
    const audit = new AuditLogsService(drizzleClient);

    const ensureRuntimeState = async () => {
      await runtime.ensureState('default');
      return runtime.getState('default');
    };

    const createAudit = async (eventType: string, action: string, message: string, severity: 'info' | 'warning' | 'error' = 'info') => {
      await audit.recordAuditLog({
        eventType,
        action,
        message,
        source: 'dashboard.api',
        metadata: null,
        severity
      });
    };

    return {
      getRuntimeOverview: async () => await ensureRuntimeState(),
      getRuntimeHistory: async () => await runtime.getRecentHistory(50),
      getRuntimeMetrics: async () => await runtime.getRecentMetrics(50),
      getApplications: async () => await persistence.getApplications(),
      getJobs: async () => await persistence.getAllJobs(),
      getProfiles: async () => await persistence.getAllProfiles(),
      createProfile: async (profile: any) => await persistence.createProfile(profile),
      getSettings: async (id: string) => await persistence.getSettings(id),
      upsertSettings: async (settings: any) => await persistence.upsertSettings(settings),
      getApplicationById: async (id: string) => await persistence.getApplicationById(id),
      getReviews: async () => await persistence.getPendingReviews(),
      getReviewById: async (id: string) => await review.getReview(id),
      getSessions: async () => await persistence.getSessions(),
      getSessionHealth: async () => await persistence.getRecentSessionHealth(50),
      getLogs: async () => await persistence.getRecentLogs(100),
      getAnomalies: async () => await persistence.getRecentAnomalyLogs(100),
      getRetries: async () => await runtime.getRecentRetries(100),
      getAuditLogs: async () => await audit.getRecentAuditLogs(50),
      approveReview: async (id: string, reviewer: string, notes?: string) => {
        const reviewRecord = await review.getReview(id);
        if (!reviewRecord) return null;
        await review.approveReview(id, reviewer, notes);
        await createAudit('review', 'approve', `Manual review approved: ${id}`, 'info');
        return review.getReview(id);
      },
      rejectReview: async (id: string, reviewer: string, notes?: string) => {
        const reviewRecord = await review.getReview(id);
        if (!reviewRecord) return null;
        await review.rejectReview(id, reviewer, notes);
        await createAudit('review', 'reject', `Manual review rejected: ${id}`, 'warning');
        return review.getReview(id);
      },
      snoozeReview: async (id: string, until: Date, reviewer?: string) => {
        const reviewRecord = await review.getReview(id);
        if (!reviewRecord) return null;
        await review.snoozeReview(id, until, reviewer);
        await createAudit('review', 'snooze', `Manual review snoozed until ${until.toISOString()}: ${id}`, 'info');
        return review.getReview(id);
      },
      controlRuntime: async (action: RuntimeAction) => {
        const now = new Date();
        await runtime.ensureState('default');

        const normalizedAction = action === 'cooldown' ? 'pause' : action === 'emergencyStop' ? 'stop' : action;
        const stateUpdates: Record<string, Partial<any>> = {
          pause: {
            currentState: 'COOLDOWN',
            health: 'warning',
            cooldownUntil: new Date(now.getTime() + 30 * 60 * 1000),
            nextExecutionAt: new Date(now.getTime() + 30 * 60 * 1000),
            lastError: null
          },
          resume: {
            currentState: 'IDLE',
            health: 'healthy',
            cooldownUntil: null,
            nextExecutionAt: now,
            lastError: null
          },
          stop: {
            currentState: 'BLOCKED',
            health: 'blocked',
            cooldownUntil: null,
            nextExecutionAt: null,
            lastError: 'Stopped by operator'
          },
          restart: {
            currentState: 'IDLE',
            health: 'healthy',
            cooldownUntil: null,
            nextExecutionAt: now,
            lastError: null
          }
        };

        const patch = stateUpdates[action];
        if (!patch) throw new Error(`Unsupported runtime control action: ${action}`);
        await runtime.updateState('default', { ...patch, updatedAt: new Date() });
        await createAudit('runtime', action, `Runtime action executed: ${action}`, action === 'stop' ? 'error' : 'info');
        return runtime.getState('default');
      },
      getHealthOverview: async () => {
        const runtimeState = await ensureRuntimeState();
        const sessionHealthRecords = await persistence.getRecentSessionHealth(50);
        const sessionSummary = {
          totalSessions: sessionHealthRecords.length,
          healthy: sessionHealthRecords.filter((record: any) => record.status === 'healthy').length,
          warning: sessionHealthRecords.filter((record: any) => record.status === 'warning').length,
          blocked: sessionHealthRecords.filter((record: any) => record.status === 'blocked').length,
          latestUpdatedAt: sessionHealthRecords[0]?.updatedAt ?? null
        };

        return {
          runtimeStatus: runtimeState,
          sessionStatus: sessionSummary,
          recentSessionHealth: sessionHealthRecords
        };
      },
      getObservabilityOverview: async () => {
        const runtimeState = await ensureRuntimeState();
        const sessionHealthRecords = await persistence.getRecentSessionHealth(50);
        const selectorFailures = await persistence.getRecentSelectorFailures(50);
        const anomalyLogs = await persistence.getRecentAnomalyLogs(50);
        const retries = await runtime.getRecentRetries(100);
        const latestMetric = (await runtime.getRecentMetrics(1))[0] ?? null;

        return {
          runtimeStatus: runtimeState,
          sessionStatus: {
            total: sessionHealthRecords.length,
            healthy: sessionHealthRecords.filter((record: any) => record.status === 'healthy').length,
            warning: sessionHealthRecords.filter((record: any) => record.status === 'warning').length,
            blocked: sessionHealthRecords.filter((record: any) => record.status === 'blocked').length
          },
          selectorFailures: selectorFailures.slice(0, 10),
          anomalyCount: anomalyLogs.length,
          applySuccessRate: latestMetric?.applySuccessRate ?? 0,
          retryCount: retries.length
        };
      }
    };
  } catch (err) {
    console.error('Failed to initialize DB backend for dashboard:', err);
    return null;
  }
}

export async function getBackend(
  d1Client?: any
): Promise<Backend> {
  const b = await createDbBackend(d1Client);

  if (b) {
    return b;
  }

  if (isProduction) {
    throw new Error(
      'Dashboard requires a real D1 database client in production; no mock fallback allowed.'
    );
  }

  const fallbackBackend: Backend = {
    getRuntimeOverview: async () => mockGetRuntimeOverview(),

    getRuntimeHistory: async () => mockGetRuntimeEvents(),

    getRuntimeMetrics: async () => mockGetRuntimeMetrics(),

    getApplications: async () => mockGetApplications(),

    getJobs: async () => mockDashboardData.jobs ?? [],

    getApplicationById: async (id: string) =>
      mockGetApplications().find((item: any) => item.id === id) ?? null,

    getReviews: async () => mockGetReviewQueue(),

    getReviewById: async (id: string) =>
      mockGetReviewQueue().find((item: any) => item.id === id) ?? null,

    getSessions: async () => mockGetSessions(),

    getSessionHealth: async () => mockGetSessionHealth(),

    getLogs: async () => mockGetLogs(),

    getAnomalies: async () => mockGetAnomalies(),

    getRetries: async () => [],

    getAuditLogs: async () => [],

    getProfiles: async () => mockDashboardData.profiles,

    createProfile: async (profile: any) => {
      mockDashboardData.profiles.push(profile);
      return profile;
    },

    getSettings: async (_id: string) => mockDashboardData.settings,

    upsertSettings: async (settings: any) => {
      Object.assign(mockDashboardData.settings, settings);
      return mockDashboardData.settings;
    },

    approveReview: async (
      id: string,
      _reviewer: string,
      notes?: string
    ) => performReviewAction(id, 'approve', notes),

    rejectReview: async (
      id: string,
      _reviewer: string,
      notes?: string
    ) => performReviewAction(id, 'reject', notes),

    snoozeReview: async (
      id: string,
      until: Date,
      reviewer?: string
    ) =>
      performReviewAction(
        id,
        'snooze',
        `${reviewer ?? 'dashboard-operator'} snoozed until ${until.toISOString()}`
      ),

    controlRuntime: async (action: RuntimeAction) => {
      if (action === 'stop') {
        return mockControlRuntime('emergencyStop');
      }

      if (action === 'restart') {
        return mockControlRuntime('resume');
      }

      return mockControlRuntime(action);
    },

    getHealthOverview: async () => {
      const healthRecords = mockGetSessionHealth();

      return {
        runtimeStatus: mockGetRuntimeOverview(),
        sessionStatus: {
          totalSessions: healthRecords.length,
          healthy: healthRecords.filter(
            (record: any) => record.status === 'healthy'
          ).length,
          warning: healthRecords.filter(
            (record: any) => record.status === 'warning'
          ).length,
          blocked: healthRecords.filter(
            (record: any) => record.status === 'blocked'
          ).length,
          latestUpdatedAt:
            healthRecords[0]?.lastValidatedAt ?? null
        },
        recentSessionHealth: healthRecords
      };
    },

    getObservabilityOverview: async () => {
      const healthRecords = mockGetSessionHealth();
      const selectorFailures = mockGetSelectorFailures();
      const anomalyLogs = mockGetAnomalies();
      const metrics = mockGetRuntimeMetrics();

      return {
        runtimeStatus: mockGetRuntimeOverview(),
        sessionStatus: {
          total: healthRecords.length,
          healthy: healthRecords.filter(
            (record: any) => record.status === 'healthy'
          ).length,
          warning: healthRecords.filter(
            (record: any) => record.status === 'warning'
          ).length,
          blocked: healthRecords.filter(
            (record: any) => record.status === 'blocked'
          ).length
        },
        selectorFailures,
        anomalyCount: anomalyLogs.length,
        applySuccessRate:
          metrics?.[0]?.applySuccessRate ?? 0,
        retryCount: 0
      };
    }
  };

  return fallbackBackend;
}