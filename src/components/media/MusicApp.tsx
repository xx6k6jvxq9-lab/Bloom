import { Buffer } from "buffer";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence, Reorder } from "motion/react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Heart,
  ListMusic,
  User,
  Search,
  Plus,
  ChevronLeft,
  MoreHorizontal,
  MessageCircle,
  Users,
  Clock,
  Music as MusicIcon,
  Volume2,
  Share2,
  Disc,
  GripVertical,
  Trash2,
  X,
  Upload,
  RefreshCw,
} from "lucide-react";
import { showInAppConfirm } from "../../utils";
import {
  Song,
  Playlist,
  MusicData,
  MusicPlayerStylePreset,
  MusicPlayerShapePreset,
  Character,
  ChatMessage,
  ChatHistory,
  RelationshipAvatarBinding,
  UserAvatarLibrary,
  UserProfileExtended,
  VisualSettings,
  AppSettings,
  WorldBookEntry,
} from "../../types";
import { useResolvedPersistentValue } from "../../features/persistence/useResolvedPersistentValue";
import {
  resolveValueToDisplayUrl,
  saveUploadedBlob,
} from "../../features/persistence/persistentAssetService";
import { MusicSearchResults } from "../../features/music-search/MusicSearchResults";
import { NeteaseAccountPanel } from "../../features/music-netease/NeteaseAccountPanel";
import {
  parseNeteaseMediaInput,
  type NeteasePlaylistBinding,
} from "../../features/music-netease/neteaseAccount";
import { normalizeMusicCoverValue } from "../../features/music-netease/neteaseCover";
import { syncNeteasePlaylistsByUid } from "../../features/music-netease/syncNeteasePlaylists";
import { generateTogetherChatReply } from "../../features/music-together/generateTogetherChatReply";
import { formatTogetherReplyMessages } from "../../features/music-together/formatTogetherChatReply";
import { TogetherChatPanel } from "../../features/music-together/TogetherChatPanel";
import { buildMusicTogetherWritebackPlan } from "../../features/music-together/buildMusicTogetherWritebackPlan";
import { persistMusicTogetherEvidence } from "../../features/music-together/persistMusicTogetherEvidence";
import { resolveUserAvatarForScene } from "../../services/user-avatar/userAvatarState";
import {
  hasTimedLyricLines,
  normalizeLyricText,
  parseLyricText,
  pickPrimaryLyricText,
  type ParsedLyricLine,
} from "../../features/music/localLyrics";

const LOCAL_MUSIC_PLACEHOLDER_ART = "https://picsum.photos/seed/music_local/300/300";
const LOCAL_MUSIC_ARTIST_LABEL = "本地音乐";

type PlayerStyleOption = {
  id: MusicPlayerStylePreset;
  name: string;
  chip: string;
  badge: string;
  description: string;
  previewClassName: string;
};

type PlayerShapeOption = {
  id: MusicPlayerShapePreset;
  name: string;
  chip: string;
  description: string;
};

const PLAYER_STYLE_OPTIONS: PlayerStyleOption[] = [
  {
    id: "ios-air",
    name: "iOS 玻璃",
    chip: "默认",
    badge: "AIR",
    description: "轻磨砂、留白更多，像系统级 Now Playing。",
    previewClassName: "bg-[linear-gradient(140deg,#f4f8fc_0%,#dce7f0_48%,#bccedc_100%)]",
  },
  {
    id: "netease-film",
    name: "网易云胶片",
    chip: "情绪",
    badge: "FILM",
    description: "更像纵向胶片封面，底部信息更有情绪感。",
    previewClassName: "bg-[linear-gradient(160deg,#26161b_0%,#5d2635_48%,#f06b8f_100%)]",
  },
  {
    id: "aurora-stream",
    name: "流媒体极光",
    chip: "极光",
    badge: "AURORA",
    description: "封面光晕更明显，整体更像主流流媒体播放器。",
    previewClassName: "bg-[linear-gradient(145deg,#0d1720_0%,#0f4f4a_50%,#7af4c2_100%)]",
  },
  {
    id: "magazine-poster",
    name: "杂志海报",
    chip: "海报",
    badge: "POSTER",
    description: "把歌名做得更醒目，封面更像编辑页海报。",
    previewClassName: "bg-[linear-gradient(145deg,#f8f4ef_0%,#e8d7c4_42%,#b58c64_100%)]",
  },
];

const PLAYER_SHAPE_OPTIONS: PlayerShapeOption[] = [
  {
    id: "rounded-square",
    name: "圆角方形",
    chip: "经典",
    description: "最像主流音乐 App 的大封面卡片，稳妥、通用。",
  },
  {
    id: "circle",
    name: "圆形黑胶",
    chip: "唱片",
    description: "更拟物，像黑胶唱片或复古播放器的舞台感。",
  },
  {
    id: "poster",
    name: "竖版海报",
    chip: "海报",
    description: "更像胶片封面、歌词海报或编辑页竖版视觉。",
  },
];

const PLAYER_STYLE_MARKET_NOTES: Record<MusicPlayerStylePreset, {
  inspiration: string;
  detail: string;
}> = {
  "ios-air": {
    inspiration: "参考 Apple Music 那种系统级玻璃 Now Playing。",
    detail: "适合做大封面、歌词页和清爽留白，圆角方形最像主流系统播放器。",
  },
  "netease-film": {
    inspiration: "参考网易云的情绪氛围，再叠一点 QQ 音乐的歌词海报感。",
    detail: "更适合做竖版胶片、情绪化底色和更重的氛围层。",
  },
  "aurora-stream": {
    inspiration: "参考 YouTube Music / Spotify 一类的大面积背景光晕。",
    detail: "更适合沉浸背景、发光封面和偏流媒体的大场景播放器。",
  },
  "magazine-poster": {
    inspiration: "参考 QQ 音乐歌词海报、酷狗主题换肤里的竖版海报感。",
    detail: "更适合把标题做得更像编辑页海报，竖版海报形状会最强。",
  },
};

type NeteaseLyricResponse = {
  lrc?: {
    lyric?: string;
  };
  tlyric?: {
    lyric?: string;
  };
};

type NeteaseSearchTrack = {
  id: number | string;
  name?: string;
  ar?: Array<{ name?: string }>;
  artists?: Array<{ name?: string }>;
};

type NeteaseSearchResponse = {
  result?: {
    songs?: NeteaseSearchTrack[];
  };
};

function stripFileExtension(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, "").trim();
}

function inferSongIdentityFromFileName(fileName: string) {
  const baseName = stripFileExtension(fileName);
  const parts = baseName
    .split(/\s*[-–—｜|/]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      artist: parts[0],
      title: parts.slice(1).join(" - "),
    };
  }

  return {
    artist: LOCAL_MUSIC_ARTIST_LABEL,
    title: baseName,
  };
}

function isAudioUploadFile(file: File): boolean {
  return file.type.startsWith("audio/") || /\.(?:mp3|wav|flac|m4a|aac|ogg|oga|opus|webm)$/i.test(file.name);
}

function isLyricUploadFile(file: File): boolean {
  return /\.(?:lrc|txt)$/i.test(file.name);
}

function pickSidecarLyricFile(files: File[], audioFile: File): File | undefined {
  const audioBaseName = stripFileExtension(audioFile.name).toLowerCase();

  return files.find((file) => {
    if (!isLyricUploadFile(file)) {
      return false;
    }

    return stripFileExtension(file.name).toLowerCase() === audioBaseName;
  }) || files.find((file) => isLyricUploadFile(file));
}

function isGenericLocalArtist(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return !normalized || normalized === LOCAL_MUSIC_ARTIST_LABEL.toLowerCase() || normalized === "local music";
}

function ensureMusicMetadataBrowserGlobals() {
  const globalHost = globalThis as typeof globalThis & {
    Buffer?: typeof Buffer;
  };

  if (!globalHost.Buffer) {
    globalHost.Buffer = Buffer;
  }
}

function buildSongLyricQueries(song: Song): string[] {
  const queries: string[] = [];
  const pushQuery = (value: string | null | undefined) => {
    const normalized = value?.replace(/\s+/g, " ").trim();
    if (!normalized || queries.includes(normalized)) {
      return;
    }
    queries.push(normalized);
  };

  const title = song.title?.trim() || "";
  const artist = song.artist?.trim() || "";

  if (title && artist && !isGenericLocalArtist(artist)) {
    pushQuery(`${title} ${artist}`);
    pushQuery(`${artist} ${title}`);
  }

  if (title) {
    pushQuery(title);
    pushQuery(title.replace(/\s*[-–—｜|/]\s*/g, " "));
  }

  return queries;
}

function mergeLyricTranslations(
  lyricLines: ParsedLyricLine[],
  translationLines: ParsedLyricLine[],
): ParsedLyricLine[] {
  if (
    lyricLines.length === 0
    || translationLines.length === 0
    || !hasTimedLyricLines(lyricLines)
    || !hasTimedLyricLines(translationLines)
  ) {
    return lyricLines;
  }

  return lyricLines.map((line) => {
    if (line.time === null) {
      return line;
    }

    const translationMatch = translationLines.find((translation) => (
      translation.time !== null
      && Math.abs(translation.time - line.time) < 0.5
      && translation.text.trim()
      && translation.text !== line.text
    ));

    return translationMatch
      ? { ...line, translation: translationMatch.text.trim() }
      : line;
  });
}

async function fetchNeteaseLyricsById(neteaseId: string): Promise<ParsedLyricLine[]> {
  const response = await fetch(`/api/netease/lyric?id=${encodeURIComponent(neteaseId)}`);
  if (!response.ok) {
    throw new Error("Failed to fetch lyrics");
  }

  const data = await response.json() as NeteaseLyricResponse;
  const primaryLyrics = parseLyricText(data.lrc?.lyric);
  const translationLyrics = parseLyricText(data.tlyric?.lyric);

  return mergeLyricTranslations(primaryLyrics, translationLyrics);
}

async function searchNeteaseLyricsForSong(song: Song): Promise<ParsedLyricLine[]> {
  const queries = buildSongLyricQueries(song);

  for (const query of queries) {
    const response = await fetch(
      `/api/netease/search?keywords=${encodeURIComponent(query)}&limit=5`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      continue;
    }

    const data = await response.json() as NeteaseSearchResponse;
    const candidates = (data.result?.songs || []).slice(0, 3);

    for (const candidate of candidates) {
      if (!candidate?.id) {
        continue;
      }

      const candidateLyrics = await fetchNeteaseLyricsById(String(candidate.id));
      if (candidateLyrics.length > 0) {
        return candidateLyrics;
      }
    }
  }

  return [];
}

async function readUploadedSongMetadata(file: File): Promise<Pick<Song, "title" | "artist" | "duration" | "lyricsText">> {
  const inferredIdentity = inferSongIdentityFromFileName(file.name);

  try {
    ensureMusicMetadataBrowserGlobals();
    const { parseBlob } = await import("music-metadata-browser");
    const metadata = await parseBlob(file);

    const result: Pick<Song, "title" | "artist" | "duration" | "lyricsText"> = {
      title: metadata.common.title?.trim() || inferredIdentity.title,
      artist: metadata.common.artist?.trim() || "本地音乐",
      duration:
        typeof metadata.format.duration === "number" && Number.isFinite(metadata.format.duration)
          ? Math.max(0, Math.round(metadata.format.duration))
          : 0,
      lyricsText: pickPrimaryLyricText(metadata.common.lyrics),
    };
    result.artist = metadata.common.artist?.trim() || inferredIdentity.artist;
    return result;
  } catch (error) {
    console.warn("Failed to read uploaded song metadata:", error);
    const fallbackResult: Pick<Song, "title" | "artist" | "duration" | "lyricsText"> = {
      title: stripFileExtension(file.name),
      artist: "本地音乐",
      duration: 0,
      lyricsText: undefined,
    };
    fallbackResult.title = inferredIdentity.title;
    fallbackResult.artist = inferredIdentity.artist;
    return fallbackResult;
  }
}

function ResolvedMusicAvatar({
  value,
  alt,
  className,
}: {
  value?: string | null;
  alt?: string;
  className: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);

  if (!resolvedUrl) {
    return <div className={`${className} bg-zinc-100`} aria-label={alt || "avatar"} />;
  }

  return <img src={resolvedUrl} alt={alt || "avatar"} className={className} />;
}

function ResolvedMusicCover({
  value,
  alt,
  className,
}: {
  value?: string | null;
  alt: string;
  className: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);

  if (!resolvedUrl) {
    return <div className={`${className} bg-zinc-100`} aria-label={alt} />;
  }

  return <img src={resolvedUrl} alt={alt} className={className} />;
}

function normalizeBuiltinSong(song: Song): Song {
  if (!song) return song;

  const normalizedAlbumArt = normalizeMusicCoverValue(song.albumArt);

  if (song.id === "1" || song.title === "鏅村ぉ" || song.title === "鎌村お") {
    return { ...song, title: "晴天", artist: "周杰伦", albumArt: normalizedAlbumArt };
  }

  if (song.id === "3" || song.title === "鍛婄櫧姘旂悆") {
    return { ...song, title: "告白气球", artist: "周杰伦", albumArt: normalizedAlbumArt };
  }

  return normalizedAlbumArt === song.albumArt ? song : {
    ...song,
    albumArt: normalizedAlbumArt,
  };
}

function normalizeSongList(songs: Song[] | null | undefined): Song[] {
  if (!Array.isArray(songs)) return [];
  return songs.map((song) => normalizeBuiltinSong(song));
}

function dedupeSongsById(songs: Array<Song | null | undefined>): Song[] {
  const songMap = new Map<string, Song>();

  songs.forEach((song) => {
    if (!song?.id) return;
    songMap.set(song.id, normalizeBuiltinSong(song));
  });

  return Array.from(songMap.values());
}

function withSongLibrary(data: MusicData, extraSongs: Song[] = []): MusicData {
  return {
    ...data,
    songLibrary: dedupeSongsById([
      ...(Array.isArray(data.songLibrary) ? data.songLibrary : []),
      data.currentSong,
      ...(data.queue || []),
      ...(data.playlists || []).flatMap((playlist) => playlist.songs || []),
      ...extraSongs,
    ]),
  };
}

type MusicAppProps = {
  character: Character;
  userProfile: UserProfileExtended;
  userAvatarLibrary?: UserAvatarLibrary;
  relationshipAvatarBindings?: RelationshipAvatarBinding[];
  musicData: MusicData;
  onUpdateMusicData: (data: MusicData) => void;
  directChatHistory: ChatHistory;
  visualSettings: VisualSettings;
  settings: AppSettings;
  onPatchCharacter: (characterId: string, patch: Partial<Character>) => void;
  onBack: () => void;
  allCharacters: Character[];
  worldBooks?: WorldBookEntry[];
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
};

