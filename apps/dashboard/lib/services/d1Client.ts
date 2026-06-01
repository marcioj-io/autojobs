// Utilitário para acessar binding D1 em Cloudflare Pages
// Tenta obter o binding D1 do contexto runtime do Cloudflare

let d1Client: any = null;

export function getD1Client(): any {
  // 1. Tenta globalThis (setado por middleware ou contexto)
  if ((globalThis as any).AUTOJOBS_D1) {
    return (globalThis as any).AUTOJOBS_D1;
  }

  // 2. Tenta acessar via contexto de request do Cloudflare Pages
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).__ENV__) {
      return (globalThis as any).__ENV__.AUTOJOBS_D1;
    }
  } catch (e) {
    // ignorar
  }

  // 3. Tenta acessar via process.env (pode estar disponível em runtime)
  try {
    if (process.env.AUTOJOBS_D1) {
      return process.env.AUTOJOBS_D1;
    }
  } catch (e) {
    // ignorar
  }

  // 4. Retorna null - será tratado no backend
  return null;
}

export function injectD1Client(client: any): void {
  d1Client = client;
  (globalThis as any).AUTOJOBS_D1 = client;
}

export function clearD1Client(): void {
  d1Client = null;
  delete (globalThis as any).AUTOJOBS_D1;
}
