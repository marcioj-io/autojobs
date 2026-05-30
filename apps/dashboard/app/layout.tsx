import './globals.css';
import { Providers } from '../components/Providers';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'AutoJobs Dashboard',
  description: 'Plataforma de automação inteligente de candidaturas LinkedIn'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