export default function MusicApp({
  character,
  userProfile,
  userAvatarLibrary,
  relationshipAvatarBindings,
  musicData,
  onUpdateMusicData,
  directChatHistory,
  visualSettings,
  settings,
  onPatchCharacter,
  onBack,
  allCharacters,
  worldBooks = [],
  audioRef,
}: MusicAppProps) {
  const safeCharacter = useMemo(
    () => character ?? ({
      id: "music-fallback-character",
      name: "TA",
      avatar: "",
    } as Character),
    [character],
  );
  const [activeTab, setActiveTab] = useState<"player" | "playlists" | "me">(
    "player",
  );
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [localProgress, setLocalProgress] = useState(0);
  const [localCurrentTime, setLocalCurrentTime] = useState(0);
  const [showQueue, setShowQueue] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(
    null,
  );
  const [lyrics, setLyrics] = useState<ParsedLyricLine[]>([]);
  const [isResolvingLyrics, setIsResolvingLyrics] = useState(false);
  const [lyricStatusText, setLyricStatusText] = useState("暂无歌词");
  const [showLyrics, setShowLyrics] = useState(false);
  const [isPlayerStyleSectionExpanded, setIsPlayerStyleSectionExpanded] = useState(true);
  const [expandedPlayerStyleCardId, setExpandedPlayerStyleCardId] = useState<MusicPlayerStylePreset | null>("ios-air");
  const [showCreatePlaylistDialog, setShowCreatePlaylistDialog] =
    useState(false);
  const [showAddMusicDialog, setShowAddMusicDialog] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [selectedCollaborator, setSelectedCollaborator] = useState<string | null>(null);
  const [neteaseUrl, setNeteaseUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [directMusicUrl, setDirectMusicUrl] = useState("");
  const [directMusicTitle, setDirectMusicTitle] = useState("");
  const [showPlayerMoreMenu, setShowPlayerMoreMenu] = useState(false);
  const [showDataManagement, setShowDataManagement] = useState(false);
  const [showCollaborativeLibrary, setShowCollaborativeLibrary] =
    useState(false);
  const [isSendingTogetherChat, setIsSendingTogetherChat] = useState(false);
  const [playbackError, setPlaybackError] = useState("");
  const [isAudioActuallyPlaying, setIsAudioActuallyPlaying] = useState(false);
  const [isSyncingNeteasePlaylists, setIsSyncingNeteasePlaylists] = useState(false);
  const lastRecordedPlaybackIdRef = useRef<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const playbackRequestIdRef = useRef(0);
  const currentMusicDataRef = useRef<MusicData | null>(null);
  const onUpdateMusicDataRef = useRef(onUpdateMusicData);
  const onPatchCharacterRef = useRef(onPatchCharacter);
  const lyricCacheRef = useRef(new Map<string, ParsedLyricLine[]>());
  const lyricStatusCacheRef = useRef(new Map<string, string>());
  const neteaseFallbackAttemptedRef = useRef<string | null>(null);
  const prefersDirectGesturePlaybackRef = useRef(false);
  const gesturePrimedSongIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      prefersDirectGesturePlaybackRef.current = false;
      return;
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isTouchMac = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
    const isMobileUa = /iphone|ipad|ipod|android|mobile|harmonyos/.test(userAgent) || isTouchMac;
    const prefersCoarsePointer =
      typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

    prefersDirectGesturePlaybackRef.current = isMobileUa || prefersCoarsePointer;
  }, []);

  const resolveSongPlaybackUrl = async (song: Song | null | undefined) => {
    if (!song) return "";
    if (song.id.startsWith("netease-")) {
      return `/api/netease/song?id=${song.id.replace("netease-", "")}`;
    }
    return (await resolveValueToDisplayUrl(song.url)) || "";
  };

  const resolveNeteaseFallbackUrl = (song: Song | null | undefined) => {
    if (!song || !song.id.startsWith("netease-")) return "";
    return `https://music.163.com/song/media/outer/url?id=${song.id.replace("netease-", "")}.mp3`;
  };

  const normalizePlaybackUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("blob:") || url.startsWith("data:")) {
      return url;
    }
    return new URL(url, window.location.origin).toString();
  };

  const resetAudioElement = (
    audio: HTMLAudioElement,
    nextPlaybackUrl = "",
    invalidatePendingRequest = true,
  ) => {
    if (invalidatePendingRequest) {
      playbackRequestIdRef.current += 1;
    }
    if (!audio.paused) {
      audio.pause();
    }
    audio.removeAttribute("src");
    audio.load();
    if (nextPlaybackUrl) {
      audio.src = nextPlaybackUrl;
      audio.currentTime = 0;
      audio.load();
    }
    playPromiseRef.current = null;
  };

  const primePlaybackFromGesture = async (song: Song) => {
    const audio = audioRef.current;
    if (!audio || !prefersDirectGesturePlaybackRef.current) {
      gesturePrimedSongIdRef.current = null;
      return;
    }

    const nextPlaybackUrl = await resolveSongPlaybackUrl(song);
    if (!nextPlaybackUrl) {
      gesturePrimedSongIdRef.current = null;
      return;
    }
    const currentAudioUrl = normalizePlaybackUrl(audio.currentSrc || audio.src);
    const targetAudioUrl = normalizePlaybackUrl(nextPlaybackUrl);

    if (currentAudioUrl !== targetAudioUrl) {
      resetAudioElement(audio, nextPlaybackUrl, false);
    }

    try {
      setPlaybackError("");
      setIsAudioActuallyPlaying(false);
      playPromiseRef.current = audio.play();
      await playPromiseRef.current;
      gesturePrimedSongIdRef.current = song.id;
    } catch (error) {
      gesturePrimedSongIdRef.current = null;
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Gesture playback error:", error);
      }
    } finally {
      playPromiseRef.current = null;
    }
  };

  const appendSongOnce = (ids: string[], songId: string) => [
    songId,
    ...ids.filter((id) => id !== songId),
  ];

  const recordSongPlayback = (song: Song, data: MusicData) => withSongLibrary({
    ...data,
    history: appendSongOnce(data.history || [], song.id),
    recentlyPlayed: appendSongOnce(data.recentlyPlayed || [], song.id),
  }, [song]);

  const toggleSongInList = (ids: string[], songId: string) =>
    ids.includes(songId) ? ids.filter((id) => id !== songId) : [...ids, songId];

  const defaultSongs = useMemo<Song[]>(() => [], []);

  const defaultMusicData = useMemo<MusicData>(() => ({
    currentSong: null,
    isPlaying: false,
    progress: 0,
    volume: 80,
    playlists: [
      {
        id: "p1",
        name: "我的最爱",
        cover: "",
        songs: defaultSongs,
        type: "user",
      },
      {
        id: "p2",
        name: `${safeCharacter.name}的歌单`,
        cover: safeCharacter.avatar,
        songs: [],
        type: "character",
        authorId: safeCharacter.id,
      },
      {
        id: "p3",
        name: "共创歌单",
        cover: "",
        songs: [],
        type: "collaborative",
      },
    ],
    likedSongs: [],
    history: [],
    recentlyPlayed: [],
    togetherWith: null,
    togetherStartTime: null,
    chatHistory: [],
    queue: defaultSongs,
    collectedSongs: [],
    songLibrary: defaultSongs,
    playerStylePreset: "ios-air",
    playerShapePreset: "rounded-square",
    playerShapeByStyle: {
      "ios-air": "rounded-square",
      "netease-film": "poster",
      "aurora-stream": "circle",
      "magazine-poster": "poster",
    },
  }), [defaultSongs, safeCharacter.avatar, safeCharacter.id, safeCharacter.name]);

  const currentMusicData = useMemo<MusicData>(() => {
    const normalizedCurrentSong = normalizeBuiltinSong(musicData?.currentSong ?? defaultMusicData.currentSong);
    const normalizedPlaylists = Array.isArray(musicData?.playlists)
      ? musicData.playlists.map((playlist) => ({
          ...playlist,
          cover: normalizeMusicCoverValue(playlist.cover),
          songs: normalizeSongList(playlist.songs),
        }))
      : defaultMusicData.playlists;
    const normalizedQueue = Array.isArray(musicData?.queue) ? normalizeSongList(musicData.queue) : defaultMusicData.queue;
    const normalizedSongLibrary = dedupeSongsById([
      ...(Array.isArray(musicData?.songLibrary) ? normalizeSongList(musicData.songLibrary) : []),
      normalizedCurrentSong,
      ...normalizedQueue,
      ...normalizedPlaylists.flatMap((playlist) => playlist.songs),
    ]);

    return {
      ...defaultMusicData,
      ...musicData,
      currentSong: normalizedCurrentSong,
      playlists: normalizedPlaylists,
      likedSongs: Array.isArray(musicData?.likedSongs) ? musicData.likedSongs : defaultMusicData.likedSongs,
      collectedSongs: Array.isArray(musicData?.collectedSongs) ? musicData.collectedSongs : defaultMusicData.collectedSongs,
      history: Array.isArray(musicData?.history) ? musicData.history : defaultMusicData.history,
      recentlyPlayed: Array.isArray(musicData?.recentlyPlayed) ? musicData.recentlyPlayed : defaultMusicData.recentlyPlayed,
      chatHistory: Array.isArray(musicData?.chatHistory) ? musicData.chatHistory : defaultMusicData.chatHistory,
      queue: normalizedQueue,
      songLibrary: normalizedSongLibrary,
    };
  }, [defaultMusicData, musicData]);
  const currentPlayerStylePreset = currentMusicData.playerStylePreset || "ios-air";
  const currentPlayerShapePreset = currentMusicData.playerShapeByStyle?.[currentPlayerStylePreset]
    || currentMusicData.playerShapePreset
    || (currentPlayerStylePreset === "aurora-stream"
      ? "circle"
      : currentPlayerStylePreset === "netease-film" || currentPlayerStylePreset === "magazine-poster"
        ? "poster"
        : "rounded-square");
  const activePlayerStyleOption = useMemo(
    () => PLAYER_STYLE_OPTIONS.find((option) => option.id === currentPlayerStylePreset) || PLAYER_STYLE_OPTIONS[0],
    [currentPlayerStylePreset],
  );
  const activePlayerShapeOption = useMemo(
    () => PLAYER_SHAPE_OPTIONS.find((option) => option.id === currentPlayerShapePreset) || PLAYER_SHAPE_OPTIONS[0],
    [currentPlayerShapePreset],
  );
  const setPlayerStylePreset = (preset: MusicPlayerStylePreset) => {
    if (preset === currentPlayerStylePreset) {
      return;
    }

    onUpdateMusicData({
      ...currentMusicData,
      playerStylePreset: preset,
    });
  };
  const setPlayerShapePreset = (preset: MusicPlayerShapePreset) => {
    if (preset === currentPlayerShapePreset) {
      return;
    }

    onUpdateMusicData({
      ...currentMusicData,
      playerShapeByStyle: {
        ...(currentMusicData.playerShapeByStyle || {}),
        [currentPlayerStylePreset]: preset,
      },
    });
  };
  const togglePlayerStyleCard = (preset: MusicPlayerStylePreset) => {
    if (!isPlayerStyleSectionExpanded) {
      setIsPlayerStyleSectionExpanded(true);
    }

    setExpandedPlayerStyleCardId((current) => current === preset ? null : preset);
    if (preset !== currentPlayerStylePreset) {
      onUpdateMusicData({
        ...currentMusicData,
        playerStylePreset: preset,
      });
    }
  };
  useEffect(() => {
    if (!isPlayerStyleSectionExpanded) {
      return;
    }

    setExpandedPlayerStyleCardId((current) => current ?? currentPlayerStylePreset);
  }, [currentPlayerStylePreset, isPlayerStyleSectionExpanded]);
  const playerStyleSurface = useMemo(() => {
    switch (currentPlayerStylePreset) {
      case "netease-film":
        return {
          backdropHaloClass: "bg-[radial-gradient(circle_at_top,rgba(255,246,248,0.98),rgba(248,226,232,0.92)_40%,rgba(232,214,220,0.8)_100%)]",
          backdropWashClass: "bg-[linear-gradient(180deg,rgba(252,248,249,0.84)_0%,rgba(246,238,241,0.94)_34%,rgba(234,228,232,0.98)_100%)]",
          titleClassName: "text-zinc-950",
          artistClassName: "text-[#dd4b73]",
        };
      case "aurora-stream":
        return {
          backdropHaloClass: "bg-[radial-gradient(circle_at_top,rgba(236,255,249,0.96),rgba(201,242,233,0.88)_38%,rgba(183,224,221,0.78)_100%)]",
          backdropWashClass: "bg-[linear-gradient(180deg,rgba(243,252,250,0.82)_0%,rgba(229,245,241,0.92)_34%,rgba(220,237,236,0.98)_100%)]",
          titleClassName: "text-[#0f1720]",
          artistClassName: "text-[#0c8b74]",
        };
      case "magazine-poster":
        return {
          backdropHaloClass: "bg-[radial-gradient(circle_at_top,rgba(255,250,245,0.96),rgba(244,229,211,0.9)_40%,rgba(225,212,199,0.82)_100%)]",
          backdropWashClass: "bg-[linear-gradient(180deg,rgba(253,250,246,0.84)_0%,rgba(244,236,226,0.92)_34%,rgba(234,229,223,0.98)_100%)]",
          titleClassName: "text-[#18130f]",
          artistClassName: "text-[#a06838]",
        };
      default:
        return {
          backdropHaloClass: "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.96),rgba(230,238,246,0.92)_42%,rgba(203,216,229,0.78)_100%)]",
          backdropWashClass: "bg-[linear-gradient(180deg,rgba(247,250,253,0.82)_0%,rgba(236,243,248,0.9)_30%,rgba(228,236,244,0.96)_100%)]",
          titleClassName: "text-zinc-900",
          artistClassName: "text-pink-500",
        };
    }
  }, [currentPlayerStylePreset]);
  const activeTogetherCharacter = useMemo(
    () => allCharacters.find((item) => item.id === currentMusicData.togetherWith) || safeCharacter,
    [allCharacters, safeCharacter, currentMusicData.togetherWith],
  );
  const userAvatar = useMemo(
    () => resolveUserAvatarForScene({
      userProfile,
      userAvatarLibrary,
      relationshipAvatarBindings,
      characterId: currentMusicData.togetherWith || null,
      scene: 'music_together',
    }).avatar,
    [
      currentMusicData.togetherWith,
      relationshipAvatarBindings,
      userAvatarLibrary,
      userProfile,
    ],
  );
  const userName = userProfile.name;
  const filteredPlaylists = currentMusicData.playlists.filter((playlist) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      playlist.name.toLowerCase().includes(query) ||
      playlist.songs.some((song) =>
        `${song.title} ${song.artist}`.toLowerCase().includes(query),
      )
    );
  });

  useEffect(() => {
    currentMusicDataRef.current = currentMusicData;
    onUpdateMusicDataRef.current = onUpdateMusicData;
    onPatchCharacterRef.current = onPatchCharacter;
  }, [
    currentMusicData,
    onPatchCharacter,
    onUpdateMusicData,
  ]);

  const latestTogetherChatMessageKey = currentMusicData.chatHistory.length > 0
    ? `${currentMusicData.chatHistory[currentMusicData.chatHistory.length - 1].timestamp}:${currentMusicData.chatHistory[currentMusicData.chatHistory.length - 1].role}`
    : "";

  useEffect(() => {
    if (!showChat || !chatEndRef.current) {
      return;
    }

    chatEndRef.current.scrollIntoView({
      behavior: "auto",
      block: "end",
    });
  }, [isSendingTogetherChat, latestTogetherChatMessageKey, showChat]);

  // Audio Playback Logic
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return undefined;
    }

    const handleTimeUpdate = () => {
      if (audio.duration) {
        const progress = (audio.currentTime / audio.duration) * 100;
        setLocalProgress(progress);
        setLocalCurrentTime(audio.currentTime);
      }
    };

    const handleEnded = () => {
      setIsAudioActuallyPlaying(false);
      skipForward();
    };

    const handlePlaying = () => {
      setPlaybackError("");
      setIsAudioActuallyPlaying(true);
      const activeData = currentMusicDataRef.current;
      const activeSong = activeData?.currentSong;
      if (!activeData || !activeSong) return;
      if (lastRecordedPlaybackIdRef.current === activeSong.id) return;

      lastRecordedPlaybackIdRef.current = activeSong.id;
      onUpdateMusicDataRef.current(recordSongPlayback(activeSong, activeData));
    };

    const handlePause = () => {
      setIsAudioActuallyPlaying(false);
    };

    const handleWaiting = () => {
      setIsAudioActuallyPlaying(false);
    };

    const handlePlaybackError = () => {
      const activeSong = currentMusicDataRef.current?.currentSong;
      const fallbackUrl = resolveNeteaseFallbackUrl(activeSong);
      const currentAudioUrl = normalizePlaybackUrl(audio.currentSrc || audio.src);
      const targetFallbackUrl = normalizePlaybackUrl(fallbackUrl);

      if (
        activeSong?.id.startsWith("netease-") &&
        fallbackUrl &&
        neteaseFallbackAttemptedRef.current !== activeSong.id &&
        currentAudioUrl !== targetFallbackUrl
      ) {
        neteaseFallbackAttemptedRef.current = activeSong.id;
        setPlaybackError("正在切换备用播放地址…");
        setIsAudioActuallyPlaying(false);
        resetAudioElement(audio, fallbackUrl);
        if (currentMusicDataRef.current?.isPlaying) {
          playPromiseRef.current = audio.play();
          playPromiseRef.current.catch((error) => {
            if (error instanceof Error && error.name !== "AbortError") {
              console.error("Playback fallback error:", error);
            }
          }).finally(() => {
            playPromiseRef.current = null;
          });
        }
        return;
      }

      setIsAudioActuallyPlaying(false);
      setPlaybackError("当前歌曲暂时无法播放");
      resetAudioElement(audio);
      if (currentMusicDataRef.current?.isPlaying) {
        onUpdateMusicDataRef.current({
          ...currentMusicDataRef.current,
          isPlaying: false,
        });
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("stalled", handleWaiting);
    audio.addEventListener("error", handlePlaybackError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("stalled", handleWaiting);
      audio.removeEventListener("error", handlePlaybackError);
    };
  }, []); // Only run once on mount

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = currentMusicData.volume / 100;
    }
  }, [currentMusicData.volume]);

  // Fetch lyrics
  useEffect(() => {
    let cancelled = false;

    const commitLyricsState = (
      songId: string,
      nextLyrics: ParsedLyricLine[],
      statusText = "",
    ) => {
      lyricCacheRef.current.set(songId, nextLyrics);
      lyricStatusCacheRef.current.set(songId, statusText);

      if (!cancelled) {
        setLyrics(nextLyrics);
        setLyricStatusText(statusText);
      }
    };

    const fetchLyrics = async () => {
      const currentSong = currentMusicData.currentSong;
      if (!currentSong) {
        if (!cancelled) {
          setLyrics([]);
          setIsResolvingLyrics(false);
          setLyricStatusText("暂无歌词");
        }
        return;
      }

      const songId = currentSong.id;
      const localLyrics = parseLyricText(currentSong.lyricsText);

      if (localLyrics.length > 0) {
        commitLyricsState(songId, localLyrics, "");
        if (!cancelled) {
          setIsResolvingLyrics(false);
        }
        return;
      }

      if (lyricCacheRef.current.has(songId)) {
        if (!cancelled) {
          setLyrics(lyricCacheRef.current.get(songId) || []);
          setLyricStatusText(lyricStatusCacheRef.current.get(songId) || "暂无歌词");
          setIsResolvingLyrics(false);
        }
        return;
      }

      if (!cancelled) {
        setLyrics([]);
        setIsResolvingLyrics(true);
        setLyricStatusText(songId.startsWith("netease-") ? "正在加载歌词..." : "正在匹配歌词...");
      }

      try {
        const resolvedLyrics = songId.startsWith("netease-")
          ? await fetchNeteaseLyricsById(songId.replace("netease-", ""))
          : await searchNeteaseLyricsForSong(currentSong);

        const emptyStatusText = songId.startsWith("netease-")
          ? "这首歌暂时没有可用歌词。"
          : "文件里没有内嵌歌词，也没匹配到在线歌词。可以重新上传同名 .lrc / .txt。";

        commitLyricsState(
          songId,
          resolvedLyrics,
          resolvedLyrics.length > 0 ? "" : emptyStatusText,
        );
      } catch (error) {
        console.error("Error resolving lyrics:", error);
        commitLyricsState(
          songId,
          [],
          songId.startsWith("netease-")
            ? "歌词加载失败，请稍后重试。"
            : "本地歌词读取失败，或没有匹配到在线歌词。",
        );
      } finally {
        if (!cancelled) {
          setIsResolvingLyrics(false);
        }
      }
    };

    void fetchLyrics();

    return () => {
      cancelled = true;
    };
  }, [currentMusicData.currentSong]);

  const lyricsAreTimed = useMemo(() => hasTimedLyricLines(lyrics), [lyrics]);
  const activeLyricIndex = useMemo(() => {
    if (!lyricsAreTimed) {
      return -1;
    }

    return lyrics.findIndex((line, index) => {
      if (line.time === null) {
        return false;
      }

      const nextTimedLine = lyrics.slice(index + 1).find((candidate) => candidate.time !== null);
      return localCurrentTime >= line.time && (!nextTimedLine || localCurrentTime < (nextTimedLine.time || 0));
    });
  }, [lyrics, lyricsAreTimed, localCurrentTime]);
  const currentLyricLine = activeLyricIndex >= 0 ? lyrics[activeLyricIndex] : null;
  const nearbyLyricLines = lyricsAreTimed && activeLyricIndex >= 0
    ? lyrics.slice(Math.max(0, activeLyricIndex - 1), activeLyricIndex + 2)
    : [];

  // Scroll active lyric into view
  useEffect(() => {
    if (showLyrics && lyricsAreTimed && activeLyricIndex !== -1) {
      const activeLyric = document.getElementById("active-lyric");
      if (activeLyric) {
        activeLyric.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [activeLyricIndex, lyricsAreTimed, showLyrics]);

  // Sync song source and play state
  useEffect(() => {
    const audio = audioRef.current;
    const currentSong = currentMusicData.currentSong;
    if (!audio || !currentSong) return;
    if (currentSong.id !== lastRecordedPlaybackIdRef.current) {
      lastRecordedPlaybackIdRef.current = null;
    }
    if (neteaseFallbackAttemptedRef.current !== currentSong.id) {
      neteaseFallbackAttemptedRef.current = null;
    }

    const syncPlayback = async () => {
      const requestId = ++playbackRequestIdRef.current;
      setPlaybackError("");
      const nextPlaybackUrl = await resolveSongPlaybackUrl(currentMusicData.currentSong);
      if (requestId !== playbackRequestIdRef.current) {
        return;
      }
      if (!nextPlaybackUrl) {
        gesturePrimedSongIdRef.current = null;
        setIsAudioActuallyPlaying(false);
        setPlaybackError('当前歌曲暂时无法播放');
        resetAudioElement(audio);
        if (currentMusicDataRef.current?.isPlaying) {
          onUpdateMusicDataRef.current({
            ...currentMusicDataRef.current,
            isPlaying: false,
          });
        }
        return;
      }
      const targetAudioUrl = normalizePlaybackUrl(nextPlaybackUrl);
      let activeAudioUrl = normalizePlaybackUrl(audio.currentSrc || audio.src);

      // If source changed, update it
      if (activeAudioUrl !== targetAudioUrl) {
        gesturePrimedSongIdRef.current = null;
        if (playPromiseRef.current) {
          try {
            await playPromiseRef.current;
          } catch {
            // Ignore interruption errors from the previous source.
          }
        }
        if (requestId !== playbackRequestIdRef.current) {
          return;
        }
        resetAudioElement(audio, nextPlaybackUrl, false);
        activeAudioUrl = normalizePlaybackUrl(audio.currentSrc || audio.src);
      }

      if (currentMusicData.isPlaying) {
        if (
          gesturePrimedSongIdRef.current === currentSong.id &&
          activeAudioUrl === targetAudioUrl &&
          !audio.paused
        ) {
          gesturePrimedSongIdRef.current = null;
          return;
        }

        setIsAudioActuallyPlaying(false);
        if (playPromiseRef.current) {
          try {
            await playPromiseRef.current;
          } catch {
            // Ignore interruption errors from the previous play attempt.
          }
        }
        if (requestId !== playbackRequestIdRef.current) {
          return;
        }
        playPromiseRef.current = audio.play();
        try {
          await playPromiseRef.current;
          if (requestId !== playbackRequestIdRef.current) {
            return;
          }
        } catch (e) {
          if (requestId !== playbackRequestIdRef.current) {
            return;
          }
          setIsAudioActuallyPlaying(false);
          setPlaybackError("当前歌曲暂时无法播放");
          resetAudioElement(audio);
          if (e instanceof Error && e.name !== "AbortError") {
            console.error("Playback error:", e);
          }
          if (currentMusicDataRef.current?.isPlaying) {
            onUpdateMusicDataRef.current({
              ...currentMusicDataRef.current,
              isPlaying: false,
            });
          }
        } finally {
          if (requestId === playbackRequestIdRef.current) {
            gesturePrimedSongIdRef.current = null;
            playPromiseRef.current = null;
          }
        }
      } else {
        gesturePrimedSongIdRef.current = null;
        setPlaybackError("");
        if (!audio.paused) {
          audio.pause();
        }
      }
    };

    syncPlayback();
  }, [currentMusicData.currentSong?.id, currentMusicData.isPlaying]);

  const togglePlay = async () => {
    if (!currentMusicData.currentSong) {
      return;
    }

    if (!currentMusicData.isPlaying && currentMusicData.currentSong) {
      await primePlaybackFromGesture(currentMusicData.currentSong);
    }

    onUpdateMusicData({
      ...currentMusicData,
      isPlaying: !currentMusicData.isPlaying,
    });
  };

  const skipForward = () => {
    const queue = currentMusicData.queue || defaultSongs;
    if (!queue.length) return;
    const currentIndex = queue.findIndex(
      (s) => s.id === currentMusicData.currentSong?.id,
    );
    const nextIndex = (currentIndex + 1) % queue.length;
    onUpdateMusicData({
      ...currentMusicData,
      currentSong: queue[nextIndex],
      progress: 0,
      isPlaying: true,
    });
    setLocalProgress(0);
    setLocalCurrentTime(0);
  };

  const skipBack = () => {
    const queue = currentMusicData.queue || defaultSongs;
    if (!queue.length) return;
    const currentIndex = queue.findIndex(
      (s) => s.id === currentMusicData.currentSong?.id,
    );
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    onUpdateMusicData({
      ...currentMusicData,
      currentSong: queue[prevIndex],
      progress: 0,
      isPlaying: true,
    });
    setLocalProgress(0);
    setLocalCurrentTime(0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !audioRef.current.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * audioRef.current.duration;
    audioRef.current.currentTime = newTime;
    setLocalCurrentTime(newTime);
    setLocalProgress(percentage * 100);
  };

  const playSong = async (song: Song) => {
    await primePlaybackFromGesture(song);
    setPlaybackError("");
    onUpdateMusicData(withSongLibrary({
      ...currentMusicData,
      currentSong: song,
      progress: 0,
      isPlaying: true,
    }, [song]));
    setLocalProgress(0);
    setLocalCurrentTime(0);
    setActiveTab("player");
  };

  const handleVolumeChange = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const volume = Math.max(0, Math.min(100, (x / rect.width) * 100));
    onUpdateMusicData({ ...currentMusicData, volume });
  };

  const addToQueue = (song: Song) => {
    if (currentMusicData.queue.some((s) => s.id === song.id)) return;
    onUpdateMusicData(withSongLibrary({
      ...currentMusicData,
      queue: [...currentMusicData.queue, song],
    }, [song]));
  };

  const inviteTogether = (charId: string) => {
    const invitedCharacter = allCharacters.find((item) => item.id === charId);
    onUpdateMusicData({
      ...currentMusicData,
      togetherWith: charId,
      togetherStartTime: Date.now(),
      chatHistory: [
        {
          role: "model",
          text: invitedCharacter
            ? `好呀，${invitedCharacter.name} 已经到场了。先从这首开始吧。`
            : "好呀，今天这段时间我陪你一起听。先从这首开始吧。",
          timestamp: Date.now(),
        },
      ],
    });
    setShowInviteDialog(false);
  };

  const disconnectTogether = () => {
    onUpdateMusicData({
      ...currentMusicData,
      togetherWith: null,
      togetherStartTime: null,
      chatHistory: [],
    });
    setShowChat(false);
  };

  const createPlaylist = () => {
    if (!newPlaylistName.trim()) return;
    const newPlaylist: Playlist = {
      id: `p-${Date.now()}`,
      name: newPlaylistName,
      cover: `https://picsum.photos/seed/${Date.now()}/300/300`,
      songs: [],
      type: selectedCollaborator ? "collaborative" : "user",
      collaboratorId: selectedCollaborator || undefined,
    };
    onUpdateMusicData({
      ...currentMusicData,
      playlists: [...currentMusicData.playlists, newPlaylist],
    });
    setNewPlaylistName("");
    setSelectedCollaborator(null);
    setShowCreatePlaylistDialog(false);
  };

  const importNeteasePlaylistById = async (id: string) => {
    const response = await fetch(`/api/netease/playlist-playable?id=${id}`);
    if (!response.ok) throw new Error("获取歌单失败");

    const data = await response.json();
    if (!data.playlist && !data.result) {
      throw new Error("歌单解析失败");
    }

    const playlist = data.playlist || data.result;
    const tracks = playlist.tracks || [];

    const newSongs: Song[] = tracks.map((track: any) => ({
      id: `netease-${track.id}`,
      title: track.name,
      artist:
        (track.ar || track.artists)?.map((a: any) => a.name).join(", ") ||
        "未知艺人",
      albumArt:
        normalizeMusicCoverValue((track.al || track.album)?.picUrl) ||
        "https://picsum.photos/seed/netease/300/300",
      url: `/api/netease/song?id=${track.id}`,
      duration: Math.floor((track.dt || track.duration || 240000) / 1000),
    }));

    const newPlaylist: Playlist = {
      id: `netease-pl-${playlist.id}`,
      name: playlist.name,
      cover:
        normalizeMusicCoverValue(playlist.coverImgUrl) ||
        "https://picsum.photos/seed/netease-pl/300/300",
      songs: newSongs,
      type: "user",
    };

    const nextPlaylists = currentMusicData.playlists.some((item) => item.id === newPlaylist.id)
      ? currentMusicData.playlists.map((item) => item.id === newPlaylist.id ? newPlaylist : item)
      : [...currentMusicData.playlists, newPlaylist];

    onUpdateMusicData(withSongLibrary({
      ...currentMusicData,
      playlists: nextPlaylists,
      currentSong:
        newSongs.length > 0 ? newSongs[0] : currentMusicData.currentSong,
      isPlaying: newSongs.length > 0 ? true : currentMusicData.isPlaying,
      progress: newSongs.length > 0 ? 0 : currentMusicData.progress,
      queue: newSongs.length > 0 ? newSongs : currentMusicData.queue,
    }, newSongs));

    if (newSongs.length > 0) {
      setLocalProgress(0);
      setLocalCurrentTime(0);
      setActiveTab("player");
    }

    return {
      playlist,
      newSongs,
      replacedExisting: nextPlaylists.length === currentMusicData.playlists.length,
    };
  };

  const handleDirectNeteasePlaylistImport = async (
    playlistBinding: NeteasePlaylistBinding,
  ): Promise<boolean> => {
    if (isImporting) return false;

    setIsImporting(true);
    try {
      const { playlist, newSongs, replacedExisting } = await importNeteasePlaylistById(playlistBinding.id);
      alert(`${replacedExisting ? "已更新" : "已导入"}歌单“${playlist.name || "网易云歌单"}”，当前可播放 ${newSongs.length} 首。`);
      return true;
    } catch (error) {
      console.error("Direct NetEase playlist import error:", error);
      alert("歌单导入失败，请检查歌单链接或稍后再试。");
      return false;
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportNeteasePlaylist = async () => {
    if (!neteaseUrl.trim()) return;
    const parsed = parseNeteaseMediaInput(neteaseUrl);
    if (!parsed) {
      alert("请输入有效的网易云歌曲链接，或歌单链接 / 歌单 ID");
      return;
    }

    setIsImporting(true);
    try {
      if (parsed.kind === "song") {
        const response = await fetch(`/api/netease/song/detail?id=${parsed.song.id}`);
        if (!response.ok) throw new Error("获取歌曲失败");

        const data = await response.json();
        if (!data.songs || data.songs.length === 0) {
          throw new Error("歌曲解析失败");
        }

        const track = data.songs[0];
        const newSong: Song = {
          id: `netease-${track.id}`,
          title: track.name,
          artist:
            (track.ar || track.artists)?.map((a: any) => a.name).join(", ") ||
            "未知艺人",
          albumArt:
            normalizeMusicCoverValue((track.al || track.album)?.picUrl) ||
            "https://picsum.photos/seed/netease/300/300",
          url: `/api/netease/song?id=${track.id}`,
          duration: Math.floor((track.dt || track.duration || 240000) / 1000),
        };

        onUpdateMusicData(withSongLibrary({
          ...currentMusicData,
          currentSong: newSong,
          isPlaying: true,
          queue: [newSong, ...currentMusicData.queue],
          recentlyPlayed: [
            newSong.id,
            ...currentMusicData.recentlyPlayed.filter(
              (rid) => rid !== newSong.id,
            ),
          ],
        }, [newSong]));

        setLocalProgress(0);
        setLocalCurrentTime(0);
        setActiveTab("player");

        setNeteaseUrl("");
        setShowAddMusicDialog(false);
      } else {
        const { newSongs, replacedExisting } = await importNeteasePlaylistById(parsed.playlist.id);

        setNeteaseUrl("");
        setShowAddMusicDialog(false);
        alert(`${replacedExisting ? "歌单已更新" : "歌单导入完成"}，当前可播放 ${newSongs.length} 首。`);
      }
    } catch (error) {
      console.error("Import error:", error);
      alert("导入失败，请检查链接或稍后重试");
    } finally {
      setIsImporting(false);
    }
  };

  const handleSyncNeteasePlaylists = async () => {
    const uid = currentMusicData.neteaseAccount?.uid?.trim();
    if (!uid || isSyncingNeteasePlaylists) return;

    setIsSyncingNeteasePlaylists(true);
    try {
      const syncedPlaylists = await syncNeteasePlaylistsByUid(uid);
      if (syncedPlaylists.length === 0) {
        alert("没有拉到可导入的公开歌单，请先确认主页链接或歌单公开状态。");
        return;
      }

      const preservedPlaylists = currentMusicData.playlists.filter(
        (playlist) => !playlist.id.startsWith("netease-pl-"),
      );

      onUpdateMusicData(withSongLibrary({
        ...currentMusicData,
        playlists: [...preservedPlaylists, ...syncedPlaylists],
      }, syncedPlaylists.flatMap((playlist) => playlist.songs)));

      const syncedSongCount = syncedPlaylists.reduce(
        (total, playlist) => total + playlist.songs.length,
        0,
      );
      alert(`已同步 ${syncedPlaylists.length} 个网易云歌单，共 ${syncedSongCount} 首当前可播放歌曲。`);
    } catch (error) {
      console.error("NetEase playlist sync error:", error);
      alert("同步歌单失败，请稍后再试。");
    } finally {
      setIsSyncingNeteasePlaylists(false);
    }
  };

  const sendTogetherMessage = async (message: ChatMessage) => {
    const sessionCharacterId = currentMusicData.togetherWith;
    const sessionStartedAt = currentMusicData.togetherStartTime;
    if (isSendingTogetherChat || !sessionCharacterId || !sessionStartedAt) {
      return;
    }
    const sessionCharacter =
      allCharacters.find((item) => item.id === sessionCharacterId) || activeTogetherCharacter;
    const updatedHistory = [...currentMusicData.chatHistory, message];

    onUpdateMusicData({
      ...currentMusicData,
      chatHistory: updatedHistory,
    });
    setIsSendingTogetherChat(true);

    try {
      const replyText = await generateTogetherChatReply({
        character: sessionCharacter,
        userName,
        currentSong: currentMusicData.currentSong,
        togetherDuration: getTogetherDuration(),
        history: updatedHistory,
        worldBooks,
        directChatHistory: directChatHistory[sessionCharacterId] || [],
        currentLyric: currentLyricLine,
        nearbyLyrics: nearbyLyricLines,
      });

      const nextData = currentMusicDataRef.current;
      if (
        !nextData
        || nextData.togetherWith !== sessionCharacterId
        || nextData.togetherStartTime !== sessionStartedAt
      ) {
        return;
      }

      const replyMessages = formatTogetherReplyMessages(replyText, Date.now());
      const nextSessionHistory = [...nextData.chatHistory, ...replyMessages];
      const writebackPlan = buildMusicTogetherWritebackPlan({
        character: sessionCharacter,
        currentSong: currentMusicData.currentSong,
        sessionHistory: nextSessionHistory,
      });

      onUpdateMusicDataRef.current({
        ...nextData,
        chatHistory: nextSessionHistory,
      });
      persistMusicTogetherEvidence({
        characterId: sessionCharacterId,
        relationshipWaves: writebackPlan.relationshipWaves,
        factTraces: writebackPlan.factTraces,
      });
      onPatchCharacterRef.current(sessionCharacterId, {
        lastMessage: replyMessages[replyMessages.length - 1]?.text || message.text,
        lastTime: replyMessages[replyMessages.length - 1]?.timestamp || message.timestamp,
        ...(writebackPlan.sharedState ? { sharedState: writebackPlan.sharedState } : {}),
        ...(writebackPlan.shortTermSummary
          ? { shortTermSummary: writebackPlan.shortTermSummary }
          : {}),
      });
    } catch (error) {
      console.error("Together chat generation error:", error);
      const nextData = currentMusicDataRef.current;
      if (
        !nextData
        || nextData.togetherWith !== sessionCharacterId
        || nextData.togetherStartTime !== sessionStartedAt
      ) {
        return;
      }

      onUpdateMusicDataRef.current({
        ...nextData,
        chatHistory: [
          ...nextData.chatHistory,
          {
            role: "model",
            text:
              error instanceof Error && error.message
                ? `我刚刚有点没接上，你再和我说一次吧。${error.message}`
                : "我刚刚有点没接上，你再和我说一次吧。",
            timestamp: Date.now(),
          },
        ],
      });
    } finally {
      setIsSendingTogetherChat(false);
    }
  };
  const sendChatMessage = async () => {
    const trimmedInput = chatInput.trim();
    if (!trimmedInput) {
      return;
    }

    setChatInput("");
    await sendTogetherMessage({
      role: "user",
      text: trimmedInput,
      timestamp: Date.now(),
    });
  };
  const sendTogetherStickerMessage = async (sticker: string) => {
    await sendTogetherMessage({
      role: "user",
      text: "[sticker]",
      imageUrl: sticker,
      timestamp: Date.now(),
    });
  };
  const sendTogetherAudioMessage = async ({
    audioUrl,
    audioMimeType,
    durationSeconds,
    transcript,
  }: {
    audioUrl: string;
    audioMimeType: string;
    durationSeconds?: number;
    transcript?: string;
  }) => {
    await sendTogetherMessage({
      role: "user",
      text: "[audio]",
      audioUrl,
      audioMimeType,
      ...(transcript?.trim() ? { audioTranscript: transcript.trim() } : {}),
      ...(typeof durationSeconds === "number" ? { duration: durationSeconds } : {}),
      timestamp: Date.now(),
    });
  };
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getTogetherDuration = () => {
    if (!currentMusicData.togetherStartTime) return "00:00";
    const diff = Math.floor(
      (Date.now() - currentMusicData.togetherStartTime) / 1000,
    );
    return formatTime(diff);
  };

  const controlButtonSurfaceClass = "flex items-center justify-center rounded-full border border-white/72 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,247,251,0.56))] shadow-[0_8px_18px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.76)] backdrop-blur-xl transition-all active:scale-95";
  const chromeControlButtonClass = `${controlButtonSurfaceClass} h-11 w-11 text-zinc-500/80`;
  const transportControlButtonClass = `${controlButtonSurfaceClass} h-11 w-11 text-zinc-700/85`;
  const primaryTransportControlButtonClass = `${controlButtonSurfaceClass} h-11 w-11 text-zinc-800/85 disabled:cursor-not-allowed disabled:opacity-45`;
  const glassPanelClass = "rounded-[30px] border border-white/72 bg-white/72 shadow-[0_20px_48px_rgba(15,23,42,0.09)] backdrop-blur-2xl";
  const playerTitleText = currentMusicData.currentSong?.title || "还没有歌曲";
  const playerArtistText = currentMusicData.currentSong?.artist || "去“我的”里添加本地音乐、音频链接或网易云歌曲";
  const isLocalPlaceholderArtist = currentMusicData.currentSong?.artist?.trim() === LOCAL_MUSIC_ARTIST_LABEL;
  const secondaryArtistText = isLocalPlaceholderArtist ? "" : playerArtistText;
  const isCircleArtworkShape = currentPlayerShapePreset === "circle";
  const isPosterArtworkShape = currentPlayerShapePreset === "poster";
  const artworkFrameClass = isPosterArtworkShape
    ? "relative aspect-[4/5] w-full max-w-[min(70vw,276px)] max-h-full"
    : "relative aspect-square w-full max-w-[min(76vw,296px)] max-h-full";
  const artworkOuterRadiusClass = isCircleArtworkShape
    ? "rounded-full"
    : isPosterArtworkShape
      ? "rounded-[32px]"
      : "rounded-[34px]";
  const artworkInnerRadiusClass = isCircleArtworkShape
    ? "rounded-full"
    : isPosterArtworkShape
      ? "rounded-[28px]"
      : "rounded-[22px]";
  const renderPlayerArtwork = () => {
    const artworkNode = currentMusicData.currentSong?.albumArt ? (
      <img
        src={currentMusicData.currentSong.albumArt}
        className="h-full w-full object-cover"
      />
    ) : (
      <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(160deg,#cad6e2,#8ea4bb)] text-white">
        <MusicIcon size={88} strokeWidth={1.5} />
      </div>
    );
    const floatingAnimation = currentMusicData.isPlaying && isAudioActuallyPlaying
      ? { y: [0, -8, 0], scale: [1, 1.018, 1] }
      : { y: 0, scale: 1 };
    const floatingTransition = {
      duration: 4.8,
      repeat: Infinity,
      ease: "easeInOut" as const,
    };
    if (currentPlayerStylePreset === "netease-film") {
      return (
        <motion.div
          key="cover-view-netease-film"
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          className={artworkFrameClass}
        >
          <div className={`absolute inset-4 ${artworkOuterRadiusClass} bg-[#f06b8f]/20 blur-[34px]`} />
          <motion.div
            animate={floatingAnimation}
            transition={floatingTransition}
            className={`relative h-full w-full overflow-hidden bg-[#161013] shadow-[0_28px_78px_rgba(91,38,53,0.28)] ${artworkOuterRadiusClass}`}
          >
            {artworkNode}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04)_0%,rgba(0,0,0,0.08)_38%,rgba(0,0,0,0.36)_100%)]" />
            <div className="absolute left-4 top-4 rounded-full bg-white/12 px-3 py-1 text-[10px] font-semibold tracking-[0.26em] text-white/78">
              {activePlayerStyleOption.badge}
            </div>
            <div className="absolute inset-x-5 bottom-6 [text-shadow:0_8px_28px_rgba(0,0,0,0.28)]">
              <div className="text-[11px] font-semibold tracking-[0.26em] text-white/82">
                EMOTIVE FILM
              </div>
              <div className="mt-2 truncate text-[19px] font-semibold text-white">
                {playerTitleText}
              </div>
              {secondaryArtistText ? (
                <div className="mt-1 truncate text-[13px] text-white/78">
                  {secondaryArtistText}
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      );
    }

    if (currentPlayerStylePreset === "aurora-stream") {
      return (
        <motion.div
          key="cover-view-aurora-stream"
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          className={artworkFrameClass}
        >
          <div className={`absolute -inset-3 ${artworkOuterRadiusClass} bg-[radial-gradient(circle_at_top,rgba(122,244,194,0.46),rgba(34,197,176,0.18)_38%,rgba(88,147,255,0.08)_100%)] blur-[34px]`} />
          <motion.div
            animate={floatingAnimation}
            transition={floatingTransition}
            className={`relative h-full w-full overflow-hidden bg-[#081314] shadow-[0_28px_82px_rgba(12,68,66,0.24)] ${artworkOuterRadiusClass}`}
          >
            {artworkNode}
            <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(97,255,211,0.14),rgba(0,0,0,0)_42%,rgba(84,180,255,0.26)_100%)]" />
            <div className="absolute left-5 top-5 rounded-full bg-white/12 px-3 py-1 text-[10px] font-semibold tracking-[0.26em] text-white/76">
              {activePlayerStyleOption.badge}
            </div>
            <div className="absolute right-5 top-5 flex items-end gap-1">
              <span className="h-3 w-1.5 rounded-full bg-white/55" />
              <span className="h-5 w-1.5 rounded-full bg-white/78" />
              <span className="h-2.5 w-1.5 rounded-full bg-white/48" />
            </div>
            <div className="absolute inset-x-5 bottom-6 [text-shadow:0_8px_24px_rgba(0,0,0,0.22)]">
              <div className="text-[11px] font-semibold tracking-[0.26em] text-[#dff7f0]">
                AURORA MIX
              </div>
              <div className="mt-2 truncate text-[18px] font-semibold text-white">
                {playerTitleText}
              </div>
              {secondaryArtistText ? (
                <div className="mt-1 truncate text-[13px] text-white/82">
                  {secondaryArtistText}
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      );
    }

    if (currentPlayerStylePreset === "magazine-poster") {
      return (
        <motion.div
          key="cover-view-magazine-poster"
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          className={artworkFrameClass}
        >
          <div className={`absolute inset-0 bg-white/70 shadow-[0_26px_66px_rgba(126,96,63,0.18)] ${artworkOuterRadiusClass}`} />
          <motion.div
            animate={floatingAnimation}
            transition={floatingTransition}
            className={`absolute inset-4 overflow-hidden bg-[#fbf6f1] ${artworkOuterRadiusClass}`}
          >
            {artworkNode}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0)_44%,rgba(24,19,15,0.08)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(255,249,244,0)_0%,rgba(255,249,244,0.92)_36%,rgba(255,249,244,0.98)_100%)] px-5 pb-5 pt-10">
              <div className="text-[10px] font-semibold tracking-[0.28em] text-[#a06838]">
                {activePlayerStyleOption.badge}
              </div>
              <div className="mt-2 line-clamp-2 text-[22px] font-semibold leading-tight text-[#18130f]">
                {playerTitleText}
              </div>
              {secondaryArtistText ? (
                <div className="mt-2 truncate text-[13px] text-[#624a33]/80">
                  {secondaryArtistText}
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      );
    }

    return (
      <motion.div
        key="cover-view-ios-air"
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className={artworkFrameClass}
      >
        <motion.div
          animate={floatingAnimation}
          transition={floatingTransition}
          className={`relative h-full w-full overflow-hidden shadow-[0_28px_80px_rgba(15,23,42,0.22)] ${artworkOuterRadiusClass}`}
        >
          {artworkNode}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0)_38%,rgba(15,23,42,0.18)_100%)]" />
          <div className="absolute -right-12 top-5 h-24 w-24 rounded-full bg-white/30 blur-2xl" />
        </motion.div>
        <div className={`pointer-events-none absolute inset-x-4 bottom-4 bg-white/22 px-4 py-3 backdrop-blur-[20px] shadow-[0_10px_24px_rgba(15,23,42,0.14)] ${artworkInnerRadiusClass}`}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
            {currentMusicData.isPlaying && isAudioActuallyPlaying ? "PLAYING NOW" : "LOCAL PLAYBACK"}
          </div>
          <div className="mt-1 truncate text-[15px] font-semibold text-white">
            {playerTitleText}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderPlayer = () => (
    <div className="relative flex flex-1 min-h-0 flex-col overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div className={`absolute inset-[-18%] ${playerStyleSurface.backdropHaloClass}`} />
        <div
          className="absolute inset-0 scale-110 bg-cover bg-center opacity-30 blur-[48px]"
          style={{
            backgroundImage: `url(${currentMusicData.currentSong?.albumArt})`,
          }}
        />
        <div className={`absolute inset-0 ${playerStyleSurface.backdropWashClass}`} />
      </div>

      <div
        className="relative z-10 flex flex-1 min-h-0 flex-col px-5 pb-4 sm:px-6 sm:pb-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 18px)" }}
      >
        {/* Header */}
        <div className="mb-2 flex shrink-0 items-center justify-between">
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/56 text-zinc-700 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-transform active:scale-95"
          >
            <ChevronLeft size={24} strokeWidth={2.6} />
          </button>
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-zinc-500/70">
              正在播放
            </p>
          </div>
          <div className="flex items-center gap-2">
            {currentMusicData.togetherWith && (
              <button
                onClick={disconnectTogether}
                className="flex h-10 items-center justify-center rounded-full bg-white/62 px-3 text-[11px] font-semibold text-zinc-600 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-transform active:scale-95 sm:px-3.5"
              >
                断开
              </button>
            )}
            {currentMusicData.togetherWith && (
              <button
                onClick={() => setShowChat(!showChat)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/62 text-zinc-500 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-transform active:scale-95"
              >
                <MessageCircle size={20} />
              </button>
            )}
            <button
              onClick={() => setShowInviteDialog(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/62 text-zinc-500 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-transform active:scale-95"
            >
              <Users size={20} />
            </button>
          </div>
        </div>

        {/* Avatars Area (Above CD) */}
        <div className="mb-1 flex h-14 shrink-0 items-center justify-center sm:h-16">
          <AnimatePresence mode="wait">
            {!currentMusicData.togetherWith ? (
              <motion.div
                key="single"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center gap-1"
              >
                <div className="h-9 w-9 overflow-hidden rounded-full border-2 border-white shadow-md sm:h-10 sm:w-10">
                  <ResolvedMusicAvatar
                    value={userAvatar}
                    className="w-full h-full object-cover"
                    alt={userName}
                  />
                </div>
                </motion.div>
              ) : (
                <motion.div
                key="together"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center"
              >
                <div className="flex items-center gap-0">
                  <motion.div className="z-10 h-10 w-10 overflow-hidden rounded-full border-2 border-white shadow-lg sm:h-12 sm:w-12">
                    <ResolvedMusicAvatar
                      value={userAvatar}
                      className="w-full h-full object-cover"
                      alt={userName}
                    />
                  </motion.div>

                  <div className="relative flex w-16 items-center justify-center sm:w-20">
                    {/* Left Ripple */}
                    <svg className="absolute left-0 h-5 w-8 overflow-visible sm:h-6 sm:w-10">
                      <motion.path
                        d="M 40 12 Q 35 4, 30 12 T 20 12 T 10 12 T 0 12"
                        fill="none"
                        stroke="#ec4899"
                        strokeWidth="2"
                        strokeLinecap="round"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    </svg>

                    {/* Right Ripple */}
                    <svg className="absolute right-0 h-5 w-8 overflow-visible sm:h-6 sm:w-10">
                      <motion.path
                        d="M 0 12 Q 5 4, 10 12 T 20 12 T 30 12 T 40 12"
                        fill="none"
                        stroke="#ec4899"
                        strokeWidth="2"
                        strokeLinecap="round"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    </svg>

                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="z-10 rounded-full bg-white p-1 text-pink-500"
                    >
                      <Heart size={16} fill="currentColor" />
                    </motion.div>
                  </div>

                  <motion.div
                    initial={{ x: -60, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className="z-10 h-10 w-10 overflow-hidden rounded-full border-2 border-white shadow-lg sm:h-12 sm:w-12"
                  >
                    <ResolvedMusicAvatar
                      value={activeTogetherCharacter.avatar}
                      className="w-full h-full object-cover"
                      alt={activeTogetherCharacter.name}
                    />
                  </motion.div>
                </div>
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-1 flex items-center gap-1 rounded-full bg-pink-500/10 px-2.5 py-0.5 sm:gap-1.5 sm:px-3"
                >
                  <Clock size={10} className="text-pink-500" />
                  <span className="text-[8px] font-bold uppercase tracking-wide text-pink-600 sm:text-[9px] sm:tracking-wider">
                    一起听了 {getTogetherDuration()}
                  </span>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Center Content: CD View or Lyrics View */}
        <div
          className="flex-1 flex flex-col overflow-hidden relative min-h-0"
          onClick={() => setShowLyrics(!showLyrics)}
        >
          {/* Song Info */}
          <div className={currentPlayerStylePreset === "ios-air" ? "mb-2 mt-2 shrink-0 text-center sm:mt-4" : "hidden"}>
            <h1 className={`mb-0.5 truncate px-2 text-[17px] font-bold tracking-tight sm:px-4 sm:text-xl ${playerStyleSurface.titleClassName}`}>
              {currentMusicData.currentSong?.title || "还没有歌曲"}
            </h1>
            <p className={`${secondaryArtistText ? "truncate px-2 text-[13px] font-medium sm:px-4 sm:text-[15px]" : "hidden"} ${playerStyleSurface.artistClassName}`}>
              {currentMusicData.currentSong?.artist || "去“我的”里添加本地音乐、音频链接或网易云歌曲"}
            </p>
            {playbackError ? (
              <p className="mt-1.5 text-[11px] font-semibold text-rose-500 sm:mt-2 sm:text-[12px]">
                {playbackError}
              </p>
            ) : null}
          </div>

          <div className="relative flex min-h-0 w-full flex-1 items-start justify-center px-2 pt-1 sm:px-4 sm:pt-2">
            <AnimatePresence mode="wait">
              {!showLyrics ? (
                currentPlayerStylePreset === "ios-air" ? (
                <motion.div
                  key="cover-view"
                  initial={{ opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  className={artworkFrameClass}
                >
                  <motion.div
                    animate={
                      currentMusicData.isPlaying && isAudioActuallyPlaying
                        ? { y: [0, -8, 0], scale: [1, 1.018, 1] }
                        : { y: 0, scale: 1 }
                    }
                    transition={{
                      duration: 4.8,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className={`relative h-full w-full overflow-hidden shadow-[0_28px_80px_rgba(15,23,42,0.22)] ${artworkOuterRadiusClass}`}
                  >
                    {currentMusicData.currentSong?.albumArt ? (
                      <img
                        src={currentMusicData.currentSong.albumArt}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(160deg,#cad6e2,#8ea4bb)] text-white">
                        <MusicIcon size={88} strokeWidth={1.5} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0)_38%,rgba(15,23,42,0.18)_100%)]" />
                    <div className="absolute -right-12 top-5 h-24 w-24 rounded-full bg-white/30 blur-2xl" />
                  </motion.div>
                  <div className="hidden">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
                      {currentMusicData.isPlaying && isAudioActuallyPlaying ? "PLAYING NOW" : "LOCAL PLAYBACK"}
                    </div>
                    <div className="mt-1 truncate text-[15px] font-semibold text-white">
                      {currentMusicData.currentSong?.title || "还没有歌曲"}
                    </div>
                  </div>
                </motion.div>
                ) : renderPlayerArtwork()
              ) : (
                <motion.div
                  key="lyrics-view"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute inset-0 flex flex-col overflow-y-auto no-scrollbar py-4 [mask-image:linear-gradient(to_bottom,transparent_0%,black_20%,black_80%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_20%,black_80%,transparent_100%)]"
                >
                  {lyrics.length > 0 ? (
                    <div
                      className="space-y-3 px-4 text-center sm:space-y-4 sm:px-6"
                      style={{ paddingBottom: "calc(var(--app-safe-area-bottom-ui, 0px) + 8px)" }}
                    >
                      {lyrics.map((line, index) => {
                        const isActive = lyricsAreTimed && index === activeLyricIndex;
                        return (
                          <div
                            key={index}
                            id={isActive ? "active-lyric" : undefined}
                            className={`transition-all duration-300 ${isActive ? "scale-105" : ""}`}
                          >
                            <p className={`${
                              isActive
                                ? "text-[15px] font-bold text-pink-500 sm:text-base"
                                : lyricsAreTimed
                                  ? "text-[13px] font-medium text-zinc-500/80 sm:text-sm"
                                  : "text-[14px] font-semibold text-zinc-700 sm:text-[15px]"
                            }`}>
                              {line.text}
                            </p>
                            {line.translation && (
                              <p className={`mt-1 ${
                                isActive
                                  ? "text-[12px] font-bold text-pink-500/80 sm:text-sm"
                                  : lyricsAreTimed
                                    ? "text-[11px] font-medium text-zinc-500/60 sm:text-xs"
                                    : "text-[12px] font-medium text-zinc-500 sm:text-[13px]"
                              }`}>
                                {line.translation}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 px-10 text-center">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/30 backdrop-blur-xl">
                        {isResolvingLyrics ? (
                          <RefreshCw size={18} className="animate-spin text-zinc-500" />
                        ) : (
                          <MusicIcon size={20} className="text-zinc-400" />
                        )}
                      </div>
                      <p className="max-w-[240px] text-[13px] font-medium leading-6 text-zinc-500">
                        {lyricStatusText || "暂无歌词"}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Controls */}
        <div className="shrink-0 pb-2 sm:pb-3">
          <div className="space-y-4 px-1 py-1 sm:px-2">
            <div
              className="relative h-1.5 cursor-pointer overflow-hidden rounded-full bg-zinc-900/12"
              onClick={handleSeek}
            >
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-zinc-900/78"
                style={{ width: `${localProgress}%` }}
              />
              <div
                className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-[0_8px_18px_rgba(15,23,42,0.18)] sm:h-4 sm:w-4"
                style={{ left: `calc(${localProgress}% - 7px)` }}
              />
            </div>
            <div className="flex justify-between px-0.5 text-[10px] font-semibold tracking-tight text-zinc-500 sm:text-[11px]">
              <span className="min-w-[38px] sm:min-w-[42px]">{formatTime(localCurrentTime)}</span>
              <span className="min-w-[38px] text-right sm:min-w-[42px]">
                -
                {formatTime(
                  Math.max(
                    0,
                    (audioRef.current?.duration || 0) - localCurrentTime,
                  ),
                )}
              </span>
            </div>
          </div>

          <div className="relative flex items-center justify-between">
            <button
              onClick={() => setShowPlayerMoreMenu(!showPlayerMoreMenu)}
              className={`${chromeControlButtonClass} ${showPlayerMoreMenu ? "text-zinc-700/95" : ""}`}
            >
              <MoreHorizontal size={22} strokeWidth={2.2} />
            </button>

            {/* More Menu Popup */}
            <AnimatePresence>
              {showPlayerMoreMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowPlayerMoreMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className="absolute bottom-16 left-0 z-50 flex min-w-[132px] flex-col gap-1 rounded-[24px] bg-white/86 p-2 shadow-[0_20px_38px_rgba(15,23,42,0.14)] backdrop-blur-2xl"
                  >
                    <button
                      onClick={() => {
                        const songId = currentMusicData.currentSong?.id;
                        if (!songId) return;
                        const newLiked = toggleSongInList(
                          currentMusicData.likedSongs || [],
                          songId,
                        );
                        onUpdateMusicData(withSongLibrary({
                          ...currentMusicData,
                          likedSongs: newLiked,
                        }, currentMusicData.currentSong ? [currentMusicData.currentSong] : []));
                        setShowPlayerMoreMenu(false);
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 rounded-xl transition-colors w-full text-left"
                    >
                      <Heart
                        size={18}
                        className={
                          currentMusicData.likedSongs.includes(
                            currentMusicData.currentSong?.id || "",
                          )
                            ? "text-pink-500 fill-pink-500"
                            : "text-zinc-500"
                        }
                      />
                      <span className="text-[13px] font-bold text-zinc-700">
                        喜欢
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        const songId = currentMusicData.currentSong?.id;
                        if (!songId) return;
                        const newCollected = toggleSongInList(
                          currentMusicData.collectedSongs || [],
                          songId,
                        );
                        onUpdateMusicData(withSongLibrary({
                          ...currentMusicData,
                          collectedSongs: newCollected,
                        }, currentMusicData.currentSong ? [currentMusicData.currentSong] : []));
                        setShowPlayerMoreMenu(false);
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 rounded-xl transition-colors w-full text-left"
                    >
                      <Plus
                        size={18}
                        className={
                          currentMusicData.collectedSongs?.includes(
                            currentMusicData.currentSong?.id || "",
                          )
                            ? "text-pink-500"
                            : "text-zinc-500"
                        }
                      />
                      <span className="text-[13px] font-bold text-zinc-700">
                        {currentMusicData.collectedSongs?.includes(
                          currentMusicData.currentSong?.id || "",
                        )
                          ? "已收藏"
                          : "收藏"}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        // Placeholder for share functionality
                        setShowPlayerMoreMenu(false);
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 rounded-xl transition-colors w-full text-left"
                    >
                      <Share2 size={18} className="text-zinc-500" />
                      <span className="text-[13px] font-bold text-zinc-700">
                        分享
                      </span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-3.5 sm:gap-4">
              <button
                onClick={skipBack}
                className={transportControlButtonClass}
              >
                <SkipBack size={22} strokeWidth={2.25} />
              </button>
              <button
                onClick={togglePlay}
                disabled={!currentMusicData.currentSong}
                className={primaryTransportControlButtonClass}
              >
                {currentMusicData.isPlaying ? (
                  <Pause size={22} strokeWidth={2.35} />
                ) : (
                  <Play size={20} fill="currentColor" className="ml-[1px]" />
                )}
              </button>
              <button
                onClick={skipForward}
                className={transportControlButtonClass}
              >
                <SkipForward size={22} strokeWidth={2.25} />
              </button>
            </div>
            <button
              onClick={() => setShowQueue(true)}
              className={chromeControlButtonClass}
            >
              <ListMusic size={19} strokeWidth={2.15} />
            </button>
          </div>

          {/* Volume Slider (iOS Style) */}
          <div className="mt-1 flex items-center gap-3">
            <Volume2 size={13} className="text-zinc-500 sm:h-[14px] sm:w-[14px]" />
            <div
              className="h-1.5 flex-1 cursor-pointer overflow-hidden rounded-full bg-zinc-900/12"
              onClick={handleVolumeChange}
            >
              <div
                className="h-full rounded-full bg-zinc-900/42 transition-all"
                style={{ width: `${currentMusicData.volume}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPlaylists = () => {
    const hasSearchQuery = searchQuery.trim().length > 0;

    return (
      <div className="relative flex flex-1 min-h-0 flex-col overflow-hidden bg-zinc-50">
        {/* Search Header */}
        <div
          className="sticky top-0 z-20 border-b border-zinc-100 bg-white/80 px-6 pb-4 backdrop-blur-xl"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 24px)" }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-[30px] font-extrabold leading-none tracking-tight text-zinc-900 sm:text-3xl sm:font-black sm:tracking-tighter">
              {hasSearchQuery ? "搜索音乐" : "歌单"}
            </h1>
            <button
              onClick={() => setShowCreatePlaylistDialog(true)}
              className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-900 active:scale-90 transition-transform"
            >
              <Plus size={22} />
            </button>
          </div>
          <div className="flex items-center gap-3 bg-zinc-100/80 rounded-xl px-4 py-2.5 border border-zinc-200/50 transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-pink-500/20 focus-within:border-pink-500/30">
            <Search size={18} className="text-zinc-400" />
            <input
              type="text"
              placeholder="搜索我的/TA的歌单"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none flex-1 text-[15px] placeholder:text-zinc-400 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="p-1 rounded-full bg-zinc-200 text-zinc-500 hover:bg-zinc-300 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {hasSearchQuery ? (
            <p className="mt-3 text-[12px] font-medium text-zinc-400">
              当前优先显示搜索结果，清空后返回歌单视图。
            </p>
          ) : null}
        </div>

        <div
          className={`flex-1 overflow-y-auto px-6 ${
            hasSearchQuery ? "space-y-6 pt-3" : "space-y-10 pt-6"
          }`}
          style={{ paddingBottom: "calc(var(--app-safe-area-bottom-ui, 0px) + 8px)" }}
        >
          {hasSearchQuery ? (
            <div className="-mt-1">
              <MusicSearchResults
                query={searchQuery}
                onPlaySong={playSong}
                onQueueSong={addToQueue}
              />
            </div>
          ) : false ? (
            /* Search Results */
            <section>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold text-zinc-900 tracking-tight">
                  搜索结果
                </h3>
                <span className="text-[12px] font-bold text-zinc-400">
                  {filteredPlaylists.length} 个结果
                </span>
              </div>
              {filteredPlaylists.length > 0 ? (
                <div className="space-y-4">
                  {filteredPlaylists.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlaylist(p)}
                      className="flex items-center gap-4 group cursor-pointer active:opacity-70 transition-opacity"
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden shadow-md border border-zinc-100 shrink-0">
                        <ResolvedMusicCover
                          value={p.cover}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0 border-b border-zinc-100 pb-4">
                        <h4 className="text-[15px] font-bold text-zinc-800 truncate">
                          {p.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider ${
                              p.type === "character"
                                ? "bg-pink-100 text-pink-600"
                                : p.type === "collaborative"
                                ? "bg-purple-100 text-purple-600"
                                : "bg-blue-100 text-blue-600"
                            }`}
                          >
                            {p.type === "character" ? "TA的" : p.type === "collaborative" ? "共创" : "我的"}
                          </span>
                          <p className="text-[12px] font-medium text-zinc-400">
                            {p.songs.length} 首歌曲
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (p.songs.length > 0) {
                            const newQueue = [...currentMusicData.queue];
                            p.songs.forEach((song) => {
                              if (!newQueue.some((s) => s.id === song.id)) {
                                newQueue.push(song);
                              }
                            });
                            onUpdateMusicData({
                              ...currentMusicData,
                              queue: newQueue,
                            });
                          }
                        }}
                        className="p-2 text-zinc-300 hover:text-pink-500 transition-colors"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-300">
                  <Search size={48} className="mb-4 opacity-20" />
                  <p className="font-bold">未找到相关歌单</p>
                </div>
              )}
            </section>
          ) : (
            <>
              {/* Recommended Section */}
              <section>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xl font-bold text-zinc-900 tracking-tight">
                    共创歌单
                  </h3>
                  <button className="text-[14px] font-bold text-pink-500">
                    更多
                  </button>
                </div>
                <div className="flex gap-5 overflow-x-auto pb-4 -mx-6 px-6 no-scrollbar">
                  {currentMusicData.playlists.slice(0, 3).map((p) => (
                    <div
                      key={p.id}
                      className="w-44 shrink-0 group cursor-pointer"
                      onClick={() => setSelectedPlaylist(p)}
                    >
                      <div className="relative aspect-square rounded-[24px] overflow-hidden shadow-xl shadow-zinc-200/50 border border-white mb-3 transition-transform group-hover:scale-[1.02] active:scale-95">
                        <ResolvedMusicCover
                          value={p.cover}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-pink-500 shadow-lg opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                          <Play
                            size={20}
                            fill="currentColor"
                            className="ml-1"
                          />
                        </div>
                      </div>
                      <p className="text-[14px] font-bold text-zinc-800 truncate leading-tight">
                        {p.name}
                      </p>
                      <p className="text-[12px] font-medium text-zinc-400 mt-0.5">
                        精选 {p.songs.length} 首
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* All Playlists List */}
              <section>
                <h3 className="text-xl font-bold text-zinc-900 tracking-tight mb-5">
                  所有歌单
                </h3>
                <div className="space-y-4">
                  {currentMusicData.playlists.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlaylist(p)}
                      className="flex items-center gap-4 group cursor-pointer active:opacity-70 transition-opacity"
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden shadow-md border border-zinc-100 shrink-0">
                        <ResolvedMusicCover
                          value={p.cover}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0 border-b border-zinc-100 pb-4">
                        <h4 className="text-[15px] font-bold text-zinc-800 truncate">
                          {p.name}
                        </h4>
                        <p className="text-[12px] font-medium text-zinc-400 mt-0.5">
                          {p.type === "character" ? character.name : p.type === "collaborative" ? "共创" : "我的"} ·{" "}
                          {p.songs.length} 首
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (p.songs.length > 0) {
                              const newQueue = [...currentMusicData.queue];
                              p.songs.forEach((song) => {
                                if (!newQueue.some((s) => s.id === song.id)) {
                                  newQueue.push(song);
                                }
                              });
                              onUpdateMusicData({
                                ...currentMusicData,
                                queue: newQueue,
                              });
                            }
                          }}
                          className="p-2 text-zinc-300 hover:text-pink-500 transition-colors"
                          title="添加到队列"
                        >
                          <Plus size={18} />
                        </button>
                        <button className="p-2 text-zinc-300 group-hover:text-zinc-500 transition-colors">
                          <MoreHorizontal size={20} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const audioFile = selectedFiles.find((file) => isAudioUploadFile(file));

    if (!audioFile) {
      e.target.value = "";
      return;
    }

    try {
      const [metadata, sidecarLyricText, persistedUrl] = await Promise.all([
        readUploadedSongMetadata(audioFile),
        (async () => {
          const lyricFile = pickSidecarLyricFile(selectedFiles, audioFile);
          if (!lyricFile) {
            return undefined;
          }

          return normalizeLyricText(await lyricFile.text());
        })(),
        saveUploadedBlob(audioFile, {
          fileName: audioFile.name,
          mimeType: audioFile.type || "application/octet-stream",
        }),
      ]);

      const newSong: Song = {
      id: `uploaded-${Date.now()}`,
      title: metadata.title || stripFileExtension(audioFile.name),
      artist: "本地音乐",
      albumArt: LOCAL_MUSIC_PLACEHOLDER_ART,
      url: persistedUrl,
      duration: typeof metadata.duration === "number" ? metadata.duration : 0,
      ...(sidecarLyricText || metadata.lyricsText
        ? { lyricsText: sidecarLyricText || metadata.lyricsText }
        : {}),
    };
      newSong.artist = metadata.artist || LOCAL_MUSIC_ARTIST_LABEL;

    onUpdateMusicData(withSongLibrary({
      ...currentMusicData,
      currentSong: newSong,
      isPlaying: true,
      queue: [newSong, ...currentMusicData.queue],
      recentlyPlayed: [
        newSong.id,
        ...currentMusicData.recentlyPlayed.filter((id) => id !== newSong.id),
      ],
    }, [newSong]));

    setLocalProgress(0);
    setLocalCurrentTime(0);
    setShowAddMusicDialog(false);
    } catch (error) {
      console.error("Error importing local music:", error);
      alert("Local music import failed. Please try again.");
    } finally {
      e.target.value = "";
    }
  };

  const handleAddDirectMusic = () => {
    if (!directMusicUrl.trim() || !directMusicTitle.trim()) return;

    const newSong: Song = {
      id: `url-${Date.now()}`,
      title: directMusicTitle,
      artist: "网络歌曲",
      albumArt: "https://picsum.photos/seed/music_url/300/300",
      url: directMusicUrl,
      duration: 0,
    };

    onUpdateMusicData(withSongLibrary({
      ...currentMusicData,
      currentSong: newSong,
      isPlaying: true,
      queue: [newSong, ...currentMusicData.queue],
      recentlyPlayed: [
        newSong.id,
        ...currentMusicData.recentlyPlayed.filter((id) => id !== newSong.id),
      ],
    }, [newSong]));

    setLocalProgress(0);
    setLocalCurrentTime(0);
    setShowAddMusicDialog(false);
    setDirectMusicUrl("");
    setDirectMusicTitle("");
    setActiveTab("player");
  };

  const renderMe = () => {
    const uniqueSongs = dedupeSongsById([
      ...(currentMusicData.songLibrary || []),
      ...(currentMusicData.currentSong ? [currentMusicData.currentSong] : []),
      ...currentMusicData.queue,
      ...currentMusicData.playlists.flatMap((p) => p.songs),
    ]);
    const uniqueSongMap = new Map(uniqueSongs.map((song) => [song.id, song]));

    const collectedSongsList = (currentMusicData.collectedSongs || [])
      .map((id) => uniqueSongMap.get(id))
      .filter((s): s is Song => !!s);

    const likedSongsList = currentMusicData.likedSongs
      .map((id) => uniqueSongMap.get(id))
      .filter((s): s is Song => !!s);

    const historySongs = currentMusicData.recentlyPlayed
      .map((id) => uniqueSongMap.get(id))
      .filter((s): s is Song => !!s);

    return (
      <div className="relative flex flex-1 min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,#f7f9fc_0%,#eef3f7_100%)]">
        {/* Profile Header */}
        <div
          className="px-6 pb-7"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 34px)" }}
        >
          <div className="flex items-start gap-4">
            <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-white/70 shadow-[0_18px_38px_rgba(15,23,42,0.12)]">
              <ResolvedMusicAvatar value={userAvatar} className="w-full h-full object-cover" alt={userName} />
            </div>
            <div className="flex-1">
              <div className="rounded-full bg-white/56 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500 shadow-[0_8px_18px_rgba(15,23,42,0.06)] backdrop-blur-xl w-fit">
                MUSIC PROFILE
              </div>
              <h1 className="mt-3 text-[30px] font-semibold leading-none tracking-[-0.04em] text-zinc-900">
                {userName}
              </h1>
              <p className="mt-2 text-[13px] font-medium text-zinc-500">
                当前播放器：{activePlayerStyleOption.name}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowAddMusicDialog(true)}
                className={chromeControlButtonClass}
              >
                <Plus size={22} />
              </button>
              <button className={chromeControlButtonClass}>
                <Share2 size={18} />
              </button>
            </div>
          </div>
        </div>

        <div
          className="flex-1 overflow-y-auto px-6 pt-3 space-y-5"
          style={{ paddingBottom: "calc(var(--app-safe-area-bottom-ui, 0px) + 8px)" }}
        >
          {/* Quick Stats Grid - Smaller */}
          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={() => {
                const likedPlaylist: Playlist = {
                  id: "liked-songs",
                  name: "喜欢的歌曲",
                  cover:
                    likedSongsList[0]?.albumArt ||
                    "https://picsum.photos/seed/liked/300/300",
                  songs: likedSongsList,
                  type: "user",
                };
                setSelectedPlaylist(likedPlaylist);
              }}
              className={`${glassPanelClass} flex cursor-pointer flex-col items-center gap-2 p-5 active:scale-95 transition-transform`}
            >
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                <Heart size={20} fill="currentColor" />
              </div>
              <div className="text-center">
                <span className="block text-[14px] font-black text-zinc-800">
                  喜欢的歌曲
                </span>
                <span className="text-[11px] font-bold text-zinc-400">
                  {currentMusicData.likedSongs.length} 首
                </span>
              </div>
            </div>
            <div
              onClick={() => {
                const historyPlaylist: Playlist = {
                  id: "history-songs",
                  name: "最近听歌",
                  cover:
                    historySongs[0]?.albumArt ||
                    "https://picsum.photos/seed/history/300/300",
                  songs: historySongs,
                  type: "user",
                };
                setSelectedPlaylist(historyPlaylist);
              }}
              className={`${glassPanelClass} flex cursor-pointer flex-col items-center gap-2 p-5 active:scale-95 transition-transform`}
            >
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                <Clock size={20} />
              </div>
              <div className="text-center">
                <span className="block text-[14px] font-black text-zinc-800">
                  最近听歌
                </span>
                <span className="text-[11px] font-bold text-zinc-400">
                  {currentMusicData.recentlyPlayed.length} 首
                </span>
              </div>
            </div>
          </div>

          <section className="overflow-hidden rounded-[30px] border border-white/72 bg-white/72 backdrop-blur-2xl">
            <button
              onClick={() => setIsPlayerStyleSectionExpanded((current) => !current)}
              className="w-full px-5 py-4 text-left"
            >
              <div className="min-w-0">
                <div className="flex items-start gap-2.5">
                  <p className="shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400">
                    PLAYER STYLES
                  </p>
                  <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    <div className="max-w-[112px] truncate whitespace-nowrap rounded-full border border-white/80 bg-[linear-gradient(180deg,#fff7fb,#f2e6ee)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#87566f]">
                      {activePlayerStyleOption.name}
                    </div>
                    <div className="max-w-[88px] truncate whitespace-nowrap rounded-full bg-white/70 px-3 py-1 text-[10px] font-semibold text-zinc-500">
                      {activePlayerShapeOption.name}
                    </div>
                    <ChevronLeft
                      size={18}
                      className={`shrink-0 text-zinc-400 transition-transform ${isPlayerStyleSectionExpanded ? "-rotate-90" : "rotate-180"}`}
                    />
                  </div>
                </div>
                <h2 className="mt-3 break-keep text-[18px] font-semibold leading-[1.12] tracking-[-0.03em] text-zinc-900">
                  播放器样式
                </h2>
                <p className="hidden">
                  这里可以修改播放器外观。整块能点开，下面每个样式卡也能继续点开，再选圆形、方形或海报形状。
                </p>
              </div>
            </button>

            <AnimatePresence initial={false}>
              {isPlayerStyleSectionExpanded ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-white/60 px-5 pb-5 pt-4">
                    <div className="flex flex-col gap-3">
                      {PLAYER_STYLE_OPTIONS.map((option) => {
                        const isSelected = option.id === currentPlayerStylePreset;
                        const isExpanded = expandedPlayerStyleCardId === option.id;
                        const marketNote = PLAYER_STYLE_MARKET_NOTES[option.id];

                        return (
                          <div
                            key={option.id}
                            className={`self-start overflow-hidden rounded-[26px] border transition-colors ${
                              isSelected
                                ? "border-zinc-900/12 bg-white/95"
                                : "border-white/70 bg-white/62"
                            }`}
                          >
                            <button
                              onClick={() => togglePlayerStyleCard(option.id)}
                              className="w-full p-3 text-left"
                            >
                              <div className="hidden">
                                <div className="flex h-full flex-col justify-between rounded-[16px] border border-white/20 bg-black/5 p-3">
                                  <span className="text-[10px] font-semibold tracking-[0.24em] text-white/82">
                                    {option.badge}
                                  </span>
                                  <span className="w-fit rounded-full bg-white/24 px-2.5 py-1 text-[10px] font-semibold text-white/88">
                                    {option.chip}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-0 flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[14px] font-semibold text-zinc-900">
                                      {option.name}
                                    </span>
                                    {isSelected ? (
                                      <span className="rounded-full border border-white/80 bg-[linear-gradient(180deg,#fff7fb,#f2e6ee)] px-2 py-0.5 text-[10px] font-semibold text-[#87566f]">
                                        当前
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                                    {option.description}
                                  </p>
                                </div>
                                <ChevronLeft
                                  size={16}
                                  className={`mt-1 shrink-0 text-zinc-300 transition-transform ${isExpanded ? "-rotate-90" : "rotate-180"}`}
                                />
                              </div>
                            </button>

                            <AnimatePresence initial={false}>
                              {isExpanded ? (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="border-t border-zinc-100/70 px-3 pb-3 pt-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                                      MARKET NOTE
                                    </p>
                                    <p className="mt-2 text-[12px] font-medium leading-5 text-zinc-700">
                                      {marketNote.inspiration}
                                    </p>
                                    <p className="mt-2 text-[11px] leading-5 text-zinc-500">
                                      {marketNote.detail}
                                    </p>

                                    <div className="mt-4">
                                      <div className="flex items-center justify-between gap-3">
                                        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                                          SHAPE
                                        </span>
                                        <span className="text-[11px] font-medium text-zinc-500">
                                          {isSelected ? `当前：${activePlayerShapeOption.name}` : "先选中再切形状"}
                                        </span>
                                      </div>

                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {PLAYER_SHAPE_OPTIONS.map((shape) => {
                                          const isShapeSelected = isSelected && shape.id === currentPlayerShapePreset;

                                          return (
                                            <button
                                              key={shape.id}
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                setExpandedPlayerStyleCardId(option.id);
                                                onUpdateMusicData({
                                                  ...currentMusicData,
                                                  playerStylePreset: option.id,
                                                  playerShapeByStyle: {
                                                    ...(currentMusicData.playerShapeByStyle || {}),
                                                    [option.id]: shape.id,
                                                  },
                                                });
                                              }}
                                              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all active:scale-95 ${
                                                isShapeSelected
                                                  ? "border border-white/80 bg-[linear-gradient(180deg,#fff7fb,#f2e6ee)] text-[#7b5568]"
                                                  : "bg-zinc-100/85 text-zinc-600"
                                              }`}
                                            >
                                              {shape.name}
                                            </button>
                                          );
                                        })}
                                      </div>

                                      <p className="mt-2 text-[11px] leading-5 text-zinc-500">
                                        {isSelected ? activePlayerShapeOption.description : "先选中这个样式，再选一个形状。"}
                                      </p>
                                    </div>
                                  </div>
                                </motion.div>
                              ) : null}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>

          <section className="hidden">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400">
                  PLAYER STYLES
                </p>
                <h2 className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-zinc-900">
                  播放器样式
                </h2>
                <p className="hidden">
                  这里只会修改播放器外观，不影响歌曲、歌单、歌词和同步。想切成 iOS 玻璃、网易云胶片，或者更像其他平台的播放器质感，都可以在这里随时换。
                </p>
              </div>
              <div className="rounded-full bg-zinc-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                {activePlayerStyleOption.chip}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {PLAYER_STYLE_OPTIONS.map((option) => {
                const isSelected = option.id === currentPlayerStylePreset;

                return (
                  <button
                    key={option.id}
                    onClick={() => setPlayerStylePreset(option.id)}
                    className={`rounded-[26px] border p-3 text-left transition-all active:scale-[0.98] ${
                      isSelected
                        ? "border-zinc-900/10 bg-white shadow-[0_18px_36px_rgba(15,23,42,0.12)]"
                        : "border-white/70 bg-white/55 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
                    }`}
                  >
                              <div className="hidden">
                      <div className="flex h-full flex-col justify-between rounded-[16px] border border-white/20 bg-black/5 p-3">
                        <span className="text-[10px] font-semibold tracking-[0.24em] text-white/82">
                          {option.badge}
                        </span>
                        <span className="w-fit rounded-full bg-white/24 px-2.5 py-1 text-[10px] font-semibold text-white/88">
                          {option.chip}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-[14px] font-semibold text-zinc-900">
                        {option.name}
                      </span>
                      {isSelected ? (
                        <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                          当前
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Menu List - No Counts */}
          <NeteaseAccountPanel
            value={currentMusicData.neteaseAccount || null}
            onChange={(neteaseAccount) =>
              onUpdateMusicData({
                ...currentMusicData,
                neteaseAccount,
              })
            }
            onImportPlaylist={handleDirectNeteasePlaylistImport}
            isImportingPlaylist={isImporting}
            onSyncPlaylists={handleSyncNeteasePlaylists}
            isSyncing={isSyncingNeteasePlaylists}
          />

          <section className={`${glassPanelClass} p-3`}>
            {[
              {
                name: "我的收藏",
                icon: <Heart size={18} />,
                action: () => {
                  const collectedPlaylist: Playlist = {
                    id: "collected-songs",
                    name: "我的收藏",
                    cover:
                      collectedSongsList[0]?.albumArt ||
                      "https://picsum.photos/seed/collected/300/300",
                    songs: collectedSongsList,
                    type: "user",
                  };
                  setSelectedPlaylist(collectedPlaylist);
                },
              },
              {
                name: "数据管理",
                icon: <Disc size={18} />,
                action: () => setShowDataManagement(true),
              },
              {
                name: "我的共创",
                icon: <Users size={18} />,
                action: () => setShowCollaborativeLibrary(true),
              },
            ].map((item, i, items) => (
              <div
                key={item.name}
                onClick={item.action}
                className={`flex cursor-pointer items-center gap-3 p-3 transition-colors active:bg-white/40 ${i !== items.length - 1 ? "border-b border-zinc-100/60" : ""}`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/65 text-zinc-500 shadow-[0_6px_16px_rgba(15,23,42,0.05)]">
                  {item.icon}
                </div>
                <span className="flex-1 text-[14px] font-bold text-zinc-800">
                  {item.name}
                </span>
                <ChevronLeft size={16} className="rotate-180 text-zinc-200" />
              </div>
            ))}
          </section>

          {/* History Section - Real History */}
          <section className={`${glassPanelClass} p-4`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-zinc-900 tracking-tight">
                历史足迹
              </h3>
              <button
                onClick={() =>
                  onUpdateMusicData({ ...currentMusicData, recentlyPlayed: [] })
                }
                className="text-[12px] font-bold text-zinc-400"
              >
                清除
              </button>
            </div>
            <div className="space-y-2">
              {historySongs.length > 0 ? (
                historySongs.map((song) => (
                  <div
                    key={song.id}
                    onClick={() => playSong(song)}
                    className="group flex cursor-pointer items-center gap-3 rounded-[22px] border border-white/72 bg-white/68 p-3 shadow-[0_12px_28px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-transform active:scale-[0.98]"
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 shadow-sm">
                      <img
                        src={song.albumArt}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[13px] font-bold text-zinc-800 truncate">
                        {song.title}
                      </h4>
                      <p className="text-[11px] font-medium text-zinc-400 truncate mt-0.5">
                        {song.artist}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToQueue(song);
                        }}
                        className="p-1.5 text-zinc-300 hover:text-zinc-900 transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                      <button className="p-1.5 text-zinc-300 group-hover:text-zinc-900 transition-colors">
                        <Play size={16} fill="currentColor" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-zinc-300 text-sm font-bold">
                  暂无历史记录
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  };

  const renderDataManagement = () => (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      className="absolute inset-0 bg-zinc-50 z-[200] flex flex-col"
    >
      <div className="px-6 pt-12 pb-4 bg-white/80 backdrop-blur-xl sticky top-0 z-20 border-b border-zinc-100 flex items-center gap-4">
        <button
          onClick={() => setShowDataManagement(false)}
          className="p-2 -ml-2 text-zinc-500 active:opacity-50 transition-opacity"
        >
          <ChevronLeft size={28} strokeWidth={2.5} />
        </button>
        <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
          数据管理
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <section>
          <h3 className="text-sm font-bold text-zinc-500 mb-3 ml-1">
            我的歌单
          </h3>
          <div className="bg-white rounded-[24px] overflow-hidden shadow-sm border border-zinc-100">
            {currentMusicData.playlists
              .filter((p) => p.type === "user" || p.type === "collaborative")
              .map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-4 ${i !== 0 ? "border-t border-zinc-50" : ""}`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <ResolvedMusicCover
                      value={p.cover}
                      alt={p.name}
                      className="w-10 h-10 rounded-lg object-cover bg-zinc-100"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-zinc-800 truncate">
                        {p.name}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {p.songs.length} 首歌曲
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (await showInAppConfirm("确定要删除这个歌单吗？")) {
                        const newPlaylists = currentMusicData.playlists.filter(
                          (playlist) => playlist.id !== p.id,
                        );
                        onUpdateMusicData({
                          ...currentMusicData,
                          playlists: newPlaylists,
                        });
                      }
                    }}
                    className="p-2 text-zinc-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            {currentMusicData.playlists.filter((p) => p.type === "user" || p.type === "collaborative")
              .length === 0 && (
              <div className="p-8 text-center text-zinc-400 text-sm font-medium">
                暂无自建歌单
              </div>
            )}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-zinc-500 mb-3 ml-1">
            其他数据
          </h3>
          <div className="bg-white rounded-[24px] overflow-hidden shadow-sm border border-zinc-100">
            <div className="flex items-center justify-between p-4 border-b border-zinc-50">
              <span className="text-sm font-bold text-zinc-800">
                清空播放历史
              </span>
              <button
                onClick={async () => {
                  if (await showInAppConfirm("确定要清空播放历史吗？")) {
                    onUpdateMusicData({
                      ...currentMusicData,
                      recentlyPlayed: [],
                    });
                  }
                }}
                className="text-xs font-bold text-red-500 px-3 py-1.5 bg-red-50 rounded-full"
              >
                清空
              </button>
            </div>
            <div className="flex items-center justify-between p-4">
              <span className="text-sm font-bold text-zinc-800">
                清空收藏歌曲
              </span>
              <button
                onClick={async () => {
                  if (await showInAppConfirm("确定要清空所有收藏歌曲吗？")) {
                    onUpdateMusicData({
                      ...currentMusicData,
                      collectedSongs: [],
                    });
                  }
                }}
                className="text-xs font-bold text-red-500 px-3 py-1.5 bg-red-50 rounded-full"
              >
                清空
              </button>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );

  const renderPlaylistDetail = () => {
    if (!selectedPlaylist) return null;
    return (
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        className="absolute inset-0 bg-zinc-50 z-[200] flex flex-col"
      >
        <div className="px-6 pt-12 pb-4 bg-white/80 backdrop-blur-xl sticky top-0 z-20 border-b border-zinc-100 flex items-center gap-4">
          <button
            onClick={() => setSelectedPlaylist(null)}
            className="p-2 -ml-2 text-zinc-500 active:opacity-50 transition-opacity"
          >
            <ChevronLeft size={28} strokeWidth={2.5} />
          </button>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight truncate flex-1">
            {selectedPlaylist.name}
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto pb-32">
          <div className="p-6 flex flex-col items-center">
            <div className="w-48 h-48 rounded-2xl overflow-hidden shadow-xl shadow-zinc-200/50 border border-white mb-6">
              <ResolvedMusicCover
                value={selectedPlaylist.cover}
                alt={selectedPlaylist.name}
                className="w-full h-full object-cover"
              />
            </div>
            <h2 className="text-2xl font-black text-zinc-900 text-center mb-2">
              {selectedPlaylist.name}
            </h2>
            <p className="text-[13px] font-bold text-zinc-400 mb-6">
              共 {selectedPlaylist.songs.length} 首歌曲
            </p>

            <button
              onClick={() => {
                if (selectedPlaylist.songs.length > 0) {
                  onUpdateMusicData({
                    ...currentMusicData,
                    currentSong: selectedPlaylist.songs[0],
                    progress: 0,
                    isPlaying: true,
                    queue: selectedPlaylist.songs,
                  });
                  setLocalProgress(0);
                  setLocalCurrentTime(0);
                  setActiveTab("player");
                  setSelectedPlaylist(null);
                }
              }}
              className="w-full py-4 bg-pink-500 text-white rounded-2xl font-bold shadow-lg shadow-pink-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Play size={20} fill="currentColor" />
              播放全部
            </button>
          </div>

          <div className="px-6 space-y-2">
            {selectedPlaylist.songs.map((song, index) => (
              <div
                key={song.id}
                onClick={() => {
                  onUpdateMusicData({
                    ...currentMusicData,
                    currentSong: song,
                    progress: 0,
                    isPlaying: true,
                    queue: selectedPlaylist.songs,
                  });
                  setLocalProgress(0);
                  setLocalCurrentTime(0);
                  setActiveTab("player");
                  setSelectedPlaylist(null);
                }}
                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white active:scale-[0.98] transition-all cursor-pointer group"
              >
                <span className="text-[13px] font-bold text-zinc-300 w-4 text-center">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <h4
                    className={`text-[15px] font-bold truncate ${currentMusicData.currentSong?.id === song.id ? "text-pink-500" : "text-zinc-800"}`}
                  >
                    {song.title}
                  </h4>
                  <p className="text-[12px] font-medium text-zinc-400 truncate mt-0.5">
                    {song.artist}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addToQueue(song);
                  }}
                  className="p-2 text-zinc-300 hover:text-pink-500 transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderCollaborativeLibrary = () => {
    if (!showCollaborativeLibrary) return null;

    const collaborativePlaylists = currentMusicData.playlists.filter(
      (playlist) => playlist.type === "collaborative",
    );

    return (
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        className="absolute inset-0 bg-zinc-50 z-[190] flex flex-col"
      >
        <div className="px-6 pt-12 pb-4 bg-white/80 backdrop-blur-xl sticky top-0 z-20 border-b border-zinc-100 flex items-center gap-4">
          <button
            onClick={() => setShowCollaborativeLibrary(false)}
            className="p-2 -ml-2 text-zinc-500 active:opacity-50 transition-opacity"
          >
            <ChevronLeft size={28} strokeWidth={2.5} />
          </button>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight truncate flex-1">
            我的共创
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto pb-32">
          <div className="p-6 flex flex-col items-center">
            <div className="w-28 h-28 rounded-[28px] bg-white shadow-lg shadow-zinc-200/40 border border-white flex items-center justify-center text-pink-500 mb-5">
              <Users size={42} />
            </div>
            <h2 className="text-2xl font-black text-zinc-900 text-center mb-2">
              共创歌单
            </h2>
            <p className="text-[13px] font-bold text-zinc-400 mb-2">
              共 {collaborativePlaylists.length} 个歌单
            </p>
          </div>

          {collaborativePlaylists.length > 0 ? (
            <div className="px-6 space-y-4">
              {collaborativePlaylists.map((playlist) => (
                <div
                  key={playlist.id}
                  onClick={() => {
                    setShowCollaborativeLibrary(false);
                    setSelectedPlaylist(playlist);
                  }}
                  className="flex items-center gap-4 group cursor-pointer active:opacity-70 transition-opacity"
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden shadow-md border border-zinc-100 shrink-0">
                    <ResolvedMusicCover
                      value={playlist.cover}
                      alt={playlist.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 border-b border-zinc-100 pb-4">
                    <h4 className="text-[15px] font-bold text-zinc-800 truncate">
                      {playlist.name}
                    </h4>
                    <p className="text-[12px] font-medium text-zinc-400 mt-0.5">
                      共创 · {playlist.songs.length} 首
                    </p>
                  </div>
                  <ChevronLeft
                    size={16}
                    className="rotate-180 text-zinc-200 shrink-0"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-16 flex flex-col items-center text-zinc-300">
              <Users size={48} className="mb-4 opacity-20" />
              <p className="font-bold">还没有共创歌单</p>
              <p className="mt-2 text-[13px] font-medium text-zinc-400 text-center">
                先新建一个邀请角色参与的歌单，再从这里进入。
              </p>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  const renderQueue = () => (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      className="absolute inset-0 bg-white z-[250] flex flex-col"
    >
      <div className="px-6 pt-12 pb-4 flex items-center justify-between border-b border-zinc-100">
        <h2 className="text-xl font-black text-zinc-900 tracking-tighter">
          待播清单
        </h2>
        <button
          onClick={() => setShowQueue(false)}
          className="px-4 py-2 bg-zinc-100 rounded-full text-sm font-bold text-zinc-500"
        >
          完成
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <Reorder.Group
          axis="y"
          values={currentMusicData.queue}
          onReorder={(newQueue) =>
            onUpdateMusicData({ ...currentMusicData, queue: newQueue })
          }
          className="space-y-3"
        >
          {currentMusicData.queue.map((song) => (
            <Reorder.Item
              key={song.id}
              value={song}
              onClick={() => {
                playSong(song);
                setShowQueue(false);
              }}
              className={`flex items-center gap-4 p-3 rounded-2xl border transition-all ${
                currentMusicData.currentSong?.id === song.id
                  ? "bg-pink-50 border-pink-100 shadow-sm"
                  : "bg-white border-zinc-100"
              }`}
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 shadow-sm">
                <img
                  src={song.albumArt}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h4
                  className={`text-[14px] font-bold truncate ${
                    currentMusicData.currentSong?.id === song.id
                      ? "text-pink-500"
                      : "text-zinc-800"
                  }`}
                >
                  {song.title}
                </h4>
                <p className="text-[12px] font-medium text-zinc-400 truncate">
                  {song.artist}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    const newQueue = currentMusicData.queue.filter(
                      (s) => s.id !== song.id,
                    );
                    onUpdateMusicData({ ...currentMusicData, queue: newQueue });
                  }}
                  className="p-2 text-zinc-300 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
                <div
                  onClick={(event) => event.stopPropagation()}
                  className="p-2 text-zinc-300 cursor-grab active:cursor-grabbing"
                >
                  <GripVertical size={18} />
                </div>
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>

        {currentMusicData.queue.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-300">
            <MusicIcon size={48} className="mb-4 opacity-20" />
            <p className="font-bold">清单空空如也</p>
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[100] flex h-full min-h-0 flex-col overflow-hidden bg-white font-[-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,Helvetica,Arial,sans-serif]"
    >
      {/* Main Content */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
        {activeTab === "player" && renderPlayer()}
        {activeTab === "playlists" && renderPlaylists()}
        {activeTab === "me" && renderMe()}
      </div>

      {/* iOS Style Bottom Navigation */}
      <div
        className="app-bottom-tabbar relative z-50 shrink-0 bg-white/72 shadow-[0_-18px_36px_rgba(15,23,42,0.08)] backdrop-blur-[24px]"
      >
        <div
          className="flex min-h-[40px] items-end justify-around px-4 pt-1"
          style={{ paddingBottom: "var(--app-safe-area-bottom-tab, 0px)" }}
        >
          <button
            onClick={() => setActiveTab("player")}
            className={`flex flex-col items-center justify-center gap-1.5 transition-all ${activeTab === "player" ? "text-pink-500 scale-110" : "text-zinc-400"}`}
          >
            <MusicIcon size={26} strokeWidth={activeTab === "player" ? 2.5 : 2} />
            <span className="text-[10px] font-bold tracking-tight">音乐</span>
          </button>
          <button
            onClick={() => setActiveTab("playlists")}
            className={`flex flex-col items-center justify-center gap-1.5 transition-all ${activeTab === "playlists" ? "text-pink-500 scale-110" : "text-zinc-400"}`}
          >
            <ListMusic
              size={26}
              strokeWidth={activeTab === "playlists" ? 2.5 : 2}
            />
            <span className="text-[10px] font-bold tracking-tight">歌单</span>
          </button>
          <button
            onClick={() => setActiveTab("me")}
            className={`flex flex-col items-center justify-center gap-1.5 transition-all ${activeTab === "me" ? "text-pink-500 scale-110" : "text-zinc-400"}`}
          >
            <User size={26} strokeWidth={activeTab === "me" ? 2.5 : 2} />
            <span className="text-[10px] font-bold tracking-tight">我的</span>
          </button>
        </div>
      </div>

      {/* Full Screen Chat Overlay */}
      <AnimatePresence>
        {showChat && (
          <TogetherChatPanel
            activeTogetherCharacter={activeTogetherCharacter}
            settings={settings}
            userAvatar={userAvatar}
            userName={userName}
            history={currentMusicData.chatHistory}
            chatInput={chatInput}
            isSendingTogetherChat={isSendingTogetherChat}
            visualSettings={visualSettings}
            chatEndRef={chatEndRef}
            onBack={() => setShowChat(false)}
            onInputChange={setChatInput}
            onSend={sendChatMessage}
            onSendSticker={sendTogetherStickerMessage}
            onSendAudio={sendTogetherAudioMessage}
          />
        )}
      </AnimatePresence>

      {/* Data Management Overlay */}
      <AnimatePresence>
        {showDataManagement && renderDataManagement()}
      </AnimatePresence>

      {/* Playlist Detail Overlay */}
      <AnimatePresence>
        {showCollaborativeLibrary && renderCollaborativeLibrary()}
        {selectedPlaylist && renderPlaylistDetail()}
      </AnimatePresence>

      {/* Queue Overlay */}
      <AnimatePresence>{showQueue && renderQueue()}</AnimatePresence>

      {/* Create Playlist Dialog */}
      <AnimatePresence>
        {showCreatePlaylistDialog && (
          <div className="absolute inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm px-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-white rounded-[32px] p-8 shadow-2xl"
            >
              <h3 className="text-xl font-black text-zinc-900 mb-6 text-center">
                新建歌单
              </h3>
              <div className="bg-zinc-100 rounded-2xl px-4 py-4 mb-6">
                <input
                  type="text"
                  autoFocus
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="请输入歌单名称"
                  className="w-full bg-transparent outline-none text-lg font-bold text-zinc-800 placeholder:text-zinc-400"
                  onKeyDown={(e) => e.key === "Enter" && createPlaylist()}
                />
              </div>

              <div className="mb-8">
                <p className="text-sm font-bold text-zinc-500 mb-3 text-center">邀请共创角色（可选）</p>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide justify-start px-1">
                  <div
                    onClick={() => setSelectedCollaborator(null)}
                    className={`shrink-0 flex flex-col items-center gap-2 cursor-pointer transition-transform active:scale-95 ${!selectedCollaborator ? "opacity-100" : "opacity-40"}`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${!selectedCollaborator ? "border-pink-500 bg-pink-50 text-pink-500" : "border-zinc-200 bg-zinc-100 text-zinc-400"}`}>
                      <X size={20} />
                    </div>
                    <span className={`text-[11px] font-bold ${!selectedCollaborator ? "text-pink-500" : "text-zinc-500"}`}>不邀请</span>
                  </div>
                  {allCharacters.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCollaborator(c.id)}
                      className={`shrink-0 flex flex-col items-center gap-2 cursor-pointer transition-transform active:scale-95 ${selectedCollaborator === c.id ? "opacity-100" : "opacity-40"}`}
                    >
                      <ResolvedMusicAvatar
                        value={c.avatar}
                        className={`w-12 h-12 rounded-full object-cover border-2 ${selectedCollaborator === c.id ? "border-pink-500" : "border-transparent"}`}
                        alt={c.name}
                      />
                      <span className={`text-[11px] font-bold truncate w-14 text-center ${selectedCollaborator === c.id ? "text-pink-500" : "text-zinc-500"}`}>
                        {c.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreatePlaylistDialog(false)}
                  className="flex-1 py-4 bg-zinc-100 rounded-2xl font-bold text-zinc-500 active:scale-95 transition-transform"
                >
                  取消
                </button>
                <button
                  onClick={createPlaylist}
                  disabled={!newPlaylistName.trim()}
                  className="flex-1 py-4 bg-pink-500 rounded-2xl font-bold text-white shadow-lg shadow-pink-200 active:scale-95 transition-transform disabled:opacity-50 disabled:shadow-none"
                >
                  创建
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Music Dialog */}
      <AnimatePresence>
        {showAddMusicDialog && (
          <div className="absolute inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm px-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[80vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-zinc-100">
                <h3 className="text-xl font-black text-zinc-900 text-center">
                  添加音乐
                </h3>
              </div>

              <div className="p-6 space-y-6">
                {/* Local File Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-zinc-800">本地上传</h4>
                  <div className="space-y-3">
                    <label className="w-full py-3 bg-zinc-100 rounded-xl font-bold text-zinc-800 active:scale-95 transition-transform flex items-center justify-center gap-2 cursor-pointer border border-dashed border-zinc-300 hover:border-pink-500 hover:text-pink-500">
                      <Upload size={18} />
                      选择音频文件
                      <input
                        type="file"
                        accept="audio/*,.lrc,.txt"
                        multiple
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                    <p className="text-[11px] font-medium leading-5 text-zinc-400">
                      支持读取音频内嵌歌词，也可以同时选择同名 `.lrc` 或 `.txt` 歌词文件。
                    </p>
                  </div>
                </div>

                <div className="h-px bg-zinc-100" />

                {/* Direct URL Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-zinc-800">添加链接</h4>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={directMusicTitle}
                      onChange={(e) => setDirectMusicTitle(e.target.value)}
                      placeholder="歌曲名称"
                      className="w-full bg-zinc-100 rounded-xl px-4 py-3 font-bold text-zinc-800 outline-none focus:ring-2 focus:ring-pink-500/20"
                    />
                    <input
                      type="text"
                      value={directMusicUrl}
                      onChange={(e) => setDirectMusicUrl(e.target.value)}
                      placeholder="音频链接 (mp3/wav...)"
                      className="w-full bg-zinc-100 rounded-xl px-4 py-3 font-bold text-zinc-800 outline-none focus:ring-2 focus:ring-pink-500/20"
                    />
                    <button
                      onClick={handleAddDirectMusic}
                      disabled={
                        !directMusicUrl.trim() || !directMusicTitle.trim()
                      }
                      className="w-full py-3 rounded-xl bg-pink-500 font-bold text-white shadow-lg shadow-pink-200/80 active:scale-95 transition-transform disabled:bg-zinc-300 disabled:text-zinc-500 disabled:shadow-none"
                    >
                      立即播放
                    </button>
                  </div>
                </div>

                <div className="h-px bg-zinc-100" />

                {/* Netease Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-zinc-800">
                    导入网易云歌曲/歌单
                  </h4>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={neteaseUrl}
                      onChange={(e) => setNeteaseUrl(e.target.value)}
                      placeholder="歌曲链接，或歌单链接 / 歌单 ID"
                      className="w-full bg-zinc-100 rounded-xl px-4 py-3 font-bold text-zinc-800 outline-none focus:ring-2 focus:ring-pink-500/20"
                      disabled={isImporting}
                    />
                    <button
                      onClick={handleImportNeteasePlaylist}
                      disabled={!neteaseUrl.trim() || isImporting}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-500 py-3 font-bold text-white shadow-lg shadow-pink-200/80 active:scale-95 transition-transform disabled:bg-zinc-300 disabled:text-zinc-500 disabled:shadow-none"
                    >
                      {isImporting ? (
                        <RefreshCw size={18} className="animate-spin" />
                      ) : (
                        "立即导入"
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6">
                <button
                  onClick={() => setShowAddMusicDialog(false)}
                  className="w-full py-3 bg-zinc-50 rounded-xl font-bold text-zinc-400 active:scale-95 transition-transform border border-zinc-100"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invite Dialog */}
      <AnimatePresence>
        {showInviteDialog && (
          <div className="absolute inset-0 z-[110] flex items-end justify-center bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full bg-white rounded-t-[32px] p-6 pb-10 shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-zinc-200 rounded-full mx-auto mb-6" />
              <h3 className="text-lg font-bold text-zinc-800 mb-6 text-center">
                邀请一起听歌
              </h3>

              <div className="space-y-4">
                {allCharacters.map((char) => (
                  <button
                    key={char.id}
                    onClick={() => inviteTogether(char.id)}
                    className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-50 transition-colors"
                  >
                    <ResolvedMusicAvatar
                      value={char.avatar}
                      className="w-12 h-12 rounded-full object-cover"
                      alt={char.name}
                    />
                    <div className="flex-1 text-left">
                      <p className="font-bold text-zinc-800">{char.name}</p>
                      <p className="text-xs text-zinc-400">
                        {char.motto || "在线"}
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-900">
                      <Plus size={20} />
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowInviteDialog(false)}
                className="w-full mt-8 py-4 bg-zinc-100 rounded-2xl font-bold text-zinc-500 active:scale-95 transition-transform"
              >
                取消
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}


