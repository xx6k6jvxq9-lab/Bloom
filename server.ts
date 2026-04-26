import express from "express";
import { createServer as createViteServer } from "vite";
import { Readable } from "stream";
import os from "os";
import {
  createWechatBindSession,
  disableWechatBindingByCharacterId,
  enqueueWechatIncomingMessage,
  enqueueWechatOutgoingMessage,
  getWechatBindingsOverview,
  getWechatBindingByCharacterId,
  getWechatBindSessionByCharacterId,
  getWechatBindSessionByToken,
  markWechatBindSessionBound,
  pullWechatIncomingMessages,
  pullWechatOutgoingMessages,
} from "./wechatBridgeStore";

function pickFirstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function tryParseUrl(value: unknown): URL | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function resolveWebhookMessagePayload(input: unknown): {
  conversationId?: string;
  wechatIdentity?: string;
  channelAccountId?: string;
  channelPeerId?: string;
  text?: string;
  senderDisplayName?: string;
} {
  const root = asRecord(input) ?? {};
  const event = asRecord(root.event);
  const message = asRecord(root.message) ?? asRecord(root.msg);
  const sender = asRecord(root.sender) ?? asRecord(message?.sender) ?? asRecord(event?.sender);
  const chat = asRecord(root.chat) ?? asRecord(event?.chat) ?? asRecord(message?.chat);

  return {
    conversationId: pickFirstString(
      root.conversationId,
      root.chatId,
      root.sessionId,
      root.roomId,
      root.talker,
      event?.conversationId,
      event?.chatId,
      event?.sessionId,
      event?.roomId,
      event?.talker,
      chat?.id,
      chat?.conversationId,
      chat?.chatId,
      message?.conversationId,
      message?.chatId,
      message?.sessionId,
      message?.talker,
      message?.from,
    ),
    wechatIdentity: pickFirstString(
      root.wechatIdentity,
      root.wechatId,
      root.senderId,
      event?.wechatIdentity,
      event?.wechatId,
      event?.senderId,
      sender?.id,
      sender?.wechatId,
      sender?.identity,
      sender?.senderId,
      message?.senderId,
      message?.fromUser,
    ),
    channelAccountId: pickFirstString(
      root.channelAccountId,
      root.accountId,
      event?.channelAccountId,
      event?.accountId,
      chat?.accountId,
      message?.accountId,
    ),
    channelPeerId: pickFirstString(
      root.channelPeerId,
      root.peerId,
      event?.channelPeerId,
      event?.peerId,
      chat?.peerId,
      message?.peerId,
    ),
    text: pickFirstString(
      root.text,
      root.content,
      root.messageText,
      message?.text,
      message?.content,
      message?.message,
      event?.text,
      event?.content,
    ),
    senderDisplayName: pickFirstString(
      root.senderDisplayName,
      root.nickname,
      sender?.displayName,
      sender?.nickname,
      sender?.name,
      sender?.remark,
      message?.senderDisplayName,
      event?.senderDisplayName,
    ),
  };
}

