import type { Character } from '../../types';

export type MomentReadableMemoryView = {
  publicMemoryProfile?: string;
  publicResidueSummary?: string;
  privateAfterglowSummary?: string;
};

type MomentMemoryLineSource =
  | 'long_term'
  | 'short_term'
  | 'public_carryover'
  | 'private_carryover';

type MomentMemoryVisibility = 'public_publishable' | 'public_residue' | 'private_only';

const STRONG_PRIVATE_MARKERS_REGEX = /(?:用户|对你|给你|和你|跟你|想你|等你|被你|你说|回你|刚聊完|私聊|回复用户|抱着|抱住|亲你|想亲|想抱|哄好|梦里|晚安|撒娇|吃醋|占位|占有|我的人|带走|领走|收到了人|等用户|waiting_user|open loop|user\b)/i;
const PRIVATE_OPEN_LOOP_REGEX = /(?:再提起|再触发|等回复|等用户|待用户|等下次|未收掉|开放回路|waiting_user|dormant)/i;
const SOFT_PUBLIC_RESIDUE_REGEX = /(?:余波|afterglow|回温|松下来|缓下来|心情|状态|有点累|有点烦|收工|路上|回神|心绪|小情绪|想起|在意|偏心|护短|惦记)/i;

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.replace(/\r/g, '').trim();
  return normalized ? normalized : undefined;
}

function splitMemoryLines(text: string | undefined): string[] {
  return (text || '')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function uniqueLines(lines: string[], maxItems: number): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(line);
    if (unique.length >= maxItems) {
      break;
    }
  }

  return unique;
}

function classifyMomentMemoryLine(
  source: MomentMemoryLineSource,
  line: string,
): MomentMemoryVisibility {
  if (source === 'public_carryover') {
    return 'public_residue';
  }

  if (source === 'private_carryover') {
    return 'private_only';
  }

  if (STRONG_PRIVATE_MARKERS_REGEX.test(line) || PRIVATE_OPEN_LOOP_REGEX.test(line)) {
    return 'private_only';
  }

  if (source === 'short_term') {
    return 'public_residue';
  }

  if (SOFT_PUBLIC_RESIDUE_REGEX.test(line)) {
    return 'public_residue';
  }

  return 'public_publishable';
}

function pushLineByVisibility(
  bucket: MomentMemoryVisibility,
  line: string,
  target: {
    publicMemoryProfile: string[];
    publicResidueSummary: string[];
    privateAfterglowSummary: string[];
  },
) {
  if (bucket === 'public_publishable') {
    target.publicMemoryProfile.push(line);
    return;
  }

  if (bucket === 'public_residue') {
    target.publicResidueSummary.push(line);
    return;
  }

  target.privateAfterglowSummary.push(line);
}

export function buildMomentReadableMemoryView(input: {
  character: Pick<Character, 'sharedState'>;
  shortTermSummary?: string;
  longTermMemoryProfile?: string;
}): MomentReadableMemoryView {
  const buckets = {
    publicMemoryProfile: [] as string[],
    publicResidueSummary: [] as string[],
    privateAfterglowSummary: [] as string[],
  };

  for (const line of splitMemoryLines(input.longTermMemoryProfile)) {
    pushLineByVisibility(classifyMomentMemoryLine('long_term', line), line, buckets);
  }

  for (const line of splitMemoryLines(input.shortTermSummary)) {
    pushLineByVisibility(classifyMomentMemoryLine('short_term', line), line, buckets);
  }

  for (const line of splitMemoryLines(input.character.sharedState?.publicCarryover)) {
    pushLineByVisibility(classifyMomentMemoryLine('public_carryover', line), line, buckets);
  }

  for (const line of splitMemoryLines(input.character.sharedState?.privateCarryover)) {
    pushLineByVisibility(classifyMomentMemoryLine('private_carryover', line), line, buckets);
  }

  const publicMemoryProfile = uniqueLines(buckets.publicMemoryProfile, 4).join('\n');
  const publicResidueSummary = uniqueLines(buckets.publicResidueSummary, 4).join('\n');
  const privateAfterglowSummary = uniqueLines(buckets.privateAfterglowSummary, 3).join('\n');

  return {
    publicMemoryProfile: normalizeOptionalText(publicMemoryProfile),
    publicResidueSummary: normalizeOptionalText(publicResidueSummary),
    privateAfterglowSummary: normalizeOptionalText(privateAfterglowSummary),
  };
}
