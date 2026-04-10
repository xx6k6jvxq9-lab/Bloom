export const sanitizePipeMarkers = (text: string, replacement: '\n' | ' ' = '\n'): string => {
  const replaced = text.replace(/\s*\|\|\|\s*/g, replacement);
  return replacement === '\n'
    ? replaced.replace(/\r?\n{3,}/g, '\n\n').trim()
    : replaced.replace(/[ \t]{2,}/g, ' ').trim();
};

const BRACKET_ACTION_REGEX = /[（(]([^（）()\n]{1,80})[）)]/gu;

export const normalizeBracketActionTextForPrompt = (text: string): string => {
  const normalized = text.trim();
  if (!normalized) {
    return '';
  }

  const actionMatches = Array.from(normalized.matchAll(BRACKET_ACTION_REGEX))
    .map((match) => match[1]?.trim() || '')
    .filter(Boolean);

  if (actionMatches.length === 0) {
    return normalized;
  }

  const actionOnlyRemainder = normalized.replace(BRACKET_ACTION_REGEX, '').replace(/[\s，,、。！？!?；;]+/gu, '');
  const actionBlock = `【对方动作/场景补充】${actionMatches.join('；')}`;

  if (!actionOnlyRemainder) {
    return actionBlock;
  }

  const plainText = normalized.replace(BRACKET_ACTION_REGEX, ' ').replace(/\s{2,}/g, ' ').trim();
  if (!plainText) {
    return actionBlock;
  }

  return `${plainText}\n${actionBlock}`;
};

export const getLegacyTranslationParts = (text: string): { mainText: string; translation: string } => {
  const parts = text.split('---TRANSLATION---');
  if (parts.length > 1 && parts[0].trim() !== parts[1].trim()) {
    return {
      mainText: parts[0].trim(),
      translation: parts.slice(1).join('---TRANSLATION---').trim(),
    };
  }

  return {
    mainText: text.trim(),
    translation: '',
  };
};
