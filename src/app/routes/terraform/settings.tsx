import { createFileRoute } from '@tanstack/react-router';
import { TerraformSettingsPanel } from '@/app/components/features/terraform/terraform-settings-panel';

export const Route = createFileRoute('/terraform/settings')({
  component: TerraformSettingsView,
});

function TerraformSettingsView(): React.JSX.Element {
  return <TerraformSettingsPanel />;
}
