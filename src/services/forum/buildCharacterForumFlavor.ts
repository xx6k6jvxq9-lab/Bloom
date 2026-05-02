import type { Character } from '../../types';

type CharacterForumFlavor = {
  likes: string[];
  dislikes: string[];
  skills: string[];
  habits: string[];
  identityHints: string[];
  fragments: string[];
};

function collectText(character: Character) {
  return [
    character.setting || '',
    character.corePersona || '',
    character.signature || '',
    character.openingRemark || '',
    character.expressionStyle || '',
    character.sceneHints?.forum || '',
    character.memorySummary || '',
    character.longTermMemoryProfile || '',
    character.globalMemory || '',
  ].join(' ');
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function matchAll(source: string, pattern: RegExp, limit = 6) {
  const values: string[] = [];
  for (const matched of source.matchAll(pattern)) {
    const value = (matched[1] || '').trim();
    if (!value) continue;
    values.push(value);
    if (values.length >= limit) break;
  }
  return values;
}

function collectByKeywords(source: string, keywords: string[], fallbackLabel: string) {
  return keywords
    .filter((keyword) => source.includes(keyword))
    .map(() => fallbackLabel);
}

function collectFragments(source: string) {
  return unique(
    source
      .split(/[，。！？；：、“”‘’\s/|,.;:()[\]{}<>《》【】]+/u)
      .map((part) => part.trim())
      .filter((part) => /[\p{Script=Han}]/u.test(part))
      .filter((part) => part.length >= 2 && part.length <= 10)
      .filter((part) => !/自己|我们|他们|这个|那个|因为|所以|真的|可能|有点|一下|就是|然后|已经|如果/u.test(part)),
  ).slice(0, 10);
}

export function buildCharacterForumFlavor(character: Character): CharacterForumFlavor {
  const source = collectText(character);

  const likes = unique([
    ...matchAll(source, /喜欢([\p{Script=Han}A-Za-z0-9]{2,8})/gu),
    ...matchAll(source, /爱吃([\p{Script=Han}A-Za-z0-9]{2,8})/gu),
    ...matchAll(source, /爱喝([\p{Script=Han}A-Za-z0-9]{2,8})/gu),
    ...collectByKeywords(source, ['蛋挞'], '蛋挞'),
    ...collectByKeywords(source, ['番外'], '番外'),
    ...collectByKeywords(source, ['热闹'], '热闹'),
  ]);

  const dislikes = unique([
    ...matchAll(source, /讨厌([\p{Script=Han}A-Za-z0-9]{2,8})/gu),
    ...matchAll(source, /不喜欢([\p{Script=Han}A-Za-z0-9]{2,8})/gu),
    ...collectByKeywords(source, ['光猎'], '光猎'),
    ...collectByKeywords(source, ['吵闹'], '吵闹'),
  ]);

  const skills = unique([
    ...matchAll(source, /擅长([\p{Script=Han}A-Za-z0-9]{2,8})/gu),
    ...matchAll(source, /会做([\p{Script=Han}A-Za-z0-9]{2,8})/gu),
    ...collectByKeywords(source, ['煮饭', '做饭', '下厨'], '做饭'),
    ...collectByKeywords(source, ['看店'], '看店'),
    ...collectByKeywords(source, ['读档'], '翻旧档'),
  ]);

  const habits = unique([
    ...matchAll(source, /常在([\p{Script=Han}A-Za-z0-9]{2,8})/gu),
    ...matchAll(source, /爱在([\p{Script=Han}A-Za-z0-9]{2,8})/gu),
    ...collectByKeywords(source, ['潜水'], '潜水'),
    ...collectByKeywords(source, ['围观'], '围观'),
    ...collectByKeywords(source, ['看热闹'], '看热闹'),
  ]);

  const identityHints = unique([
    ...matchAll(source, /([\p{Script=Han}A-Za-z0-9]{2,8}组长)/gu),
    ...matchAll(source, /([\p{Script=Han}A-Za-z0-9]{2,8}猎人)/gu),
    ...matchAll(source, /([\p{Script=Han}A-Za-z0-9]{2,8}骑士)/gu),
    ...matchAll(source, /([\p{Script=Han}A-Za-z0-9]{2,8}店长)/gu),
    ...collectByKeywords(source, ['猎人'], '猎人'),
    ...collectByKeywords(source, ['组长'], '组长'),
    ...collectByKeywords(source, ['骑士'], '骑士'),
    ...collectByKeywords(source, ['店长'], '店长'),
    ...collectByKeywords(source, ['前台'], '前台'),
    ...collectByKeywords(source, ['医生'], '医生'),
  ]);

  const fragments = collectFragments(source).filter((fragment) => (
    likes.every((item) => item !== fragment)
    && dislikes.every((item) => item !== fragment)
    && skills.every((item) => item !== fragment)
  ));

  return {
    likes,
    dislikes,
    skills,
    habits,
    identityHints,
    fragments,
  };
}
