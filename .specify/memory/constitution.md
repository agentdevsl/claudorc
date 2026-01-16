# Web Development AI-Assisted Constitution

**Organization**: [Your Organization Name]
**Version**: 1.0.0
**Effective Date**: December 2025
**Purpose**: Governing principles for AI-assisted web code generation using TypeScript, Node.js, and modern web frameworks

---

## I. Foundational Principles

### 1.1 Modern TypeScript-First Architecture

**Principle**: All code MUST use TypeScript with strict mode enabled.

**Rationale**: JavaScript without types leads to runtime errors, poor IDE support, and maintenance burden. TypeScript provides compile-time safety and self-documenting code.

**Implementation**:

- You MUST use TypeScript strict mode for all new code
- You MUST use `async/await` for all asynchronous code (NEVER callbacks)
- You MUST use ESM modules (`import`/`export`) not CommonJS
- You MUST use Vitest for new tests
- You MUST use explicit return types for public functions
- Fix issues first don't apply workarounds

### 1.2 Specification-Driven Development

**Principle**: Web code generation MUST be driven by explicit specifications.

**Rationale**: "Vibe-coding" leads to inconsistent implementations, missing edge cases, and maintenance nightmares. Specifications create auditable decision trails.

**Implementation**:

- You MUST request clarification on ambiguous requirements before generating code
- Generated code MUST include JSDoc comments for public APIs
- API specifications MUST define: endpoints, request/response schemas, error codes
- You MUST validate specifications against platform constraints

### 1.3 Security-First Development

**Principle**: Generated code MUST implement security controls by default.

**Rationale**: Web applications handle sensitive user data and require secure patterns for authentication, storage, and network communication.

**Implementation**:

- You MUST never store secrets in code - use environment variables
- All API inputs MUST be validated with a schema validator (Zod, Yup, etc.)
- All database queries MUST use parameterized queries or ORM
- CORS, CSP, and security headers MUST be configured
- Authentication tokens MUST use secure storage patterns (httpOnly cookies, etc.)

---

## II. Development Environment

### 2.1 Required Configuration

**Standard**: Development environment MUST meet minimum requirements.

**Prerequisites**:

- Node.js 24+ (LTS)
- TypeScript 5.7+
- npm/pnpm/yarn

**Rules**:

- You MUST verify Node.js version before suggesting platform-specific features
- Project structure MUST follow organizational conventions
- All dependencies MUST be explicitly declared in package.json

### 2.2 Tech Stack Requirements

**Standard**: All projects MUST use the approved technology stack.

| Layer      | Technology      | Notes                          |
| ---------- | --------------- | ------------------------------ |
| Language   | TypeScript 5.7+ | Strict mode, ESM               |
| Runtime    | Node.js 24+     | LTS, native ESM                |
| Testing    | Vitest          | Fast, Vite-compatible          |
| Linting    | ESLint 9        | Flat config, typescript-eslint |
| Formatting | Prettier 3      | Consistent code style          |
| CI/CD      | GitHub Actions  | Lint, test, deploy             |

---

## III. Code Generation Standards

### 3.1 Mandatory Patterns (MUST)

**Standard**: These patterns are REQUIRED in all generated code.

**Rules**:

- Use TypeScript with strict mode enabled
- Use `async/await` for asynchronous operations
- Use Vitest (`describe`, `it`, `expect`) for tests
- Use explicit return types for public functions
- Use dependency injection for service dependencies
- Use repository pattern for data access
- Use environment variables for configuration
- Use proper error handling with typed errors

### 3.2 Prohibited Patterns (NEVER)

**Standard**: These patterns are PROHIBITED in all generated code.

**Prohibitions**:

- Use `any` type without explicit justification
- Use `var` keyword - use `const` or `let`
- Store secrets in code or version control
- Use synchronous I/O in async contexts
- Disable TypeScript strict checks
- Use mutable global state
- Skip error handling for async operations
- Use CommonJS in new code

### 3.3 Preferred Patterns (PREFER)

**Standard**: These patterns are PREFERRED when multiple approaches exist.

**Preferences**:

- Functional programming over imperative
- Composition over inheritance
- Named exports over default exports
- Optional chaining (`?.`) and nullish coalescing (`??`)
- Template literals over string concatenation
- Early returns with guard clauses
- Small, focused functions (< 30 lines)

### 3.4 File Organization

**Standard**: Files MUST follow organizational conventions.

**Project Structure**:

```
src/
├── api/                # API route handlers
│   └── routes/         # Route definitions
├── services/           # Business logic layer
├── repositories/       # Data access layer
├── models/             # Type definitions
├── lib/                # Shared utilities
└── index.ts            # Entry point

tests/
├── unit/               # Unit tests
├── integration/        # Integration tests
└── e2e/                # End-to-end tests
```

### 3.5 Naming Conventions

**Standard**: Names MUST be predictable and follow conventions.

| Type      | Convention      | Example           |
| --------- | --------------- | ----------------- |
| Files     | kebab-case      | `item.service.ts` |
| Classes   | PascalCase      | `ItemService`     |
| Functions | camelCase       | `findById`        |
| Constants | SCREAMING_SNAKE | `MAX_RETRY_COUNT` |
| Types     | PascalCase      | `CreateItemInput` |

