import type { Character, MomentImageCard } from '../../types';
import { buildCharacterContext } from '../relationship-context/buildCharacterContext';
import { rebuildSharedStateFromCharacter } from '../relationship-context/buildSharedCharacterState';

export type MomentPostMode = 'self_life' | 'relationship_carryover' | 'public_daily';
export type MomentPostShape =
  | 'short_status'
  | 'photo_dump'
  | 'multi_paragraph'
  | 'journal_note'
  | 'music_diary'
  | 'cheerful_share'
  | 'abstract_fragment'
  | 'tiny_complaint'
  | 'soft_claim';

export const MOMENT_POST_SHAPES: MomentPostShape[] = [
  'short_status',
  'photo_dump',
  'multi_paragraph',
  'journal_note',
  'music_diary',
  'cheerful_share',
  'abstract_fragment',
  'tiny_complaint',
  'soft_claim',
];

export type MomentPostBlueprint = {
  shape: MomentPostShape;
  shapeLabel: string;
  maxChars: number;
  allowImages: boolean;
  styleHints: string[];
  promptSections: string[];
  preferredTheme?: MomentImageCard['theme'];
  preferredLayout?: MomentImageCard['layout'];
};

type BuildMomentPostBlueprintOptions = {
  character: Character;
  requestText: string;
  mode: MomentPostMode;
  forceTextOnly?: boolean;
  allowedShapes?: MomentPostShape[];
  blockedShapes?: MomentPostShape[];
};

type ShapeDefinition = Omit<MomentPostBlueprint, 'shape'>;

