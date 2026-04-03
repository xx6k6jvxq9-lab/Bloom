import type { Character, ChatMessage, CoupleSpaceData, LoveLetter } from '../../../types';
import { buildCharacterContext } from '../../relationship-context/buildCharacterContext';
import {
  DOCUMENTARY_TEMPLATE_BANK,
  OBSERVATION_TEMPLATE_BANK,
  applyPersonaFlavor,
  type PersonaFlavor,
  type RememberedCategory,
  type TemplateContext,
} from './taRememberedTemplates';

type RememberedSourceKind = 'chat' | 'letter' | 'note' | 'post' | 'message';
type RememberedStyle = 'observation' | 'documentary';

export type TaRememberedEntry = {
  id: string;
  text: string;
  sourceKind: RememberedSourceKind;
  sourceLabel: string;
  sourceDateText: string;
  timestamp: number;
  topicKey: string;
  category: RememberedCategory;
  style: RememberedStyle;
};

type BuildTaRememberedEntriesOptions = {
  user: { name?: string };
  partner: Character;
  coupleSpace: CoupleSpaceData;
  chatMessages?: ChatMessage[];
  now?: number;
};

type TextSource = {
  kind: RememberedSourceKind;
  text: string;
  timestamp: number;
};

type ExtractedFact = {
  category: RememberedCategory;
  style: RememberedStyle;
  primary: string;
  secondary?: string;
  timestamp: number;
  sourceKind: RememberedSourceKind;
  sourceText: string;
  topicKey: string;
  confidence: 'explicit' | 'repeated';
};

const MAX_ENTRIES = 12;
const FOOD_WORDS = ['草莓蛋糕', '蛋糕', '火锅', '番茄锅', '烤肉', '寿司', '拉面', '面', '米饭', '甜的', '辣的', '烧烤', '麻辣烫'];
const DRINK_WORDS = ['奶茶', '咖啡', '冰美式', '果汁', '热水', '可乐', '拿铁', '柠檬水', '少糖', '去冰', '热的'];
const PLACE_WORDS = ['海边', '游乐园', '商场', '电影院', '夜景', '公园', '小店', '咖啡店', '海边', '展览', '城市walk', '散步'];
const WEAK_OBJECT_WORDS = ['一下', '一点', '这个', '那个', '这里', '那里', '东西', '事情', '地方'];
const BANNED_PHRASES = ['我记得', '我懂', '接住', '看到', '想到你', '留给你', '先给你', '像你'];

export function buildTaRememberedEntries({
  user: _user,
  partner,
  coupleSpace,
  chatMessages = [],
}: BuildTaRememberedEntriesOptions): TaRememberedEntry[] {
  const persona = inferPersonaFlavor(partner);
  const facts = collectFacts({ coupleSpace, chatMessages });
  const entries: TaRememberedEntry[] = [];
  const usedTopics = new Set<string>();
  const usedTexts = new Set<string>();

  for (const fact of facts) {
    if (!isConcreteFact(fact)) continue;
    const text = renderFact(fact, persona);
    if (!text) continue;
    if (BANNED_PHRASES.some((phrase) => text.includes(phrase))) continue;
    if (isTooCloseToSource(text, fact.sourceText)) continue;
    if (usedTopics.has(fact.topicKey) || usedTexts.has(text)) continue;

    entries.push({
      id: `${fact.sourceKind}-${fact.timestamp}-${entries.length}`,
      text,
      sourceKind: fact.sourceKind,
      sourceLabel: getSourceLabel(fact.sourceKind),
      sourceDateText: formatDate(fact.timestamp),
      timestamp: fact.timestamp,
      topicKey: fact.topicKey,
      category: fact.category,
      style: fact.style,
    });

    usedTopics.add(fact.topicKey);
    usedTexts.add(text);

    if (entries.length >= MAX_ENTRIES) break;
  }

  return entries.sort((a, b) => b.timestamp - a.timestamp);
}

