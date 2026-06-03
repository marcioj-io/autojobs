import { ReactNode } from 'react';

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
}

/**
 * PageWrapper: Aplicar padding/margin consistente a todas as páginas
 * Garante espaçamento responsivo: p-6 (mobile) → lg:p-10 (desktop)
 */
export function PageWrapper({ children, className = '' }: PageWrapperProps) {
  return (
    <div className={`min-h-screen bg-slate-950 flex flex-col ${className}`}>
      <div className="flex-1 p-6 lg:p-10">
        {children}
      </div>
    </div>
  );
}

/**
 * Section: Container para conteúdo com espaçamento vertical
 */
export function Section({ children, className = '' }: PageWrapperProps) {
  return (
    <section className={`space-y-6 ${className}`}>
      {children}
    </section>
  );
}

/**
 * Card: Container padronizado para cards com borders e espaçamento
 */
interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
}

export function Card({ children, className = '', title, description }: CardProps) {
  return (
    <div className={`rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-glow backdrop-blur-xl ${className}`}>
      {title && (
        <div className="mb-4">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-300/80">{title}</p>
          {description && <p className="mt-1 text-slate-400">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
