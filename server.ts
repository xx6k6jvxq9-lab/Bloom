import express from "express";
import { createServer as createViteServer } from "vite";
import { Readable } from "stream";
import os from "os";
import {
  checkNeteaseQrLogin,
  clearNeteaseAuthSession,
  createNeteaseQrLoginImage,
  createNeteaseQrLoginKey,
  getAuthenticatedPlaylistDetail,
  getAuthenticatedUserPlaylists,
  getNeteaseAuthStatus,
  resolveAuthenticatedSongUrl,
} from "./server/neteaseAuth.js";

function getLocalNetworkIp() {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    const items = interfaces[name];
    if (!items) continue;

    for (const item of items) {
     const isIPv4 = item.family === "IPv4";
      if (isIPv4 && !item.internal) {
        return item.address;
      }
    }
  }

  return null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const HOST = "0.0.0.0";

  app.use(express.json());

  const resolveNeteasePlayableUrl = async (id: string | number) => {
    let finalUrl = `https://music.163.com/song/media/outer/url?id=${id}.mp3`;

    const headResponse = await fetch(finalUrl, {
      method: "HEAD",
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (headResponse.status === 301 || headResponse.status === 302) {
      const location = headResponse.headers.get("location");
      if (location) {
        if (location.includes("/404")) {
          return null;
        }
        finalUrl = location.replace(/^http:/, "https:");
      }
    }

    if (headResponse.status >= 400) {
      return null;
    }

    return finalUrl;
  };

  const getNeteaseSongEntitlement = (song: any) => {
    const fee = typeof song?.fee === "number" ? song.fee : song?.privilege?.fee;
    const payed = song?.privilege?.payed;

    if (fee === 1 || fee === 4 || fee === 16 || payed === 1) {
      return "vip";
    }

    if (fee === 0 || fee === 8) {
      return "free";
    }

    return "unknown";
  };

  const pickPreviewDurationMs = (song: any) => {
    const directCandidates = [
      song?.previewDurationMs,
      song?.previewDuration,
      song?.freeTrialInfo?.duration,
      song?.freeTrialPrivilege?.duration,
      song?.privilege?.freeTrialInfo?.duration,
      song?.privilege?.freeTrialPrivilege?.duration,
    ];

    for (const candidate of directCandidates) {
      if (Number.isFinite(candidate) && Number(candidate) > 0) {
        return Number(candidate);
      }
    }

    const rangedCandidates = [
      song?.freeTrialInfo,
      song?.freeTrialPrivilege,
      song?.privilege?.freeTrialInfo,
      song?.privilege?.freeTrialPrivilege,
    ];

    for (const candidate of rangedCandidates) {
      const start = Number(candidate?.start);
      const end = Number(candidate?.end);
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        return end - start;
      }
    }

    return null;
  };

  const pickPreviewDurationFromSongUrl = (freeTrialInfo: any) => {
    if (!freeTrialInfo || typeof freeTrialInfo !== "object") {
      return null;
    }

    const start = Number(freeTrialInfo.start);
    const end = Number(freeTrialInfo.end);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      return end - start;
    }

    const duration = Number(freeTrialInfo.duration);
    if (Number.isFinite(duration) && duration > 0) {
      return duration;
    }

    return null;
  };

  const fetchNeteaseSongDetail = async (id: string | number) => {
    const response = await fetch(
      `https://music.163.com/api/song/detail?ids=[${id}]`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Referer: "https://music.163.com/",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch from NetEase: ${response.status}`);
    }

    return response.json();
  };

  const resolveNeteaseSongAccess = async (id: string | number) => {
    const [authStatus, authenticatedSongUrl, resolvedUrl, detail] = await Promise.all([
      getNeteaseAuthStatus().catch(() => ({
        loggedIn: false,
        source: "none" as const,
        profile: null,
        vipType: 0,
        isVip: false,
        hasCookie: false,
      })),
      resolveAuthenticatedSongUrl(id).catch(() => null),
      resolveNeteasePlayableUrl(id),
      fetchNeteaseSongDetail(id).catch((error) => {
        console.warn("Failed to fetch NetEase song detail for access resolution:", error);
        return null;
      }),
    ]);

    const track = detail?.songs?.[0] || null;
    const entitlement = getNeteaseSongEntitlement(track);
    const previewDurationMs = pickPreviewDurationMs(track);
    const proxyUrl = `/api/netease/song?id=${id}`;

    if (authStatus.loggedIn && authenticatedSongUrl?.url) {
      const authenticatedPreviewDurationMs =
        pickPreviewDurationFromSongUrl(authenticatedSongUrl.freeTrialInfo)
        ?? previewDurationMs;

      return {
        id: String(id),
        status: authenticatedSongUrl.freeTrialInfo ? "preview" : "full",
        entitlement,
        previewDurationMs: authenticatedPreviewDurationMs,
        playUrl: authenticatedSongUrl.url,
        proxyUrl,
        note: authenticatedSongUrl.freeTrialInfo
          ? "当前通过网易云登录态拿到了试听片段，时长以官方返回为准。"
          : "当前通过网易云登录态播放。",
      };
    }

    if (!resolvedUrl) {
      if (entitlement !== "vip") {
        return {
          id: String(id),
          status: "full",
          entitlement,
          previewDurationMs,
          proxyUrl,
          note: "将尝试公开链路播放，最终以实际播放结果为准。",
        };
      }

      return {
        id: String(id),
        status: "unavailable",
        entitlement,
        previewDurationMs,
        proxyUrl,
        note:
          entitlement === "vip"
            ? "当前链路没有拿到可播放的官方试听音频。"
            : "当前没有拿到可播放音频。",
      };
    }

    if (entitlement === "vip") {
      return {
        id: String(id),
        status: "preview",
        entitlement,
        previewDurationMs,
        playUrl: resolvedUrl,
        proxyUrl,
        note:
          previewDurationMs && previewDurationMs > 0
            ? `当前按官方可返回的试听片段播放，约 ${Math.ceil(previewDurationMs / 1000)} 秒。`
            : "当前按官方可返回的试听片段播放，实际时长以上游返回为准。",
      };
    }

    return {
      id: String(id),
      status: "full",
      entitlement,
      previewDurationMs,
      playUrl: resolvedUrl,
      proxyUrl,
      note: "当前可以直接播放。",
    };
  };

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/netease/auth/status", async (req, res) => {
    try {
      const status = await getNeteaseAuthStatus();
      res.json(status);
    } catch (error) {
      console.error("Error fetching NetEase auth status:", error);
      res.status(500).json({ error: "Failed to fetch auth status" });
    }
  });

  app.get("/api/netease/auth/qr/key", async (req, res) => {
    try {
      const payload = await createNeteaseQrLoginKey();
      res.json(payload);
    } catch (error) {
      console.error("Error creating NetEase QR login key:", error);
      res.status(500).json({ error: "Failed to create QR login key" });
    }
  });

  app.get("/api/netease/auth/qr/create", async (req, res) => {
    const key = String(req.query.key || "").trim();
    if (!key) {
      return res.status(400).json({ error: "Missing QR key" });
    }

    try {
      const payload = await createNeteaseQrLoginImage(key);
      res.json(payload);
    } catch (error) {
      console.error("Error creating NetEase QR login image:", error);
      res.status(500).json({ error: "Failed to create QR login image" });
    }
  });

  app.get("/api/netease/auth/qr/check", async (req, res) => {
    const key = String(req.query.key || "").trim();
    if (!key) {
      return res.status(400).json({ error: "Missing QR key" });
    }

    try {
      const payload = await checkNeteaseQrLogin(key);
      res.json(payload);
    } catch (error) {
      console.error("Error checking NetEase QR login:", error);
      res.status(500).json({ error: "Failed to check QR login status" });
    }
  });

  app.post("/api/netease/auth/logout", (req, res) => {
    try {
      clearNeteaseAuthSession();
      res.json({ ok: true });
    } catch (error) {
      console.error("Error clearing NetEase auth session:", error);
      res.status(500).json({ error: "Failed to clear auth session" });
    }
  });

  app.get("/api/netease/song/access", async (req, res) => {
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: "Missing song ID" });
    }

    try {
      const access = await resolveNeteaseSongAccess(String(id));
      res.json(access);
    } catch (error) {
      console.error("Error resolving NetEase song access:", error);
      res.status(500).json({ error: "Failed to resolve song access" });
    }
  });

  app.get("/api/netease/song", async (req, res) => {
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: "Missing song ID" });
    }

    try {
      const access = await resolveNeteaseSongAccess(String(id));

      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Referer: "https://music.163.com/",
      };

      if (req.headers.range) {
        headers["Range"] = req.headers.range;
      }

      const fallbackUrl = `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
      const candidateUrls = [];
      if (access.playUrl) {
        candidateUrls.push(access.playUrl);
      }
      if (access.entitlement !== "vip" && !candidateUrls.includes(fallbackUrl)) {
        candidateUrls.push(fallbackUrl);
      }

      let response: Response | null = null;
      for (const candidateUrl of candidateUrls) {
        const nextResponse = await fetch(candidateUrl, { headers, redirect: "follow" });
        const contentType = (nextResponse.headers.get("content-type") || "").toLowerCase();
        const isAudioLike =
          contentType.startsWith("audio/")
          || contentType.includes("application/octet-stream")
          || contentType.includes("binary/octet-stream");
        if (nextResponse.ok && isAudioLike) {
          response = nextResponse;
          break;
        }
      }

      if (!response) {
        return res
          .status(access.entitlement === "vip" ? 404 : 502)
          .json({ error: access.note || "Song not found or is temporarily unavailable" });
      }

      const contentType = response.headers.get("content-type");
      const contentLength = response.headers.get("content-length");
      const contentRange = response.headers.get("content-range");
      const acceptRanges = response.headers.get("accept-ranges");

      if (contentType) res.setHeader("Content-Type", contentType);
      if (contentLength) res.setHeader("Content-Length", contentLength);
      if (contentRange) res.setHeader("Content-Range", contentRange);
      if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);
      res.setHeader("x-bloom-playback-status", access.status);
      if (access.previewDurationMs) {
        res.setHeader("x-bloom-preview-duration-ms", String(access.previewDurationMs));
      }

      res.status(response.status);

      if (response.body) {
        // @ts-ignore
        Readable.fromWeb(response.body).pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      console.error("Error proxying NetEase song:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to proxy song" });
      }
    }
  });

  app.get("/api/netease/lyric", async (req, res) => {
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: "Missing song ID" });
    }

    try {
      const response = await fetch(
        `https://music.163.com/api/song/lyric?id=${id}&lv=1&kv=1&tv=-1`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch from NetEase: ${response.status}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching NetEase lyrics:", error);
      res.status(500).json({ error: "Failed to fetch lyrics data" });
    }
  });

  app.get("/api/netease/song/detail", async (req, res) => {
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: "Missing song ID" });
    }

    try {
      const data = await fetchNeteaseSongDetail(String(id));
      res.json(data);
    } catch (error) {
      console.error("Error fetching NetEase song detail:", error);
      res.status(500).json({ error: "Failed to fetch song detail" });
    }
  });

  app.get("/api/netease/search", async (req, res) => {
    const keywords = String(req.query.keywords || "").trim();
    const limit = Math.max(1, Math.min(30, Number(req.query.limit || 12)));
    if (!keywords) {
      return res.status(400).json({ error: "Missing keywords" });
    }

    try {
      const response = await fetch("https://music.163.com/api/search/get/web?csrf_token=", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Referer: "https://music.163.com/",
        },
        body: new URLSearchParams({
          s: keywords,
          type: "1",
          offset: "0",
          limit: String(limit),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch from NetEase: ${response.status}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error searching NetEase music:", error);
      res.status(500).json({ error: "Failed to search music" });
    }
  });

  app.get("/api/netease/search-playable", async (req, res) => {
    const keywords = String(req.query.keywords || "").trim();
    const limit = Math.max(1, Math.min(20, Number(req.query.limit || 10)));
    if (!keywords) {
      return res.status(400).json({ error: "Missing keywords" });
    }

    try {
      const response = await fetch("https://music.163.com/api/search/get/web?csrf_token=", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Referer: "https://music.163.com/",
        },
        body: new URLSearchParams({
          s: keywords,
          type: "1",
          offset: "0",
          limit: String(limit),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch from NetEase: ${response.status}`);
      }

      const data = await response.json();
      const songs = data?.result?.songs || [];
      const playableChecks = await Promise.all(
        songs.map(async (song: any) => ({
          song,
          playableUrl: await resolveNeteasePlayableUrl(song.id),
        }))
      );

      const playableSongs = playableChecks
        .filter((item) => item.playableUrl)
        .map((item) => item.song);

      res.json({
        result: {
          songs: playableSongs,
        },
      });
    } catch (error) {
      console.error("Error searching playable NetEase music:", error);
      res.status(500).json({ error: "Failed to search playable music" });
    }
  });

  app.get("/api/freetouse/search", async (req, res) => {
    const query = String(req.query.query || "").trim();
    const limit = Math.max(1, Math.min(30, Number(req.query.limit || 30)));
    if (!query) {
      return res.status(400).json({ error: "Missing query" });
    }

    try {
      const upstreamUrl = new URL("https://api.freetouse.com/v3/music/tracks/search");
      upstreamUrl.searchParams.set("query", query);
      upstreamUrl.searchParams.set("limit", String(limit));

      const response = await fetch(upstreamUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
          Referer: "https://freetouse.com/",
          Origin: "https://freetouse.com",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch from Free To Use: ${response.status}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error searching Free To Use music:", error);
      res.status(500).json({ error: "Failed to search Free To Use music" });
    }
  });

  app.get("/api/netease/playlist", async (req, res) => {
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: "Missing playlist ID" });
    }

    try {
      const authenticatedPlaylist = await getAuthenticatedPlaylistDetail(String(id));
      if (authenticatedPlaylist) {
        return res.json(authenticatedPlaylist);
      }

      const response = await fetch(
        `https://music.163.com/api/playlist/detail?id=${id}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch from NetEase: ${response.status}`);
      }

      const data = await response.json();
      const playlist = data.playlist || data.result;

      if (!playlist) {
        console.error("NetEase API returned unexpected data:", data);
        return res.json(data);
      }

      if (playlist.trackIds && playlist.trackIds.length > 0) {
        const trackIds = playlist.trackIds.map((t: any) => t.id);
        const allTracks = [];

        for (let i = 0; i < trackIds.length; i += 500) {
          const batchIds = trackIds.slice(i, i + 500);

          const detailResponse = await fetch(
            `https://music.163.com/api/song/detail?ids=[${batchIds.join(",")}]`,
            {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
              },
            }
          );

          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            if (detailData.songs) {
              allTracks.push(...detailData.songs);
            }
          }
        }

        if (allTracks.length > 0) {
          playlist.tracks = allTracks;
        }
      }

      res.json(data);
    } catch (error) {
      console.error("Error fetching NetEase playlist:", error);
      res.status(500).json({ error: "Failed to fetch playlist data" });
    }
  });

  app.get("/api/netease/playlist-playable", async (req, res) => {
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: "Missing playlist ID" });
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:${PORT}/api/netease/playlist?id=${id}`,
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch playlist detail: ${response.status}`);
      }

      const data = await response.json();
      const playlist = data.playlist || data.result;

      if (!playlist) {
        return res.status(404).json({ error: "Playlist not found" });
      }

      res.json({
        ...data,
        playlist: data.playlist ? playlist : undefined,
        result: data.result ? playlist : undefined,
      });
    } catch (error) {
      console.error("Error fetching NetEase playlist:", error);
      res.status(500).json({ error: "Failed to fetch playlist data" });
    }
  });

  app.get("/api/netease/user-playlists", async (req, res) => {
    const uid = String(req.query.uid || "").trim();
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 50)));
    const offset = Math.max(0, Number(req.query.offset || 0));
    if (!uid) {
      return res.status(400).json({ error: "Missing user ID" });
    }

    try {
      const authenticatedPlaylists = await getAuthenticatedUserPlaylists(uid, limit, offset);
      if (authenticatedPlaylists) {
        return res.json(authenticatedPlaylists);
      }

      const response = await fetch(
        `https://music.163.com/api/user/playlist/?offset=${offset}&limit=${limit}&uid=${uid}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            Referer: "https://music.163.com/",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch NetEase user playlists: ${response.status}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching NetEase user playlists:", error);
      res.status(500).json({ error: "Failed to fetch user playlists" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: true,
      },
      appType: "spa",
    });

    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    const path = await import("path");

    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, HOST, () => {
    const localIp = getLocalNetworkIp();

    console.log("");
    console.log(`Local:   http://localhost:${PORT}`);
    if (localIp) {
      console.log(`Network: http://${localIp}:${PORT}`);
    } else {
      console.log("Network: 未获取到局域网 IP");
    }
    console.log("");
  });
}

startServer();
