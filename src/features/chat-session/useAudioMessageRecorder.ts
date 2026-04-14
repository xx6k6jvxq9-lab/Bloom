import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const speechWindow = window as typeof window & {
    webkitSpeechRecognition?: SpeechRecognitionCtor;
    SpeechRecognition?: SpeechRecognitionCtor;
  };

  return speechWindow.webkitSpeechRecognition || speechWindow.SpeechRecognition || null;
}

function writeAsciiString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const channelCount = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const frameCount = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataLength = frameCount * blockAlign;
  const wavBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(wavBuffer);

  writeAsciiString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAsciiString(view, 8, 'WAVE');
  writeAsciiString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAsciiString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  const channelData = Array.from({ length: channelCount }, (_, index) => buffer.getChannelData(index));
  let offset = 44;

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channelIndex][frameIndex] || 0));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

async function normalizeRecordedAudioToWav(blob: Blob): Promise<Blob> {
  if (blob.type === 'audio/wav') {
    return blob;
  }

  const arrayBuffer = await blob.arrayBuffer();
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error('当前浏览器不支持音频解码');
  }

  const audioContext = new AudioContextCtor();
  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    return audioBufferToWavBlob(decoded);
  } finally {
    await audioContext.close().catch(() => undefined);
  }
}

function pickRecordingMimeType(): string {
  const preferredTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];

  for (const mimeType of preferredTypes) {
    if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return '';
}

type UseAudioMessageRecorderArgs = {
  onRecorded: (payload: { blob: Blob; durationMs: number; transcript?: string }) => void | Promise<void>;
};

type FinishRecordingOptions = {
  discard?: boolean;
};

export function useAudioMessageRecorder({
  onRecorded,
}: UseAudioMessageRecorderArgs) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const isStartingRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const discardRequestedRef = useRef(false);
  const transcriptRef = useRef('');
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const recognitionEndPromiseRef = useRef<Promise<void> | null>(null);
  const resolveRecognitionEndRef = useRef<(() => void) | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const finishRecording = useCallback((options?: FinishRecordingOptions) => {
    const shouldDiscard = Boolean(options?.discard);
    discardRequestedRef.current = discardRequestedRef.current || shouldDiscard;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      return;
    }

    if (isStartingRef.current) {
      stopRequestedRef.current = true;
    }
  }, []);

  const stopRecording = useCallback(() => {
    finishRecording();
  }, [finishRecording]);

  const cancelRecording = useCallback(() => {
    finishRecording({ discard: true });
  }, [finishRecording]);

  const stopRecognition = useCallback(async () => {
    if (!recognitionRef.current) {
      return;
    }

    const pendingEnd = recognitionEndPromiseRef.current;
    recognitionRef.current.stop();
    recognitionRef.current = null;

    if (!pendingEnd) {
      return;
    }

    await Promise.race([
      pendingEnd,
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, 1200);
      }),
    ]);
  }, []);

  const startRecognition = useCallback(() => {
    transcriptRef.current = '';
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      recognitionRef.current = null;
      recognitionEndPromiseRef.current = null;
      resolveRecognitionEndRef.current = null;
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = 'zh-CN';
      recognition.continuous = true;
      recognition.interimResults = false;
      recognitionRef.current = recognition;
      recognitionEndPromiseRef.current = new Promise<void>((resolve) => {
        resolveRecognitionEndRef.current = resolve;
      });

      recognition.onresult = (event: any) => {
        let combinedTranscript = '';
        for (let index = 0; index < (event?.results?.length || 0); index += 1) {
          const transcript = event?.results?.[index]?.[0]?.transcript?.trim?.() || '';
          if (transcript) {
            combinedTranscript += transcript;
          }
        }
        if (combinedTranscript) {
          transcriptRef.current = combinedTranscript.trim();
        }
      };

      recognition.onerror = (event: any) => {
        if (event?.error !== 'no-speech' && event?.error !== 'aborted') {
          console.warn('Speech recognition during audio record failed', event?.error);
        }
      };

      recognition.onend = () => {
        resolveRecognitionEndRef.current?.();
        resolveRecognitionEndRef.current = null;
        recognitionEndPromiseRef.current = null;
      };

      recognition.start();
    } catch (error) {
      console.warn('Unable to start speech recognition during recording', error);
      recognitionRef.current = null;
      recognitionEndPromiseRef.current = null;
      resolveRecognitionEndRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || isStartingRef.current) {
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      window.alert('当前浏览器不支持录音');
      return;
    }

    isStartingRef.current = true;
    stopRequestedRef.current = false;
    discardRequestedRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecordingMimeType();
      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      streamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      startRecognition();

      mediaRecorder.onstart = () => {
        isStartingRef.current = false;
        setIsRecording(true);

        if (stopRequestedRef.current) {
          mediaRecorder.stop();
        }
      };

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('Audio recording error', event);
        isStartingRef.current = false;
        stopRequestedRef.current = false;
        discardRequestedRef.current = false;
        setIsRecording(false);
        stopStream();
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        isStartingRef.current = false;
        stopRequestedRef.current = false;

        const durationMs = startedAtRef.current ? Math.max(Date.now() - startedAtRef.current, 0) : 0;
        startedAtRef.current = null;
        await stopRecognition();
        const transcript = transcriptRef.current.trim();
        transcriptRef.current = '';

        const rawBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        stopStream();
        mediaRecorderRef.current = null;

        if (discardRequestedRef.current) {
          discardRequestedRef.current = false;
          return;
        }

        if (rawBlob.size === 0) {
          return;
        }

        try {
          const wavBlob = await normalizeRecordedAudioToWav(rawBlob);
          await onRecorded({ blob: wavBlob, durationMs, transcript: transcript || undefined });
        } finally {
          discardRequestedRef.current = false;
        }
      };

      mediaRecorder.start();

      if (stopRequestedRef.current) {
        mediaRecorder.stop();
      }
    } catch (error) {
      console.error('Unable to start audio recording', error);
      window.alert('无法开始录音，请检查麦克风权限');
      isStartingRef.current = false;
      stopRequestedRef.current = false;
      discardRequestedRef.current = false;
      setIsRecording(false);
      stopStream();
    }
  }, [isRecording, onRecorded, startRecognition, stopRecognition, stopStream]);

  useEffect(() => () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      discardRequestedRef.current = true;
      mediaRecorderRef.current.stop();
    }
    recognitionRef.current?.stop();
    stopStream();
  }, [stopStream]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
