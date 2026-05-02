function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

export function parseSpectatorDraftChips(value: string) {
  return uniqueNonEmpty(
    value
      .split(/[、/／|｜；;]+/)
      .map((item) => item.trim()),
  );
}

export function buildSpectatorDraftText(values: string[], separator = ' / ') {
  return uniqueNonEmpty(values).join(separator);
}

export function toggleSpectatorDraftValue(current: string, value: string, separator = ' / ') {
  const currentValues = parseSpectatorDraftChips(current);
  const exists = currentValues.includes(value);
  const nextValues = exists
    ? currentValues.filter((item) => item !== value)
    : [...currentValues, value];
  return buildSpectatorDraftText(nextValues, separator);
}

export function pickRandomSpectatorDraftValues<T extends string>(
  values: T[],
  count: number,
) {
  const shuffled = [...values].sort(() => Math.random() - 0.5);
  return uniqueNonEmpty(shuffled.slice(0, Math.min(count, shuffled.length)));
}
