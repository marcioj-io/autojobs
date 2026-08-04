// packages/scoring/src/filters/preFilter.service.ts
import { escapeRegex, JobEvaluationInput, normalize, wordBoundaryMatch } from "@autojobs/shared";
import { fuzzyMatchAny } from "../utils";

type KeywordType = "and" | "or" | "single";

interface ParsedKeyword {
  type: KeywordType;
  tokens: string[];
}

export interface PreFilterResult {
  passed: boolean;
  action: "accept" | "reject" | "soft_reject";
  reason?: string;
  matchedKeywords: string[];
}

const KNOWN_SENIORITIES = [
  "aprendiz",
  "junior",
  "jr",
  "pleno",
  "pl",
  "senior",
  "sr",
  "estagio",
  "trainee",
  "especialista",
  "specialist",
  "lead",
  "líder",
  "lider",
  "tech lead",
  "principal",
  "staff",
  "manager",
  "trainee",

  //just moved for negativekeyworkd and search in title object
  "ios",
  "ecm",
  "data",
  "devops"
];

function parseKeyword(raw: string): ParsedKeyword {
  const rawLower = (raw || "").toLowerCase();
  if (rawLower.includes(" and ")) return { type: "and", tokens: rawLower.split(" and ").map(t => normalize(t.trim())) };
  if (rawLower.includes(" or ")) return { type: "or", tokens: rawLower.split(" or ").map(t => normalize(t.trim())) };
  return { type: "single", tokens: [normalize(rawLower.trim())] };
}

function safeArray<T>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}

/**
 * Remove blocos de código e trechos inline para reduzir falsos positivos
 */
function stripCodeBlocks(s: string): string {
  if (!s) return "";
  return s
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/<code>[\s\S]*?<\/code>/g, " ")
    .replace(/\/\/.*$/gm, " ") // linhas de comentário
    .replace(/\/\*[\s\S]*?\*\//g, " ");
}

