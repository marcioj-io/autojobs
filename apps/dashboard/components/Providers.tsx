'use client';

import { CssBaseline, ThemeProvider, createTheme, responsiveFontSizes } from '@mui/material';
import { useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 10, // 10s
      refetchOnWindowFocus: false
    }
  }
});

export function Providers({ children }: { children: React.ReactNode }) {
  const theme = useMemo(
    () =>
      responsiveFontSizes(
        createTheme({
          palette: {
            mode: 'dark',
            primary: {
              main: '#60a5fa'
            },
            background: {
              default: '#090e18',
              paper: '#0f172a'
            },
            text: {
              primary: '#e2e8f0',
              secondary: '#94a3b8'
            }
          },
          typography: {
            fontFamily: ['Inter', 'system-ui', 'sans-serif'].join(','),
            h1: { fontWeight: 700 },
            h2: { fontWeight: 700 },
            button: { textTransform: 'none' }
          },
          shape: {
            borderRadius: 20
          }
        })
      ),
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