const SHAPE_DEFINITIONS: Record<MomentPostShape, ShapeDefinition> = {
  short_status: {
    shapeLabel: '短状态 / 随手一发',
    maxChars: 84,
    allowImages: false,
    styleHints: [
      '控制在一到三句，像随手发出去的状态。',
      '允许口语、停顿和小情绪，不要写成过于完整的作文。',
      '看起来像角色刚好想发这一句，而不是在写文案。',
    ],
    promptSections: [
      '## 本次发布形态',
      '这次更适合发短状态：一两句就够，轻一点，像在动态流里顺手冒出来。',
    ],
    preferredTheme: 'polaroid',
    preferredLayout: 'card',
  },
  photo_dump: {
    shapeLabel: '九宫格 / 图多字少碎碎念',
    maxChars: 150,
    allowImages: true,
    styleHints: [
      '像发了一组图之后补上的配文，可以分成两到四小段。',
      '允许碎碎念、跳一下话题、补几件小事，但仍然要像同一条动态。',
      '不要写得太工整，像一口气发出来的朋友圈配文。',
    ],
    promptSections: [
      '## 本次发布形态',
      '这次更适合九宫格/图集配文：图是主体，字像在图片下面碎碎补充。',
      '可以分段，不要强行压成一句。',
    ],
    preferredTheme: 'film',
    preferredLayout: 'described-photo',
  },
  multi_paragraph: {
    shapeLabel: '分段长文 / 朋友圈正文',
    maxChars: 220,
    allowImages: true,
    styleHints: [
      '分成三到五段，每段一到三句，像真实朋友圈长文。',
      '允许情绪转折、停顿、自我修正和收尾时突然收住。',
      '内容要具体，少讲大道理，多写今天这一天是怎么落在身上的。',
    ],
    promptSections: [
      '## 本次发布形态',
      '这次可以写成长一些的分段正文，像朋友圈里会认真发的一条。',
      '重点不是华丽，而是真实、具体、有生活流。',
    ],
    preferredTheme: 'note',
    preferredLayout: 'card',
  },
  journal_note: {
    shapeLabel: '电子日记 / 夜里写给自己的记录',
    maxChars: 260,
    allowImages: true,
    styleHints: [
      '像写给自己看的日记片段，允许稍长、允许分段。',
      '可以有自我怀疑、整理、回看和慢慢说清楚自己的过程。',
      '不要故作深沉，要像一个平时真的会记东西的人。',
    ],
    promptSections: [
      '## 本次发布形态',
      '这次更像电子日记或备忘录记录，可以比普通动态长。',
      '允许段落之间有停顿和留白。',
    ],
    preferredTheme: 'note',
    preferredLayout: 'card',
  },
  music_diary: {
    shapeLabel: '配乐日记 / BGM 配文',
    maxChars: 180,
    allowImages: true,
    styleHints: [
      '像带一点 BGM 感的电子日记配文，语气轻一点。',
      '可以写照片、路上、风、夜色、耳机、今天的小片段。',
      '不需要押韵或装文艺，重点是节奏和氛围。',
    ],
    promptSections: [
      '## 本次发布形态',
      '这次更适合做成带一点 BGM/电子日记感的图文配文。',
      '可以分段，也可以用几行比较轻的句子把氛围拉出来。',
    ],
    preferredTheme: 'film',
    preferredLayout: 'described-photo',
  },
  cheerful_share: {
    shapeLabel: '积极分享 / 今天过得不错',
    maxChars: 170,
    allowImages: true,
    styleHints: [
      '整体亮一点，但不是鸡汤，不要硬抬价值。',
      '写具体的小开心、小满足、小顺利，像真的想记录一下。',
      '允许分成两三段，不要把积极写得像励志海报。',
    ],
    promptSections: [
      '## 本次发布形态',
      '这次更适合积极分享：像今天刚好有一点值得高兴，就顺手记下来。',
    ],
    preferredTheme: 'polaroid',
    preferredLayout: 'described-photo',
  },
  abstract_fragment: {
    shapeLabel: '抽象片段 / 怪一点但能读懂',
    maxChars: 210,
    allowImages: true,
    styleHints: [
      '允许有一点跳跃比喻、怪念头或轻微发疯感。',
      '要像真人会突然冒出来的奇怪表达，不要为了文艺硬拗。',
      '最好能落回一个具体生活细节，让这条动态站得住。',
    ],
    promptSections: [
      '## 本次发布形态',
      '这次可以怪一点、跳一点，但仍然要像真人会发的动态。',
      '抽象可以有，不能空。',
    ],
    preferredTheme: 'poster',
    preferredLayout: 'card',
  },
  tiny_complaint: {
    shapeLabel: '小吐槽 / 生活里的一点火气',
    maxChars: 132,
    allowImages: true,
    styleHints: [
      '可以吐槽，但不要只有情绪，要带生活现场感。',
      '像忙了一天的人顺手发两三段，不要写成段子合集。',
      '吐槽完最好有一点回落，不要整条都在炸。',
    ],
    promptSections: [
      '## 本次发布形态',
      '这次更适合轻吐槽：有一点火气，但还是生活里的人在说话。',
    ],
    preferredTheme: 'note',
    preferredLayout: 'card',
  },
  soft_claim: {
    shapeLabel: '公开偏爱 / 轻微站位',
    maxChars: 150,
    allowImages: true,
    styleHints: [
      '允许轻微公开偏爱、护短、站位或宣示一点关系存在感。',
      '即使和某个人有关，也仍然要像公开动态，不要像发私聊外溢。',
      '可以分段，但不要写成霸总宣言或肉麻告白。',
    ],
    promptSections: [
      '## 本次发布形态',
      '这次更适合公开偏爱/轻微站位：可以带一点关系余波，但要像朋友圈可见的表达。',
    ],
    preferredTheme: 'poster',
    preferredLayout: 'card',
  },
};

function hashString(input: string) {
  let value = 0;
  for (let index = 0; index < input.length; index += 1) {
    value = ((value << 5) - value + input.charCodeAt(index)) | 0;
  }
  return Math.abs(value);
}

function pickByHash<T>(items: T[], seed: string): T {
  return items[hashString(seed) % items.length];
}

function uniqueShapes(shapes: MomentPostShape[]) {
  const seen = new Set<MomentPostShape>();
  const result: MomentPostShape[] = [];
  for (const shape of shapes) {
    if (seen.has(shape)) {
      continue;
    }
    seen.add(shape);
    result.push(shape);
  }
  return result;
}

