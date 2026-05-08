import type { Character, ChatMessage, Song } from "../../types";
import type { BuildChatPromptOptions } from "../ai/prompts/builders/buildChatPrompt";
import { buildCharacterContext } from "../relationship-context/buildCharacterContext";
import { buildSharedCharacterStateFromCharacter } from "../relationship-context/buildSharedCharacterState";
import { buildResolvedMemoryLayers } from "../memory/buildResolvedMemoryLayers";

export type MusicTogetherLyricLine = {
  text: string;
  translation?: string;
};

export type BuildMusicTogetherSceneInputParams = {
  character: Character;
  userName: string;
  currentSong: Song | null;
  togetherDuration: string;
  directChatHistory?: ChatMessage[];
  currentLyric?: MusicTogetherLyricLine | null;
  nearbyLyrics?: MusicTogetherLyricLine[];
};

function formatSongDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatHistoryLines(
  history: ChatMessage[],
  characterName: string,
  userName: string,
): string {
  return history
    .map((message) => `${message.role === "user" ? userName : characterName}：${message.text}`)
    .join("\n");
}

function formatLyricLine(line: MusicTogetherLyricLine): string {
  return line.translation?.trim()
    ? `${line.text} / ${line.translation.trim()}`
    : line.text;
}

export function buildMusicTogetherSceneInput(
  params: BuildMusicTogetherSceneInputParams,
): BuildChatPromptOptions {
  const {
    character,
    userName,
    currentSong,
    togetherDuration,
    directChatHistory = [],
    currentLyric = null,
    nearbyLyrics = [],
  } = params;
  const characterContext = buildCharacterContext({ character });
  const memoryLayers = buildResolvedMemoryLayers(character);
  const sharedCharacterState = buildSharedCharacterStateFromCharacter({
    character,
  });
  const recentDirectHistory = directChatHistory.slice(-6);
  const lyricWindow = nearbyLyrics
    .map((line) => formatLyricLine(line))
    .filter(Boolean)
    .join("\n");

  return {
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
      longTermMemoryProfile: memoryLayers.longTermMemoryProfile || "",
      sharedCharacterStatePrompt: sharedCharacterState.directPrompt,
    },
    recentContext: {
      shortTermSummary: memoryLayers.shortTermSummary || "",
    },
    sections: [
      character.signature ? `角色签名：${character.signature}` : "",
      characterContext.expressionStyle ? `说话手感：${characterContext.expressionStyle}` : "",
      characterContext.boundaryPack ? `边界与禁区：${characterContext.boundaryPack}` : "",
      characterContext.extendedLore ? `补充设定：${characterContext.extendedLore}` : "",
      characterContext.sceneHints?.chat ? `单聊场景提示：${characterContext.sceneHints.chat}` : "",
      characterContext.sceneHints?.musicTogether
        ? `一起听场景提示：${characterContext.sceneHints.musicTogether}`
        : "",
      recentDirectHistory.length > 0
        ? `你和 ${userName} 最近单聊语气参考：\n${formatHistoryLines(recentDirectHistory, character.name, userName)}`
        : "",
      "## 一起听场景",
      `当前场景：你正在和 ${userName} 一起听歌聊天。`,
      `一起听对象：${character.name}`,
      `一起听时长：${togetherDuration}`,
      currentSong?.title ? `当前歌曲：${currentSong.title}` : "",
      currentSong?.artist ? `当前歌手：${currentSong.artist}` : "",
      currentSong?.duration ? `歌曲时长：${formatSongDuration(currentSong.duration)}` : "",
      currentLyric?.text ? `当前唱到的歌词：${formatLyricLine(currentLyric)}` : "",
      lyricWindow ? `当前歌词片段：\n${lyricWindow}` : "",
      "你要像这个角色本人在陪对方听歌时自然聊天，不要写成客服、乐评、系统提示或旁白。",
      "优先回应对方刚说的话，再结合当前歌曲、氛围、歌词片段和你们之间的熟悉感给出一句到两句自然回复。",
      "如果歌词正好能接住对方的话题，可以自然引用那层情绪，但不要大段复述歌词，更不要假装自己在逐字解说歌曲。",
    ].filter(Boolean),
  };
}
