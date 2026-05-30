'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { useReviews } from '../../lib/hooks/useReviews';

const statusColorMap: Record<string, 'default' | 'success' | 'error' | 'warning'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  snoozed: 'default'
};

export function ReviewQueue() {
  const { data: reviews, isLoading, isError, error, action } = useReviews();

  if (isLoading) return <Box display="flex" justifyContent="center"><CircularProgress size={20} /></Box>;
  if (isError) return <Alert severity="error">{(error as Error)?.message ?? 'Erro ao carregar fila'}</Alert>;
  if (!reviews || reviews.length === 0) return <Typography>Nenhuma revisão pendente</Typography>;

  const handleAction = (reviewId: string, act: string) => {
    action.mutate({ reviewId, action: act });
  };

  return (
    <Stack spacing={3}>
      {reviews.map((review: any) => (
        <Card key={review.id} sx={{ bgcolor: '#0f172a', border: '1px solid', borderColor: 'divider' }}>
          <CardContent>
            <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} alignItems="flex-start" justifyContent="space-between" gap={2}>
              <Box>
                <Typography variant="h6" color="common.white">
                  {review.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {review.company}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={review.category} color="info" size="small" />
                <Chip label={String(review.status).toUpperCase()} color={statusColorMap[review.status]} size="small" />
              </Stack>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {review.note}
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Motivo: {review.reviewReason}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {review.reviewNotes}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Atualizado: {review.updatedAt}
              </Typography>
              {review.snoozedUntil ? (
                <Typography variant="caption" color="text.secondary">
                  Soneca até: {review.snoozedUntil}
                </Typography>
              ) : null}
            </Stack>
          </CardContent>

          <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
            <Button
              variant="contained"
              color="success"
              size="small"
              disabled={review.status !== 'pending' || (action as any).isLoading}
              onClick={() => handleAction(review.id, 'approve')}
            >
              Aprovar
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="small"
              disabled={review.status !== 'pending' || (action as any).isLoading}
              onClick={() => handleAction(review.id, 'reject')}
            >
              Rejeitar
            </Button>
            <Button
              variant="outlined"
              color="warning"
              size="small"
              disabled={review.status !== 'pending' || (action as any).isLoading}
              onClick={() => handleAction(review.id, 'snooze')}
            >
              Adiar 3d
            </Button>
          </CardActions>
        </Card>
      ))}
    </Stack>
  );
}

export default ReviewQueue;
