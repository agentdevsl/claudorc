import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueueStatus } from "@/app/components/features/queue-status";
import type { QueuePosition } from "@/services/agent.service";

describe("QueueStatus", () => {
  it("renders queued tasks and calls open action", () => {
    const onOpenTask = vi.fn();
    const queued: QueuePosition[] = [
      {
        taskId: "task-1",
        position: 1,
        queuedAt: Date.now(),
        estimatedWaitMinutes: 4,
        agentName: "Planner",
      },
      {
        taskId: "task-2",
        position: 2,
        queuedAt: Date.now(),
        agentName: "Executor",
      },
    ];

    render(<QueueStatus queued={queued} onOpenTask={onOpenTask} />);

    expect(screen.getByText("Agent queue")).toBeInTheDocument();
    expect(screen.getByText("Task task-1")).toBeInTheDocument();
    expect(screen.getByText("Task task-2")).toBeInTheDocument();
    expect(screen.getByText("Position 1")).toBeInTheDocument();

    const openButtons = screen.getAllByRole("button", { name: "Open" });
    openButtons[0]?.click();

    expect(onOpenTask).toHaveBeenCalledWith("task-1");
  });

  it("renders empty message when queue is empty", () => {
    render(<QueueStatus queued={[]} onOpenTask={vi.fn()} />);

    expect(screen.getByText("Agent queue")).toBeInTheDocument();
    expect(screen.getByText("Queue is empty.")).toBeInTheDocument();
  });
});