---

## IV. Architecture Patterns

### 4.1 Service Layer Architecture

**Standard**: All features MUST follow the service-repository pattern.

**Architecture Flow**:

```
API Route Handler → Service (business logic) → Repository (data access) → Database/API
```

### 4.2 Service Template

```typescript
export class ItemService {
  constructor(private readonly repository: ItemRepository) {}

  async findAll(): Promise<Item[]> {
    return this.repository.findAll();
  }

  async create(input: CreateItemInput): Promise<Item> {
    // Validation logic
    if (!input.title.trim()) {
      throw new ValidationError('Title is required');
    }
    return this.repository.create(input);
  }
}
```

### 4.3 Repository Template

```typescript
export interface ItemRepository {
  findAll(): Promise<Item[]>;
  findById(id: string): Promise<Item | null>;
  create(input: CreateItemInput): Promise<Item>;
  update(id: string, input: UpdateItemInput): Promise<Item>;
  delete(id: string): Promise<void>;
}
```

---

## V. Security and Compliance

### 5.1 Credential Management

**Policy**: No secrets SHALL be stored in code or version control.

**Implementation**:

- Secrets MUST be loaded from environment variables
- Use `.env.example` for documentation (never `.env`)
- Production secrets MUST use secure secret management
- You MUST NOT commit environment files

### 5.2 Input Validation

**Policy**: All external inputs MUST be validated.

**Implementation**:

- Use schema validation (Zod, Yup, etc.)
- Validate at API boundaries
- Sanitize user inputs
- Use parameterized queries for databases

### 5.3 Security Headers

**Policy**: All HTTP responses MUST include security headers.

**Implementation**:

- Content-Security-Policy
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Strict-Transport-Security (HSTS)

---

## VI. Test-Driven Development (TDD)

### 6.1 TDD Methodology

**Standard**: All new features MUST follow the RED-GREEN-REFACTOR methodology.

**The TDD Cycle**:

1. **RED Phase** - Write Failing Test First
   - Create test file before implementation
   - Define expected behavior through assertions
   - Run tests to verify they fail for the right reason

2. **GREEN Phase** - Write Minimal Code to Pass
   - Implement only what's needed to pass the test
   - Focus on correctness, not optimization
   - Run tests to verify they pass

3. **REFACTOR Phase** - Improve While Keeping Tests Green
   - Apply TypeScript best practices
   - Improve code quality and readability
   - Run tests after each refactoring step

### 6.2 Vitest Framework

**Standard**: All new tests MUST use Vitest.

**Test File Organization**:

```text
src/
├── services/
│   ├── item.service.ts        # Implementation
│   └── item.service.test.ts   # Co-located unit tests
tests/
├── integration/               # Integration tests
└── e2e/                       # End-to-end tests
```

**Test Template**:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ItemService', () => {
  let service: ItemService;
  let repository: MockItemRepository;

  beforeEach(() => {
    repository = new MockItemRepository();
    service = new ItemService(repository);
  });

  describe('create', () => {
    it('should create item with valid input', async () => {
      // Arrange
      const input = { title: 'Test Item' };

      // Act
      const result = await service.create(input);

      // Assert
      expect(result.title).toBe('Test Item');
      expect(result.id).toBeDefined();
    });

    it('should throw ValidationError for empty title', async () => {
      await expect(service.create({ title: '' })).rejects.toThrow('Title is required');
    });
  });
});
```

### 6.3 TDD Execution Steps

#### Step 1: Validation Phase

- Validate module exists in project structure
- Check naming conventions are followed
- Ensure no conflicting implementations exist

#### Step 2: RED Phase - Write Failing Test

```typescript
// src/services/feature.service.test.ts
import { describe, it, expect } from 'vitest';
import { FeatureService } from './feature.service';

describe('FeatureService', () => {
  it('should implement expected behavior', async () => {
    const service = new FeatureService();

    const result = await service.execute();

    expect(result).toBeDefined(); // Will fail - not yet implemented
  });
});
```

Run test to verify failure:

```bash
npm run test -- feature.service
```

#### Step 3: GREEN Phase - Minimal Implementation

```typescript
// src/services/feature.service.ts
export class FeatureService {
  async execute(): Promise<Result> {
    return { success: true }; // Minimal implementation
  }
}
```

Run tests to verify they pass:

```bash
npm run test -- feature.service
```

#### Step 4: REFACTOR Phase - Improve Code

```typescript
// Refactored with proper typing, validation, and error handling
export class FeatureService {
  constructor(private readonly repository: FeatureRepository) {}

  async execute(input: FeatureInput): Promise<Result> {
    this.validate(input);
    const data = await this.repository.fetch(input.id);
    return this.transform(data);
  }

  private validate(input: FeatureInput): void {
    if (!input.id) throw new ValidationError('ID is required');
  }

