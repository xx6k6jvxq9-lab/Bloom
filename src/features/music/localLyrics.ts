export type ParsedLyricLine = {
  time: number | null;
  text: string;
  translation?: string;
};

const TIMESTAMP_PATTERN = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const LRC_METADATA_LINE_PATTERN = /^\[(?:ti|ar|al|by|offset):.*\]$/i;

function normalizeFraction(rawFraction: string | undefined): number {
  if (!rawFraction) {
    return 0;
  }

  if (rawFraction.length === 3) {
    return Number.parseInt(rawFraction, 10) / 1000;
  }

  if (rawFraction.length === 2) {
    return Number.parseInt(rawFraction, 10) / 100;
  }

  return Number.parseInt(rawFraction, 10) / 10;
}

export function normalizeLyricText(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value
    .replace(/\uFEFF/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();

  return normalized || undefined;
}

export function pickPrimaryLyricText(values: Array<string | null | undefined> | undefined): string | undefined {
  if (!Array.isArray(values) || values.length === 0) {
    return undefined;
  }

  const uniqueValues = Array.from(
    new Set(
      values
        .map((value) => normalizeLyricText(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  return uniqueValues.length > 0 ? uniqueValues.join("\n") : undefined;
}

function mergeTimedLyricLines(lines: ParsedLyricLine[]): ParsedLyricLine[] {
  const merged: ParsedLyricLine[] = [];

  lines.forEach((line) => {
    const previousLine = merged[merged.length - 1];
    if (
      previousLine
      && previousLine.time !== null
      && line.time !== null
      && Math.abs(previousLine.time - line.time) < 0.001
    ) {
      if (!previousLine.translation && previousLine.text !== line.text) {
        previousLine.translation = line.text;
        return;
      }

      if (previousLine.text === line.text || previousLine.translation === line.text) {
        return;
      }
    }

    merged.push({ ...line });
  });

  return merged;
}

export function parseLyricText(value: string | null | undefined): ParsedLyricLine[] {
  const normalized = normalizeLyricText(value);
  if (!normalized) {
    return [];
  }

  const timedLines: ParsedLyricLine[] = [];

  normalized.split("\n").forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || LRC_METADATA_LINE_PATTERN.test(line)) {
      return;
    }

    const matches = Array.from(line.matchAll(TIMESTAMP_PATTERN));
    if (matches.length === 0) {
      return;
    }

    const text = line.replace(TIMESTAMP_PATTERN, "").trim();
    if (!text) {
      return;
    }

    matches.forEach((match) => {
      const minutes = Number.parseInt(match[1] || "0", 10);
      const seconds = Number.parseInt(match[2] || "0", 10);
      const time = minutes * 60 + seconds + normalizeFraction(match[3]);

      timedLines.push({
        time,
        text,
      });
    });
  });

  if (timedLines.length > 0) {
    const sortedLines = timedLines.sort((left, right) => {
      if (left.time === null || right.time === null) {
        return 0;
      }

      return left.time - right.time;
    });

    return mergeTimedLyricLines(sortedLines);
  }

  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => Boolean(line) && !LRC_METADATA_LINE_PATTERN.test(line))
    .map((text) => ({
      time: null,
      text,
    }));
}

export function hasTimedLyricLines(lines: ParsedLyricLine[]): boolean {
  return lines.some((line) => line.time !== null);
}
