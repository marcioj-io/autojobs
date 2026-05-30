import { SectionHeader } from '../../components/dashboard/SectionHeader';
import ReviewQueue from '../../components/dashboard/ReviewQueue';

export default function ReviewsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Manual Review" description="Fila de revisões manuais e detalhes." />
      <ReviewQueue />
    </div>
  );
}
