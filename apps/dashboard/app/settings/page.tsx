import { SettingsPanel } from '../../components/dashboard/SettingsPanel';
import { SectionHeader } from '../../components/dashboard/SectionHeader';
import { mockDashboardData } from '../../lib/mockData';

export default function SettingsPage() {
  const { settings } = mockDashboardData;

  return (
    <div className="space-y-6">
      <SectionHeader title="Settings" description="Ajuste regras de score, limites e parâmetros automáticos." />
      <SettingsPanel settings={settings} />
    </div>
  );
}
