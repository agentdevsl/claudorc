import { Square } from '@phosphor-icons/react';
import { Button } from '@/app/components/ui/button';
import { useContainerAgent } from '@/app/hooks/use-container-agent';
import { ContainerAgentHeader } from './container-agent-header';
import { ContainerAgentStream } from './container-agent-stream';
import { ContainerAgentToolList } from './container-agent-tool-list';

export interface ContainerAgentPanelProps {
  /** Session ID to subscribe to */
  sessionId: string | null;
  /** Callback when stop is requested */
  onStop?: () => Promise<void>;
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
}: ContainerAgentPanelProps): React.JSX.Element {
  const { state, connectionState, isStreaming } = useContainerAgent(sessionId);

  const isActive = state.status === 'running' || state.status === 'starting';

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface">
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

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Stream output */}
        <div className="flex-1 overflow-hidden">
          <ContainerAgentStream
            streamedText={state.streamedText}
            messages={state.messages}
            isStreaming={isStreaming}
            result={state.result}
            error={state.error}
            status={state.status}
          />
        </div>

        {/* Tool executions sidebar */}
        {state.toolExecutions.length > 0 && (
          <div className="w-full border-t border-border lg:w-80 lg:border-l lg:border-t-0">
            <ContainerAgentToolList tools={state.toolExecutions} />
          </div>
        )}
      </div>
    </div>
  );
}
