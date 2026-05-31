import { SettingsPanel } from '../../components/dashboard/SettingsPanel';
import { SectionHeader } from '../../components/dashboard/SectionHeader';
import { getBackend } from '../../lib/services/backend';

export default async function SettingsPage() {
  const be = await getBackend((globalThis as any).AUTOJOBS_D1);
  const settings = await be.getSettings('default');

  return (
    <div className="space-y-6">
      <SectionHeader title="Settings" description="Ajuste regras de score, limites e parâmetros automáticos." />
      <SettingsPanel settings={settings} />
    </div>
  );
}
