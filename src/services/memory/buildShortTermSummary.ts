import type { Character } from '../../types';

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

type OpenLoopStatus = 'active' | 'waiting_user' | 'dormant';
type ShortTermContinuityMode = 'continuous_scene' | 'same_day_resume' | 'resume_after_gap';

type StructuredShortTermEntry = {
  label: '当前气氛' | '开放回路' | '短期余波' | '临时限制' | 'other';
  status?: OpenLoopStatus;
  content: string;
};

const SHORT_TERM_LABEL_PATTERNS: Array<{ pattern: RegExp; label: StructuredShortTermEntry['label'] }> = [
  { pattern: /^(当前气氛|气氛|氛围|当前状态|状态)[:：]/, label: '当前气氛' },
  { pattern: /^(未完事项|待处理|待继续|待确认|待触发|开放回路|open loop)[:：]/i, label: '开放回路' },
  { pattern: /^(短期余波|余波|残留余波|残留情绪|当前余波|余留氛围)[:：]/, label: '短期余波' },
  { pattern: /^(临时限制|当前限制|短期限制|注意事项)[:：]/, label: '临时限制' },
];

const SCENE_FREEZE_MARKERS = [
  '楼下',
  '车里',
  '门口',
  '停车',
  '站在',
  '坐在',
  '守在',
  '堵在',
  '上楼',
  '下楼',
  '赶来',
  '出现在',
  '还在等',
  '一直在等',
  '准备上楼',
  '准备过去',
];

const STRUCTURED_PREFIXES = ['当前气氛：', '开放回路（', '短期余波：', '临时限制：'];

function inferLabel(line: string): StructuredShortTermEntry['label'] {
  for (const { pattern, label } of SHORT_TERM_LABEL_PATTERNS) {
    if (pattern.test(line)) {
      return label;
    }
  }

  return 'other';
}

function stripKnownPrefix(line: string, label: StructuredShortTermEntry['label']): string {
  if (label === 'other') {
    return line.trim();
  }

  for (const { pattern, label: candidateLabel } of SHORT_TERM_LABEL_PATTERNS) {
    if (candidateLabel === label && pattern.test(line)) {
      return line.replace(pattern, '').trim();
    }
  }

  return line.trim();
}

function detectOpenLoopStatus(content: string): OpenLoopStatus {
  if (/(待触发|待确认|待继续|等用户|等对方|等下次|重新提起|再次提起|再次触发|用户未|尚未|取决于用户)/.test(content)) {
    return 'waiting_user';
  }

  if (/(已降温|已转淡|退到背景|背景余波|不再是当前重点|不必主动重提|暂时搁置)/.test(content)) {
    return 'dormant';
  }

  return 'active';
}

function normalizeOpenLoopContent(content: string): string {
  const normalized = content.trim();
  if (!normalized) {
    return normalized;
  }

  const hasSceneFreezeMarker = SCENE_FREEZE_MARKERS.some((marker) => normalized.includes(marker));
  if (hasSceneFreezeMarker) {
    return '上一轮现场动作已退为待继续状态，是否恢复取决于用户下一次回应，不默认延续旧场景。';
  }

  return normalized
    .replace(/^(角色|对方|他|她)还(在|停在|站在|坐在)/, '当前仍有一段未收掉的余波，')
    .replace(/^(角色|对方|他|她)正在/, '当前仍残留一段未收掉的推进，')
    .replace(/^(随时准备|准备)/, '若用户重新触发，后续可能继续');
}

function normalizeStructuredEntry(line: string): StructuredShortTermEntry {
  const trimmed = line.trim();
  const label = inferLabel(trimmed);
  const content = stripKnownPrefix(trimmed, label);

  if (label === '开放回路') {
    const normalizedContent = normalizeOpenLoopContent(content);
    return {
      label,
      status: detectOpenLoopStatus(normalizedContent),
      content: normalizedContent,
    };
  }

  return {
    label,
    content,
  };
}

function formatStructuredEntry(entry: StructuredShortTermEntry): string {
  if (!entry.content.trim()) {
    return '';
  }

  if (entry.label === '开放回路') {
    return `开放回路（${entry.status ?? 'active'}）：${entry.content.trim()}`;
  }

  if (entry.label === 'other') {
    return entry.content.trim();
  }

  return `${entry.label}：${entry.content.trim()}`;
}

function parseStructuredShortTermSummary(text: string): StructuredShortTermEntry[] {
  return text
    .split(/\r?\n+/)
    .map((line) => normalizeStructuredEntry(line))
    .filter((entry) => entry.content.trim().length > 0);
}

function cloneEntry(entry: StructuredShortTermEntry): StructuredShortTermEntry {
  return {
    label: entry.label,
    status: entry.status,
    content: entry.content,
  };
}

function hasStructuredShortTermSignal(entries: StructuredShortTermEntry[]): boolean {
  return entries.some((entry) => entry.label !== 'other');
}

