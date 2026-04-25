import { useCallback, useEffect, useState } from 'react';

import { APP_DIALOG_EVENT, type AppDialogRequest } from '../../utils';

export function useAppDialogBridge() {
  const [appDialog, setAppDialog] = useState<AppDialogRequest | null>(null);
  const [appDialogInput, setAppDialogInput] = useState('');

  useEffect(() => {
    const handleDialogRequest = (event: Event) => {
      const detail = (event as CustomEvent<AppDialogRequest>).detail;
      setAppDialogInput(detail.kind === 'prompt' ? detail.defaultValue || '' : '');
      setAppDialog(detail);
    };

    const originalAlert = window.alert;
    window.alert = (message?: unknown) => {
      window.dispatchEvent(new CustomEvent(APP_DIALOG_EVENT, {
        detail: {
          kind: 'alert',
          message: String(message ?? ''),
        } satisfies AppDialogRequest,
      }));
    };

    window.addEventListener(APP_DIALOG_EVENT, handleDialogRequest as EventListener);
    return () => {
      window.alert = originalAlert;
      window.removeEventListener(APP_DIALOG_EVENT, handleDialogRequest as EventListener);
    };
  }, []);

  const closeAppDialog = useCallback(() => {
    if (appDialog?.kind === 'alert') {
      appDialog.resolve?.();
    } else if (appDialog?.kind === 'confirm') {
      appDialog.resolve(false);
    } else if (appDialog?.kind === 'prompt') {
      appDialog.resolve(null);
    }
    setAppDialog(null);
  }, [appDialog]);

  const handleDialogConfirm = useCallback(() => {
    if (!appDialog) return;
    if (appDialog.kind === 'alert') {
      appDialog.resolve?.();
    } else if (appDialog.kind === 'confirm') {
      appDialog.resolve(true);
    } else if (appDialog.kind === 'prompt') {
      appDialog.resolve(appDialogInput);
    }
    setAppDialog(null);
  }, [appDialog, appDialogInput]);

  return {
    appDialog,
    appDialogInput,
    closeAppDialog,
    handleDialogConfirm,
    setAppDialogInput,
  };
}
