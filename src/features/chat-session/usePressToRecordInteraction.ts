import { useMemo } from 'react';

type UsePressToRecordInteractionArgs = {
  isRecording: boolean;
  startRecording: () => void | Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
};

export function usePressToRecordInteraction({
  isRecording,
  startRecording,
  stopRecording,
  cancelRecording,
}: UsePressToRecordInteractionArgs) {
  return useMemo(() => ({
    buttonLabel: isRecording ? '松开 发送' : '按住 说话',
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (typeof event.currentTarget.setPointerCapture === 'function') {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Ignore capture failures and still try to record.
        }
      }
      void startRecording();
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      if (typeof event.currentTarget.releasePointerCapture === 'function') {
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // Ignore release failures.
        }
      }
      stopRecording();
    },
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) => {
      if (typeof event.currentTarget.releasePointerCapture === 'function') {
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // Ignore release failures.
        }
      }
      cancelRecording();
    },
    onPointerLeave: () => {
      // Pointer capture keeps the interaction alive even if the finger slides
      // slightly outside the button bounds, so leaving the element should not
      // cancel the recording by itself.
    },
  }), [cancelRecording, isRecording, startRecording, stopRecording]);
}
