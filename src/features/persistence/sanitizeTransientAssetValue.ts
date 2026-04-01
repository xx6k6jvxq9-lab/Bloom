export function sanitizeTransientAssetValue(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  // blob: URLs are temporary and should never be persisted as durable asset values.
  if (/^blob:/i.test(trimmed)) {
    return '';
  }

  return trimmed;
}
