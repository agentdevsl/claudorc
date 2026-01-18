import { Check, Copy, Eye, Users } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import type { PresenceUser } from '@/app/hooks/use-presence';
import { cn } from '@/lib/utils/cn';

interface PresenceBarProps {
  users: PresenceUser[];
  shareUrl: string;
}

// Generate consistent color from user ID
function getUserColor(userId: string): string {
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-pink-500',
  ];

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length] ?? 'bg-blue-500';
}

function getInitials(userId: string): string {
  // If it looks like a name, get initials
  if (userId.includes(' ')) {
    const parts = userId.split(' ');
    const firstPart = parts[0] || '';
    const secondPart = parts[1] || '';
    return ((firstPart[0] || '') + (secondPart[0] || '')).toUpperCase();
  }
  // Otherwise use first two characters
  return userId.slice(0, 2).toUpperCase();
}

interface AvatarProps {
  userId: string;
  isOnline?: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

function Avatar({
  userId,
  isOnline = true,
  size = 'default',
  className,
}: AvatarProps): React.JSX.Element {
  const sizeClasses = size === 'sm' ? 'h-6 w-6 text-xs' : 'h-8 w-8 text-sm';
  const dotSizeClasses = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'relative flex items-center justify-center rounded-full font-medium text-white transition-transform hover:-translate-y-0.5 hover:z-10',
            sizeClasses,
            getUserColor(userId),
            className
          )}
        >
          {getInitials(userId)}
          {isOnline && (
            <span
              className={cn(
                'absolute -bottom-0.5 -right-0.5 rounded-full bg-success ring-2 ring-surface',
                dotSizeClasses
              )}
            />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>{userId}</TooltipContent>
    </Tooltip>
  );
}

export function PresenceBar({ users, shareUrl }: PresenceBarProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const visibleUsers = users.slice(0, 5);
  const overflowCount = users.length - 5;
  const now = Date.now();
  const STALE_THRESHOLD = 30000; // 30 seconds

  return (
    <div className="flex items-center justify-between border-b border-border bg-surface-subtle px-6 py-2">
      {/* Left side - User avatars */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-sm text-fg-muted">
          <Users className="h-4 w-4" weight="bold" />
          <span>{users.length}</span>
        </div>

        {/* Avatar stack */}
        <div className="flex items-center -space-x-2">
          {visibleUsers.map((user) => (
            <Avatar
              key={user.userId}
              userId={user.userId}
              isOnline={now - user.lastSeen < STALE_THRESHOLD}
              className="ring-2 ring-surface-subtle"
            />
          ))}
          {overflowCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-subtle text-xs font-medium text-fg-muted ring-2 ring-surface-subtle">
                  +{overflowCount}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {users
                  .slice(5)
                  .map((u) => u.userId)
                  .join(', ')}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {users.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-fg-muted">
            <Eye className="h-3.5 w-3.5" />
            <span>{users.length} watching</span>
          </div>
        )}
      </div>

      {/* Right side - Share URL */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-fg-muted">Share</span>
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1">
          <span className="max-w-[200px] truncate font-mono text-xs text-accent">{shareUrl}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyUrl}>
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-success" weight="bold" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{copied ? 'Copied!' : 'Copy URL'}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
