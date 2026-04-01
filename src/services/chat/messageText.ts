export const sanitizePipeMarkers = (text: string, replacement: '\n' | ' ' = '\n'): string => {
  const replaced = text.replace(/\s*\|\|\|\s*/g, replacement);
  return replacement === '\n'
    ? replaced.replace(/\r?\n{3,}/g, '\n\n').trim()
    : replaced.replace(/[ \t]{2,}/g, ' ').trim();
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
