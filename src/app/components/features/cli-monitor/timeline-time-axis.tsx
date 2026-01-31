import { useMemo } from 'react';

type TimeRange = '1h' | '3h' | '12h' | '24h';

const RANGE_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '3h': 3 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

const TICK_INTERVALS: Record<TimeRange, number> = {
  '1h': 5 * 60 * 1000, // 5 min
  '3h': 15 * 60 * 1000, // 15 min
  '12h': 60 * 60 * 1000, // 1 hour
  '24h': 2 * 60 * 60 * 1000, // 2 hours
};

function formatTick(ts: number, range: TimeRange): string {
  const d = new Date(ts);
  if (range === '24h') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function useTimelineCalculations(timeRange: TimeRange) {
  const now = Date.now();
  const rangeMs = RANGE_MS[timeRange];
  const startTime = now - rangeMs;
  const endTime = now;

  const toPercent = (ts: number) => {
    return ((ts - startTime) / rangeMs) * 100;
  };

  return { startTime, endTime, rangeMs, toPercent, now };
}

interface TimelineTimeAxisProps {
  timeRange: TimeRange;
  nowPercent: number;
}

export function TimelineTimeAxis({ timeRange, nowPercent }: TimelineTimeAxisProps) {
  const rangeMs = RANGE_MS[timeRange];
  const tickInterval = TICK_INTERVALS[timeRange];
  const now = Date.now();
  const startTime = now - rangeMs;

  const ticks = useMemo(() => {
    const result: { label: string; percent: number }[] = [];
    // Align first tick to the interval
    const firstTick = Math.ceil(startTime / tickInterval) * tickInterval;
    for (let ts = firstTick; ts <= now; ts += tickInterval) {
      const pct = ((ts - startTime) / rangeMs) * 100;
      result.push({ label: formatTick(ts, timeRange), percent: pct });
    }
    return result;
  }, [startTime, now, rangeMs, tickInterval, timeRange]);

  return (
    <div className="relative h-9 bg-default border-b border-border sticky top-0 z-10 shrink-0">
      {ticks.map((tick) => (
        <div
          key={tick.percent}
          className="absolute top-0 bottom-0 flex items-center justify-center"
          style={{ left: `${tick.percent}%` }}
        >
          <span className="text-[11px] font-mono font-medium text-fg-subtle">{tick.label}</span>
          <div className="absolute bottom-0 w-px h-1.5 bg-fg-subtle opacity-30" />
        </div>
      ))}
      {/* Grid lines */}
      {ticks.map((tick) => (
        <div
          key={`grid-${tick.percent}`}
          className="absolute top-9 bottom-0 w-px bg-border opacity-30 pointer-events-none"
          style={{ left: `${tick.percent}%` }}
        />
      ))}
      {/* NOW line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-danger z-20 animate-[nowLinePulse_2s_ease-in-out_infinite]"
        style={{ left: `${Math.min(nowPercent, 99.5)}%` }}
      >
        <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 rounded bg-danger px-1.5 py-px text-[9px] font-bold text-white tracking-wide whitespace-nowrap shadow-sm">
          NOW
        </span>
      </div>
    </div>
  );
}

export type { TimeRange };
