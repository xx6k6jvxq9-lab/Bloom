export const DIRECT_MEMORY_LIMIT_MIN = 4;
export const DIRECT_MEMORY_LIMIT_DEFAULT = 20;
export const DIRECT_MEMORY_LIMIT_MAX = 50;

export function clampDirectMemoryLimit(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return DIRECT_MEMORY_LIMIT_DEFAULT;
  }

  return Math.min(
    DIRECT_MEMORY_LIMIT_MAX,
    Math.max(DIRECT_MEMORY_LIMIT_MIN, Math.floor(numericValue)),
  );
}

export function getDirectMemoryMessageLimit(value: unknown): number {
  return clampDirectMemoryLimit(value);
}
