type VoiceSampleLike = {
  name?: string | null;
  type?: string | null;
};

const VOICE_SAMPLE_EXTENSIONS = [
  'mp3',
  'wav',
  'm4a',
  'aac',
  'ogg',
  'oga',
  'opus',
  'flac',
  'amr',
  '3gp',
  '3gpp',
  'caf',
  'aif',
  'aiff',
  'm4b',
  'weba',
  'webm',
] as const;

const AUDIO_MIME_OVERRIDES = new Set([
  'application/mp4',
  'application/m4a',
  'audio/mp4',
  'audio/x-m4a',
  'audio/x-caf',
  'audio/amr',
  'audio/3gpp',
  'video/3gpp',
]);

const VOICE_SAMPLE_EXTENSION_SET = new Set<string>(VOICE_SAMPLE_EXTENSIONS);

export const VOICE_SAMPLE_INPUT_ACCEPT = [
  'audio/*',
  ...VOICE_SAMPLE_EXTENSIONS.map((extension) => `.${extension}`),
].join(',');

export function getVoiceSampleFileExtension(name?: string | null) {
  const trimmed = (name || '').trim().toLowerCase();
  const lastDotIndex = trimmed.lastIndexOf('.');
  if (lastDotIndex < 0 || lastDotIndex === trimmed.length - 1) {
    return '';
  }

  return trimmed.slice(lastDotIndex + 1);
}

export function isLikelyVoiceSampleFile(file: VoiceSampleLike) {
  const mimeType = (file.type || '').trim().toLowerCase();
  if (mimeType.startsWith('audio/') || AUDIO_MIME_OVERRIDES.has(mimeType)) {
    return true;
  }

  return VOICE_SAMPLE_EXTENSION_SET.has(getVoiceSampleFileExtension(file.name));
}

export function getVoiceSampleValidationMessage() {
  return '请上传音频文件，例如 mp3、wav、m4a、aac、amr、3gp、caf。';
}
