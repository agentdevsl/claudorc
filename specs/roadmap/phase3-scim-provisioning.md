# Phase 3: SCIM 2.0 User Provisioning

> **ROADMAP ONLY** - This specification is for planning purposes. Not scheduled for immediate implementation.

## Overview

Implement SCIM 2.0 (System for Cross-domain Identity Management) to enable automated user provisioning and group synchronization from enterprise identity providers.

## Goals

1. **Automated User Lifecycle** - Create, update, and deactivate users automatically from IdP
2. **Group Synchronization** - Map IdP groups to AgentPane project access
3. **Standards Compliance** - Full SCIM 2.0 RFC 7643/7644 compliance
4. **Enterprise Integration** - Support major IdPs: Okta, Azure AD, OneLogin, JumpCloud

## Library Comparison

### Server Implementations

| Library | Downloads | Type | TypeScript | Bun | Features | Notes |
|---------|-----------|------|------------|-----|----------|-------|
| [SCIM Gateway](https://github.com/jelhub/scimgateway) | - | Server/Proxy | ✅ Native | ✅ | SCIM 1.1 & 2.0, plugin system, Azure Relay | v6.1.5 (Jan 2025), enterprise-grade |
| [SCIMMY](https://github.com/scimmyjs/scimmy) | ~7k/wk | Server | ✅ | ❌ | Full RFC compliance, schema validation | v1.3.5, tested with Entra ID |
| [scimmy-routers](https://www.npmjs.com/package/scimmy-routers) | - | Middleware | ✅ | ❌ | Express middleware for SCIMMY | Jan 2025, pairs with SCIMMY |
| [node_okta_app](https://github.com/swamy526/node_okta_app) | - | Reference | ❌ | ❌ | Okta SCIM 2.0 example | Sample implementation |

### Utility Libraries

| Library | Downloads | Purpose | TypeScript | Notes |
|---------|-----------|---------|------------|-------|
| [scim-patch](https://github.com/thomaspoignant/scim-patch) | - | PATCH operations | ✅ | RFC 7644 §3.5.2 compliance |
| [scim2-parse-filter](https://github.com/thomaspoignant/scim2-parse-filter) | - | Filter parsing | ✅ | Returns AST from filter queries |
| [scim-query-filter-parser](https://github.com/the-control-group/scim-query-filter-parser-js) | - | Filter compiler | ✅ | Compiles to executable functions |
| [@latticehr/scim-query-filter-parser](https://www.npmjs.com/package/@latticehr/scim-query-filter-parser) | - | Filter + PATCH paths | ✅ | Fork with path support |

### Client Libraries

| Library | Type | TypeScript | Notes |
|---------|------|------------|-------|
| [scim-node](https://github.com/GluuFederation/SCIM-Node) | Gluu client | ❌ | Gluu-specific |
| [scim2-js](https://github.com/braveulysses/scim2-js) | General client | ❌ | Limited; author recommends Java SDK |
| [WorkOS Node SDK](https://github.com/workos/workos-node) | WorkOS client | ✅ | Commercial IdP, includes SCIM |

### Other Languages (Reference)

| Library | Language | Notes |
|---------|----------|-------|
| [WSO2 Charon](https://github.com/wso2/charon) | Java | Production-grade, widely used |
| [UnboundID SCIM 2 SDK](https://github.com/pingidentity/scim2) | Java | Recommended by scim2-js author |
| [laravel-scim-server](https://github.com/limosa-io/laravel-scim-server) | PHP | Powers "The SCIM Playground" |
| [scim-server (Rust)](https://github.com/pukeko37/scim-server) | Rust | Type-safe, enterprise-ready |

### Recommendation

Two viable approaches depending on requirements:

#### Option A: SCIMMY (Direct Integration)

Best for embedding SCIM directly into the application:

- Full RFC 7643/7644 compliance
- Active maintenance (Feb 2025)
- Tested against Microsoft Entra ID (Azure AD)
- Companion package [scimmy-routers](https://www.npmjs.com/package/scimmy-routers) for Express middleware

```typescript
import { Resources, Schemas } from 'scimmy';

// Define custom schema extensions
Resources.User.extend(Schemas.User.extend([
  { name: 'projectAccess', type: 'complex', multiValued: true }
]));

// Handle user creation
Resources.User.ingress((resource, data) => {
  return createUserFromScim(data);
});
```

#### Option B: SCIM Gateway (Proxy Architecture)

Best for enterprise deployments with multiple backends:

- Native TypeScript (v5.0+)
- **Bun support** with binary builds
- Plugin system for backend connectors
- Multi-tenant capable
- SCIM 1.1 and 2.0 support

```typescript
// scimgateway acts as middleware between IdP and AgentPane
// Configure via plugin to connect to AgentPane's user API
```

### Decision Criteria

| Requirement | SCIMMY | SCIM Gateway |
|-------------|--------|--------------|
| Bun runtime | ❌ | ✅ |
| Embedded in app | ✅ | ❌ |
| Multi-tenant | Manual | ✅ Built-in |
| Plugin ecosystem | ❌ | ✅ |
| Lightweight | ✅ | ❌ |

## SCIM 2.0 Endpoints

### Core Resources

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/scim/v2/Users` | GET, POST | List and create users |
| `/scim/v2/Users/{id}` | GET, PUT, PATCH, DELETE | Manage individual user |
| `/scim/v2/Groups` | GET, POST | List and create groups |
| `/scim/v2/Groups/{id}` | GET, PUT, PATCH, DELETE | Manage individual group |

### Discovery Endpoints

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/scim/v2/ServiceProviderConfig` | GET | SCIM capabilities and authentication |
| `/scim/v2/Schemas` | GET | Supported resource schemas |
| `/scim/v2/ResourceTypes` | GET | Supported resource types |

### Bulk Operations

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/scim/v2/Bulk` | POST | Batch create/update/delete operations |

## User Schema

```json
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
  "id": "usr_abc123",
  "externalId": "okta-user-id",
  "userName": "jane.doe@example.com",
  "name": {
    "givenName": "Jane",
    "familyName": "Doe",
    "formatted": "Jane Doe"
  },
  "emails": [
    {
      "value": "jane.doe@example.com",
      "type": "work",
      "primary": true
    }
  ],
  "active": true,
  "groups": [
    {
      "value": "grp_xyz789",
      "display": "Engineering"
    }
  ],
  "meta": {
    "resourceType": "User",
    "created": "2024-01-15T10:30:00Z",
    "lastModified": "2024-01-15T10:30:00Z",
    "location": "/scim/v2/Users/usr_abc123"
  }
}
```

## Group Schema

```json
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
  "id": "grp_xyz789",
  "externalId": "okta-group-id",
  "displayName": "Engineering",
  "members": [
    {
      "value": "usr_abc123",
      "display": "Jane Doe",
      "type": "User"
    }
  ],
  "meta": {
    "resourceType": "Group",
    "created": "2024-01-15T10:30:00Z",
    "lastModified": "2024-01-15T10:30:00Z",
    "location": "/scim/v2/Groups/grp_xyz789"
  }
}
```

## Authentication

SCIM endpoints require bearer token authentication:

```
Authorization: Bearer <scim_token>
```

Tokens are generated per-IdP integration with configurable scopes:
- `scim:users:read` - Read user information
- `scim:users:write` - Create/update/delete users
- `scim:groups:read` - Read group information
- `scim:groups:write` - Create/update/delete groups

## Group-to-Project Mapping

Map IdP groups to AgentPane project roles:

| IdP Group | AgentPane Project | Role |
|-----------|-------------------|------|
| `Engineering` | `agentpane` | `admin` |
| `Engineering` | `frontend-app` | `developer` |
| `QA Team` | `agentpane` | `reviewer` |
| `Contractors` | `frontend-app` | `viewer` |

### Mapping Configuration

```typescript
interface GroupMapping {
  idpGroupId: string;
  idpGroupName: string;
  projectId: string;
  role: 'admin' | 'developer' | 'reviewer' | 'viewer';
  autoSync: boolean;
}
```

## Database Schema Extensions

```sql
-- SCIM integration configuration
CREATE TABLE scim_integrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'okta', 'azure_ad', 'onelogin', 'jumpcloud'
  tenant_url TEXT,
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL, -- First 8 chars for identification
  scopes TEXT[] NOT NULL,
  enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- External user identities
CREATE TABLE scim_user_mappings (
  id TEXT PRIMARY KEY,
  integration_id TEXT REFERENCES scim_integrations(id),
  external_id TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  synced_at TIMESTAMPTZ,
  UNIQUE(integration_id, external_id)
);

-- External group identities
CREATE TABLE scim_group_mappings (
  id TEXT PRIMARY KEY,
  integration_id TEXT REFERENCES scim_integrations(id),
  external_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  synced_at TIMESTAMPTZ,
  UNIQUE(integration_id, external_id)
);

-- Group to project role mappings
CREATE TABLE scim_project_access (
  id TEXT PRIMARY KEY,
  group_mapping_id TEXT REFERENCES scim_group_mappings(id),
  project_id TEXT REFERENCES projects(id),
  role TEXT NOT NULL,
  auto_sync BOOLEAN DEFAULT true,
  UNIQUE(group_mapping_id, project_id)
);
```

## SCIM Service Interface

```typescript
interface ScimService {
  // Users
  listUsers(filter?: string, startIndex?: number, count?: number): Promise<ScimListResponse<ScimUser>>;
  getUser(id: string): Promise<ScimUser>;
  createUser(user: ScimUserCreate): Promise<ScimUser>;
  updateUser(id: string, user: ScimUserUpdate): Promise<ScimUser>;
  patchUser(id: string, operations: ScimPatchOp[]): Promise<ScimUser>;
  deleteUser(id: string): Promise<void>;

  // Groups
  listGroups(filter?: string, startIndex?: number, count?: number): Promise<ScimListResponse<ScimGroup>>;
  getGroup(id: string): Promise<ScimGroup>;
  createGroup(group: ScimGroupCreate): Promise<ScimGroup>;
  updateGroup(id: string, group: ScimGroupUpdate): Promise<ScimGroup>;
  patchGroup(id: string, operations: ScimPatchOp[]): Promise<ScimGroup>;
  deleteGroup(id: string): Promise<void>;

  // Bulk
  bulk(operations: ScimBulkOp[]): Promise<ScimBulkResponse>;

  // Discovery
  getServiceProviderConfig(): ScimServiceProviderConfig;
  getSchemas(): ScimSchema[];
  getResourceTypes(): ScimResourceType[];
}
```

## Filter Support

SCIM filter expressions for querying:

```
# Find user by username
GET /scim/v2/Users?filter=userName eq "jane.doe@example.com"

# Find active users
GET /scim/v2/Users?filter=active eq true

# Find users in a group
GET /scim/v2/Users?filter=groups.value eq "grp_xyz789"

# Complex filter
GET /scim/v2/Users?filter=name.familyName co "Doe" and active eq true
```

Supported operators:
- `eq` - Equal
- `ne` - Not equal
- `co` - Contains
- `sw` - Starts with
- `ew` - Ends with
- `gt`, `ge`, `lt`, `le` - Comparison
- `and`, `or`, `not` - Logical

## IdP Integration Guides

### Okta

1. Create SCIM 2.0 application in Okta
2. Configure provisioning with AgentPane SCIM endpoint
3. Generate bearer token in AgentPane
4. Map Okta groups to projects

### Azure AD (Entra ID)

1. Create Enterprise Application
2. Enable automatic provisioning
3. Configure SCIM endpoint and token
4. Set up attribute mappings

### OneLogin

1. Add SCIM Provisioner app
2. Configure API connection
3. Set up user/group provisioning rules

### JumpCloud

1. Configure SCIM integration
2. Set Identity Management settings
3. Map user groups

## Audit Logging

All SCIM operations are logged:

```typescript
interface ScimAuditLog {
  id: string;
  integrationId: string;
  operation: 'CREATE' | 'UPDATE' | 'PATCH' | 'DELETE';
  resourceType: 'User' | 'Group';
  resourceId: string;
  externalId?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}
```

## Error Responses

SCIM-compliant error format:

```json
{
  "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
  "status": "400",
  "scimType": "invalidFilter",
  "detail": "Filter expression is invalid: unexpected token at position 15"
}
```

Error types:
- `invalidFilter` - Malformed filter expression
- `tooMany` - Too many results
- `uniqueness` - Uniqueness constraint violated
- `mutability` - Attempted to modify immutable attribute
- `invalidSyntax` - Request body syntax error
- `invalidValue` - Invalid attribute value
- `noTarget` - No target for PATCH operation

## Rate Limiting

SCIM endpoints are rate-limited:

| Endpoint | Limit |
|----------|-------|
| List operations | 100/min |
| Single resource | 300/min |
| Bulk operations | 10/min |

## Migration from Phase 1

If users exist before SCIM is enabled:

1. **Link Existing Users** - Match by email address
2. **Conflict Resolution** - Admin reviews unmatched users
3. **Gradual Rollout** - Enable per-project

## Security Considerations

1. **Token Security** - Tokens are hashed, only prefix shown in UI
2. **IP Allowlisting** - Optional restriction to IdP IP ranges
3. **TLS Required** - SCIM endpoints require HTTPS
4. **Audit Trail** - All provisioning actions logged
5. **Soft Delete** - Deactivated users retain data for recovery period

## UI Components

See wireframe: `specs/application/wireframes/scim-settings-roadmap.html`

### Settings Sections

1. **Integrations** - Add/manage IdP connections
2. **Group Mappings** - Map groups to project roles
3. **Sync Status** - View provisioning activity
4. **Audit Log** - Review SCIM operations

## Dependencies

- Phase 1: Authentication system (OAuth/sessions)
- Phase 1: Project/user database schema
- Optional: Phase 2 Sandbox Plugins (for isolated testing)

## Open Questions

1. Should we support SCIM 1.1 for legacy IdPs?
2. How to handle users in multiple groups with conflicting roles?
3. Should deprovisioned users lose access immediately or have grace period?
4. Support for custom SCIM schema extensions?

## References

- [RFC 7643 - SCIM Core Schema](https://datatracker.ietf.org/doc/html/rfc7643)
- [RFC 7644 - SCIM Protocol](https://datatracker.ietf.org/doc/html/rfc7644)
- [Okta SCIM Documentation](https://developer.okta.com/docs/reference/scim/)
- [Azure AD SCIM Documentation](https://learn.microsoft.com/en-us/azure/active-directory/app-provisioning/use-scim-to-provision-users-and-groups)
