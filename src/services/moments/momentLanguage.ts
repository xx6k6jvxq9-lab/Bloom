import type { Character } from '../../types';
import { getLegacyTranslationParts } from '../chat/messageText';

export type MomentLanguagePlan = {
  outputLanguage?: string;
  needsTranslation: boolean;
};

export function isChineseLanguageName(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase() || '';
  if (!normalized) {
    return false;
  }

  return [
    '中文',
    '汉语',
    '普通话',
    '简体中文',
    '繁体中文',
    'chinese',
    'mandarin',
    'simplified chinese',
    'traditional chinese',
  ].includes(normalized);
}

export function resolveMomentLanguagePlan(character: Pick<Character, 'replyLanguageMode' | 'nativeLanguage' | 'fixedReplyLanguage'>): MomentLanguagePlan {
  if (character.replyLanguageMode === 'fixed') {
    const fixedLanguage = character.fixedReplyLanguage?.trim();
    if (fixedLanguage && !isChineseLanguageName(fixedLanguage)) {
      return {
        outputLanguage: fixedLanguage,
        needsTranslation: true,
      };
    }
  }

  if (character.replyLanguageMode === 'native-first') {
    const nativeLanguage = character.nativeLanguage?.trim();
    if (nativeLanguage && !isChineseLanguageName(nativeLanguage)) {
      return {
        outputLanguage: nativeLanguage,
        needsTranslation: true,
      };
    }
  }

  return {
    needsTranslation: false,
  };
}

export function buildMomentTranslationInstruction(languagePlan: MomentLanguagePlan): string[] {
  if (!languagePlan.needsTranslation || !languagePlan.outputLanguage) {
    return [];
  }

  return [
    `Write the final published moment body in ${languagePlan.outputLanguage}.`,
    'After the full body, output `---TRANSLATION---` on a new line, then give a natural Simplified Chinese translation of the whole post.',
    'Do not add labels, explanations, or language notes outside the `---TRANSLATION---` split.',
  ];
}

export function splitMomentTranslationParts(text: string) {
  const parts = getLegacyTranslationParts(text);
  return {
    mainText: parts.mainText.trim(),
    translation: parts.translation.trim(),
  };
}
