/**
 * Summary statistics for a diff
 */
export type DiffSummary = {
  filesChanged: number;
  additions: number;
  deletions: number;
};

/**
 * File change status in a diff
 */
export type DiffFileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

/**
 * Individual line type in a diff
 */
export type DiffLineType = 'addition' | 'deletion' | 'context';

/**
 * Single line in a diff hunk
 */
export type DiffLine = {
  type: DiffLineType;
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
};

/**
 * A hunk represents a contiguous block of changes in a file
 */
export type DiffHunk = {
  /** Header line like "@@ -10,7 +10,8 @@" */
  header: string;
  /** Starting line number in old file */
  oldStart: number;
  /** Number of lines from old file */
  oldLines: number;
  /** Starting line number in new file */
  newStart: number;
  /** Number of lines in new file */
  newLines: number;
  /** The lines in this hunk */
  lines: DiffLine[];
};

/**
 * Represents a single file in a diff
 */
export type DiffFile = {
  /** File path (new path if renamed) */
  path: string;
  /** Old file path (for renames) */
  oldPath?: string;
  /** File change status */
  status: DiffFileStatus;
  /** Number of lines added */
  additions: number;
  /** Number of lines deleted */
  deletions: number;
  /** The hunks in this file */
  hunks: DiffHunk[];
  /** Whether this is a binary file */
  isBinary?: boolean;
};

/**
 * Complete diff result with summary and file details
 */
export type DiffResult = {
  summary: DiffSummary;
  files: DiffFile[];
};
