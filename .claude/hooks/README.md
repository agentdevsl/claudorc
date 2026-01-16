# Claude Code Langfuse Hook

Tool error analysis for Claude Code sessions via Langfuse.

## When to Use

| Approach      | Best For                       |
| ------------- | ------------------------------ |
| **OTEL only** | Cost, tokens, session metrics  |
| **This hook** | Tool errors, subagent tracking |
| **Both**      | Complete observability         |

Enable native OTEL with `CLAUDE_CODE_ENABLE_TELEMETRY=1`.

## Setup

### 1. Set Credentials

```bash
# Add to ~/.zshrc or ~/.bashrc
export LANGFUSE_PUBLIC_KEY=pk-lf-your-key
export LANGFUSE_SECRET_KEY=sk-lf-your-key
```

### 2. Build

```bash
cd .claude/hooks
npm install && npm run build
```

### 3. Configure Hooks

Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "cd .claude/hooks && node dist/langfuse-hook.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "cd .claude/hooks && node dist/langfuse-hook.js"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cd .claude/hooks && node dist/langfuse-hook.js"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cd .claude/hooks && node dist/langfuse-hook.js"
          }
        ]
      }
    ]
  }
}
```

## Error Types

| Type                | Trigger                      |
| ------------------- | ---------------------------- |
| `error`             | `response.error` field       |
| `failed`            | `response.success === false` |
| `exit_code`         | Non-zero exit code           |
| `http_client_error` | HTTP 4xx                     |
| `http_server_error` | HTTP 5xx                     |
| `timeout`           | `timedOut` or `timeout` flag |
| `cancelled`         | `cancelled` flag             |
| `not_found`         | `notFound` flag              |
| `permission_denied` | `permissionDenied` flag      |

## Features

- ✅ **Error tracking**: 9 error types with detailed classification
- ✅ **Failure scores**: Automatic scoring for filtering and analytics
- ✅ **Cascade detection**: Identifies failures caused by upstream errors
- ✅ **Session health**: Tracks overall session success rate
- ✅ **Performance metrics**: Tool execution timing (PreToolUse → PostToolUse)
- ✅ **Subagent detection**: Tracks `Task` and `runSubagent` tools
- ✅ **Token tracking**: Captures input/output/total tokens when available
- ✅ **Model tracking**: Records which model is being used
- ✅ **User identification**: Tracks user_id if provided
- ✅ **Span correlation**: Links tool start/end events with unique span IDs

## Failure Tracking Scores

The hook automatically records scores for each tool execution, enabling powerful filtering and analytics in Langfuse.

### Tool-Level Scores

| Score                | Type        | Description                           |
| -------------------- | ----------- | ------------------------------------- |
| `tool_success`       | BOOLEAN     | `1` = success, `0` = failure          |
| `failure_category`   | CATEGORICAL | Error type (exit_code, timeout, etc.) |
| `error_severity`     | NUMERIC     | Severity 0.0-1.0 based on error type  |
| `is_cascade_failure` | BOOLEAN     | `1` if preceding tool also failed     |

### Session-Level Scores (on Stop event)

| Score                   | Type        | Description                                  |
| ----------------------- | ----------- | -------------------------------------------- |
| `session_success_rate`  | NUMERIC     | Percentage of tools that succeeded (0.0-1.0) |
| `session_health`        | CATEGORICAL | `healthy` / `degraded` / `unhealthy`         |
| `dominant_failure_mode` | CATEGORICAL | Most common error type in session            |

### Error Severity Values

| Error Type                    | Severity | Description                        |
| ----------------------------- | -------- | ---------------------------------- |
| `permission_denied`           | 0.9      | Critical - blocks workflow         |
| `incomplete`                  | 0.85     | High - session ended unexpectedly  |
| `exit_code`                   | 0.8      | High - command failed              |
| `timeout`                     | 0.75     | High - resource/performance issues |
| `http_server_error`           | 0.7      | High - server error                |
| `error`                       | 0.6      | Medium-high - explicit error       |
| `failed`, `http_client_error` | 0.5      | Medium - generic failure           |
| `not_found`                   | 0.4      | Medium-low - resource missing      |
| `cancelled`                   | 0.3      | Low - user-initiated               |

## Filtering in Langfuse

### By Metadata

```
metadata.success = false           # All errors
metadata.error_type = "exit_code"  # Bash failures
metadata.is_subagent = true        # Subagent calls
metadata.subagent_type = "Explore" # Specific subagent
metadata.duration_ms > 1000        # Slow tools (>1s)
metadata.tokens_total > 10000      # High token usage
```

### By Scores

```
scores.tool_success = 0                    # Failed tools
scores.failure_category = "timeout"        # Timeout errors
scores.error_severity > 0.7               # High severity failures
scores.is_cascade_failure = 1             # Cascade failures
scores.session_health = "unhealthy"       # Problem sessions
scores.session_success_rate < 0.8         # Low success rate
```

## Langfuse Dashboard Setup

### Recommended Dashboard Widgets

Create a dashboard in Langfuse with these widgets for failure analysis:

#### 1. Failure Rate Over Time

- **Type**: Time Series
- **Metric**: Count of `tool_success = 0` / Total tools
- **Purpose**: Track failure trends

#### 2. Failures by Category

- **Type**: Pie Chart
- **Group By**: `failure_category` score
- **Purpose**: Understand failure distribution

#### 3. High Severity Failures

- **Type**: Table
- **Filter**: `error_severity > 0.7`
- **Columns**: Trace ID, Tool Name, Error Type, Severity
- **Purpose**: Prioritize critical issues

#### 4. Cascade Failure Chains

- **Type**: Table
- **Filter**: `is_cascade_failure = 1`
- **Purpose**: Identify root cause vs downstream failures

#### 5. Session Health Distribution

- **Type**: Pie Chart
- **Group By**: `session_health` score
- **Purpose**: Quick health overview

#### 6. Low Success Rate Sessions

- **Type**: Table
- **Filter**: `session_success_rate < 0.8`
- **Sort**: Success rate ascending
- **Purpose**: Find problematic sessions

### Useful Queries

```sql
-- Top failure categories this week
SELECT failure_category, COUNT(*) as count
FROM scores
WHERE name = 'failure_category'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY failure_category
ORDER BY count DESC

