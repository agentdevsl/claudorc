declare const PKG_VERSION: string | undefined;

export const VERSION =
  (typeof PKG_VERSION !== 'undefined' ? PKG_VERSION : undefined) ?? '0.0.0-dev';