function collectFacts({
  coupleSpace,
  chatMessages,
}: {
  coupleSpace: CoupleSpaceData;
  chatMessages: ChatMessage[];
}): ExtractedFact[] {
  const rawFacts = collectUserSources({ coupleSpace, chatMessages }).flatMap((source) => extractFactsFromSource(source));
  const repeatedTopicKeys = collectRepeatedTopicKeys(rawFacts);

  return rawFacts
    .filter((fact) => canUseFact(fact, repeatedTopicKeys))
    .sort((a, b) => {
      if (a.style !== b.style) return a.style === 'documentary' ? -1 : 1;
      return b.timestamp - a.timestamp;
    });
}

function collectUserSources({
  coupleSpace,
  chatMessages,
}: {
  coupleSpace: CoupleSpaceData;
  chatMessages: ChatMessage[];
}): TextSource[] {
  const sources: TextSource[] = [];

  for (const message of chatMessages) {
    if (message.role !== 'user' || message.isSystem || !message.text?.trim()) continue;
    sources.push({ kind: 'chat', text: message.text.trim(), timestamp: message.timestamp });
  }

  for (const letter of coupleSpace.loveLetters || []) {
    collectLoveLetterSources(letter, sources);
  }

  for (const note of coupleSpace.coNotes || []) {
    if (note.authorId === 'user' && note.content?.trim()) {
      sources.push({ kind: 'note', text: note.content.trim(), timestamp: note.timestamp });
    }
  }

  for (const post of coupleSpace.posts || []) {
    if (post.authorId === 'user' && post.content?.trim()) {
      sources.push({ kind: 'post', text: post.content.trim(), timestamp: post.timestamp });
    }
  }

  for (const board of coupleSpace.messageBoard || []) {
    if (board.authorId === 'user' && board.content?.trim()) {
      sources.push({ kind: 'message', text: board.content.trim(), timestamp: board.timestamp });
    }
  }

  return sources.sort((a, b) => b.timestamp - a.timestamp);
}

function collectLoveLetterSources(letter: LoveLetter, target: TextSource[]) {
  if (letter.authorId === 'user' && letter.content?.trim()) {
    target.push({ kind: 'letter', text: letter.content.trim(), timestamp: letter.timestamp });
  }

  for (const comment of letter.comments || []) {
    if (comment.authorId === 'user' && comment.content?.trim()) {
      target.push({ kind: 'letter', text: comment.content.trim(), timestamp: comment.timestamp });
    }
  }
}

function extractFactsFromSource(source: TextSource): ExtractedFact[] {
  const clauses = source.text
    .split(/[\n，。！？；]/u)
    .map((part) => part.trim())
    .filter(Boolean);

  const facts: ExtractedFact[] = [];

  for (const clause of clauses) {
    facts.push(...extractDocumentaryFacts(clause, source));
    facts.push(...extractObservationFacts(clause, source));
  }

  return dedupeFacts(facts);
}

