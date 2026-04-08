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

type UseSpeechRecognitionInputArgs = {
  onTranscript: (transcript: string) => void | Promise<void>;
};

export function useSpeechRecognitionInput({
  onTranscript,
}: UseSpeechRecognitionInputArgs) {
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startRecording = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      window.alert('当前浏览器不支持语音输入');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.onresult = (event: any) => {
      const transcript = event?.results?.[0]?.[0]?.transcript?.trim?.() || '';
      if (transcript) {
        void onTranscript(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event?.error);
      if (event?.error === 'not-allowed') {
        window.alert('无法访问麦克风，请先允许浏览器使用麦克风');
      }
      if (event?.error !== 'no-speech' && event?.error !== 'aborted') {
        setIsRecording(false);
      }
    };

    recognition.start();
  }, [onTranscript]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
