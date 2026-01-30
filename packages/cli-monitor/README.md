# @agentpane/cli-monitor

CLI monitor daemon for [AgentPane](https://github.com/agentpane/agentpane) — watches Claude Code CLI sessions in real-time and streams events to the AgentPane dashboard.

## Install

```bash
npm install -g @agentpane/cli-monitor
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

The CLI monitor watches the `~/.claude/projects/` directory for Claude Code session files. When it detects activity, it parses session events and forwards them to the AgentPane server via its REST API. This enables real-time visibility into Claude Code sessions running on your machine.

## Requirements

- Node.js 22+ or Bun
- A running AgentPane server (default: `http://localhost:3001`)

## License

MIT