-- Sessions with cascade failures
SELECT DISTINCT trace_id, session_id
FROM scores
WHERE name = 'is_cascade_failure' AND value = 1

-- Average severity by error type
SELECT failure_category, AVG(error_severity)
FROM scores s1
JOIN scores s2 ON s1.observation_id = s2.observation_id
WHERE s1.name = 'failure_category'
  AND s2.name = 'error_severity'
GROUP BY failure_category
```

## Environment Variables

| Variable                | Required | Default                         |
| ----------------------- | -------- | ------------------------------- |
| `LANGFUSE_HOOK_ENABLED` | Yes      | `false` (must be `true` or `1`) |
| `LANGFUSE_PUBLIC_KEY`   | Yes      | -                               |
| `LANGFUSE_SECRET_KEY`   | Yes      | -                               |
| `LANGFUSE_HOST`         | No       | `https://us.cloud.langfuse.com` |
| `LANGFUSE_RELEASE`      | No       | `claude-code`                   |
| `LANGFUSE_ENVIRONMENT`  | No       | `development`                   |
| `LANGFUSE_LOG_LEVEL`    | No       | (INFO, set `DEBUG` for verbose) |

## Development

```bash
npm run build    # Compile
npm test         # Run tests
npm run watch    # Watch mode
```

## Test Manually

```bash
echo '{"session_id":"test","cwd":"/workspace","hook_event_name":"PostToolUse","tool_name":"Bash","tool_response":{"exit_code":0}}' | node dist/langfuse-hook.js
```