export class PreFilterService {
  public static evaluate(input: JobEvaluationInput): PreFilterResult {
    const titleRaw = input.title ?? "";
    const descriptionRaw = input.description ?? "";
    const title = normalize(titleRaw);
    const location = normalize(input.location ?? "");
    const combinedHeader = `${title} ${location}`.trim();
    const profile = (input.profile ?? {}) as any;
    const matchedKeywords: string[] = [];

    // --- 1) Modalidades
    const allowedModalities = safeArray<string>(profile.allowedModalities).map((m: string) => normalize(String(m)));
    const jobModalityRaw = (input as any).modality ?? (input as any).modalidade ?? input.location ?? "";
    const jobModality = normalize(String(jobModalityRaw));
    const combinedModalityText = `${combinedHeader} ${jobModality}`.trim();

    if (allowedModalities.length > 0) {
      const isRemoteAllowed = allowedModalities.some(m => m.includes("remoto") || m.includes("remote"));
      const isHybridAllowed = allowedModalities.some(m => m.includes("hibrido") || m.includes("hybrid"));
      const isPresencialAllowed = allowedModalities.some(m => m.includes("presencial") || m.includes("onsite") || m.includes("on-site"));

      const jobIsRemote = combinedModalityText.includes("remoto") || combinedModalityText.includes("remote");
      const jobIsHybrid = combinedModalityText.includes("hibrido") || combinedModalityText.includes("hybrid");
      const jobIsPresencial =
        combinedModalityText.includes("presencial") ||
        combinedModalityText.includes("on-site") ||
        combinedModalityText.includes("onsite");

      const hasExplicitModality = jobIsRemote || jobIsHybrid || jobIsPresencial;

      if (hasExplicitModality) {
        const matchRemote = jobIsRemote && isRemoteAllowed;
        const matchHybrid = jobIsHybrid && isHybridAllowed;
        const matchPresencial = jobIsPresencial && isPresencialAllowed;

        if (!matchRemote && !matchHybrid && !matchPresencial) {
          const detected = [
            ...(jobIsRemote ? ["Remoto"] : []),
            ...(jobIsHybrid ? ["Híbrido"] : []),
            ...(jobIsPresencial ? ["Presencial"] : [])
          ].join(", ");

          return {
            passed: false,
            action: "reject",
            reason: `Pré-filtro: Modalidade da vaga detectada (${detected}) não corresponde às modalidades permitidas do perfil (${allowedModalities.join(", ")}).`,
            matchedKeywords: [`Modalidade detectada: ${detected}`, `Modalidades do perfil: ${allowedModalities.join(", ")}`]
          };
        }
      }
    }

    // --- 2) Cidades / Localização
    const hybridCities = safeArray<string>(profile.hybridCities);
    const searchLocations = safeArray<string>(profile.searchLocation);
    const allAllowedLocations = Array.from(new Set([...hybridCities, ...searchLocations])).map(loc => normalize(String(loc)));

    if (allAllowedLocations.length > 0 && !location.includes("remoto") && location.trim() !== "") {
      const locationMatch = allAllowedLocations.some(loc => wordBoundaryMatch(location, loc));
      if (!locationMatch) {
        return {
          passed: false,
          action: "reject",
          reason: `Pré-filtro: Localização da vaga ("${input.location}") diverge das cidades/regiões permitidas pelo perfil ("${allAllowedLocations.join(", ")}").`,
          matchedKeywords: [`Localização da vaga: ${input.location}`, `Cidades/Regiões do perfil: ${allAllowedLocations.join(", ")}`]
        };
      }
    }

    // --- 3) Senioridade (soft warning)
    const profileSeniorities = safeArray<string>(profile.seniority).map((s: string) => normalize(String(s)));
    if (profileSeniorities.length > 0) {
      const titleSeniorities = KNOWN_SENIORITIES.filter(s => wordBoundaryMatch(title, s));
      if (titleSeniorities.length > 0) {
        const hasMatching = titleSeniorities.some(ts => profileSeniorities.includes(ts));
        if (!hasMatching) {
          matchedKeywords.push(`Senioridade no título (${titleSeniorities.join(", ")}) diverge do perfil (${profileSeniorities.join(", ")})`);
        }
      }
    }

    // --- 4) Negative keywords (refinado: title -> reject, description -> soft_reject, escalation por ocorrências)
    const negativeKeywords = safeArray<string>(profile.negativeKeywords);
    const descriptionNorm = normalize(descriptionRaw);
    const descForCheck = stripCodeBlocks(descriptionNorm);

    for (const raw of negativeKeywords) {
      const parsed = parseKeyword(String(raw));
      let matchInTitle = false;
      let matchInDesc = false;

      const tokens = parsed.tokens.map(t => normalize(t));

      if (parsed.type === "single") {
        const token = tokens[0];
        matchInTitle = wordBoundaryMatch(title, token);
        matchInDesc = wordBoundaryMatch(descForCheck, token) || fuzzyMatchAny(token, [descForCheck]);
      } else if (parsed.type === "and") {
        matchInTitle = tokens.every(t => wordBoundaryMatch(title, t));
        matchInDesc = tokens.every(t => wordBoundaryMatch(descForCheck, t) || fuzzyMatchAny(t, [descForCheck]));
      } else if (parsed.type === "or") {
        matchInTitle = tokens.some(t => wordBoundaryMatch(title, t));
        matchInDesc = tokens.some(t => wordBoundaryMatch(descForCheck, t) || fuzzyMatchAny(t, [descForCheck]));
      }

      // Title strong signal -> reject
      if (matchInTitle) {
        matchedKeywords.push(String(raw));
        return {
          passed: false,
          action: "reject",
          reason: `Pré-filtro: Termo restrito "${raw}" encontrado no título da vaga.`,
          matchedKeywords
        };
      }

      // Description weaker signal -> soft_reject or escalate if repeated
      if (matchInDesc) {
        matchedKeywords.push(String(raw));
        const tokenEscaped = escapeRegex(tokens.join(" "));
        const occurrences = (descForCheck.match(new RegExp(`\\b${tokenEscaped}\\b`, "gi")) || []).length;
        if (occurrences >= 2) {
          return {
            passed: false,
            action: "reject",
            reason: `Pré-filtro: Termo restrito "${raw}" encontrado repetidamente na descrição.`,
            matchedKeywords
          };
        }
        return {
          passed: true,
          action: "soft_reject",
          reason: `Pré-filtro: Termo restrito "${raw}" encontrado na descrição (requer validação contextual).`,
          matchedKeywords
        };
      }
    }

    // --- 5) Soft warnings -> enviar para LLM / revisão manual
    if (matchedKeywords.length > 0) {
      return {
        passed: true,
        action: "soft_reject",
        reason: "Pré-aviso do Pré-Filtro: Divergências ou menções detectadas que requerem validação contextual pela LLM.",
        matchedKeywords
      };
    }

    // Aceita por padrão
    return { passed: true, action: "accept", matchedKeywords: [] };
  }
}
