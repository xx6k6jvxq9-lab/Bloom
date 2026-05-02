import type { Character } from '../../types';
import { buildCharacterForumFlavor } from './buildCharacterForumFlavor';

const BIO_PREFIX_TESTS = [
  { test: /高冷|克制|冷淡|寡言|疏离/u, values: ['慢回，但会看完。', '不爱热闹，偶尔留字。', '先旁听，必要时开口。'] },
  { test: /温柔|耐心|照顾|稳重|体贴/u, values: ['看见了会回，别急。', '深夜常在，慢慢说。', '不太会哄，但会接住话。'] },
  { test: /毒舌|嘴硬|阴阳|刻薄|呛/u, values: ['说话不太软，但没恶意。', '先吐槽两句，再认真回。', '偶尔嘴硬，基本都在。'] },
  { test: /活泼|跳脱|爱闹|嘴碎|开朗/u, values: ['路过爱插一句，也爱看热闹。', '楼里常驻，看到会接。', '先留一层，晚点再补。'] },
];

const BIO_SUFFIX_TESTS = [
  { test: /校园|图书馆|晚课|社团|宿舍/u, values: ['大多在晚课后和图书馆附近出没。', '白天装正常人，夜里才上线。'] },
  { test: /公司|工位|加班|项目|通勤/u, values: ['工位边上潜水，偶尔深夜诈尸。', '加班间隙会翻楼，凌晨更容易回。'] },
  { test: /仙|宗门|师门|心魔|破戒|劫/u, values: ['山门里外都混过，夜巡时更爱说话。', '平时收着，夜里容易露馅。'] },
  { test: /王府|侯府|礼法|婚约|旧朝|宅院/u, values: ['白天讲体面，夜里才说真话。', '席间不多言，散场后爱翻旧账。'] },
  { test: /赛博|日志|监控|权限|系统/u, values: ['常年蹲内网边角，日志比人诚实。', '有些话不在线下说，在线上反而敢留。'] },
  { test: /怪谈|规则|走廊|电梯|异响/u, values: ['凌晨更常在线，白天不一定算数。', '有些楼只在夜里看得懂。'] },
  { test: /末日|避难所|巡夜|感染|物资/u, values: ['巡夜后上线，语气可能不太温柔。', '补给和风声都看，活着就会回。'] },
  { test: /冥府|忘川|判官|引魂|生死簿/u, values: ['旧账多，记性也不差。', '平时不爱说破，真看不过眼会留话。'] },
  { test: /龙宫|海宴|潮声|珠匣|旧约/u, values: ['爱在海宴散场后上来说两句。', '水面平时安静，底下不一定。'] },
  { test: /副本|通关|高塔|组队|奖励/u, values: ['通关后容易失眠，所以会刷楼。', '副本里话少，论坛里稍微多一点。'] },
  { test: /神庭|神谕|司命|天规|降罚/u, values: ['规矩听得多，真心话不常见。', '表面守规矩，私下会留痕。'] },
  { test: /梦站|夜车|换乘|梦境|站台/u, values: ['夜里和清晨更容易碰见。', '有些话醒着不说，只在半梦里留着。'] },
  { test: /书中城|番外|设定|章节|作者/u, values: ['爱翻边角料，番外区常驻。', '正文里不说的话，偶尔会在这里补。'] },
  { test: /兽原|领地|气味|兽群|换毛/u, values: ['脾气看天，也看风向。', '不爱解释，但会认熟人。'] },
];

const DEFAULT_PREFIXES = ['偶尔冒头，常年潜水。', '看楼比发楼多，熟了会接话。', '不算高频在线，但看见会回。'];
const DEFAULT_SUFFIXES = ['有些话只在论坛里说。', '情绪稳定时很好相处。', '路过的楼多了，总会留下一点痕迹。'];

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickBySeed(values: string[], seed: string) {
  return values[hashString(seed) % values.length];
}

export function buildCharacterForumBio(character: Character) {
  const fingerprint = [
    character.signature || '',
    character.openingRemark || '',
    character.corePersona || '',
    character.expressionStyle || '',
    character.setting || '',
    character.sceneHints?.forum || '',
    character.memorySummary || '',
    character.longTermMemoryProfile || '',
  ].join(' ');

  const prefixPool = BIO_PREFIX_TESTS.find((item) => item.test.test(fingerprint))?.values || DEFAULT_PREFIXES;
  const suffixPool = BIO_SUFFIX_TESTS.find((item) => item.test.test(fingerprint))?.values || DEFAULT_SUFFIXES;
  const flavor = buildCharacterForumFlavor(character);

  const prefix = pickBySeed(prefixPool, `${character.id}:forum-bio-prefix`);
  const suffix = pickBySeed(suffixPool, `${character.id}:forum-bio-suffix`);
  const flavorLine = (
    flavor.dislikes[0] ? `${flavor.dislikes[0]}别来沾边` : ''
  ) || (
    flavor.likes[0] ? `${flavor.likes[0]}可以分一口` : ''
  ) || (
    flavor.skills[0] ? `${flavor.skills[0]}不算翻车` : ''
  ) || (
    flavor.identityHints[0] ? `${flavor.identityHints[0]}下班再说` : ''
  ) || (
    flavor.habits[0] ? `${flavor.habits[0]}时会来翻楼` : ''
  ) || (
    flavor.fragments[0] ? `${flavor.fragments[0]}这事别催我` : ''
  );
  const asideLine = (
    flavor.likes[1] ? `${flavor.likes[1]}也别跟我抢` : ''
  ) || (
    flavor.skills[1] ? `${flavor.skills[1]}这块勉强能管` : ''
  ) || (
    flavor.identityHints[1] ? `${flavor.identityHints[1]}值完班再回` : ''
  ) || '';

  const secondLine = asideLine || (flavorLine === prefix ? '' : prefix);

  return [flavorLine || prefix, secondLine, suffix]
    .filter(Boolean)
    .join('。')
    .replace(/。。+/g, '。')
    .replace(/。$/u, '')
    .concat('。');
}
