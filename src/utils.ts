import { ChatMessage } from './types';

export function getMessageMainText(message: ChatMessage): string {
  const text = message.text || '';
  const parts = text.split('---TRANSLATION---');
  if (parts.length > 1 && parts[0].trim() !== parts[1].trim()) {
    return parts[0].trim();
  }
  return text.trim();
}

export function extractImageUrls(text: string): string[] {
  if (!text) return [];

  const trimmedText = text.trim();
  if (!trimmedText) return [];

  // `data:` URLs often contain many commas and whitespace-free payload chunks.
  // Splitting them like regular text will truncate the payload into invalid URLs.
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(trimmedText)) {
    return [trimmedText];
  }

  const urls: string[] = [];
  const lines = trimmedText.split(/\n+/);

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    // Try to extract URL from markdown ![alt](url)
    const markdownMatch = line.match(/!\[.*?\]\((.*?)\)/);
    if (markdownMatch) {
      urls.push(markdownMatch[1]);
      continue;
    }
    
    // Try to extract URL from HTML <img src="url">
    const htmlMatch = line.match(/<img.*?src=["'](.*?)["']/);
    if (htmlMatch) {
      urls.push(htmlMatch[1]);
      continue;
    }
    
    // Try to extract any protocol URL (http, https, ipfs, data, etc)
    const urlMatch = line.match(/((?:https?|ftp|file|ipfs|data):[^\s"']+)/i);
    if (urlMatch) {
      urls.push(urlMatch[1]);
      continue;
    }
    
    // fallback to general URL match
    const generalMatch = line.match(/((?:[a-zA-Z0-9]+:)?\/\/[^\s"']+)/);
    if (generalMatch) {
      urls.push(generalMatch[1]);
      continue;
    }
    
    // If it's just a raw string that looks like a URL but missing protocol
    if (line.startsWith('//')) {
      urls.push('https:' + line);
      continue;
    }
    
    // If it's a base64 string without data: prefix (rare but possible)
    // We'll skip this to avoid false positives
  }
  
  return urls;
}

export function extractSingleImageUrl(text: string): string {
  const urls = extractImageUrls(text);
  return urls.length > 0 ? urls[0] : text.trim();
}

export const DEFAULT_WHITE_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect width="200" height="200" rx="100" fill="#ffffff"/>
    </svg>
  `);

export function getSummaryHistoryWindow(messages: ChatMessage[], memoryLimit?: number): ChatMessage[] {
  const baseWindow = memoryLimit || 20;
  const summaryWindow = Math.max(baseWindow * 2, 40);
  return messages.slice(-summaryWindow);
}

export const APP_DIALOG_EVENT = 'app-dialog-request';

export type AppDialogRequest =
  | {
      kind: 'alert';
      message: string;
      resolve?: () => void;
    }
  | {
      kind: 'confirm';
      message: string;
      resolve: (value: boolean) => void;
    }
  | {
      kind: 'prompt';
      message: string;
      defaultValue?: string;
      resolve: (value: string | null) => void;
    };

const dispatchAppDialog = (detail: AppDialogRequest) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APP_DIALOG_EVENT, { detail }));
};

export function showInAppAlert(message: string): Promise<void> {
  return new Promise((resolve) => {
    dispatchAppDialog({
      kind: 'alert',
      message,
      resolve,
    });
  });
}

export function showInAppConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    dispatchAppDialog({
      kind: 'confirm',
      message,
      resolve,
    });
  });
}

export function showInAppPrompt(message: string, defaultValue = ''): Promise<string | null> {
  return new Promise((resolve) => {
    dispatchAppDialog({
      kind: 'prompt',
      message,
      defaultValue,
      resolve,
    });
  });
}
