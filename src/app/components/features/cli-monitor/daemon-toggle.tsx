export function DaemonToggle({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-fg-muted">Daemon</span>
      <div
        className={`relative h-[22px] w-10 rounded-full transition-colors ${
          connected ? 'bg-success' : 'bg-emphasis'
        }`}
      >
        <div
          className={`absolute top-[3px] left-[3px] h-4 w-4 rounded-full bg-white transition-transform ${
            connected ? 'translate-x-[18px]' : ''
          }`}
        />
      </div>
    </div>
  );
}