function getPersonaText(character: Character) {
  const context = buildCharacterContext({ character });
  const sharedState = rebuildSharedStateFromCharacter({
    character,
  });
  return [
    context.corePersona,
    character.expressionStyle,
    character.signature,
    character.openingRemark,
    sharedState.currentActivity,
    sharedState.publicCarryover,
    character.presenceState?.recentLifeBeat,
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}

function resolveShapeCandidates(options: BuildMomentPostBlueprintOptions): MomentPostShape[] {
  const sourceText = `${options.requestText}\n${getPersonaText(options.character)}`.toLowerCase();
  let candidates: MomentPostShape[];

  if (options.allowedShapes?.length) {
    candidates = uniqueShapes(options.allowedShapes);
  } else if (/短状态|一到三句|一两句|一句|短句|短配文|短夜记|轻状态|随手/.test(sourceText)) {
    candidates = ['short_status', 'tiny_complaint', 'cheerful_share', 'photo_dump'];
  } else if (/九宫格|图集|配图|照片|相册|截图|拼贴/.test(sourceText)) {
    candidates = ['photo_dump', 'music_diary', 'short_status'];
  } else if (/bgm|音乐|耳机|歌单|歌/.test(sourceText)) {
    candidates = ['music_diary', 'photo_dump', 'short_status'];
  } else if (/长文|分段|日记|记录|想法|感悟|夜里|备忘录|整理/.test(sourceText)) {
    candidates = ['multi_paragraph', 'journal_note', 'abstract_fragment'];
  } else if (/开心|顺利|高兴|好耶|庆祝|满足|治愈|轻松/.test(sourceText)) {
    candidates = ['cheerful_share', 'photo_dump', 'short_status'];
  } else if (/抽象|发疯|恍惚|失眠|夜风|空空|怪|漂浮|回音/.test(sourceText)) {
    candidates = ['abstract_fragment', 'journal_note', 'multi_paragraph'];
  } else if (/吐槽|上班|加班|工位|会议|无语|烦|火大|收工/.test(sourceText)) {
    candidates = ['tiny_complaint', 'photo_dump', 'multi_paragraph'];
  } else if (/偏爱|护短|吃醋|主权|某个人|余波|别碰|站位|宣誓/.test(sourceText)) {
    candidates = ['soft_claim', 'multi_paragraph', 'short_status'];
  } else if (options.mode === 'relationship_carryover') {
    candidates = ['soft_claim', 'multi_paragraph', 'short_status'];
  } else if (/爱写|记录|慢热|文艺|安静|克制/.test(sourceText)) {
    candidates = ['journal_note', 'multi_paragraph', 'short_status'];
  } else if (/活泼|外向|碎碎念|张扬|爱分享/.test(sourceText)) {
    candidates = ['photo_dump', 'cheerful_share', 'short_status'];
  } else if (/毒舌|吐槽|嘴硬|阴阳/.test(sourceText)) {
    candidates = ['tiny_complaint', 'short_status', 'photo_dump'];
  } else if (options.mode === 'self_life') {
    candidates = ['photo_dump', 'multi_paragraph', 'short_status'];
  } else {
    candidates = ['short_status', 'multi_paragraph', 'photo_dump'];
  }

  if (options.forceTextOnly) {
    candidates = candidates.filter((shape) => shape !== 'photo_dump' && shape !== 'music_diary');
  }

  if (options.blockedShapes?.length) {
    const blockedShapeSet = new Set(options.blockedShapes);
    candidates = candidates.filter((shape) => !blockedShapeSet.has(shape));
  }

  return candidates.length > 0 ? candidates : ['short_status'];
}

export function buildMomentPostBlueprint(options: BuildMomentPostBlueprintOptions): MomentPostBlueprint {
  const candidates = resolveShapeCandidates(options);
  const shape = pickByHash(
    candidates,
    `${options.character.id}:${options.requestText}:${options.mode}`,
  );
  const definition = SHAPE_DEFINITIONS[shape];

  return {
    shape,
    ...definition,
    allowImages: options.forceTextOnly ? false : definition.allowImages,
    styleHints: options.forceTextOnly
      ? [...definition.styleHints, '这次必须是纯文字动态，不要假装带图、截图、九宫格或伪图片说明。']
      : definition.styleHints,
    promptSections: options.forceTextOnly
      ? [...definition.promptSections, '这次是纯文字公开动态，不要写配图说明，也不要像在逐张解释图片。']
      : definition.promptSections,
    preferredLayout: options.forceTextOnly ? 'card' : definition.preferredLayout,
  };
}
