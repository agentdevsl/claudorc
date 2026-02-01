import { createFileRoute } from '@tanstack/react-router';
import { TerraformChatPanel } from '@/app/components/features/terraform/terraform-chat-panel';
import { TerraformRightPanel } from '@/app/components/features/terraform/terraform-right-panel';

export const Route = createFileRoute('/terraform/')({
  component: TerraformComposeView,
});

function TerraformComposeView(): React.JSX.Element {
  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="min-w-0 flex-1">
        <TerraformChatPanel />
      </div>
      <div className="w-[380px] border-l border-border">
        <TerraformRightPanel />
      </div>
    </div>
  );
}
