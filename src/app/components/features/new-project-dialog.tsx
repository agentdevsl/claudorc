import {
  Book,
  CheckCircle,
  Code,
  FolderSimple,
  GitBranch,
  GithubLogo,
  Lightning,
  Lock,
  MagnifyingGlass,
  Spinner,
  Star,
  WarningCircle,
} from '@phosphor-icons/react';
import { cva, type VariantProps } from 'class-variance-authority';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { TextInput } from '@/app/components/ui/text-input';
import { Textarea } from '@/app/components/ui/textarea';
import { cn } from '@/lib/utils/cn';
import type { Result } from '@/lib/utils/result';
import type { GitHubRepo } from '@/services/github-token.service';
import type { PathValidation } from '@/services/project.service';

// Types
interface RepositoryInfo {
  name: string;
  path: string;
  isGitRepo: boolean;
  defaultBranch?: string;
  remoteUrl?: string;
  hasClaudeConfig?: boolean;
}

interface RecentRepo {
  name: string;
  path: string;
}

interface SkillConfig {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  enabled: boolean;
}

type SourceType = 'local' | 'clone';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; path: string; description?: string }) => Promise<void>;
  onValidatePath: (path: string) => Promise<Result<PathValidation, unknown>>;
  onClone?: (url: string, destination: string) => Promise<Result<{ path: string }, unknown>>;
  onFetchUserRepos?: () => Promise<GitHubRepo[]>;
  isGitHubConfigured?: boolean;
  recentRepos?: RecentRepo[];
  initialPath?: string;
  initialSource?: SourceType;
}

// Variants for RepoInfoCard
const repoInfoCardVariants = cva(
  'mt-4 rounded-[var(--radius)] border p-4 transition-colors duration-fast ease-out',
  {
    variants: {
      status: {
        valid: 'border-success/40 bg-success-muted',
        invalid: 'border-danger/40 bg-danger-muted',
        idle: 'border-border bg-surface-subtle',
      },
    },
    defaultVariants: {
      status: 'idle',
    },
  }
);

// Variants for skill cards
const skillCardVariants = cva(
  'flex items-start gap-3 rounded-[var(--radius)] border p-3 transition-all duration-fast ease-out cursor-pointer',
  {
    variants: {
      enabled: {
        true: 'border-accent bg-accent-muted',
        false: 'border-border bg-surface-subtle hover:border-fg-subtle',
      },
    },
    defaultVariants: {
      enabled: false,
    },
  }
);

// Sub-component: RepoInfoCard
interface RepoInfoCardProps extends VariantProps<typeof repoInfoCardVariants> {
  repoInfo: RepositoryInfo | null;
  isValidating?: boolean;
}

