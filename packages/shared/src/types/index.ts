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
}

// ============================================================================
// RETORNO DO LLM EVALUATOR
// ============================================================================

export interface JobClassification {
  area: string;
  role: string;
  seniority: string;
}

export interface LlmEvaluationResult {
  score: number;
  isMatch: boolean;          // Mapearemos isso para o "approved" do scraper
  reason: string;            // A justificativa clara e curta (ai_reason)
  classification: JobClassification;
  matchedSkills: string[];
  missingSkills: string[];
}

// Entrada exigida pelo Evaluator
export interface JobEvaluationInput {
  title: string;
  description: string;
  location: string;
  profile: ProfileContext;
}


export interface LlmEvaluationResult {
  score: number;
  isMatch: boolean;
  reason: string;
  classification: { area: string; role: string; seniority: string; };
  matchedSkills: string[];
  missingSkills: string[];
}