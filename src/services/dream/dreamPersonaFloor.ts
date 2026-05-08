import type { CharacterContext } from '../relationship-context/types';
import type { DreamPersonaFloor } from './dreamRuntimeTypes';

type PersonaRule = {
  pattern: RegExp;
  line: string;
};

const AMPLIFY_RULES: PersonaRule[] = [
  {
    pattern: /占有|吃醋|醋意|护短|控制|强势/u,
    line: '可以放大占有、护短、吃醋或强势的一面，但表达方式必须还是他原本那套。',
  },
  {
    pattern: /脆弱|敏感|缺爱|自卑|不安|阴影|创伤/u,
    line: '可以放大脆弱、不安、依赖或旧伤反应，但不能把人写成另一种失控模板。',
  },
  {
    pattern: /嘴硬|别扭|毒舌|逗|戏谑|揶揄|嘴欠/u,
    line: '可以放大试探、嘴硬、逗弄和反话里的在意，但不能把锋利感磨没。',
  },
  {
    pattern: /慢热|克制|冷淡|寡言|疏离|理智|稳重/u,
    line: '可以放大克制之后的松动、迟疑之后的靠近，但节奏必须慢一点、试探一点。',
  },
  {
    pattern: /温柔|体贴|照顾|保护|可靠|心软/u,
    line: '可以放大照顾、保护、心软或偏爱，但不要写成泛滥示好。',
  },
];

const MUST_NOT_BECOME_RULES: PersonaRule[] = [
  {
    pattern: /慢热|克制|冷淡|寡言|疏离|边界|不主动|理智/u,
    line: '不要突然没边界、秒亲近、秒暧昧，亲密节奏必须先试探再松动。',
  },
  {
    pattern: /嘴硬|别扭|毒舌|强势|傲|硬气/u,
    line: '不要突然变成满嘴腻甜、毫无棱角、说话不像本人的人。',
  },
  {
    pattern: /温柔|照顾|体贴|保护|可靠/u,
    line: '不要把温柔写成无原则顺从，也不要为了甜而失掉分寸。',
  },
  {
    pattern: /成熟|冷静|理智|稳重/u,
    line: '不要突然变成只会大起大落、情绪失控的戏剧化模板。',
  },
];

function normalizeOptionalText(value: string | null | undefined): string {
  return value?.trim() || '';
}

function compactClause(value: string, maxLength = 44): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength)}...`;
}

function splitPersonaClauses(value: string): string[] {
  return value
    .split(/[。！？!?；;\n]+/u)
    .map((clause) => compactClause(clause))
    .filter((clause) => clause.length >= 2);
}

function buildFieldSummary(label: string, value: string, maxClauses = 2): string | null {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return null;

  const clauses = splitPersonaClauses(normalized).slice(0, maxClauses);
  if (clauses.length === 0) return null;
  return `${label}：${clauses.join('；')}`;
}

function uniqueLines(lines: Array<string | null | undefined>, limit?: number) {
  const seen = new Set<string>();
  const normalized = lines
    .map((line) => normalizeOptionalText(line))
    .filter(Boolean)
    .filter((line) => {
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    });

  return typeof limit === 'number' ? normalized.slice(0, limit) : normalized;
}

function pickRuleLines(text: string, rules: PersonaRule[], fallback: string, limit = 3) {
  const matches = uniqueLines(
    rules.filter((rule) => rule.pattern.test(text)).map((rule) => rule.line),
    limit,
  );
  return matches.length > 0 ? matches : [fallback];
}

export function buildDreamPersonaFloor(context: CharacterContext): DreamPersonaFloor {
  const corePersona = normalizeOptionalText(context.corePersona);
  const expressionStyle = normalizeOptionalText(context.expressionStyle);
  const boundaryPack = normalizeOptionalText(context.boundaryPack);
  const extendedLore = normalizeOptionalText(context.extendedLore);
  const combinedText = [corePersona, expressionStyle, boundaryPack, extendedLore].filter(Boolean).join('\n');

  const mustKeep = uniqueLines([
    buildFieldSummary('性格与反应逻辑', corePersona),
    buildFieldSummary('说话与表达方式', expressionStyle),
    buildFieldSummary('边界与亲密节奏', boundaryPack),
    buildFieldSummary('底色与旧包袱', extendedLore, 1),
  ], 4);

  const safeMustKeep = mustKeep.length > 0
    ? mustKeep
    : ['至少保住角色原本的说话方式、边界感、情绪反应和亲密节奏。'];

  const mayAmplify = pickRuleLines(
    combinedText,
    AMPLIFY_RULES,
    '只允许放大原文里已经存在的迟疑、心软、欲望、占有、脆弱或拉扯，不要凭空新增人格。',
    3,
  );

  const mustNotBecome = uniqueLines([
    '不要突然变成更油滑、更甜、更主动、像通用恋爱模板那样的人。',
    ...pickRuleLines(
      combinedText,
      MUST_NOT_BECOME_RULES,
      '不要让梦境设定盖过原本人设，不要为了戏剧性把他写得不像本人。',
      3,
    ),
  ], 4);

  const summary = [
    '不能丢：',
    ...safeMustKeep.map((line, index) => `${index + 1}. ${line}`),
    '可以放大：',
    ...mayAmplify.map((line, index) => `${index + 1}. ${line}`),
    '不能变成：',
    ...mustNotBecome.map((line, index) => `${index + 1}. ${line}`),
  ].join('\n');

  return {
    mustKeep: safeMustKeep,
    mayAmplify,
    mustNotBecome,
    summary,
  };
}