function RepoInfoCard({ repoInfo, status, isValidating }: RepoInfoCardProps) {
  if (!repoInfo && !isValidating) return null;

  if (isValidating) {
    return (
      <div className={repoInfoCardVariants({ status: 'idle' })}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] bg-surface-muted text-fg-muted">
            <Spinner className="h-5 w-5 animate-spin" />
          </div>
          <div>
            <div className="text-sm font-medium text-fg">Validating repository...</div>
            <div className="font-mono text-xs text-fg-muted">Checking git configuration</div>
          </div>
        </div>
      </div>
    );
  }

  if (!repoInfo) return null;

  return (
    <div className={repoInfoCardVariants({ status })} data-testid="repo-info-card">
      <div className="mb-3 flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-[var(--radius)]',
            status === 'valid' ? 'bg-success text-fg-on-emphasis' : 'bg-surface-muted text-fg-muted'
          )}
        >
          <Book className="h-5 w-5" weight="fill" />
        </div>
        <div>
          <div className="font-semibold text-fg">{repoInfo.name}</div>
          <div className="font-mono text-xs text-fg-muted">{repoInfo.path}</div>
        </div>
      </div>
      <div className="flex gap-4 border-t border-border-muted pt-3">
        {repoInfo.isGitRepo && (
          <div className="flex items-center gap-1.5 text-xs text-success">
            <CheckCircle className="h-3.5 w-3.5" weight="fill" />
            Git repository
          </div>
        )}
        {repoInfo.defaultBranch && (
          <div className="flex items-center gap-1.5 text-xs text-fg-muted">
            <GitBranch className="h-3.5 w-3.5" />
            {repoInfo.defaultBranch}
          </div>
        )}
        {repoInfo.remoteUrl && (
          <div className="flex items-center gap-1.5 text-xs text-fg-muted">
            <GithubLogo className="h-3.5 w-3.5" />
            origin
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-component: RecentRepoList
interface RecentRepoListProps {
  repos: RecentRepo[];
  onSelect: (path: string) => void;
}

function RecentRepoList({ repos, onSelect }: RecentRepoListProps) {
  if (repos.length === 0) return null;

  return (
    <div className="space-y-1" data-testid="recent-repos-list">
      {repos.map((repo) => (
        <button
          key={repo.path}
          type="button"
          onClick={() => onSelect(repo.path)}
          className={cn(
            'flex w-full items-center gap-3 rounded-[var(--radius)] border border-transparent p-2.5',
            'text-left transition-all duration-fast ease-out',
            'hover:border-border hover:bg-surface-subtle'
          )}
          data-testid={`recent-repo-${repo.name}`}
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--radius)] bg-surface-muted text-fg-muted">
            <Book className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-fg">{repo.name}</div>
            <div className="truncate font-mono text-xs text-fg-subtle">{repo.path}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

// Sub-component: SkillCard
interface SkillCardProps {
  skill: SkillConfig;
  onToggle: (id: string) => void;
}

function SkillCard({ skill, onToggle }: SkillCardProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(skill.id)}
      className={skillCardVariants({ enabled: skill.enabled })}
      data-testid={`skill-card-${skill.id}`}
    >
      <div
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--radius)]',
          skill.enabled ? 'bg-accent text-fg-on-emphasis' : 'bg-surface-muted text-fg-muted'
        )}
      >
        {skill.icon}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-fg">{skill.name}</span>
          {skill.enabled && <CheckCircle className="h-3.5 w-3.5 text-accent" weight="fill" />}
        </div>
        <div className="text-xs text-fg-muted">{skill.description}</div>
      </div>
    </button>
  );
}

