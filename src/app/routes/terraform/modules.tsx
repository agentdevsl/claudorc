import { createFileRoute } from '@tanstack/react-router';
import { TerraformCatalogView } from '@/app/components/features/terraform/terraform-catalog-view';

export const Route = createFileRoute('/terraform/modules')({
  component: TerraformModulesView,
});

function TerraformModulesView(): React.JSX.Element {
  return <TerraformCatalogView />;
}
