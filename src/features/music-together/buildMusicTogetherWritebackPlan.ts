import type { Character, ChatMessage, Song } from "../../types";
import type { FactTraceRecord } from "../../services/relationship-context/factTypes";
import type { RelationshipWaveRecord } from "../../services/relationship-context/types";
import { buildSharedStateWritePatch } from "../../services/relationship-context/buildSharedCharacterState";

type BuildMusicTogetherWritebackPlanInput = {
  character: Character;
  currentSong: Song | null;
  sessionHistory: ChatMessage[];
};

export type MusicTogetherWritebackPlan = {
  shortTermSummary?: string;
  relationshipWaves: RelationshipWaveRecord[];
  factTraces: FactTraceRecord[];
  sharedState?: Character['sharedState'];
};

const MUSIC_TOGETHER_SIGNAL_KEYWORDS = [
  "喜欢",
  "不喜欢",
  "想起",
  "回忆",
  "感觉",
  "心情",
  "歌词",
  "旋律",
  "节奏",
  "适合",
  "陪",
  "认真",
  "你在",
  "这首",
  "循环",
];

function countMeaningfulTurns(history: ChatMessage[]): number {
  return history.filter((message) => message.text.trim().length >= 4).length;
}

function hasMeaningfulCarryover(history: ChatMessage[]): boolean {
  if (countMeaningfulTurns(history) < 4) {
    return false;
  }

  const combinedText = history.map((message) => message.text).join("\n");
  return MUSIC_TOGETHER_SIGNAL_KEYWORDS.some((keyword) => combinedText.includes(keyword));
}

function buildCurrentAtmosphereLine(currentSong: Song, latestUserText: string | undefined): string {
  const topicSnippet = latestUserText
    ? latestUserText.slice(0, 24)
    : `你们刚围着《${currentSong.title}》聊了一段`;

  return `当前气氛：刚和用户一起听《${currentSong.title}》，话题还停在“${topicSnippet}”。`;
}

function buildResidualLine(currentSong: Song): string {
  return `短期余波：这轮共听留下了一点围绕《${currentSong.title}》的情绪和偏好余波，之后再聊音乐时可以自然承接。`;
}

function normalizeMessageText(message: ChatMessage | undefined): string {
  return (message?.text || "")
    .replace(/^\[(?:sticker|image|audio|表情包|图片|语音)\]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getLatestUserTopic(history: ChatMessage[]): string | undefined {
  return [...history]
    .reverse()
    .find((message) => message.role === "user" && normalizeMessageText(message))
    ?.text
    ?.replace(/^\[(?:sticker|image|audio|表情包|图片|语音)\]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
}

function inferPreferenceSummary(song: Song, history: ChatMessage[]): string | undefined {
  const latestUserMessage = [...history]
    .reverse()
    .find((message) => message.role === "user");
  const text = normalizeMessageText(latestUserMessage);

  if (!text) return undefined;
  if (/喜欢|好听|想循环|单曲循环|想再听|这首不错|爱听/.test(text)) {
    return `用户在一起听《${song.title}》时表达出偏喜欢这一首的倾向。`;
  }
  if (/不喜欢|一般|无感|不太行|想切歌|不想听/.test(text)) {
    return `用户在一起听《${song.title}》时表达出对这首歌偏保留的态度。`;
  }
  return undefined;
}

function buildRelationshipWaves(
  character: Character,
  currentSong: Song | null,
  history: ChatMessage[],
): RelationshipWaveRecord[] {
  if (!currentSong?.title || !hasMeaningfulCarryover(history)) {
    return [];
  }

  return [{
    sourceScene: "music_together",
    relationType: "character_user",
    sourceCharacterId: character.id,
    targetUser: true,
    eventKind: "shared_experience",
    valence: "positive",
    intensity: countMeaningfulTurns(history) >= 6 ? "medium" : "low",
    scope: "cross_scene_readable",
    summary: `你们刚一起听了《${currentSong.title}》，还留着一点共听后的情绪余波。`,
    timestamp: Date.now(),
    decayHint: "short",
  }];
}

function buildFactTraces(
  character: Character,
  currentSong: Song | null,
  history: ChatMessage[],
): FactTraceRecord[] {
  if (!currentSong?.title || !hasMeaningfulCarryover(history)) {
    return [];
  }

  const latestTopic = getLatestUserTopic(history) || `围着《${currentSong.title}》聊了一段`;
  const records: FactTraceRecord[] = [{
    sourceScene: "music_together",
    factType: "experience",
    subjectType: "user",
    subjectId: "user",
    relatedCharacterIds: [character.id],
    visibility: "cross_scene_readable",
    stability: "situational",
    confidence: "explicit",
    summary: `和${character.name}一起听《${currentSong.title}》时，话题停在“${latestTopic}”。`,
    timestamp: Date.now(),
    decayHint: "short",
  }];

  const preferenceSummary = inferPreferenceSummary(currentSong, history);
  if (preferenceSummary) {
    records.push({
      sourceScene: "music_together",
      factType: "preference",
      subjectType: "user",
      subjectId: "user",
      relatedCharacterIds: [character.id],
      visibility: "cross_scene_readable",
      stability: "situational",
      confidence: "explicit",
      summary: preferenceSummary,
      timestamp: Date.now(),
      decayHint: "medium",
    });
  }

  return records;
}

function buildShortTermMusicTogetherNote(
  currentSong: Song | null,
  history: ChatMessage[],
): string | undefined {
  if (!currentSong?.title || !hasMeaningfulCarryover(history)) {
    return undefined;
  }

  const latestUserText = [...history]
    .reverse()
    .find((message) => message.role === "user")
    ?.text
    ?.replace(/\s+/g, " ")
    .trim();

  return [
    buildCurrentAtmosphereLine(currentSong, latestUserText),
    buildResidualLine(currentSong),
  ].join("\n");
}

function mergeShortTermSummary(existingSummary: string | undefined, nextBlock: string): string {
  const existingLines = (existingSummary || "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const nextLines = nextBlock
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const merged = [...nextLines, ...existingLines].filter(
    (line, index, array) => array.indexOf(line) === index,
  );

  return merged.slice(0, 4).join("\n");
}

export function buildMusicTogetherWritebackPlan(
  input: BuildMusicTogetherWritebackPlanInput,
): MusicTogetherWritebackPlan {
  const nextShortTermBlock = buildShortTermMusicTogetherNote(
    input.currentSong,
    input.sessionHistory,
  );

  const relationshipWaves = buildRelationshipWaves(
    input.character,
    input.currentSong,
    input.sessionHistory,
  );
  const factTraces = buildFactTraces(
    input.character,
    input.currentSong,
    input.sessionHistory,
  );

  return {
    shortTermSummary: nextShortTermBlock
      ? mergeShortTermSummary(input.character.shortTermSummary, nextShortTermBlock)
      : undefined,
    relationshipWaves,
    factTraces,
    sharedState: buildSharedStateWritePatch({
      character: input.character,
      sourceScene: 'music_together',
      publicSummaries: relationshipWaves.map((item) => item.summary),
      privateSummaries: [
        ...relationshipWaves.map((item) => item.summary),
        ...factTraces.map((item) => item.summary),
        ...(nextShortTermBlock ? nextShortTermBlock.split(/\r?\n+/).map((line) => line.trim()).filter(Boolean) : []),
      ],
    }),
  };
}