// Sub-component: Divider
function Divider({ text }: { text: string }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs uppercase tracking-wide text-fg-subtle">{text}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// Sub-component: GitHubRepoList
interface GitHubRepoListProps {
  repos: GitHubRepo[];
  isLoading: boolean;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSelect: (repo: GitHubRepo) => void;
  selectedRepoId?: number;
}

function GitHubRepoList({
  repos,
  isLoading,
  searchTerm,
  onSearchChange,
  onSelect,
  selectedRepoId,
}: GitHubRepoListProps) {
  const filteredRepos = repos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      repo.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (repo.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  return (
    <div className="space-y-3" data-testid="github-repo-list">
      <label
        className="text-xs font-medium uppercase tracking-wide text-fg-muted"
        htmlFor="repo-search"
      >
        Search your repositories
      </label>
      <div className="relative">
        <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
        <TextInput
          id="repo-search"
          value={searchTerm}
          placeholder="Filter repositories..."
          className="pl-10"
          onChange={(e) => onSearchChange(e.target.value)}
          data-testid="repo-search-input"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner className="h-6 w-6 animate-spin text-fg-muted" />
          <span className="ml-2 text-sm text-fg-muted">Loading repositories...</span>
        </div>
      ) : filteredRepos.length === 0 ? (
        <div className="py-8 text-center text-sm text-fg-muted">
          {searchTerm ? 'No repositories match your search.' : 'No repositories found.'}
        </div>
      ) : (
        <div className="max-h-[240px] space-y-1 overflow-y-auto rounded-[var(--radius)] border border-border bg-surface-subtle p-1">
          {filteredRepos.map((repo) => (
            <button
              key={repo.id}
              type="button"
              onClick={() => onSelect(repo)}
              className={cn(
                'flex w-full items-start gap-3 rounded-[var(--radius-sm)] p-2.5',
                'text-left transition-all duration-fast ease-out',
                selectedRepoId === repo.id
                  ? 'border border-accent bg-accent-muted'
                  : 'border border-transparent hover:bg-surface-muted'
              )}
              data-testid={`github-repo-${repo.name}`}
            >
              <div
                className={cn(
                  'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--radius)]',
                  selectedRepoId === repo.id
                    ? 'bg-accent text-fg-on-emphasis'
                    : 'bg-surface-muted text-fg-muted'
                )}
              >
                <Book className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-fg">{repo.name}</span>
                  <div className="flex items-center gap-1 text-xs text-fg-subtle">
                    <Star className="h-3 w-3" />
                    {repo.stargazers_count}
                  </div>
                  {repo.private && (
                    <span className="flex items-center gap-0.5 rounded-full bg-surface-muted px-1.5 py-0.5 text-xs text-fg-subtle">
                      <Lock className="h-2.5 w-2.5" weight="fill" />
                      Private
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-xs text-fg-subtle">
                  {repo.description || 'No description'}
                </div>
              </div>
              {selectedRepoId === repo.id && (
                <CheckCircle className="h-5 w-5 flex-shrink-0 text-accent" weight="fill" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Default skills configuration
const defaultSkills: SkillConfig[] = [
  {
    id: 'code-review',
    name: 'Code Review',
    icon: <Code className="h-4 w-4" />,
    description: 'Automated PR reviews and suggestions',
    enabled: true,
  },
  {
    id: 'testing',
    name: 'Testing',
    icon: <Lightning className="h-4 w-4" />,
    description: 'Generate and run test suites',
    enabled: false,
  },
];

// Mock recent repos for demo
const mockRecentRepos: RecentRepo[] = [
  { name: 'claude-code', path: '~/git/claude-code' },
  { name: 'tanstack-db', path: '~/git/tanstack-db' },
  { name: 'my-saas-app', path: '~/projects/my-saas-app' },
];

export function NewProjectDialog({
  open,
  onOpenChange,
  onSubmit,
  onValidatePath,
  onClone,
  onFetchUserRepos,
  isGitHubConfigured = false,
  recentRepos = mockRecentRepos,
  initialPath = '',
  initialSource = 'local',
}: NewProjectDialogProps): React.JSX.Element {
  // Form state
  const [sourceType, setSourceType] = useState<SourceType>(initialSource);
  const [name, setName] = useState('');
  const [path, setPath] = useState(initialPath);
  const [description, setDescription] = useState('');
  const [cloneUrl, setCloneUrl] = useState('');
  const [clonePath, setClonePath] = useState('~/git/');

  // Validation state
  const [pathStatus, setPathStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [pathMessage, setPathMessage] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [repoInfo, setRepoInfo] = useState<RepositoryInfo | null>(null);

  // Skills state
  const [skills, setSkills] = useState<SkillConfig[]>(defaultSkills);

  // Clone state
  const [isCloning, setIsCloning] = useState(false);
  const [cloneError, setCloneError] = useState('');

  // GitHub repos state
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [repoSearchTerm, setRepoSearchTerm] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [showManualUrl, setShowManualUrl] = useState(false);
  const [hasFetchedRepos, setHasFetchedRepos] = useState(false);

  // Handle Escape key explicitly for reliable dialog closing
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSourceType(initialSource);
      setName('');
      setPath(initialPath);
      setDescription('');
      setCloneUrl('');
      setClonePath('~/git/');
      setPathStatus('idle');
      setPathMessage('');
      setIsValidating(false);
      setRepoInfo(null);
      setSkills(defaultSkills);
      setIsCloning(false);
      setCloneError('');
      // Reset GitHub state
      setGithubRepos([]);
      setIsLoadingRepos(false);
      setRepoSearchTerm('');
      setSelectedRepo(null);
      setShowManualUrl(false);
      setHasFetchedRepos(false);
    }
  }, [open, initialPath, initialSource]);

  // Fetch GitHub repos when clone tab is selected
  const fetchGitHubRepos = useCallback(async () => {
    if (!onFetchUserRepos || !isGitHubConfigured || hasFetchedRepos) return;

    setIsLoadingRepos(true);
    try {
      const repos = await onFetchUserRepos();
      setGithubRepos(repos);
      setHasFetchedRepos(true);
    } catch {
      // Silently fail - user can still use manual URL entry
      setGithubRepos([]);
    } finally {
      setIsLoadingRepos(false);
    }
  }, [onFetchUserRepos, isGitHubConfigured, hasFetchedRepos]);

  // Fetch repos when switching to clone tab
  useEffect(() => {
    if (sourceType === 'clone' && isGitHubConfigured && !hasFetchedRepos) {
      void fetchGitHubRepos();
    }
  }, [sourceType, isGitHubConfigured, hasFetchedRepos, fetchGitHubRepos]);

  // Handle selecting a GitHub repo
  const handleSelectGitHubRepo = (repo: GitHubRepo): void => {
    setSelectedRepo(repo);
    setCloneUrl(repo.clone_url);
    setCloneError('');
  };

  // Validate path for local repos
  const validatePath = async (pathToValidate?: string): Promise<void> => {
    const targetPath = pathToValidate ?? path;
    if (!targetPath.trim()) {
      setPathStatus('idle');
      setPathMessage('');
      setRepoInfo(null);
      return;
    }

    setIsValidating(true);
    const result = await onValidatePath(targetPath.trim());
    setIsValidating(false);

    if (result.ok) {
      setPathStatus('valid');
      setPathMessage(
        result.value.defaultBranch ? `Default branch: ${result.value.defaultBranch}` : ''
      );
      setRepoInfo({
        name: result.value.name ?? targetPath.split('/').pop() ?? 'unknown',
        path: targetPath,
        isGitRepo: true,
        defaultBranch: result.value.defaultBranch,
        remoteUrl: result.value.remoteUrl,
        hasClaudeConfig: result.value.hasClaudeConfig,
      });
      if (!name.trim()) {
        setName(result.value.name ?? '');
      }
    } else {
      setPathStatus('invalid');
      setPathMessage('Path must point to a valid git repository.');
      setRepoInfo(null);
    }
  };

  // Handle recent repo selection
  const handleSelectRecent = (repoPath: string): void => {
    setPath(repoPath);
    setPathStatus('idle');
    setPathMessage('');
    void validatePath(repoPath);
  };

  // Handle clone URL validation
  const validateCloneUrl = (url: string): boolean => {
    const githubHttpsPattern = /^https:\/\/github\.com\/[\w-]+\/[\w.-]+(\.git)?$/;
    const githubSshPattern = /^git@github\.com:[\w-]+\/[\w.-]+(\.git)?$/;
    return githubHttpsPattern.test(url) || githubSshPattern.test(url);
  };

  // Toggle skill
  const handleToggleSkill = (skillId: string): void => {
    setSkills((prev) =>
      prev.map((skill) => (skill.id === skillId ? { ...skill, enabled: !skill.enabled } : skill))
    );
  };

  // Handle form submission
  const handleSubmit = async (): Promise<void> => {
    if (sourceType === 'clone' && onClone) {
      setIsCloning(true);
      setCloneError('');

      const cloneResult = await onClone(cloneUrl, clonePath);

      if (!cloneResult.ok) {
        setIsCloning(false);
        setCloneError('Failed to clone repository. Please check the URL and try again.');
        return;
      }

      // After successful clone, create project with cloned path
      await onSubmit({
        name: cloneUrl.split('/').pop()?.replace('.git', '') ?? 'project',
        path: cloneResult.value.path,
        description: description.trim() || undefined,
      });
      setIsCloning(false);
    } else {
      await onSubmit({
        name: name.trim(),
        path: path.trim(),
        description: description.trim() || undefined,
      });
    }
    onOpenChange(false);
  };

  // Check if form is submittable
  const canSubmit =
    sourceType === 'local'
      ? name.trim() && pathStatus === 'valid'
      : cloneUrl.trim() && validateCloneUrl(cloneUrl) && clonePath.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" data-testid="new-project-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderSimple className="h-5 w-5 text-fg-muted" />
            Add Repository
          </DialogTitle>
          <DialogDescription>
            Connect a local repository or clone from GitHub to start using AgentPane.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={sourceType}
          onValueChange={(v) => setSourceType(v as SourceType)}
          className="mt-4"
        >
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="local" className="flex-1 gap-2">
              <FolderSimple className="h-4 w-4" />
              Local Repository
            </TabsTrigger>
            <TabsTrigger value="clone" className="flex-1 gap-2">
              <GithubLogo className="h-4 w-4" />
              Clone from URL
            </TabsTrigger>
          </TabsList>

          {/* Local Repository Tab */}
          <TabsContent value="local" className="space-y-4">
            <div className="space-y-2">
              <label
                className="text-xs font-medium uppercase tracking-wide text-fg-muted"
                htmlFor="project-path"
              >
                Repository Path
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <TextInput
                    id="project-path"
                    value={path}
                    placeholder="/Users/name/workspace/repo"
                    className="font-mono"
                    onChange={(event) => {
                      setPath(event.target.value);
                      setPathStatus('idle');
                      setPathMessage('');
                      setRepoInfo(null);
                    }}
                    onBlur={() => void validatePath()}
                    data-testid="project-path-input"
                  />
                  {pathStatus !== 'idle' && !isValidating && (
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                      {pathStatus === 'valid' ? (
                        <CheckCircle
                          className="h-4 w-4 text-success"
                          weight="fill"
                          data-testid="validation-success"
                        />
                      ) : (
                        <WarningCircle
                          className="h-4 w-4 text-danger"
                          weight="fill"
                          data-testid="validation-error"
                        />
                      )}
                    </div>
                  )}
                  {isValidating && (
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                      <Spinner className="h-4 w-4 animate-spin text-fg-muted" />
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => void validatePath()}
                  disabled={!path.trim() || isValidating}
                  data-testid="validate-path-button"
                >
                  Validate
                </Button>
              </div>
              {!isValidating && pathMessage && (
                <p
                  className={cn(
                    'text-xs',
                    pathStatus === 'valid' ? 'text-fg-muted' : 'text-danger'
                  )}
                  data-testid="validation-result"
                >
                  {pathMessage}
                </p>
              )}
            </div>

            {/* Repo Info Card */}
            <RepoInfoCard
              repoInfo={repoInfo}
              status={
                pathStatus === 'valid' ? 'valid' : pathStatus === 'invalid' ? 'invalid' : 'idle'
              }
              isValidating={isValidating}
            />

            {/* Recent Repos */}
            {recentRepos.length > 0 && (
              <>
                <Divider text="or select recent" />
                <RecentRepoList repos={recentRepos} onSelect={handleSelectRecent} />
              </>
            )}

            {/* Project Name (only shown after valid path) */}
            {pathStatus === 'valid' && (
              <div className="space-y-2">
                <label
                  className="text-xs font-medium uppercase tracking-wide text-fg-muted"
                  htmlFor="project-name"
                >
                  Project name
                </label>
                <TextInput
                  id="project-name"
                  value={name}
                  placeholder="AgentPane"
                  onChange={(event) => setName(event.target.value)}
                  data-testid="project-name-input"
                />
              </div>
            )}

            {/* Description (only shown after valid path) */}
            {pathStatus === 'valid' && (
              <div className="space-y-2">
                <label
                  className="text-xs font-medium uppercase tracking-wide text-fg-muted"
                  htmlFor="project-description"
                >
                  Description <span className="text-fg-subtle">(optional)</span>
                </label>
                <Textarea
                  id="project-description"
                  value={description}
                  placeholder="Short summary or goal."
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                />
              </div>
            )}

            {/* Skills Section (only shown after valid path) */}
            {pathStatus === 'valid' && (
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium uppercase tracking-wide text-fg-muted">
                  Project Skills
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {skills.map((skill) => (
                    <SkillCard key={skill.id} skill={skill} onToggle={handleToggleSkill} />
                  ))}
                </div>
              </fieldset>
            )}
          </TabsContent>

          {/* Clone Tab */}
          <TabsContent value="clone" className="space-y-4">
            {/* GitHub Repository Browser (when GitHub is configured) */}
            {isGitHubConfigured && !showManualUrl && (
              <>
                <GitHubRepoList
                  repos={githubRepos}
                  isLoading={isLoadingRepos}
                  searchTerm={repoSearchTerm}
                  onSearchChange={setRepoSearchTerm}
                  onSelect={handleSelectGitHubRepo}
                  selectedRepoId={selectedRepo?.id}
                />

                <Divider text="or enter URL manually" />

                <button
                  type="button"
                  onClick={() => setShowManualUrl(true)}
                  className="w-full text-center text-sm text-fg-muted hover:text-fg transition-colors"
                  data-testid="show-manual-url-button"
                >
                  Enter a repository URL manually
                </button>
              </>
            )}

            {/* Manual URL Input (when GitHub is not configured, or user chooses to enter manually) */}
            {(!isGitHubConfigured || showManualUrl) && (
              <>
                {showManualUrl && isGitHubConfigured && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowManualUrl(false);
                      setCloneUrl(selectedRepo?.clone_url ?? '');
                    }}
                    className="text-sm text-accent hover:text-accent/80 transition-colors"
                    data-testid="back-to-repo-list-button"
                  >
                    ← Back to repository list
                  </button>
                )}

                <div className="space-y-2">
                  <label
                    className="text-xs font-medium uppercase tracking-wide text-fg-muted"
                    htmlFor="clone-url"
                  >
                    Repository URL
                  </label>
                  <div className="relative">
                    <GithubLogo className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
                    <TextInput
                      id="clone-url"
                      value={cloneUrl}
                      placeholder="https://github.com/owner/repo"
                      className="pl-10"
                      onChange={(event) => {
                        setCloneUrl(event.target.value);
                        setCloneError('');
                        setSelectedRepo(null);
                      }}
                      data-testid="clone-url-input"
                    />
                    {cloneUrl && (
                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                        {validateCloneUrl(cloneUrl) ? (
                          <CheckCircle className="h-4 w-4 text-success" weight="fill" />
                        ) : (
                          <WarningCircle className="h-4 w-4 text-danger" weight="fill" />
                        )}
                      </div>
                    )}
                  </div>
                  {cloneUrl && !validateCloneUrl(cloneUrl) && (
                    <p className="text-xs text-danger">
                      Please enter a valid GitHub repository URL
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Clone path (always shown) */}
            <div className="space-y-2">
              <label
                className="text-xs font-medium uppercase tracking-wide text-fg-muted"
                htmlFor="clone-path"
              >
                Clone to
              </label>
              <div className="flex gap-2">
                <TextInput
                  id="clone-path"
                  value={clonePath}
                  placeholder="~/git/"
                  className="flex-1 font-mono"
                  onChange={(event) => setClonePath(event.target.value)}
                  data-testid="clone-path-input"
                />
                <Button variant="outline" type="button">
                  Browse...
                </Button>
              </div>
            </div>

            {cloneError && (
              <div className="rounded-[var(--radius)] border border-danger/40 bg-danger-muted p-3 text-sm text-danger">
                {cloneError}
              </div>
            )}

            {/* Description for clone */}
            <div className="space-y-2">
              <label
                className="text-xs font-medium uppercase tracking-wide text-fg-muted"
                htmlFor="clone-description"
              >
                Description <span className="text-fg-subtle">(optional)</span>
              </label>
              <Textarea
                id="clone-description"
                value={description}
                placeholder="Short summary or goal."
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || isCloning}
            data-testid="create-project-button"
          >
            {isCloning ? (
              <>
                <Spinner className="h-4 w-4 animate-spin" />
                Cloning...
              </>
            ) : (
              <>
                <FolderSimple className="h-4 w-4" />
                Add Repository
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
