import ReviewQueue from '../../components/dashboard/ReviewQueue';
import { SectionHeader } from '../../components/dashboard/SectionHeader';

export default function ManualReviewPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Manual Review"
        description="Acompanhe as vagas que precisam de confirmação humana antes de aplicar."
      />
      <ReviewQueue />
    </div>
  );
}
