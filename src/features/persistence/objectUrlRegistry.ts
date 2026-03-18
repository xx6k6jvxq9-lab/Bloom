type RegistryEntry = {
  url: string;
  refCount: number;
};

const registry = new Map<string, RegistryEntry>();

export function getOrCreate(id: string, blob: Blob): string {
  const existing = registry.get(id);
  if (existing) {
    existing.refCount += 1;
    return existing.url;
  }

  const url = URL.createObjectURL(blob);
  registry.set(id, { url, refCount: 1 });
  return url;
}

export function revoke(id: string): void {
  const existing = registry.get(id);
  if (!existing) return;

  existing.refCount -= 1;
  if (existing.refCount <= 0) {
    URL.revokeObjectURL(existing.url);
    registry.delete(id);
  }
}

export function revokeAll(): void {
  registry.forEach((entry) => URL.revokeObjectURL(entry.url));
  registry.clear();
}
