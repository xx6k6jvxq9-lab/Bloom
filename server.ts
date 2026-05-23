import express from "express";
import { createServer as createViteServer } from "vite";
import { Readable } from "stream";
import os from "os";

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
  const NETEASE_COVER_HOST_PATTERN = /(^|\.)music\.126\.net$|(^|\.)nosdn\.127\.net$/i;

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

  const normalizeNeteaseCoverSource = (src: string) => {
    const trimmed = src.trim();
    if (!trimmed) return null;

    try {
      const url = new URL(trimmed);
      if (!/^https?:$/i.test(url.protocol) || !NETEASE_COVER_HOST_PATTERN.test(url.hostname)) {
        return null;
      }

      url.protocol = "https:";
      if (!url.searchParams.has("param")) {
        url.searchParams.set("param", "400y400");
      }

      return url.toString();
    } catch {
      return null;
    }
  };

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/netease/cover", async (req, res) => {
    const src = String(req.query.src || "").trim();
    if (!src) {
      return res.status(400).json({ error: "Missing cover source" });
    }

    const normalizedSource = normalizeNeteaseCoverSource(src);
    if (!normalizedSource) {
      return res.status(400).json({ error: "Invalid NetEase cover source" });
    }

    try {
      const response = await fetch(normalizedSource, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Referer: "https://music.163.com/",
          Accept: "image/*,*/*;q=0.8",
        },
        redirect: "follow",
      });

      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (!response.ok || !contentType.startsWith("image/")) {
        return res.status(response.status >= 400 ? response.status : 502).json({
          error: "Failed to fetch NetEase cover",
        });
      }

      const contentLength = response.headers.get("content-length");
      const etag = response.headers.get("etag");
      const lastModified = response.headers.get("last-modified");
      const cacheControl =
        response.headers.get("cache-control")
        || "public, max-age=86400, stale-while-revalidate=86400";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", cacheControl);
      if (contentLength) res.setHeader("Content-Length", contentLength);
      if (etag) res.setHeader("ETag", etag);
      if (lastModified) res.setHeader("Last-Modified", lastModified);
      res.status(response.status);

      if (response.body) {
        // @ts-ignore
        Readable.fromWeb(response.body).pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      console.error("Error proxying NetEase cover:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to proxy NetEase cover" });
      }
    }
  });

  app.get("/api/netease/song", async (req, res) => {
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: "Missing song ID" });
    }

    try {
      const finalUrl = await resolveNeteasePlayableUrl(String(id));
      if (!finalUrl) {
        return res
          .status(404)
          .json({ error: "Song not found or is VIP/copyright restricted" });
      }

      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Referer: "https://music.163.com/",
      };

      if (req.headers.range) {
        headers["Range"] = req.headers.range;
      }

      const response = await fetch(finalUrl, { headers });

      if (!response.ok) {
        return res.status(response.status).send(response.statusText);
      }

      const contentType = response.headers.get("content-type");
      const contentLength = response.headers.get("content-length");
      const contentRange = response.headers.get("content-range");
      const acceptRanges = response.headers.get("accept-ranges");

      if (contentType) res.setHeader("Content-Type", contentType);
      if (contentLength) res.setHeader("Content-Length", contentLength);
      if (contentRange) res.setHeader("Content-Range", contentRange);
      if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);

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
      const response = await fetch(
        `https://music.163.com/api/song/detail?ids=[${id}]`,
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

      const playableTracks = [];
      for (const track of playlist.tracks || []) {
        const playableUrl = await resolveNeteasePlayableUrl(track.id);
        if (!playableUrl) continue;
        playableTracks.push(track);
      }

      const nextPlaylist = {
        ...playlist,
        tracks: playableTracks,
      };

      res.json({
        ...data,
        playlist: data.playlist ? nextPlaylist : undefined,
        result: data.result ? nextPlaylist : undefined,
      });
    } catch (error) {
      console.error("Error fetching playable NetEase playlist:", error);
      res.status(500).json({ error: "Failed to fetch playable playlist data" });
    }
  });

  app.get("/api/netease/user-playlists", async (req, res) => {
    const uid = String(req.query.uid || "").trim();
    const rawLimit = Number(req.query.limit || 30);
    const rawOffset = Number(req.query.offset || 0);
    const limit = Math.max(1, Math.min(100, Number.isFinite(rawLimit) ? rawLimit : 30));
    const offset = Math.max(0, Number.isFinite(rawOffset) ? rawOffset : 0);
    if (!uid) {
      return res.status(400).json({ error: "Missing user ID" });
    }

    try {
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
