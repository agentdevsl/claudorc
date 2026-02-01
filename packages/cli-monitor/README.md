# @agentpane/cli-monitor

CLI monitor daemon for [AgentPane](https://github.com/agentpane/agentpane) — watches Claude Code CLI sessions in real-time and streams events to the AgentPane dashboard.

## Quick Start

```bash
npx @agentpane/cli-monitor
```

That's it. The daemon starts watching for Claude Code sessions and forwards events to your AgentPane server.

## Install

### npx (no install required)

```bash
npx @agentpane/cli-monitor
```

### npm (global)

```bash
npm install -g @agentpane/cli-monitor
```

### Homebrew (macOS / Linux)

```bash
brew install agentpane/tap/cli-monitor
```

## Usage

```bash
# Start the monitor (foreground)
cli-monitor start

# Start as a background daemon
cli-monitor start --daemon

# Check daemon status
cli-monitor status

# Stop a running daemon
cli-monitor stop
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--port <n>` | AgentPane server port | `3001` |
| `--path <dir>` | Custom watch path for Claude sessions | `~/.claude/projects/` |
| `--daemon` | Run in background (detached) | `false` |
| `--version` | Print version and exit | |
| `--help` | Print usage and exit | |

## How It Works

The CLI monitor watches the `~/.claude/projects/` directory for Claude Code session files (JSONL). When it detects activity, it parses session events — including token usage, tool calls, thinking blocks, and status changes — and forwards them to the AgentPane server via its REST API. This enables real-time visibility into all Claude Code sessions running on your machine.

### What It Tracks

- Session status (working, waiting for approval, waiting for input, idle)
- Token usage with full breakdown (input, output, cache creation, cache read, ephemeral 5m/1h)
- Tool use and approval states
- Session goals and recent output
- Git branch and project context
- Subagent sessions

## Requirements

- Node.js 22+
- A running AgentPane server (default: `http://localhost:3001`)

## License

MIT
