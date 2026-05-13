export type DirectPersonaGuideInput = {
  corePersona?: string;
  expressionStyle?: string;
  boundaryPack?: string;
  extendedLore?: string;
  signature?: string;
  openingRemark?: string;
};

type LineCollectorOptions = {
  maxLength?: number;
  maxItems?: number;
};

const SPEAKING_OR_REACTION_PATTERN = /说话|语气|口癖|短句|断句|称呼|开口|会说|常说|嘴硬|毒舌|沉默|停顿|连发|反问|撒娇|反应|会先|习惯/i;
const REACTION_TRIGGER_PATTERN = /冷落|不理|离开|亲近|靠近|试探|吃醋|占有|依赖|撒泼|委屈|挑衅|掌控|克制|高冷|黏人|病娇|疯/i;
const BOUNDARY_PATTERN = /不要|不能|不会|别|不许|禁止|不可|不该|别把|关系没到|别像/i;
const DIALOGUE_LIKE_PATTERN = /[“”"'「」『』]|(?:^|[\s])(?:用户|角色|他说|她说)\s*[:：]|常说[:：]|会说[:：]/i;

function normalizeOptionalText(value: string | null | undefined): string {
  return value?.trim() || '';
}

function compactLine(value: string, maxLength = 88): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function splitClauses(value: string): string[] {
  return value
    .split(/[\r\n]+|(?<=[。！？!?；;])/u)
    .map((part) => compactLine(part))
    .filter((part) => part.length >= 2);
}

function uniqueLines(lines: Array<string | undefined>, options: LineCollectorOptions = {}): string[] {
  const maxItems = options.maxItems ?? 3;
  const maxLength = options.maxLength ?? 88;
  const seen = new Set<string>();
  const collected: string[] = [];

  for (const line of lines) {
    const normalized = compactLine(line || '', maxLength);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    collected.push(normalized);
    if (collected.length >= maxItems) {
      break;
    }
  }

  return collected;
}

function collectMatchingClauses(
  value: string,
  pattern: RegExp,
  options: LineCollectorOptions = {},
): string[] {
  return uniqueLines(
    splitClauses(value).filter((clause) => pattern.test(clause)),
    options,
  );
}

function buildSection(title: string, lines: string[]): string {
  if (lines.length === 0) {
    return '';
  }

  return [
    title,
    ...lines.map((line) => `- ${line}`),
  ].join('\n');
}

export function buildDirectPersonaGuide(input: DirectPersonaGuideInput): string {
  const corePersona = normalizeOptionalText(input.corePersona);
  const expressionStyle = normalizeOptionalText(input.expressionStyle);
  const boundaryPack = normalizeOptionalText(input.boundaryPack);
  const extendedLore = normalizeOptionalText(input.extendedLore);
  const signature = normalizeOptionalText(input.signature);
  const openingRemark = normalizeOptionalText(input.openingRemark);
  const combined = [corePersona, expressionStyle, boundaryPack, extendedLore].filter(Boolean).join('\n');

  const openingAnchors = uniqueLines([
    openingRemark,
    signature,
    ...collectMatchingClauses(corePersona, DIALOGUE_LIKE_PATTERN, { maxItems: 2, maxLength: 120 }),
    ...collectMatchingClauses(expressionStyle, DIALOGUE_LIKE_PATTERN, { maxItems: 1, maxLength: 120 }),
  ], {
    maxItems: 4,
    maxLength: 120,
  });

  const speakingAnchors = uniqueLines([
    ...collectMatchingClauses(expressionStyle, SPEAKING_OR_REACTION_PATTERN, { maxItems: 2 }),
    ...collectMatchingClauses(corePersona, SPEAKING_OR_REACTION_PATTERN, { maxItems: 3 }),
    ...collectMatchingClauses(corePersona, REACTION_TRIGGER_PATTERN, { maxItems: 2 }),
  ], {
    maxItems: 4,
  });

  const boundaryAnchors = uniqueLines([
    ...collectMatchingClauses(boundaryPack, BOUNDARY_PATTERN, { maxItems: 3 }),
    ...collectMatchingClauses(corePersona, BOUNDARY_PATTERN, { maxItems: 2 }),
  ], {
    maxItems: 3,
  });

  const fallbackAnchors = uniqueLines([
    ...collectMatchingClauses(combined, REACTION_TRIGGER_PATTERN, { maxItems: 2 }),
    ...splitClauses(corePersona).slice(0, 2),
  ], {
    maxItems: 2,
  }).filter((line) => (
    !openingAnchors.includes(line)
    && !speakingAnchors.includes(line)
    && !boundaryAnchors.includes(line)
  ));

  const sections = [
    '## 原文防漏锚点',
    '这些内容只是在原文里直接摘出来的高置信度锚点，用来防止生成时漏掉重点；它们不替代原文，也不负责替你定义完整人设。没有明确写出来的内容不要自行补全，和原文冲突时永远以原文为准。',
    buildSection('[开口语感锚点]', openingAnchors),
    buildSection('[说话与反应锚点]', speakingAnchors),
    buildSection('[明确边界与禁区]', boundaryAnchors),
    buildSection('[原文里的高优先级片段]', fallbackAnchors),
  ].filter(Boolean);

  return sections.length > 2
    ? sections.join('\n\n')
    : '';
}
