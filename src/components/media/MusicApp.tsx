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
  Send,
  Smile,
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
  Character,
  ChatMessage,
} from "../../types";
import { usePersistedMusicDataBridge } from "../../features/persistence/usePersistedMusicDataBridge";
import { useResolvedPersistentValue } from "../../features/persistence/useResolvedPersistentValue";
import { MusicSearchResults } from "../../features/music-search/MusicSearchResults";
import { NeteaseAccountPanel } from "../../features/music-netease/NeteaseAccountPanel";
import { syncNeteasePlaylistsByUid } from "../../features/music-netease/syncNeteasePlaylists";
import { generateTogetherChatReply } from "../../features/music-together/generateTogetherChatReply";

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

type MusicAppProps = {
  character: Character;
  userAvatar: string;
  userName: string;
  musicData: MusicData;
  onUpdateMusicData: (data: MusicData) => void;
  onBack: () => void;
  allCharacters: Character[];
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
};

export default function MusicApp({
  character,
  userAvatar,
  userName,
  musicData,
  onUpdateMusicData,
  onBack,
  allCharacters,
  audioRef,
}: MusicAppProps) {
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
  const [lyrics, setLyrics] = useState<{ time: number; text: string; translation?: string }[]>([]);
  const [showLyrics, setShowLyrics] = useState(false);
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
  const currentMusicDataRef = useRef<MusicData | null>(null);
  const onUpdateMusicDataRef = useRef(onUpdateMusicData);

  const resolveSongPlaybackUrl = (song: Song | null | undefined) => {
    if (!song) return "";
    if (song.id.startsWith("netease-")) {
      return `/api/netease/song?id=${song.id.replace("netease-", "")}`;
    }
    return song.url;
  };

  const normalizePlaybackUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("blob:") || url.startsWith("data:")) {
      return url;
    }
    return new URL(url, window.location.origin).toString();
  };

  const appendSongOnce = (ids: string[], songId: string) => [
    songId,
    ...ids.filter((id) => id !== songId),
  ];

  const recordSongPlayback = (song: Song, data: MusicData) => ({
    ...data,
    history: appendSongOnce(data.history || [], song.id),
    recentlyPlayed: appendSongOnce(data.recentlyPlayed || [], song.id),
  });

  const toggleSongInList = (ids: string[], songId: string) =>
    ids.includes(songId) ? ids.filter((id) => id !== songId) : [...ids, songId];

  // Mock data with real audio URLs
  const defaultSongs: Song[] = [
    {
      id: "1",
      title: "鏅村ぉ",
      artist: "周杰伦",
      albumArt: "https://picsum.photos/seed/music1/300/300",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      duration: 372,
    },
    {
      id: "2",
      title: "七里香",
      artist: "周杰伦",
      albumArt: "https://picsum.photos/seed/music2/300/300",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      duration: 425,
    },
    {
      id: "3",
      title: "鍛婄櫧姘旂悆",
      artist: "周杰伦",
      albumArt: "https://picsum.photos/seed/music3/300/300",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
      duration: 312,
    },
  ];

  const defaultMusicData: MusicData = {
    currentSong: defaultSongs[0],
    isPlaying: false,
    progress: 0,
    volume: 80,
    playlists: [
      {
        id: "p1",
        name: "我的最爱",
        cover: "https://picsum.photos/seed/p1/300/300",
        songs: defaultSongs,
        type: "user",
      },
      {
        id: "p2",
        name: `${character.name}的歌单`,
        cover: character.avatar,
        songs: defaultSongs.slice(0, 2),
        type: "character",
        authorId: character.id,
      },
      {
        id: "p3",
        name: "共创歌单",
        cover: "https://picsum.photos/seed/p3/300/300",
        songs: [],
        type: "collaborative",
      },
    ],
    likedSongs: ["1"],
    history: ["1", "2"],
    recentlyPlayed: ["1"],
    togetherWith: null,
    togetherStartTime: null,
    chatHistory: [],
    queue: defaultSongs,
    collectedSongs: [],
  };
  const currentMusicData: MusicData = {
    ...defaultMusicData,
    ...musicData,
  };
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
  usePersistedMusicDataBridge(currentMusicData, onUpdateMusicData);

  useEffect(() => {
    currentMusicDataRef.current = currentMusicData;
    onUpdateMusicDataRef.current = onUpdateMusicData;
  }, [currentMusicData, onUpdateMusicData]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentMusicData.chatHistory]);

  // Audio Playback Logic
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;

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
      setIsAudioActuallyPlaying(false);
      setPlaybackError("当前歌曲暂时无法播放");
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
    const fetchLyrics = async () => {
      if (!currentMusicData.currentSong) return;
      const songId = currentMusicData.currentSong.id;

      // Only fetch for NetEase songs
      if (!songId.startsWith("netease-")) {
        setLyrics([]);
        return;
      }

      try {
        const realId = songId.replace("netease-", "");
        const response = await fetch(`/api/netease/lyric?id=${realId}`);
        if (!response.ok) throw new Error("Failed to fetch lyrics");
        const data = await response.json();

        if (data.lrc && data.lrc.lyric) {
          const lrcStr = data.lrc.lyric;
          const tlyricStr = data.tlyric?.lyric || "";
          
          const parseLines = (str: string) => {
            return str.split("\n").map((line: string) => {
              const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
              if (match) {
                const minutes = parseInt(match[1], 10);
                const seconds = parseInt(match[2], 10);
                const milliseconds = parseInt(match[3], 10);
                const time =
                  minutes * 60 +
                  seconds +
                  milliseconds / (match[3].length === 2 ? 100 : 1000);
                const text = match[4].trim();
                return { time, text };
              }
              return null;
            }).filter((l: any) => l !== null && l.text !== "");
          };

          const parsedLyrics = parseLines(lrcStr);
          const parsedTlyrics = parseLines(tlyricStr);

          // Merge translations
          const mergedLyrics = parsedLyrics.map(lyric => {
            // Find closest translation within 0.5s
            const translation = parsedTlyrics.find(t => Math.abs(t!.time - lyric!.time) < 0.5);
            return {
              ...lyric,
              translation: translation ? translation.text : undefined
            };
          }) as { time: number; text: string; translation?: string }[];

          setLyrics(mergedLyrics);
        } else {
          setLyrics([]);
        }
      } catch (error) {
        console.error("Error fetching lyrics:", error);
        setLyrics([]);
      }
    };

    fetchLyrics();
  }, [currentMusicData.currentSong]);

  const activeLyricIndex = useMemo(() => {
    return lyrics.findIndex((line, index) => {
      return localCurrentTime >= line.time && (index === lyrics.length - 1 || localCurrentTime < lyrics[index + 1].time);
    });
  }, [lyrics, localCurrentTime]);

  // Scroll active lyric into view
  useEffect(() => {
    if (showLyrics && activeLyricIndex !== -1) {
      const activeLyric = document.getElementById("active-lyric");
      if (activeLyric) {
        activeLyric.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [activeLyricIndex, showLyrics]);

  // Sync song source and play state
  useEffect(() => {
    console.log('MusicApp syncPlayback effect triggered, isPlaying:', currentMusicData.isPlaying);
    const audio = audioRef.current;
    if (!audio || !currentMusicData.currentSong) return;
    if (currentMusicData.currentSong.id !== lastRecordedPlaybackIdRef.current) {
      lastRecordedPlaybackIdRef.current = null;
    }

    const syncPlayback = async () => {
      setPlaybackError("");
      const nextPlaybackUrl = resolveSongPlaybackUrl(currentMusicData.currentSong);
      const currentAudioUrl = normalizePlaybackUrl(audio.currentSrc || audio.src);
      const targetAudioUrl = normalizePlaybackUrl(nextPlaybackUrl);

      // If source changed, update it
      if (currentAudioUrl !== targetAudioUrl) {
        // Before changing src, we should wait for any pending play promise
        if (playPromiseRef.current) {
          try {
            await playPromiseRef.current;
          } catch (e) {
            // Ignore interruption errors
          }
        }
        if (!audio.paused) {
          audio.pause();
        }
        audio.removeAttribute("src");
        audio.load();
        audio.src = nextPlaybackUrl;
        audio.currentTime = 0;
        audio.load();
      }

      if (currentMusicData.isPlaying) {
        console.log('MusicApp attempting to play');
        setIsAudioActuallyPlaying(false);
        // Wait for any pending play promise
        if (playPromiseRef.current) {
          try {
            await playPromiseRef.current;
          } catch (e) {
            // Ignore
          }
        }
        playPromiseRef.current = audio.play();
        try {
          await playPromiseRef.current;
        } catch (e) {
          setIsAudioActuallyPlaying(false);
          setPlaybackError("当前歌曲暂时无法播放");
          // Check if it's the interruption error
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
          playPromiseRef.current = null;
        }
      } else {
        setPlaybackError("");
        if (!audio.paused) {
          audio.pause();
        }
      }
    };

    syncPlayback();
  }, [currentMusicData.currentSong?.id, currentMusicData.isPlaying]);

  const togglePlay = () => {
    onUpdateMusicData({
      ...currentMusicData,
      isPlaying: !currentMusicData.isPlaying,
    });
  };

  const skipForward = () => {
    const queue = currentMusicData.queue || defaultSongs;
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

  const playSong = (song: Song) => {
    setPlaybackError("");
    onUpdateMusicData({
      ...currentMusicData,
      currentSong: song,
      progress: 0,
      isPlaying: true,
    });
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
    onUpdateMusicData({
      ...currentMusicData,
      queue: [...currentMusicData.queue, song],
    });
  };

  const inviteTogether = (charId: string) => {
    onUpdateMusicData({
      ...currentMusicData,
      togetherWith: charId,
      togetherStartTime: Date.now(),
      chatHistory: [
        ...currentMusicData.chatHistory,
        {
          role: "model",
          text: "嘿，我接受了你的邀请！让我们一起听这首歌吧。",
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

  const handleImportNeteasePlaylist = async () => {
    if (!neteaseUrl.trim()) return;

    // Extract ID from URL or use as ID directly
    let id = neteaseUrl.trim();
    const idMatch = neteaseUrl.match(/id=(\d+)/);
    if (idMatch) {
      id = idMatch[1];
    } else if (!/^\d+$/.test(id)) {
      alert("请输入有效的网易云链接或ID");
      return;
    }

    const isSong = neteaseUrl.includes("song");

    setIsImporting(true);
    try {
      if (isSong) {
        const response = await fetch(`/api/netease/song/detail?id=${id}`);
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
            (track.al || track.album)?.picUrl ||
            "https://picsum.photos/seed/netease/300/300",
          url: `/api/netease/song?id=${track.id}`,
          duration: Math.floor((track.dt || track.duration || 240000) / 1000),
        };

        onUpdateMusicData({
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
        });

        setLocalProgress(0);
        setLocalCurrentTime(0);
        setActiveTab("player");

        setNeteaseUrl("");
        setShowAddMusicDialog(false);
      } else {
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
            (track.al || track.album)?.picUrl ||
            "https://picsum.photos/seed/netease/300/300",
            url: `/api/netease/song?id=${track.id}`,
          duration: Math.floor((track.dt || track.duration || 240000) / 1000),
        }));

        const newPlaylist: Playlist = {
          id: `netease-pl-${playlist.id}`,
          name: playlist.name,
          cover:
            playlist.coverImgUrl ||
            "https://picsum.photos/seed/netease-pl/300/300",
          songs: newSongs,
          type: "user",
        };

        onUpdateMusicData({
          ...currentMusicData,
          playlists: [...currentMusicData.playlists, newPlaylist],
          currentSong:
            newSongs.length > 0 ? newSongs[0] : currentMusicData.currentSong,
          isPlaying: newSongs.length > 0 ? true : currentMusicData.isPlaying,
          progress: newSongs.length > 0 ? 0 : currentMusicData.progress,
          queue: newSongs.length > 0 ? newSongs : currentMusicData.queue,
        });

        if (newSongs.length > 0) {
          setLocalProgress(0);
          setLocalCurrentTime(0);
          setActiveTab("player");
        }

        setNeteaseUrl("");
        setShowAddMusicDialog(false);
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

      onUpdateMusicData({
        ...currentMusicData,
        playlists: [...preservedPlaylists, ...syncedPlaylists],
      });

      alert(`已同步 ${syncedPlaylists.length} 个网易云歌单。`);
    } catch (error) {
      console.error("NetEase playlist sync error:", error);
      alert("同步歌单失败，请稍后再试。");
    } finally {
      setIsSyncingNeteasePlaylists(false);
    }
  };

  const sendChatMessage = async () => {
    const trimmedInput = chatInput.trim();
    if (
      !trimmedInput
      || isSendingTogetherChat
      || !currentMusicData.togetherWith
    ) {
      return;
    }

    const newMsg: ChatMessage = {
      role: "user",
      text: trimmedInput,
      timestamp: Date.now(),
    };
    const updatedHistory = [...currentMusicData.chatHistory, newMsg];

    onUpdateMusicData({
      ...currentMusicData,
      chatHistory: updatedHistory,
    });
    setChatInput("");
    setIsSendingTogetherChat(true);

    try {
      const replyText = await generateTogetherChatReply({
        character,
        userName,
        currentSong: currentMusicData.currentSong,
        togetherDuration: getTogetherDuration(),
        history: updatedHistory,
      });

      const nextData = currentMusicDataRef.current;
      if (!nextData?.togetherWith) {
        return;
      }

      onUpdateMusicDataRef.current({
        ...nextData,
        chatHistory: [
          ...nextData.chatHistory,
          {
            role: "model",
            text: replyText,
            timestamp: Date.now(),
          },
        ],
      });
    } catch (error) {
      console.error("Together chat generation error:", error);
      const nextData = currentMusicDataRef.current;
      if (!nextData?.togetherWith) {
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

  const renderPlayer = () => (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-center scale-110 blur-3xl opacity-50"
          style={{
            backgroundImage: `url(${currentMusicData.currentSong?.albumArt})`,
          }}
        />
        <div className="absolute inset-0 bg-white/60" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col px-6 pb-6 pt-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-0 shrink-0">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-zinc-600 active:opacity-50 transition-opacity"
          >
            <ChevronLeft size={28} strokeWidth={2.5} />
          </button>
          <div className="text-center">
            <p className="text-[13px] font-semibold text-zinc-500 tracking-tight">
              正在播放
            </p>
          </div>
          <div className="flex items-center gap-2">
            {currentMusicData.togetherWith && (
              <button
                onClick={disconnectTogether}
                className="h-10 rounded-full px-3 flex items-center justify-center bg-zinc-100 text-zinc-500 shadow-sm transition-all text-[12px] font-bold"
              >
                断开
              </button>
            )}
            {currentMusicData.togetherWith && (
              <button
                onClick={() => setShowChat(!showChat)}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-100 text-zinc-400 shadow-sm transition-all"
              >
                <MessageCircle size={20} />
              </button>
            )}
            <button
              onClick={() => setShowInviteDialog(true)}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-100 text-zinc-400 shadow-sm transition-all"
            >
              <Users size={20} />
            </button>
          </div>
        </div>

        {/* Avatars Area (Above CD) */}
        <div className="h-16 flex items-center justify-center mb-0 shrink-0">
          <AnimatePresence mode="wait">
            {!currentMusicData.togetherWith ? (
              <motion.div
                key="single"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-10 h-10 rounded-full border-2 border-white shadow-md overflow-hidden">
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
                  <motion.div className="w-12 h-12 rounded-full border-2 border-white shadow-lg overflow-hidden z-10">
                    <ResolvedMusicAvatar
                      value={userAvatar}
                      className="w-full h-full object-cover"
                      alt={userName}
                    />
                  </motion.div>

                  <div className="relative flex items-center justify-center w-20">
                    {/* Left Ripple */}
                    <svg className="absolute left-0 w-10 h-6 overflow-visible">
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
                    <svg className="absolute right-0 w-10 h-6 overflow-visible">
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
                      className="text-pink-500 z-10 bg-white rounded-full p-1"
                    >
                      <Heart size={16} fill="currentColor" />
                    </motion.div>
                  </div>

                  <motion.div
                    initial={{ x: -60, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className="w-12 h-12 rounded-full border-2 border-white shadow-lg overflow-hidden z-10"
                  >
                    <ResolvedMusicAvatar
                      value={character.avatar}
                      className="w-full h-full object-cover"
                      alt={character.name}
                    />
                  </motion.div>
                </div>
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-1 flex items-center gap-1.5 bg-pink-500/10 px-3 py-0.5 rounded-full"
                >
                  <Clock size={10} className="text-pink-500" />
                  <span className="text-[9px] font-bold text-pink-600 uppercase tracking-wider">
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
          <div className="mt-4 mb-2 text-center shrink-0">
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight mb-0.5 truncate px-4">
              {currentMusicData.currentSong?.title}
            </h1>
            <p className="text-[15px] font-medium text-pink-500 truncate px-4">
              {currentMusicData.currentSong?.artist}
            </p>
            {playbackError ? (
              <p className="mt-2 text-[12px] font-semibold text-rose-500">
                {playbackError}
              </p>
            ) : null}
          </div>

          <div className="flex-1 w-full flex items-start justify-center px-4 min-h-0 relative pt-2">
            <AnimatePresence mode="wait">
              {!showLyrics ? (
                <motion.div
                  key="cd-view"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative aspect-square max-h-full max-w-[260px] w-full"
                >
                  <motion.div
                    animate={{ rotate: currentMusicData.isPlaying && isAudioActuallyPlaying ? 360 : 0 }}
                    transition={{
                      duration: 20,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="w-full h-full rounded-full bg-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center justify-center p-1 relative"
                  >
                    <div className="absolute inset-0 rounded-full border-[12px] border-zinc-800/50" />
                    <div className="absolute inset-0 rounded-full border-[1px] border-white/5" />
                    <div className="w-full h-full rounded-full overflow-hidden">
                      <img
                        src={currentMusicData.currentSong?.albumArt}
                        className="w-full h-full object-cover opacity-80"
                      />
                    </div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-zinc-900 rounded-full border-4 border-zinc-800 flex items-center justify-center shadow-inner">
                      <div className="w-2 h-2 bg-zinc-700 rounded-full" />
                    </div>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key="lyrics-view"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute inset-0 flex flex-col overflow-y-auto no-scrollbar py-4 [mask-image:linear-gradient(to_bottom,transparent_0%,black_20%,black_80%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_20%,black_80%,transparent_100%)]"
                >
                  {lyrics.length > 0 ? (
                    <div className="space-y-4 text-center px-6 pb-20">
                      {lyrics.map((line, index) => {
                        const isActive = index === activeLyricIndex;
                        return (
                          <div
                            key={index}
                            id={isActive ? "active-lyric" : undefined}
                            className={`transition-all duration-300 ${isActive ? "scale-105" : ""}`}
                          >
                            <p className={`${isActive ? "text-base font-bold text-pink-500" : "text-sm font-medium text-zinc-500/80"}`}>
                              {line.text}
                            </p>
                            {line.translation && (
                              <p className={`mt-1 ${isActive ? "text-sm font-bold text-pink-500/80" : "text-xs font-medium text-zinc-500/60"}`}>
                                {line.translation}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-zinc-400 font-medium h-full">
                      暂无歌词
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4 pb-2 shrink-0">
          <div className="space-y-3">
            <div
              className="relative h-1.5 bg-zinc-200/50 rounded-full overflow-hidden cursor-pointer"
              onClick={handleSeek}
            >
              <motion.div
                className="absolute inset-y-0 left-0 bg-zinc-800 rounded-full"
                style={{ width: `${localProgress}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md border border-zinc-100"
                style={{ left: `calc(${localProgress}% - 8px)` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-bold text-zinc-400 tracking-tighter">
              <span>{formatTime(localCurrentTime)}</span>
              <span>
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

          <div className="flex items-center justify-between px-2 relative">
            <button
              onClick={() => setShowPlayerMoreMenu(!showPlayerMoreMenu)}
              className={`transition-colors ${showPlayerMoreMenu ? "text-pink-500" : "text-zinc-400 active:text-zinc-600"}`}
            >
              <MoreHorizontal size={24} />
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
                    className="absolute bottom-16 left-0 bg-white rounded-2xl shadow-xl border border-zinc-100 p-2 z-50 flex flex-col gap-1 min-w-[120px]"
                  >
                    <button
                      onClick={() => {
                        const songId = currentMusicData.currentSong?.id;
                        if (!songId) return;
                        const newLiked = toggleSongInList(
                          currentMusicData.likedSongs || [],
                          songId,
                        );
                        onUpdateMusicData({
                          ...currentMusicData,
                          likedSongs: newLiked,
                        });
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
                        onUpdateMusicData({
                          ...currentMusicData,
                          collectedSongs: newCollected,
                        });
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

            <div className="flex items-center gap-8">
              <button
                onClick={skipBack}
                className="text-zinc-400 active:scale-90 transition-transform"
              >
                <SkipBack size={28} fill="currentColor" />
              </button>
              <button
                onClick={togglePlay}
                className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 shadow-xl shadow-zinc-200/40 active:scale-95 transition-transform"
              >
                {currentMusicData.isPlaying ? (
                  <Pause size={30} fill="currentColor" />
                ) : (
                  <Play size={30} fill="currentColor" className="ml-1" />
                )}
              </button>
              <button
                onClick={skipForward}
                className="text-zinc-400 active:scale-90 transition-transform"
              >
                <SkipForward size={28} fill="currentColor" />
              </button>
            </div>
            <button
              onClick={() => setShowQueue(true)}
              className="text-zinc-400 active:text-zinc-600"
            >
              <ListMusic size={20} />
            </button>
          </div>

          {/* Volume Slider (iOS Style) */}
          <div className="flex items-center gap-3 px-2">
            <Volume2 size={14} className="text-zinc-400" />
            <div
              className="flex-1 h-1.5 bg-zinc-200/50 rounded-full overflow-hidden cursor-pointer"
              onClick={handleVolumeChange}
            >
              <div
                className="h-full bg-zinc-400/50 rounded-full transition-all"
                style={{ width: `${currentMusicData.volume}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPlaylists = () => {
    return (
      <div className="flex-1 flex flex-col overflow-hidden relative bg-zinc-50">
        {/* Search Header */}
        <div className="px-6 pt-12 pb-4 bg-white/80 backdrop-blur-xl sticky top-0 z-20 border-b border-zinc-100">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-black text-zinc-900 tracking-tighter">
              歌单
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
        </div>

        <div className="flex-1 overflow-y-auto space-y-10 px-6 pt-6 pb-32">
          {searchQuery ? (
            <MusicSearchResults
              query={searchQuery}
              onPlaySong={playSong}
              onQueueSong={addToQueue}
            />
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
                    鏇村
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const newSong: Song = {
      id: `local-${Date.now()}`,
      title: file.name.replace(/\.[^/.]+$/, ""), // remove extension
      artist: "本地音乐",
      albumArt: "https://picsum.photos/seed/music_local/300/300",
      url: url,
      duration: 0,
    };

    onUpdateMusicData({
      ...currentMusicData,
      currentSong: newSong,
      isPlaying: true,
      queue: [newSong, ...currentMusicData.queue],
      recentlyPlayed: [
        newSong.id,
        ...currentMusicData.recentlyPlayed.filter((id) => id !== newSong.id),
      ],
    });

    setLocalProgress(0);
    setLocalCurrentTime(0);
    setShowAddMusicDialog(false);
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

    onUpdateMusicData({
      ...currentMusicData,
      currentSong: newSong,
      isPlaying: true,
      queue: [newSong, ...currentMusicData.queue],
      recentlyPlayed: [
        newSong.id,
        ...currentMusicData.recentlyPlayed.filter((id) => id !== newSong.id),
      ],
    });

    setLocalProgress(0);
    setLocalCurrentTime(0);
    setShowAddMusicDialog(false);
    setDirectMusicUrl("");
    setDirectMusicTitle("");
    setActiveTab("player");
  };

  const renderMe = () => {
    const allKnownSongs = [
      ...defaultSongs,
      ...(currentMusicData.currentSong ? [currentMusicData.currentSong] : []),
      ...currentMusicData.queue,
      ...currentMusicData.playlists.flatMap((p) => p.songs),
    ];
    // Deduplicate by ID
    const uniqueSongs = Array.from(
      new Map(allKnownSongs.map((s) => [s.id, s])).values(),
    );

    const collectedSongsList = (currentMusicData.collectedSongs || [])
      .map((id) => uniqueSongs.find((s) => s.id === id))
      .filter((s): s is Song => !!s);

    const likedSongsList = currentMusicData.likedSongs
      .map((id) => uniqueSongs.find((s) => s.id === id))
      .filter((s): s is Song => !!s);

    const historySongs = currentMusicData.recentlyPlayed
      .map((id) => uniqueSongs.find((s) => s.id === id))
      .filter((s): s is Song => !!s);

    return (
      <div className="flex-1 flex flex-col overflow-hidden relative bg-zinc-50">
        {/* Profile Header */}
        <div className="px-6 pt-16 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-zinc-100 shadow-xl">
              <ResolvedMusicAvatar value={userAvatar} className="w-full h-full object-cover" alt={userName} />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-zinc-900 tracking-tighter leading-tight">
                {userName}
              </h1>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowAddMusicDialog(true)}
                className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 shadow-lg shadow-zinc-200/40 active:scale-90 transition-transform"
              >
                <Plus size={22} />
              </button>
              <button className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 border border-zinc-100">
                <Share2 size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-32 space-y-6">
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
              className="bg-white p-4 rounded-[24px] shadow-lg shadow-zinc-200/20 border border-white flex flex-col items-center gap-2 active:scale-95 transition-transform cursor-pointer"
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
              className="bg-white p-4 rounded-[24px] shadow-lg shadow-zinc-200/20 border border-white flex flex-col items-center gap-2 active:scale-95 transition-transform cursor-pointer"
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

          {/* Menu List - No Counts */}
          <NeteaseAccountPanel
            value={currentMusicData.neteaseAccount || null}
            onChange={(neteaseAccount) =>
              onUpdateMusicData({
                ...currentMusicData,
                neteaseAccount,
              })
            }
            onSyncPlaylists={handleSyncNeteasePlaylists}
            isSyncing={isSyncingNeteasePlaylists}
          />

          <section className="bg-white rounded-[24px] p-3 shadow-lg shadow-zinc-200/10 border border-white">
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
                className={`flex items-center gap-3 p-3 active:bg-zinc-50 transition-colors cursor-pointer ${i !== items.length - 1 ? "border-b border-zinc-50" : ""}`}
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-50 flex items-center justify-center text-zinc-400">
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
          <section>
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
                    className="flex items-center gap-3 p-2.5 bg-white rounded-xl shadow-sm border border-white active:scale-[0.98] transition-transform cursor-pointer group"
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
                  onClick={() => {
                    const newQueue = currentMusicData.queue.filter(
                      (s) => s.id !== song.id,
                    );
                    onUpdateMusicData({ ...currentMusicData, queue: newQueue });
                  }}
                  className="p-2 text-zinc-300 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
                <div className="p-2 text-zinc-300 cursor-grab active:cursor-grabbing">
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

  const renderTogetherChat = () => (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      className="absolute inset-0 bg-white z-[200] flex flex-col"
    >
      {/* Chat Header */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between border-b border-zinc-100">
        <button
          onClick={() => setShowChat(false)}
          className="p-2 -ml-2 text-zinc-500"
        >
          <ChevronLeft size={28} strokeWidth={2.5} />
        </button>
        <div className="flex flex-col items-center">
          <h2 className="text-sm font-bold text-zinc-800">一起听聊天</h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-zinc-400 font-medium">
              正在与 {character.name} 共听
            </span>
          </div>
        </div>
        <div className="w-10" /> {/* Spacer */}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50">
        {currentMusicData.chatHistory.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-2`}
          >
            {msg.role === "model" && (
              <ResolvedMusicAvatar
                value={character.avatar}
                className="w-8 h-8 rounded-full object-cover shadow-sm mb-1"
                alt={character.name}
              />
            )}
            <div
              className={`max-w-[75%] px-4 py-2.5 rounded-[20px] text-[14px] leading-relaxed shadow-sm ${
                msg.role === "user"
                  ? "bg-pink-500 text-white rounded-br-none"
                  : "bg-white text-zinc-800 rounded-bl-none border border-zinc-100"
              }`}
            >
              {msg.text}
            </div>
            {msg.role === "user" && (
              <ResolvedMusicAvatar
                value={userAvatar}
                className="w-8 h-8 rounded-full object-cover shadow-sm mb-1"
                alt={userName}
              />
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Chat Input */}
      <div className="p-4 pb-10 bg-white border-t border-zinc-100 flex gap-3 items-center">
        <div className="flex-1 bg-zinc-100 rounded-2xl px-4 py-2.5 flex items-center gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
            disabled={isSendingTogetherChat}
            placeholder="说点什么..."
            className="flex-1 bg-transparent outline-none text-[14px]"
          />
          <Smile size={20} className="text-zinc-400" />
        </div>
        <button
          onClick={sendChatMessage}
          disabled={isSendingTogetherChat}
          className="w-11 h-11 rounded-full bg-pink-500 flex items-center justify-center text-white shadow-lg shadow-pink-200 active:scale-90 transition-transform disabled:opacity-60"
        >
          <Send size={20} />
        </button>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-0 bg-white flex flex-col z-[100] font-[-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,Helvetica,Arial,sans-serif]"
    >
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden pb-20">
        {activeTab === "player" && renderPlayer()}
        {activeTab === "playlists" && renderPlaylists()}
        {activeTab === "me" && renderMe()}
      </div>

      {/* iOS Style Bottom Navigation */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-xl flex items-center justify-around px-8 pb-0 z-50">
        <button
          onClick={() => setActiveTab("player")}
          className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === "player" ? "text-pink-500 scale-110" : "text-zinc-400"}`}
        >
          <MusicIcon size={26} strokeWidth={activeTab === "player" ? 2.5 : 2} />
          <span className="text-[10px] font-bold tracking-tight">音乐</span>
        </button>
        <button
          onClick={() => setActiveTab("playlists")}
          className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === "playlists" ? "text-pink-500 scale-110" : "text-zinc-400"}`}
        >
          <ListMusic
            size={26}
            strokeWidth={activeTab === "playlists" ? 2.5 : 2}
          />
          <span className="text-[10px] font-bold tracking-tight">歌单</span>
        </button>
        <button
          onClick={() => setActiveTab("me")}
          className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === "me" ? "text-pink-500 scale-110" : "text-zinc-400"}`}
        >
          <User size={26} strokeWidth={activeTab === "me" ? 2.5 : 2} />
          <span className="text-[10px] font-bold tracking-tight">我的</span>
        </button>
      </div>

      {/* Full Screen Chat Overlay */}
      <AnimatePresence>{showChat && renderTogetherChat()}</AnimatePresence>

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
                        accept="audio/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                </div>

                <div className="h-px bg-zinc-100" />

                {/* Direct URL Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-zinc-800">娣诲姞閾炬帴</h4>
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
                      className="w-full py-3 bg-zinc-900 rounded-xl font-bold text-white shadow-lg shadow-zinc-200 active:scale-95 transition-transform disabled:opacity-50"
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
                      placeholder="歌曲/歌单链接或ID"
                      className="w-full bg-zinc-100 rounded-xl px-4 py-3 font-bold text-zinc-800 outline-none focus:ring-2 focus:ring-pink-500/20"
                      disabled={isImporting}
                    />
                    <button
                      onClick={handleImportNeteasePlaylist}
                      disabled={!neteaseUrl.trim() || isImporting}
                      className="w-full py-3 bg-zinc-900 rounded-xl font-bold text-white shadow-lg active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
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
                  鍙栨秷
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
                        {char.motto || "鍦ㄧ嚎"}
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
                鍙栨秷
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}


