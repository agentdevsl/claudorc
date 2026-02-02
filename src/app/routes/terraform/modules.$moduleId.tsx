import { createFileRoute } from '@tanstack/react-router';
import { TerraformModuleDetail } from '@/app/components/features/terraform/terraform-module-detail';

export const Route = createFileRoute('/terraform/modules/$moduleId')({
  component: TerraformModuleDetailView,
});

function TerraformModuleDetailView(): React.JSX.Element {
  const { moduleId } = Route.useParams();
  return <TerraformModuleDetail moduleId={moduleId} />;
}
