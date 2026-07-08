// packages\scoring\src\scoreEngine.ts
import type { ScoreInput } from '@autojobs/shared';

const WEIGHTS = {
  baseScore: 30,         // Pontuação inicial de "largada" por a vaga existir na query
  keywordMatch: 8,       // Peso menor (+8): exige que a vaga tenha MÚLTIPLAS skills suas para subir a nota
  negativeKeyword: -60,  // BAZUCA (-60): Se tiver PHP, Java ou Inglês Fluente, a nota despenca pra zero ou quase zero
  easyApply: 15          // Bônus forte por ser candidatura simplificada
};

// 🛠️ CORREÇÃO: Função exportada para ser usada pelo log do Scraper também
export function hasExactMatch(text: string, keyword: string): boolean {
  // Escapa caracteres especiais (como o # do C#, o ponto do Node.js e .NET)
  const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // A regex garante que a palavra está cercada por espaços, pontuações ou começo/fim do texto
  const regex = new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i');
  return regex.test(text);
}

export function calculateScore(input: ScoreInput) {
  let score = WEIGHTS.baseScore; 

  // 🛠️ CORREÇÃO: Normaliza quebras de linha/tabs para espaços simples.
  // Sem isso, palavras compostas (como "sql server") falham se tiverem quebra de linha no meio.
  const text = [
    input.title,
    input.description,
    input.location
  ].join(' ').replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' '); 

  // 1. Soma os pontos das suas skills positivas
  for (const keyword of input.positiveKeywords) {
    if (hasExactMatch(text, keyword)) {
      score += WEIGHTS.keywordMatch;
    }
  }

  // 2. Destrói a pontuação se bater com tecnologias/idiomas indesejados
  for (const keyword of input.negativeKeywords) {
    if (hasExactMatch(text, keyword)) {
      score += WEIGHTS.negativeKeyword;
    }
  }

  // 3. Dá o bônus se a vaga suportar candidatura via LinkedIn
  if (input.easyApply) {
    score += WEIGHTS.easyApply;
  }

  // Trava os limites para nunca ficar negativo nem passar de 100
  return Math.max(0, Math.min(score, 100));
}