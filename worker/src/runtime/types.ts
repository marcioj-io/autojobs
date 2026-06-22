// worker\src\runtime\types.ts

export interface RuntimePipelineResult {
  jobsProcessed: number;
  autoApplies: number;
  reviewsCreated: number;
  averageScore: number;
}