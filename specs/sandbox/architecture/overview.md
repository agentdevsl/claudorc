# Architecture Overview

## System Context

The sandbox architecture provides secure, isolated execution of Claude AI agents within Docker containers. It enables autonomous code generation, file manipulation, and shell command execution while protecting the host system.

```mermaid
graph TB
    subgraph "User Interface"
        UI[React Frontend]
    end

    subgraph "Docker Container"
        subgraph "API Server"
            Express[Express Server]
            WS[WebSocket Server]
            AgentService[Agent Service]
            TerminalService[Terminal Service]
        end

        subgraph "Security Layer"
            SecureFS[Secure FS Adapter]
            PathValidator[Path Validator]
            EnvFilter[Env Filter]
        end

        subgraph "AI Integration"
            ClaudeProvider[Claude Provider]
            SDK[Claude Agent SDK]
        end

        subgraph "Storage"
            DataDir["/data"]
            ProjectsDir["/projects"]
        end
    end

    subgraph "External"
        ClaudeAPI[Claude API]
        GitRemote[Git Remote]
    end

    UI -->|HTTP/WS| Express
    UI -->|WebSocket| WS
    Express --> AgentService
    Express --> TerminalService
    AgentService --> ClaudeProvider
    ClaudeProvider --> SDK
    SDK -->|API Calls| ClaudeAPI
    SDK -->|File Ops| SecureFS
    SecureFS --> PathValidator
    PathValidator --> DataDir
    PathValidator --> ProjectsDir
    TerminalService --> SecureFS
    AgentService -->|Git| GitRemote
```

## Component Architecture

### Server Components

```mermaid
graph LR
    subgraph "Entry Points"
        HTTP[HTTP Routes]
        WS[WebSocket]
    end

    subgraph "Services"
        Agent[AgentService]
        Terminal[TerminalService]
        AutoMode[AutoModeService]
    end

    subgraph "Providers"
        Claude[ClaudeProvider]
        Base[BaseProvider]
    end

    subgraph "Libraries"
        SecureFS[secure-fs]
        Security[security]
        Events[events]
    end

    HTTP --> Agent
    HTTP --> Terminal
    WS --> Agent
    Agent --> Claude
    Claude --> Base
    Agent --> SecureFS
    Terminal --> SecureFS
    SecureFS --> Security
```

### Request Flow

```mermaid
sequenceDiagram
    participant UI as Frontend
    participant API as Express API
    participant Agent as AgentService
    participant Provider as ClaudeProvider
    participant SDK as Claude SDK
    participant FS as SecureFS

    UI->>API: POST /api/agent/send
    API->>Agent: processMessage()
    Agent->>Provider: executeQuery()

    loop AsyncGenerator
        Provider->>SDK: query()
        SDK-->>Provider: stream_event
        Provider-->>Agent: yield message
        Agent-->>UI: WebSocket broadcast

        alt Tool Execution
            SDK->>FS: file operation
            FS->>FS: validatePath()
            FS-->>SDK: result
        end
    end

    SDK-->>Provider: result
    Provider-->>Agent: complete
    Agent-->>UI: agent:complete event
```

## Module Dependencies

```mermaid
graph TD
    subgraph "@automaker/types"
        Types[Core Types]
    end

    subgraph "@automaker/utils"
        Utils[Utilities]
    end

    subgraph "@automaker/platform"
        Security[security.ts]
        SecureFS[secure-fs.ts]
        SystemPaths[system-paths.ts]
    end

    subgraph "@automaker/server"
        Providers[providers/]
        Services[services/]
        Routes[routes/]
    end

    Types --> Utils
    Types --> Security
    Security --> SecureFS
    SystemPaths --> SecureFS
    SecureFS --> Services
    Services --> Routes
    Utils --> Providers
```

## Container Architecture

```mermaid
graph TB
    subgraph "Docker Host"
        subgraph "automaker-ui Container"
            Nginx[nginx]
            StaticFiles[Static Files]
        end

        subgraph "automaker-server Container"
            Node[Node.js]
            subgraph "Non-root User"
                App[Server App]
                PTY[PTY Sessions]
            end
            subgraph "Volumes"
                Data["/data"]
                Projects["/projects"]
                Claude[".claude"]
            end
        end
    end

    Browser -->|:3007| Nginx
    Nginx --> StaticFiles
    Nginx -->|:3008| Node
    App --> PTY
    App --> Data
    App --> Projects
    App --> Claude
```

## Security Architecture

```mermaid
graph TB
    subgraph "Incoming Request"
        Request[User Request]
    end

    subgraph "Layer 1: Container"
        NonRoot[Non-root User]
        NamedVolumes[Named Volumes Only]
    end

    subgraph "Layer 2: Path Boundary"
        PathCheck[isPathAllowed]
        RootDir[ALLOWED_ROOT_DIRECTORY]
        DataDir[DATA_DIR Exception]
    end

    subgraph "Layer 3: Environment"
        EnvAllowlist[ALLOWED_ENV_VARS]
        EnvSanitize[buildEnv]
    end

    subgraph "Layer 4: Worktree"
        BranchIsolation[Branch Isolation]
        WorktreeDir[Dedicated Directory]
    end

    subgraph "Protected Resources"
        HostFS[Host Filesystem]
        HostEnv[Host Environment]
        OtherTasks[Other Task Data]
    end

    Request --> NonRoot
    NonRoot --> PathCheck
    PathCheck --> RootDir
    PathCheck --> DataDir
    RootDir --> EnvAllowlist
    DataDir --> EnvAllowlist
    EnvAllowlist --> EnvSanitize
    EnvSanitize --> BranchIsolation
    BranchIsolation --> WorktreeDir

    NonRoot -.->|Blocked| HostFS
    PathCheck -.->|Blocked| HostFS
    EnvAllowlist -.->|Blocked| HostEnv
    BranchIsolation -.->|Blocked| OtherTasks
```

## Data Flow

```mermaid
graph LR
    subgraph "Input"
        User[User Prompt]
        Files[Project Files]
    end

    subgraph "Processing"
        Agent[Agent Service]
        SDK[Claude SDK]
        Tools[Tool Execution]
    end

    subgraph "Output"
        Response[AI Response]
        Changes[File Changes]
        Events[WebSocket Events]
    end

    User --> Agent
    Files --> Agent
    Agent --> SDK
    SDK --> Tools
    Tools --> Changes
    SDK --> Response
    Agent --> Events
    Response --> Events
    Changes --> Events
```

## Key Design Decisions

### 1. Defense in Depth

Multiple independent security layers ensure that a breach in one layer doesn't compromise the entire system:

- **Container isolation** prevents host access
- **Path validation** prevents file system escape
- **Environment filtering** prevents credential leakage
- **Worktree isolation** prevents cross-task interference

### 2. Autonomous Mode

The SDK runs in fully autonomous mode (`bypassPermissions: true`) because:

- All security is handled at the infrastructure level
- The agent needs to execute tools without interactive approval
- User consent is given at task creation, not tool execution

### 3. Named Volumes Only

No host bind mounts are allowed in production because:

- Named volumes are managed by Docker, not accessible from host
- Prevents accidental exposure of host files
- Enables consistent behavior across environments

### 4. Non-root Execution

The container runs as the `automaker` user because:

- Limits damage from potential container escape
- Allows UID/GID matching for mounted volumes
- Follows security best practices

## Related Documents

- [Isolation Layers](./isolation-layers.md) - Detailed breakdown of each security layer
- [Container Dockerfile](../container/dockerfile.md) - Multi-stage build configuration
- [SDK Provider](../sdk-integration/provider.md) - Claude SDK integration
