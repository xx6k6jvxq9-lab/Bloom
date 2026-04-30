import type { ApiConfig } from '../../../types';
import { generateTextFromMessagesWithConfig } from '../runtimeClient';

type TranscribeSttAudioParams = {
  config: ApiConfig;
  audioBlob: Blob;
  prompt?: string;
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Unable to convert recorded audio into data URL.'));
    };
    reader.onerror = () => reject(reader.error || new Error('Unable to read recorded audio.'));
    reader.readAsDataURL(blob);
  });
}

function normalizeTranscript(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }

  const withoutFence = trimmed
    .replace(/^```(?:text|plaintext)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const withoutPrefix = withoutFence
    .replace(/^(?:transcript|transcription|识别结果|转写结果|转录结果)\s*[:：]\s*/i, '')
    .trim();
  const withoutQuotes = withoutPrefix
    .replace(/^["'“”‘’]+/, '')
    .replace(/["'“”‘’]+$/, '')
    .trim();

  if (/^(?:无法识别|无法转写|无法听清|未识别到|empty|null|none|n\/a)$/i.test(withoutQuotes)) {
    return '';
  }

  return withoutQuotes;
}

export async function transcribeSttAudio(
  params: TranscribeSttAudioParams,
): Promise<string> {
  const audioDataUrl = await blobToDataUrl(params.audioBlob);
  const rawTranscript = await generateTextFromMessagesWithConfig({
    activeConfig: params.config,
    temperature: 0,
    maxOutputTokens: 400,
    messages: [
      {
        role: 'system',
        content: params.prompt || [
          'You transcribe spoken audio into Simplified Chinese text.',
          'Return only the transcript itself.',
          'Do not add speaker labels, explanations, punctuation notes, or markdown.',
          'If the audio is mostly not Chinese, transcribe it in the original language.',
          'If the audio is unclear, return the best partial transcript you can hear.',
        ].join(' '),
      },
      {
        role: 'user',
        content: 'Please transcribe this audio message.',
        audioUrl: audioDataUrl,
        audioMimeType: params.audioBlob.type || 'audio/wav',
      },
    ],
  });

  return normalizeTranscript(rawTranscript);
}
