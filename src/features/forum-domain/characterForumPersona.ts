import type { Character } from '../../types';
import { FORUM_CHANNEL_LABELS } from './constants';
import type { ForumChannel } from './types';

const FORUM_HANDLE_SUFFIX_BANK = [
  '先别催',
  '晚点回',
  '刚路过',
  '先蹲着',
  '还醒着',
  '不装了',
  '在看楼',
  '别点我',
  '今天在线',
  '先旁听',
  '楼里见',
  '还没散',
] as const;

const FORUM_HANDLE_PREFIX_BANK = [
  '不想',
  '先别',
  '刚从',
  '又在',
  '今天',
  '凌晨',
  '路过',
  '下班后',
] as const;

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function buildReadableForumHandle(options: { id: string; name: string }) {
  const baseName = options.name
    .replace(/^网友/u, '')
    .replace(/^匿名/u, '')
    .replace(/\s+/g, '')
    .replace(/[^\p{Script=Han}A-Za-z0-9]+/gu, '')
    .slice(0, 4) || '路过';
  const seed = hashString(`${options.id}:${options.name}`);
  const suffix = FORUM_HANDLE_SUFFIX_BANK[seed % FORUM_HANDLE_SUFFIX_BANK.length];
  const prefix = FORUM_HANDLE_PREFIX_BANK[Math.floor(seed / 7) % FORUM_HANDLE_PREFIX_BANK.length];

  if (baseName.length <= 2) {
    return `${prefix}${baseName}${suffix}`.slice(0, 10);
  }
  if (seed % 3 === 0) {
    return `${baseName}${suffix}`.slice(0, 10);
  }
  if (seed % 3 === 1) {
    return `${prefix}${baseName}`.slice(0, 10);
  }
  return `${baseName}${suffix.slice(0, 2)}`.slice(0, 10);
}

export function buildForumCharacterHandle(character: Character) {
  const trimmedRemark = character.remarkName?.replace(/\s+/g, '').trim();
  if (trimmedRemark) return trimmedRemark.slice(0, 10);
  return buildReadableForumHandle({
    id: character.id,
    name: character.name,
  });
}

export function buildForumCharacterPostTitle(content: string) {
  const candidate = content
    .replace(/\s+/g, ' ')
    .split(/[。！？!?]/u)
    .map((part) => part.trim())
    .find(Boolean);

  if (!candidate) return '';
  return candidate.slice(0, 18);
}

export function inferCharacterForumChannelAffinity(character: Character): ForumChannel[] {
  const fingerprint = `${character.name} ${character.groupId || ''} ${character.signature || ''} ${character.corePersona || ''} ${character.setting || ''} ${character.sceneHints?.forum || ''}`;
  const matches: ForumChannel[] = [];

  if (/校园|打工|现实|日常|公司|上班|同学|都市/u.test(fingerprint)) matches.push('present');
  if (/侯府|王府|礼法|名分|宅院|旧朝|嫡|庶/u.test(fingerprint)) matches.push('oldDynasty');
  if (/仙|师门|心魔|情劫|飞升|破戒|宗门/u.test(fingerprint)) matches.push('xianmen');
  if (/异域|种族|冒险|旅团|精灵|兽人|王国/u.test(fingerprint)) matches.push('otherworld');
  if (/星舰|权限|监控|星海|白名单|系统|舰桥/u.test(fingerprint)) matches.push('starSea');
  if (/规则|怪谈|目击|异常|都市传说|禁忌/u.test(fingerprint)) matches.push('weird');
  if (/赛博|日志|接口|越权|芯片|终端|协议/u.test(fingerprint)) matches.push('cyber');

  if (matches.length > 0) return Array.from(new Set(matches));

  const fallbackChannels: ForumChannel[] = ['present', 'oldDynasty', 'xianmen', 'otherworld', 'starSea', 'weird', 'cyber', 'junction'];
  return [fallbackChannels[hashString(character.id) % fallbackChannels.length]];
}

export function buildCharacterForumHabit(character: Character, channel?: ForumChannel) {
  const affinity = inferCharacterForumChannelAffinity(character);
  const primaryChannel = channel && affinity.includes(channel) ? channel : affinity[0];
  const styleFingerprint = `${character.expressionStyle || ''} ${character.signature || ''} ${character.corePersona || ''} ${character.sceneHints?.forum || ''}`;
  const styleSeed = hashString(`${character.id}:${primaryChannel}`);

  const speakingStyle = character.expressionStyle?.trim()
    || (/高冷|克制|冷淡|寡言/u.test(styleFingerprint)
      ? '短句克制，偶尔冷冷补一句'
      : /毒舌|嘴硬|刻薄|阴阳/u.test(styleFingerprint)
        ? '带点阴阳和嘴硬，不会把话说满'
        : /温柔|稳重|照顾|耐心/u.test(styleFingerprint)
          ? '会认真接话，语气偏稳'
          : /活泼|爱闹|嘴碎|跳脱/u.test(styleFingerprint)
            ? '爱接梗，句子会更轻快一点'
            : styleSeed % 3 === 0
              ? '更像围观时顺手补一刀'
              : styleSeed % 3 === 1
                ? '会先观察再发言'
                : '更容易认真接话');

  const preferredMove = character.sceneHints?.forum?.trim()
    || (/建议|照顾|稳/u.test(styleFingerprint)
      ? '看到求助帖会认真给建议'
      : /高冷|权限|规则|冷/u.test(styleFingerprint)
        ? '更常丢一句判断，不会铺很长'
        : /嘴硬|毒舌|阴阳/u.test(styleFingerprint)
          ? '喜欢先质疑两句，再顺手补刀'
          : /活泼|爱闹|看戏/u.test(styleFingerprint)
            ? '很爱看戏接梗，偶尔也会起哄'
            : primaryChannel === 'oldDynasty'
              ? '擅长从礼法和名分角度下判断'
              : primaryChannel === 'xianmen'
                ? '常把话题往心动和破戒感上带'
                : primaryChannel === 'starSea'
                  ? '更爱用权限、边界和越界来判断关系'
                  : primaryChannel === 'weird'
                    ? '会先怀疑异常点，再决定站哪边'
                    : '更多是围观、接话和补充观察');

  const persona = [
    character.corePersona?.trim() || character.setting?.trim() || '',
    `论坛里更常出没在${FORUM_CHANNEL_LABELS[primaryChannel]}`,
    `发言习惯：${speakingStyle}`,
    `常见出手：${preferredMove}`,
  ].filter(Boolean).join('；');

  return {
    affinity,
    primaryChannel,
    persona,
    speakingStyle,
    preferredMove,
  };
}
