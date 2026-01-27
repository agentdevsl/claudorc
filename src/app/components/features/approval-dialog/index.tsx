import {
  ArrowsClockwise,
  CheckCircle,
  Clock,
  Code,
  FileCode,
  Files,
  GitBranch,
  GitMerge,
  ListBullets,
  TestTube,
  X,
  XCircle,
} from '@phosphor-icons/react';
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
import { DiffViewer, MultiFileDiffViewer } from './diff-viewer';
import { FileTabs } from './file-tabs';

type TabValue = 'summary' | 'files' | 'diff';

interface ApprovalDialogProps {
  task: Task;
  diff: DiffSummary | null;
  diffResult?: DiffResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (commitMessage?: string, createMergeCommit?: boolean) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  completionInfo?: {
    duration?: string;
    testsStatus?: 'passed' | 'failed' | 'skipped';
    agentName?: string;
  };
}

/**
 * ApprovalDialog - A refined code review experience
 *
 * Design Direction: "Code Review as Ceremony"
 * Treats the approval decision as a meaningful moment with
 * clear visual hierarchy and intentional interactions.
 */
export function ApprovalDialog({
  task,
  diff,
  diffResult,
  open,
  onOpenChange,
  onApprove,
  onReject,
  completionInfo,
}: ApprovalDialogProps): React.JSX.Element {
  const [tab, setTab] = useState<TabValue>('summary');
  const [rejectReason, setRejectReason] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [createMergeCommit, setCreateMergeCommit] = useState(true);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<'approve' | 'reject' | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

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
      await onApprove(commitMessage.trim() || undefined, createMergeCommit);
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

  const effectiveDiffResult: DiffResult = diffResult || {
    summary: diff || { filesChanged: 0, additions: 0, deletions: 0 },
    files: [],
  };

  const activeFile = effectiveDiffResult.files[activeFileIndex];
  const hasChanges = effectiveDiffResult.summary.filesChanged > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[calc(100vh-48px)] w-full max-w-5xl flex-col overflow-hidden p-0',
          'border-border/50 bg-bg-default shadow-2xl',
          'animate-in fade-in-0 zoom-in-[0.98] duration-200'
        )}
        data-testid="approval-dialog"
      >
        {/* ============================================
            HEADER - Task Identity & Status
            ============================================ */}
        <DialogHeader className="relative border-b border-border bg-gradient-to-b from-surface-subtle to-bg-default px-6 py-5">
          {/* Decorative accent line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              {/* Task ID and Title */}
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-accent/10 px-2.5 py-1 font-mono text-xs font-medium text-accent ring-1 ring-accent/20">
                  <Code weight="bold" className="h-3.5 w-3.5" />
                  {task.id.slice(0, 8)}
                </span>
                <DialogTitle className="truncate text-lg font-semibold tracking-tight text-fg">
                  {task.title}
                </DialogTitle>
              </div>

              {/* Metadata Row */}
              <DialogDescription className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {/* Branch */}
                <span className="flex items-center gap-2 text-sm text-fg-muted">
                  <GitBranch className="h-4 w-4 text-fg-subtle" weight="bold" />
                  <span className="font-mono text-xs">{task.branch ?? 'No branch'}</span>
                </span>

                {/* Duration */}
                {completionInfo?.duration && (
                  <span className="flex items-center gap-2 text-sm text-fg-muted">
                    <Clock className="h-4 w-4 text-fg-subtle" weight="regular" />
                    <span>{completionInfo.duration}</span>
                  </span>
                )}

                {/* Test Status */}
                {completionInfo?.testsStatus && (
                  <span
                    className={cn(
                      'flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs font-medium',
                      completionInfo.testsStatus === 'passed' &&
                        'bg-success/10 text-success ring-1 ring-success/20',
                      completionInfo.testsStatus === 'failed' &&
                        'bg-danger/10 text-danger ring-1 ring-danger/20',
                      completionInfo.testsStatus === 'skipped' &&
                        'bg-fg-subtle/10 text-fg-muted ring-1 ring-fg-subtle/20'
                    )}
                  >
                    <TestTube className="h-3.5 w-3.5" weight="fill" />
                    {completionInfo.testsStatus === 'passed' && 'Tests passed'}
                    {completionInfo.testsStatus === 'failed' && 'Tests failed'}
                    {completionInfo.testsStatus === 'skipped' && 'Tests skipped'}
                  </span>
                )}

                {/* Agent */}
                {completionInfo?.agentName && (
                  <span className="flex items-center gap-2 text-sm text-fg-muted">
                    <span className="h-4 w-4 rounded-full bg-gradient-to-br from-accent to-done shadow-sm shadow-accent/25" />
                    <span className="font-medium">{completionInfo.agentName}</span>
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* ============================================
            CHANGES SUMMARY BAR
            ============================================ */}
        <div className="border-b border-border/50 bg-canvas" data-testid="diff-summary">
          <ChangesSummary summary={effectiveDiffResult.summary} files={effectiveDiffResult.files} />
        </div>

        {/* ============================================
            MAIN CONTENT AREA - Tabbed Views
            ============================================ */}
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as TabValue)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          {/* Tab Navigation */}
          <div className="border-b border-border/50 bg-surface-subtle/50 px-6">
            <TabsList className="h-12 w-fit gap-1 bg-transparent p-0">
              <TabsTrigger
                value="summary"
                className={cn(
                  'relative h-full gap-2 rounded-none border-b-2 border-transparent px-4 text-sm font-medium',
                  'text-fg-muted transition-all hover:text-fg',
                  'data-[state=active]:border-accent data-[state=active]:text-fg'
                )}
                data-testid="tab-summary"
              >
                <ListBullets className="h-4 w-4" weight="bold" />
                Summary
              </TabsTrigger>
              <TabsTrigger
                value="files"
                className={cn(
                  'relative h-full gap-2 rounded-none border-b-2 border-transparent px-4 text-sm font-medium',
                  'text-fg-muted transition-all hover:text-fg',
                  'data-[state=active]:border-accent data-[state=active]:text-fg'
                )}
                data-testid="tab-files"
              >
                <FileCode className="h-4 w-4" weight="bold" />
                Files
                {hasChanges && (
                  <span className="rounded-full bg-fg-subtle/20 px-1.5 py-0.5 text-xs tabular-nums text-fg-muted">
                    {effectiveDiffResult.summary.filesChanged}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="diff"
                className={cn(
                  'relative h-full gap-2 rounded-none border-b-2 border-transparent px-4 text-sm font-medium',
                  'text-fg-muted transition-all hover:text-fg',
                  'data-[state=active]:border-accent data-[state=active]:text-fg'
                )}
                data-testid="tab-commit"
              >
                <Files className="h-4 w-4" weight="bold" />
                Full Diff
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Summary Tab */}
          <TabsContent value="summary" className="flex-1 overflow-auto bg-canvas p-6">
            <div className="mx-auto max-w-3xl space-y-6">
              {/* Changes Overview Card */}
              <div className="group rounded-xl border border-border bg-bg-default p-5 transition-colors hover:border-border/80">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                    <ArrowsClockwise className="h-5 w-5 text-accent" weight="bold" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-fg">Changes Overview</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
                      {hasChanges ? (
                        <>
                          This update modifies{' '}
                          <span className="font-medium text-fg">
                            {effectiveDiffResult.summary.filesChanged} file
                            {effectiveDiffResult.summary.filesChanged !== 1 ? 's' : ''}
                          </span>{' '}
                          with{' '}
                          <span className="font-medium text-success">
                            +{effectiveDiffResult.summary.additions}
                          </span>{' '}
                          additions and{' '}
                          <span className="font-medium text-danger">
                            -{effectiveDiffResult.summary.deletions}
                          </span>{' '}
                          deletions.
                        </>
                      ) : (
                        'No changes to review. The agent completed without modifying any files.'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* File List */}
              {effectiveDiffResult.files.length > 0 && (
                <div className="rounded-xl border border-border bg-bg-default">
                  <div className="border-b border-border/50 px-5 py-3">
                    <h3 className="text-sm font-semibold text-fg">Changed Files</h3>
                  </div>
                  <div className="divide-y divide-border/30">
                    {effectiveDiffResult.files.map((file: DiffFile, index: number) => (
                      <button
                        type="button"
                        key={file.path}
                        className="group flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-subtle/50"
                        onClick={() => {
                          setActiveFileIndex(index);
                          setTab('files');
                        }}
                      >
                        {/* Status indicator */}
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full ring-2',
                            file.status === 'added' && 'bg-success ring-success/20',
                            file.status === 'modified' && 'bg-attention ring-attention/20',
                            file.status === 'deleted' && 'bg-danger ring-danger/20',
                            file.status === 'renamed' && 'bg-accent ring-accent/20'
                          )}
                        />
                        {/* File path */}
                        <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg-muted group-hover:text-fg">
                          {file.path}
                        </span>
                        {/* Stats */}
                        <span className="flex shrink-0 items-center gap-3 font-mono text-xs">
                          {file.additions > 0 && (
                            <span className="text-success">+{file.additions}</span>
                          )}
                          {file.deletions > 0 && (
                            <span className="text-danger">-{file.deletions}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Files Tab - Per-file navigation */}
          <TabsContent value="files" className="flex flex-1 flex-col overflow-hidden">
            {effectiveDiffResult.files.length > 0 ? (
              <>
                <FileTabs
                  files={effectiveDiffResult.files}
                  activeIndex={activeFileIndex}
                  onSelect={setActiveFileIndex}
                />
                <div
                  id={`diff-panel-${activeFileIndex}`}
                  role="tabpanel"
                  aria-labelledby={`file-tab-${activeFileIndex}`}
                  className="flex-1 overflow-hidden"
                >
                  <DiffViewer file={activeFile} showHeader={false} />
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-fg-muted">
                <div className="text-center">
                  <FileCode className="mx-auto h-12 w-12 text-fg-subtle/50" weight="thin" />
                  <p className="mt-3 text-sm">No files to display</p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Full Diff Tab */}
          <TabsContent value="diff" className="flex flex-1 flex-col overflow-hidden">
            <MultiFileDiffViewer files={effectiveDiffResult.files} />
          </TabsContent>
        </Tabs>

        {/* ============================================
            FEEDBACK SECTION
            ============================================ */}
        <div className="border-t border-border bg-bg-default px-6 py-5">
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Commit Message */}
            <div className="space-y-2">
              <label
                htmlFor="commit-message"
                className="flex items-center gap-2 text-sm font-medium text-fg"
              >
                <GitMerge className="h-4 w-4 text-fg-subtle" weight="bold" />
                Commit Message
                <span className="text-xs font-normal text-fg-subtle">(optional override)</span>
              </label>
              <Textarea
                id="commit-message"
                value={commitMessage}
                onChange={(event) => setCommitMessage(event.target.value)}
                placeholder="Leave empty to use default commit message..."
                rows={3}
                className={cn(
                  'resize-none bg-canvas font-mono text-sm',
                  'placeholder:text-fg-subtle',
                  'focus:ring-2 focus:ring-accent/20'
                )}
                data-testid="commit-message-input"
              />
            </div>

            {/* Rejection Reason */}
            <div className="space-y-2">
              <label
                htmlFor="reject-reason"
                className="flex items-center gap-2 text-sm font-medium text-fg"
              >
                <XCircle className="h-4 w-4 text-fg-subtle" weight="bold" />
                Revision Notes
                <span className="text-xs font-normal text-fg-subtle">(for rejection)</span>
              </label>
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="Describe what needs to be changed..."
                rows={3}
                className={cn(
                  'resize-none bg-canvas text-sm',
                  'placeholder:text-fg-subtle',
                  'focus:ring-2 focus:ring-danger/20'
                )}
                data-testid="reject-reason-input"
              />
            </div>
          </div>
        </div>

        {/* ============================================
            FOOTER - Actions
            ============================================ */}
        <DialogFooter className="border-t border-border bg-gradient-to-b from-surface-subtle to-bg-default px-6 py-4">
          <div className="flex w-full items-center justify-between">
            {/* Merge commit option */}
            <label
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface-subtle"
              htmlFor="merge-commit"
              data-testid="merge-commit-option"
            >
              <Checkbox
                id="merge-commit"
                checked={createMergeCommit}
                onCheckedChange={(checked) => setCreateMergeCommit(Boolean(checked))}
                disabled={isSubmitting}
                className="data-[state=checked]:border-success data-[state=checked]:bg-success"
              />
              <span className="flex items-center gap-2 text-sm text-fg">
                <GitMerge className="h-4 w-4 text-fg-muted" weight="regular" />
                Create merge commit
              </span>
            </label>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="text-fg-muted hover:text-fg"
                data-testid="cancel-button"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>

              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isSubmitting}
                className={cn(
                  'min-w-[120px] gap-2',
                  'bg-danger/10 text-danger ring-1 ring-danger/20',
                  'hover:bg-danger/20 hover:ring-danger/40'
                )}
                data-testid="reject-button"
              >
                {submittingAction === 'reject' ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <XCircle className="h-4 w-4" weight="bold" />
                )}
                Reject
              </Button>

              <Button
                onClick={handleApprove}
                disabled={isSubmitting}
                className={cn(
                  'min-w-[160px] gap-2',
                  'bg-success text-white shadow-lg shadow-success/25',
                  'hover:bg-success/90'
                )}
                data-testid="approve-button"
              >
                {submittingAction === 'approve' ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <CheckCircle className="h-4 w-4" weight="bold" />
                )}
                Approve & Merge
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Re-export sub-components for individual use
export {
  ChangesSummary,
  CompactChangesSummary,
  InlineChanges,
} from './changes-summary';

export { DiffHunk } from './diff-hunk';
export { DiffLine } from './diff-line';
export { CollapsibleDiffViewer, DiffViewer, MultiFileDiffViewer } from './diff-viewer';
export { CompactFileTabs, FileTabs } from './file-tabs';