  private transform(data: RawData): Result {
    return { success: true, data };
  }
}
```

Verify all tests still pass:

```bash
npm run test -- feature.service
npm run lint
npm run typecheck
```

### 6.4 Coverage Requirements

**Standard**: Code coverage MUST meet minimum thresholds.

| Metric     | Minimum | Target |
| ---------- | ------- | ------ |
| Statements | 80%     | 90%    |
| Branches   | 80%     | 90%    |
| Functions  | 80%     | 90%    |
| Lines      | 80%     | 90%    |

**Coverage Commands**:

```bash
npm run test:coverage        # Run with coverage report
```

### 6.5 Mock Pattern

**Standard**: Mocks MUST follow interface contracts.

```typescript
// In-memory mock for testing
class MockItemRepository implements ItemRepository {
  private items: Map<string, Item> = new Map();
  public calls: { method: string; args: unknown[] }[] = [];

  async findAll(): Promise<Item[]> {
    this.calls.push({ method: 'findAll', args: [] });
    return Array.from(this.items.values());
  }

  async create(input: CreateItemInput): Promise<Item> {
    this.calls.push({ method: 'create', args: [input] });
    const item = { id: crypto.randomUUID(), ...input, createdAt: new Date() };
    this.items.set(item.id, item);
    return item;
  }

  // Test helper methods
  seedItems(items: Item[]): void {
    items.forEach((item) => this.items.set(item.id, item));
  }

  reset(): void {
    this.items.clear();
    this.calls = [];
  }
}
```

### 6.6 Success Criteria

**Checklist**: All TDD cycles MUST meet these criteria.

- [ ] All new tests pass successfully
- [ ] Test coverage exceeds 80% for new code
- [ ] No existing tests broken (no regressions)
- [ ] Code passes ESLint with no errors
- [ ] Code passes TypeScript strict checks
- [ ] Code properly formatted with Prettier

---

## VII. Build and CI/CD

### 7.1 GitHub Actions CI

**Standard**: All projects MUST have CI pipelines.

**CI Requirements**:

- Type checking on every push and PR
- Linting and format checking
- Test execution with coverage
- Node.js 20 runner

### 7.2 Build Scripts

**Standard**: package.json MUST include standard scripts.

```json
{
  "scripts": {
    "build": "tsc",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## VIII. AI Agent Behavior

### 8.1 Prerequisites Validation

**Constraint**: You MUST validate development environment before operations.

**Requirements**:

- Verify Node.js version
- Check for required dependencies
- Validate project structure

### 8.2 Scope Boundaries

**Constraint**: You MUST operate within defined patterns.

**In Scope**:

- Generating TypeScript services, repositories, and tests
- Writing Vitest tests
- API route implementations
- Database integration code

**Out of Scope**:

- Production deployment configurations
- Secret management setup
- Infrastructure provisioning (use Terraform skills)

### 8.3 Frontend Design Skill

**Standard**: You MUST use the `document-skills:frontend-design` skill when performing frontend design work.

**Rationale**: The frontend-design skill provides specialized capabilities for creating distinctive, production-grade frontend interfaces with high design quality. It ensures polished, creative UI design that avoids generic AI aesthetics.

**Implementation**:

- You MUST invoke `document-skills:frontend-design` when building web components, pages, or applications
- Use this skill for websites, landing pages, dashboards, React components, and HTML/CSS layouts
- Apply this skill when styling or beautifying any web UI
- The skill generates creative, polished code that follows design best practices

### 8.4 Error Handling

**Standard**: You MUST acknowledge limitations and uncertainties.

**Rules**:

- When build fails, analyze error output and provide remediation
- When tests fail, identify root cause before suggesting fixes
- When specifications are ambiguous, request clarification

---

## IX. Governance and Evolution

### 9.1 Constitution Updates

**Process**: This constitution evolves with platform and organizational needs.

- Platform team maintains constitution in version control
- Major changes require architecture team review
- Developers MAY propose amendments via pull request

### 9.2 Exception Process

**Policy**: Deviations require explicit approval and documentation.

1. Document specific requirement driving exception
2. Propose alternative approach with risk assessment
3. Obtain tech lead approval
4. Document exception in code comments

---

## X. Implementation Checklist

### For Developers:

- [ ] Verify Node.js 20+ is installed
- [ ] Clone project template repository
- [ ] Run `npm install`
- [ ] Configure environment variables
- [ ] Generate code following architecture templates
- [ ] Write tests using Vitest
- [ ] Run lint and type checks
- [ ] Submit PR for code review

### For Tech Leads:

- [ ] Publish this constitution to organization knowledge base
- [ ] Create starter templates embodying these principles
- [ ] Configure GitHub Actions CI/CD pipelines
- [ ] Monitor code quality and test coverage metrics
- [ ] Iterate on patterns based on team feedback

---

## XI. References

### Internal Resources

- Project Template Repository: `[template-repo-url]`
- Design System: `[design-system-url]`

### External Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Vitest Documentation](https://vitest.dev/)
- [ESLint Documentation](https://eslint.org/docs/latest/)

### Change Log

- **v1.0.0** (December 2025): Initial web development constitution
