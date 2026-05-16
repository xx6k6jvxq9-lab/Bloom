import type { WorldBookEntry } from '../../types';
import { normalizeWorldBookCategory, normalizeWorldBookPriorityLevel } from './worldBookMeta';

type WorldBookDerivationSource = Pick<WorldBookEntry, 'title' | 'content' | 'category' | 'priorityLevel'>;

export type WorldBookPromptExposureMode = 'balanced' | 'detail_only';
export type WorldBookPromptRiskLevel = 'normal' | 'high';

export type WorldBookPromptExposureProfile = {
  mode: WorldBookPromptExposureMode;
  riskLevel: WorldBookPromptRiskLevel;
  safeTitle: string;
  safeSummary: string;
  safeMustReadFacts: string[];
  safeKeywords: string[];
  note: string;
  suppressAlwaysOnRawDetails: boolean;
};

const SUMMARY_MAX_CHARS = 88;
const FACT_MAX_CHARS = 72;
const MAX_FACTS = 3;
const MAX_KEYWORDS = 12;
const MAX_CHUNK_KEYWORDS = 8;
const RAW_WORLD_BOOK_EXPLICIT_HINTS = [
  /(?:nsfw|18\+|adult|explicit)/iu,
  /(?:成人|露骨|高强度|情欲|性描写|欲望|发情|高潮|插入)/u,
];
const RAW_WORLD_BOOK_TRIGGER_HINTS = [
  /(?:触发词|关键词|命中|破甲|开关|触发后)/u,
  /(?:when .*?(?:hit|match|trigger)|trigger terms?|keywords?)/iu,
];
const RAW_WORLD_BOOK_SAMPLE_HINTS = [
  /(?:样例|示例|台词|语气|说法|写法|措辞|参考)/u,
  /(?:samples?|examples?|phrasing|wording|tone)/iu,
];

const RULE_HINTS = [
  'must',
  'never',
  'always',
  'only',
  'cannot',
  'avoid',
  'forbid',
  'rule',
  'rules',
  'required',
  '禁止',
  '不能',
  '不可',
  '不得',
  '必须',
  '务必',
  '始终',
  '只能',
  '避免',
  '规则',
  '禁忌',
  '底线',
];

function normalizeOptionalText(value: string | null | undefined): string {
  return value?.trim() || '';
}

