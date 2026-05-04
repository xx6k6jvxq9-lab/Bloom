import { useSyncExternalStore } from 'react';

export type AppKeyboardState = {
  keyboardVisible: boolean;
  keyboardInset: number;
  layoutViewportHeight: number;
  manualKeyboardAvoidanceEnabled: boolean;
  visualViewportHeight: number;
};

const DEFAULT_KEYBOARD_STATE: AppKeyboardState = {
  keyboardVisible: false,
  keyboardInset: 0,
  layoutViewportHeight: 0,
  manualKeyboardAvoidanceEnabled: false,
  visualViewportHeight: 0,
};

let currentKeyboardState: AppKeyboardState = DEFAULT_KEYBOARD_STATE;
const listeners = new Set<() => void>();

function emitKeyboardChange() {
  listeners.forEach((listener) => listener());
}

export function setAppKeyboardState(nextState: AppKeyboardState) {
  const changed = (
    currentKeyboardState.keyboardVisible !== nextState.keyboardVisible
    || currentKeyboardState.keyboardInset !== nextState.keyboardInset
    || currentKeyboardState.layoutViewportHeight !== nextState.layoutViewportHeight
    || currentKeyboardState.manualKeyboardAvoidanceEnabled !== nextState.manualKeyboardAvoidanceEnabled
    || currentKeyboardState.visualViewportHeight !== nextState.visualViewportHeight
  );

  if (!changed) {
    return;
  }

  currentKeyboardState = nextState;
  emitKeyboardChange();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return currentKeyboardState;
}

export function useAppKeyboard() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
