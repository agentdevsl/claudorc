import { useState } from 'react';
import { CheckCircle, GitBranch, WarningCircle, XCircle } from '@phosphor-icons/react';
import type { Task } from '@/db/schema/tasks';
import type { DiffSummary } from '@/lib/types/diff';
import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Textarea } from '@/app/components/ui/textarea';

interface ApprovalDialogProps {
  task: Task;
  diff: DiffSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (commitMessage?: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
}

export function ApprovalDialog({
  task,
  diff,
  open,
  onOpenChange,
  onApprove,
  onReject,
}: ApprovalDialogProps): React.JSX.Element {
  const [tab, setTab] = useState<'summary' | 'files' | 'diff'>('summary');
  const [rejectReason, setRejectReason] = useState('');
  const [commitMessage, setCommitMessage] = useState('');

  const handleApprove = async () => {
    await onApprove(commitMessage.trim() || undefined);
    onOpenChange(false);
  };

  const handleReject = async () => {
    await onReject(rejectReason.trim() || 'Needs updates');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review changes</DialogTitle>
          <DialogDescription>{task.title}</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="diff">Diff</TabsTrigger>
          </TabsList>
          <TabsContent value="summary" className="mt-4 space-y-4">
            <div className="rounded-lg border border-border bg-surface-subtle p-4">
              <div className="flex items-center gap-2 text-sm text-fg">
                <GitBranch className="h-4 w-4" />
                {task.branch ?? 'No branch'}
              </div>
              <p className="mt-2 text-xs text-fg-muted">
                {diff
                  ? `${diff.filesChanged} files changed, ${diff.additions} additions, ${diff.deletions} deletions.`
                  : 'No diff summary available yet.'}
              </p>
            </div>
            <div className="rounded-lg border border-border p-4 text-xs text-fg-muted">
              Preview of diff details will appear here once connected.
            </div>
          </TabsContent>
          <TabsContent value="files" className="mt-4">
            <div className="rounded-lg border border-border p-4 text-xs text-fg-muted">
              File-level changes will surface here.
            </div>
          </TabsContent>
          <TabsContent value="diff" className="mt-4">
            <div className="rounded-lg border border-border p-4 text-xs text-fg-muted">
              Unified diff will surface here.
            </div>
          </TabsContent>
        </Tabs>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-border bg-surface-subtle p-4">
            <h3 className="text-sm font-semibold text-fg">Commit message</h3>
            <Textarea
              value={commitMessage}
              onChange={(event) => setCommitMessage(event.target.value)}
              placeholder="Optional commit message"
              rows={3}
              className="mt-2"
            />
          </div>
          <div className="rounded-lg border border-border bg-surface-subtle p-4">
            <h3 className="text-sm font-semibold text-fg">Rejection reason</h3>
            <Textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Explain what to revise"
              rows={3}
              className="mt-2"
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <WarningCircle className="h-4 w-4" />
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleReject}>
            <XCircle className="h-4 w-4" />
            Reject
          </Button>
          <Button onClick={handleApprove}>
            <CheckCircle className="h-4 w-4" />
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
