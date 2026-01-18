/**
 * Browser stubs for server-only agent tools.
 * These functions throw errors when called in the browser.
 * They exist only to satisfy the import graph during client-side bundling.
 */

import type { ToolContext, ToolResponse } from '../types.js';

const SERVER_ONLY_ERROR = 'This function is server-only and cannot be called in the browser';

// Bash tool stubs
export interface BashArgs {
  command: string;
  cwd?: string;
  timeout?: number;
}

export async function bashTool(_args: BashArgs, _context: ToolContext): Promise<ToolResponse> {
  throw new Error(SERVER_ONLY_ERROR);
}

// File tool stubs
export interface ReadFileArgs {
  path: string;
  encoding?: string;
}

export interface WriteFileArgs {
  path: string;
  content: string;
}

export interface EditFileArgs {
  path: string;
  oldContent: string;
  newContent: string;
}

export async function readFile(_args: ReadFileArgs, _context: ToolContext): Promise<ToolResponse> {
  throw new Error(SERVER_ONLY_ERROR);
}

export async function writeFile(
  _args: WriteFileArgs,
  _context: ToolContext
): Promise<ToolResponse> {
  throw new Error(SERVER_ONLY_ERROR);
}

export async function editFile(_args: EditFileArgs, _context: ToolContext): Promise<ToolResponse> {
  throw new Error(SERVER_ONLY_ERROR);
}

// Search tool stubs
export interface GlobArgs {
  pattern: string;
  cwd?: string;
}

export interface GrepArgs {
  pattern: string;
  path?: string;
  flags?: string;
}

export async function globTool(_args: GlobArgs, _context: ToolContext): Promise<ToolResponse> {
  throw new Error(SERVER_ONLY_ERROR);
}

export async function grepTool(_args: GrepArgs, _context: ToolContext): Promise<ToolResponse> {
  throw new Error(SERVER_ONLY_ERROR);
}
