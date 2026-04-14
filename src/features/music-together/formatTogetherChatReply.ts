import type { ChatMessage } from "../../types";
import { getLegacyTranslationParts, sanitizePipeMarkers } from "../../services/chat/messageText";

function cleanReplyChunk(text: string): string {
  return text
    .replace(/^\s*(?:\d+\s*[.。、、]|[-*•])\s*/gmu, "")
    .replace(/^\s*\|+\s*$/gmu, "")
    .replace(/\r/g, "")
    .trim();
}

function splitIntoSentenceBubbles(text: string): string[] {
  const normalized = cleanReplyChunk(text);
  if (!normalized) {
    return [];
  }

  const lines = normalized
    .split(/\n+/)
    .map((line) => cleanReplyChunk(line))
    .filter(Boolean);

  return lines.flatMap((line) => {
    const segments = line.match(/[^。！？!?]+(?:[。！？!?]+|$)/g) ?? [line];
    return segments
      .map((segment) => cleanReplyChunk(segment))
      .filter(Boolean);
  });
}

export function formatTogetherReplyMessages(replyText: string, startedAt = Date.now()): ChatMessage[] {
  const { mainText } = getLegacyTranslationParts(replyText);
  const normalizedText = sanitizePipeMarkers(mainText, "\n");
  const bubbleTexts = splitIntoSentenceBubbles(normalizedText);

  if (bubbleTexts.length === 0) {
    return [
      {
        role: "model",
        text: normalizedText.trim() || "我还在听着呢，你再和我说一句试试。",
        timestamp: startedAt,
      },
    ];
  }

  return bubbleTexts.map((text, index) => ({
    role: "model",
    text,
    timestamp: startedAt + index,
  }));
}
