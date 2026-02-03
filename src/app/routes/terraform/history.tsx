import { createFileRoute } from '@tanstack/react-router';
import { TerraformCompositionHistory } from '@/app/components/features/terraform/terraform-composition-history';

export const Route = createFileRoute('/terraform/history')({
  component: TerraformHistoryView,
});

function TerraformHistoryView(): React.JSX.Element {
  return <TerraformCompositionHistory />;
}
