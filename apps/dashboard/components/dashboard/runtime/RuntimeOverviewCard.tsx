'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { useRuntime } from '../../../lib/hooks/useRuntime';

export function RuntimeOverviewCard() {
  const { data: overview, isLoading, isError, error, control } = useRuntime();

  if (isLoading) return (
    <Card sx={{ p: 2, bgcolor: '#0f172a', border: '1px solid', borderColor: 'divider' }}>
      <CardContent>
        <Box display="flex" justifyContent="center"><CircularProgress size={20} /></Box>
      </CardContent>
    </Card>
  );

  if (isError) return (
    <Card sx={{ p: 2, bgcolor: '#0f172a', border: '1px solid', borderColor: 'divider' }}>
      <CardContent>
        <Alert severity="error">{(error as Error)?.message ?? 'Erro ao carregar runtime'}</Alert>
      </CardContent>
    </Card>
  );

  const onAction = (action: string) => {
    control.mutate(action);
  };

  if (!overview) return null;

  return (
    <Card sx={{ p: 2, bgcolor: '#0f172a', border: '1px solid', borderColor: 'divider' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <div>
            <Typography variant="h6">State: {overview.currentState}</Typography>
            <Typography variant="body2" color="text.secondary">Health: {overview.healthStatus}</Typography>
          </div>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" color="primary" size="small" onClick={() => onAction('resume')}>Resume</Button>
            <Button variant="outlined" color="warning" size="small" onClick={() => onAction('cooldown')}>Cooldown</Button>
            <Button variant="outlined" color="error" size="small" onClick={() => onAction('emergencyStop')}>Emergency Stop</Button>
          </Stack>
        </Box>

        <div style={{ marginTop: 12 }}>
          <Typography variant="caption">Last run: {overview.lastExecutionAt ? new Date(overview.lastExecutionAt).toLocaleString() : '—'}</Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>Next run: {overview.nextExecutionAt ? new Date(overview.nextExecutionAt).toLocaleString() : '—'}</Typography>
        </div>

        <div style={{ marginTop: 12 }}>
          <Typography variant="body2">Jobs processed: {overview.jobsProcessed ?? 0}</Typography>
          <Typography variant="body2">Jobs applied: {overview.jobsApplied ?? 0}</Typography>
          <Typography variant="body2">Pending review: {overview.jobsPendingReview ?? 0}</Typography>
        </div>
      </CardContent>
    </Card>
  );
}

export default RuntimeOverviewCard;
