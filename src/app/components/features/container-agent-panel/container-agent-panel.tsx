import { Square } from '@phosphor-icons/react';
import { Button } from '@/app/components/ui/button';
import { useContainerAgent } from '@/app/hooks/use-container-agent';
import { ContainerAgentHeader } from './container-agent-header';
import { ContainerAgentStatusBreadcrumbs } from './container-agent-status-breadcrumbs';
import { ContainerAgentStream } from './container-agent-stream';
import { ContainerAgentToolList } from './container-agent-tool-list';

export interface ContainerAgentPanelProps {
  /** Session ID to subscribe to */
  sessionId: string | null;
  /** Callback when stop is requested */
  onStop?: () => Promise<void>;
  /** Callback when plan is approved */
  onApprovePlan?: () => void;
  /** Callback when plan is rejected */
  onRejectPlan?: () => void;
  /** Whether a plan action is in progress */
  isPlanActionPending?: boolean;
}

/**
 * Container Agent Panel - Displays real-time container agent execution
 *
 * Shows:
 * - Agent status and turn counter
 * - Streaming token output
 * - Tool execution progress
 * - Final result or error
 */
export function ContainerAgentPanel({
  sessionId,
  onStop,
  onApprovePlan,
  onRejectPlan,
  isPlanActionPending,
}: ContainerAgentPanelProps): React.JSX.Element {
  const { state, connectionState, isStreaming } = useContainerAgent(sessionId);

  const isActive = state.status === 'running' || state.status === 'starting';

  return (
    <div className="flex flex-1 min-h-0 min-w-0 flex-col rounded-lg border border-border bg-surface">
      {/* Header with status and controls */}
      <div className="flex items-center justify-between border-b border-border bg-surface-subtle px-4 py-3">
        <ContainerAgentHeader
          status={state.status}
          model={state.model}
          currentTurn={state.currentTurn}
          maxTurns={state.maxTurns}
          startedAt={state.startedAt}
          connectionState={connectionState}
          isStreaming={isStreaming}
        />

        {/* Stop button */}
        {isActive && onStop && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => void onStop()}
            data-testid="stop-agent-button"
          >
            <Square className="h-4 w-4" weight="fill" />
            Stop
          </Button>
        )}
      </div>

      {/* Status breadcrumbs during startup */}
      {state.status === 'starting' && state.statusHistory.length > 0 && (
        <ContainerAgentStatusBreadcrumbs
          currentStage={state.currentStage}
          statusMessage={state.statusMessage}
          statusHistory={state.statusHistory}
        />
      )}

      {/* Main content area */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* Stream output */}
        <div className="flex-1 min-h-0 min-w-0 flex flex-col">
          <ContainerAgentStream
            streamedText={state.streamedText}
            messages={state.messages}
            isStreaming={isStreaming}
            result={state.result}
            error={state.error}
            status={state.status}
            statusMessage={state.statusMessage}
            plan={state.plan}
            onApprovePlan={state.status === 'plan_ready' ? onApprovePlan : undefined}
            onRejectPlan={state.status === 'plan_ready' ? onRejectPlan : undefined}
            isPlanActionPending={isPlanActionPending}
          />
        </div>

        {/* Tool executions sidebar */}
        {state.toolExecutions.length > 0 && (
          <div className="flex flex-col min-h-0 w-full border-t border-border lg:w-80 lg:border-l lg:border-t-0">
            <ContainerAgentToolList tools={state.toolExecutions} />
          </div>
        )}
      </div>
    </div>
  );
}
