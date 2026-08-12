// packages/engine/src/validators/TitleEligibilityValidator.ts

export interface EligibilityProfile {
  targetRoles?: string[];
  seniority?: string[];
  negativeKeywords?: string[];
  allowedModalities?: string[];
  hybridCities?: string[];
}

export interface TitleEligibilityResult {
  eligible: boolean;
  reason?: string;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeToken(value?: string): string {
  return (value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

function containsToken(text: string, token: string): boolean {
  const normalizedText = normalizeToken(text);
  const normalizedToken = normalizeToken(token);
  if (!normalizedToken) return false;

  const hasSpecialChar = /[^\w\s]/.test(normalizedToken);
  if (hasSpecialChar) {
    return normalizedText.includes(normalizedToken);
  }

  return new RegExp(`\\b${escapeRegExp(normalizedToken)}\\b`, 'i').test(normalizedText);
}

function extractSeniorityTokens(text: string): string[] {
  return String(text ?? '')
    .split(/[^a-zA-Z0-9À-ÖØ-öø-ÿ]+/)
    .map((token) => normalizeToken(token))
    .filter(Boolean)
    .filter((token) => /^(junior|jr|senior|pleno|mid|lead|principal|staff|intern|trainee|estagio|estágio|analyst|manager|director|architect)$/i.test(token));
}

function profileSeniorityTokens(profile: EligibilityProfile): string[] {
  if (!profile.seniority || profile.seniority.length === 0) return [];

  return profile.seniority
    .flatMap((value) => String(value ?? '').split(/[^a-zA-Z0-9À-ÖØ-öø-ÿ]+/))
    .map((token) => normalizeToken(token))
    .filter(Boolean);
}

export class TitleEligibilityValidator {
  static validate(title: string, profile: EligibilityProfile): TitleEligibilityResult {
    if (!title) {
      return { eligible: false, reason: 'Título vazio' };
    }

    const normalizedTitle = normalizeToken(title);

    if (profile.negativeKeywords && profile.negativeKeywords.length > 0) {
      for (const keyword of profile.negativeKeywords) {
        if (containsToken(normalizedTitle, keyword)) {
          return { eligible: false, reason: `Contém palavra negativa: ${keyword}` };
        }
      }
    }

    if (profile.targetRoles && profile.targetRoles.length > 0) {
      const matchesRole = profile.targetRoles.some((role) => containsToken(normalizedTitle, role));
      if (!matchesRole) {
        return { eligible: false, reason: 'Não corresponde a nenhuma Target Role' };
      }
    }

    if (profile.seniority && profile.seniority.length > 0) {
      const detectedLevelTokens = extractSeniorityTokens(normalizedTitle);
      const allowedLevelTokens = profileSeniorityTokens(profile);

      if (detectedLevelTokens.length > 0 && allowedLevelTokens.length > 0) {
        const hasAllowedLevel = detectedLevelTokens.some((token) => allowedLevelTokens.includes(token));
        if (!hasAllowedLevel) {
          return { eligible: false, reason: `Seniority incompatível com o perfil: ${profile.seniority.join(', ')}` };
        }
      }
    }

    return { eligible: true };
  }
}