interface ProjectGroup {
  name: string;
  path: string;
  sessionCount: number;
}

const gradients = [
  'from-accent to-[#a371f7]',
  'from-success to-attention',
  'from-[#f778ba] to-danger',
  'from-accent to-success',
  'from-attention to-[#a371f7]',
];

export function TimelineLabels({ groups }: { groups: ProjectGroup[] }) {
  return (
    <div className="w-[200px] shrink-0 border-r border-border flex flex-col">
      <div className="h-9 flex items-center px-4 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle border-b border-border bg-default shrink-0">
        Projects
      </div>
      {groups.map((group, i) => {
        const initials = group.name
          .split(/[\s-_]+/)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() ?? '')
          .join('');
        const gradient = gradients[i % gradients.length];

        return (
          <div
            key={group.name}
            className="h-[88px] flex items-center gap-3 px-4 border-b border-border bg-default transition-colors hover:bg-subtle"
          >
            <div
              className={`h-7 w-7 rounded flex items-center justify-center text-[10px] font-semibold text-white bg-gradient-to-br ${gradient} shrink-0`}
            >
              {initials}
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[13px] font-semibold text-fg truncate">{group.name}</span>
              <span className="text-[11px] font-mono text-fg-subtle truncate">{group.path}</span>
              <span className="text-[11px] text-fg-muted">
                {group.sessionCount} session{group.sessionCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type { ProjectGroup };
