import type { ApiConfig, AppSettings, Character, ChatMessage, Song } from "../../types";
import { buildCharacterContext } from "../../services/relationship-context/buildCharacterContext";
import { buildChatPrompt } from "../../services/ai/prompts/builders/buildChatPrompt";
import { generateTextFromMessagesWithConfig } from "../../services/ai/runtimeClient";

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
};

export async function generateTogetherChatReply(
  params: GenerateTogetherChatReplyParams,
): Promise<string> {
  const activeConfig = resolveActiveMusicConfig();
  if (!activeConfig?.apiKey?.trim()) {
    throw new Error("还没有可用的 API 配置。");
  }

  const { character, userName, currentSong, togetherDuration, history } = params;
  const characterContext = buildCharacterContext({ character });
  const systemPrompt = buildChatPrompt({
    mode: "chat",
    characterCore: {
      characterSetting: characterContext.corePersona ?? "",
      maskPrompt: characterContext.maskPrompt,
      worldBookPrompt: characterContext.worldBookPrompt,
    },
    userContext: {
      userName,
    },
    memoryContext: {
      longTermMemoryProfile: character.longTermMemoryProfile || "",
    },
    recentContext: {
      shortTermSummary: character.shortTermSummary || "",
    },
    sections: [
      character.signature ? `角色签名：${character.signature}` : "",
      characterContext.expressionStyle ? `说话手感：${characterContext.expressionStyle}` : "",
      characterContext.boundaryPack ? `边界与禁区：${characterContext.boundaryPack}` : "",
      characterContext.extendedLore ? `补充设定：${characterContext.extendedLore}` : "",
      characterContext.sceneHints?.chat ? `单聊场景提示：${characterContext.sceneHints.chat}` : "",
      "## 一起听场景",
      `当前场景：你正在和用户 ${userName} 一起听歌聊天。`,
      `一起听对象：${character.name}`,
      `一起听时长：${togetherDuration}`,
      currentSong?.title ? `当前歌曲：${currentSong.title}` : "",
      currentSong?.artist ? `当前歌手：${currentSong.artist}` : "",
      currentSong?.duration ? `歌曲时长：${Math.floor(currentSong.duration / 60)}:${String(currentSong.duration % 60).padStart(2, "0")}` : "",
      "你要像这个角色本人在单聊里说话，不要写成客服、乐评、系统提示或旁白。",
      "回复要自然、口语化，围绕当前歌曲、此刻氛围、你们关系和对方刚说的话继续聊。",
    ].filter(Boolean),
  });

  const historyMessages = history.slice(-8).map((message) => ({
    role: message.role === "user" ? ("user" as const) : ("assistant" as const),
    content: message.text,
  }));

  const replyText = await generateTextFromMessagesWithConfig({
    activeConfig,
    messages: [{ role: "system", content: systemPrompt }, ...historyMessages],
  });

  return replyText.trim() || "我还在听着呢，你再和我说一句试试。";
}
