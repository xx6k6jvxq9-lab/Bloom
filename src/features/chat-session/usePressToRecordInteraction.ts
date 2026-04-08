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
    onPointerDown: () => {
      void startRecording();
    },
    onPointerUp: () => {
      stopRecording();
    },
    onPointerCancel: () => {
      cancelRecording();
    },
    onPointerLeave: () => {
      cancelRecording();
    },
  }), [cancelRecording, isRecording, startRecording, stopRecording]);
}
