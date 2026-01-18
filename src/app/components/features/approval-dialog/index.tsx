import { CheckCircle, GitBranch, X, XCircle } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
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
import type { Task } from '@/db/schema/tasks';
import type { DiffFile, DiffResult, DiffSummary } from '@/lib/types/diff';
import { cn } from '@/lib/utils/cn';
import { ChangesSummary } from './changes-summary';
import { DiffViewer } from './diff-viewer';
import { FileTabs } from './file-tabs';

type TabValue = 'summary' | 'files' | 'diff';

interface ApprovalDialogProps {
  task: Task;
  diff: DiffSummary | null;
  diffResult?: DiffResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (commitMessage?: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
}

/**
 * Full diff review experience with:
 * - Full-width dialog (max-w-4xl)
 * - Summary header with task info
 * - Tabs for Summary/Files/Diff views
 * - Footer with Approve/Reject actions
 * - Merge commit message option checkbox
 */
export function ApprovalDialog({
  task,
  diff,
  diffResult,
  open,
  onOpenChange,
  onApprove,
  onReject,
}: ApprovalDialogProps): React.JSX.Element {
  const [tab, setTab] = useState<TabValue>('summary');
  const [rejectReason, setRejectReason] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [createMergeCommit, setCreateMergeCommit] = useState(true);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<'approve' | 'reject' | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setTab('summary');
      setRejectReason('');
      setCommitMessage('');
      setCreateMergeCommit(true);
      setActiveFileIndex(0);
      setIsSubmitting(false);
      setSubmittingAction(null);
    }
  }, [open]);

  const handleApprove = async () => {
    setIsSubmitting(true);
    setSubmittingAction('approve');
    try {
      await onApprove(commitMessage.trim() || undefined);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
      setSubmittingAction(null);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    setSubmittingAction('reject');
    try {
      await onReject(rejectReason.trim() || 'Needs updates');
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
      setSubmittingAction(null);
    }
  };

  // Use the full diffResult if available, otherwise create a minimal one from diff summary
  const effectiveDiffResult: DiffResult = diffResult || {
    summary: diff || { filesChanged: 0, additions: 0, deletions: 0 },
    files: [],
  };

  const activeFile = effectiveDiffResult.files[activeFileIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[calc(100vh-48px)] max-w-4xl flex-col overflow-hidden p-0"
        data-testid="approval-dialog"
      >
        {/* Header */}
        <DialogHeader className="border-b border-border bg-surface-subtle px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="rounded bg-accent-muted/25 px-2 py-0.5 font-mono text-xs text-accent">
              #{task.id.slice(0, 8)}
            </span>
            <DialogTitle className="flex-1 truncate">{task.title}</DialogTitle>
          </div>
          <DialogDescription className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-sm">
              <GitBranch className="h-4 w-4" weight="bold" />
              {task.branch ?? 'No branch'}
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Changes Summary */}
        <div data-testid="diff-summary">
          <ChangesSummary summary={effectiveDiffResult.summary} files={effectiveDiffResult.files} />
        </div>

        {/* Tabs */}
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as TabValue)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <TabsList className="mx-6 mt-4 w-fit">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="diff">Diff</TabsTrigger>
          </TabsList>

          {/* Summary tab */}
          <TabsContent value="summary" className="flex-1 overflow-auto px-6 py-4">
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-surface-subtle p-4">
                <h3 className="text-sm font-semibold text-fg">Changes Overview</h3>
                <p className="mt-2 text-sm text-fg-muted">
                  {effectiveDiffResult.summary.filesChanged > 0 ? (
                    <>
                      {effectiveDiffResult.summary.filesChanged} file
                      {effectiveDiffResult.summary.filesChanged !== 1 ? 's' : ''} changed with{' '}
                      <span className="text-success">
                        {effectiveDiffResult.summary.additions} addition
                        {effectiveDiffResult.summary.additions !== 1 ? 's' : ''}
                      </span>{' '}
                      and{' '}
                      <span className="text-danger">
                        {effectiveDiffResult.summary.deletions} deletion
                        {effectiveDiffResult.summary.deletions !== 1 ? 's' : ''}
                      </span>
                      .
                    </>
                  ) : (
                    'No changes to review.'
                  )}
                </p>
              </div>

              {/* File list preview */}
              {effectiveDiffResult.files.length > 0 && (
                <div className="rounded-lg border border-border p-4">
                  <h3 className="text-sm font-semibold text-fg">Changed Files</h3>
                  <ul className="mt-2 space-y-1">
                    {effectiveDiffResult.files.map((file: DiffFile) => (
                      <li
                        key={file.path}
                        className="flex items-center gap-2 text-xs font-mono text-fg-muted"
                      >
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full',
                            file.status === 'added' && 'bg-success',
                            file.status === 'modified' && 'bg-attention',
                            file.status === 'deleted' && 'bg-danger',
                            file.status === 'renamed' && 'bg-accent'
                          )}
                        />
                        {file.path}
                        <span className="ml-auto flex gap-2">
                          {file.additions > 0 && (
                            <span className="text-success">+{file.additions}</span>
                          )}
                          {file.deletions > 0 && (
                            <span className="text-danger">-{file.deletions}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Files tab */}
          <TabsContent value="files" className="flex flex-1 flex-col overflow-hidden">
            {effectiveDiffResult.files.length > 0 ? (
              <>
                <FileTabs
                  files={effectiveDiffResult.files}
                  activeIndex={activeFileIndex}
                  onSelect={setActiveFileIndex}
                />
                <DiffViewer file={activeFile} />
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-fg-muted">
                <p>No files to display.</p>
              </div>
            )}
          </TabsContent>

          {/* Diff tab */}
          <TabsContent value="diff" className="flex flex-1 flex-col overflow-hidden">
            {effectiveDiffResult.files.length > 0 ? (
              <div className="flex flex-1 flex-col overflow-auto">
                {effectiveDiffResult.files.map((file: DiffFile) => (
                  <div key={file.path} className="border-b border-border last:border-b-0">
                    <DiffViewer file={file} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-fg-muted">
                <p>No diff available.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Feedback section */}
        <div className="border-t border-border px-6 py-4">
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
        </div>

        {/* Footer */}
        <DialogFooter className="border-t border-border bg-surface-subtle px-6 py-4">
          <div className="flex w-full items-center justify-between">
            {/* Merge commit option */}
            <label className="flex cursor-pointer items-center gap-2" htmlFor="merge-commit">
              <Checkbox
                id="merge-commit"
                checked={createMergeCommit}
                onCheckedChange={(checked) => setCreateMergeCommit(Boolean(checked))}
              />
              <span className="text-sm text-fg">Create merge commit</span>
            </label>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleReject} disabled={isSubmitting}>
                {submittingAction === 'reject' ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Reject
              </Button>
              <Button onClick={handleApprove} disabled={isSubmitting}>
                {submittingAction === 'approve' ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Approve & merge
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
