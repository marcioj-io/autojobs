// apps/dashboard/lib/services/workerApi.ts
// Direct API client for Worker endpoints - NO MOCKS in production

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'https://autojobs-worker.marciojunior5872.workers.dev';

export interface WorkerJob {
  id: string;
  title: string;
  company: string;
  score: number;
  status: 'Easy Apply' | 'Manual Review' | 'Applied' | 'Rejected';
  location: string;
  modality: string;
  easyApply: boolean;
  postedAt: string;
  url?: string;
}

export interface WorkerProfile {
  id: string;
  name: string;
  status: 'Ativo' | 'Inativo';
  dailyLimit?: number;
  minScore?: number;
  seniority?: string;
  cv?: string;
}

export interface WorkerReview {
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

export interface WorkerApplication {
  id: string;
  jobId: string;
  status: 'applied' | 'rejected' | 'accepted';
  appliedAt: string;
}

export interface DashboardMetrics {
  totalJobs: number;
  totalApplications: number;
  totalReviews: number;
  averageScore: number;
}

/**
 * Fetch all jobs from Worker - realtime data from D1
 */
export async function fetchJobs(): Promise<WorkerJob[]> {
  try {
    const res = await fetch(`${WORKER_URL}/jobs`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 60 } // Cache for 60 seconds
    });

    if (!res.ok) {
      console.error(`[Worker API] Jobs fetch failed: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json() as any;
    return Array.isArray(data) ? data : data.jobs || [];
  } catch (error) {
    console.error('[Worker API] Jobs fetch error:', error);
    return [];
  }
}

/**
 * Fetch all applications - realtime data from D1
 */
export async function fetchApplications(): Promise<WorkerApplication[]> {
  try {
    const res = await fetch(`${WORKER_URL}/applications`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 60 }
    });

    if (!res.ok) {
      console.error(`[Worker API] Applications fetch failed: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json() as any;
    return Array.isArray(data) ? data : data.applications || [];
  } catch (error) {
    console.error('[Worker API] Applications fetch error:', error);
    return [];
  }
}

/**
 * Fetch all reviews - realtime data from D1
 */
export async function fetchReviews(): Promise<WorkerReview[]> {
  try {
    const res = await fetch(`${WORKER_URL}/reviews`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 60 }
    });

    if (!res.ok) {
      console.error(`[Worker API] Reviews fetch failed: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json() as any;
    return Array.isArray(data) ? data : data.reviews || [];
  } catch (error) {
    console.error('[Worker API] Reviews fetch error:', error);
    return [];
  }
}

/**
 * Fetch all profiles - realtime data from D1
 */
export async function fetchProfiles(): Promise<WorkerProfile[]> {
  try {
    const res = await fetch(`${WORKER_URL}/profiles`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 60 }
    });

    if (!res.ok) {
      console.error(`[Worker API] Profiles fetch failed: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json() as any;
    return Array.isArray(data) ? data : data.profiles || [];
  } catch (error) {
    console.error('[Worker API] Profiles fetch error:', error);
    return [];
  }
}

/**
 * Fetch all settings
 */
export async function fetchSettings(id: string = 'default'): Promise<any> {
  try {
    const res = await fetch(`${WORKER_URL}/settings?id=${id}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 60 }
    });

    if (!res.ok) {
      console.error(`[Worker API] Settings fetch failed: ${res.status} ${res.statusText}`);
      return {};
    }

    return await res.json();
  } catch (error) {
    console.error('[Worker API] Settings fetch error:', error);
    return {};
  }
}

/**
 * Calculate dashboard metrics from real data
 */
export async function calculateMetrics(
  jobs: WorkerJob[],
  applications: WorkerApplication[],
  reviews: WorkerReview[]
): Promise<DashboardMetrics> {
  const avgScore = jobs.length > 0
    ? Math.round(jobs.reduce((sum, job) => sum + (job.score || 0), 0) / jobs.length)
    : 0;

  return {
    totalJobs: jobs.length,
    totalApplications: applications.length,
    totalReviews: reviews.length,
    averageScore: avgScore
  };
}

/**
 * Health check - verify Worker and D1 connectivity
 */
export async function checkWorkerHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${WORKER_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 10 }
    });
    return res.ok;
  } catch {
    return false;
  }
}