function buildStructuredShortTermSummary(text: string): string {
  const entries = parseStructuredShortTermSummary(text);
  if (entries.length === 0 || !hasStructuredShortTermSignal(entries)) {
    return text;
  }

  return entries
    .map((entry) => formatStructuredEntry(entry))
    .filter(Boolean)
    .join('\n');
}

function degradeLegacySceneFreezeSummary(text: string): string {
  const hasSceneFreezeMarker = SCENE_FREEZE_MARKERS.some((marker) => text.includes(marker));
  if (!hasSceneFreezeMarker) {
    return text;
  }

  return [
    '开放回路（waiting_user）：上一轮现场动作已退为待继续状态，只有用户再次提起或重新触发时才值得恢复。',
    '短期余波：旧场景的压迫感或推进感仍有残留，但不默认延续具体地点和动作。',
  ].join('\n');
}

export function compressShortTermSummaryAfterLongTerm(summary: string): string {
  const normalized = normalizeOptionalText(summary);
  if (!normalized) {
    return '';
  }

  const entries = parseStructuredShortTermSummary(buildStructuredShortTermSummary(normalized));
  if (entries.length === 0) {
    return normalized;
  }

  const currentAtmosphere = entries.find((entry) => entry.label === '当前气氛');
  const residualEffect = entries.find((entry) => entry.label === '短期余波');
  const temporaryConstraint = entries.find((entry) => entry.label === '临时限制');
  const waitingLoop = entries.find((entry) => entry.label === '开放回路' && entry.status === 'waiting_user');
  const dormantLoop = entries.find((entry) => entry.label === '开放回路' && entry.status === 'dormant');
  const activeLoop = entries.find((entry) => entry.label === '开放回路' && entry.status === 'active');

  const compressedEntries: StructuredShortTermEntry[] = [];

  if (currentAtmosphere) {
    compressedEntries.push(currentAtmosphere);
  }

  if (waitingLoop) {
    compressedEntries.push(waitingLoop);
  } else if (dormantLoop) {
    compressedEntries.push(dormantLoop);
  } else if (activeLoop) {
    compressedEntries.push({
      label: '开放回路',
      status: 'waiting_user',
      content: '上一轮推进已退到背景层，只有用户再次提起或重新触发时才值得恢复，不主动延续旧话题。',
    });
  }

  if (residualEffect) {
    compressedEntries.push(residualEffect);
  } else if (temporaryConstraint) {
    compressedEntries.push(temporaryConstraint);
  }

  if (compressedEntries.length === 0) {
    return normalized;
  }

  return compressedEntries
    .slice(0, 3)
    .map((entry) => formatStructuredEntry(entry))
    .filter(Boolean)
    .join('\n');
}

export function decayShortTermSummaryForContinuity(
  summary: string,
  continuityMode: ShortTermContinuityMode,
): string {
  const normalized = normalizeOptionalText(summary);
  if (!normalized || continuityMode === 'continuous_scene') {
    return normalized || '';
  }

  const entries = parseStructuredShortTermSummary(buildStructuredShortTermSummary(normalized));
  if (entries.length === 0) {
    return normalized;
  }

  const nextEntries = entries
    .map((entry) => {
      if (entry.label !== '开放回路') {
        return cloneEntry(entry);
      }

      if (continuityMode === 'same_day_resume') {
        if (entry.status === 'active') {
          return {
            label: '开放回路' as const,
            status: 'waiting_user' as const,
            content: '同日重连后，这个未完点默认只作为待继续条件存在；只有用户当前重新提到或重新触发时才值得恢复。',
          };
        }

        return cloneEntry(entry);
      }

      return {
        label: '开放回路' as const,
        status: 'dormant' as const,
        content: '隔段重连后，这个旧未完点已退到背景层；只有用户明确重提时才值得恢复，不主动续写。',
      };
    })
    .filter((entry) => {
      if (continuityMode !== 'resume_after_gap') {
        return true;
      }

      if (entry.label === '临时限制') {
        return false;
      }

      return true;
    });

  const prioritized = continuityMode === 'resume_after_gap'
    ? [
        nextEntries.find((entry) => entry.label === '当前气氛'),
        nextEntries.find((entry) => entry.label === '开放回路'),
        nextEntries.find((entry) => entry.label === '短期余波'),
      ].filter((entry): entry is StructuredShortTermEntry => Boolean(entry))
    : nextEntries;

  return prioritized
    .slice(0, continuityMode === 'resume_after_gap' ? 3 : 4)
    .map((entry) => formatStructuredEntry(entry))
    .filter(Boolean)
    .join('\n');
}

export function buildShortTermSummary(character: Pick<Character, 'shortTermSummary'>): string | undefined {
  const normalized = normalizeOptionalText(character.shortTermSummary);
  if (!normalized) {
    return normalized;
  }

  const structured = buildStructuredShortTermSummary(normalized);
  if (STRUCTURED_PREFIXES.some((prefix) => structured.startsWith(prefix) || structured.includes(`\n${prefix}`))) {
    return structured;
  }

  return degradeLegacySceneFreezeSummary(normalized);
}
