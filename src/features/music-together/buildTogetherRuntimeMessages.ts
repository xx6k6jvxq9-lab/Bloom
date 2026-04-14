import type { ChatMessage } from "../../types";
import type { RuntimeChatMessage } from "../../services/ai/runtimeClient";
import { describeStickerMessageForPrompt } from "../../services/chat/stickerSemantics";

function isStickerMessage(message: Pick<ChatMessage, "imageUrl" | "text">) {
  return !!message.imageUrl && /^\[(?:sticker|表情包)\]/i.test((message.text || "").trim());
}

function stripVisualMessageMarker(text?: string) {
  return (text || "").replace(/^\[(?:sticker|image|audio|表情包|图片|语音)\]\s*/i, "").trim();
}

function buildUserMessageContent(message: ChatMessage) {
  if (isStickerMessage(message)) {
    return describeStickerMessageForPrompt(message);
  }

  if (message.audioUrl) {
    const transcript = stripVisualMessageMarker(message.text);
    if (transcript) {
      return `[sent a voice message; transcript: ${transcript}]`;
    }
    return "[sent a voice message; infer the spoken content and emotional tone from the audio]";
  }

  if (message.imageUrl) {
    const caption = stripVisualMessageMarker(message.text);
    return caption ? `[sent an image; caption: ${caption}]` : "[sent an image]";
  }

  return message.text;
}

export function buildTogetherRuntimeMessages(history: ChatMessage[]): RuntimeChatMessage[] {
  return history.slice(-8).map((message) => ({
    role: message.role === "user" ? "user" : "assistant",
    content: message.role === "user" ? buildUserMessageContent(message) : message.text,
    ...(message.imageUrl ? { imageUrl: message.imageUrl } : {}),
    ...(message.audioUrl ? { audioUrl: message.audioUrl, audioMimeType: message.audioMimeType } : {}),
  }));
}