function resolveOpenClawConnectPayload(input: unknown, requestUrl?: string): {
  token?: string;
  conversationId?: string;
  wechatIdentity?: string;
  channelAccountId?: string;
  channelPeerId?: string;
  openClawPairingId?: string;
  displayName?: string;
  avatarUrl?: string;
} {
  const root = asRecord(input) ?? {};
  const event = asRecord(root.event);
  const message = asRecord(root.message) ?? asRecord(root.msg);
  const sender = asRecord(root.sender) ?? asRecord(message?.sender) ?? asRecord(event?.sender);
  const chat = asRecord(root.chat) ?? asRecord(event?.chat) ?? asRecord(message?.chat);
  const callbackUrl = pickFirstString(
    root.callbackUrl,
    root.bindCallbackUrl,
    event?.callbackUrl,
    event?.bindCallbackUrl,
    message?.callbackUrl,
  );
  const parsedCallbackUrl = tryParseUrl(callbackUrl);
  const parsedRequestUrl = tryParseUrl(requestUrl);

  return {
    token: pickFirstString(
      root.token,
      root.bindToken,
      root.state,
      event?.token,
      event?.bindToken,
      event?.state,
      message?.token,
      parsedRequestUrl?.searchParams.get("token") || undefined,
      parsedRequestUrl?.searchParams.get("bindToken") || undefined,
      parsedCallbackUrl?.searchParams.get("token") || undefined,
      parsedCallbackUrl?.searchParams.get("bindToken") || undefined,
    ),
    conversationId: pickFirstString(
      root.conversationId,
      root.chatId,
      root.sessionId,
      root.roomId,
      root.talker,
      event?.conversationId,
      event?.chatId,
      event?.sessionId,
      event?.roomId,
      event?.talker,
      chat?.id,
      chat?.conversationId,
      chat?.chatId,
      message?.conversationId,
      message?.chatId,
      message?.sessionId,
      message?.talker,
      message?.from,
    ),
    wechatIdentity: pickFirstString(
      root.wechatIdentity,
      root.wechatId,
      root.senderId,
      event?.wechatIdentity,
      event?.wechatId,
      event?.senderId,
      sender?.id,
      sender?.wechatId,
      sender?.identity,
      sender?.senderId,
      message?.senderId,
      message?.fromUser,
    ),
    channelAccountId: pickFirstString(
      root.channelAccountId,
      root.accountId,
      event?.channelAccountId,
      event?.accountId,
      chat?.accountId,
      message?.accountId,
    ),
    channelPeerId: pickFirstString(
      root.channelPeerId,
      root.peerId,
      event?.channelPeerId,
      event?.peerId,
      chat?.peerId,
      message?.peerId,
    ),
    openClawPairingId: pickFirstString(
      root.openClawPairingId,
      root.pairingId,
      event?.openClawPairingId,
      event?.pairingId,
      message?.pairingId,
    ),
    displayName: pickFirstString(
      root.displayName,
      root.nickname,
      sender?.displayName,
      sender?.nickname,
      sender?.name,
      sender?.remark,
      message?.senderDisplayName,
      event?.senderDisplayName,
    ),
    avatarUrl: pickFirstString(
      root.avatarUrl,
      root.avatar,
      root.headImgUrl,
      sender?.avatarUrl,
      sender?.avatar,
      sender?.headImgUrl,
      message?.avatarUrl,
      event?.avatarUrl,
    ),
  };
}

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

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/wechat/bind-session", async (req, res) => {
    const characterId = String(req.body?.characterId || "").trim();
    const bloomUserId = String(req.body?.bloomUserId || "").trim();
    if (!characterId) {
      return res.status(400).json({ error: "Missing characterId" });
    }
    if (!bloomUserId) {
      return res.status(400).json({ error: "Missing bloomUserId" });
    }

    try {
      const appOrigin = `${req.protocol}://${req.get("host") || `127.0.0.1:${PORT}`}`;
      const session = await createWechatBindSession({
        characterId,
        bloomUserId,
        characterName: typeof req.body?.characterName === "string" ? req.body.characterName.trim() : undefined,
        characterAvatarUrl: typeof req.body?.characterAvatarUrl === "string" ? req.body.characterAvatarUrl.trim() : undefined,
        appOrigin,
      });
      res.json(session);
    } catch (error) {
      console.error("Error creating WeChat bind session:", error);
      res.status(500).json({ error: "Failed to create WeChat bind session" });
    }
  });

  app.get("/api/wechat/bind-session/by-character/:characterId", async (req, res) => {
    try {
      const session = await getWechatBindSessionByCharacterId(
        String(req.params.characterId || "").trim(),
        typeof req.query?.bloomUserId === "string" ? req.query.bloomUserId.trim() : undefined,
      );
      res.json({ session });
    } catch (error) {
      console.error("Error reading WeChat bind session by character:", error);
      res.status(500).json({ error: "Failed to load WeChat bind session" });
    }
  });

  app.get("/api/wechat/bind-session/:token", async (req, res) => {
    try {
      const session = await getWechatBindSessionByToken(String(req.params.token || "").trim());
      res.json({ session });
    } catch (error) {
      console.error("Error reading WeChat bind session:", error);
      res.status(500).json({ error: "Failed to load WeChat bind session" });
    }
  });

  app.get("/api/wechat/binding/by-character/:characterId", async (req, res) => {
    try {
      const binding = await getWechatBindingByCharacterId(
        String(req.params.characterId || "").trim(),
        typeof req.query?.bloomUserId === "string" ? req.query.bloomUserId.trim() : undefined,
      );
      res.json({ binding });
    } catch (error) {
      console.error("Error reading WeChat binding by character:", error);
      res.status(500).json({ error: "Failed to load WeChat binding" });
    }
  });

  app.get("/api/wechat/bindings", async (_req, res) => {
    try {
      const overview = await getWechatBindingsOverview();
      res.json(overview);
    } catch (error) {
      console.error("Error reading WeChat bindings overview:", error);
      res.status(500).json({ error: "Failed to load WeChat bindings overview" });
    }
  });

  const handleWechatBindSessionConnect = async (req: express.Request, res: express.Response) => {
    const conversationId = String(req.body?.conversationId || "").trim();
    const channelPeerId = String(req.body?.channelPeerId || "").trim();
    const wechatIdentity = String(req.body?.wechatIdentity || "").trim();
    if (!conversationId && !channelPeerId && !wechatIdentity) {
      return res.status(400).json({ error: "Missing conversationId or WeChat identity" });
    }

    try {
      const result = await markWechatBindSessionBound(String(req.params.token || "").trim(), {
        conversationId: conversationId || undefined,
        wechatIdentity: wechatIdentity || undefined,
        channelAccountId: typeof req.body?.channelAccountId === "string" ? req.body.channelAccountId.trim() : undefined,
        channelPeerId: channelPeerId || undefined,
        openClawPairingId: typeof req.body?.openClawPairingId === "string" ? req.body.openClawPairingId.trim() : undefined,
        displayName: typeof req.body?.displayName === "string" ? req.body.displayName.trim() : undefined,
        avatarUrl: typeof req.body?.avatarUrl === "string" ? req.body.avatarUrl.trim() : undefined,
      });

      if (!result) {
        return res.status(404).json({ error: "Bind session not found" });
      }

      res.json(result);
    } catch (error) {
      console.error("Error binding WeChat session:", error);
      res.status(500).json({ error: "Failed to bind WeChat session" });
    }
  };

  app.post("/api/wechat/bind-session/:token/bind", handleWechatBindSessionConnect);
  app.post("/api/wechat/bind-session/:token/connect", handleWechatBindSessionConnect);

  app.post("/api/wechat/binding/by-character/:characterId/disable", async (req, res) => {
    try {
      const binding = await disableWechatBindingByCharacterId(
        String(req.params.characterId || "").trim(),
        typeof req.query?.bloomUserId === "string" ? req.query.bloomUserId.trim() : undefined,
      );
      res.json({ binding });
    } catch (error) {
      console.error("Error disabling WeChat binding:", error);
      res.status(500).json({ error: "Failed to disable WeChat binding" });
    }
  });

  app.post("/api/wechat/messages", async (req, res) => {
    const conversationId = String(req.body?.conversationId || "").trim();
    const wechatIdentity = String(req.body?.wechatIdentity || "").trim();
    const channelPeerId = String(req.body?.channelPeerId || "").trim();
    const text = String(req.body?.text || "").trim();
    if ((!conversationId && !wechatIdentity && !channelPeerId) || !text) {
      return res.status(400).json({ error: "Missing WeChat identity or text" });
    }

    try {
      const message = await enqueueWechatIncomingMessage({
        conversationId: conversationId || undefined,
        wechatIdentity: wechatIdentity || undefined,
        channelAccountId: typeof req.body?.channelAccountId === "string" ? req.body.channelAccountId.trim() : undefined,
        channelPeerId: channelPeerId || undefined,
        text,
        senderDisplayName: typeof req.body?.senderDisplayName === "string" ? req.body.senderDisplayName.trim() : undefined,
      });
      if (!message) {
        return res.status(404).json({ error: "No enabled binding for this WeChat identity" });
      }
      res.json({ message });
    } catch (error) {
      console.error("Error enqueueing WeChat incoming message:", error);
      res.status(500).json({ error: "Failed to enqueue WeChat incoming message" });
    }
  });

  app.post("/api/wechat/clawbot/callback", async (req, res) => {
    const payload = resolveWebhookMessagePayload(req.body);
    if ((!payload.conversationId && !payload.wechatIdentity && !payload.channelPeerId) || !payload.text) {
      return res.status(400).json({
        error: "Unable to resolve WeChat identity or text from callback payload",
        resolved: payload,
      });
    }

    try {
      const message = await enqueueWechatIncomingMessage({
        conversationId: payload.conversationId,
        wechatIdentity: payload.wechatIdentity,
        channelAccountId: payload.channelAccountId,
        channelPeerId: payload.channelPeerId,
        text: payload.text,
        senderDisplayName: payload.senderDisplayName,
      });

      if (!message) {
        return res.status(202).json({
          accepted: false,
          reason: "No enabled binding for this WeChat identity",
          resolved: payload,
        });
      }

      res.json({
        accepted: true,
        message,
      });
    } catch (error) {
      console.error("Error handling Clawbot callback:", error);
      res.status(500).json({ error: "Failed to handle Clawbot callback" });
    }
  });

  app.post("/api/wechat/openclaw/connect-callback", async (req, res) => {
    const payload = resolveOpenClawConnectPayload(req.body, `${req.protocol}://${req.get("host") || `127.0.0.1:${PORT}`}${req.originalUrl}`);
    if (!payload.token) {
      return res.status(400).json({ error: "Missing bind token in OpenClaw callback", resolved: payload });
    }
    if (!payload.conversationId && !payload.wechatIdentity && !payload.channelPeerId) {
      return res.status(400).json({ error: "Missing WeChat identity in OpenClaw callback", resolved: payload });
    }

    try {
      const result = await markWechatBindSessionBound(payload.token, {
        conversationId: payload.conversationId,
        wechatIdentity: payload.wechatIdentity,
        channelAccountId: payload.channelAccountId,
        channelPeerId: payload.channelPeerId,
        openClawPairingId: payload.openClawPairingId,
        displayName: payload.displayName,
        avatarUrl: payload.avatarUrl,
      });

      if (!result) {
        return res.status(404).json({ error: "Bind session not found", resolved: payload });
      }

      res.json({ connected: true, ...result });
    } catch (error) {
      console.error("Error handling OpenClaw connect callback:", error);
      res.status(500).json({ error: "Failed to handle OpenClaw connect callback" });
    }
  });

  app.post("/api/wechat/messages/pull", async (_req, res) => {
    try {
      const messages = await pullWechatIncomingMessages();
      res.json({ messages });
    } catch (error) {
      console.error("Error pulling WeChat incoming messages:", error);
      res.status(500).json({ error: "Failed to pull WeChat incoming messages" });
    }
  });

  app.post("/api/wechat/messages/outgoing", async (req, res) => {
    const conversationId = String(req.body?.conversationId || "").trim();
    const characterId = String(req.body?.characterId || "").trim();
    const text = String(req.body?.text || "").trim();
    if (!conversationId || !characterId || !text) {
      return res.status(400).json({ error: "Missing conversationId, characterId or text" });
    }

    try {
      const message = await enqueueWechatOutgoingMessage({
        conversationId,
        characterId,
        text,
        replyToMessageId: typeof req.body?.replyToMessageId === "string" ? req.body.replyToMessageId.trim() : undefined,
        characterName: typeof req.body?.characterName === "string" ? req.body.characterName.trim() : undefined,
        avatarUrl: typeof req.body?.avatarUrl === "string" ? req.body.avatarUrl.trim() : undefined,
      });

      if (!message) {
        return res.status(404).json({ error: "No enabled binding for this conversationId and characterId" });
      }

      res.json({ message });
    } catch (error) {
      console.error("Error enqueueing WeChat outgoing message:", error);
      res.status(500).json({ error: "Failed to enqueue WeChat outgoing message" });
    }
  });

  app.post("/api/wechat/messages/outgoing/pull", async (_req, res) => {
    try {
      const messages = await pullWechatOutgoingMessages();
      res.json({ messages });
    } catch (error) {
      console.error("Error pulling WeChat outgoing messages:", error);
      res.status(500).json({ error: "Failed to pull WeChat outgoing messages" });
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
    const limit = Math.max(1, Math.min(30, Number(req.query.limit || 12)));
    if (!uid) {
      return res.status(400).json({ error: "Missing user ID" });
    }

    try {
      const response = await fetch(
        `https://music.163.com/api/user/playlist/?offset=0&limit=${limit}&uid=${uid}`,
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
