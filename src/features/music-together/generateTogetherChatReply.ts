import type { ApiConfig, AppSettings, Character, ChatMessage, Song } from "../../types";
import { buildChatPrompt } from "../../services/ai/prompts/builders/buildChatPrompt";
import { generateTextFromMessagesWithConfig } from "../../services/ai/runtimeClient";
import {
  buildMusicTogetherSceneInput,
  type MusicTogetherLyricLine,
} from "../../services/scene-inputs/buildMusicTogetherSceneInput";
import { buildTogetherRuntimeMessages } from "./buildTogetherRuntimeMessages";

function resolveActiveMusicConfig(): ApiConfig | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem("ai_phone_settings");
    if (!raw) return null;
    const settings = JSON.parse(raw) as AppSettings;
    const configs = settings?.configs || [];
    if (!Array.isArray(configs) || configs.length === 0) return null;
    return configs.find((config) => config.id === settings.activeConfigId) || configs[0] || null;
  } catch (error) {
    console.error("Failed to resolve music chat config:", error);
    return null;
  }
}

type GenerateTogetherChatReplyParams = {
  character: Character;
  userName: string;
  currentSong: Song | null;
  togetherDuration: string;
  history: ChatMessage[];
  directChatHistory?: ChatMessage[];
  currentLyric?: MusicTogetherLyricLine | null;
  nearbyLyrics?: MusicTogetherLyricLine[];
};

export async function generateTogetherChatReply(
  params: GenerateTogetherChatReplyParams,
): Promise<string> {
  const activeConfig = resolveActiveMusicConfig();
  if (!activeConfig?.apiKey?.trim()) {
    throw new Error("还没有可用的 API 配置。");
  }

  const { character, userName, currentSong, togetherDuration, history } = params;
  const sceneInput = buildMusicTogetherSceneInput({
    character,
    userName,
    currentSong,
    togetherDuration,
    directChatHistory: params.directChatHistory,
    currentLyric: params.currentLyric,
    nearbyLyrics: params.nearbyLyrics,
  });
  const systemPrompt = buildChatPrompt(sceneInput);

  const historyMessages = buildTogetherRuntimeMessages(history);

  const replyText = await generateTextFromMessagesWithConfig({
    activeConfig,
    messages: [{ role: "system", content: systemPrompt }, ...historyMessages],
  });

  return replyText.trim() || "我还在听着呢，你再和我说一句试试。";
}