function extractDocumentaryFacts(clause: string, source: TextSource): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const normalized = clause.replace(/\s+/gu, '');

  const food =
    extractObjectAfterVerb(normalized, ['想吃', '想点', '喜欢吃', '爱吃', '点了', '又点了', '还是点了', '还是选了', '买了']) ||
    matchKeyword(normalized, FOOD_WORDS);
  const drink =
    extractObjectAfterVerb(normalized, ['想喝', '喜欢喝', '爱喝', '点了', '又点了', '还是点了', '还是选了', '买了']) ||
    matchKeyword(normalized, DRINK_WORDS);
  const place =
    extractObjectAfterVerb(normalized, ['去了', '去过', '逛了', '到了', '路过了']) ||
    extractObjectAfterVerb(normalized, ['想去', '还想去', '下次去', '以后去', '再去']) ||
    matchKeyword(normalized, PLACE_WORDS);

  if (food && /(喜欢|想吃|想点|点了|又点|选了|还是选|买了|吃了)/u.test(normalized)) {
    facts.push(
      buildFact({
        category: 'food',
        style: 'documentary',
        primary: food,
        source,
        topicKey: `food:${food}`,
        sourceText: clause,
        confidence: 'explicit',
      }),
    );
  }

  if (drink && /(喜欢|想喝|点了|又点|选了|还是选|买了|喝了)/u.test(normalized)) {
    facts.push(
      buildFact({
        category: 'drink',
        style: 'documentary',
        primary: drink,
        source,
        topicKey: `drink:${drink}`,
        sourceText: clause,
        confidence: 'explicit',
      }),
    );
  }

  if (place && /(去了|在|逛了|打卡|到了|路过)/u.test(normalized)) {
    facts.push(
      buildFact({
        category: 'place',
        style: 'documentary',
        primary: place,
        source,
        topicKey: `place:${place}`,
        sourceText: clause,
        confidence: 'explicit',
      }),
    );
  }

  if (place && /(想去|想再去|下次去|以后去|哪天去|想看看)/u.test(normalized)) {
    facts.push(
      buildFact({
        category: 'plan',
        style: 'documentary',
        primary: place,
        source,
        topicKey: `plan:${place}`,
        sourceText: clause,
        confidence: 'explicit',
      }),
    );
  }

  const repeatedFood = extractRepeatedMention(normalized, FOOD_WORDS);
  if (repeatedFood) {
    facts.push(
      buildFact({
        category: 'food',
        style: 'documentary',
        primary: repeatedFood,
        source,
        topicKey: `food-repeat:${repeatedFood}`,
        sourceText: clause,
        confidence: 'repeated',
      }),
    );
  }

  const repeatedDrink = extractRepeatedMention(normalized, DRINK_WORDS);
  if (repeatedDrink) {
    facts.push(
      buildFact({
        category: 'drink',
        style: 'documentary',
        primary: repeatedDrink,
        source,
        topicKey: `drink-repeat:${repeatedDrink}`,
        sourceText: clause,
        confidence: 'repeated',
      }),
    );
  }

  const repeatedPlace = extractRepeatedMention(normalized, PLACE_WORDS);
  if (repeatedPlace && /(提过|又说到|还说到|后来又提|后来又说)/u.test(normalized)) {
    facts.push(
      buildFact({
        category: 'plan',
        style: 'documentary',
        primary: repeatedPlace,
        source,
        topicKey: `plan-repeat:${repeatedPlace}`,
        sourceText: clause,
        confidence: 'repeated',
      }),
    );
  }

  const reminder = extractReminderFact(normalized, source, clause);
  if (reminder) {
    facts.push(reminder);
  }

  return facts;
}

function extractObservationFacts(clause: string, source: TextSource): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const normalized = clause.replace(/\s+/gu, '');

  const habitMatch =
    normalized.match(/(?:每次|一到)(.{1,8}?)(?:之前|的时候|时)?(?:都|就|总会|都会)(?:先|还会|会先)?(.{1,12})/u) ||
    normalized.match(/(.{1,8}?)(?:这件事上)?(?:总会|都会|总是先|会先)(.{1,12})/u);
  if (habitMatch?.[1] && habitMatch?.[2]) {
    const primary = trimFact(habitMatch[1]);
    const secondary = trimFact(habitMatch[2]);
    if (!isWeakAction(primary) && !isWeakAction(secondary)) {
      facts.push(
        buildFact({
          category: 'habit',
          style: 'observation',
          primary,
          secondary,
          source,
          topicKey: `habit:${primary}:${secondary}`,
          sourceText: clause,
          confidence: 'explicit',
        }),
      );
    }
  }

  const contrastMatch =
    normalized.match(/(?:嘴上|总说|明明说)(.{1,6}?)(?:，|,)?(?:其实|还是|最后)(.{1,12})/u) ||
    normalized.match(/(.{1,6}?)(?:但|结果|最后)还是(.{1,10})/u);
  if (contrastMatch?.[1] && contrastMatch?.[2]) {
    const primary = trimFact(contrastMatch[1]);
    const secondary = trimFact(contrastMatch[2]);
    if (!isWeakAction(primary) && !isWeakAction(secondary)) {
      facts.push(
        buildFact({
          category: 'contrast',
          style: 'observation',
          primary,
          secondary,
          source,
          topicKey: `contrast:${primary}:${secondary}`,
          sourceText: clause,
          confidence: 'explicit',
        }),
      );
    }
  }

  return facts;
}

function buildFact({
  category,
  style,
  primary,
  secondary,
  source,
  topicKey,
  sourceText,
  confidence,
}: {
  category: RememberedCategory;
  style: RememberedStyle;
  primary: string;
  secondary?: string;
  source: TextSource;
  topicKey: string;
  sourceText: string;
  confidence: 'explicit' | 'repeated';
}): ExtractedFact {
  return {
    category,
    style,
    primary,
    secondary,
    timestamp: source.timestamp,
    sourceKind: source.kind,
    sourceText,
    topicKey,
    confidence,
  };
}

