import {
  Check,
  CircleNotch,
  Cpu,
  Cube,
  FolderOpen,
  HardDrive,
  Package,
  Pencil,
  Plus,
  Timer,
  Trash,
  TreeStructure,
  Warning,
  X,
} from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import {
  apiClient,
  type CreateSandboxConfigInput,
  type SandboxConfigItem,
  type UpdateSandboxConfigInput,
} from '@/lib/api/client';

export const Route = createFileRoute('/settings/sandbox')({
  component: SandboxSettingsPage,
});

type EditorMode = 'create' | 'edit' | null;
type ActiveTab = 'providers' | 'profiles';

function SandboxSettingsPage(): React.JSX.Element {
  const [configs, setConfigs] = useState<SandboxConfigItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('providers');

  // Editor state
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [editingConfig, setEditingConfig] = useState<SandboxConfigItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<'docker' | 'devcontainer'>('docker');
  const [formBaseImage, setFormBaseImage] = useState('node:22-slim');
  const [formMemoryMb, setFormMemoryMb] = useState(4096);
  const [formCpuCores, setFormCpuCores] = useState(2.0);
  const [formMaxProcesses, setFormMaxProcesses] = useState(256);
  const [formTimeoutMinutes, setFormTimeoutMinutes] = useState(60);
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formVolumeMountPath, setFormVolumeMountPath] = useState('');

  const loadConfigs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiClient.sandboxConfigs.list();
      if (result.ok) {
        setConfigs(result.data.items);
      } else {
        setError(result.error.message);
      }
    } catch (_err) {
      setError('Failed to load sandbox configurations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormType('docker');
    setFormBaseImage('node:22-slim');
    setFormMemoryMb(4096);
    setFormCpuCores(2.0);
    setFormMaxProcesses(256);
    setFormTimeoutMinutes(60);
    setFormIsDefault(false);
    setFormVolumeMountPath('');
    setSaveError(null);
  };

  const openCreateEditor = () => {
    resetForm();
    setEditorMode('create');
    setEditingConfig(null);
  };

  const openEditEditor = (config: SandboxConfigItem) => {
    setFormName(config.name);
    setFormDescription(config.description ?? '');
    setFormType(config.type ?? 'docker');
    setFormBaseImage(config.baseImage);
    setFormMemoryMb(config.memoryMb);
    setFormCpuCores(config.cpuCores);
    setFormMaxProcesses(config.maxProcesses);
    setFormTimeoutMinutes(config.timeoutMinutes);
    setFormIsDefault(config.isDefault);
    setFormVolumeMountPath(config.volumeMountPath ?? '');
    setSaveError(null);
    setEditorMode('edit');
    setEditingConfig(config);
  };

  const closeEditor = () => {
    setEditorMode(null);
    setEditingConfig(null);
    resetForm();
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setSaveError('Name is required');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      if (editorMode === 'create') {
        const input: CreateSandboxConfigInput = {
          name: formName,
          description: formDescription || undefined,
          type: formType,
          baseImage: formBaseImage,
          memoryMb: formMemoryMb,
          cpuCores: formCpuCores,
          maxProcesses: formMaxProcesses,
          timeoutMinutes: formTimeoutMinutes,
          isDefault: formIsDefault,
          volumeMountPath: formVolumeMountPath || undefined,
        };
        const result = await apiClient.sandboxConfigs.create(input);
        if (!result.ok) {
          setSaveError(result.error.message);
          return;
        }
      } else if (editorMode === 'edit' && editingConfig) {
        const input: UpdateSandboxConfigInput = {
          name: formName,
          description: formDescription || undefined,
          type: formType,
          baseImage: formBaseImage,
          memoryMb: formMemoryMb,
          cpuCores: formCpuCores,
          maxProcesses: formMaxProcesses,
          timeoutMinutes: formTimeoutMinutes,
          isDefault: formIsDefault,
          volumeMountPath: formVolumeMountPath || undefined,
        };
        const result = await apiClient.sandboxConfigs.update(editingConfig.id, input);
        if (!result.ok) {
          setSaveError(result.error.message);
          return;
        }
      }

      closeEditor();
      await loadConfigs();
    } catch (_err) {
      setSaveError('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (config: SandboxConfigItem) => {
    if (!confirm(`Delete sandbox configuration "${config.name}"?`)) {
      return;
    }

    try {
      const result = await apiClient.sandboxConfigs.delete(config.id);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      await loadConfigs();
    } catch (_err) {
      setError('Failed to delete configuration');
    }
  };

  return (
    <div data-testid="sandbox-settings" className="mx-auto max-w-4xl px-8 py-8">
      {/* Page Header */}
      <header className="mb-6">
        <h1 className="flex items-center gap-3 text-2xl font-semibold text-fg">
          <Package className="h-7 w-7 text-fg-muted" />
          Sandbox Configuration
        </h1>
        <p className="mt-2 text-fg-muted">
          Configure sandbox providers and resource profiles for agent execution environments.
        </p>
      </header>

      {/* Tab Navigation */}
      <nav className="mb-6 inline-flex rounded-lg border border-border bg-surface p-1">
        <button
          type="button"
          onClick={() => setActiveTab('providers')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'providers'
              ? 'bg-surface-muted text-fg shadow-sm'
              : 'text-fg-muted hover:bg-surface-subtle hover:text-fg'
          }`}
        >
          <Cube className="h-4 w-4" />
          Providers
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('profiles')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'profiles'
              ? 'bg-surface-muted text-fg shadow-sm'
              : 'text-fg-muted hover:bg-surface-subtle hover:text-fg'
          }`}
        >
          <Cpu className="h-4 w-4" />
          Resource Profiles
          {configs.length > 0 && (
            <span className="rounded-full bg-accent-muted px-2 py-0.5 text-xs font-medium text-accent">
              {configs.length}
            </span>
          )}
        </button>
      </nav>

      {/* Error display */}
      {error && (
        <div className="mb-6 rounded-lg border border-danger/30 bg-danger-muted/30 p-4">
          <p className="flex items-center gap-2 text-sm text-danger">
            <Warning className="h-4 w-4" />
            {error}
          </p>
        </div>
      )}

      {/* Providers Tab */}
      {activeTab === 'providers' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-5 py-4">
              <h2 className="flex items-center gap-2 font-semibold text-fg">
                <Cube className="h-4 w-4 text-fg-muted" />
                Sandbox Provider
              </h2>
              <p className="mt-1 text-sm text-fg-muted">Choose where agent code executes</p>
            </div>
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              {/* Docker Provider - Active */}
              <div className="relative cursor-pointer rounded-lg border-2 border-accent bg-accent-muted/30 p-5 transition-colors">
                <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent">
                  <Check className="h-3 w-3 text-white" weight="bold" />
                </div>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-muted text-2xl">
                  🐳
                </div>
                <h3 className="font-semibold text-fg">Docker</h3>
                <p className="mt-1 text-sm text-fg-muted">
                  Local container isolation. Best for development.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs text-fg-muted">
                    Network Isolation
                  </span>
                  <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs text-fg-muted">
                    Resource Limits
                  </span>
                </div>
              </div>

              {/* Kubernetes Provider - Coming Soon */}
              <div className="relative cursor-not-allowed rounded-lg border border-border bg-surface-subtle/50 p-5 opacity-60">
                <div className="absolute right-3 top-3">
                  <span className="rounded-full bg-warning-muted px-2 py-0.5 text-xs font-medium text-warning">
                    Coming Soon
                  </span>
                </div>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-muted text-2xl">
                  ☸️
                </div>
                <h3 className="font-semibold text-fg">Kubernetes</h3>
                <p className="mt-1 text-sm text-fg-muted">
                  Local K8s via minikube/kind. Production-like isolation.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-success-muted px-2.5 py-1 text-xs text-success">
                    Network Policies
                  </span>
                  <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs text-fg-muted">
                    Warm Pool
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resource Profiles Tab */}
      {activeTab === 'profiles' && (
        <div className="space-y-6">
          {/* Action bar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-fg-muted">
              {configs.length} profile{configs.length !== 1 ? 's' : ''}
            </p>
            <Button data-testid="create-sandbox-config" onClick={openCreateEditor}>
              <Plus className="h-4 w-4" />
              New Profile
            </Button>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <CircleNotch className="h-8 w-8 animate-spin text-fg-muted" />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && configs.length === 0 && (
            <div className="rounded-lg border border-border bg-surface p-12 text-center">
              <Package className="mx-auto h-12 w-12 text-fg-subtle" />
              <h3 className="mt-4 text-lg font-medium text-fg">No resource profiles</h3>
              <p className="mt-2 text-sm text-fg-muted">
                Create a profile to define resource limits for agent sandboxes.
              </p>
              <Button className="mt-6" onClick={openCreateEditor}>
                <Plus className="h-4 w-4" />
                Create Profile
              </Button>
            </div>
          )}

          {/* Config list */}
          {!isLoading && configs.length > 0 && (
            <div className="space-y-4">
              {configs.map((config) => (
                <div
                  key={config.id}
                  data-testid={`sandbox-config-${config.id}`}
                  className="rounded-lg border border-border bg-surface"
                >
                  <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-muted">
                      <Package className="h-4 w-4 text-accent" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-fg">{config.name}</h2>
                        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-fg-muted">
                          {config.type === 'devcontainer' ? '📦 DevContainer' : '🐳 Docker'}
                        </span>
                        {config.isDefault && (
                          <span className="rounded-full bg-success-muted px-2 py-0.5 text-xs font-medium text-success">
                            Default
                          </span>
                        )}
                      </div>
                      {config.description && (
                        <p className="text-xs text-fg-muted">{config.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditEditor(config)}
                        data-testid={`edit-sandbox-config-${config.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(config)}
                        data-testid={`delete-sandbox-config-${config.id}`}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Resource Grid - matching wireframe style */}
                  <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
                    <div className="rounded-lg bg-surface-subtle p-4">
                      <div className="flex items-center gap-2 text-xs text-fg-muted">
                        <HardDrive className="h-3.5 w-3.5" />
                        Memory
                      </div>
                      <div className="mt-2 font-mono text-xl font-semibold text-fg">
                        {config.memoryMb}
                        <span className="ml-1 text-sm font-normal text-fg-muted">MB</span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-surface-subtle p-4">
                      <div className="flex items-center gap-2 text-xs text-fg-muted">
                        <Cpu className="h-3.5 w-3.5" />
                        CPU Cores
                      </div>
                      <div className="mt-2 font-mono text-xl font-semibold text-fg">
                        {config.cpuCores}
                        <span className="ml-1 text-sm font-normal text-fg-muted">cores</span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-surface-subtle p-4">
                      <div className="flex items-center gap-2 text-xs text-fg-muted">
                        <TreeStructure className="h-3.5 w-3.5" />
                        Max Processes
                      </div>
                      <div className="mt-2 font-mono text-xl font-semibold text-fg">
                        {config.maxProcesses}
                        <span className="ml-1 text-sm font-normal text-fg-muted">PIDs</span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-surface-subtle p-4">
                      <div className="flex items-center gap-2 text-xs text-fg-muted">
                        <Timer className="h-3.5 w-3.5" />
                        Timeout
                      </div>
                      <div className="mt-2 font-mono text-xl font-semibold text-fg">
                        {config.timeoutMinutes}
                        <span className="ml-1 text-sm font-normal text-fg-muted">min</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border px-5 py-3">
                    <p className="font-mono text-xs text-fg-muted">Image: {config.baseImage}</p>
                    {config.volumeMountPath && (
                      <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-fg-muted">
                        <FolderOpen className="h-3 w-3" />
                        Mount: {config.volumeMountPath}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Editor modal */}
      {editorMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-fg">
                {editorMode === 'create' ? 'New Sandbox Configuration' : 'Edit Configuration'}
              </h2>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-md p-1 text-fg-muted hover:bg-surface-subtle hover:text-fg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-6">
              <div className="space-y-5">
                {/* Name */}
                <div>
                  <label
                    htmlFor="sandbox-name"
                    className="mb-1.5 block text-sm font-medium text-fg"
                  >
                    Name
                  </label>
                  <input
                    id="sandbox-name"
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., High Performance"
                    className="w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    data-testid="sandbox-config-name-input"
                  />
                </div>

                {/* Description */}
                <div>
                  <label
                    htmlFor="sandbox-description"
                    className="mb-1.5 block text-sm font-medium text-fg"
                  >
                    Description
                    <span className="ml-1 text-xs font-normal text-fg-subtle">(optional)</span>
                  </label>
                  <textarea
                    id="sandbox-description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Configuration for compute-intensive tasks"
                    rows={2}
                    className="w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                {/* Sandbox Type */}
                <div>
                  <span className="mb-1.5 block text-sm font-medium text-fg">Sandbox Type</span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormType('docker')}
                      className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors ${
                        formType === 'docker'
                          ? 'border-accent bg-accent-muted/30'
                          : 'border-border hover:border-fg-subtle'
                      }`}
                      data-testid="sandbox-type-docker"
                    >
                      <span className="text-xl">🐳</span>
                      <div>
                        <div className="font-medium text-fg">Docker</div>
                        <div className="text-xs text-fg-muted">Container isolation</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType('devcontainer')}
                      className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors ${
                        formType === 'devcontainer'
                          ? 'border-accent bg-accent-muted/30'
                          : 'border-border hover:border-fg-subtle'
                      }`}
                      data-testid="sandbox-type-devcontainer"
                    >
                      <span className="text-xl">📦</span>
                      <div>
                        <div className="font-medium text-fg">DevContainer</div>
                        <div className="text-xs text-fg-muted">VS Code integration</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Base Image */}
                <div>
                  <label
                    htmlFor="sandbox-image"
                    className="mb-1.5 block text-sm font-medium text-fg"
                  >
                    Base Image
                  </label>
                  <input
                    id="sandbox-image"
                    type="text"
                    value={formBaseImage}
                    onChange={(e) => setFormBaseImage(e.target.value)}
                    placeholder="node:22-slim"
                    className="w-full rounded-md border border-border bg-surface-subtle px-3 py-2 font-mono text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    data-testid="sandbox-config-image-input"
                  />
                </div>

                {/* Volume Mount Path - Docker only */}
                {formType === 'docker' && (
                  <div>
                    <label
                      htmlFor="sandbox-volume-mount"
                      className="mb-1.5 block text-sm font-medium text-fg"
                    >
                      Volume Mount Path
                      <span className="ml-1 text-xs font-normal text-fg-subtle">(optional)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-fg-muted" />
                      <input
                        id="sandbox-volume-mount"
                        type="text"
                        value={formVolumeMountPath}
                        onChange={(e) => setFormVolumeMountPath(e.target.value)}
                        placeholder="/home/user/projects"
                        className="flex-1 rounded-md border border-border bg-surface-subtle px-3 py-2 font-mono text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                        data-testid="sandbox-config-volume-mount-input"
                      />
                    </div>
                    <p className="mt-1 text-xs text-fg-muted">
                      Local host directory to mount into the container
                    </p>
                  </div>
                )}

                {/* Memory */}
                <div>
                  <label
                    htmlFor="sandbox-memory"
                    className="mb-1.5 flex items-center justify-between text-sm font-medium text-fg"
                  >
                    <span>Memory (MB)</span>
                    <span className="font-mono text-xs text-fg-muted">{formMemoryMb} MB</span>
                  </label>
                  <input
                    id="sandbox-memory"
                    type="range"
                    min={512}
                    max={16384}
                    step={512}
                    value={formMemoryMb}
                    onChange={(e) => setFormMemoryMb(Number(e.target.value))}
                    className="w-full accent-accent"
                    data-testid="sandbox-config-memory-slider"
                  />
                  <div className="mt-1 flex justify-between text-xs text-fg-subtle">
                    <span>512 MB</span>
                    <span>16 GB</span>
                  </div>
                </div>

                {/* CPU */}
                <div>
                  <label
                    htmlFor="sandbox-cpu"
                    className="mb-1.5 flex items-center justify-between text-sm font-medium text-fg"
                  >
                    <span>CPU Cores</span>
                    <span className="font-mono text-xs text-fg-muted">{formCpuCores} cores</span>
                  </label>
                  <input
                    id="sandbox-cpu"
                    type="range"
                    min={0.5}
                    max={8}
                    step={0.5}
                    value={formCpuCores}
                    onChange={(e) => setFormCpuCores(Number(e.target.value))}
                    className="w-full accent-accent"
                    data-testid="sandbox-config-cpu-slider"
                  />
                  <div className="mt-1 flex justify-between text-xs text-fg-subtle">
                    <span>0.5</span>
                    <span>8</span>
                  </div>
                </div>

                {/* Max Processes */}
                <div>
                  <label
                    htmlFor="sandbox-processes"
                    className="mb-1.5 flex items-center justify-between text-sm font-medium text-fg"
                  >
                    <span>Max Processes (PIDs)</span>
                    <span className="font-mono text-xs text-fg-muted">{formMaxProcesses}</span>
                  </label>
                  <input
                    id="sandbox-processes"
                    type="range"
                    min={32}
                    max={1024}
                    step={32}
                    value={formMaxProcesses}
                    onChange={(e) => setFormMaxProcesses(Number(e.target.value))}
                    className="w-full accent-accent"
                    data-testid="sandbox-config-processes-slider"
                  />
                  <div className="mt-1 flex justify-between text-xs text-fg-subtle">
                    <span>32</span>
                    <span>1024</span>
                  </div>
                </div>

                {/* Timeout */}
                <div>
                  <label
                    htmlFor="sandbox-timeout"
                    className="mb-1.5 flex items-center justify-between text-sm font-medium text-fg"
                  >
                    <span>Timeout (minutes)</span>
                    <span className="font-mono text-xs text-fg-muted">
                      {formTimeoutMinutes} min
                    </span>
                  </label>
                  <input
                    id="sandbox-timeout"
                    type="range"
                    min={5}
                    max={1440}
                    step={5}
                    value={formTimeoutMinutes}
                    onChange={(e) => setFormTimeoutMinutes(Number(e.target.value))}
                    className="w-full accent-accent"
                    data-testid="sandbox-config-timeout-slider"
                  />
                  <div className="mt-1 flex justify-between text-xs text-fg-subtle">
                    <span>5 min</span>
                    <span>24 hrs</span>
                  </div>
                </div>

                {/* Default toggle */}
                <div className="flex items-center justify-between rounded-md border border-border bg-surface-subtle px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-fg">Set as default</p>
                    <p className="text-xs text-fg-muted">
                      Used when no specific configuration is selected
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formIsDefault}
                    onClick={() => setFormIsDefault(!formIsDefault)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      formIsDefault ? 'bg-accent' : 'bg-surface-muted'
                    }`}
                    data-testid="sandbox-config-default-toggle"
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                        formIsDefault ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Error display */}
                {saveError && (
                  <div className="rounded-md border border-danger/30 bg-danger-muted/30 p-3">
                    <p className="flex items-center gap-2 text-sm text-danger">
                      <Warning className="h-4 w-4" />
                      {saveError}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <Button variant="outline" onClick={closeEditor}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving} data-testid="save-sandbox-config">
                {isSaving ? (
                  <>
                    <CircleNotch className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {editorMode === 'create' ? 'Create' : 'Save Changes'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