function limitText(value: string, maxChars: number): string {
  const normalized = normalizeOptionalText(value).replace(/\s+/g, ' ');
  if (!normalized) {
    return '';
  }

  return normalized.length <= maxChars
    ? normalized
    : `${normalized.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
}

function countPatternHits(text: string, patterns: RegExp[]): number {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function normalizeStructuredLine(value: string): string {
  return value
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/^\s*\d+[.)、]\s+/, '')
    .replace(/^\s*>\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitContentBlocks(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function splitContentLines(content: string): string[] {
  return content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitIntoSentences(block: string): string[] {
  return block
    .split(/(?<=[。！？；!?;])\s+|\n+/)
    .map((part) => normalizeStructuredLine(part))
    .filter(Boolean);
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    result.push(value.trim());
  });

  return result;
}

function buildProtectedWorldBookTitle(source: WorldBookDerivationSource): string {
  const normalizedTitle = normalizeOptionalText(source.title);
  const category = normalizeWorldBookCategory(source.category);

  if (/关系/.test(category)) {
    return normalizedTitle ? `${normalizedTitle}（关系表达参考）` : '关系表达参考';
  }
  if (/规则|禁忌/.test(category)) {
    return normalizedTitle ? `${normalizedTitle}（互动补充规则）` : '互动补充规则';
  }
  if (/角色/.test(category)) {
    return normalizedTitle ? `${normalizedTitle}（表达语气参考）` : '表达语气参考';
  }

  return normalizedTitle ? `${normalizedTitle}（补充表达参考）` : '补充表达参考';
}

function selectSummaryFragments(content: string): string[] {
  const blocks = splitContentBlocks(content);
  const fragments: string[] = [];

  (blocks.length > 0 ? blocks : splitContentLines(content)).forEach((block) => {
    splitIntoSentences(block).forEach((sentence) => {
      if (sentence.length < 6) {
        return;
      }

      fragments.push(sentence);
    });
  });

  return uniqueStrings(fragments);
}

function joinWithinBudget(parts: string[], maxChars: number, separator: string): string {
  const selected: string[] = [];
  let currentLength = 0;

  parts.forEach((part) => {
    const normalized = limitText(part, maxChars);
    if (!normalized) {
      return;
    }

    const nextLength = currentLength === 0
      ? normalized.length
      : currentLength + separator.length + normalized.length;

    if (nextLength > maxChars && selected.length > 0) {
      return;
    }

    selected.push(normalized);
    currentLength = nextLength;
  });

  return selected.join(separator);
}

function scoreFactCandidate(line: string, index: number, source: WorldBookDerivationSource): number {
  const normalized = line.toLowerCase();
  let score = 0;

  if (RULE_HINTS.some((hint) => normalized.includes(hint))) {
    score += 12;
  }
  if (/[：:]/.test(line)) {
    score += 2;
  }
  if (line.length >= 8 && line.length <= FACT_MAX_CHARS) {
    score += 2;
  }
  if (index < 6) {
    score += 2;
  }
  if (normalizeWorldBookPriorityLevel(source.priorityLevel) === 'critical') {
    score += 3;
  }
  if (/规则|禁忌|底线|设定|关系/.test(normalizeWorldBookCategory(source.category))) {
    score += 2;
  }

  return score;
}

function extractFactCandidates(source: WorldBookDerivationSource): string[] {
  const lines = uniqueStrings(
    splitContentLines(source.content)
      .map((line) => normalizeStructuredLine(line))
      .filter((line) => line.length >= 6 && line.length <= 120),
  );

  const scored = lines
    .map((line, index) => ({
      line,
      index,
      score: scoreFactCandidate(line, index, source),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.index - right.index;
    });

  const selected = scored
    .filter((item) => item.score >= 6)
    .slice(0, MAX_FACTS)
    .map((item) => limitText(item.line, FACT_MAX_CHARS));

  if (selected.length > 0) {
    return uniqueStrings(selected);
  }

  if (normalizeWorldBookPriorityLevel(source.priorityLevel) === 'critical') {
    return uniqueStrings(
      lines.slice(0, 2).map((line) => limitText(line, FACT_MAX_CHARS)).filter(Boolean),
    );
  }

  return [];
}

export function tokenizeWorldBookRecallText(text: string): string[] {
  const normalized = text.toLowerCase();
  const latinTokens = normalized.match(/[a-z0-9_/-]{2,}/g) || [];
  const cjkRuns = normalized.match(/[\u4e00-\u9fff]{2,}/g) || [];
  const cjkBigrams = cjkRuns.flatMap((run) => {
    const tokens: string[] = [];
    for (let index = 0; index < run.length - 1; index += 1) {
      tokens.push(run.slice(index, index + 2));
    }
    return tokens;
  });

  return Array.from(new Set([...latinTokens, ...cjkRuns, ...cjkBigrams].filter((token) => token.trim().length >= 2)));
}

function buildKeywordList(text: string, maxKeywords: number): string[] {
  const tokens = tokenizeWorldBookRecallText(text);
  const seen = new Set<string>();
  const ranked = tokens
    .filter((token) => {
      const normalized = token.trim().toLowerCase();
      if (!normalized || seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    })
    .sort((left, right) => right.length - left.length || left.localeCompare(right, 'zh-CN'));

  return ranked.slice(0, maxKeywords);
}

export function buildWorldBookFingerprint(entry: Pick<WorldBookEntry, 'title' | 'content'>): string {
  return [
    normalizeOptionalText(entry.title).replace(/\s+/g, ' ').toLowerCase(),
    normalizeOptionalText(entry.content).replace(/\s+/g, ' ').toLowerCase(),
  ].join('::');
}

export function buildWorldBookSummary(source: WorldBookDerivationSource): string {
  const fragments = selectSummaryFragments(source.content);
  const summary = joinWithinBudget(fragments.slice(0, 3), SUMMARY_MAX_CHARS, ' ');

  if (summary) {
    return summary;
  }

  return limitText(source.content, SUMMARY_MAX_CHARS);
}

export function buildWorldBookMustReadFacts(source: WorldBookDerivationSource): string[] {
  return extractFactCandidates(source);
}

export function buildWorldBookKeywords(source: WorldBookDerivationSource): string[] {
  return buildKeywordList([
    source.title,
    normalizeWorldBookCategory(source.category),
    buildWorldBookSummary(source),
    ...buildWorldBookMustReadFacts(source),
  ].filter(Boolean).join('\n'), MAX_KEYWORDS);
}

export function buildWorldBookChunkKeywords(input: {
  title?: string;
  category?: string;
  content?: string;
  baseKeywords?: string[];
}): string[] {
  return buildKeywordList([
    input.title || '',
    normalizeOptionalText(input.category),
    ...(input.baseKeywords || []),
    normalizeOptionalText(input.content),
  ].filter(Boolean).join('\n'), MAX_CHUNK_KEYWORDS);
}

export function resolveWorldBookPromptExposureProfile(
  source: WorldBookDerivationSource,
): WorldBookPromptExposureProfile {
  const combined = [
    normalizeOptionalText(source.title),
    normalizeOptionalText(source.content),
  ].filter(Boolean).join('\n');
  const explicitHits = countPatternHits(combined, RAW_WORLD_BOOK_EXPLICIT_HINTS);
  const triggerHits = countPatternHits(combined, RAW_WORLD_BOOK_TRIGGER_HINTS);
  const sampleHits = countPatternHits(combined, RAW_WORLD_BOOK_SAMPLE_HINTS);
  const shouldUseDetailOnly = explicitHits >= 2 || (explicitHits >= 1 && (triggerHits >= 1 || sampleHits >= 1));

  if (!shouldUseDetailOnly) {
    const summary = buildWorldBookSummary(source);
    const mustReadFacts = buildWorldBookMustReadFacts(source);
    const keywords = buildWorldBookKeywords(source);

    return {
      mode: 'balanced',
      riskLevel: 'normal',
      safeTitle: normalizeOptionalText(source.title) || 'Untitled World Book',
      safeSummary: summary,
      safeMustReadFacts: mustReadFacts,
      safeKeywords: keywords,
      note: '当前按默认世界书策略处理：总览、必读事实和正文细节都会参与提示词注入。',
      suppressAlwaysOnRawDetails: false,
    };
  }

  const safeTitle = buildProtectedWorldBookTitle(source);
  const category = normalizeWorldBookCategory(source.category);
  const safeSummary = limitText(
    /关系/.test(category)
      ? `${safeTitle}。这是一组与关系推进、表达力度和当前互动气氛相关的补充参考。`
      : /规则|禁忌/.test(category)
        ? `${safeTitle}。这是一组与互动边界、表达尺度和当前语境相关的补充规则。`
        : `${safeTitle}。这是一组需要在当前语境相关时再展开细读的补充表达参考。`,
    SUMMARY_MAX_CHARS,
  );
  const safeKeywords = buildKeywordList([
    safeTitle,
    category,
    safeSummary,
  ].filter(Boolean).join('\n'), MAX_KEYWORDS);

  return {
    mode: 'detail_only',
    riskLevel: 'high',
    safeTitle,
    safeSummary,
    safeMustReadFacts: [],
    safeKeywords,
    note: '检测到高风险 raw 语料：常驻层只保留中性概览，raw 正文改为按轮次检索注入，且不再用 always-on 方式钉住 raw 细节。',
    suppressAlwaysOnRawDetails: true,
  };
}

export function applyDerivedWorldBookMetadata(entry: WorldBookEntry): WorldBookEntry {
  const source: WorldBookDerivationSource = {
    title: normalizeOptionalText(entry.title),
    content: normalizeOptionalText(entry.content),
    category: normalizeWorldBookCategory(entry.category),
    priorityLevel: normalizeWorldBookPriorityLevel(entry.priorityLevel),
  };
  const exposureProfile = resolveWorldBookPromptExposureProfile(source);
  const fingerprint = buildWorldBookFingerprint(source);

  return {
    ...entry,
    summary: exposureProfile.safeSummary || undefined,
    mustReadFacts: exposureProfile.safeMustReadFacts.length > 0 ? exposureProfile.safeMustReadFacts : undefined,
    keywords: exposureProfile.safeKeywords.length > 0 ? exposureProfile.safeKeywords : undefined,
    fingerprint,
  };
}