function renderFact(fact: ExtractedFact, persona: PersonaFlavor) {
  const context: TemplateContext = {
    primary: fact.primary,
    secondary: fact.secondary,
  };

  const templates =
    fact.style === 'documentary'
      ? DOCUMENTARY_TEMPLATE_BANK[fact.category as keyof typeof DOCUMENTARY_TEMPLATE_BANK]
      : OBSERVATION_TEMPLATE_BANK[fact.category as keyof typeof OBSERVATION_TEMPLATE_BANK];

  if (!templates?.length) return null;

  const template = templates[hashString(`${fact.topicKey}-${fact.timestamp}`) % templates.length];
  const text = template(context).replace(/\s+/gu, '').trim();
  return applyPersonaFlavor(text, persona);
}

function inferPersonaFlavor(partner: Character): PersonaFlavor {
  const corePersona = buildCharacterContext({ character: partner }).corePersona || '';
  const text = `${corePersona} ${partner.signature || ''} ${partner.openingRemark || ''}`;
  if (/(傲娇|嘴硬|别扭|毒舌)/u.test(text)) return 'tsundere';
  if (/(黏人|撒娇|小狗|直球)/u.test(text)) return 'clingy';
  if (/(温柔|体贴|治愈|耐心|柔软)/u.test(text)) return 'gentle';
  return 'cool';
}

function matchKeyword(text: string, keywords: string[]) {
  return keywords.find((keyword) => text.includes(keyword)) || null;
}

function extractObjectAfterVerb(text: string, verbs: string[]) {
  for (const verb of verbs) {
    const escaped = escapeRegExp(verb);
    const match = text.match(new RegExp(`${escaped}([\\u4e00-\\u9fa5A-Za-z0-9]{2,10})`, 'u'));
    const candidate = normalizeExtractedObject(match?.[1] || '');
    if (candidate) return candidate;
  }
  return null;
}

function extractRepeatedMention(text: string, keywords: string[]) {
  if (!/(又提过|又提到|后来又提|还提过|还是点了|还是选了|又点了)/u.test(text)) return null;
  return matchKeyword(text, keywords);
}

function normalizeExtractedObject(value: string) {
  const cleaned = value.replace(/(了|吗|吧|呀|啊|呢|哦|啦|欸)$/u, '').trim();
  if (!cleaned || cleaned.length < 2) return null;
  if (WEAK_OBJECT_WORDS.includes(cleaned)) return null;
  return cleaned.slice(0, 10);
}

function trimFact(value: string) {
  return value.replace(/[，。！？；,.!?]/gu, '').trim().slice(0, 12);
}

