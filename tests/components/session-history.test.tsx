import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionHistory } from "@/app/components/features/session-history";
import type { SessionWithPresence } from "@/services/session.service";

describe("SessionHistory", () => {
  it("renders sessions and triggers open", () => {
    const onOpen = vi.fn();
    const sessions: SessionWithPresence[] = [
      {
        id: "session-1",
        projectId: "project-1",
        taskId: "task-1",
        agentId: "agent-1",
        title: "Daily sync",
        url: "http://example.com/session-1",
        status: "running",
        presence: [{ userId: "user-1", lastSeen: Date.now() }],
      },
      {
        id: "session-2",
        projectId: "project-1",
        taskId: null,
        agentId: null,
        title: null,
        url: "http://example.com/session-2",
        status: "paused",
        presence: [],
      },
    ];

    render(<SessionHistory sessions={sessions} onOpen={onOpen} />);

    expect(screen.getByText("Session history")).toBeInTheDocument();
    expect(screen.getByText("Daily sync")).toBeInTheDocument();
    expect(screen.getByText("Untitled session")).toBeInTheDocument();
    expect(screen.getByText("1 active")).toBeInTheDocument();

    const openButtons = screen.getAllByRole("button", { name: "Open" });
    openButtons[0]?.click();

    expect(onOpen).toHaveBeenCalledWith("session-1");
  });

  it("renders empty state message", () => {
    render(<SessionHistory sessions={[]} onOpen={vi.fn()} />);

    expect(screen.getByText("No sessions yet.")).toBeInTheDocument();
  });
});
