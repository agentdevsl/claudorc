import type { PreToolUseHook, PreToolUseInput, PreToolUseResult } from '../types.js';

export function createToolWhitelistHook(allowedTools: string[]): PreToolUseHook {
  return {
    hooks: [
      async (input: PreToolUseInput): Promise<PreToolUseResult> => {
        if (allowedTools.length === 0) {
          // If no tools specified, allow all
          return {};
        }

        if (!allowedTools.includes(input.tool_name)) {
          return {
            decision: 'block',
            message: `Tool "${input.tool_name}" is not allowed. Allowed tools: ${allowedTools.join(', ')}`,
          };
        }

        return {};
      },
    ],
  };
}
