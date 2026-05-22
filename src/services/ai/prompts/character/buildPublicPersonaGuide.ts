import type { DirectPersonaGuideInput } from './buildDirectPersonaGuide';

const SPEAKING_OR_REACTION_PATTERN = /说话|语气|口癖|短句|断句|称呼|开口|会说|常说|嘴硬|毒舌|沉默|停顿|连发|反问|撒娇|反应|会先|习惯/i;
const PUBLIC_SHARE_PATTERN = /在别人面前|当着别人|群里|半公开|不避讳|不藏着|炫耀|秀给|显摆|爱分享|喜欢分享|会分享|故意让.+知道|故意说给.+听|会拿.+出来说|挑明|说破|宣示主权|刺激/i;
const PUBLIC_STYLE_PATTERN = /暗示|阴阳|半开玩笑|轻描淡写|炫耀|显摆|挑明|装作不经意|故意|宣示主权|刺激/i;
const PUBLIC_RESTRAINT_PATTERN = /不在外人面前|不公开|不往外说|不让别人知道|只在私下|只对你|不会在群里提|不爱公开|不喜欢公开|避开外人|不把.+搬出去|不把.+搬到群里|不会把.+搬出去|不会把.+搬到群里|不喜欢把私事讲给外人听|不把私事讲给外人听|不讲给外人听/i;

function normalizeOptionalText(value: string | null | undefined): string {
  return value?.trim() || '';
}

function compactLine(value: string, maxLength = 96): string {
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
    .replace(/([。！？!?；;]+)/gu, '$1\n')
    .split(/[\r\n]+/)
    .map((part) => compactLine(part))
    .filter((part) => part.length >= 2);
}

function uniqueLines(lines: Array<string | undefined>, maxItems = 3, maxLength = 96): string[] {
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

function collectMatchingClauses(value: string, pattern: RegExp, maxItems = 3): string[] {
  return uniqueLines(
    splitClauses(value).filter((clause) => pattern.test(clause)),
    maxItems,
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

export function buildPublicPersonaGuide(input: DirectPersonaGuideInput): string {
  const corePersona = normalizeOptionalText(input.corePersona);
  const expressionStyle = normalizeOptionalText(input.expressionStyle);
  const boundaryPack = normalizeOptionalText(input.boundaryPack);
  const extendedLore = normalizeOptionalText(input.extendedLore);
  const signature = normalizeOptionalText(input.signature);
  const combined = [corePersona, expressionStyle, boundaryPack, extendedLore].filter(Boolean).join('\n');

  const publicAnchors = uniqueLines([
    signature,
    ...collectMatchingClauses(expressionStyle, SPEAKING_OR_REACTION_PATTERN, 2),
    ...collectMatchingClauses(corePersona, SPEAKING_OR_REACTION_PATTERN, 2),
  ], 4);

  const shareableCues = uniqueLines([
    ...collectMatchingClauses(corePersona, PUBLIC_SHARE_PATTERN, 3),
    ...collectMatchingClauses(expressionStyle, PUBLIC_SHARE_PATTERN, 2),
    ...collectMatchingClauses(extendedLore, PUBLIC_SHARE_PATTERN, 2),
  ], 4);

  const disclosureStyle = uniqueLines([
    ...collectMatchingClauses(expressionStyle, PUBLIC_STYLE_PATTERN, 2),
    ...collectMatchingClauses(corePersona, PUBLIC_STYLE_PATTERN, 2),
  ], 3);

  const publicRestraints = uniqueLines([
    ...collectMatchingClauses(boundaryPack, PUBLIC_RESTRAINT_PATTERN, 3),
    ...collectMatchingClauses(corePersona, PUBLIC_RESTRAINT_PATTERN, 2),
  ], 3);

  if (
    publicAnchors.length === 0
    && shareableCues.length === 0
    && disclosureStyle.length === 0
    && publicRestraints.length === 0
  ) {
    return '';
  }

  return [
    '## 公开场合角色锚点',
    '这些锚点只帮助你在群聊等公开场合继续像同一个人。不要自动泄露私聊原话或私密细节；但如果原文明确写了这个角色会主动暗示、炫耀、挑明、刺激别人或故意让别人知道，你可以按他的方式把那部分带出来。',
    buildSection('[公开场合一直成立的锚点]', publicAnchors),
    buildSection('[角色可主动外放的私密线索]', shareableCues),
    buildSection('[公开外放方式倾向]', disclosureStyle),
    buildSection('[公开场合收着的边界]', publicRestraints),
  ].filter(Boolean).join('\n\n');
}
