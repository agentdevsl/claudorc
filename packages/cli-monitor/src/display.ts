// ANSI color codes (disabled when output is piped)
const isTTY = process.stdout.isTTY ?? false;
const RESET = isTTY ? '\x1b[0m' : '';
const BOLD = isTTY ? '\x1b[1m' : '';
const DIM = isTTY ? '\x1b[2m' : '';
const GREEN = isTTY ? '\x1b[32m' : '';
const CYAN = isTTY ? '\x1b[36m' : '';
const RED = isTTY ? '\x1b[31m' : '';

interface StatusInfo {
  version: string;
  serverUrl: string;
  watchPath: string;
  sessionCount: number;
}

export function printStatusBox(info: StatusInfo): void {
  const lines = [
    '',
    `  ${BOLD}AgentPane CLI Monitor v${info.version}${RESET}`,
    '',
    `  ${GREEN}\u2713${RESET} Connected to AgentPane`,
    `    ${DIM}${info.serverUrl}${RESET}`,
    '',
    `  ${GREEN}\u2713${RESET} Watching ${DIM}${info.watchPath}${RESET}`,
    `    ${DIM}${info.sessionCount} session file${info.sessionCount !== 1 ? 's' : ''} found${RESET}`,
    '',
    `  Press ${BOLD}Ctrl+C${RESET} to stop`,
    '',
  ];

  const maxLen = 45;
  console.log(`  ${DIM}\u256d${'\u2500'.repeat(maxLen)}\u256e${RESET}`);
  for (const line of lines) {
    // Strip ANSI for length calc
    const stripped = line.replace(/\x1b\[[0-9;]*m/g, '');
    const padding = Math.max(0, maxLen - stripped.length);
    console.log(`  ${DIM}\u2502${RESET}${line}${' '.repeat(padding)}${DIM}\u2502${RESET}`);
  }
  console.log(`  ${DIM}\u2570${'\u2500'.repeat(maxLen)}\u256f${RESET}`);
}

export function printError(message: string): void {
  console.error(`  ${RED}\u2717${RESET} ${message}`);
}

export function printInfo(message: string): void {
  console.log(`  ${CYAN}\u2139${RESET} ${message}`);
}
