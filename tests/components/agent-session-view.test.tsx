import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentSessionView } from "@/app/components/features/agent-session-view";

vi.mock("@/app/hooks/use-session", () => ({
  useSession: () => ({
    state: {
      chunks: [{ text: "hello", timestamp: Date.now() }],
      toolCalls: [],
      terminal: [],
      presence: [],
      agentState: { status: "running" },
    },
  }),
}));

vi.mock("@/app/hooks/use-agent-stream", () => ({
  useAgentStream: () => ({
    chunks: [{ text: "hello", timestamp: Date.now() }],
    fullText: "hello",
    isStreaming: true,
  }),
}));

vi.mock("@/app/hooks/use-presence", () => ({
  usePresence: () => ({ users: [] }),
}));

describe("AgentSessionView", () => {
  it("renders session output", () => {
    render(
      <AgentSessionView
        sessionId="session-1"
        agentId="agent-1"
        userId="user-1"
        onPause={vi.fn()}
        onResume={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    expect(screen.getByText("Streaming output...")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
