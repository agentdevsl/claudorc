/** Inline SVG provider icons for terraform module nodes (12x12 viewBox, currentColor). */

export function AwsIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 1.5L2 4.5V7.5L6 10.5L10 7.5V4.5L6 1.5Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 6.5C4 5 5 4 6.5 4C8 4 8.5 5.5 8 7"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AzureIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 10L6 2L7.5 6L11 5.5L3 10Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M1 10H9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

export function GcpIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 1.5L10.5 4V8L6 10.5L1.5 8V4L6 1.5Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function GenericCloudIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 9C1.5 9 1 7.5 2 6.5C1.5 5 3 3.5 4.5 4C5.5 2.5 7.5 2.5 8.5 4C10 3.5 11 5 10 6.5C11 7.5 10.5 9 9 9H3Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProviderIcon({
  provider,
  className,
}: {
  provider: string;
  className?: string;
}): React.JSX.Element {
  switch (provider) {
    case 'aws':
      return <AwsIcon className={className} />;
    case 'azure':
      return <AzureIcon className={className} />;
    case 'gcp':
      return <GcpIcon className={className} />;
    default:
      return <GenericCloudIcon className={className} />;
  }
}