function dedupeFacts(facts: ExtractedFact[]) {
  const seen = new Set<string>();
  return facts.filter((fact) => {
    const key = `${fact.style}:${fact.topicKey}:${fact.timestamp}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectRepeatedTopicKeys(facts: ExtractedFact[]) {
  const counts = new Map<string, number>();
  facts.forEach((fact) => {
    counts.set(fact.topicKey, (counts.get(fact.topicKey) || 0) + 1);
  });
  return new Set(Array.from(counts.entries()).filter(([, count]) => count >= 2).map(([key]) => key));
}

function canUseFact(fact: ExtractedFact, repeatedTopicKeys: Set<string>) {
  if (fact.category === 'reminder') {
    return fact.confidence === 'explicit' || repeatedTopicKeys.has(fact.topicKey);
  }
  return true;
}

function getSourceLabel(sourceKind: RememberedSourceKind) {
  switch (sourceKind) {
    case 'chat':
      return '来自聊天';
    case 'letter':
      return '来自情书';
    case 'note':
      return '来自互记';
    case 'post':
      return '来自动态';
    case 'message':
      return '来自留言板';
    default:
      return '来自记录';
  }
}

function isConcreteFact(fact: ExtractedFact) {
  if (fact.style === 'documentary') {
    return fact.primary.length >= 2 && !isWeakNoun(fact.primary);
  }
  if (fact.category === 'reminder') {
    return Boolean(
      fact.primary &&
        fact.secondary &&
        fact.primary.length >= 2 &&
        fact.secondary.length >= 2 &&
        !isWeakReminderPart(fact.primary) &&
        !isWeakReminderPart(fact.secondary),
    );
  }
  if (fact.category === 'habit' || fact.category === 'contrast') {
    return Boolean(
      fact.primary &&
        fact.secondary &&
        fact.primary.length >= 2 &&
        fact.secondary.length >= 2 &&
        !isWeakAction(fact.primary) &&
        !isWeakAction(fact.secondary),
    );
  }
  return false;
}

function isWeakNoun(value: string) {
  return WEAK_OBJECT_WORDS.includes(value);
}

function isWeakAction(value: string) {
  return (
    value.length < 2 ||
    ['一下', '一点', '那个', '这个', '事情', '东西', '认真', '在意', '喜欢', '想过'].includes(value)
  );
}

function isWeakReminderPart(value: string) {
  return (
    value.length < 2 ||
    ['不舒服', '难受', '不开心', '有点累', '有点烦', '身体不好', '状态不好', '那个时候'].includes(value)
  );
}

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function isTooCloseToSource(text: string, source: string) {
  const cleanText = text.replace(/\s+/gu, '');
  const cleanSource = source.replace(/\s+/gu, '');
  if (!cleanText || !cleanSource) return false;
  return cleanSource.includes(cleanText);
}

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractReminderFact(normalized: string, source: TextSource, clause: string): ExtractedFact | null {
  const explicitPatterns: Array<{ regex: RegExp; primaryIndex: number; secondaryIndex: number }> = [
    { regex: /(?:我|自己)(经期前|来姨妈前|姨妈前|生理期前)(?:会|总会|容易)(肚子痛|肚子疼|不舒服|难受)/u, primaryIndex: 1, secondaryIndex: 2 },
    { regex: /(?:我|自己)(空腹喝咖啡|熬夜后|换季的时候|忙起来)(?:会|总会|容易)(胃疼|胃痛|头疼|过敏|忘记吃饭)/u, primaryIndex: 1, secondaryIndex: 2 },
    { regex: /(?:我|自己)(压力大|累的时候|不开心的时候)(?:会|就会|容易)(睡得晚|安静下来|不太说话)/u, primaryIndex: 1, secondaryIndex: 2 },
  ];

  for (const pattern of explicitPatterns) {
    const match = normalized.match(pattern.regex);
    if (!match?.[pattern.primaryIndex] || !match?.[pattern.secondaryIndex]) continue;

    const primary = trimFact(match[pattern.primaryIndex]);
    const secondary = trimFact(match[pattern.secondaryIndex]);
    if (isWeakReminderPart(primary) || isWeakReminderPart(secondary)) continue;

    return buildFact({
      category: 'reminder',
      style: 'observation',
      primary,
      secondary,
      source,
      topicKey: `reminder:${primary}:${secondary}`,
      sourceText: clause,
      confidence: 'explicit',
    });
  }

  const repeatedPatterns: Array<{ regex: RegExp; primaryIndex: number; secondaryIndex: number }> = [
    { regex: /(忙起来)(?:就|会|容易)(忘记吃饭)/u, primaryIndex: 1, secondaryIndex: 2 },
    { regex: /(空腹喝咖啡)(?:会|就会|容易)(胃疼|胃痛|难受)/u, primaryIndex: 1, secondaryIndex: 2 },
    { regex: /(换季的时候)(?:会|就会|容易)(过敏)/u, primaryIndex: 1, secondaryIndex: 2 },
  ];

  for (const pattern of repeatedPatterns) {
    const match = normalized.match(pattern.regex);
    if (!match?.[pattern.primaryIndex] || !match?.[pattern.secondaryIndex]) continue;

    const primary = trimFact(match[pattern.primaryIndex]);
    const secondary = trimFact(match[pattern.secondaryIndex]);
    if (isWeakReminderPart(primary) || isWeakReminderPart(secondary)) continue;

    return buildFact({
      category: 'reminder',
      style: 'observation',
      primary,
      secondary,
      source,
      topicKey: `reminder:${primary}:${secondary}`,
      sourceText: clause,
      confidence: 'repeated',
    });
  }

  return null;
}
